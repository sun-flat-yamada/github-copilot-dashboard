import React from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import { RankedItem } from '../../utils/chart-series';
import { DataTable } from './AccessibleChart';

interface RankedBarChartProps {
  title: string;
  rows: RankedItem[];
  /** 値の整形 (例: 通貨) */
  formatValue: (value: number) => string;
  /** 値の単位 (表の列見出し) */
  valueLabel: string;
  /** 行ごとの補足 (表の 3 列目以降ではなく、aria-label に追加する文) */
  describe?: (row: RankedItem) => string;
  testId: string;
}

/**
 * ソート済み横棒 (上位 N + その他)。多数グループのドーナツの置き換え (P3-3 / D-03)。
 * - 順位・名前・値・シェアを文字で常に表示し、色に依存しない。棒は単色で、「その他」は斜線パターン。
 * - 各行はキーボードフォーカス可能 (tabIndex=0) で、`aria-label` に名前・値・シェアを持つ。
 * - 「表で見る」切替でデータ表 (caption 付き) を表示する。
 */
export const RankedBarChart: React.FC<RankedBarChartProps> = ({ title, rows, formatValue, valueLabel, describe, testId }) => {
  const [showTable, setShowTable] = React.useState(false);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const listId = `${testId}-body`;
  const pct = (r: RankedItem) => `${(r.share * 100).toFixed(1)}%`;

  return (
    <div data-testid={testId}>
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-pressed={showTable}
          aria-controls={listId}
          data-testid={`${testId}-toggle`}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:text-white hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 cursor-pointer"
        >
          {showTable ? <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" /> : <Table2 className="w-3.5 h-3.5" aria-hidden="true" />}
          {showTable ? 'グラフで見る' : '表で見る'}
        </button>
      </div>
      <div id={listId}>
        {rows.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">— 表示できる値がありません（コストが 0 または未取得）</p>
        ) : showTable ? (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <DataTable
              title={title}
              columns={[
                { key: 'name', label: 'グループ' },
                { key: 'value', label: valueLabel },
                { key: 'share', label: 'シェア' },
              ]}
              rows={rows.map((r) => ({ name: r.name, value: formatValue(r.value), share: pct(r) }))}
            />
          </div>
        ) : (
          <ol aria-label={`${title} (降順)`} className="space-y-1.5">
            {rows.map((r, i) => {
              const label = `${r.name}: ${formatValue(r.value)}、シェア ${pct(r)}${describe ? `。${describe(r)}` : ''}`;
              return (
                <li
                  key={r.name}
                  tabIndex={0}
                  aria-label={label}
                  data-testid={`${testId}-row`}
                  data-other={r.isOther ? 'true' : undefined}
                  className="grid grid-cols-[minmax(5rem,10rem)_1fr_auto] items-center gap-2 text-xs rounded px-1 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 hover:bg-slate-800/60"
                >
                  <span className="text-slate-200 truncate font-medium" title={r.name}>
                    {r.isOther ? '' : `${i + 1}. `}
                    {r.name}
                  </span>
                  <span className="h-3.5 rounded-sm bg-slate-800/70 overflow-hidden" aria-hidden="true">
                    <span
                      className={`block h-full rounded-sm ${r.isOther ? 'bg-slate-500' : 'bg-sky-500'}`}
                      style={{
                        width: `${max > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`,
                        // 「その他」は色ではなく斜線で区別する
                        backgroundImage: r.isOther
                          ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 3px, transparent 3px 7px)'
                          : undefined,
                      }}
                    />
                  </span>
                  <span className="font-mono text-slate-200 text-right whitespace-nowrap">
                    {formatValue(r.value)} <span className="text-slate-400">({pct(r)})</span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
