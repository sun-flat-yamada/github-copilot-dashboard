/**
 * GitHub Copilot Usage & Billing Types (2026.09 Specification)
 */

import { CurrencyConfig } from './billing-config.js';
import type { RunReference } from './run-manifest.js';
import type { DataQualitySummary } from './data-quality.js';

/**
 * 'unknown' は API が plan_type を返さない / 未知の値を返した場合の「未確定」。
 * 料金を推測せず (旧: enterprise=$39 と見なしていた)、費用は未確定として扱う。
 */
export type CopilotPlanType = 'business' | 'enterprise' | 'unknown';

/**
 * シートの利用ステータス。
 * - 'onboarding': 付与から間もなく (SEAT_ONBOARDING_DAYS 未満) 未使用のシート。遊休 (削減可能) に含めない。
 */
export type UserSeatStatus = 'active' | 'low_active' | 'idle' | 'never_used' | 'onboarding';

export type GroupingDimension = 'department' | 'cost_center' | 'organization';

export type AnalysisScopeType = 'daily' | 'monthly' | 'custom';

export type IssueSeverity = 'error' | 'warning';

export interface DataFetchIssue {
  id: string;
  timestamp: string;
  severity: IssueSeverity;
  category: 'api_auth' | 'rate_limit' | 'not_found' | 'server_error' | 'data_integrity';
  target: string; // e.g. "org:proud-internal-sys" or "api:cost-centers"
  message: string;
  details?: string;
  http_status?: number;
  affected_fields?: string[];
}

/**
 * パイプラインが収集する外部ソースの識別子。
 * ソースごとに独立して縮退 (Last-known-good 維持) する単位。
 */
export type DataSourceId = 'metrics' | 'seats' | 'cost_centers';

/**
 * - 'ok': 取得成功
 * - 'partial': 取得はできたが一部レコードを隔離した / 件数が一致しなかった
 * - 'failed': 取得に失敗した (前回成功データを維持する)
 * - 'skipped': 設定が無く対象外 (障害ではない)
 */
export type SourceFetchStatus = 'ok' | 'partial' | 'failed' | 'skipped';

export interface SourceStatus {
  source: DataSourceId;
  status: SourceFetchStatus;
  /** 取得したレコード数 (隔離分を除く) */
  records: number;
  /** 検証に失敗して隔離したレコード数 */
  quarantined?: number;
  last_attempt_at: string;
  /** 最後に成功した時刻。失敗時は前回の index.json から引き継ぐ (未成功なら null) */
  last_success_at: string | null;
  /** 失敗理由の要約 (個人情報を含めない) */
  error?: string;
}

// ==========================================
// 1. GitHub API Raw Response Types (2026)
// ==========================================

export interface LanguageMetric {
  name: string;
  total_engaged_users: number;
  total_code_suggestions: number;
  total_code_acceptances: number;
  total_code_lines_suggested: number;
  total_code_lines_accepted: number;
}

export interface EditorMetric {
  name: string;
  total_engaged_users: number;
}

import {
  AgentBreakdownMetric,
  ThirdPartyAgentMetric,
  McpMetric,
  SkillMetric,
  SlashCommandMetric,
  PluginMetric,
  CopilotAppMetric,
  FeatureEngagementMetric,
  AdoptionPhase,
  AdoptionPhaseMetrics,
  AgentPrMetrics,
  DiversityUsageMetrics,
} from './agent-metrics.js';
import { AiCreditsUsage, OrganizationCreditsPool } from './ai-credits.js';

export interface ChatModelMetric {
  name: string;
  total_chats: number;
}

