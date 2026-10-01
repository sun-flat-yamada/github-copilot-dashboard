import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  DataSourceType,
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  FilterCriteria,
  DEFAULT_FILTER_CRITERIA,
  DATA_SOURCE_LABELS,
} from '../../../../src/types/copilot';
import { ReportParser } from '../../../../src/processor/report-parser';
import {
  validatePattern,
  matchUserWithCriteria,
  MAX_REGEX_PATTERN_LENGTH,
} from '../../utils/filterEngine';
import {
  Activity,
  FileSpreadsheet,
  Upload,
  Sparkles,
  Landmark,
  Briefcase,
  Tag,
  User,
  AlertTriangle,
  RotateCcw,
  Check,
  X,
  FileCheck,
  Calendar,
  Building2,
} from 'lucide-react';

interface DataSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Step 1: データソース
  activeSource: DataSourceType;
  onSelectSource: (source: DataSourceType) => void;
  indexMeta: IndexMetadata | null;
  scopeType: AnalysisScopeType;
  selectedScopeKey: string;
  onSelectLiveScope: (type: AnalysisScopeType, key: string) => void;
  availableReports: string[];
  selectedReportMonth: string;
  onSelectReportMonth: (month: string) => void;
  uploadedData: MonthlyReportAggregatedData | null;
  onUploadFileLoaded: (data: MonthlyReportAggregatedData) => void;
  onClearUploadedFile: () => void;
  // Step 2: フィルター
  filterCriteria: FilterCriteria;
  onApplyFilterCriteria: (criteria: FilterCriteria) => void;
  availableCostCenters: string[];
  availableOrganizations: string[];
  availableGroups: string[];
  availableTags: string[];
  // プレビュー用生データ
  currentScopeData: ScopeAggregatedData | null;
  currentReportData: MonthlyReportAggregatedData | null;
}

