import React from 'react';
import type { DataSourceId, IndexMetadata, SourceFetchStatus } from '../../../src/types/copilot';
import type { DataQualityHistory, DataQualityLevel, DataQualityReport } from '../../../src/domain/entities/data-quality';
import { loadIndexDataset, loadQualityHistoryDataset, type DatasetResult } from '../dataset/datasetLoader';

/**
 * 「監査・データ品質」ビュー (P4-1 / E-01)。
 * 実行履歴・ソース別状態・品質チェック履歴を、件数・日付・ソース名だけで表示する (個人情報を含めない)。
 * Run Manifest 本体 (raw/landing) は公開しないため、公開済みの quality/history.json と index.json を読む。
 */

export const SOURCE_LABEL: Record<DataSourceId, string> = {
  metrics: '利用メトリクス (Reports API)',
  seats: 'シート',
  cost_centers: 'Cost Center',
  ai_credits: 'AI Credits (課金)',
};

export const STATUS_LABEL: Record<SourceFetchStatus, string> = {
  ok: '成功',
  partial: '一部のみ',
  failed: '失敗',
  skipped: '対象外',
};

export const LEVEL_LABEL: Record<DataQualityLevel, string> = {
  ok: '正常',
  warning: '警告',
  error: '異常',
};

const STATUS_STYLE: Record<SourceFetchStatus, string> = {
  ok: 'text-emerald-300',
  partial: 'text-amber-300',
  failed: 'text-rose-300',
  skipped: 'text-slate-400',
};

const LEVEL_STYLE: Record<DataQualityLevel, string> = {
  ok: 'text-emerald-300',
  warning: 'text-amber-300',
  error: 'text-rose-300',
};

/** 履歴テーブルに出す最大件数 (新しい順)。履歴ファイル自体は最大 90 件 */
export const AUDIT_RUN_DISPLAY_LIMIT = 30;
const MISSING_DAYS_PREVIEW = 5;

