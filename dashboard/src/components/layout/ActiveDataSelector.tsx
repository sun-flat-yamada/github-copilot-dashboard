import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  DataSourceType,
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
} from '../../../../src/types/copilot';
import { ReportParser } from '../../../../src/processor/report-parser';
import {
  Activity,
  FileSpreadsheet,
  Upload,
  Calendar,
  ChevronDown,
  Check,
  X,
  FileCheck,
  ShieldCheck,
  Clock,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface ActiveDataSelectorProps {
  activeSource: DataSourceType;
  onSelectSource: (source: DataSourceType) => void;
  // Live Metrics スコープ
  indexMeta: IndexMetadata | null;
  scopeType: AnalysisScopeType;
  selectedScopeKey: string;
  onSelectLiveScope: (type: AnalysisScopeType, key: string) => void;
  // Monthly Usage Report スコープ
  availableReports: string[];
  selectedReportMonth: string;
  onSelectReportMonth: (month: string) => void;
  // User Upload スコープ
  uploadedData: MonthlyReportAggregatedData | null;
  onUploadFileLoaded: (data: MonthlyReportAggregatedData) => void;
  onClearUploadedFile: () => void;
}

export const ActiveDataSelector: React.FC<ActiveDataSelectorProps> = ({
  activeSource,
  onSelectSource,
  indexMeta,
  scopeType,
  selectedScopeKey,
  onSelectLiveScope,
  availableReports,
  selectedReportMonth,
  onSelectReportMonth,
  uploadedData,
  onUploadFileLoaded,
  onClearUploadedFile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DataSourceType>(activeSource);

  // ドロップゾーン状態
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // モーダルが開かれた時に現在のアクティブソースにタブを合わせる
  useEffect(() => {
    if (isOpen) {
      setActiveTab(activeSource);
      setUploadError(null);
    }
  }, [isOpen, activeSource]);

  // ESCキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ファイル解析処理
  const handleFileProcess = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setUploadError('CSV形式 (.csv) のファイルを選択してください。');
      return;
    }

    setUploadLoading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parser = new ReportParser();
        const records = parser.parseRecords(text);

        if (records.length === 0) {
          setUploadError('CSV 内から有効な Copilot 利用レコードが検出されませんでした。');
          setUploadLoading(false);
          return;
        }

        const dates = records.map((r) => r.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
        let guessedMonth = new Date().toISOString().substring(0, 7);
        if (dates.length > 0) {
          guessedMonth = dates.sort().reverse()[0].substring(0, 7);
        }

        const aggregated = parser.aggregate(records, guessedMonth, file.name, 'local_drop');
        onUploadFileLoaded(aggregated);
        onSelectSource('user_upload');
        setUploadLoading(false);
        setIsOpen(false);
      } catch (err: any) {
        console.error('Failed to parse uploaded CSV:', err);
        setUploadError(`解析エラー: ${err.message || 'ファイルの処理に失敗しました'}`);
        setUploadLoading(false);
      }
    };

    reader.onerror = () => {
      setUploadError('ファイルの読み込み中にエラーが発生しました。');
      setUploadLoading(false);
    };

    reader.readAsText(file, 'utf-8');
  };

  // 表示用ラベルとステータス
  const getDisplayDetails = () => {
    switch (activeSource) {
      case 'live_metrics': {
        const scopeLabel =
          scopeType === 'monthly'
            ? `${selectedScopeKey} (月次)`
            : scopeType === 'daily'
            ? `${selectedScopeKey} (日次)`
            : '直近30日間';
        return {
          title: 'Live Metrics',
          subtitle: scopeLabel,
          icon: <Activity className="w-4 h-4 text-emerald-400" />,
          dotColor: 'bg-emerald-400 animate-pulse',
          badgeText: 'API自動収集',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        };
      }
      case 'monthly_report': {
        return {
          title: 'Monthly Usage Report',
          subtitle: `${selectedReportMonth} (永続レポート)`,
          icon: <FileSpreadsheet className="w-4 h-4 text-teal-400" />,
          dotColor: 'bg-teal-400',
          badgeText: '月次レポート',
          badgeClass: 'bg-teal-950/80 text-teal-300 border-teal-800',
        };
      }
      case 'user_upload': {
        const fileName = uploadedData?.file_name || 'オンデマンドCSV';
        return {
          title: 'User Upload File',
          subtitle: `${fileName} (${uploadedData?.overview.total_requests.toLocaleString() || 0} req)`,
          icon: <Upload className="w-4 h-4 text-cyan-400" />,
          dotColor: 'bg-cyan-400',
          badgeText: 'On-demand',
          badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-800',
        };
      }
    }
  };

  const currentDetails = getDisplayDetails();
  const availableMonths = indexMeta?.available_months || ['2026-09'];
  const availableDays = indexMeta?.available_days?.slice(0, 14) || [];

  return (
    <div className="relative">
      {/* 1. ヘッダー部の常時表示トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center space-x-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-indigo-500/80 hover:bg-slate-850 transition-all cursor-pointer shadow-sm group"
        title="クリックしてアクティブ分析データを切り替え (Live Metrics / Monthly Report / Upload)"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${currentDetails.dotColor}`} />
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${currentDetails.dotColor}`} />
          </span>
          <div className="p-1 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white shrink-0">
            {currentDetails.icon}
          </div>
        </div>

        <div className="flex flex-col items-start min-w-0 pr-1 text-left">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-white tracking-tight truncate max-w-[150px] sm:max-w-[200px]">
              {currentDetails.title}
            </span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full border font-bold ${currentDetails.badgeClass}`}>
              {currentDetails.badgeText}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 truncate max-w-[180px] sm:max-w-[240px]">
            {currentDetails.subtitle}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-white' : ''}`} />
      </button>

      {/* 2. データソース選択モーダル (createPortal で document.body にマウントしヘッダーの Containing Block から隔離) */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-20 bg-black/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-data-selector-title"
          >
            <div
              className="fixed inset-0"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div className="relative bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl h-[600px] max-h-[calc(100vh-5.5rem)] shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-150">
              {/* モーダルヘッダー */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70 flex-shrink-0">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800 text-indigo-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 id="active-data-selector-title" className="text-base font-bold text-white">
                      アクティブ分析データの選択
                    </h3>
                    <p className="text-xs text-slate-400">
                      ダッシュボード全体の分析対象データソースと期間スコープを切り替えます
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  aria-label="閉じる"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

            {/* ソース切り替えタブ (a / b / c) */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('live_metrics')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'live_metrics'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Live Metrics</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-200">
                  API自動収集
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('monthly_report')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'monthly_report'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Monthly Report</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-200">
                  {availableReports.length}件
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('user_upload')}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'user_upload'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>User Upload</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-slate-200">
                  On-demand
                </span>
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="p-6 space-y-5 flex-1 min-h-0 overflow-y-auto">
              {/* --- タブ A: Live Metrics --- */}
              {activeTab === 'live_metrics' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                        <span>過去1年ローリング表示スコープの選択</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        GitHub API連携で無期限蓄積されたデータのうち、直近1年間の月次・日次を選択します
                      </p>
                    </div>
                    {activeSource === 'live_metrics' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>現在アクティブ</span>
                      </span>
                    )}
                  </div>

                  {/* 月次スコープ (過去1年) */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>月次集計スコープ (過去12カ月):</span>
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableMonths.map((month) => {
                        const isCurrent =
                          activeSource === 'live_metrics' &&
                          scopeType === 'monthly' &&
                          selectedScopeKey === month;
                        return (
                          <button
                            key={month}
                            type="button"
                            onClick={() => {
                              onSelectLiveScope('monthly', month);
                              onSelectSource('live_metrics');
                              setIsOpen(false);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition border text-center cursor-pointer ${
                              isCurrent
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-400/40'
                                : 'bg-slate-950/70 text-slate-200 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                            }`}
                          >
                            {month}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 期間プリセット & 日次 */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>期間・日次プリセット:</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLiveScope('custom', 'latest-30d');
                          onSelectSource('live_metrics');
                          setIsOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border cursor-pointer ${
                          activeSource === 'live_metrics' && scopeType === 'custom'
                            ? 'bg-indigo-600 text-white border-indigo-400'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        直近30日間 (トレンド集約)
                      </button>

                      {availableDays.slice(0, 5).map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            onSelectLiveScope('daily', day);
                            onSelectSource('live_metrics');
                            setIsOpen(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition border cursor-pointer ${
                            activeSource === 'live_metrics' &&
                            scopeType === 'daily' &&
                            selectedScopeKey === day
                              ? 'bg-indigo-600 text-white border-indigo-400'
                              : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* --- タブ B: Monthly Usage Report --- */}
              {activeTab === 'monthly_report' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">永続化済み月次利用レポート (CSV)</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        GitHub Enterprise Billing からエクスポートされ `copilot-data` に保持されているレポート
                      </p>
                    </div>
                    {activeSource === 'monthly_report' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-semibold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>現在アクティブ</span>
                      </span>
                    )}
                  </div>

                  {availableReports.length === 0 ? (
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 text-center">
                      保持されている月次レポートはありません。「User Upload」から手元のCSVを直接投入できます。
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {availableReports.map((m) => {
                        const isCurrent =
                          activeSource === 'monthly_report' && selectedReportMonth === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              onSelectReportMonth(m);
                              onSelectSource('monthly_report');
                              setIsOpen(false);
                            }}
                            className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                              isCurrent
                                ? 'bg-teal-950/80 border-teal-600 text-white ring-2 ring-teal-500/40'
                                : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                              <span className="font-bold text-xs">{m}</span>
                            </div>
                            {isCurrent && <Check className="w-3.5 h-3.5 text-teal-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* --- タブ C: User Upload File (On-demand) --- */}
              {activeTab === 'user_upload' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">手元の CSV ファイルをオンデマンド解析</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        ブラウザ内のメモリでのみ解析・可視化（サーバー送信・Git履歴混入なし）
                      </p>
                    </div>
                    {activeSource === 'user_upload' && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>現在アクティブ</span>
                      </span>
                    )}
                  </div>

                  {/* 既に読み込み済みのファイル情報 */}
                  {uploadedData && (
                    <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/70 flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <FileCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-white">{uploadedData.file_name}</p>
                          <p className="text-[11px] text-cyan-300">
                            {uploadedData.report_month} • {uploadedData.overview.total_requests.toLocaleString()} req • 利用: ${uploadedData.overview.total_gross_spend_usd.toFixed(2)} (超過請求: ${uploadedData.overview.total_net_spend_usd.toFixed(2)})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {activeSource !== 'user_upload' && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectSource('user_upload');
                              setIsOpen(false);
                            }}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            このファイルを表示
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onClearUploadedFile}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-300 transition"
                          title="読み込み済みファイルをクリア"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ドロップゾーン */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleFileProcess(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-cyan-500 bg-cyan-950/20 scale-[0.99]'
                        : 'border-slate-700 bg-slate-950/40 hover:border-slate-500 hover:bg-slate-950/70'
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
                    <Upload className="w-7 h-7 text-cyan-400 mb-2" />
                    <p className="text-xs font-semibold text-slate-200">
                      新しい CSV ファイルをドラッグ＆ドロップ
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      または <span className="text-cyan-400 underline">ファイルを選択</span> (Detailed Usage Report CSV等)
                    </p>
                  </div>

                  {uploadLoading && (
                    <div className="flex items-center justify-center space-x-2 text-xs text-cyan-400 py-2">
                      <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>CSV を解析中...</span>
                    </div>
                  )}

                  {uploadError && (
                    <div className="flex items-start space-x-2 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* セキュリティ保証 */}
                  <div className="flex items-center space-x-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>Zero Leakage 保証:</strong> 投入データはブラウザのメモリ内でのみ処理され、外部サーバーやリポジトリには一切送信されません。
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* モーダルフッター */}
            <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 text-xs font-medium rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