export interface CopilotDailyMetrics {
  date: string; // YYYY-MM-DD
  total_active_users: number;
  total_engaged_users: number;
  copilot_ide_code_completions: {
    total_engaged_users: number;
    languages: LanguageMetric[];
    editors: EditorMetric[];
  };
  copilot_ide_chat: {
    total_engaged_users: number;
    total_chats: number;
    total_chat_copy_events: number;
    total_chat_insertion_events: number;
    models?: ChatModelMetric[];
  };
  copilot_dotcom_chat: {
    total_engaged_users: number;
    total_chats: number;
  };
  copilot_dotcom_pull_requests: {
    total_engaged_users: number;
    /** Reports API のユーザー単位レポートには無い指標。取得できないときは 0 ではなく null */
    total_pr_summaries_created: number | null;
  };
  copilot_in_cli: {
    total_engaged_users: number;
    total_cli_completions: number;
  };
  copilot_ide_agent?: {
    total_engaged_users: number;
    total_sessions: number;
    total_user_messages: number;
    totals_by_vscode_agent?: AgentBreakdownMetric[];
    totals_by_custom_agent?: AgentBreakdownMetric[];
    totals_by_3rd_party_agent?: ThirdPartyAgentMetric[];
    totals_by_mcp?: McpMetric[];
    totals_by_skill?: SkillMetric[];
    totals_by_slash_cmd?: SlashCommandMetric[];
    totals_by_plugin?: PluginMetric[];
    totals_by_copilot_app?: CopilotAppMetric[];
  };
  ai_credits?: AiCreditsUsage;
  prs_created_by_agent?: AgentPrMetrics;
  feature_engagement?: FeatureEngagementMetric[];
  code_generation?: {
    total_lines_added: number;
    total_lines_deleted: number;
    by_mode?: Record<string, { lines_added: number; lines_deleted: number }>;
  };
  diversity_usage?: DiversityUsageMetrics;
}

export interface GitHubUserAssignee {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
  type: string;
}

export interface AssigningTeam {
  id: number;
  name: string;
  slug: string;
}

export interface SeatOrganization {
  login: string;
  id: number;
}

export interface CopilotSeatAssignment {
  created_at: string;
  updated_at: string;
  pending_cancellation_date: string | null;
  last_activity_at: string | null;
  last_activity_editor: string | null;
  plan_type: CopilotPlanType;
  assignee: GitHubUserAssignee;
  assigning_team?: AssigningTeam | null;
  assigning_teams?: AssigningTeam[];
  /** Enterprise 直下のシート等では API が null を返す */
  organization: SeatOrganization | null;
  ai_credits_used?: number;
  seat_status?: 'active' | 'pending' | 'suspended';
  prepaid?: boolean;
  billing_effective_date?: string;
}

export interface CostCenterResource {
  /** 'Org' | 'User' | 'Repository' に正規化する。未知の種別は文字列のまま保持する */
  type: 'Org' | 'User' | 'Repository' | (string & {});
  name: string;
}

export interface EnterpriseCostCenter {
  id: string;
  name: string;
  cost_center_code: string;
  resources: CostCenterResource[];
}

export interface CostCenterBudget {
  cost_center_id: string;
  cost_center_name: string;
  cost_center_code: string;
  spending_limit_usd: number; // 上限Budget額
  free_tier_budget_usd: number; // 無料Budget額
  current_spend_usd: number; // 現在使用済みBudget額
  net_billable_spend_usd: number; // 課金対象実使用額 (max(0, current - free))
  remaining_budget_usd: number; // 残余Budget額 (max(0, limit - net_billable))
  budget_utilization_percent: number; // 使用率 (0 - 100%)
  status: 'normal' | 'warning' | 'exceeded'; // 80%未満: normal, 80-99%: warning, 100%+: exceeded
  ai_credits_limit?: number;
  ai_credits_used?: number;
  credits_utilization_percent?: number;
  credits_status?: 'normal' | 'warning' | 'exceeded';
}

export interface UserModelDailyUsage {
  date: string;
  total_chats: number;
  model_breakdown: Record<string, number>; // { 'claude-3-7-sonnet': 24, 'gpt-4o': 12, 'o1': 5, 'gemini-2-0-flash': 8 }
  suggestions: number;
  acceptances: number;
  lines_suggested: number;
  lines_accepted: number;
  acceptance_rate: number;
  daily_cost_usd: number;
  ai_credits_consumed?: number;
  token_count?: number;
}

