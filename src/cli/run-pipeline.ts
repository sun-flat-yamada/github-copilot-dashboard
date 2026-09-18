import * as fs from 'fs';
import { GitHubCopilotClient } from '../collector/github-client.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { loadUserMappingFromFile } from '../collector/mapping-file-loader.js';
import { MockDataGenerator } from '../collector/mock-generator.js';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { MetricsAggregator } from '../processor/metrics-aggregator.js';
import { ReportParser } from '../processor/report-parser.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';
import { CostCenterBudget, IndexMetadata, MonthlyUsageReportRawRecord, UserUsageProfile } from '../types/copilot.js';

async function main() {
  console.log('=====================================================');
  console.log('🚀 GitHub Copilot Analytics Pipeline (2026.09 LTS)');
  console.log('=====================================================');

  const isMock = process.argv.includes('--mock') || process.env.MOCK_MODE === 'true';

  // 1. 各モジュールの初期化
  const client = new GitHubCopilotClient({ mockMode: isMock });
  // 優先順位: COPILOT_USER_MAPPING_FILE (48KB超GPG復号ワークアラウンド等) > COPILOT_USER_MAPPING
  //           > COPILOT_USER_MAPPING_BASE64 > 未設定時のフォールバック
  const resolver = new AttributeResolver(loadUserMappingFromFile(process.env.COPILOT_USER_MAPPING_FILE));
  const aggregator = new MetricsAggregator();
  const storage = new ForkSafeStorage();
  const reportParser = new ReportParser(resolver);

  console.log(`📋 AttributeResolver: Loaded ${resolver.getMappingCount()} custom user attribute mapping(s).`);

  // 2. データ収集 (Cost Center Budgets と User Profiles は実データ運用では
  //    この後のエンリッチメント/CSV集計結果から構築するため、ここでは取得しない)
  console.log('📡 Fetching Copilot Metrics, Seat assignments, and Cost Centers...');
  const [metrics, seats, costCenters] = await Promise.all([
    client.fetchMetrics(),
    client.fetchSeats(),
    client.fetchCostCenters(),
  ]);

  console.log(
    `✅ Data Fetched: ${metrics.length} daily metric records, ${seats.length} seats, ${costCenters.length} cost centers.`
  );

  // 実データ運用でメトリクス/シートが1件も取得できない場合(認証情報未設定、または
  // Enterprise Owner権限が無い等)でも、捏造データで埋めたりパイプライン全体を
  // 中断したりはしない。Live Metrics スコープの生成のみスキップし、Monthly Usage
  // Report (CSV) や AI Model Benchmark など認証情報に依存しない機能は継続して動作させる。
  const hasLiveMetrics = metrics.length > 0;
  if (!hasLiveMetrics) {
    console.warn(
      '⚠️  No Copilot metrics retrieved (COPILOT_READ_TOKEN / COPILOT_ENTERPRISE / COPILOT_ORGS may be unset, ' +
        'or the credential lacks Enterprise Owner permission). Continuing without live metrics — ' +
        'Monthly Usage Report (CSV) and other credential-independent features remain available.'
    );
  }

  // 3. 料金計算・エンリッチメント
  //    ライブメトリクスが1件も無い場合は、実行時点のUTC日付を基準日として利用する
  //    (架空の日付を捏造するのではなく、シート在籍期間・非アクティブ判定にのみ使用)
  const referenceDate = hasLiveMetrics ? metrics[metrics.length - 1].date : new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const [currentYear, currentMonth] = referenceDate.split('-').map(Number);
  const daysInCurrentMonth = BillingCalculator.getDaysInMonth(currentYear, currentMonth);

  const billingCalc = new BillingCalculator(resolver, costCenters, referenceDate);
  const enrichedSeats = billingCalc.enrichAllSeats(seats, daysInCurrentMonth);

  console.log(`💡 Enriched ${enrichedSeats.length} user seats with cost calculation and idle analysis.`);

  // 4. Rawパーティション保存 (最新日のRawデータが存在する場合のみ保存)
  if (hasLiveMetrics) {
    const latestMetric = metrics[metrics.length - 1];
    storage.saveRawDailyData(latestMetric.date, latestMetric, seats, costCenters);
  }

  // 取得時のエラー・警告一覧の取得
  const issues = client.getIssues();
  console.log(`🔍 Detected ${issues.length} data fetch issue(s) during collection.`);
  storage.saveErrorLog(issues);

  // 4b. Cost Center Budgets と User Profiles の構築
  //    - Mockモード: 従来通り MockDataGenerator 由来のデータを使用
  //    - 実データモード: GitHubのPublic APIには Cost Center Budget や ユーザー別モデル内訳を返す
  //      エンドポイントが存在しないため、(a) 実のEnrichedUserSeatコスト + 管理者宣言の
  //      COPILOT_COST_CENTER_BUDGETS 環境変数からBudgetを計算し、(b) 既にインポート済みの
  //      Monthly Usage Report CSV から User Profile を構築する。どちらも存在しない場合は捕造せず空配列とする。
  let costCenterBudgets: CostCenterBudget[];
  let userProfiles: UserUsageProfile[];

  if (isMock) {
    [costCenterBudgets, userProfiles] = await Promise.all([
      client.fetchCostCenterBudgets(),
      client.fetchUserProfiles(),
    ]);
  } else {
    const budgetConfig = BillingCalculator.parseBudgetConfig(process.env.COPILOT_COST_CENTER_BUDGETS);
    costCenterBudgets = BillingCalculator.computeCostCenterBudgets(enrichedSeats, costCenters, budgetConfig);

    const seatsByLogin = new Map(enrichedSeats.map((s) => [s.login.toLowerCase(), s]));
    const reportMonthsForProfiles = storage.getStoredReportMonths();
    const allReportRecords: MonthlyUsageReportRawRecord[] = [];
    for (const month of reportMonthsForProfiles) {
      for (const csvPath of storage.getRawReportFiles(month)) {
        try {
          allReportRecords.push(...reportParser.parseRecords(fs.readFileSync(csvPath, 'utf-8')));
        } catch (err) {
          console.warn(`⚠️ Warning: Failed to parse report CSV for user profile construction at ${csvPath}:`, err);
        }
      }
    }
    userProfiles = reportParser.buildUserProfiles(allReportRecords, seatsByLogin);
  }

  console.log(`💰 Prepared ${costCenterBudgets.length} cost center budget(s) and ${userProfiles.length} user profile(s).`);

  // 5〜7. 日次・月次・カスタム期間スコープ集計の生成
  //       ライブメトリクスが1件も無い場合は集計対象データが存在しないためスキップする。
  //       index.json の available_days/available_months は空配列のままとなり、
  //       フロントエンドは「ライブ利用データなし」を明示的に表示する(空データの捏造はしない)。
  const availableDays: string[] = [];
  let monthKey: string | undefined;
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (hasLiveMetrics) {
    // 5. 日次スコープ集計の生成 (直近7日分)
    const recentMetrics = metrics.slice(-7);
    for (const m of recentMetrics) {
      const dailyData = aggregator.aggregateScope(
        'daily',
        m.date,
        [m],
        enrichedSeats,
        { start: m.date, end: m.date, days_count: 1 },
        issues,
        costCenterBudgets,
        userProfiles
      );
      storage.saveProcessedScope(dailyData);
      availableDays.push(m.date);
    }

    // 6. 月次スコープ集計の生成
    monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthlyMetrics = metrics.filter((m) => m.date.startsWith(monthKey!));
    const monthlyData = aggregator.aggregateScope(
      'monthly',
      monthKey,
      monthlyMetrics,
      enrichedSeats,
      {
        start: `${monthKey}-01`,
        end: referenceDate,
        days_count: daysInCurrentMonth,
      },
      issues,
      costCenterBudgets,
      userProfiles
    );
    storage.saveProcessedScope(monthlyData);

    // 7. カスタム期間 (直近30日) スコープ集計の生成
    startDate = metrics[0].date;
    endDate = referenceDate;
    const customData = aggregator.aggregateScope(
      'custom',
      'latest-30d',
      metrics,
      enrichedSeats,
      {
        start: startDate,
        end: endDate,
        days_count: metrics.length,
      },
      issues,
      costCenterBudgets,
      userProfiles
    );
    storage.saveProcessedScope(customData);
  }

  // 8. Monthly Usage Report (CSV) の検出・集計・保存
  console.log('📑 Processing Monthly Usage Reports (CSV)...');

  // モックモードの場合、モックレポートCSVを生成 (保存されていない場合)
  if (isMock) {
    const mockGen = new MockDataGenerator();
    const mockMonths = ['2026-08', '2026-09'];
    for (const m of mockMonths) {
      const existingCsvs = storage.getRawReportFiles(m);
      if (existingCsvs.length === 0) {
        const mockCsv = mockGen.generateMonthlyUsageReportCSV(m);
        storage.saveRawReportFile(m, `copilot_monthly_usage_${m}.csv`, mockCsv);
      }
    }
  }

  // 保持されている全レポート月のCSVを集計
  const availableReportMonths = storage.getStoredReportMonths();
  console.log(`📊 Found ${availableReportMonths.length} monthly usage report partition(s): ${availableReportMonths.join(', ')}`);

  for (const repMonth of availableReportMonths) {
    const csvFiles = storage.getRawReportFiles(repMonth);
    for (const csvPath of csvFiles) {
      try {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const fileName = csvPath.split(/[\\/]/).pop() || `${repMonth}.csv`;
        const rawRecords = reportParser.parseRecords(csvContent);
        if (rawRecords.length > 0) {
          const aggregatedReport = reportParser.aggregate(rawRecords, repMonth, fileName, 'persisted');
          storage.saveProcessedReport(aggregatedReport);
          console.log(`✅ Aggregated monthly report for ${repMonth}: ${rawRecords.length} records, $${aggregatedReport.overview.total_net_spend_usd} total net spend.`);
        }
      } catch (err) {
        console.warn(`⚠️ Warning: Failed to parse report CSV at ${csvPath}:`, err);
      }
    }
  }

  // 9. index.json メタデータの生成と保存
  const totalMonthlySpend = enrichedSeats.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
  const idleSeats = enrichedSeats.filter((u) => u.status === 'idle' || u.status === 'never_used');
  const idleWasteSpend = idleSeats.reduce((sum, u) => sum + u.monthly_cost_usd, 0);

  const indexMeta: IndexMetadata = {
    repository: {
      owner: process.env.GITHUB_REPOSITORY_OWNER || 'proud-corp',
      name: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'github-copilot-dashboard',
      is_fork: process.env.IS_FORK === 'true',
    },
    generated_at: new Date().toISOString(),
    data_retention_days: 365,
    available_months: monthKey ? [monthKey] : [],
    available_days: availableDays.reverse(),
    // 空の場合は undefined ではなく [] を返す (フロントエンドが不使用ハードコード値に
    // フォールバックせず、正しく「レポートなし」を表示できるようにするため)
    available_reports: availableReportMonths,
    default_scopes: {
      latest_day: hasLiveMetrics ? referenceDate : undefined,
      latest_month: monthKey,
      latest_report: availableReportMonths[0],
      latest_range: startDate && endDate ? { start: startDate, end: endDate } : undefined,
    },
    summary: {
      total_seats: enrichedSeats.length,
      active_seats_30d: enrichedSeats.length - idleSeats.length,
      idle_seats_30d: idleSeats.length,
      total_monthly_spend_usd: Number(totalMonthlySpend.toFixed(2)),
      idle_waste_spend_usd: Number(idleWasteSpend.toFixed(2)),
    },
    issues: issues.length > 0 ? issues : undefined,
  };

  storage.saveIndex(indexMeta);

  console.log('=====================================================');
  console.log('🎉 Pipeline completed successfully!');
  console.log(`📊 Total Seats: ${indexMeta.summary.total_seats}`);
  console.log(`💰 Total Monthly Spend: $${indexMeta.summary.total_monthly_spend_usd}`);
  console.log(`⚠️ Idle Seats Detected: ${indexMeta.summary.idle_seats_30d} ($${indexMeta.summary.idle_waste_spend_usd} waste/month)`);
  console.log('=====================================================');
}

main().catch((err) => {
  console.error('❌ Pipeline failed with exception:', err);
  process.exit(1);
});
