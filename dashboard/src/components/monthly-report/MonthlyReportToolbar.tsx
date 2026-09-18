import React from 'react';
import { FileSpreadsheet, CheckCircle2, Upload } from 'lucide-react';
import { MonthlyReportAggregatedData } from '../../../../src/types/copilot';

interface MonthlyReportToolbarProps {
  reportData: MonthlyReportAggregatedData;
  availableReportMonths: string[];
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenDropzone: () => void;
}

export const MonthlyReportToolbar: React.FC<MonthlyReportToolbarProps> = ({
  reportData,
  availableReportMonths,
  selectedMonth,
  onSelectMonth,
  onOpenDropzone,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg backdrop-blur flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800/80 text-emerald-400">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white">対象月次レポート:</span>
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {availableReportMonths.map((m) => (
                <option key={m} value={m}>
                  {m} レポート
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2 mt-1 text-[11px] text-slate-400">
            <span>
              ソース: <strong className="text-slate-200">{reportData.file_name}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center space-x-1">
              {reportData.source_type === 'local_drop' ? (
                <span className="text-amber-400 font-medium">ローカル直接読込 (一時表示)</span>
              ) : (
                <span className="text-emerald-400 font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>copilot-data 格納済み</span>
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={onOpenDropzone}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition shadow"
        >
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span>手元の CSV を解析 / ドロップ</span>
        </button>
      </div>
    </div>
  );
};
