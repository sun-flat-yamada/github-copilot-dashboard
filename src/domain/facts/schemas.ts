import { z } from 'zod';

/**
 * 正準ファクト v1 (P1-3, 付録 A.7.2)。
 *
 * ソースごとの形 (Reports の users-1-day、シート、CSV、AI Credits) を、版管理された 1 つの契約へ写す。
 * API の変更の影響は取込層 (mappers.ts) に閉じ込め、集計・ビューはこの契約だけを見る。
 *
 * 規約:
 * - 全ファクトは `schema_version` を持つ (リテラル)。互換を壊す変更は版を上げる。
 * - 欠損は 0 ではなく `null`。「報告が無い」と「0 件」は区別する。
 * - `user_key` は呼び出し側で解決済みのキー (匿名化モードでは仮名 ID)。実名・メールをここへ書かない。
 */
export const FACT_SCHEMA_VERSION = 1;

const schemaVersion = z.literal(FACT_SCHEMA_VERSION);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const timestamp = z.string().min(1);
const metric = z.number().finite().nonnegative().nullable();

/** 値の出所。`api` = Reports / Seats API、`csv` = 取込レポート、`derived` = 他ファクトからの導出 */
export const factSourceSchema = z.enum(['api', 'csv', 'derived']);
/** 値の質。`measured` = 実測、`estimated` = 推定、`missing` = 欠損 (全指標が null)、`demo` = デモデータ */
export const factQualitySchema = z.enum(['measured', 'estimated', 'missing', 'demo']);

const provenance = {
  source: factSourceSchema,
  quality: factQualitySchema,
};

const usageMetrics = {
  interactions: metric,
  code_generations: metric,
  code_acceptances: metric,
  loc_suggested_add: metric,
  loc_suggested_delete: metric,
  loc_added: metric,
  loc_deleted: metric,
};

/** fact.usage_user_daily: 日 × ユーザーの合計行 (機能・モデルの内訳は usage_user_feature_daily) */
export const usageUserDailySchema = z
  .object({
    schema_version: schemaVersion,
    day,
    user_key: z.string().min(1),
    ...usageMetrics,
    used_agent: z.boolean().nullable(),
    used_chat: z.boolean().nullable(),
    used_cli: z.boolean().nullable(),
    ai_credits_used: metric,
    ...provenance,
  })
  .strict();

/**
 * fact.usage_user_feature_daily: 日 × ユーザー × 機能 × モデルの内訳行。
 * 合計行とは別ファクトにして、合算時の二重計上を構造上起こさない。
 * Reports が機能のみ・モデルのみの粒度で返す場合、持たない軸は null。
 */
export const usageUserFeatureDailySchema = z
  .object({
    schema_version: schemaVersion,
    day,
    user_key: z.string().min(1),
    feature: z.string().min(1).nullable(),
    model: z.string().min(1).nullable(),
    ...usageMetrics,
    ...provenance,
  })
  .strict();

/** fact.usage_org_daily: 日 × スコープ (Enterprise / Org) の利用者数 */
export const usageOrgDailySchema = z
  .object({
    schema_version: schemaVersion,
    day,
    scope: z.string().min(1),
    active_users: metric,
    engaged_users: metric,
    completion_users: metric,
    chat_users: metric,
    cli_users: metric,
    agent_users: metric,
    /** Reports のユーザー単位レポートには無い。取得できないときは 0 ではなく null */
    pr_summaries_created: metric,
    ...provenance,
  })
  .strict();

/** fact.seat_snapshot: 日 × ユーザーのシート状態 */
export const seatSnapshotSchema = z
  .object({
    schema_version: schemaVersion,
    snapshot_day: day,
    user_key: z.string().min(1),
    /** API が返さない / 未知の値は 'unknown' (料金を推測しない) */
    plan_type: z.enum(['business', 'enterprise', 'unknown']),
    organization: z.string().nullable(),
    assigning_teams: z.array(z.string()),
    created_at: timestamp.nullable(),
    last_activity_at: timestamp.nullable(),
    pending_cancellation_date: day.nullable(),
    ...provenance,
  })
  .strict();

/** fact.cost_line: 日 × ユーザー(任意) × SKU × モデルの費用行。取込は P1-5 (AI Credits / CSV) */
export const costLineSchema = z
  .object({
    schema_version: schemaVersion,
    day,
    user_key: z.string().min(1).nullable(),
    sku: z.string().min(1),
    model: z.string().min(1).nullable(),
    quantity: metric,
    unit_type: z.string().min(1).nullable(),
    unit_price: metric,
    gross: metric,
    discount: metric,
    net: metric,
    currency: z.string().length(3).nullable(),
    pricing_version: z.string().min(1).nullable(),
    ...provenance,
  })
  .strict();

export type UsageUserDaily = z.infer<typeof usageUserDailySchema>;
export type UsageUserFeatureDaily = z.infer<typeof usageUserFeatureDailySchema>;
export type UsageOrgDaily = z.infer<typeof usageOrgDailySchema>;
export type SeatSnapshot = z.infer<typeof seatSnapshotSchema>;
export type CostLine = z.infer<typeof costLineSchema>;

/** ファクト名 (付録 A.7.2) → スキーマ。JSON Schema 生成と契約テストの唯一の一覧 */
export const FACT_SCHEMAS = {
  'fact.usage_user_daily': usageUserDailySchema,
  'fact.usage_user_feature_daily': usageUserFeatureDailySchema,
  'fact.usage_org_daily': usageOrgDailySchema,
  'fact.seat_snapshot': seatSnapshotSchema,
  'fact.cost_line': costLineSchema,
} as const;

export type FactName = keyof typeof FACT_SCHEMAS;