export interface UserUsageProfile {
  login: string;
  display_name: string;
  avatar_url: string;
  department: string;
  cost_center: string;
  organization: string;
  plan_type: CopilotPlanType;
  total_chats: number;
  total_suggestions: number;
  total_acceptances: number;
  acceptance_rate: number;
  total_cost_usd: number;
  model_usage_totals: Record<string, number>;
  daily_history: UserModelDailyUsage[];
  tags?: string[];
  ai_credits_used_28d?: number;
  ai_adoption_phase?: AdoptionPhase;
  total_agent_sessions?: number;
  completed_agent_sessions?: number;
  ai_credits_limit_monthly?: number;
  agent_prs_created?: number;
  agent_prs_unreviewed?: number;
  agent_pr_median_merge_mins?: number;
}

// ==========================================
// 2. User Attribute Mapping (GitHub Variables)
// ==========================================

export interface UserAttributeMapping {
  github_user: string;
  display_name?: string;
  department?: string; // ユーザー定義Gr (部署/PJ)
  cost_center_override?: string;
  notes?: string;
  tags?: string[]; // 自由入力の複数ラベル (例: ["契約社員", "リモート"])。CSVでは ";" 区切りの1セルで表現
}

// ==========================================
// 3. Enriched & Processed Data Types
// ==========================================

export interface EnrichedUserSeat {
  login: string;
  display_name: string;
  avatar_url: string;
  department: string; // ユーザー定義Gr
  cost_center: string; // Cost Center
  organization: string; // Organization
  plan_type: CopilotPlanType;
  monthly_cost_usd: number;
  prorated_daily_cost_usd: number;
  /** plan_type が未確定のため料金を算定できていない (monthly_cost_usd は 0 として集計される) */
  cost_unconfirmed?: boolean;
  created_at: string;
  last_activity_at: string | null;
  last_activity_editor: string | null;
  days_inactive: number;
  status: UserSeatStatus;
  notes?: string;
  tags?: string[];
  is_data_unavailable?: boolean;
  cost_center_error?: boolean;
  ai_credits_used_28d?: number;
  ai_credits_cost_usd?: number;
  ai_adoption_phase?: AdoptionPhase;
  primary_agent_surface?: string;
  model_cost_efficiency?: number;
  teams?: string[];
  projects?: string[];
  role?: string;
  prepaid?: boolean;
  billing_effective_date?: string;
}

export interface GroupSummary {
  group_name: string;
  total_seats: number;
  active_seats: number;
  idle_seats: number;
  total_cost_usd: number;
  net_cost_usd?: number; // 従量課金/超過請求費用 (Net Billable Spend)
  spending_limit_usd?: number; // Cost Center 等の予算上限 (Limit設定値)
  potential_savings_usd: number;
  active_ratio: number; // 0.0 - 1.0
  /**
   * 利用状況メトリクス由来の指標。取得できていない場合 (月次レポート CSV・フィルター後のグループなど) は
   * 0 や固定値で埋めず null とする。ライブ集計のグループ別の値はシート比による按分推定で、
   * is_estimated / estimation_method が設定される。
   */
  acceptance_rate: number | null; // 0.0 - 1.0
  total_suggestions: number | null;
  total_acceptances: number | null;
  total_chats: number | null;
  total_pr_summaries: number | null;
  /** 月次レポート (CSV) のグループ集計: unit_type が requests の明細の数量合計 */
  total_requests?: number;
  is_data_partial?: boolean;
  total_ai_credits_used?: number;
  ai_credits_cost_usd?: number;
  agent_adoption_rate?: number;
  avg_ai_credits_per_seat?: number;
  is_estimated?: boolean;
  estimation_method?: 'proportional_seat_ratio' | 'team_api_actual' | 'direct_attribution';
}

export interface DailyTrendEntry {
  date: string;
  active_users: number;
  suggestions: number;
  acceptances: number;
  acceptance_rate: number;
  chats: number;
  /** PR 概要の作成数。レポートに無い場合は省略 (0 ではない) */
  pr_summaries?: number;
  daily_cost_usd: number;
  is_anomaly?: boolean;
  agent_sessions?: number;
  agent_engaged_users?: number;
  ai_credits_used?: number;
  lines_added_by_ai?: number;
}

/**
 * フィルター (Cost Center / Org / 部署 / タグ / ユーザー) の適用対象外のセクション。
 * 利用状況メトリクス等はユーザー別の実測を持たない集計のため、フィルター適用後も全社値のまま。
 * 画面で「全社値 (フィルター非対応)」と明示するために使う (絞り込み後の席数と並べて誤読させない)。
 */
