import React from 'react';
import type { FigureDiff, MonthCloseIndex, MonthCloseRecord } from '../../../src/domain/entities/month-close';
import { loadMonthCloseIndexDataset, loadMonthCloseRecordDataset, type DatasetResult } from '../dataset/datasetLoader';
import { formatTimestamp } from './AuditDataQualityPanel';

/**
 * 月次締めと改訂履歴 (P4-2 / E-01)。締め日・確定日時・チェックサム、締め後の改訂 (理由・実行 ID・時刻) と、
 * 確定版と改訂版の差分を表示する。数値・日付・チェックサムのみで、個人情報は含まない。
 */

/** 履歴・差分を取得する月の最大数 (新しい月から) */
export const CLOSE_DETAIL_LIMIT = 12;

const FIGURE_LABEL: Record<string, string> = {
  'monthly.overview.total_spend_usd': '利用費用 (USD)',
  'monthly.overview.total_seats': 'シート数',
  'monthly.overview.active_users': '利用中シート',
  'monthly.overview.idle_seats': '遊休シート',
  'monthly.overview.idle_waste_usd': '遊休の費用 (USD)',
  'monthly.overview.total_net_billable_usd': '請求対象額 (USD)',
  'monthly.overview.overall_acceptance_rate': '受諾率',
  'monthly.overview.total_chats': 'チャット数',
  'monthly.ai_credits_used': 'AI クレジット使用量',
  'report.overview.total_net_spend_usd': 'レポート 純額 (USD)',
  'report.overview.total_gross_spend_usd': 'レポート 総額 (USD)',
  'report.overview.total_requests': 'レポート リクエスト数',
};

export function figureLabel(key: string): string {
  return FIGURE_LABEL[key] ?? key;
}

