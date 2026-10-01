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

export type DataStatusLevel = 'demo' | 'error' | 'warning';

export interface DataStatusItem {
  /** 安定した識別子 (React key / テスト用) */
  id: string;
  level: DataStatusLevel;
  title: string;
  detail?: string;
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

  const order: Record<DataStatusLevel, number> = { error: 0, warning: 1, demo: 2 };
  return items.sort((a, b) => order[a.level] - order[b.level]);
}
