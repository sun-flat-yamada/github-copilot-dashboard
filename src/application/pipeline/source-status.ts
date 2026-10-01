import { DataSourceId, IndexMetadata, SourceStatus } from '../../domain/entities/copilot.js';

/** 取得できたソース (新しい成果物を作ってよい) */
export function isSourceUsable(status: SourceStatus | undefined): boolean {
  return status?.status === 'ok' || status?.status === 'partial';
}

/**
 * 前回の index.json が source_status を持たない旧形式のとき、成果物の有無から
 * 「前回はそのソースが成功していた」ことを推定する。
 */
function inferLegacyLastSuccess(source: DataSourceId, previous: IndexMetadata | null): string | null {
  if (!previous || previous.source_status) return null;
  if (source === 'metrics' && (previous.available_days?.length ?? 0) > 0) return previous.generated_at;
  if (source === 'seats' && (previous.summary?.total_seats ?? 0) > 0) return previous.generated_at;
  return null;
}

/**
 * データソースが報告した取得状態に、前回の成功時刻 (last_success_at) を引き継ぐ。
 * 失敗・対象外のソースは、前回の成功時刻を保持することで
 * 「最終成功: ○○」を画面に出せるようにする。
 */
export function resolveSourceStatuses(
  reported: SourceStatus[],
  previous: IndexMetadata | null
): SourceStatus[] {
  const previousBySource = new Map((previous?.source_status ?? []).map((s) => [s.source, s]));

  return reported.map((status) => {
    if (isSourceUsable(status)) return status;
    const lastSuccess =
      previousBySource.get(status.source)?.last_success_at ?? inferLegacyLastSuccess(status.source, previous);
    return { ...status, last_success_at: lastSuccess };
  });
}

/**
 * データソースが状態を報告しなかった場合の補完 (取得できたレコードがあれば ok、無ければ対象外)。
 */
export function statusOrInferred(
  statuses: SourceStatus[],
  source: DataSourceId,
  recordCount: number,
  nowIso: string
): SourceStatus {
  const found = statuses.find((s) => s.source === source);
  if (found) return found;
  return {
    source,
    status: recordCount > 0 ? 'ok' : 'skipped',
    records: recordCount,
    last_attempt_at: nowIso,
    last_success_at: recordCount > 0 ? nowIso : null,
  };
}
