import { z } from 'zod';

/**
 * Billing「AI credit usage」レポート (GET /enterprises/{enterprise}/settings/billing/ai_credit/usage) の応答。
 *
 * 出典: GitHub REST API description (ghec.2022-11-28.json, raw.githubusercontent.com/github/rest-api-description)。
 * クエリ: year / month / day (整数)、organization / user / model / product / cost_center_id。
 * ページングも署名付き URL も無い (1 回の応答に usageItems が入る)。過去 24 か月まで取得できる。
 * 権限: Enterprise の管理者・Billing manager 等。
 *
 * - 未知のフィールドは捨てずに保持する (.passthrough)。
 * - 数量・金額は有限の数。**負数は許容する** (割引・調整行が負になりうるため)。
 * - 通貨は応答に無い。金額は GitHub の請求単位のまま扱い、通貨を断定しない。
 */
const num = z.number().finite();

export const aiCreditUsageItemSchema = z
  .object({
    product: z.string(),
    sku: z.string().min(1),
    model: z.string(),
    unitType: z.string(),
    pricePerUnit: num,
    grossQuantity: num,
    grossAmount: num,
    discountQuantity: num,
    discountAmount: num,
    netQuantity: num,
    netAmount: num,
  })
  .passthrough();

export type AiCreditUsageItem = z.infer<typeof aiCreditUsageItemSchema>;

/** 本体。usageItems は 1 件ずつ検証するため、ここでは unknown の配列で受ける */
export const aiCreditUsageResponseSchema = z
  .object({
    timePeriod: z
      .object({ year: z.number().int(), month: z.number().int().optional(), day: z.number().int().optional() })
      .passthrough(),
    enterprise: z.string().optional(),
    usageItems: z.array(z.unknown()),
  })
  .passthrough();

export type AiCreditUsageResponse = z.infer<typeof aiCreditUsageResponseSchema>;

/** 1 件の検証。失敗時は値を含まない理由 (フィールドパスとメッセージ) を返す */
export function validateAiCreditUsageItem(
  raw: unknown
): { ok: true; item: AiCreditUsageItem } | { ok: false; reason: string } {
  const parsed = aiCreditUsageItemSchema.safeParse(raw);
  if (parsed.success) return { ok: true, item: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, reason: `${issue.path.join('.') || '(item)'}: ${issue.message}`.slice(0, 120) };
}
