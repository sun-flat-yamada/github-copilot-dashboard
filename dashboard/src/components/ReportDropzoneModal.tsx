import React, { useState, useRef } from 'react';
import { Upload, X, FileCheck, AlertCircle, ShieldCheck, Terminal } from 'lucide-react';
import { ReportParser } from '../../../src/processor/report-parser';
import { MonthlyReportAggregatedData } from '../../../src/types/copilot';

interface ReportDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportLoaded: (data: MonthlyReportAggregatedData) => void;
}

export const ReportDropzoneModal: React.FC<ReportDropzoneModalProps> = ({
  isOpen,
  onClose,
  onReportLoaded,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setErrorMsg('CSV形式 (.csv) のファイルを選択してください。');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new ReportParser();
        const records = parser.parseRecords(text);

        if (records.length === 0) {
          setErrorMsg('CSV 内から有効な Copilot 利用レコードが検出されませんでした。フォーマットを確認してください。');
          setLoading(false);
          return;
        }

        // 月の自動推測
        const dates = records.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        let guessedMonth = new Date().toISOString().substring(0, 7);
        if (dates.length > 0) {
          guessedMonth = dates.sort().reverse()[0].substring(0, 7);
        }

        const aggregated = parser.aggregate(records, guessedMonth, file.name, 'local_drop');
        onReportLoaded(aggregated);
        setLoading(false);
        onClose();
      } catch (err: any) {
        console.error('Failed to parse CSV client-side:', err);
        setErrorMsg(`解析エラー: ${err.message || 'CSVの処理に失敗しました'}`);
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('ファイルの読み込み中にエラーが発生しました。');
      setLoading(false);
    };

    reader.readAsText(file, 'utf-8');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Monthly Usage Report CSV の読み込み</h3>
              <p className="text-xs text-slate-400">GitHub Enterprise からエクスポートした CSV を即時解析</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ボディ */}
        <div className="p-6 space-y-5">
          {/* ドロップゾーン */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-950/20 scale-[0.99]'
                : 'border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-950/60'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
              accept=".csv,text/csv"
              className="hidden"
            />
            <div className="p-3 rounded-full bg-slate-800 text-slate-300 mb-3 shadow-inner">
              <FileCheck className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-slate-200 text-center">
              CSV ファイルをここにドラッグ＆ドロップ
            </p>
            <p className="text-xs text-slate-400 mt-1 text-center">
              または <span className="text-emerald-400 underline underline-offset-2">ファイルを選択</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-3">
              対応: Detailed Usage Report CSV / Copilot Activity Report CSV
            </p>
          </div>

          {/* ローディング状態 */}
          {loading && (
            <div className="flex items-center justify-center space-x-2 text-sm text-emerald-400 py-2">
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <span>ブラウザ内で CSV を高速解析中...</span>
            </div>
          )}

          {/* エラー表示 */}
          {errorMsg && (
            <div className="flex items-start space-x-2 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* セキュリティ・プライバシー保証 */}
          <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>ゼロ漏洩・完全クライアント完結 (Zero PII Leakage)</span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              投入された CSV はすべてブラウザ内のメモリで安全に解析されます。外部サーバーや Git リポジトリへの送信は一切行われません。
            </p>
          </div>

          {/* Fork-Safe 永続化ガイド */}
          <div className="bg-indigo-950/30 border border-indigo-900/50 rounded-xl p-3.5 space-y-1.5 text-xs text-indigo-200">
            <div className="flex items-center space-x-1.5 font-semibold text-indigo-300">
              <Terminal className="w-4 h-4" />
              <span>永続保存したい場合 (Fork-Safe Protocol)</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              月次レポートをリポジトリ内に保持して自動配信する場合は、ローカル端末で以下のコマンドを実行してください（`main` ブランチを汚さず `copilot-data` に安全格納されます）：
            </p>
            <div className="bg-slate-950 p-2 rounded-lg font-mono text-[11px] text-emerald-300 select-all border border-slate-800">
              npm run report:import -- &lt;path-to-csv&gt; &lt;YYYY-MM&gt; --push
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
