import { z } from 'zod';

/**
 * Cost Centers REST API (GET /enterprises/{enterprise}/settings/billing/cost-centers) のレコード。
 * 公開ドキュメント上のレスポンスは `{ "costCenters": [ { id, name, state, resources: [{ type, name }] } ] }`。
 * resources[].type は `User` / `Org` / `Repo` などで、将来の追加に備えて文字列のまま受け取り、
 * 正規化 (normalizers/cost-centers-2026-03-10.ts) で既知の種別へ寄せる。
 */
export const CostCenterResourceSchema = z.object({
  type: z.string(),
  name: z.string(),
}).passthrough();

export const EnterpriseCostCenterRawSchema = z.object({
  id: z.string(),
  name: z.string(),
  // 公開 API は cost_center_code を返さない。互換のため任意とする
  cost_center_code: z.string().nullish(),
  state: z.string().nullish(),
  resources: z.array(CostCenterResourceSchema).nullish().transform((v) => v ?? []),
}).passthrough();

export type EnterpriseCostCenterRaw = z.infer<typeof EnterpriseCostCenterRawSchema>;

/**
 * レスポンス本文から Cost Center の配列を取り出す。
 * 公開ドキュメントのキー `costCenters` と、旧実装が参照していた `cost_centers`、
 * および素の配列のいずれも受け付ける。
 */
export function pickCostCenterRecords(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.costCenters)) return obj.costCenters;
    if (Array.isArray(obj.cost_centers)) return obj.cost_centers;
  }
  return [];
}
