/**
 * Metric Registry (P2-3 / D-01)
 *
 * 指標の ID・ラベル・単位・窓・フィルター可否・出典・品質属性を 1 箇所で宣言する。
 * UI はこの定義を共有し、値に品質属性を付けて表示する (推定値と実測値を同じ見た目にしない)。
 * 指標カタログ v1 (P3-1): 定義・計算式・窓・出典・注意点を宣言し、全 KPI のツールチップと窓表示に使う。
 * 画面に出す KPI はここに登録されていなければならない (src/tests/metric-catalog.test.ts が漏れを検出する)。
 */

/** 値の品質属性。measured=実測 / estimated=推定 / missing=欠損 / demo=デモ (架空データ) */
export type MetricQuality = 'measured' | 'estimated' | 'missing' | 'demo';

export type MetricUnit = 'usd' | 'ratio' | 'count' | 'seats' | 'users' | 'credits' | 'name';

/**
 * 集計窓。
 * scope: 選択したスコープ (日次 / 月次 / 期間) / report_month: 選択した月次レポートの月
 * collection_period: 収集した利用状況データの対象期間 / point_in_time: 時点値
 */
export type MetricWindow = 'scope' | 'report_month' | 'collection_period' | 'point_in_time';

export type MetricScopeType = 'daily' | 'monthly' | 'custom';

export interface MetricDefinition {
  id: string;
  label: { ja: string; en: string };
  unit: MetricUnit;
  /** 定義 (何を数えた値か) */
  definition: { ja: string; en: string };
  /** 計算式 (人が読める形) */
  formula: string;
  /** 集計窓 */
  window: MetricWindow;
  /** フィルター (組織・コストセンター・グループ・タグ・ユーザー) で再集計されるか */
  filterable: boolean;
  /** 出典 (データセット / API) */
  sources: string[];
  /** 読み取り上の注意 (任意) */
  caveats?: string[];
  /** 値が存在するときの既定の品質属性 */
  defaultQuality: Exclude<MetricQuality, 'missing' | 'demo'>;
}