export interface FilterScopeNotice {
  unfiltered_sections: string[];
}

/**
 * 利用状況メトリクス (補完・チャット・PR・エージェント等) の出所。
 * - live: 今回の収集で取得した値
 * - carried_over: メトリクスの取得に失敗したため、前回成功時の値を引き継いだ (as_of = 前回の取得時刻)
 * - unavailable: 一度も取得できていない (画面では「—（取得不可）」と表示する)
 */
export interface UsageMetricsProvenance {
  availability: 'live' | 'carried_over' | 'unavailable';
  as_of?: string;
}

export interface ScopeAggregatedData {
  scope_type: AnalysisScopeType;
  scope_key: string; // '2026-09-09' or '2026-09' or 'custom:2026-08-11_2026-09-09'
  date_range: {
    start: string;
    end: string;
    days_count: number;
  };
  overview: {
    total_seats: number;
    active_users: number;
    idle_seats: number;
    /** 付与から間もない未使用シート (導入期間)。遊休には含めない */
    onboarding_seats?: number;
    /** plan_type が未確定で費用を算定できていないシート数 (total_spend_usd には含まれない) */
    cost_unconfirmed_seats?: number;
    total_spend_usd: number;
    total_net_billable_usd?: number; // 従量課金/超過請求費用合計 (無料枠控除後の請求対象実額)
    total_spending_limit_usd?: number; // 上限Limit設定値合計
    idle_waste_usd: number;
    active_ratio: number;
    /** 利用状況メトリクス由来の指標。メトリクスを取得できていない場合は null (0 として描画しない) */
    overall_acceptance_rate: number | null;
    total_suggestions: number | null;
    total_acceptances: number | null;
    total_chats: number | null;
    total_pr_summaries: number | null;
    total_cli_commands: number | null;
    missing_metrics?: string[]; // 欠損項目 (e.g. ['copilot_ide_chat', 'top_languages'])
  };
  /** 利用状況メトリクスの出所。省略時は取得済み (live) */
  usage_metrics?: UsageMetricsProvenance;
  /** フィルター適用中のとき、適用対象外 (全社値のまま) のセクション */
  filter_notice?: FilterScopeNotice;
  by_department: Record<string, GroupSummary>;
  by_cost_center: Record<string, GroupSummary>;
  by_organization: Record<string, GroupSummary>;
  by_team?: Record<string, GroupSummary>;
  users: EnrichedUserSeat[];
  daily_trends: DailyTrendEntry[];
  top_languages: {
    name: string;
    suggestions: number;
    acceptances: number;
    lines_accepted: number;
    acceptance_rate: number;
  }[];
  issues?: DataFetchIssue[];
  cost_center_budgets?: CostCenterBudget[];
  user_profiles?: UserUsageProfile[];
  credits_summary?: OrganizationCreditsPool;
  agent_summary?: {
    total_sessions: number;
    total_messages: number;
    engaged_users: number;
    adoption_rate: number;
    top_agents?: AgentBreakdownMetric[];
    top_mcps?: McpMetric[];
  };
  adoption_distribution?: AdoptionPhaseMetrics;
  outcome_indicators?: {
    median_pr_merge_hours?: number;
    ai_pr_merge_ratio?: number;
    code_churn_ratio?: number;
  };
  code_generation_summary?: {
    total_lines_added: number;
    total_lines_deleted: number;
  };
}

// ==========================================
// 4. Monthly Usage Report (CSV) Types (2026)
// ==========================================

export type DashboardAppMode = 'live_metrics' | 'monthly_report' | 'model_radar' | 'deep_analysis';

export type DataSourceType = 'live_metrics' | 'monthly_report' | 'user_upload';

/**
 * 2階層特定モデルの第2階層: ANDフィルター条件
 * 組織・財務軸、プロジェクト・属性軸、アカウント・個別軸の全条件をAND一致で適用
 */
