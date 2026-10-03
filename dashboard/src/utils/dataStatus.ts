import type { DataQualitySummary } from '../../../src/domain/entities/data-quality';
import type {
  DataSourceId,
  DataSourceType,
  IndexMetadata,
  SourceStatus,
} from '../../../src/types/copilot';

/**
 * データが DEMO (MOCK_MODE で生成した架空データ) かどうか。
 *
 * 判定は「データ自身の宣言 (index.json の is_mock_mode: true)」と、明示的な環境変数
 * VITE_MOCK_MODE=true のみ。リポジトリ所有者名 (proud-corp 等)、シート数 0、データ日数 0 といった
 * 状態からのデモ推測はしない。取得失敗や未設定の実運用データが、黙ってデモ扱いに切り替わっていたため
 * (「取得失敗 ⇒ デモ表示」は、利用者が架空データを実データと誤認する最悪の失敗モード)。
 */
export function isMockModeData(indexMeta: IndexMetadata | null): boolean {
  if (indexMeta?.is_mock_mode === true) {
    return true;
  }
  return typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_MODE === 'true';
}

/** 画面に表示するソース名 */
export const SOURCE_FETCH_LABELS: Record<DataSourceId, string> = {
  metrics: '利用状況メトリクス',
  seats: 'シート割り当て',
  cost_centers: 'Cost Center',
};

export type DataStatusLevel = 'demo' | 'error' | 'warning' | 'info';

export interface DataStatusItem {
  /** 安定した識別子 (React key / テスト用) */
  id: string;
  level: DataStatusLevel;
  title: string;
  detail?: string;
  /** 補足の参照先 (例: データ品質の履歴)。配信ルートからの相対パス */
  link?: { path: string; label: string };
}

export interface DataStatusInput {
  indexMeta: IndexMetadata | null;
  activeSource: DataSourceType;
  /**
   * アクティブなデータが DEMO 由来か (useDashboardData の activeDataIsDemoSourced)。
   * 未取得のときは undefined。その場合は index.json の宣言 (isMockModeData) で判定する。
   */
  activeDataIsDemoSourced?: boolean;
}

/** アクティブなデータが DEMO か。ユーザーアップロードは常に実データ扱い */
export function resolveIsDemoData(input: DataStatusInput): boolean {
  if (input.activeSource === 'user_upload') return false;
  return input.activeDataIsDemoSourced !== undefined
    ? input.activeDataIsDemoSourced
    : isMockModeData(input.indexMeta);
}

/** ISO 8601 の日時を画面表示用 (UTC, 分単位) に整形する。解釈できない値は null */
export function formatStatusTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function describeSourceStatus(status: SourceStatus): DataStatusItem | null {
  const label = SOURCE_FETCH_LABELS[status.source] ?? status.source;

  if (status.status === 'failed') {
    const lastSuccess = formatStatusTimestamp(status.last_success_at);
    const consequence = lastSuccess
      ? `前回成功 (${lastSuccess}) のデータを表示しています。最新の値ではありません。`
      : '成功した取得が一度もないため、該当する値は「—（未取得）」と表示されます。';
    return {
      id: `source-failed-${status.source}`,
      level: 'error',
      title: `${label}の取得に失敗しました`,
      detail: status.error ? `${consequence} 原因: ${status.error}` : consequence,
    };
  }

  if (status.status === 'partial') {
    const quarantined = status.quarantined ?? 0;
    return {
      id: `source-partial-${status.source}`,
      level: 'warning',
      title: `${label}の一部を取得できませんでした`,
      detail:
        quarantined > 0
          ? `検証に失敗した ${quarantined} 件のレコードを集計から除外しています。`
          : status.error,
    };
  }

  // ok / skipped (設定が無く対象外。障害ではない) は表示しない
  return null;
}

const QUALITY_LEVEL_LABELS = { ok: '良好', warning: '注意', error: '異常' } as const;