export const METRIC_REGISTRY = {
  total_spend: {
    id: 'total_spend',
    label: { ja: '利用費用', en: 'Total spend' },
    definition: { ja: '選択スコープのシート費用の合計 (カタログ価格 USD 基準)。日次は日割り、月次は月額満額、期間は日割り×日数。', en: 'Seat cost for the selected scope (catalog price, USD). Daily is prorated, monthly is the full month, period is prorated by days.' },
    formula: 'sum(seat monthly price) (daily/period: prorated)',
    unit: 'usd',
    window: 'scope',
    filterable: true,
    sources: ['seats', 'pricing catalog'],
    caveats: ['料金プラン未確定のシートは含まない'],
    defaultQuality: 'measured',
  },
  active_rate: {
    id: 'active_rate',
    label: { ja: 'アクティブ利用率', en: 'Active seat rate' },
    definition: { ja: '契約シートのうち、遊休でも導入期間でもない利用中シートの割合。', en: 'Share of contracted seats that are in use (neither idle nor onboarding).' },
    formula: 'active_users / total_seats',
    unit: 'ratio',
    window: 'scope',
    filterable: true,
    sources: ['seats'],
    caveats: ['シート未割当の利用者は分母に含まれない'],
    defaultQuality: 'measured',
  },
  idle_waste: {
    id: 'idle_waste',
    label: { ja: '遊休コスト (削減可能)', en: 'Idle cost (potential savings)' },
    definition: { ja: '遊休判定の基準に該当するシートの費用の合計。確定した削減額ではなく見込み額。', en: 'Cost of seats that meet the idle criteria. An estimate, not a confirmed saving.' },
    formula: 'sum(seat monthly price where seat is idle)',
    unit: 'usd',
    window: 'scope',
    filterable: true,
    sources: ['seats', 'pricing catalog'],
    caveats: ['導入期間のシートは含まない'],
    defaultQuality: 'estimated',
  },
  acceptance_rate: {
    id: 'acceptance_rate',
    label: { ja: 'Inline補完受諾率', en: 'Inline completion acceptance rate' },
    definition: { ja: 'IDE のインライン補完 (Ghost Text) の提案に対する受諾の割合。補完の適合度であり、生産性指標ではない。', en: 'Share of inline completion (ghost text) suggestions that were accepted. A fit measure for completions, not a productivity metric.' },
    formula: 'accepted / suggested (code completion)',
    unit: 'ratio',
    window: 'scope',
    filterable: false,
    sources: ['metrics'],
    caveats: ['CLI / Agent 主体のユーザーでは構造的に低くなる', 'フィルターでは絞り込まれない (全社値)'],
    defaultQuality: 'measured',
  },
  budget_utilization: {
    id: 'budget_utilization',
    label: { ja: '予算消化率', en: 'Budget utilization' },
    definition: { ja: '設定された支出上限 (Cost Center 等) の合計に対する、超過請求費用 (無料枠控除後) の割合。', en: 'Net billable spend relative to the configured spending limits (cost centers etc.).' },
    formula: 'total_net_billable_usd / total_spending_limit_usd',
    unit: 'ratio',
    window: 'scope',
    filterable: true,
    sources: ['billing', 'cost center budgets'],
    caveats: ['支出上限が未設定の場合は算出しない (欠損)'],
    defaultQuality: 'measured',
  },
  spend_forecast: {
    id: 'spend_forecast',
    label: { ja: '月末着地予測 (費用)', en: 'Month-end forecast (spend)' },
    definition: { ja: '当月の日次費用の実績累計に、直近 7 観測日の平均ペースを残日数ぶん加えた月末の見込み額。観測 7 日未満・欠損が多い場合は出さない。', en: 'Projected month-end spend: month-to-date actual plus the recent 7-observed-day average times the remaining days. Not shown with fewer than 7 observed days or heavy gaps.' },
    formula: 'actual_to_date + mean(last 7 observed days) * remaining_days',
    unit: 'usd',
    window: 'scope',
    filterable: false,
    sources: ['daily trends'],
    caveats: ['推定値 (確定額ではない)', '月次スコープでのみ算出する', '締め済み月は予測せず実績を表示する', 'フィルターでは絞り込まれない (全社値)'],
    defaultQuality: 'estimated',
  },
  credits_forecast: {
    id: 'credits_forecast',
    label: { ja: '月末着地予測 (AI Credits)', en: 'Month-end forecast (AI Credits)' },
    definition: { ja: '当月の AI Credits 消費量の実績累計に、直近 7 観測日の平均ペースを残日数ぶん加えた月末の見込み量。', en: 'Projected month-end AI Credits consumption: month-to-date actual plus the recent 7-observed-day average times the remaining days.' },
    formula: 'actual_to_date + mean(last 7 observed days) * remaining_days',
    unit: 'credits',
    window: 'scope',
    filterable: false,
    sources: ['daily trends'],
    caveats: ['推定値 (確定量ではない)', '月次スコープでのみ算出する', 'フィルターでは絞り込まれない (全社値)'],
    defaultQuality: 'estimated',
  },
  report_gross_spend: {
    id: 'report_gross_spend',
    label: { ja: '利用費用 (総額)', en: 'Gross spend' },
    definition: { ja: '選択した月次レポートの月の総利用額 (無料枠控除前)。', en: 'Gross usage amount for the selected report month (before included-credit discounts).' },
    formula: 'sum(gross_amount)',
    unit: 'usd',
    window: 'report_month',
    filterable: true,
    sources: ['monthly usage report CSV'],
    defaultQuality: 'measured',
  },
  report_net_spend: {
    id: 'report_net_spend',
    label: { ja: '超過請求費用', en: 'Net billable spend' },
    definition: { ja: '選択した月次レポートの月の請求額 (無料枠控除後)。', en: 'Billable amount for the selected report month (after discounts).' },
    formula: 'sum(net_amount)',
    unit: 'usd',
    window: 'report_month',
    filterable: true,
    sources: ['monthly usage report CSV'],
    defaultQuality: 'measured',
  },
  report_requests: {
    id: 'report_requests',
    label: { ja: '総リクエスト / クレジット', en: 'Total requests / credits' },
    definition: { ja: '選択した月次レポートの月のリクエスト数 (AI Credits 呼出総量)。', en: 'Number of requests (AI Credits invocations) in the selected report month.' },
    formula: 'sum(quantity)',
    unit: 'count',
    window: 'report_month',
    filterable: true,
    sources: ['monthly usage report CSV'],
    defaultQuality: 'measured',
  },
  report_active_users: {
    id: 'report_active_users',
    label: { ja: 'レポート内アクティブ人数', en: 'Active users in report' },
    definition: { ja: '選択した月次レポートの月に利用履歴のあるユニークアカウント数。', en: 'Unique accounts with any usage in the selected report month.' },
    formula: 'count_distinct(username)',
    unit: 'users',
    window: 'report_month',
    filterable: true,
    sources: ['monthly usage report CSV'],
    caveats: ['シートの有無は問わない'],
    defaultQuality: 'measured',
  },
  report_top_model: {
    id: 'report_top_model',
    label: { ja: '最多利用 AI モデル', en: 'Most used AI model' },
    definition: { ja: '選択した月次レポートの月でリクエスト数が最も多いモデル。', en: 'The model with the most requests in the selected report month.' },
    formula: 'argmax(requests by model)',
    unit: 'name',
    window: 'report_month',
    filterable: true,
    sources: ['monthly usage report CSV'],
    defaultQuality: 'measured',
  },
  report_top_sku: {
    id: 'report_top_sku',
    label: { ja: '主契約 / SKU', en: 'Primary SKU' },
    definition: { ja: '選択した月次レポートの月で金額が最も大きい請求カテゴリ (SKU)。', en: 'The billing category (SKU) with the largest amount in the selected report month.' },
    formula: 'argmax(amount by sku)',
    unit: 'name',
    window: 'report_month',
    filterable: true,
    sources: ['monthly usage report CSV'],
    defaultQuality: 'measured',
  },
  adoption_evaluated_users: {
    id: 'adoption_evaluated_users',
    label: { ja: '評価対象ユーザー総数', en: 'Evaluated users' },
    definition: { ja: '採用成熟度の判定対象となったユーザー数。', en: 'Number of users evaluated for adoption maturity.' },
    formula: 'count(users with agent metrics)',
    unit: 'users',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  adoption_active_rate: {
    id: 'adoption_active_rate',
    label: { ja: '全体活用定着率', en: 'Overall adoption rate' },
    definition: { ja: '評価対象ユーザーのうち、初期段階を超えて継続利用している割合。', en: 'Share of evaluated users beyond the initial stage.' },
    formula: 'active_users / evaluated_users',
    unit: 'ratio',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  adoption_advanced_rate: {
    id: 'adoption_advanced_rate',
    label: { ja: '高度活用率', en: 'Advanced adoption rate' },
    definition: { ja: '評価対象ユーザーのうち、Agent 以上の段階にいる割合。', en: 'Share of evaluated users at the Agent stage or above.' },
    formula: 'advanced_users / evaluated_users',
    unit: 'ratio',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  adoption_multi_agent_users: {
    id: 'adoption_multi_agent_users',
    label: { ja: '自律協調層ユーザー数', en: 'Multi-agent users' },
    definition: { ja: '自律協調 (Multi-Agent) 段階と判定されたユーザー数。', en: 'Number of users classified at the multi-agent stage.' },
    formula: 'count(users where phase = multi_agent)',
    unit: 'users',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  agent_sessions: {
    id: 'agent_sessions',
    label: { ja: '総 Agent セッション数', en: 'Total agent sessions' },
    definition: { ja: 'Agent 機能の総セッション数。', en: 'Total number of agent sessions.' },
    formula: 'sum(agent sessions)',
    unit: 'count',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  agent_messages: {
    id: 'agent_messages',
    label: { ja: 'Agent メッセージ総数', en: 'Total agent messages' },
    definition: { ja: 'Agent セッションで交わされたメッセージの総数。', en: 'Total number of messages exchanged in agent sessions.' },
    formula: 'sum(agent messages)',
    unit: 'count',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  agent_active_users: {
    id: 'agent_active_users',
    label: { ja: 'アクティブ Agent ユーザー', en: 'Active agent users' },
    definition: { ja: 'Agent を 1 回以上利用したユーザー数。', en: 'Number of users who used an agent at least once.' },
    formula: 'count_distinct(user where agent sessions >= 1)',
    unit: 'users',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  agent_adoption_rate: {
    id: 'agent_adoption_rate',
    label: { ja: 'Agent 浸透率', en: 'Agent adoption rate' },
    definition: { ja: '対象ユーザーのうち Agent を利用したユーザーの割合。', en: 'Share of target users who used an agent.' },
    formula: 'agent_active_users / target_users',
    unit: 'ratio',
    window: 'collection_period',
    filterable: true,
    sources: ['agent metrics'],
    defaultQuality: 'measured',
  },
  credits_pool_used: {
    id: 'credits_pool_used',
    label: { ja: '組織プール総消費', en: 'Organization pool consumption' },
    definition: { ja: '組織の包含クレジット (プール) の総消費量。', en: 'Total consumption of the organization included-credit pool.' },
    formula: 'sum(credits used)',
    unit: 'credits',
    window: 'collection_period',
    filterable: true,
    sources: ['AI credits usage'],
    defaultQuality: 'measured',
  },
  credits_cost: {
    id: 'credits_cost',
    label: { ja: 'AI Credits 換算費用', en: 'AI Credits cost' },
    definition: { ja: '消費した AI Credits を USD に換算した費用 (カタログ単価)。', en: 'Consumed AI Credits converted to USD at the catalog rate.' },
    formula: 'credits_used * unit_price',
    unit: 'usd',
    window: 'collection_period',
    filterable: true,
    sources: ['AI credits usage', 'pricing catalog'],
    caveats: ['換算レートに依存する見込み額'],
    defaultQuality: 'estimated',
  },
  combined_cost: {
    id: 'combined_cost',
    label: { ja: '総合費用 (シート＋Credits)', en: 'Combined cost (seats + credits)' },
    definition: { ja: 'シート費用と AI Credits 換算費用の合計。', en: 'Sum of seat cost and AI Credits cost.' },
    formula: 'seat_cost + credits_cost',
    unit: 'usd',
    window: 'collection_period',
    filterable: true,
    sources: ['seats', 'AI credits usage', 'pricing catalog'],
    defaultQuality: 'estimated',
  },
  pool_utilization: {
    id: 'pool_utilization',
    label: { ja: 'プール消化率', en: 'Pool utilization' },
    definition: { ja: 'プラン別の包含クレジット (プール) に対する消費の割合。', en: 'Consumption relative to the plan included-credit pool.' },
    formula: 'credits_used / included_credits',
    unit: 'ratio',
    window: 'collection_period',
    filterable: true,
    sources: ['AI credits usage', 'seats'],
    caveats: ['プールを特定できない場合は算出しない (欠損)'],
    defaultQuality: 'measured',
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRIC_REGISTRY;

const SCOPE_WINDOW_LABEL: Record<MetricScopeType, string> = {
  daily: '当日 (日次スコープ)',
  monthly: '当月 (月次スコープ)',
  custom: '選択期間',
};

/** 窓の表示名。scope 窓はスコープ種別に追従する */
export function windowLabel(window: MetricWindow, scopeType?: MetricScopeType): string {
  switch (window) {
    case 'scope':
      return scopeType ? SCOPE_WINDOW_LABEL[scopeType] : '選択スコープ (日次 / 月次 / 期間)';
    case 'report_month':
      return '選択した月次レポートの月';
    case 'collection_period':
      return '収集データの対象期間';
    case 'point_in_time':
      return '時点値';
  }
}

const UNIT_LABEL: Record<MetricUnit, string> = {
  usd: 'USD',
  ratio: '割合 (%)',
  count: '件数',
  seats: '席',
  users: '人',
  credits: 'クレジット',
  name: '名称',
};

export function unitLabel(unit: MetricUnit): string {
  return UNIT_LABEL[unit];
}

/** KPI の定義ツールチップ文面 (定義・計算式・窓・単位・出典・注意点) */
export function describeMetric(metricId: MetricId, scopeType?: MetricScopeType): string {
  const m: MetricDefinition = METRIC_REGISTRY[metricId];
  const lines = [
    m.definition.ja,
    `計算式: ${m.formula}`,
    `窓: ${windowLabel(m.window, scopeType)}`,
    `単位: ${unitLabel(m.unit)}`,
    `出典: ${m.sources.join(' / ')}`,
    `フィルター: ${m.filterable ? '対応' : '非対応 (全社値)'}`,
  ];
  if (m.caveats?.length) lines.push(`注意: ${m.caveats.join(' / ')}`);
  return lines.join('\n');
}



/** 品質属性ごとの表示規約 */
export const QUALITY_PRESENTATION: Record<MetricQuality, { badge: string | null; description: string }> = {
  measured: { badge: null, description: '実測値' },
  estimated: { badge: '推定', description: '実測ではなく、基準や単価から算定した見込み値です' },
  missing: { badge: '欠損', description: '値を取得できていません' },
  demo: { badge: 'デモ', description: '架空のデモデータです (実データではありません)' },
};

/** 品質属性付きの値。欠損は null で表し、0 や定数で埋めない */
export interface QualifiedValue {
  metricId: MetricId;
  value: number | null;
  quality: MetricQuality;
  /** 欠損・推定の理由 (欠損時は「—（理由）」として表示) */
  reason?: string;
}

export interface QualifyOptions {
  /** デモデータ由来か。実測・推定より優先して `demo` にする */
  isDemo?: boolean;
  /** 欠損の理由 */
  missingReason?: string;
  /** 推定の理由 (省略時は定義の既定) */
  estimatedReason?: string;
}

/**
 * 値に品質属性を付ける。優先順位: 欠損 > デモ > 定義の既定 (実測 / 推定)。
 * 欠損はデモ由来でも「欠損」とする (値が無いことを隠さない)。
 */
export function qualify(
  metricId: MetricId,
  value: number | null | undefined,
  options: QualifyOptions = {}
): QualifiedValue {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { metricId, value: null, quality: 'missing', reason: options.missingReason ?? '値を取得できていません' };
  }
  if (options.isDemo) {
    return { metricId, value, quality: 'demo', reason: QUALITY_PRESENTATION.demo.description };
  }
  const quality = METRIC_REGISTRY[metricId].defaultQuality;
  return {
    metricId,
    value,
    quality,
    reason: quality === 'estimated' ? options.estimatedReason ?? QUALITY_PRESENTATION.estimated.description : undefined,
  };
}

/**
 * 個人指標 (ユーザー別の利用・活用) の位置づけ (判断結果 #2)。
 * 閲覧権限のある社員向けの改善支援情報であり、評価・ランキングには使わない (SDD-16 §5)。
 */
export const PERSONAL_METRICS_NOTICE =
  '個人別の指標は、閲覧権限のある社員向けの改善支援情報です。人事評価やランキングには使用しないでください。';
