/**
 * GitHub Copilot Usage & Billing Types (2026.09 Specification)
 */

export type CopilotPlanType = 'business' | 'enterprise';

export type UserSeatStatus = 'active' | 'low_active' | 'idle' | 'never_used';

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
    total_pr_summaries_created: number;
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
  organization: SeatOrganization;
  ai_credits_used?: number;
  seat_status?: 'active' | 'pending' | 'suspended';
  prepaid?: boolean;
  billing_effective_date?: string;
}

export interface CostCenterResource {
  type: 'Org' | 'User' | 'Repository';
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
  department?: string; // 任意仕訳グループ (部署/PJ)
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
  department: string; // 任意仕訳グループ
  cost_center: string; // Cost Center
  organization: string; // Organization
  plan_type: CopilotPlanType;
  monthly_cost_usd: number;
  prorated_daily_cost_usd: number;
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
  acceptance_rate: number; // 0.0 - 1.0
  total_suggestions: number;
  total_acceptances: number;
  total_chats: number;
  total_pr_summaries: number;
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
  pr_summaries: number;
  daily_cost_usd: number;
  is_anomaly?: boolean;
  agent_sessions?: number;
  agent_engaged_users?: number;
  ai_credits_used?: number;
  lines_added_by_ai?: number;
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
    total_spend_usd: number;
    total_net_billable_usd?: number; // 従量課金/超過請求費用合計 (無料枠控除後の請求対象実額)
    total_spending_limit_usd?: number; // 上限Limit設定値合計
    idle_waste_usd: number;
    active_ratio: number;
    overall_acceptance_rate: number;
    total_suggestions: number;
    total_acceptances: number;
    total_chats: number;
    total_pr_summaries: number;
    total_cli_commands: number;
    missing_metrics?: string[]; // 欠損項目 (e.g. ['copilot_ide_chat', 'top_languages'])
  };
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
  token_count?: number;
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
  last_activity_date?: string;
  surface?: string;
  tags?: string[];
}

export interface MonthlyReportAggregatedData {
  report_month: string; // 'YYYY-MM'
  source_type: 'persisted' | 'local_drop';
  file_name: string;
  parsed_at: string;
  overview: {
    total_net_spend_usd: number;
    total_gross_spend_usd: number;
    total_discount_usd: number;
    total_requests: number;
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
}

export interface IndexMetadata {
  repository: {
    owner: string;
    name: string;
    is_fork: boolean;
  };
  generated_at: string;
  data_retention_days: number;
  available_months: string[]; // 過去1年ローリング表示対象月 (最大12カ月)
  all_recorded_months?: string[]; // 全蓄積月（上限なく記録された月一覧）
  available_days: string[];
  available_reports?: string[]; // e.g. ["2026-09", "2026-08"]
  rolling_1year_trend_file?: string; // e.g. "trends/rolling-1year.json"
  deep_analysis_months?: string[]; // ディープ分析用アーカイブが存在する月一覧
  is_mock_mode?: boolean; // モック動作モード (DEMO用シミュレーションデータ) の有無
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

export interface RollingTrendEntry {
  month: string; // 'YYYY-MM'
  total_spend_usd: number;
  total_seats: number;
  active_seats: number;
  idle_seats: number;
  acceptance_rate: number;
  total_chats: number;
  total_ai_credits_used?: number;
  total_agent_sessions?: number;
  agent_adoption_rate?: number;
}

export interface RollingTrendDataset {
  generated_at: string;
  data_points: RollingTrendEntry[];
}