/** 品質の悪化・回復を、起点の時刻付きで説明する */
function describeQualityChange(q: DataQualitySummary): string | null {
  const since = formatStatusTimestamp(q.last_change_at);
  const sinceText = since ? `${since} から` : '';
  if (q.trend === 'degraded') return `前回 (${QUALITY_LEVEL_LABELS[q.previous_level ?? 'ok']}) から悪化しました。`;
  if (q.trend === 'recovered') return `前回 (${QUALITY_LEVEL_LABELS[q.previous_level ?? 'ok']}) から回復しました。`;
  if (q.level !== 'ok' && since) return `${sinceText}この状態が続いています。`;
  return null;
}

/**
 * データ品質レポート (P1-7) の状態。品質が ok で変化が無いときは何も出さない。
 * 品質レポートが無いときは「—（理由）」で、情報が無いことを明示する (問題が無いとは言わない)。
 */
function describeDataQuality(indexMeta: IndexMetadata | null): DataStatusItem | null {
  const metrics = indexMeta?.source_status?.find((s) => s.source === 'metrics');
  const q = indexMeta?.data_quality;

  if (!q) {
    // 失敗は取得失敗のバナーが示す。対象外 (未設定) は品質を評価する対象が無い
    if (!metrics || metrics.status === 'skipped' || metrics.status === 'failed') return null;
    return {
      id: 'data-quality-unknown',
      level: 'info',
      title: 'データ品質: —（品質レポートがありません）',
      detail: 'この成果物は品質レポートの導入前に生成されたか、品質を評価できない実行で作られました。次回の収集から表示されます。',
    };
  }

  const link = { path: q.history_file, label: '品質の履歴 (JSON)' };
  const change = describeQualityChange(q);
  const counts = [
    q.missing_days_count > 0 ? `欠損日 ${q.missing_days_count} 日` : '',
    q.out_of_range > 0 ? `範囲外 ${q.out_of_range} 件` : '',
    q.quarantined > 0 ? `隔離 ${q.quarantined} 件` : '',
    q.malformed_lines > 0 ? `破損行 ${q.malformed_lines} 行` : '',
  ].filter(Boolean);

  if (q.level === 'ok') {
    if (q.trend !== 'recovered') return null;
    return {
      id: 'data-quality-recovered',
      level: 'info',
      title: 'データ品質: 回復しました',
      detail: change ?? undefined,
      link,
    };
  }

  return {
    id: 'data-quality',
    level: q.level === 'error' ? 'error' : 'warning',
    title: `データ品質: ${QUALITY_LEVEL_LABELS[q.level]}${counts.length ? ` (${counts.join('、')})` : ''}`,
    detail: change ?? '詳細は品質の履歴を参照してください。',
    link,
  };
}

/**
 * 画面最上部のデータ状態バナーに表示する項目を組み立てる。
 * - DEMO データを表示しているとき (実データと誤認させない)
 * - ライブ収集でソースの取得に失敗 / 一部失敗したとき (失敗を「0 件」「空」に見せない)
 * 失敗は error → warning → demo の順に並べる。
 */
export function buildDataStatusItems(input: DataStatusInput): DataStatusItem[] {
  const items: DataStatusItem[] = [];

  if (input.activeSource === 'live_metrics') {
    for (const status of input.indexMeta?.source_status ?? []) {
      const item = describeSourceStatus(status);
      if (item) items.push(item);
    }
    const quality = describeDataQuality(input.indexMeta);
    if (quality) items.push(quality);
  }

  if (resolveIsDemoData(input)) {
    items.push({
      id: 'demo-data',
      level: 'demo',
      title: 'デモ（架空）データを表示しています',
      detail:
        'この画面の数値はシミュレーション用に生成した架空のデータで、実際の利用状況・費用ではありません。',
    });
  }

  const order: Record<DataStatusLevel, number> = { error: 0, warning: 1, demo: 2, info: 3 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
