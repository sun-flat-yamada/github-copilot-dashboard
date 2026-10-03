import React from 'react';
import { Table2, BarChart3 } from 'lucide-react';

export interface ChartTableColumn {
  key: string;
  label: string;
}

interface AccessibleChartProps {
  /** データ表の caption / 要約の見出し */
  title: string;
  /** スクリーンリーダー向けの要約 (傾向・件数など。値の羅列ではなく読み取れる結論) */
  summary: string;
  columns: ChartTableColumn[];
  rows: Array<Record<string, React.ReactNode>>;
  testId: string;
  children?: React.ReactNode;
}

/**
 * Recharts 等の SVG チャートの a11y ラッパー (P3-3 / D-07)。
 * - グラフ本体は `role="img"` + 要約で読み上げ、詳細は「表で見る」切替のデータ表で提供する。
 * - 切替は `<button aria-pressed>`: キーボード (Tab / Enter / Space) で操作できる。
 */
export const AccessibleChart: React.FC<AccessibleChartProps> = ({ title, summary, columns, rows, testId, children }) => {
  const [showTable, setShowTable] = React.useState(false);
  const tableId = `${testId}-table`;
  return (
    <div data-testid={testId}>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          aria-controls={tableId}
          data-testid={`${testId}-toggle`}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer"
        >
          {showTable ? <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> : <Table2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {showTable ? 'グラフで見る' : '表で見る'}
        </button>
      </div>
      <div id={tableId}>
        {showTable ? (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <DataTable title={title} columns={columns} rows={rows} />
          </div>
        ) : (
          <div role="img" aria-label={`${title}。${summary}`} className="w-full">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};

export const DataTable: React.FC<{ title: string; columns: ChartTableColumn[]; rows: Array<Record<string, React.ReactNode>> }> = ({ title, columns, rows }) => (
  <table className="w-full text-xs text-left text-slate-200">
    <caption className="sr-only">{title} (データ表)</caption>
    <thead>
      <tr className="border-b border-slate-700 text-slate-300">
        {columns.map((c, i) => (
          <th key={c.key} scope="col" className={`py-1.5 pr-3 font-semibold ${i > 0 ? 'text-right' : ''}`}>
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((row, ri) => (
        <tr key={ri} className="border-b border-slate-800/80">
          {columns.map((c, i) =>
            i === 0 ? (
              <th key={c.key} scope="row" className="py-1.5 pr-3 font-medium text-slate-200">
                {row[c.key]}
              </th>
            ) : (
              <td key={c.key} className="py-1.5 pr-3 text-right font-mono">
                {row[c.key]}
              </td>
            )
          )}
        </tr>
      ))}
    </tbody>
  </table>
);
