import type { CopilotDailyMetrics, CopilotSeatAssignment } from '../entities/copilot.js';
import {
  CostLine,
  FACT_SCHEMA_VERSION,
  SeatSnapshot,
  UsageOrgDaily,
  UsageUserDaily,
  UsageUserFeatureDaily,
} from './schemas.js';

/**
 * ソースアダプタの出力 → 正準ファクト v1 への写像 (P1-3)。
 *
 * 方針: 報告が無い指標は 0 ではなく null。入力型は構造的に最小限だけ要求し、
 * アダプタ (usage-reports) への依存を持たせない (domain → adapters の逆依存を避ける)。
 */

interface MetricFields {
  user_initiated_interaction_count?: number;
  code_generation_activity_count?: number;
  code_acceptance_activity_count?: number;
  loc_suggested_to_add_sum?: number;
  loc_suggested_to_delete_sum?: number;
  loc_added_sum?: number;
  loc_deleted_sum?: number;
}

/** users-1-day の 1 行 (UserReportRow) のうち、写像に必要な部分 */
export interface UsageRowInput extends MetricFields {
  ai_credits_used?: number;
  used_agent?: boolean;
  used_chat?: boolean;
  used_cli?: boolean;
  totals_by_feature?: Array<MetricFields & { feature: string }>;
  totals_by_model_feature?: Array<MetricFields & { feature: string; model: string }>;
}

const orNull = (v: number | undefined): number | null => (v === undefined ? null : v);

function metricsOf(m: MetricFields) {
  return {
    interactions: orNull(m.user_initiated_interaction_count),
    code_generations: orNull(m.code_generation_activity_count),
    code_acceptances: orNull(m.code_acceptance_activity_count),
    loc_suggested_add: orNull(m.loc_suggested_to_add_sum),
    loc_suggested_delete: orNull(m.loc_suggested_to_delete_sum),
    loc_added: orNull(m.loc_added_sum),
    loc_deleted: orNull(m.loc_deleted_sum),
  };
}

function qualityOf(values: Array<number | boolean | null>): 'measured' | 'missing' {
  return values.every((v) => v === null) ? 'missing' : 'measured';
}

export interface MapOptions<R extends UsageRowInput = UsageRowInput> {
  /** 行から呼び出し側が解決したユーザーキー (匿名化モードでは仮名 ID)。実名・メールを渡さない */
  resolveUserKey: (row: R) => string;
  source?: 'api' | 'csv';
}

export function toUsageUserDaily<R extends UsageRowInput>(day: string, row: R, opts: MapOptions<R>): UsageUserDaily {
  const metrics = metricsOf(row);
  const used_agent = row.used_agent ?? null;
  const used_chat = row.used_chat ?? null;
  const used_cli = row.used_cli ?? null;
  const ai_credits_used = orNull(row.ai_credits_used);
  return {
    schema_version: FACT_SCHEMA_VERSION,
    day: day.slice(0, 10),
    user_key: opts.resolveUserKey(row),
    ...metrics,
    used_agent,
    used_chat,
    used_cli,
    ai_credits_used,
    source: opts.source ?? 'api',
    quality: qualityOf([...Object.values(metrics), used_agent, used_chat, used_cli, ai_credits_used]),
  };
}

/** 内訳行。最も細かい粒度 (モデル × 機能 → 機能のみ) を 1 つだけ採用し、二重計上しない */
export function toUsageUserFeatureDaily<R extends UsageRowInput>(
  day: string,
  row: R,
  opts: MapOptions<R>
): UsageUserFeatureDaily[] {
  const base = { schema_version: FACT_SCHEMA_VERSION, day: day.slice(0, 10), user_key: opts.resolveUserKey(row) } as const;
  const source = opts.source ?? 'api';
  const make = (feature: string, model: string | null, m: MetricFields): UsageUserFeatureDaily => {
    const metrics = metricsOf(m);
    return { ...base, feature, model, ...metrics, source, quality: qualityOf(Object.values(metrics)) };
  };
  if (row.totals_by_model_feature?.length) {
    return row.totals_by_model_feature.map((r) => make(r.feature, r.model, r));
  }
  return (row.totals_by_feature ?? []).map((r) => make(r.feature, null, r));
}

export function toUsageOrgDaily(m: CopilotDailyMetrics, scope: string, source: 'api' | 'csv' = 'api'): UsageOrgDaily {
  const fields = {
    active_users: orNull(m.total_active_users),
    engaged_users: orNull(m.total_engaged_users),
    completion_users: orNull(m.copilot_ide_code_completions?.total_engaged_users),
    chat_users: orNull(m.copilot_ide_chat?.total_engaged_users),
    cli_users: orNull(m.copilot_in_cli?.total_engaged_users),
    agent_users: orNull(m.copilot_ide_agent?.total_engaged_users),
    pr_summaries_created: orNull(m.copilot_dotcom_pull_requests?.total_pr_summaries_created ?? undefined),
  };
  return {
    schema_version: FACT_SCHEMA_VERSION,
    day: m.date.slice(0, 10),
    scope,
    ...fields,
    source,
    quality: qualityOf(Object.values(fields)),
  };
}

export function toSeatSnapshot(
  snapshotDay: string,
  seat: CopilotSeatAssignment,
  opts: { resolveUserKey: (seat: CopilotSeatAssignment) => string }
): SeatSnapshot {
  const teams = seat.assigning_teams ?? (seat.assigning_team ? [seat.assigning_team] : []);
  const plan = seat.plan_type === 'business' || seat.plan_type === 'enterprise' ? seat.plan_type : 'unknown';
  return {
    schema_version: FACT_SCHEMA_VERSION,
    snapshot_day: snapshotDay.slice(0, 10),
    user_key: opts.resolveUserKey(seat),
    plan_type: plan,
    organization: seat.organization?.login ?? null,
    assigning_teams: teams.map((t) => t.slug),
    created_at: seat.created_at ?? null,
    last_activity_at: seat.last_activity_at ?? null,
    pending_cancellation_date: seat.pending_cancellation_date?.slice(0, 10) ?? null,
    source: 'api',
    quality: 'measured',
  };
}

/** AI credit usage の 1 明細 (AiCreditUsageItem) のうち、写像に必要な部分 */
export interface CostItemInput {
  sku: string;
  model: string;
  unitType: string;
  pricePerUnit: number;
  grossQuantity: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
}

const blankToNull = (v: string): string | null => (v.trim() === '' ? null : v);

/**
 * Billing の使用量明細 → fact.cost_line。ユーザー別に取得していないため user_key は null。
 * quantity は grossQuantity (gross の金額と対応する数量)。単位 (unit_type) はそのまま残し、
 * 異なる単位を合算しない。応答に通貨が無いため currency は null (通貨を断定しない)。
 */
export function toCostLine(day: string, item: CostItemInput): CostLine {
  return {
    schema_version: FACT_SCHEMA_VERSION,
    day: day.slice(0, 10),
    user_key: null,
    sku: item.sku,
    model: blankToNull(item.model),
    quantity: item.grossQuantity,
    unit_type: blankToNull(item.unitType),
    unit_price: item.pricePerUnit,
    gross: item.grossAmount,
    discount: item.discountAmount,
    net: item.netAmount,
    currency: null,
    pricing_version: null,
    source: 'api',
    quality: 'measured',
  };
}
