/**
 * 利用実績のあったアカウントにおける統計値（最小値、中央値、最大値）の算出ユーティリティ
 */

export interface ActiveAccountStats {
  /** 利用実績 (値 > 0) のあったユニークアカウント数 */
  activeCount: number;
  /** 最小値（利用アカウントが 0 件の場合は null） */
  min: number | null;
  /** 中央値（利用アカウントが 0 件の場合は null） */
  median: number | null;
  /** 最大値（利用アカウントが 0 件の場合は null） */
  max: number | null;
}

/**
 * 渡された数値配列から、正の利用実績（値 > 0）があるアカウントの統計値を算出する。
 * 未利用アカウント（0 または無効値）は中央値・最小値の母集団から除外する。
 */
export function computeActiveAccountStats(
  values: (number | null | undefined)[]
): ActiveAccountStats {
  const active = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const count = active.length;
  if (count === 0) {
    return {
      activeCount: 0,
      min: null,
      median: null,
      max: null,
    };
  }

  const min = active[0];
  const max = active[count - 1];
  const mid = Math.floor(count / 2);
  const median =
    count % 2 === 1
      ? active[mid]
      : Number(((active[mid - 1] + active[mid]) / 2).toFixed(1));

  return {
    activeCount: count,
    min,
    median,
    max,
  };
}

/**
 * 統計値の表示用フォーマッタ。null の場合は '—' を返す。
 */
export function formatStatValue(
  val: number | null | undefined,
  unit?: string
): string {
  if (val === null || val === undefined) {
    return '—';
  }
  const formatted = val.toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}