/** `2026-10-03T04:15:00.000Z` を `2026-10-03 04:15 UTC` にする。解釈できない値はそのまま返す */
export function formatTimestamp(iso: string | null | undefined, emptyReason: string): string {
  if (!iso) return `—（${emptyReason}）`;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

export interface AuditSourceRow {
  source: DataSourceId;
  label: string;
  status: SourceFetchStatus;
  records: number;
  quarantined: number;
  lastAttemptAt: string;
  lastSuccessAt: string;
  error: string | null;
}

export interface AuditRunRow {
  key: string;
  runId: string;
  generatedAt: string;
  level: DataQualityLevel;
  sources: Array<{ source: DataSourceId; label: string; status: SourceFetchStatus }>;
  missingDaysCount: number;
  missingDaysText: string;
  duplicatesCollapsed: number;
  outOfRange: number;
  quarantined: number;
  malformedLines: number;
}

export interface AuditModel {
  sources: AuditSourceRow[];
  /** 全ソースのうち最も新しい成功時刻。無ければ「—（理由）」 */
  lastSuccessAt: string;
  /** 最新の品質レベル。無ければ null */
  latestLevel: DataQualityLevel | null;
  /** level が最後に変わった時刻 (悪化・回復の起点)。変化が無ければ「—（理由）」 */
  lastChangeAt: string;
  runs: AuditRunRow[];
  /** 履歴が保存されている総件数 (表示は新しい順に AUDIT_RUN_DISPLAY_LIMIT 件まで) */
  runTotal: number;
}

function missingDaysText(days: readonly string[]): string {
  if (days.length === 0) return 'なし';
  const head = days.slice(0, MISSING_DAYS_PREVIEW).join(', ');
  return days.length > MISSING_DAYS_PREVIEW ? `${head} ほか ${days.length - MISSING_DAYS_PREVIEW} 日` : head;
}

function toRunRow(r: DataQualityReport, i: number): AuditRunRow {
  return {
    key: `${r.run_id ?? 'no-run'}-${r.generated_at}-${i}`,
    runId: r.run_id ?? '—（実行 ID の記録なし）',
    generatedAt: formatTimestamp(r.generated_at, '時刻の記録なし'),
    level: r.level,
    sources: (r.sources ?? []).map((s) => ({ source: s.source, label: SOURCE_LABEL[s.source] ?? s.source, status: s.status })),
    missingDaysCount: (r.missing_days ?? []).length,
    missingDaysText: missingDaysText(r.missing_days ?? []),
    duplicatesCollapsed: r.duplicates_collapsed ?? 0,
    outOfRange: r.out_of_range ?? 0,
    quarantined: r.quarantined ?? 0,
    malformedLines: r.malformed_lines ?? 0,
  };
}

/** index.json と品質履歴から表示用モデルを作る純関数。入力が無いときは空の配列と「—（理由）」を返す */
export function buildAuditModel(index: IndexMetadata | null, history: DataQualityHistory | null): AuditModel {
  const sources: AuditSourceRow[] = (index?.source_status ?? []).map((s) => ({
    source: s.source,
    label: SOURCE_LABEL[s.source] ?? s.source,
    status: s.status,
    records: s.records,
    quarantined: s.quarantined ?? 0,
    lastAttemptAt: formatTimestamp(s.last_attempt_at, '試行の記録なし'),
    lastSuccessAt: formatTimestamp(s.last_success_at, '成功した記録なし'),
    error: s.error ?? null,
  }));
  const successes = (index?.source_status ?? []).map((s) => s.last_success_at).filter((v): v is string => Boolean(v));
  const latestSuccess = successes.length > 0 ? successes.reduce((a, b) => (a > b ? a : b)) : null;

  const entries = history?.entries ?? [];
  const ordered = [...entries].reverse();
  return {
    sources,
    lastSuccessAt: formatTimestamp(latestSuccess, index ? '成功したソースがありません' : 'index.json を取得できません'),
    latestLevel: index?.data_quality?.level ?? ordered[0]?.level ?? null,
    lastChangeAt: formatTimestamp(index?.data_quality?.last_change_at ?? null, '品質レベルの変化はありません'),
    runs: ordered.slice(0, AUDIT_RUN_DISPLAY_LIMIT).map(toRunRow),
    runTotal: entries.length,
  };
}

interface AuditPanelProps {
  index: IndexMetadata | null;
  indexError?: string | null;
  history: DataQualityHistory | null;
  historyError?: string | null;
  isDemo?: boolean;
  loading?: boolean;
}

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const td = 'px-3 py-2 text-xs text-slate-200 align-top';

function Unavailable({ id, title, reason }: { id: string; title: string; reason: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-center text-slate-400" data-testid={id}>
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{reason}</p>
    </div>
  );
}

export const AuditDataQualityPanel: React.FC<AuditPanelProps> = ({ index, indexError, history, historyError, isDemo = false, loading = false }) => {
  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-400" data-testid="audit-loading">監査情報を読み込み中です</div>;
  }
  const model = buildAuditModel(index, history);
  const sourceReason = indexError
    ? `index.json を取得できません (${indexError})`
    : index
    ? 'このデータにはソース別の取得状態がありません (旧形式。次回の収集後に表示されます)'
    : 'index.json を取得できません';
  const runReason = historyError
    ? isDemo
      ? 'デモデータには実行履歴がありません (モックの収集は履歴を記録しません)'
      : `品質履歴 (quality/history.json) を取得できません (${historyError})`
    : '品質履歴が空です (実データの収集後に表示されます)';

  return (
    <div className="space-y-6" data-testid="audit-data-quality">
      <header>
        <h2 className="text-lg font-bold text-slate-100">監査・データ品質</h2>
        <p className="mt-1 text-xs text-slate-400">
          収集の実行履歴・ソース別の状態・品質チェックの履歴です。件数・日付・ソース名のみで、個人情報は含みません。
        </p>
        {isDemo && <p className="mt-1 text-xs text-amber-300" data-testid="audit-demo">デモデータ (架空の値) です。</p>}
      </header>

      <section aria-labelledby="audit-summary-h" className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="audit-summary">
        <h3 id="audit-summary-h" className="sr-only">サマリー</h3>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-[11px] text-slate-400">最終成功時刻</p>
          <p className="mt-1 text-sm font-semibold text-slate-100" data-testid="audit-last-success">{model.lastSuccessAt}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-[11px] text-slate-400">最新の品質レベル</p>
          <p className={`mt-1 text-sm font-semibold ${model.latestLevel ? LEVEL_STYLE[model.latestLevel] : 'text-slate-400'}`} data-testid="audit-latest-level">
            {model.latestLevel ? LEVEL_LABEL[model.latestLevel] : '—（品質の記録がありません）'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-[11px] text-slate-400">品質レベルが変わった時刻</p>
          <p className="mt-1 text-sm font-semibold text-slate-100" data-testid="audit-last-change">{model.lastChangeAt}</p>
        </div>
      </section>

      <section aria-labelledby="audit-sources-h">
        <h3 id="audit-sources-h" className="mb-2 text-sm font-bold text-slate-200">ソース別の状態</h3>
        {model.sources.length === 0 ? (
          <Unavailable id="audit-sources-unavailable" title="— ソース別の状態を表示できません" reason={sourceReason} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800" data-testid="audit-sources-table">
              <caption className="sr-only">データソースごとの最新の取得状態</caption>
              <thead className="bg-slate-900">
                <tr>
                  <th scope="col" className={th}>ソース</th>
                  <th scope="col" className={th}>状態</th>
                  <th scope="col" className={th}>取得件数</th>
                  <th scope="col" className={th}>隔離</th>
                  <th scope="col" className={th}>最終試行</th>
                  <th scope="col" className={th}>最終成功</th>
                  <th scope="col" className={th}>理由</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {model.sources.map((s) => (
                  <tr key={s.source} data-testid={`audit-source-${s.source}`}>
                    <th scope="row" className={`${td} font-semibold`}>{s.label}</th>
                    <td className={`${td} font-semibold ${STATUS_STYLE[s.status]}`}>{STATUS_LABEL[s.status]}</td>
                    <td className={td}>{s.records.toLocaleString()}</td>
                    <td className={td}>{s.quarantined.toLocaleString()}</td>
                    <td className={td}>{s.lastAttemptAt}</td>
                    <td className={td}>{s.lastSuccessAt}</td>
                    <td className={td}>{s.error ?? (s.status === 'ok' ? '—' : '—（理由の記録なし）')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="audit-runs-h">
        <h3 id="audit-runs-h" className="mb-2 text-sm font-bold text-slate-200">実行履歴と品質チェック</h3>
        {model.runs.length === 0 ? (
          <Unavailable id="audit-runs-unavailable" title="— 実行履歴を表示できません" reason={runReason} />
        ) : (
          <>
            <p className="mb-2 text-[11px] text-slate-500" data-testid="audit-runs-count">
              新しい順に {model.runs.length} 件 / 保存済み {model.runTotal} 件
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="min-w-full divide-y divide-slate-800" data-testid="audit-runs-table">
                <caption className="sr-only">収集の実行ごとのソース別ステータスと品質チェック結果</caption>
                <thead className="bg-slate-900">
                  <tr>
                    <th scope="col" className={th}>実行 ID</th>
                    <th scope="col" className={th}>時刻</th>
                    <th scope="col" className={th}>品質</th>
                    <th scope="col" className={th}>ソース別ステータス</th>
                    <th scope="col" className={th}>欠損日</th>
                    <th scope="col" className={th}>重複集約</th>
                    <th scope="col" className={th}>範囲外</th>
                    <th scope="col" className={th}>隔離</th>
                    <th scope="col" className={th}>不正行</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {model.runs.map((r) => (
                    <tr key={r.key} data-testid="audit-run-row">
                      <th scope="row" className={`${td} font-mono`}>{r.runId}</th>
                      <td className={td}>{r.generatedAt}</td>
                      <td className={`${td} font-semibold ${LEVEL_STYLE[r.level]}`}>{LEVEL_LABEL[r.level]}</td>
                      <td className={td}>
                        {r.sources.length === 0
                          ? '—（ソース別の記録なし）'
                          : r.sources.map((s) => (
                              <span key={s.source} className={`mr-2 inline-block ${STATUS_STYLE[s.status]}`}>
                                {s.label}: {STATUS_LABEL[s.status]}
                              </span>
                            ))}
                      </td>
                      <td className={td}>
                        {r.missingDaysCount > 0 ? `${r.missingDaysCount} 日 (${r.missingDaysText})` : r.missingDaysText}
                      </td>
                      <td className={td}>{r.duplicatesCollapsed.toLocaleString()}</td>
                      <td className={td}>{r.outOfRange.toLocaleString()}</td>
                      <td className={td}>{r.quarantined.toLocaleString()}</td>
                      <td className={td}>{r.malformedLines.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

interface AuditSectionProps {
  baseDir: string;
  isDemo?: boolean;
}

/** データセットを取得して表示する。取得失敗は理由つきで表示し、空の履歴や DEMO には置き換えない */
export const AuditDataQualitySection: React.FC<AuditSectionProps> = ({ baseDir, isDemo }) => {
  const [index, setIndex] = React.useState<DatasetResult<IndexMetadata> | null>(null);
  const [history, setHistory] = React.useState<DatasetResult<DataQualityHistory> | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setIndex(null);
    setHistory(null);
    loadIndexDataset(baseDir).then((r) => {
      if (!cancelled) setIndex(r);
    });
    loadQualityHistoryDataset(baseDir).then((r) => {
      if (!cancelled) setHistory(r);
    });
    return () => {
      cancelled = true;
    };
  }, [baseDir]);
  return (
    <AuditDataQualityPanel
      index={index?.data ?? null}
      indexError={index?.error ?? null}
      history={history?.data ?? null}
      historyError={history?.error ?? null}
      isDemo={Boolean(isDemo || index?.demoSourced || history?.demoSourced)}
      loading={index === null || history === null}
    />
  );
};
