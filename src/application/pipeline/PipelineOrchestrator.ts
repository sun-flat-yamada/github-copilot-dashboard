import * as fs from 'fs';
import { ICopilotDataSource } from '../../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../../domain/ports/IAttributeResolver.js';
import { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import { BillingCalculator } from '../../processor/billing-calculator.js';
import { MetricsAggregator } from '../../processor/metrics-aggregator.js';
import { ReportParser } from '../../processor/report-parser.js';
import { MockDataGenerator } from '../../collector/mock-generator.js';
import {
  CostCenterBudget,
  IndexMetadata,
  UserUsageProfile,
} from '../../domain/entities/copilot.js';
import { AttributeResolver } from '../../collector/attribute-resolver.js';
import { loadUserMappingFromFile } from '../../collector/mapping-file-loader.js';
import { loadDemoUserMapping } from '../../collector/demo-mapping-loader.js';

export interface PipelineOrchestratorDependencies {
  dataSource: ICopilotDataSource;
  resolver: IAttributeResolver;
  storage: IStorageWriter;
  isMock?: boolean;
}

export class PipelineOrchestrator {
  private dataSource: ICopilotDataSource;
  private resolver: IAttributeResolver;
  private storage: IStorageWriter;
  private isMock: boolean;

  constructor(deps: PipelineOrchestratorDependencies) {
    this.dataSource = deps.dataSource;
    this.resolver = deps.resolver;
    this.storage = deps.storage;
    this.isMock = deps.isMock ?? false;
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
      mappingConfig || process.env.COPILOT_USER_MAPPING || process.env.COPILOT_USER_MAPPING_BASE64
    );
    const aggregator = new MetricsAggregator();
    const reportParser = new ReportParser(legacyResolver);

    console.log(`📋 AttributeResolver: Loaded ${this.resolver.getMappingCount()} mapping(s).`);

    // 1. データ収集
    console.log('📡 Fetching Copilot Metrics, Seat assignments, and Cost Centers...');
    const [metrics, seats, costCenters] = await Promise.all([
      this.dataSource.fetchMetrics(),
      this.dataSource.fetchSeats(),
      this.dataSource.fetchCostCenters(),
    ]);

    console.log(
      `✅ Data Fetched: ${metrics.length} daily metric records, ${seats.length} seats, ${costCenters.length} cost centers.`
    );

    const hasLiveMetrics = metrics.length > 0;
    if (!hasLiveMetrics) {
      console.warn(
        '⚠️  No Copilot metrics retrieved (COPILOT_READ_TOKEN / COPILOT_ENTERPRISE / COPILOT_ORGS may be unset, ' +
          'or the credential lacks Enterprise Owner permission). Continuing without live metrics — ' +
          'Monthly Usage Report (CSV) and other credential-independent features remain available.'
      );
    }

    // 2. 料金計算・エンリッチメント
    const referenceDate = hasLiveMetrics ? metrics[metrics.length - 1].date : new Date().toISOString().slice(0, 10);
    const [currentYear, currentMonth] = referenceDate.split('-').map(Number);
    const daysInCurrentMonth = BillingCalculator.getDaysInMonth(currentYear, currentMonth);

    const billingCalc = new BillingCalculator(legacyResolver, costCenters, referenceDate);
    const enrichedSeats = billingCalc.enrichAllSeats(seats, daysInCurrentMonth);

    console.log(`💡 Enriched ${enrichedSeats.length} user seats with cost calculation and idle analysis.`);

    // 3. Rawパーティション保存
    if (hasLiveMetrics) {
      const latestMetric = metrics[metrics.length - 1];
      this.storage.saveRawDailyData(latestMetric.date, latestMetric, seats, costCenters);
    }

    // エラーログの保存
    const issues = this.dataSource.getIssues();
    console.log(`🔍 Detected ${issues.length} data fetch issue(s) during collection.`);
    this.storage.saveErrorLog(issues);

    // 4. Budgets と Profiles
    let costCenterBudgets: CostCenterBudget[] = [];
    let userProfiles: UserUsageProfile[] = [];

    if (this.isMock) {
      [costCenterBudgets, userProfiles] = await Promise.all([
        this.dataSource.fetchCostCenterBudgets(),
        this.dataSource.fetchUserProfiles(),
      ]);
    } else {
      const budgetConfig = BillingCalculator.parseBudgetConfig(process.env.COPILOT_COST_CENTER_BUDGETS);
      costCenterBudgets = BillingCalculator.computeCostCenterBudgets(enrichedSeats, costCenters, budgetConfig);
    }

    console.log(`💰 Prepared ${costCenterBudgets.length} cost center budget(s) and ${userProfiles.length} user profile(s).`);

    // 5. スコープ集計 & 保存
    const availableDays: string[] = [];
    let monthKey: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (hasLiveMetrics) {
      const recentMetrics = metrics.slice(-30);
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
      this.storage.saveScopeData('monthly', monthlyData.scope_key, monthlyData);

      // Deep Analysis アーカイブ保存
      this.storage.saveDeepAnalysisArchive(monthKey, userProfiles);

      // カスタム期間 (直近30日)
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
      this.storage.saveScopeData('custom', 'latest-30d', customData);
    }

    // 6. Monthly Usage Report (CSV) の検出・集計・保存
    console.log('📑 Processing Monthly Usage Reports (CSV)...');

    if (this.isMock) {
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
      const csvFiles = this.storage.getRawReportFiles(repMonth);
      for (const csvPath of csvFiles) {
        try {
          const csvContent = fs.readFileSync(csvPath, 'utf-8');
          const fileName = csvPath.split(/[\\/]/).pop() || `${repMonth}.csv`;
          const rawRecords = reportParser.parseRecords(csvContent);
          if (rawRecords.length > 0) {
            const aggregatedReport = reportParser.aggregate(rawRecords, repMonth, fileName, 'persisted');
            this.storage.saveReportData(repMonth, aggregatedReport);
            console.log(`✅ Aggregated monthly report for ${repMonth}: ${rawRecords.length} records, $${aggregatedReport.overview.total_net_spend_usd} total net spend.`);
          }
        } catch (err) {
          console.warn(`⚠️ Warning: Failed to parse report CSV at ${csvPath}:`, err);
        }
      }
    }

    // 7. ローリング1年トレンド
    const storedProcMonths = this.storage.getStoredProcessedMonths();
    const allMonthsSet = new Set<string>();
    if (monthKey) allMonthsSet.add(monthKey);
    for (const m of storedProcMonths) allMonthsSet.add(m);
    const allRecordedMonths = Array.from(allMonthsSet).sort().reverse();
    const rolling12Months = allRecordedMonths.slice(0, 12);

    const totalAiCreditsUsed = enrichedSeats.reduce((sum, u) => sum + (u.ai_credits_used_28d || 0), 0);
    const totalAiCreditsCostUsd = Number((totalAiCreditsUsed * 0.01).toFixed(2));
    const totalMonthlySpend = enrichedSeats.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    const totalCombinedCostUsd = Number((totalMonthlySpend + totalAiCreditsCostUsd).toFixed(2));
    const idleSeats = enrichedSeats.filter((u) => u.status === 'idle' || u.status === 'never_used');
    const idleWasteSpend = idleSeats.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    const activeSeatsCount = enrichedSeats.length - idleSeats.length;

    const totalAgentSessions = userProfiles.reduce((sum, p) => sum + (p.total_agent_sessions || 0), 0);
    const engagedAgentUsers = userProfiles.filter((p) => (p.total_agent_sessions || 0) > 0).length;
    const agentAdoptionRate = activeSeatsCount > 0 ? Number((engagedAgentUsers / activeSeatsCount).toFixed(4)) : 0;

    const rollingTrendEntries = rolling12Months.map((m) => ({
      month: m,
      total_monthly_spend_usd: Number(totalMonthlySpend.toFixed(2)),
      total_spend_usd: Number(totalMonthlySpend.toFixed(2)),
      active_seats: activeSeatsCount,
      idle_seats: idleSeats.length,
      total_seats: enrichedSeats.length,
      acceptance_rate: 0.35,
      total_chats: userProfiles.reduce((sum, p) => sum + p.total_chats, 0),
      total_ai_credits_used: totalAiCreditsUsed,
      total_agent_sessions: totalAgentSessions,
      agent_adoption_rate: agentAdoptionRate,
    }));

    this.storage.saveRolling1YearTrend({
      generated_at: new Date().toISOString(),
      months: rolling12Months,
      trends: rollingTrendEntries,
    });

    // 8. IndexMetadata の保存
    const indexMeta: IndexMetadata = {
      repository: {
        owner: process.env.GITHUB_REPOSITORY_OWNER || 'proud-corp',
        name: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'github-copilot-dashboard',
        is_fork: process.env.IS_FORK === 'true',
      },
      generated_at: new Date().toISOString(),
      data_retention_days: 365,
      available_months: rolling12Months,
      all_recorded_months: allRecordedMonths,
      available_days: availableDays.reverse(),
      available_reports: availableReportMonths,
      rolling_1year_trend_file: 'trends/rolling-1year.json',
      deep_analysis_months: this.storage.getStoredDeepAnalysisMonths(),
      is_mock_mode: this.isMock || (!hasLiveMetrics && enrichedSeats.length === 0),
      default_scopes: {
        latest_day: hasLiveMetrics ? referenceDate : undefined,
        latest_month: monthKey || rolling12Months[0],
        latest_report: availableReportMonths[0],
        latest_range: startDate && endDate ? { start: startDate, end: endDate } : undefined,
      },
      summary: {
        total_seats: enrichedSeats.length,
        active_seats_30d: activeSeatsCount,
        idle_seats_30d: idleSeats.length,
        total_monthly_spend_usd: Number(totalMonthlySpend.toFixed(2)),
        idle_waste_spend_usd: Number(idleWasteSpend.toFixed(2)),
        total_ai_credits_used: totalAiCreditsUsed,
        total_ai_credits_cost_usd: totalAiCreditsCostUsd,
        total_combined_cost_usd: totalCombinedCostUsd,
        credits_pool_utilization_percent: Number(Math.min(100, (totalAiCreditsUsed / Math.max(1, enrichedSeats.length * 3900)) * 100).toFixed(1)),
        agent_adoption_rate: agentAdoptionRate,
      },
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
}
