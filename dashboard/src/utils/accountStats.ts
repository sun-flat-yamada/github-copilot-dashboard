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

/**
 * 分布可視化用の階級（ビン）
 */
export interface DistributionBucket {
  /** 階級の下限値 */
  min: number;
  /** 階級の上限値 */
  max: number;
  /** 表示ラベル (例: "1 ~ 10" または "50") */
  label: string;
  /** 該当階級のアカウント数 */
  count: number;
  /** 全利用アカウントに対する比率 (%) */
  percentage: number;
}

/**
 * 正の利用実績（値 > 0）があるアカウントの数値を指定された個数の階級（ビン）に分割し、
 * 度数分布（ヒストグラム用データ）を算出する。
 */
export function computeDistributionBuckets(
  values: (number | null | undefined)[],
  bucketCount = 5
): DistributionBucket[] {
  const active = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  const total = active.length;
  if (total === 0 || bucketCount <= 0) {
    return [];
  }

  const min = active[0];
  const max = active[total - 1];

  // 全ての値が等しい場合は単一バケット
  if (min === max) {
    return [
      {
        min,
        max,
        label: min.toLocaleString(),
        count: total,
        percentage: 100,
      },
    ];
  }

  const step = (max - min) / bucketCount;
  const buckets: DistributionBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bMin = min + i * step;
    const isLast = i === bucketCount - 1;
    const bMax = isLast ? max : min + (i + 1) * step;

    // 該当する要素数をカウント
    const count = active.filter((v) => {
      if (isLast) {
        return v >= bMin && v <= bMax;
      }
      return v >= bMin && v < bMax;
    }).length;

    const roundMin = Math.round(bMin);
    const roundMax = Math.round(bMax);
    const label =
      roundMin === roundMax
        ? roundMin.toLocaleString()
        : `${roundMin.toLocaleString()} ~ ${roundMax.toLocaleString()}`;

    buckets.push({
      min: Number(bMin.toFixed(1)),
      max: Number(bMax.toFixed(1)),
      label,
      count,
      percentage: Number(((count / total) * 100).toFixed(1)),
    });
  }

  return buckets;
}
