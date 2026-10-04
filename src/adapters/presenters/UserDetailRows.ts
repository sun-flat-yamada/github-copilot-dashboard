/**
 * ユーザー明細の行モデル (SDD-07 §2.16)。
 *
 * ライブ (シート + Reports API のプロファイル) でも月次レポート (CSV) でも、同じ列・同じ意味の行にそろえる。
 * そのデータソースに無い値は 0 ではなく null とし、表示は「—」(理由つき) にする (SDD-06 §4.4)。
 * 表示コンポーネントはこの行だけを見るので、表示経路や配置される View によらず同じ形式になる。
 */
import type {
  AnalysisScopeType,
  CopilotPlanType,
  MonthlyReportAggregatedData,
  ReportUserDetail,
  ScopeAggregatedData,
  UsageInsight,
  UserSeatStatus,
  UserUsageProfile,
} from '../../domain/entities/copilot.js';
import { seatCostForScope } from '../../domain/rules/ScopeCostRule.js';
import {
  accumulatorFromDailyHistory,
  computeOrgBaseline,
  computeUsageInsight,
} from '../../processor/usage-insight.js';

export type UserDetailSource = 'live' | 'report';

export interface TopModelShare {
  model: string;
  share: number | null;
}

export const TOP_MODELS_LIMIT = 3;

/** モデル別の数量から上位 N 件と全体に対する比率を返す (数量 0 以下は除く) */
export function topModelShares(counts: Record<string, number> | undefined, limit = TOP_MODELS_LIMIT): TopModelShare[] {
  const entries = Object.entries(counts ?? {}).filter(([, n]) => n > 0);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total <= 0) return [];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, limit).map(([model, n]) => ({ model, share: n / total }));
}

