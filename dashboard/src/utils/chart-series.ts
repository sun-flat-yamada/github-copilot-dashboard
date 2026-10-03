/**
 * チャート用の純関数 (P3-3 / D-03)。
 * 多数グループを「値の降順 上位 N + その他」へ集約する。描画から分離してテスト可能にする。
 */
export interface RankedItem<T = unknown> {
  name: string;
  value: number;
  /** 全体 (表示対象の合計) に対する割合 (0-1) */
  share: number;
  /** 「その他」へ集約された行か */
  isOther: boolean;
  /** 「その他」に含まれる元の件数 (通常行は 1) */
  count: number;
  /** 元の行 (「その他」は null) */
  source: T | null;
}

export const OTHER_LABEL = 'その他';

export function rankWithOther<T>(
  items: readonly T[],
  pick: (item: T) => { name: string; value: number },
  topN = 8
): RankedItem<T>[] {
  const limit = Math.max(1, Math.floor(topN));
  const rows = items
    .map((source) => ({ source, ...pick(source) }))
    // 0 以下・非有限値 (欠損) は棒にしない
    .filter((r) => Number.isFinite(r.value) && r.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const share = (v: number) => (total > 0 ? v / total : 0);

  // 「その他」1 行は、上位 N に収まるなら畳まない (1 件のために行を潰さない)
  const head = rows.length <= limit + 1 ? rows : rows.slice(0, limit);
  const tail = rows.length <= limit + 1 ? [] : rows.slice(limit);

  const result: RankedItem<T>[] = head.map((r) => ({
    name: r.name,
    value: r.value,
    share: share(r.value),
    isOther: false,
    count: 1,
    source: r.source,
  }));
  if (tail.length > 0) {
    const value = tail.reduce((sum, r) => sum + r.value, 0);
    result.push({ name: `${OTHER_LABEL} (${tail.length} 件)`, value, share: share(value), isOther: true, count: tail.length, source: null });
  }
  return result;
}
