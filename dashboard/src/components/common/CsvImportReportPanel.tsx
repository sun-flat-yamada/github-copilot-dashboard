import React from 'react';
import type { CsvImportReport } from '../../../../src/domain/entities/csv-import';
import { csvUnitLabel } from '../../../../src/processor/csv-import-report-format';

interface CsvImportReportPanelProps {
  report: CsvImportReport;
}

const fmt = (v: number | null, digits = 2): string =>
  v === null ? '—（値なし）' : v.toLocaleString('en-US', { maximumFractionDigits: digits });

/**
 * CSV 取込レポート (P1-5)。認識した列・未認識の列・スキップした行・単位別の合計を取込時に見せる。
 * 単位の異なる値は合算せず、行を分けて表示する。値の個別内容 (ユーザー名など) は表示しない。
 */
export const CsvImportReportPanel: React.FC<CsvImportReportPanelProps> = ({ report }) => {
  const { rows, columns, totals_by_unit: totals } = report;
  return (
    <div
      className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-300 space-y-1.5"
      data-testid="csv-import-report"
    >
      <p className="font-semibold text-slate-200">
        取込レポート{report.profile ? `: ${report.profile.label}` : ''}
      </p>
      <p data-testid="csv-import-report-rows">
        {rows.imported}/{rows.total} 行を取り込みました
        {rows.skipped > 0 ? `（${rows.skipped} 行をスキップ）` : ''}
      </p>
      {rows.skipped > 0 && (
        <ul className="list-disc pl-4 text-amber-300" data-testid="csv-import-report-skipped">
          {Object.entries(rows.skipped_by_reason).map(([reason, count]) => (
            <li key={reason}>
              {reason}: {count} 行
            </li>
          ))}
          {rows.skipped_samples.length > 0 && (
            <li className="list-none text-slate-400">
              例: {rows.skipped_samples.map((s) => `データ行 ${s.row}`).join('、')}
            </li>
          )}
        </ul>
      )}
      {columns.unrecognized.length > 0 && (
        <p className="text-amber-300" data-testid="csv-import-report-unrecognized">
          未認識の列（集計に使っていません）: {columns.unrecognized.join('、')}
        </p>
      )}
      {totals.length > 0 && (
        <table className="w-full text-left" data-testid="csv-import-report-totals">
          <thead className="text-slate-400">
            <tr>
              <th className="font-normal pr-2">単位</th>
              <th className="font-normal pr-2">行</th>
              <th className="font-normal pr-2">数量</th>
              <th className="font-normal pr-2">gross (USD)</th>
              <th className="font-normal">net (USD)</th>
            </tr>
          </thead>
          <tbody>
            {totals.map((t) => (
              <tr key={t.unit}>
                <td className="pr-2">{csvUnitLabel(t.unit)}</td>
                <td className="pr-2">{t.rows}</td>
                <td className="pr-2">{fmt(t.quantity, 4)}</td>
                <td className="pr-2">{fmt(t.gross_usd)}</td>
                <td>{fmt(t.net_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {report.warnings
        .filter((w) => !w.startsWith('未認識の列') && !w.endsWith('行をスキップしました'))
        .map((w) => (
          <p key={w} className="text-amber-300">
            ⚠ {w}
          </p>
        ))}
    </div>
  );
};
