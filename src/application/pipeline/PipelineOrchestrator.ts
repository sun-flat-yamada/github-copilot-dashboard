import type { CsvImportReport } from '../../domain/entities/csv-import.js';
import * as fs from 'fs';
import { ICopilotDataSource } from '../../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../../domain/ports/IAttributeResolver.js';
import { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import { BillingCalculator } from '../../processor/billing-calculator.js';
import { MetricsAggregator } from '../../processor/metrics-aggregator.js';
import { ReportParser } from '../../processor/report-parser.js';
import { enrichUserProfiles } from '../../processor/profile-enricher.js';
import { carryOverUsageSections } from '../../processor/scope-merge.js';
import { buildRollingTrendEntry } from '../../processor/rolling-trend.js';
import { buildYearlyTrend, buildYearlyTrendCloseRule, yearlyTrendMonthsNeeded } from '../../processor/yearly-trend.js';
import { extractMonthlyFigures, extractReportFigures, parseBusinessCalendar } from '../../processor/month-close.js';
import { MonthCloseService, type RevisionRequest } from './month-close.js';
import { parseRetentionMonths } from '../../processor/retention.js';
import { SeatAuditService } from './seat-audit.js';
import { BillingReconciliationService } from './billing-reconciliation.js';
import { parseTolerance } from '../../processor/billing-reconciliation.js';
import { MockDataGenerator, MOCK_DATA_UNAVAILABLE_ORGS } from '../../collector/mock-generator.js';
import {
  CostCenterBudget,
  DataFetchIssue,
  EnrichedUserSeat,
  IndexMetadata,
  RollingTrendEntry,
  ScopeAggregatedData,
  UserUsageProfile,
} from '../../domain/entities/copilot.js';
import { AttributeResolver } from '../../collector/attribute-resolver.js';
import { loadUserMappingFromFile } from '../../collector/mapping-file-loader.js';
import { loadDemoUserMapping } from '../../collector/demo-mapping-loader.js';
import { BillingConfigLoader } from '../../adapters/storage/BillingConfigLoader.js';
import { isIdleSeatStatus } from '../../domain/rules/SeatClassificationRule.js';
import {
  computeCreditsPoolUtilizationPercent,
  estimateIncludedCreditsPool,
} from '../../domain/pricing/pricing-catalog.js';
import { PublicExchangeRatesService, type ExchangeRateCatalog } from '../../domain/services/PublicExchangeRatesService.js';
import { appendQualityHistory, buildDataQualityReport, summarizeQualityHistory } from './data-quality.js';
import { isSourceUsable, resolveSourceStatuses, statusOrInferred } from './source-status.js';

export interface PipelineOrchestratorDependencies {
  dataSource: ICopilotDataSource;
  resolver: IAttributeResolver;
  storage: IStorageWriter;
  isMock?: boolean;
  /**
   * 匿名化 (仮名化) モード。省略時は環境変数 ANONYMIZE_USERS=true。
   * 有効なときは秘密鍵 (ANONYMIZE_SECRET) が必須で、無い場合は run() が例外で停止する。
   */
  anonymize?: boolean;
  /**
   * この実行の Raw Landing 上の識別 (P1-2)。ライブ収集では録画した run、再処理では再生元の run。
   * 無い場合 (モック・匿名化で Raw を保存しない運用) は index.json に run を残さない。
   */
  run?: {
    runId: string;
    /** 再処理 (Raw Landing の再生) のとき true */
    reprocessed?: boolean;
    /** 収集 (fetch*) の完了後に 1 回呼ぶ。Run Manifest の書き出し。書けなかった場合は false を返す */
    finishLanding?: () => boolean;
  };
  /**
   * 確定済みの月 (月次締め, P4-2) の改訂を許可する指定。無い場合、確定月の数値は書き換えない
   * (差が出るときは書き込まず issue にする)。
   */
  revision?: RevisionRequest;
}

/** 設定 (環境変数 / 設定ファイル) の不備を、画面から気付けるよう issue として表す */
function makeConfigIssue(target: string, message: string, details?: string): DataFetchIssue {
  return {
    id: `issue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    severity: 'error',
    category: 'data_integrity',
    target,
    message,
    details,
  };
}

export class PipelineOrchestrator {
  private dataSource: ICopilotDataSource;
  private resolver: IAttributeResolver;
  private storage: IStorageWriter;
  private isMock: boolean;
  private anonymize: boolean;
  private runInfo?: PipelineOrchestratorDependencies['run'];
  private revision?: RevisionRequest;

  constructor(deps: PipelineOrchestratorDependencies) {
    this.dataSource = deps.dataSource;
    this.resolver = deps.resolver;
    this.storage = deps.storage;
    this.isMock = deps.isMock ?? false;
    this.anonymize = deps.anonymize ?? process.env.ANONYMIZE_USERS === 'true';
    this.runInfo = deps.run;
    this.revision = deps.revision;
  }

  async run(): Promise<void> {
    console.log('=====================================================');
    console.log('🚀 GitHub Copilot Analytics Pipeline (Clean Architecture / 2026.09 LTS)');
    console.log('=====================================================');

    // 下位互換用の AttributeResolver (プロセッサ層の既存クラスとの連携)
    let mappingConfig = loadUserMappingFromFile(process.env.COPILOT_USER_MAPPING_FILE);
    if (!mappingConfig && !process.env.COPILOT_USER_MAPPING && !process.env.COPILOT_USER_MAPPING_BASE64 && this.isMock) {
      mappingConfig = loadDemoUserMapping();
      if (mappingConfig) {
        console.log('🔐 AttributeResolver: Auto-loaded DEMO user mappings from GPG-encrypted fixture.');
      }
    }
    const legacyResolver = new AttributeResolver(
      mappingConfig || process.env.COPILOT_USER_MAPPING || process.env.COPILOT_USER_MAPPING_BASE64,
      this.anonymize
    );
    if (legacyResolver.isAnonymizing()) {
      console.log('🕶️  Anonymization is enabled: logins, display names, departments and avatars are pseudonymized/removed in all outputs.');
    }
    const aggregator = new MetricsAggregator();
    const reportParser = new ReportParser(legacyResolver);

    console.log(`📋 AttributeResolver: Loaded ${this.resolver.getMappingCount()} mapping(s).`);

    const nowIso = new Date().toISOString();
    // 前回の成果物 (取得に失敗したソースの Last-known-good を維持するために使う)
    const previousIndex = this.storage.loadIndex();
    // 為替カタログ (保存済み。無ければ換算は出さない)
    PublicExchangeRatesService.setCatalog(this.storage.loadCatalog?.<ExchangeRateCatalog>('exchange-rates') ?? null);

    // 設定の不備は黙ってフォールバックせず、issue として記録する
    const configIssues: DataFetchIssue[] = [];
    const billingLoad = BillingConfigLoader.loadWithDiagnostics();
    if (billingLoad.error) {
      configIssues.push(
        makeConfigIssue(
          'config:COPILOT_BILLING_CONFIG',
          'Billing configuration is invalid; catalog list prices are being used instead.',
          `Source: ${billingLoad.source}. ${billingLoad.error}`
        )
      );
    }
    const billingConfig = billingLoad.config;

    // 月次締め (P4-2): 営業日カレンダー (翌月の第 N 営業日に締める)。不正な設定は既定値で続行し issue にする
    const calendarLoad = parseBusinessCalendar(process.env.COPILOT_BUSINESS_CALENDAR);
    if (calendarLoad.error) {
      configIssues.push(
        makeConfigIssue(
          'config:COPILOT_BUSINESS_CALENDAR',
          'Business calendar configuration is invalid; the default calendar (weekends off, 5th business day) is used instead.',
          calendarLoad.error
        )
      );
    }
    const monthClose = new MonthCloseService(this.storage, {
      now: new Date(nowIso),
      calendar: calendarLoad.config,
      runId: this.runInfo?.runId,
      revision: this.revision,
    });
    // 確定月の数値が、改訂の記録なしに変わっていないか (書き込み前に検査する)
    monthClose.reportProblems(monthClose.verify());

    // 1. データ収集
    console.log('📡 Fetching Copilot Metrics, Seat assignments, and Cost Centers...');
    const [metrics, seats, costCenters] = await Promise.all([
      this.dataSource.fetchMetrics(),
      this.dataSource.fetchSeats(),
      this.dataSource.fetchCostCenters(),
    ]);

    // AI Credits 利用量 (Enterprise 単位の Billing API)。取得結果の消費 (集計) は Phase 2。ここでは収集と状態の記録まで
    const aiCreditLines =
      !this.isMock && this.dataSource.fetchAiCreditUsage ? await this.dataSource.fetchAiCreditUsage() : [];

    // Raw Landing: 収集した応答の台帳 (Run Manifest) を確定する。書けなかった run は再処理できないので、index に印を付けない
    const landed = this.runInfo?.finishLanding ? this.runInfo.finishLanding() : this.runInfo !== undefined;
    if (this.runInfo?.finishLanding && landed) {
      console.log(`🗄️  Raw landing: run ${this.runInfo.runId} stored (reprocess with \`npm run pipeline:reprocess\`).`);
    }

    console.log(
      `✅ Data Fetched: ${metrics.length} daily metric records, ${seats.length} seats, ${costCenters.length} cost centers` +
        (aiCreditLines.length > 0 ? `, ${aiCreditLines.length} AI credit usage lines.` : '.')
    );

    // 「取得失敗」と「データなし」を区別する。失敗したソースは前回成功データ (Last-known-good) を
    // 維持し、空データで成果物を上書きしない。
    const reported = this.dataSource.getSourceStatuses();
    const statuses = resolveSourceStatuses(
      [
        statusOrInferred(reported, 'metrics', metrics.length, nowIso),
        statusOrInferred(reported, 'seats', seats.length, nowIso),
        statusOrInferred(reported, 'cost_centers', costCenters.length, nowIso),
        // 報告したときだけ載せる (モック・未対応の実装では項目を増やさない)
        ...reported.filter((s) => s.source === 'ai_credits'),
      ],
      previousIndex
    );
    const metricsStatus = statuses.find((s) => s.source === 'metrics');
    const seatsUsable = isSourceUsable(statuses.find((s) => s.source === 'seats'));
    const hasLiveMetrics = isSourceUsable(metricsStatus) && metrics.length > 0;

    for (const s of statuses) {
      if (s.status === 'failed') {
        console.warn(
          `⚠️  Source "${s.source}" failed (${s.error ?? 'unknown error'}). Keeping last-known-good data` +
            (s.last_success_at ? ` from ${s.last_success_at}.` : ' (none available).')
        );
      }
    }
    if (!hasLiveMetrics) {
      console.warn(
        '⚠️  No Copilot usage metrics available this run (COPILOT_READ_TOKEN / COPILOT_ENTERPRISE / COPILOT_ORGS may be unset, ' +
          'the API may have failed, or the credential lacks Enterprise Owner permission). Seat / cost analysis and ' +
          'Monthly Usage Report (CSV) processing continue; usage metrics are reported as unavailable.'
      );
    }

    // 2. 料金計算・エンリッチメント (シート・費用の分析は利用状況メトリクスの有無に依存しない)
    const sortedMetrics = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
    const referenceDate = hasLiveMetrics ? sortedMetrics[sortedMetrics.length - 1].date : nowIso.slice(0, 10);
    const [currentYear, currentMonth] = referenceDate.split('-').map(Number);
    const daysInCurrentMonth = BillingCalculator.getDaysInMonth(currentYear, currentMonth);
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const billingCalc = new BillingCalculator(legacyResolver, costCenters, referenceDate, {
      dataUnavailableOrgs: this.isMock ? MOCK_DATA_UNAVAILABLE_ORGS : [],
    });
    const enrichedSeats: EnrichedUserSeat[] = seatsUsable ? billingCalc.enrichAllSeats(seats, daysInCurrentMonth) : [];

    if (seatsUsable) {
      console.log(`💡 Enriched ${enrichedSeats.length} user seats with cost calculation and idle analysis.`);
    }

    // 3. Rawパーティション保存
    // (再処理では既存の Raw パーティションを書き換えない)
    if (hasLiveMetrics && seatsUsable && !this.runInfo?.reprocessed) {
      const latestMetric = sortedMetrics[sortedMetrics.length - 1];
      // 匿名化モードでは、Raw パーティションにもログイン名・ユーザー ID・アバター URL を残さない
      // (Raw は copilot-data ブランチに保存され、リポジトリが公開なら公開される)
      this.storage.saveRawDailyData(
        latestMetric.date,
        latestMetric,
        seats.map((s) => legacyResolver.redactSeatForStorage(s)),
        costCenters.map((c) => legacyResolver.redactCostCenterForStorage(c))
      );
    }

    // 4. Budgets と Profiles
    let costCenterBudgets: CostCenterBudget[] = [];
    let userProfiles: UserUsageProfile[] = [];

    if (this.isMock) {
      [costCenterBudgets, userProfiles] = await Promise.all([
        this.dataSource.fetchCostCenterBudgets(),
        this.dataSource.fetchUserProfiles(),
      ]);
    } else if (seatsUsable) {
      // ユーザー別プロファイル: 利用状況メトリクス (users-1-day) の実測から作り、シート・属性マッピングで属性を補う
      if (hasLiveMetrics) {
        const rawProfiles = await this.dataSource.fetchUserProfiles();
        userProfiles = enrichUserProfiles(rawProfiles, seats, enrichedSeats, legacyResolver);
      }
      const rawBudgets = process.env.COPILOT_COST_CENTER_BUDGETS;
      const budgetConfig = BillingCalculator.parseBudgetConfig(rawBudgets);
      if (rawBudgets && rawBudgets.trim() && budgetConfig.length === 0) {
        configIssues.push(
          makeConfigIssue(
            'config:COPILOT_COST_CENTER_BUDGETS',
            'COPILOT_COST_CENTER_BUDGETS is set but could not be parsed; no Cost Center budget limits are applied.',
            'Expected a JSON array (or object) of { cost_center_name | cost_center_id, spending_limit_usd, free_tier_budget_usd }.'
          )
        );
      }
      costCenterBudgets = BillingCalculator.computeCostCenterBudgets(enrichedSeats, costCenters, budgetConfig);
    }

    console.log(`💰 Prepared ${costCenterBudgets.length} cost center budget(s) and ${userProfiles.length} user profile(s).`);

    // エラーログの保存 (データソースの issue + 設定の不備)
    const issues: DataFetchIssue[] = [...this.dataSource.getIssues(), ...configIssues];
    console.log(`🔍 Detected ${issues.length} data fetch issue(s) during collection.`);
    this.storage.saveErrorLog(issues);

    // 5. スコープ集計 & 保存
    let availableDays: string[] = previousIndex?.available_days ?? [];
    let startDate: string | undefined = previousIndex?.default_scopes?.latest_range?.start;
    let endDate: string | undefined = previousIndex?.default_scopes?.latest_range?.end;
    let monthlyGenerated = false;

    if (seatsUsable && hasLiveMetrics) {
      availableDays = [];
      const recentMetrics = sortedMetrics.slice(-30);
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
        this.storage.saveScopeData('daily', dailyData.scope_key, dailyData);
        availableDays.push(m.date);
      }

      const monthlyMetrics = sortedMetrics.filter((m) => m.date.startsWith(monthKey));
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
      // 確定月は、改訂の指定が無い限り上書きしない (P4-2)
      const monthlyWritten = monthClose.allowWrite(monthKey, 'monthly', extractMonthlyFigures(monthlyData));
      if (monthlyWritten) this.storage.saveScopeData('monthly', monthlyData.scope_key, monthlyData);
      monthlyGenerated = true;

      // Deep Analysis アーカイブ保存 (ユーザー別プロファイルがある場合のみ。空のアーカイブで上書きしない)
      if (monthlyWritten && userProfiles.length > 0) {
        this.storage.saveDeepAnalysisArchive(monthKey, userProfiles);
      }

      // カスタム期間 (直近30日)
      startDate = sortedMetrics[0].date;
      endDate = referenceDate;
      const customData = aggregator.aggregateScope(
        'custom',
        'latest-30d',
        sortedMetrics,
        enrichedSeats,
        {
          start: startDate,
          end: endDate,
          days_count: sortedMetrics.length,
        },
        issues,
        costCenterBudgets,
        userProfiles
      );
      this.storage.saveScopeData('custom', 'latest-30d', customData);
    } else if (seatsUsable) {
      // 利用状況メトリクスを取得できなかった回: シート・費用の分析だけを当月スコープとして保存する。
      // 前回成功時の利用状況 (受諾率・日次推移等) があれば引き継ぎ、前回値であることを明示する。
      // 日次 (daily) / 期間 (custom) スコープはメトリクスの日付に基づくため、この回は更新せず前回成果物を維持する。
      const seatsOnly = aggregator.aggregateScope(
        'monthly',
        monthKey,
        [],
        enrichedSeats,
        { start: `${monthKey}-01`, end: referenceDate, days_count: daysInCurrentMonth },
        issues,
        costCenterBudgets,
        userProfiles
      );
      const previousMonthly = this.storage.loadScopeData('monthly', monthKey);
      const monthlyData = carryOverUsageSections(
        seatsOnly,
        previousMonthly,
        metricsStatus?.last_success_at ?? previousIndex?.generated_at
      );
      if (monthClose.allowWrite(monthKey, 'monthly', extractMonthlyFigures(monthlyData))) {
        this.storage.saveScopeData('monthly', monthlyData.scope_key, monthlyData);
      }
      monthlyGenerated = true;
    }

    // 6. Monthly Usage Report (CSV) の検出・集計・保存
    console.log('📑 Processing Monthly Usage Reports (CSV)...');

    if (this.isMock) {
      // モックモード (デモデータ生成) のみ。実データ運用では固定の月を生成しない。
      const mockGen = new MockDataGenerator();
      const mockMonths = ['2026-08', '2026-09'];
      for (const m of mockMonths) {
        const existingCsvs = this.storage.getRawReportFiles(m);
        if (existingCsvs.length === 0) {
          const mockCsv = mockGen.generateMonthlyUsageReportCSV(m);
          this.storage.saveRawReportFile(m, `copilot_monthly_usage_${m}.csv`, mockCsv);
        }
      }
    }

    const availableReportMonths = this.storage.getStoredReportMonths();
    console.log(`📊 Found ${availableReportMonths.length} monthly usage report partition(s): ${availableReportMonths.join(', ')}`);

    for (const repMonth of availableReportMonths) {
      // 同じ月に複数の CSV がある場合は、全ファイルを結合 (重複は 1 件に集約) してから 1 回だけ集計する。
      // (旧実装はファイルごとに集計して保存しており、最後のファイルの集計が前のファイルを上書きしていた)
      const csvFiles = this.storage.getRawReportFiles(repMonth);
      const recordSets: Array<{ fileName: string; records: ReturnType<ReportParser['parseRecords']> }> = [];
      const csvReports: CsvImportReport[] = [];
      for (const csvPath of csvFiles) {
        try {
          const csvContent = fs.readFileSync(csvPath, 'utf-8');
          const fileName = csvPath.split(/[\\/]/).pop() || `${repMonth}.csv`;
          const parsed = reportParser.parseRecordsWithReport(csvContent, fileName);
          recordSets.push({ fileName, records: parsed.records });
          csvReports.push(parsed.report);
          if (parsed.report.stop_reason) {
            console.warn(`⚠️ Report CSV ${fileName} was not imported: ${parsed.report.stop_reason}`);
          }
        } catch (err) {
          console.warn(`⚠️ Warning: Failed to parse report CSV at ${csvPath}:`, err);
        }
      }

      const merged = reportParser.mergeRecordSets(recordSets);
      if (merged.records.length > 0) {
        const label =
          merged.sourceFiles.length > 1
            ? `${merged.sourceFiles[0]} (+${merged.sourceFiles.length - 1} files)`
            : merged.sourceFiles[0] || `${repMonth}.csv`;
        const aggregatedReport = reportParser.aggregate(merged.records, repMonth, label, 'persisted', {
          source_files: merged.sourceFiles,
          records_total: merged.records.length,
          duplicates_skipped: merged.duplicatesSkipped,
          csv_reports: csvReports,
        });
        if (monthClose.allowWrite(repMonth, 'report', extractReportFigures(aggregatedReport))) {
          this.storage.saveReportData(repMonth, aggregatedReport);
        }
        console.log(
          `✅ Aggregated monthly report for ${repMonth}: ${merged.records.length} records from ${merged.sourceFiles.length} file(s)` +
            (merged.duplicatesSkipped > 0 ? ` (${merged.duplicatesSkipped} duplicate row(s) skipped)` : '') +
            `, $${aggregatedReport.overview.total_net_spend_usd} total net spend.`
        );
      }
    }

    // シート監査イベント (P4-3): Raw のシートスナップショットの差分から付与・剥奪などを記録する。
    // 失敗しても本処理は止めず issue にする (再処理は Raw を書き換えないので対象外)
    if (!this.runInfo?.reprocessed) {
      try {
        const audit = new SeatAuditService(this.storage);
        const r = audit.update();
        if (r.added > 0) console.log(`🧾 Seat audit: ${r.added} new event(s).`);
      } catch (err) {
        issues.push({
          id: `issue_seat_audit_${Date.now()}`,
          timestamp: nowIso,
          severity: 'warning',
          category: 'data_integrity',
          target: 'audit:seat-events',
          message: 'Seat audit events could not be updated.',
          details: err instanceof Error ? err.message : String(err),
        });
        this.storage.saveErrorLog(issues);
      }
    }

    // 請求突合 (P4-4): 取得できた Billing API の AI credit usage と、ダッシュボードの計算額 (数量 × 単価) を突合する。
    // 取得できなかった実行・再処理では書かない (前回の保存値を保つ)。失敗しても本処理は止めず issue にする
    if (!this.runInfo?.reprocessed && aiCreditLines.length > 0 && isSourceUsable(statuses.find((s) => s.source === 'ai_credits'))) {
      try {
        const parsedTolerance = parseTolerance(process.env.COPILOT_RECONCILIATION_TOLERANCE);
        if (parsedTolerance.error) {
          issues.push({
            id: `issue_billing_reconciliation_config_${Date.now()}`,
            timestamp: nowIso,
            severity: 'warning',
            category: 'data_integrity',
            target: 'env:COPILOT_RECONCILIATION_TOLERANCE',
            message: parsedTolerance.error,
          });
        }
        const reports = new BillingReconciliationService(this.storage).record(aiCreditLines, {
          now: nowIso,
          tolerance: parsedTolerance.tolerance,
          unitPriceUsd: (m) => BillingConfigLoader.loadForMonth(m).creditsPricing.costPerCreditUSD,
          exchangeCatalog: this.storage.loadCatalog?.<ExchangeRateCatalog>('exchange-rates') ?? null,
        });
        for (const r of reports) {
          if (r.status !== 'exceeded') continue;
          issues.push({
            id: `issue_billing_reconciliation_${r.month}`,
            timestamp: nowIso,
            severity: 'warning',
            category: 'data_integrity',
            target: `billing:ai_credits:${r.month}`,
            message: `AI credits computed amount differs from the Billing API amount beyond tolerance for ${r.month}.`,
            details: `difference_usd=${r.difference_usd}, difference_percent=${r.difference_percent ?? 'n/a'}, tolerance=${r.tolerance.absolute_usd} USD and ${r.tolerance.percent}%`,
          });
        }
        if (reports.length > 0) {
          console.log(`🧮 Billing reconciliation: ${reports.map((r) => `${r.month} ${r.status}`).join(', ')}.`);
        }
      } catch (err) {
        issues.push({
          id: `issue_billing_reconciliation_${Date.now()}`,
          timestamp: nowIso,
          severity: 'warning',
          category: 'data_integrity',
          target: 'audit:billing-reconciliation',
          message: 'Billing reconciliation could not be recorded.',
          details: err instanceof Error ? err.message : String(err),
        });
        this.storage.saveErrorLog(issues);
      }
    }

    // 月次締め (P4-2): 改訂の指定を反映し、締め日 (翌月の第 N 営業日) を迎えた月を確定する
    monthClose.finalize();
    monthClose.closeDueMonths();
    const closeIssues = monthClose.getIssues();
    if (closeIssues.length > 0) {
      issues.push(...closeIssues);
      this.storage.saveErrorLog(issues);
    }

    // 7. ローリング1年トレンド (保存済みの月次集計から実値で構成する)
    const storedProcMonths = this.storage.getStoredProcessedMonths();
    const allMonthsSet = new Set<string>();
    if (monthlyGenerated) allMonthsSet.add(monthKey);
    for (const m of storedProcMonths) allMonthsSet.add(m);
    const allRecordedMonths = Array.from(allMonthsSet).sort().reverse();
    const rolling12Months = allRecordedMonths.slice(0, 12);

    // 窓 (暦月 12 か月) と前年同月 12 か月ぶんを、保存済みの月次集計から読み込む (P3-6)
    const recorded = new Set(allRecordedMonths);
    const endMonth = allRecordedMonths[0];
    const entryByMonth = new Map<string, RollingTrendEntry>();
    const monthsToLoad = new Set<string>([...rolling12Months, ...(endMonth ? yearlyTrendMonthsNeeded(endMonth) : [])]);
    for (const m of monthsToLoad) {
      if (!recorded.has(m)) continue;
      const monthly: ScopeAggregatedData | null = this.storage.loadScopeData('monthly', m);
      if (monthly) entryByMonth.set(m, buildRollingTrendEntry(m, monthly));
    }
    const rollingTrendEntries: RollingTrendEntry[] = [];
    for (const m of rolling12Months) {
      const entry = entryByMonth.get(m);
      if (entry) rollingTrendEntries.push(entry);
    }
    const yearlyPoints = endMonth ? buildYearlyTrend({ endMonth, entries: entryByMonth, closedMonths: monthClose.closedMonthsMap(), calendar: calendarLoad.config }) : [];

    this.storage.saveRolling1YearTrend({
      generated_at: nowIso,
      months: rolling12Months,
      trends: rollingTrendEntries,
      schema_version: 2,
      ...(yearlyPoints.length > 0
        ? { window: { start: yearlyPoints[0].month, end: yearlyPoints[yearlyPoints.length - 1].month } }
        : {}),
      close_rule: buildYearlyTrendCloseRule(calendarLoad.config),
      points: yearlyPoints,
    });

    // データ品質レポート: 実収集をした実行だけ、履歴に追記する (モック・未設定・失敗では前回の履歴を維持)
    let dataQuality = this.isMock ? undefined : previousIndex?.data_quality;
    const observations = this.isMock ? null : this.dataSource.getQualityObservations?.() ?? null;
    if (observations && this.storage.saveDataQualityHistory) {
      const report = buildDataQualityReport(
        observations,
        statuses,
        nowIso,
        this.runInfo && landed ? this.runInfo.runId : undefined
      );
      const history = appendQualityHistory(this.storage.loadDataQualityHistory?.() ?? null, report);
      this.storage.saveDataQualityHistory(history);
      dataQuality = summarizeQualityHistory(history) ?? dataQuality;
      console.log(`🩺 Data quality: ${report.level} (missing days: ${report.missing_days.length}, quarantined: ${report.quarantined}).`);
    }

    // 8. IndexMetadata の保存
    const summary = seatsUsable
      ? this.buildSummary(enrichedSeats, userProfiles, monthKey, billingConfig.creditsPricing.includedCreditsPerSeat)
      : previousIndex?.summary ?? this.buildSummary([], [], monthKey, undefined);

    const indexMeta: IndexMetadata = {
      repository: {
        // 取得できないときはデモ用の既定値で埋めず、前回の値 (無ければ空) を使う
        owner: process.env.GITHUB_REPOSITORY_OWNER || previousIndex?.repository?.owner || '',
        name:
          process.env.GITHUB_REPOSITORY?.split('/')[1] ||
          previousIndex?.repository?.name ||
          'github-copilot-dashboard',
        is_fork: process.env.IS_FORK === 'true',
      },
      generated_at: nowIso,
      ...(this.runInfo && landed
        ? { run: { run_id: this.runInfo.runId, ...(this.runInfo.reprocessed ? { reprocessed: true } : {}) } }
        : {}),
      data_retention_months: parseRetentionMonths(process.env.COPILOT_DATA_RETENTION_MONTHS).months,
      available_months: rolling12Months,
      all_recorded_months: allRecordedMonths,
      available_days: [...availableDays].sort().reverse(),
      available_reports: availableReportMonths,
      rolling_1year_trend_file: 'trends/rolling-1year.json',
      deep_analysis_months: this.storage.getStoredDeepAnalysisMonths(),
      // MOCK_MODE (デモデータ生成) のときだけ true。取得失敗・データなしでデモ扱いに反転させない
      is_mock_mode: this.isMock,
      source_status: statuses,
      ...(dataQuality ? { data_quality: dataQuality } : {}),
      // 公開範囲の検査 (fork:verify) 用。実データでユーザー単位の情報を含み、かつ仮名化されていなければ、
      // リポジトリ / Pages の公開は個人情報の公開に直結する
      privacy: {
        anonymized: legacyResolver.isAnonymizing(),
        // ライブ収集した個人単位のデータ (シート・ユーザー別プロファイル) を含むか。前回までの成果物に
        // シートがあれば、今回の取得が失敗しても true のまま (保存済みの集計が公開され続けるため)。
        contains_user_level_data:
          !this.isMock &&
          (enrichedSeats.length > 0 ||
            userProfiles.length > 0 ||
            (previousIndex?.is_mock_mode !== true && (previousIndex?.summary?.total_seats ?? 0) > 0)),
        // 取り込んだ月次レポート (CSV) の集計を含むか。CSV が実データか見本かは判別できないため、
        // contains_user_level_data とは分け、fork:verify は公開時に「警告」にする
        contains_imported_reports: !this.isMock && availableReportMonths.length > 0,
      },
      billing: {
        currency: billingConfig.currency,
        subCurrency: billingConfig.subCurrency,
        discountPercent: billingConfig.discountPercent,
        periods: billingConfig.periods,
      },
      default_scopes: {
        latest_day: hasLiveMetrics ? referenceDate : previousIndex?.default_scopes?.latest_day,
        latest_month: monthlyGenerated ? monthKey : previousIndex?.default_scopes?.latest_month || rolling12Months[0],
        latest_report: availableReportMonths[0],
        latest_range: startDate && endDate ? { start: startDate, end: endDate } : undefined,
      },
      summary,
      issues: issues,
    };

    this.storage.saveIndex(indexMeta);

    console.log('=====================================================');
    console.log('🎉 Pipeline completed successfully!');
    console.log(`📊 Total Seats: ${indexMeta.summary.total_seats}`);
    console.log(`💰 Total Monthly Spend: $${indexMeta.summary.total_monthly_spend_usd}`);
    console.log(`⚠️ Idle Seats Detected: ${indexMeta.summary.idle_seats_30d} ($${indexMeta.summary.idle_waste_spend_usd} waste/month)`);
    console.log('=====================================================');
  }

  /**
   * シート・費用から index.json の要約を構成する。
   * AI クレジットの単価・包含量は価格カタログ / 請求設定が唯一のソースで、
   * 固定値 (0.01 / 3,900) を直接持たない。
   */
  private buildSummary(
    enrichedSeats: EnrichedUserSeat[],
    userProfiles: UserUsageProfile[],
    month: string,
    includedCreditsOverridePerSeat: number | undefined
  ): IndexMetadata['summary'] {
    const totalAiCreditsUsed = enrichedSeats.reduce((sum, u) => sum + (u.ai_credits_used_28d || 0), 0);
    // 席ごとの金額 (CreditsBillingService 経由) の合計。単価の解決経路を 1 つにする
    const totalAiCreditsCostUsd = Number(
      enrichedSeats.reduce((sum, u) => sum + (u.ai_credits_cost_usd || 0), 0).toFixed(2)
    );
    const totalMonthlySpend = enrichedSeats.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    const totalCombinedCostUsd = Number((totalMonthlySpend + totalAiCreditsCostUsd).toFixed(2));
    const idleSeats = enrichedSeats.filter((u) => isIdleSeatStatus(u.status));
    const idleWasteSpend = idleSeats.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    const onboardingSeats = enrichedSeats.filter((u) => u.status === 'onboarding').length;
    const costUnconfirmedSeats = enrichedSeats.filter((u) => u.cost_unconfirmed).length;
    const activeSeatsCount = enrichedSeats.length - idleSeats.length - onboardingSeats;

    // ユーザー別プロファイルが無い (実測がない) 場合、エージェント採用率は算出しない
    const engagedAgentUsers = userProfiles.filter((p) => (p.total_agent_sessions || 0) > 0).length;
    const agentAdoptionRate =
      userProfiles.length > 0 && activeSeatsCount > 0
        ? Number((engagedAgentUsers / activeSeatsCount).toFixed(4))
        : undefined;

    // プール = 全シートのプラン別の包含クレジット合計 (プラン未確定のシートは算入しない)
    const pool = estimateIncludedCreditsPool(
      enrichedSeats.map((u) => u.plan_type),
      month,
      includedCreditsOverridePerSeat
    );
    const poolUtilization = computeCreditsPoolUtilizationPercent(totalAiCreditsUsed, pool.includedCredits);

    return {
      total_seats: enrichedSeats.length,
      active_seats_30d: activeSeatsCount,
      idle_seats_30d: idleSeats.length,
      ...(onboardingSeats > 0 ? { onboarding_seats: onboardingSeats } : {}),
      ...(costUnconfirmedSeats > 0 ? { cost_unconfirmed_seats: costUnconfirmedSeats } : {}),
      total_monthly_spend_usd: Number(totalMonthlySpend.toFixed(2)),
      idle_waste_spend_usd: Number(idleWasteSpend.toFixed(2)),
      total_ai_credits_used: totalAiCreditsUsed,
      total_ai_credits_cost_usd: totalAiCreditsCostUsd,
      total_combined_cost_usd: totalCombinedCostUsd,
      ...(poolUtilization !== null ? { credits_pool_utilization_percent: poolUtilization } : {}),
      ...(agentAdoptionRate !== undefined ? { agent_adoption_rate: agentAdoptionRate } : {}),
    };
  }
}
