/**
 * Metric Registry (P2-3 / D-01)
 *
 * 指標の ID・ラベル・単位・窓・フィルター可否・出典・品質属性を 1 箇所で宣言する。
 * UI はこの定義を共有し、値に品質属性を付けて表示する (推定値と実測値を同じ見た目にしない)。
 * 指標カタログ v1 (定義・窓・出典の全面表示) は P3-1 で拡張する。
 */

/** 値の品質属性。measured=実測 / estimated=推定 / missing=欠損 / demo=デモ (架空データ) */
export type MetricQuality = 'measured' | 'estimated' | 'missing' | 'demo';

export type MetricUnit = 'usd' | 'ratio' | 'count' | 'seats';

export type MetricWindow = 'scope' | 'point_in_time';

export interface MetricDefinition {
  id: string;
  label: { ja: string; en: string };
  unit: MetricUnit;
  /** scope: 選択したスコープ (日次 / 月次 / 期間) の窓、point_in_time: 時点値 */
  window: MetricWindow;
  /** フィルター (組織・コストセンター・グループ・タグ・ユーザー) で再集計されるか */
  filterable: boolean;
  /** 出典 (データセット / API) */
  sources: string[];
  /** 値が存在するときの既定の品質属性 */
  defaultQuality: Exclude<MetricQuality, 'missing' | 'demo'>;
}

export const METRIC_REGISTRY = {
  total_spend: {
    id: 'total_spend',
    label: { ja: '利用費用', en: 'Total spend' },
    unit: 'usd',
    window: 'scope',
    filterable: true,
    sources: ['seats', 'pricing catalog'],
    defaultQuality: 'measured',
  },
  active_rate: {
    id: 'active_rate',
    label: { ja: 'アクティブ利用率', en: 'Active seat rate' },
    unit: 'ratio',
    window: 'scope',
    filterable: true,
    sources: ['seats'],
    defaultQuality: 'measured',
  },
  idle_waste: {
    id: 'idle_waste',
    label: { ja: '遊休コスト (削減可能)', en: 'Idle cost (potential savings)' },
    unit: 'usd',
    window: 'scope',
    filterable: true,
    sources: ['seats', 'pricing catalog'],
    // 遊休判定の基準に基づく見込み額であり、確定した削減額ではない
    defaultQuality: 'estimated',
  },
  acceptance_rate: {
    id: 'acceptance_rate',
    label: { ja: 'Inline補完受諾率', en: 'Inline completion acceptance rate' },
    unit: 'ratio',
    window: 'scope',
    filterable: false,
    sources: ['metrics'],
    defaultQuality: 'measured',
  },
} as const satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRIC_REGISTRY;

/** 品質属性ごとの表示規約 */
export const QUALITY_PRESENTATION: Record<MetricQuality, { badge: string | null; description: string }> = {
  measured: { badge: null, description: '実測値' },
  estimated: { badge: '推定', description: '実測ではなく、基準や単価から算定した見込み値です' },
  missing: { badge: '欠損', description: '値を取得できていません' },
  demo: { badge: 'デモ', description: '架空のデモデータです (実データではありません)' },
};

/** 品質属性付きの値。欠損は null で表し、0 や定数で埋めない */
export interface QualifiedValue {
  metricId: MetricId;
  value: number | null;
  quality: MetricQuality;
  /** 欠損・推定の理由 (欠損時は「—（理由）」として表示) */
  reason?: string;
}

export interface QualifyOptions {
  /** デモデータ由来か。実測・推定より優先して `demo` にする */
  isDemo?: boolean;
  /** 欠損の理由 */
  missingReason?: string;
  /** 推定の理由 (省略時は定義の既定) */
  estimatedReason?: string;
}

/**
 * 値に品質属性を付ける。優先順位: 欠損 > デモ > 定義の既定 (実測 / 推定)。
 * 欠損はデモ由来でも「欠損」とする (値が無いことを隠さない)。
 */
export function qualify(
  metricId: MetricId,
  value: number | null | undefined,
  options: QualifyOptions = {}
): QualifiedValue {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { metricId, value: null, quality: 'missing', reason: options.missingReason ?? '値を取得できていません' };
  }
  if (options.isDemo) {
    return { metricId, value, quality: 'demo', reason: QUALITY_PRESENTATION.demo.description };
  }
  const quality = METRIC_REGISTRY[metricId].defaultQuality;
  return {
    metricId,
    value,
    quality,
    reason: quality === 'estimated' ? options.estimatedReason ?? QUALITY_PRESENTATION.estimated.description : undefined,
  };
}