export const DataSelectionModal: React.FC<DataSelectionModalProps> = ({
  isOpen,
  onClose,
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
  filterCriteria,
  onApplyFilterCriteria,
  availableCostCenters,
  availableOrganizations,
  availableGroups,
  availableTags,
  currentScopeData,
  currentReportData,
}) => {
  // 一時編集用ローカルステート
  const [localSource, setLocalSource] = useState<DataSourceType>(activeSource);
  const [localScopeType, setLocalScopeType] = useState<AnalysisScopeType>(scopeType);
  const [localScopeKey, setLocalScopeKey] = useState<string>(selectedScopeKey);
  const [localReportMonth, setLocalReportMonth] = useState<string>(selectedReportMonth);
  const [localCriteria, setLocalCriteria] = useState<FilterCriteria>(filterCriteria);

  // アップロード状態
  const [isDragging, setIsDragging] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 期間指定（カスタム範囲）用ステート
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    if (selectedScopeKey.startsWith('custom:')) {
      return selectedScopeKey.slice('custom:'.length).split('_')[0] || '';
    }
    return indexMeta?.default_scopes?.latest_range?.start || '';
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    if (selectedScopeKey.startsWith('custom:')) {
      return selectedScopeKey.slice('custom:'.length).split('_')[1] || '';
    }
    return indexMeta?.default_scopes?.latest_range?.end || '';
  });

  // モーダルオープン時に現在のプロパティ値で同期
  useEffect(() => {
    if (isOpen) {
      setLocalSource(activeSource);
      setLocalScopeType(scopeType);
      setLocalScopeKey(selectedScopeKey);
      setLocalReportMonth(selectedReportMonth);
      setLocalCriteria(filterCriteria);
      setUploadError(null);
      if (selectedScopeKey.startsWith('custom:')) {
        const parts = selectedScopeKey.slice('custom:'.length).split('_');
        if (parts[0]) setCustomStartDate(parts[0]);
        if (parts[1]) setCustomEndDate(parts[1]);
      } else {
        setCustomStartDate(indexMeta?.default_scopes?.latest_range?.start || '');
        setCustomEndDate(indexMeta?.default_scopes?.latest_range?.end || '');
      }
    }
  }, [isOpen, activeSource, scopeType, selectedScopeKey, selectedReportMonth, filterCriteria, indexMeta]);

  // キーボードショートカット (Esc で閉じる、Enter で適用)
  // 最新の handleApply / onClose は ref 経由で参照する (リスナーの付け替えを isOpen の変化時だけにしつつ、
  // 古いクロージャ (更新前のローカル状態) で適用してしまわないようにする)
  const handleApplyRef = useRef<() => void>(() => {});
  const onCloseRef = useRef<() => void>(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if (
        e.key === 'Enter' &&
        (e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.tagName !== 'TEXTAREA')
      ) {
        // 入力欄で単独 Enter を押したときの誤適用を防ぎつつ適用可能にする
        if ((e.target as HTMLElement)?.id !== 'regex-pattern-input') {
          handleApplyRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 正規表現検証
  const patternValidation = useMemo(() => {
    return validatePattern(localCriteria.userPattern, localCriteria.userPatternIsRegex);
  }, [localCriteria.userPattern, localCriteria.userPatternIsRegex]);

  // ファイルドロップ・パース処理
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
        setLocalSource('user_upload');
        setUploadLoading(false);
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

  // リアルタイム集計プレビュー (現在の localCriteria を適用した場合の該当人数)
  const previewStats = useMemo(() => {
    let totalCount = 0;
    let matchedCount = 0;

    if (localSource === 'live_metrics' && currentScopeData?.users) {
      totalCount = currentScopeData.users.length;
      matchedCount = currentScopeData.users.filter((u) => matchUserWithCriteria(u, localCriteria)).length;
    } else {
      const report = localSource === 'user_upload' ? uploadedData : currentReportData;
      if (report?.user_details) {
        totalCount = report.user_details.length;
        matchedCount = report.user_details.filter((u) => {
          return matchUserWithCriteria(
            {
              login: u.login,
              display_name: u.display_name,
              cost_center: u.cost_center,
              organization: u.organization,
              department: u.department,
              tags: u.tags,
            },
            localCriteria
          );
        }).length;
      }
    }

    return { totalCount, matchedCount };
  }, [localSource, currentScopeData, currentReportData, uploadedData, localCriteria]);

  // タグトグル
  const handleToggleTag = (tag: string) => {
    setLocalCriteria((prev) => {
      const exists = prev.tags.includes(tag);
      return {
        ...prev,
        tags: exists ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
      };
    });
  };

  // 全リセット
  const handleReset = () => {
    setLocalCriteria(DEFAULT_FILTER_CRITERIA);
  };

  // 適用
  const handleApply = () => {
    if (!patternValidation.isValid) return;

    if (localSource !== activeSource) {
      onSelectSource(localSource);
    }
    if (localSource === 'live_metrics') {
      onSelectLiveScope(localScopeType, localScopeKey);
    } else if (localSource === 'monthly_report') {
      onSelectReportMonth(localReportMonth);
    }

    onApplyFilterCriteria(localCriteria);
    onClose();
  };
  handleApplyRef.current = handleApply;

  if (!isOpen || typeof document === 'undefined') return null;

  const availableMonths = indexMeta?.available_months || ['2026-09'];
  const availableDays = indexMeta?.available_days || [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="data-selection-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-slate-900 border border-slate-700/90 rounded-2xl w-[92vw] max-w-5xl h-[85vh] max-h-[820px] shadow-2xl overflow-hidden flex flex-col z-10 animate-in zoom-in-95 duration-200">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 id="data-selection-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">
                分析対象データ
              </h3>
              <p className="text-xs text-slate-400 hidden sm:block">
                ダッシュボード全体の集計母数となるデータソースの選択および絞り込み条件（AND）を設定します
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end space-x-3">
            {/* 選択ユーザー数 リアルタイム表示 */}
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400 font-medium">選択ユーザー数:</span>
              {previewStats.matchedCount === 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/80 text-rose-300 border border-rose-800 font-bold shadow-sm">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>該当 0 件 (条件が厳しすぎます)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-700 font-medium shadow-sm">
                  <span>該当:</span>
                  <strong className="text-white font-bold">{previewStats.matchedCount}</strong>
                  <span className="text-slate-300">/ {previewStats.totalCount} 名</span>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="閉じる"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2カラムボディ */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* 左カラム: Step 1 対象データ3種 (col-span-5) */}
          <div className="md:col-span-5 p-5 sm:p-6 flex flex-col space-y-4 bg-slate-950/30 overflow-y-auto">
            <div className="flex items-center space-x-2 pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Step 1: 分析対象データソース
              </span>
            </div>

            {/* カード 1: 自動定期収集データ (API収集) */}
            <div
              onClick={() => setLocalSource('live_metrics')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                localSource === 'live_metrics'
                  ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-lg ${localSource === 'live_metrics' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {DATA_SOURCE_LABELS.live_metrics.shortTitle}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {DATA_SOURCE_LABELS.live_metrics.category}
                    </span>
                  </div>
                </div>
                {localSource === 'live_metrics' && <Check className="w-4 h-4 text-indigo-400 mt-1" />}
              </div>

              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                {DATA_SOURCE_LABELS.live_metrics.description}
              </p>

              {/* 期間範囲指定 (直近30日 / 指定期間 / 月次 / 日次) */}
              {localSource === 'live_metrics' && (
                <div className="mt-3 pt-3 border-t border-indigo-900/40 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-indigo-300 block">
                      抽出期間の範囲指定:
                    </span>
                    {localScopeType === 'custom' && localScopeKey === 'latest-30d' && (
                      <span className="text-[10px] text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                        {indexMeta?.default_scopes?.latest_range?.start ?? '—'} 〜 {indexMeta?.default_scopes?.latest_range?.end ?? '—'}
                      </span>
                    )}
                  </div>

                  {/* 4モード切り替えボタン */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setLocalScopeType('custom');
                        setLocalScopeKey('latest-30d');
                      }}
                      className={`px-1.5 py-1.5 rounded-md font-medium transition-all text-center text-[11px] cursor-pointer ${
                        localScopeType === 'custom' && localScopeKey === 'latest-30d'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      直近30日間
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalScopeType('custom');
                        const start = customStartDate || (availableDays.length > 0 ? availableDays[availableDays.length - 1] : '');
                        const end = customEndDate || (availableDays.length > 0 ? availableDays[0] : '');
                        setLocalScopeKey(`custom:${start}_${end}`);
                      }}
                      className={`px-1.5 py-1.5 rounded-md font-medium transition-all text-center text-[11px] cursor-pointer ${
                        localScopeType === 'custom' && localScopeKey.startsWith('custom:')
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      指定期間
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalScopeType('monthly');
                        if (!availableMonths.includes(localScopeKey)) {
                          setLocalScopeKey(availableMonths[0] || '');
                        }
                      }}
                      className={`px-1.5 py-1.5 rounded-md font-medium transition-all text-center text-[11px] cursor-pointer ${
                        localScopeType === 'monthly'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      月次
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLocalScopeType('daily');
                        if (!availableDays.includes(localScopeKey)) {
                          setLocalScopeKey(availableDays[0] || '');
                        }
                      }}
                      className={`px-1.5 py-1.5 rounded-md font-medium transition-all text-center text-[11px] cursor-pointer ${
                        localScopeType === 'daily'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      日次
                    </button>
                  </div>

                  {/* 各モードの詳細選択領域 */}
                  {localScopeType === 'custom' && localScopeKey === 'latest-30d' && (
                    <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-300 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>直近30日間のローリング集計</span>
                      </div>
                      <span className="font-mono text-[11px] text-indigo-200">
                        {indexMeta?.default_scopes?.latest_range?.start ?? '—'} 〜 {indexMeta?.default_scopes?.latest_range?.end ?? '—'}
                      </span>
                    </div>
                  )}

                  {localScopeType === 'custom' && localScopeKey.startsWith('custom:') && (
                    <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 space-y-2">
                      <div className="flex items-center justify-between text-xs text-indigo-300">
                        <span className="flex items-center space-x-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>開始日と終了日を指定:</span>
                        </span>
                        {customStartDate && customEndDate && (
                          <span className="text-[10px] text-indigo-400 font-mono">
                            {customStartDate} 〜 {customEndDate}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-1">開始日</label>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomStartDate(val);
                              setLocalScopeKey(`custom:${val}_${customEndDate || val}`);
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <span className="text-slate-500 pt-4">〜</span>
                        <div className="flex-1">
                          <label className="text-[10px] text-slate-400 block mb-1">終了日</label>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomEndDate(val);
                              setLocalScopeKey(`custom:${customStartDate || val}_${val}`);
                            }}
                            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {localScopeType === 'monthly' && (
                    <div>
                      <select
                        value={localScopeKey}
                        onChange={(e) => setLocalScopeKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                      >
                        {availableMonths.map((m) => (
                          <option key={m} value={m}>{m} (月次)</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {localScopeType === 'daily' && (
                    <div>
                      <select
                        value={localScopeKey}
                        onChange={(e) => setLocalScopeKey(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                      >
                        {availableDays.map((d) => (
                          <option key={d} value={d}>{d} (日次)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* カード 2: 登録済み月次利用レポート */}
            <div
              onClick={() => setLocalSource('monthly_report')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                localSource === 'monthly_report'
                  ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-lg ${localSource === 'monthly_report' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {DATA_SOURCE_LABELS.monthly_report.shortTitle}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {DATA_SOURCE_LABELS.monthly_report.category}
                    </span>
                  </div>
                </div>
                {localSource === 'monthly_report' && <Check className="w-4 h-4 text-emerald-400 mt-1" />}
              </div>

              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                {DATA_SOURCE_LABELS.monthly_report.description}
              </p>

              {localSource === 'monthly_report' && (
                <div className="mt-3 pt-3 border-t border-emerald-900/40 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] font-semibold text-emerald-300 block">
                    対象確定レポート月を選択:
                  </span>
                  <select
                    value={localReportMonth}
                    onChange={(e) => setLocalReportMonth(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-emerald-500"
                  >
                    {availableReports.map((r) => (
                      <option key={r} value={r}>{r} (確定版)</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* カード 3: オンデマンド登録CSV */}
            <div
              onClick={() => setLocalSource('user_upload')}
              className={`p-4 rounded-xl border transition-all cursor-pointer ${
                localSource === 'user_upload'
                  ? 'bg-cyan-950/40 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className={`p-2 rounded-lg ${localSource === 'user_upload' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                    <Upload className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {DATA_SOURCE_LABELS.user_upload.shortTitle}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {DATA_SOURCE_LABELS.user_upload.category}
                    </span>
                  </div>
                </div>
                {localSource === 'user_upload' && <Check className="w-4 h-4 text-cyan-400 mt-1" />}
              </div>

              <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                {DATA_SOURCE_LABELS.user_upload.description}
              </p>

              {/* ドロップゾーン */}
              {localSource === 'user_upload' && (
                <div className="mt-3 pt-3 border-t border-cyan-900/40 space-y-2" onClick={(e) => e.stopPropagation()}>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files?.[0]) handleFileProcess(e.dataTransfer.files[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-3 text-center transition cursor-pointer ${
                      isDragging
                        ? 'border-cyan-400 bg-cyan-950/50'
                        : 'border-slate-700 hover:border-cyan-500 bg-slate-950/60'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileProcess(e.target.files[0]);
                      }}
                    />
                    <Upload className={`w-5 h-5 text-cyan-400 mx-auto mb-1 ${uploadLoading ? 'animate-bounce' : ''}`} />
                    <span className="text-xs font-semibold text-slate-200 block">
                      {uploadLoading ? 'CSV を解析中...' : 'Usage Report CSV をドロップまたは選択'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      🔒 ブラウザ内メモリでのみ解析（Zero-Leakage）
                    </span>
                  </div>

                  {uploadedData && (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-cyan-900/60 text-xs">
                      <div className="flex items-center space-x-1.5 truncate">
                        <FileCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-slate-200 truncate">{uploadedData.file_name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={onClearUploadedFile}
                        className="text-[11px] text-rose-400 hover:text-rose-300 ml-2"
                      >
                        クリア
                      </button>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-900">
                      {uploadError}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右カラム: Step 2 ANDフィルター条件 (col-span-7) */}
          <div className="md:col-span-7 p-5 sm:p-6 flex flex-col space-y-4 overflow-y-auto">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                Step 2: ANDフィルター条件 (絞り込み)
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-slate-200 transition"
                title="すべてのフィルター条件を初期状態に戻す"
              >
                <RotateCcw className="w-3 h-3" />
                <span>条件リセット</span>
              </button>
            </div>

            {/* カテゴリ A: 組織・財務軸 */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                <Landmark className="w-3.5 h-3.5 text-amber-400" />
                <span>カテゴリ A: 組織・財務軸 (</span>
                <span className="text-amber-400">CostCenter</span>
                <span className="text-slate-500">/</span>
                <span className="text-blue-400">Organization</span>
                <span>)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-amber-300 flex items-center space-x-1 mb-1">
                    <Landmark className="w-3 h-3 text-amber-400" />
                    <span>CostCenter (コストセンター)</span>
                  </label>
                  <select
                    value={localCriteria.costCenter}
                    onChange={(e) => setLocalCriteria((prev) => ({ ...prev, costCenter: e.target.value }))}
                    className={`w-full bg-slate-900 border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none transition ${
                      localCriteria.costCenter !== 'all'
                        ? 'border-amber-600 focus:ring-1 focus:ring-amber-500 focus:border-amber-500'
                        : 'border-slate-700 hover:border-amber-600/60 focus:ring-1 focus:ring-amber-500 focus:border-amber-500'
                    }`}
                  >
                    <option value="all">すべて (All)</option>
                    <option value="__unassigned__">未割当のみ (Unassigned)</option>
                    {availableCostCenters.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-blue-300 flex items-center space-x-1 mb-1">
                    <Building2 className="w-3 h-3 text-blue-400" />
                    <span>GitHub Organization</span>
                  </label>
                  <select
                    value={localCriteria.organization}
                    onChange={(e) => setLocalCriteria((prev) => ({ ...prev, organization: e.target.value }))}
                    className={`w-full bg-slate-900 border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none transition ${
                      localCriteria.organization !== 'all'
                        ? 'border-blue-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                        : 'border-slate-700 hover:border-blue-600/60 focus:ring-1 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  >
                    <option value="all">すべて (All)</option>
                    <option value="__unassigned__">未割当のみ (Unassigned)</option>
                    {availableOrganizations.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* カテゴリ B: プロジェクト・部署軸 */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                <span>カテゴリ B: プロジェクト・部署軸 (</span>
                <span className="text-purple-400">ユーザー定義Gr</span>
                <span>)</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-purple-300 flex items-center space-x-1 mb-1">
                  <Briefcase className="w-3 h-3 text-purple-400" />
                  <span>ユーザー定義Gr (部署・PJ)</span>
                </label>
                <select
                  value={localCriteria.group}
                  onChange={(e) => setLocalCriteria((prev) => ({ ...prev, group: e.target.value }))}
                  className={`w-full bg-slate-900 border text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none transition ${
                    localCriteria.group !== 'all'
                      ? 'border-purple-600 focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                      : 'border-slate-700 hover:border-purple-600/60 focus:ring-1 focus:ring-purple-500 focus:border-purple-500'
                  }`}
                >
                  <option value="all">すべてのユーザー定義Gr (All)</option>
                  <option value="__unassigned__">未割当のみ (Unassigned)</option>
                  {availableGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* カテゴリ C: タグ・属性軸 */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                <Tag className="w-3.5 h-3.5 text-rose-400" />
                <span>カテゴリ C: タグ・属性軸 (</span>
                <span className="text-rose-400">Tag</span>
                <span>)</span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-rose-300 flex items-center space-x-1">
                    <Tag className="w-3 h-3 text-rose-400" />
                    <span>Tag 絞り込み (複数選択時は AND一致)</span>
                  </label>
                  {localCriteria.tags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLocalCriteria((prev) => ({ ...prev, tags: [] }))}
                      className="text-[10px] text-rose-400 hover:text-rose-300 transition"
                    >
                      クリア
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-900/60 rounded-lg border border-slate-800">
                  {availableTags.length === 0 ? (
                    <span className="text-[11px] text-slate-500 p-1">利用可能なタグがありません</span>
                  ) : (
                    availableTags.map((tag) => {
                      const isSelected = localCriteria.tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          className={`flex items-center space-x-1 px-2 py-0.5 rounded text-xs transition cursor-pointer border ${
                            isSelected
                              ? 'bg-rose-600 text-white border-rose-500 shadow-sm hover:bg-rose-500'
                              : 'bg-slate-850 text-slate-300 border-slate-700 hover:bg-slate-800 hover:border-rose-500/50'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-rose-200" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* カテゴリ D: アカウント・個別軸 */}
            <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-300">
                  <User className="w-3.5 h-3.5 text-cyan-400" />
                  <span>カテゴリ D: アカウント・個別軸 (ユーザー名 / ID パターン指定)</span>
                </div>
                <label className="flex items-center space-x-1.5 text-xs cursor-pointer select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={localCriteria.userPatternIsRegex}
                    onChange={(e) =>
                      setLocalCriteria((prev) => ({
                        ...prev,
                        userPatternIsRegex: e.target.checked,
                      }))
                    }
                    className="rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span>正規表現 (RegEx) を有効化</span>
                </label>
              </div>

              <div>
                <input
                  id="regex-pattern-input"
                  type="text"
                  maxLength={MAX_REGEX_PATTERN_LENGTH}
                  value={localCriteria.userPattern}
                  onChange={(e) =>
                    setLocalCriteria((prev) => ({
                      ...prev,
                      userPattern: e.target.value,
                    }))
                  }
                  placeholder={
                    localCriteria.userPatternIsRegex
                      ? '正規表現パターン (例: ^(dev|lead)-.*, alice|bob)'
                      : 'ユーザー名やIDの部分一致検索 (例: tanaka, alice)'
                  }
                  className={`w-full bg-slate-900 border text-slate-100 text-xs rounded-lg px-3 py-2 focus:outline-none transition ${
                    !patternValidation.isValid
                      ? 'border-rose-500 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500'
                  }`}
                />
                {!patternValidation.isValid && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{patternValidation.error}</span>
                  </p>
                )}
                {localCriteria.userPatternIsRegex && patternValidation.isValid && (
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ※ 大文字・小文字を区別せず、login および display_name に対して評価されます
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="text-[11px] text-slate-500 hidden sm:block">
            ※ 適用するとダッシュボード全体の集計・分析結果が即時再計算されます
          </div>

          <div className="flex items-center space-x-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={!patternValidation.isValid}
              className={`flex items-center space-x-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white transition shadow-lg cursor-pointer ${
                patternValidation.isValid
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>この条件で分析を適用 (Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