export interface FilterCriteria {
  costCenter: string; // 'all' | '__unassigned__' | specific cost center
  organization: string; // 'all' | '__unassigned__' | specific organization
  group: string; // 'all' | '__unassigned__' | specific group (department/team/project)
  tags: string[]; // AND一致
  userPattern: string; // 検索語句または正規表現
  userPatternIsRegex: boolean; // 正規表現モードフラグ
}

export const DEFAULT_FILTER_CRITERIA: Readonly<FilterCriteria> = {
  costCenter: 'all',
  organization: 'all',
  group: 'all',
  tags: [],
  userPattern: '',
  userPatternIsRegex: false,
};

/**
 * 第1階層: 対象データ3種類の表示メタ情報
 */
export const DATA_SOURCE_LABELS: Record<
  DataSourceType,
  { title: string; shortTitle: string; category: string; description: string }
> = {
  live_metrics: {
    title: '自動定期収集データ（API収集・期間指定）',
    shortTitle: '自動収集データ',
    category: 'API定期自動蓄積',
    description: 'API等から定期的に自動蓄積されたデータ群から、指定した月・日・期間を範囲指定して抽出します。',
  },
  monthly_report: {
    title: '登録済み月次利用レポート (Monthly Usage Report)',
    shortTitle: '月次レポート',
    category: '確定月次CSV',
    description: 'リポジトリに事前登録された月次確定CSVデータから、対象月を選択して分析します。',
  },
  user_upload: {
    title: 'オンデマンド登録CSV (User Upload)',
    shortTitle: 'オンデマンドCSV',
    category: '即時ローカル解析',
    description: '手元のUsage Report CSVを直接ドロップし、ブラウザ内完結（Zero-Leakage）で即座に解析します。',
  },
};

