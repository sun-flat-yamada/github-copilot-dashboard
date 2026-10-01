/**
 * 「未割当」を表すラベルとフィルター用センチネルの単一ソース。
 *
 * パイプラインは経路ごとに異なる未割当ラベルを出力する (Default-CostCenter / Unassigned-CC /
 * 未分類 (Unassigned) / Default-Org など) 一方、フィルターは '' / 'Unassigned' / '未設定' しか
 * 認識していなかったため、「未割当」フィルターがパイプラインの値に一致せず常に 0 件になっていた。
 * 出力側 (パイプライン) と判定側 (フィルター) の双方がこの定数を参照することで、ずれを防ぐ。
 */

/** FilterCriteria で「未割当のみ」を表すセンチネル値 */
export const UNASSIGNED_FILTER_SENTINEL = '__unassigned__';

/** 既定の未割当ラベル (パイプラインが出力する値) */
export const UNASSIGNED_LABELS = {
  /** ユーザー定義 Gr (部署) 未設定 */
  department: '未分類 (Unassigned)',
  /** Cost Center 未紐付け (ライブ収集) */
  costCenter: 'Default-CostCenter',
  /** Cost Center 未紐付け (月次レポート) */
  reportCostCenter: 'Unassigned-CC',
  /** Organization 未設定 */
  organization: 'Default-Org',
} as const;

/** 未割当として扱う値の集合 (空文字・汎用表記・パイプライン出力の既定ラベルを含む) */
export const UNASSIGNED_VALUES: ReadonlySet<string> = new Set<string>([
  '',
  'Unassigned',
  '未設定',
  'その他',
  UNASSIGNED_LABELS.department,
  UNASSIGNED_LABELS.costCenter,
  UNASSIGNED_LABELS.reportCostCenter,
  UNASSIGNED_LABELS.organization,
]);

/** 値が「未割当」かどうか (前後の空白は無視、大文字小文字は区別しない) */
export function isUnassignedValue(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  if (UNASSIGNED_VALUES.has(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  for (const known of UNASSIGNED_VALUES) {
    if (known.toLowerCase() === lower) return true;
  }
  return false;
}
