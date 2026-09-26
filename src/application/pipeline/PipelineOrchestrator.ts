import { ICopilotDataSource } from '../../domain/ports/ICopilotDataSource.js';
import { IAttributeResolver } from '../../domain/ports/IAttributeResolver.js';
import { IStorageWriter } from '../../domain/ports/IStorageWriter.js';
import { BillingCalculator } from '../../processor/billing-calculator.js';
import { MetricsAggregator } from '../../processor/metrics-aggregator.js';
import {
  CostCenterBudget,
  IndexMetadata,
  UserUsageProfile,
} from '../../domain/entities/copilot.js';
import { AttributeResolver } from '../../collector/attribute-resolver.js';

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
    const legacyResolver = new AttributeResolver(
      process.env.COPILOT_USER_MAPPING || process.env.COPILOT_USER_MAPPING_BASE64
    );
    const aggregator = new MetricsAggregator();

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
      console.warn('⚠️  No Copilot metrics retrieved. Continuing without live metrics.');
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

    // 5. スコープ集計 & 保存
    const availableDays: string[] = [];
    let monthKey: string | undefined;

    if (hasLiveMetrics) {
      console.log('⚙️ Aggregating daily, monthly, and custom scopes...');
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

      const latest30d = aggregator.aggregateScope(
        'custom',
        'latest-30d',
        recentMetrics,
        enrichedSeats,
        {
          start: recentMetrics[0].date,
          end: recentMetrics[recentMetrics.length - 1].date,
          days_count: recentMetrics.length,
        },
        issues,
        costCenterBudgets,
        userProfiles
      );
      this.storage.saveScopeData('custom', 'latest-30d', latest30d);
    }

    // 6. IndexMetadata の保存
    const activeSeats = enrichedSeats.filter((s) => s.status === 'active' || s.status === 'low_active').length;
    const idleSeats = enrichedSeats.filter((s) => s.status === 'idle' || s.status === 'never_used').length;
    const totalSpend = enrichedSeats.reduce((sum, s) => sum + s.monthly_cost_usd, 0);
    const idleWaste = enrichedSeats
      .filter((s) => s.status === 'idle' || s.status === 'never_used')
      .reduce((sum, s) => sum + s.monthly_cost_usd, 0);

    const availableMonths = monthKey ? [monthKey] : [];

    const indexMeta: IndexMetadata = {
      repository: {
        owner: process.env.GITHUB_REPOSITORY_OWNER || 'unknown',
        name: process.env.GITHUB_REPOSITORY?.split('/')[1] || 'unknown',
        is_fork: process.env.GITHUB_REPOSITORY_IS_FORK === 'true',
      },
      generated_at: new Date().toISOString(),
      data_retention_days: 365,
      available_months: availableMonths,
      all_recorded_months: availableMonths,
      available_days: availableDays,
      is_mock_mode: this.isMock,
      default_scopes: {
        latest_day: availableDays.length > 0 ? availableDays[availableDays.length - 1] : undefined,
        latest_month: monthKey,
      },
      summary: {
        total_seats: enrichedSeats.length,
        active_seats_30d: activeSeats,
        idle_seats_30d: idleSeats,
        total_monthly_spend_usd: totalSpend,
        idle_waste_spend_usd: idleWaste,
      },
      issues,
    };

    this.storage.saveIndex(indexMeta);
    console.log('🎉 Pipeline run completed successfully.');
  }
}