export interface MonthlyUsageReportRawRecord {
  date: string; // YYYY-MM-DD
  username: string; // GitHub login
  product?: string; // 'copilot'
  sku?: string; // 'copilot_business' | 'copilot_enterprise' | 'copilot_premium_request' | 'copilot_ai_credit'
  model?: string; // 'Claude 3.7 Sonnet', 'GPT-4o', 'o1', 'Gemini 2.0 Flash', etc.
  quantity?: number; // requests or credits
  unit_type?: string; // 'requests', 'ai_credits'
  applied_cost_per_quantity?: number;
  gross_amount?: number;
  discount_amount?: number;
  net_amount?: number;
  organization?: string;
  cost_center_name?: string;
  last_activity_at?: string;
  last_surface_used?: string;
  ai_credits_consumed?: number;
  /** トークンの合計のみを持つ CSV 向け (入力/出力の内訳が無い場合) */
  token_count?: number;
  /** AI usage report (date × model × username) の token 列。`input` / `output` / `cache_read` / `cache_write` */
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

export interface ReportModelBreakdown {
  model_name: string;
  total_requests: number;
  total_spend_usd: number;
  active_users: number;
  percentage: number;
}

export interface ReportSkuBreakdown {
  sku_name: string;
  total_quantity: number;
  unit_type: string;
  total_spend_usd: number;
  percentage: number;
}

export interface ReportDailyTrend {
  date: string;
  requests: number;
  spend_usd: number;
  active_users: number;
  model_breakdown?: Record<string, number>;
}

export interface ReportUserDetail {
  login: string;
  display_name: string;
  department: string;
  cost_center: string;
  organization: string;
  total_requests: number;
  total_spend_usd: number;
  gross_spend_usd?: number; // 利用費用 (定価・割引前総額)
  net_spend_usd?: number; // 超過請求費用 (無料Credit控除後実質請求額)
  primary_model: string;
  /** モデル別のリクエスト数 (requests 系の明細)。フィルター後の内訳を正確に再集計するために保持する */
  model_requests?: Record<string, number>;
  /** モデル別の費用 (net, USD) */
  model_spend_usd?: Record<string, number>;
  last_activity_date?: string;
  surface?: string;
  tags?: string[];
  /** 使用量・トークン・単価・長大化の兆候 (SDD-06 §5)。算出に必要なデータが無いユーザーでは省略 */
  usage_insight?: UsageInsight;
}

/**
 * 兆候の段階。点数化はしない。
 * - 'none': 特記事項なし
 * - 'watch': 参考 (傾向として見ておく程度)
 * - 'review': 確認を推奨 (利用方法を一度見直す価値がある)
 * - 'insufficient': サンプル不足またはデータなしで判定しない
 */
export type SignalLevel = 'none' | 'watch' | 'review' | 'insufficient';

export type UsageSignalId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export interface UsageSignal {
  id: UsageSignalId;
  level: SignalLevel;
  /** ユーザーの値 (単位は定義による)。算出できなければ null */
  value: number | null;
  /** 比較基準 (組織内の中央値など)。無ければ null */
  baseline: number | null;
  /** value / baseline。基準が無ければ null */
  ratio: number | null;
  /** 判定に使ったサンプル数 (日数など) */
  samples: number;
  /** 補足 (S2: 該当日数、S3: 単位など) */
  detail?: Record<string, number | string>;
}

export interface UsageInsightDaily {
  date: string;
  requests: number;
  credits: number;
  tokens: number | null;
  models: number;
}

export interface UsageInsightModel {
  model: string;
  tokens: number;
  gross_usd: number;
  per_million_tokens_usd: number | null;
}

export interface UsageInsight {
  usage: {
    /** requests 系の明細が無い (例: AI usage report のみ) ときは 0 ではなく null */
    requests: number | null;
    credits: number | null;
    active_days: number;
    /** 1 利用日あたりの量。requests があれば requests、無ければ credits */
    per_active_day: number | null;
    per_active_day_unit: 'requests' | 'credits' | null;
    peak_day: { date: string; value: number; unit: 'requests' | 'credits' } | null;
  };
  /** トークン列が一切無いユーザーは null */
  tokens: {
    input: number | null;
    output: number | null;
    cache_read: number | null;
    cache_write: number | null;
    total: number;
    /** トークンを持つ明細行の割合 (0〜1)。低いと他の指標の信頼度が下がる */
    coverage: number;
  } | null;
  /** 費用は利用額 (gross)。単価ごとに分母と同じ種類の明細の費用だけを使う */
  unit_cost: {
    per_million_tokens_usd: number | null;
    per_request_usd: number | null;
    per_credit_usd: number | null;
  };
  by_model: UsageInsightModel[];
  signals: UsageSignal[];
  /** 判定の総合 (有効なシグナルから決定) */
  level: SignalLevel;
  daily: UsageInsightDaily[];
}

/**
 * 取り込みの要約。複数 CSV の結合・重複検知・日付なし行の件数を残し、集計の根拠を追えるようにする。
 */
export interface ReportImportSummary {
  source_files: string[];
  /** 重複を除いて集計に使ったレコード数 */
  records_total: number;
  /** 別ファイルとの重複として 1 件に集約した行数 */
  duplicates_skipped: number;
  /** 日付がなく、日別推移に載せられなかった行数 (合計には含む) */
  undated_records?: number;
}

export interface MonthlyReportAggregatedData {
  report_month: string; // 'YYYY-MM'
  source_type: 'persisted' | 'local_drop';
  file_name: string;
  parsed_at: string;
  /** 複数ファイルの結合・重複検知の結果 (結合した月次レポートのみ) */
  import_summary?: ReportImportSummary;
  overview: {
    total_net_spend_usd: number;
    total_gross_spend_usd: number;
    total_discount_usd: number;
    /** unit_type が requests 系の明細の数量合計 (シート行・クレジット行は含まない) */
    total_requests: number;
    /** unit_type 別の数量合計 (例: { requests: 120, 'ai-credits': 3400, seats: 85 }) */
    quantity_by_unit?: Record<string, number>;
    total_active_users: number;
    top_model: string;
    top_sku: string;
  };
  by_department: Record<string, GroupSummary>;
  by_cost_center: Record<string, GroupSummary>;
  by_organization: Record<string, GroupSummary>;
  model_breakdown: ReportModelBreakdown[];
  sku_breakdown: ReportSkuBreakdown[];
  daily_trends: ReportDailyTrend[];
  user_details: ReportUserDetail[];
  /** フィルター適用中のとき、適用対象外 (全体値のまま) のセクション */
  filter_notice?: FilterScopeNotice;
}

export interface IndexMetadata {
  repository: {
    owner: string;
    name: string;
    is_fork: boolean;
  };
  generated_at: string;
  /** この成果物を作った run (Raw Landing の Run Manifest の ID)。ライブ収集・再処理のときだけ */
  run?: RunReference;
  data_retention_days: number;
  available_months: string[]; // 過去1年ローリング表示対象月 (最大12カ月)
  all_recorded_months?: string[]; // 全蓄積月（上限なく記録された月一覧）
  available_days: string[];
  available_reports?: string[]; // e.g. ["2026-09", "2026-08"]
  rolling_1year_trend_file?: string; // e.g. "trends/rolling-1year.json"
  deep_analysis_months?: string[]; // ディープ分析用アーカイブが存在する月一覧
  /** MOCK_MODE (--mock / --demo) で生成したシミュレーションデータのときだけ true。取得失敗では true にしない */
  is_mock_mode?: boolean;
  /** ソース別の取得状態。失敗ソースの last_success_at は前回成功時刻を指す */
  source_status?: SourceStatus[];
  /** 最新のデータ品質と直前との比較 (P1-7)。実収集をしていない成果物では無い */
  data_quality?: DataQualitySummary;
  /**
   * 公開範囲の検査 (npm run fork:verify) が参照する、この成果物のプライバシー属性。
   * リポジトリ / Pages が公開されているときに、個人単位のデータが含まれるかを判定する。
   */
  privacy?: {
    /** 仮名化 (ANONYMIZE_USERS + 秘密鍵) された出力か */
    anonymized: boolean;
    /** ユーザー単位 (氏名・部署・ログイン名・個人別利用) のデータを含むか。デモデータは false */
    contains_user_level_data: boolean;
    /** 取り込んだ月次レポート (CSV) の集計を含むか (実データか見本かは判別できない)。公開時は fork:verify が警告する */
    contains_imported_reports?: boolean;
  };
  billing?: {
    currency: CurrencyConfig;
    subCurrency?: CurrencyConfig | null;
    discountPercent?: number;
    periods?: any[];
  };
  default_scopes: {
    // ライブ Copilot Metrics/Seats データが1件も無い場合 (認証情報未設定・
    // Enterprise Owner権限なし等) は捏造せず undefined とする。
    latest_day?: string;
    latest_month?: string;
    latest_report?: string; // e.g. "2026-08"
    latest_range?: {
      start: string;
      end: string;
    };
  };
  summary: {
    total_seats: number;
    active_seats_30d: number;
    idle_seats_30d: number;
    /** 付与から間もない未使用シート (遊休・稼働のいずれにも含めない) */
    onboarding_seats?: number;
    /** plan_type が未確定で費用を算定できていないシート数 (費用に含まれない) */
    cost_unconfirmed_seats?: number;
    total_monthly_spend_usd: number;
    idle_waste_spend_usd: number;
    total_ai_credits_used?: number;
    total_ai_credits_cost_usd?: number;
    total_combined_cost_usd?: number;
    credits_pool_utilization_percent?: number;
    agent_adoption_rate?: number;
  };
  issues?: DataFetchIssue[];
}

export type SeatBillingStatus = 'active' | 'prepaid_pending' | 'prorated';

/**
 * 1 年ローリング推移の 1 か月分。保存済みの月次集計 (processed/monthly) から実値で構成する。
 * 取得できていない指標は 0 や定数で埋めず null とする (以前は受諾率 0.35 を全月に複写していた)。
 */
export interface RollingTrendEntry {
  month: string; // 'YYYY-MM'
  /** シート費の月次スナップショット (カタログ / 契約価格ベース) */
  total_spend_usd: number;
  total_seats: number;
  active_seats: number;
  idle_seats: number;
  /** 利用状況メトリクスが取得できていない月は null */
  acceptance_rate: number | null;
  total_chats: number | null;
  total_ai_credits_used?: number | null;
  total_agent_sessions?: number | null;
  agent_adoption_rate?: number | null;
}

export interface RollingTrendDataset {
  generated_at: string;
  /** 対象月 (新しい順) */
  months: string[];
  /** months と同じ順序の実績。保存済みの月次集計が無い月は含めない */
  trends: RollingTrendEntry[];
}