export function formatFigure(v: number | null): string {
  return v === null ? '—' : v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export interface CloseRevisionRow {
  version: number;
  at: string;
  reason: string;
  actor: string;
  runId: string;
  diff: FigureDiff[];
}

export interface CloseRow {
  month: string;
  closesOn: string;
  closedAt: string;
  checksum: string;
  revisionCount: number;
  lastRevisedAt: string;
  revisions: CloseRevisionRow[];
  /** この月の履歴 (JSON) を取得できなかった理由。取得できたら null */
  detailError: string | null;
}

export interface CloseModel {
  rows: CloseRow[];
}

/** 一覧と各月の記録から表示モデルを作る純関数 (新しい月が先頭)。改訂は新しい順 */
export function buildCloseModel(
  index: MonthCloseIndex | null,
  records: Record<string, MonthCloseRecord | undefined>,
  detailErrors: Record<string, string | undefined> = {}
): CloseModel {
  const rows = (index?.months ?? []).map((e): CloseRow => {
    const rec = records[e.month];
    const revisions = [...(rec?.revisions ?? [])]
      .reverse()
      .map((r) => ({
        version: r.version,
        at: formatTimestamp(r.at, '時刻の記録なし'),
        reason: r.reason,
        actor: r.actor ?? '—（実施者の記録なし）',
        runId: r.run_id ?? '—（実行 ID の記録なし）',
        diff: r.diff,
      }));
    return {
      month: e.month,
      closesOn: e.closes_on,
      closedAt: formatTimestamp(e.closed_at, '時刻の記録なし'),
      checksum: e.checksum,
      revisionCount: e.revision_count,
      lastRevisedAt: formatTimestamp(e.last_revised_at, '改訂なし'),
      revisions,
      detailError: e.revision_count > 0 && !rec ? detailErrors[e.month] ?? '履歴を取得できません' : null,
    };
  });
  return { rows };
}

interface PanelProps {
  index: MonthCloseIndex | null;
  indexError?: string | null;
  records?: Record<string, MonthCloseRecord | undefined>;
  detailErrors?: Record<string, string | undefined>;
  loading?: boolean;
}

const th = 'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400';
const td = 'px-3 py-2 text-xs text-slate-200 align-top';

export const AuditMonthClosePanel: React.FC<PanelProps> = ({ index, indexError, records = {}, detailErrors = {}, loading = false }) => {
  if (loading) {
    return <div className="p-4 text-center text-sm text-slate-400" data-testid="close-loading">月次締めの情報を読み込み中です</div>;
  }
  const model = buildCloseModel(index, records, detailErrors);
  const reason = indexError
    ? `月次締めの一覧 (closes/index.json) を取得できません (${indexError})`
    : '締め済みの月がありません (締め日 = 翌月の第 5 営業日 を迎えた月から、収集の実行時に確定します)';

  return (
    <section aria-labelledby="close-h" className="space-y-3" data-testid="audit-month-close">
      <header>
        <h3 id="close-h" className="text-sm font-bold text-slate-200">月次締めと改訂履歴</h3>
        <p className="mt-1 text-xs text-slate-400">
          締め日に確定した数値はチェックサム付きで保存され、締め後の変更は理由・実行 ID・時刻とともに改訂として残ります (元の確定値は消えません)。
        </p>
      </header>
      {model.rows.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-center text-slate-400" data-testid="close-unavailable">
          <p className="text-sm font-semibold text-slate-300">— 月次締めを表示できません</p>
          <p className="mt-1 text-xs text-slate-500">{reason}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800" data-testid="close-table">
            <caption className="sr-only">月ごとの締め日・確定日時・チェックサム・改訂回数</caption>
            <thead className="bg-slate-900">
              <tr>
                <th scope="col" className={th}>月</th>
                <th scope="col" className={th}>締め日</th>
                <th scope="col" className={th}>確定日時</th>
                <th scope="col" className={th}>チェックサム (SHA-256)</th>
                <th scope="col" className={th}>改訂</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {model.rows.map((r) => (
                <tr key={r.month} data-testid={`close-row-${r.month}`}>
                  <th scope="row" className={`${td} font-semibold`}>{r.month}</th>
                  <td className={td}>{r.closesOn}</td>
                  <td className={td}>{r.closedAt}</td>
                  <td className={`${td} font-mono`} title={r.checksum}>{r.checksum.slice(0, 16)}…</td>
                  <td className={td}>
                    {r.revisionCount === 0 ? (
                      '未改訂'
                    ) : (
                      <details data-testid={`close-revisions-${r.month}`}>
                        <summary className="cursor-pointer font-semibold text-amber-300">
                          改訂 {r.revisionCount} 回 (最終 {r.lastRevisedAt})
                        </summary>
                        {r.detailError && <p className="mt-1 text-slate-400">—（{r.detailError}）</p>}
                        {r.revisions.map((rev) => (
                          <div key={rev.version} className="mt-2 rounded border border-slate-800 p-2" data-testid="close-revision">
                            <p className="font-semibold">版 {rev.version}: {rev.reason}</p>
                            <p className="text-slate-400">{rev.at} / 実行 {rev.runId} / 実施者 {rev.actor}</p>
                            <table className="mt-1 min-w-full" data-testid="close-diff-table">
                              <caption className="sr-only">版 {rev.version} の差分 (直前の版との比較)</caption>
                              <thead>
                                <tr>
                                  <th scope="col" className={th}>項目</th>
                                  <th scope="col" className={th}>改訂前</th>
                                  <th scope="col" className={th}>改訂後</th>
                                  <th scope="col" className={th}>差</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rev.diff.map((d) => (
                                  <tr key={d.key}>
                                    <th scope="row" className={td} title={d.key}>{figureLabel(d.key)}</th>
                                    <td className={td}>{formatFigure(d.before)}</td>
                                    <td className={td}>{formatFigure(d.after)}</td>
                                    <td className={td}>{d.delta === null ? '—' : `${d.delta > 0 ? '+' : ''}${formatFigure(d.delta)}`}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/** 一覧と、改訂のある月の記録を取得して表示する。取得失敗は理由つきで表示する */
export const AuditMonthCloseSection: React.FC<{ baseDir: string }> = ({ baseDir }) => {
  const [index, setIndex] = React.useState<DatasetResult<MonthCloseIndex> | null>(null);
  const [records, setRecords] = React.useState<Record<string, MonthCloseRecord | undefined>>({});
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});
  React.useEffect(() => {
    let cancelled = false;
    setIndex(null);
    setRecords({});
    setErrors({});
    loadMonthCloseIndexDataset(baseDir).then(async (r) => {
      if (cancelled) return;
      setIndex(r);
      const revised = (r.data?.months ?? []).filter((m) => m.revision_count > 0).slice(0, CLOSE_DETAIL_LIMIT);
      const loaded = await Promise.all(revised.map((m) => loadMonthCloseRecordDataset(baseDir, m.month)));
      if (cancelled) return;
      const recs: Record<string, MonthCloseRecord | undefined> = {};
      const errs: Record<string, string | undefined> = {};
      loaded.forEach((d, i) => {
        if (d.data) recs[revised[i].month] = d.data;
        else errs[revised[i].month] = d.error ?? undefined;
      });
      setRecords(recs);
      setErrors(errs);
    });
    return () => {
      cancelled = true;
    };
  }, [baseDir]);
  return <AuditMonthClosePanel index={index?.data ?? null} indexError={index?.error ?? null} records={records} detailErrors={errors} loading={index === null} />;
};
