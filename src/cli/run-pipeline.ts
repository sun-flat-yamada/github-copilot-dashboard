import { GitHubCopilotClient } from '../collector/github-client.js';
import { AttributeResolver } from '../collector/attribute-resolver.js';
import { BillingCalculator } from '../processor/billing-calculator.js';
import { MetricsAggregator } from '../processor/metrics-aggregator.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';
import { IndexMetadata } from '../types/copilot.js';

async function main() {
  console.log('=====================================================');
  console.log('🚀 GitHub Copilot Analytics Pipeline (2026.09 LTS)');
  console.log('=====================================================');

  const isMock = process.argv.includes('--mock') || process.env.MOCK_MODE === 'true';

  // 1. 各モジュールの初期化
  const client = new GitHubCopilotClient({ mockMode: isMock });
  const resolver = new AttributeResolver();
  const aggregator = new MetricsAggregator();
  const storage = new ForkSafeStorage();

  console.log(`📋 AttributeResolver: Loaded ${resolver.getMappingCount()} custom user attribute mapping(s).`);

  // 2. データ収集
  console.log('📡 Fetching Copilot Metrics, Seat assignments, Cost Centers, Budgets, and User Profiles...');
  const [metrics, seats, costCenters, costCenterBudgets, userProfiles] = await Promise.all([
    client.fetchMetrics(),
    client.fetchSeats(),
    client.fetchCostCenters(),
    client.fetchCostCenterBudgets(),
    client.fetchUserProfiles(),
  ]);

  console.log(
    `✅ Data Fetched: ${metrics.length} daily metric records, ${seats.length} seats, ${costCenters.length} cost centers, ${costCenterBudgets.length} budgets, ${userProfiles.length} user profiles.`
  );

  if (metrics.length === 0 || seats.length === 0) {
    console.error('❌ Error: No metrics or seats retrieved. Aborting pipeline.');
    process.exit(1);
  }

  // 3. 料金計算・エンリッチメント
  const latestMetricDate = metrics[metrics.length - 1].date; // YYYY-MM-DD
  const [currentYear, currentMonth] = latestMetricDate.split('-').map(Number);
  const daysInCurrentMonth = BillingCalculator.getDaysInMonth(currentYear, currentMonth);

  const billingCalc = new BillingCalculator(resolver, costCenters, latestMetricDate);
  const enrichedSeats = billingCalc.enrichAllSeats(seats, daysInCurrentMonth);

  console.log(`💡 Enriched ${enrichedSeats.length} user seats with cost calculation and idle analysis.`);

  // 4. Rawパーティション保存 (最新日のRawデータを保存)
  const latestMetric = metrics[metrics.length - 1];
  storage.saveRawDailyData(latestMetric.date, latestMetric, seats, costCenters);

  // 取得時のエラー・警告一覧の取得
  const issues = client.getIssues();
  console.log(`🔍 Detected ${issues.length} data fetch issue(s) during collection.`);
  storage.saveErrorLog(issues);

  // 5. 日次スコープ集計の生成
  const availableDays: string[] = [];
  // 直近7日分の日次データを生成
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
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const monthlyMetrics = metrics.filter((m) => m.date.startsWith(monthKey));
  const monthlyData = aggregator.aggregateScope(
    'monthly',
    monthKey,
    monthlyMetrics,
    enrichedSeats,
    {
      start: `${monthKey}-01`,
      end: latestMetricDate,
      days_count: daysInCurrentMonth,
    },
    issues,
    costCenterBudgets,
    userProfiles
  );
  storage.saveProcessedScope(monthlyData);

  // 7. カスタム期間 (直近30日) スコープ集計の生成
  const startDate = metrics[0].date;
  const endDate = latestMetricDate;
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

  // 8. index.json メタデータの生成と保存
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
    available_months: [monthKey],
    available_days: availableDays.reverse(),
    default_scopes: {
      latest_day: latestMetricDate,
      latest_month: monthKey,
      latest_range: {
        start: startDate,
        end: endDate,
      },
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