export function formatShare(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** CSV / 検索用の文字列: `A 50%; B 30%; C 20%` (比率が無いモデルは名前のみ) */
export function formatTopModels(models: TopModelShare[]): string {
  return models.map((m) => (m.share === null ? m.model : `${m.model} ${formatShare(m.share)}`)).join('; ');
}

/** 全項目が必須。そのソースに無い値は null / false を明示し、キー集合はソースによらず同一 */
export interface UserDetailRow {
  source: UserDetailSource;
  login: string;
  display_name: string;
  avatar_url: string | null;
  department: string;
  tags: string[];
  cost_center: string;
  organization: string;
  cost_center_error: boolean;
  is_data_unavailable: boolean;

  // シート (ライブのみ)
  plan: CopilotPlanType | null;
  status: UserSeatStatus | null;
  days_inactive: number | null;
  cost_unconfirmed: boolean;
  monthly_cost_usd: number | null;
  prorated_daily_cost_usd: number | null;
  notes: string | null;

  // 利用実績
  primary_model: string | null;
  /** 利用量上位 (最大 3)。share は全モデル合計に対する比率 (0-1)。内訳が無く比率を出せないときは null */
  top_models: TopModelShare[];
  /** 月次レポート: requests 系の数量。ライブ: Reports API に無いため null */
  requests: number | null;
  /** 以下 4 つはライブ (Reports API) のみ。月次レポートには無いため null */
  suggestions: number | null;
  acceptances: number | null;
  acceptance_rate: number | null;
  chats: number | null;

  /** 使用量・トークン・単価・兆候。算出できなければ null */
  usage_insight: UsageInsight | null;

  /** 利用費用 (ライブ: スコープ単位のシート費。月次: 利用額 gross)。算定できなければ null */
  usage_cost_usd: number | null;
  /** 超過請求 (ライブ: 従来どおりスコープ単位のシート費。月次: 付与分控除後の net) */
  excess_usd: number | null;

  last_activity: string | null;
  /** エディタ (ライブ) / サーフェス (月次) */
  surface: string | null;
}

export interface UserDetailRowSet {
  source: UserDetailSource;
  rows: UserDetailRow[];
  /** 利用費用の単位の説明 (ライブはスコープ依存。月次は固定) */
  costUnitLabel: string;
  /** CSV のファイル名に使うキー */
  scopeKey: string;
  scopeType?: AnalysisScopeType;
}

/** ライブのプロファイルからモデル使用量が最大のモデルを返す */
function topModelOf(profile?: UserUsageProfile): string | null {
  const entries = Object.entries(profile?.model_usage_totals ?? {}).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function buildLiveRows(data: ScopeAggregatedData, profiles: UserUsageProfile[] = []): UserDetailRowSet {
  const profileList = profiles.length > 0 ? profiles : data.user_profiles ?? [];
  const byLogin = new Map(profileList.map((p) => [p.login.toLowerCase(), p]));

  // 組織基準は全プロファイルから作る (表示フィルターで判定が動かないように)
  const accs = new Map(profileList.map((p) => [p.login.toLowerCase(), accumulatorFromDailyHistory(p.daily_history ?? [])]));
  const baseline = computeOrgBaseline(accs.values());

  const days = data.date_range?.days_count ?? 1;
  const scopeType = data.scope_type;
  const costUnitLabel =
    scopeType === 'daily' ? '日割り' : scopeType === 'monthly' ? '月額' : `期間 (日割り×${days}日)`;

  const rows: UserDetailRow[] = data.users.map((u) => {
    const key = u.login.toLowerCase();
    const prof = byLogin.get(key);
    const acc = accs.get(key);
    const cost = u.cost_unconfirmed ? null : seatCostForScope(u, scopeType, days);
    return {
      source: 'live',
      login: u.login,
      display_name: u.display_name,
      avatar_url: u.avatar_url || null,
      department: u.department,
      tags: u.tags ?? [],
      cost_center: u.cost_center,
      organization: u.organization,
      cost_center_error: u.cost_center_error ?? false,
      is_data_unavailable: u.is_data_unavailable ?? false,
      plan: u.plan_type,
      status: u.status,
      days_inactive: u.days_inactive,
      cost_unconfirmed: u.cost_unconfirmed ?? false,
      monthly_cost_usd: u.monthly_cost_usd,
      prorated_daily_cost_usd: u.prorated_daily_cost_usd,
      notes: u.notes ?? null,
      primary_model: topModelOf(prof),
      top_models: topModelShares(prof?.model_usage_totals),
      requests: null,
      suggestions: prof ? prof.total_suggestions : null,
      acceptances: prof ? prof.total_acceptances : null,
      acceptance_rate: prof && prof.total_suggestions > 0 ? prof.acceptance_rate : null,
      chats: prof ? prof.total_chats : null,
      usage_insight: acc && (prof?.daily_history?.length ?? 0) > 0 ? computeUsageInsight(acc, baseline) : null,
      usage_cost_usd: cost,
      excess_usd: cost,
      last_activity: u.last_activity_at,
      surface: u.last_activity_editor,
    };
  });

  return { source: 'live', rows, costUnitLabel, scopeKey: data.scope_key, scopeType };
}

/** 月次: requests 内訳 → 費用内訳 → 主利用モデルのみ (比率なし) の順で使う */
function reportTopModels(u: ReportUserDetail): TopModelShare[] {
  const byRequests = topModelShares(u.model_requests);
  if (byRequests.length > 0) return byRequests;
  const bySpend = topModelShares(u.model_spend_usd);
  if (bySpend.length > 0) return bySpend;
  return u.primary_model && u.primary_model !== 'None' ? [{ model: u.primary_model, share: null }] : [];
}

export function buildReportRows(data: MonthlyReportAggregatedData): UserDetailRowSet {
  const rows: UserDetailRow[] = data.user_details.map((u) => ({
    source: 'report',
    login: u.login,
    display_name: u.display_name,
    avatar_url: null,
    department: u.department,
    tags: u.tags ?? [],
    cost_center: u.cost_center,
    organization: u.organization,
    cost_center_error: false,
    is_data_unavailable: false,
    plan: null,
    status: null,
    days_inactive: null,
    cost_unconfirmed: false,
    notes: null,
    monthly_cost_usd: null,
    prorated_daily_cost_usd: null,
    primary_model: u.primary_model && u.primary_model !== 'None' ? u.primary_model : null,
    top_models: reportTopModels(u),
    // requests 系の明細が無い (AI usage report のみ) ときは 0 件ではなく不明 (null)
    requests: u.usage_insight ? u.usage_insight.usage.requests : u.total_requests,
    suggestions: null,
    acceptances: null,
    acceptance_rate: null,
    chats: null,
    usage_insight: u.usage_insight ?? null,
    usage_cost_usd: u.gross_spend_usd ?? u.total_spend_usd,
    excess_usd: u.net_spend_usd ?? u.total_spend_usd,
    last_activity: u.last_activity_date ?? null,
    surface: u.surface ?? null,
  }));
  return { source: 'report', rows, costUnitLabel: '月次', scopeKey: data.report_month };
}
