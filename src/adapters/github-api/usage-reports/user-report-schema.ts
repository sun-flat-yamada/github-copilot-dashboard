import { z } from 'zod';

/**
 * Copilot usage metrics の「ユーザー単位 1 日レポート (users-1-day)」の 1 行。
 *
 * 出典: GitHub REST API description (api.github.com / ghec, 2026-03-10) と
 * docs「Copilot usage metrics」の API export fields。
 *
 * - 未知のフィールド・未知の feature / model / ide は捨てずに保持する (.passthrough / 文字列のまま)
 * - 数値は 0 以上 (負数は不正としてレコードごと隔離する)
 * - 指標が無い (undefined) と 0 は区別する。レポートが載せていない指標を 0 で補わない
 */
const count = z.number().finite().nonnegative().optional();

const metricShape = {
  user_initiated_interaction_count: count,
  code_generation_activity_count: count,
  code_acceptance_activity_count: count,
  loc_suggested_to_add_sum: count,
  loc_suggested_to_delete_sum: count,
  loc_added_sum: count,
  loc_deleted_sum: count,
};

const byIde = z.object({ ide: z.string(), ...metricShape }).passthrough();
const byFeature = z.object({ feature: z.string(), ...metricShape }).passthrough();
const byLanguageFeature = z.object({ language: z.string(), feature: z.string(), ...metricShape }).passthrough();
const byLanguageModel = z.object({ language: z.string(), model: z.string(), ...metricShape }).passthrough();
const byModelFeature = z.object({ model: z.string(), feature: z.string(), ...metricShape }).passthrough();

export const userReportRowSchema = z
  .object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'day must be YYYY-MM-DD'),
    user_id: z.number().int().optional(),
    user_login: z.string().min(1),
    enterprise_id: z.union([z.string(), z.number()]).nullable().optional(),
    organization_id: z.union([z.string(), z.number()]).nullable().optional(),
    ai_credits_used: count,
    ...metricShape,
    used_agent: z.boolean().optional(),
    used_chat: z.boolean().optional(),
    used_cli: z.boolean().optional(),
    used_copilot_app: z.boolean().optional(),
    used_copilot_cloud_agent: z.boolean().optional(),
    totals_by_ide: z.array(byIde).optional(),
    totals_by_feature: z.array(byFeature).optional(),
    totals_by_language_feature: z.array(byLanguageFeature).optional(),
    totals_by_language_model: z.array(byLanguageModel).optional(),
    totals_by_model_feature: z.array(byModelFeature).optional(),
  })
  .passthrough();

export type UserReportRow = z.infer<typeof userReportRowSchema>;

/** 1 件を検証する。失敗時は値を含まない理由 (フィールドパスとメッセージ) を返す */
export function validateUserReportRow(
  raw: unknown
): { ok: true; row: UserReportRow } | { ok: false; reason: string } {
  const parsed = userReportRowSchema.safeParse(raw);
  if (parsed.success) return { ok: true, row: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, reason: `${issue.path.join('.') || '(row)'}: ${issue.message}`.slice(0, 120) };
}
