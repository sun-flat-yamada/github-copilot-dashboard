import React, { useState, useEffect } from 'react';
import {
  DataSourceType,
  AnalysisScopeType,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  FilterCriteria,
  DATA_SOURCE_LABELS,
} from '../../../../src/types/copilot';
import {
  isFilterCriteriaActive,
  getFilterSummaryBadges,
} from '../../utils/filterEngine';
import { DataSelectionModal } from './DataSelectionModal';
import {
  Activity,
  FileSpreadsheet,
  Upload,
  ChevronDown,
  X,
  Filter,
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
  // 統合フィルター条件 (2階層特定モデル & SDD-15)
  filterCriteria: FilterCriteria;
  onApplyFilterCriteria: (criteria: FilterCriteria) => void;
  onResetFilterCriteria: () => void;
  availableCostCenters: string[];
  availableOrganizations: string[];
  availableGroups: string[];
  availableTags: string[];
  // リアルタイムプレビュー用データ
  currentScopeData: ScopeAggregatedData | null;
  currentReportData: MonthlyReportAggregatedData | null;
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
  filterCriteria,
  onApplyFilterCriteria,
  onResetFilterCriteria,
  availableCostCenters,
  availableOrganizations,
  availableGroups,
  availableTags,
  currentScopeData,
  currentReportData,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // グローバルキーボードショートカット (Ctrl+K, Cmd+K, '/') でモーダル起動
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // テキスト入力中は除外
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 表示用詳細情報の導出
  const getDisplayDetails = () => {
    switch (activeSource) {
      case 'live_metrics': {
        const scopeLabel =
          scopeType === 'monthly'
            ? `${selectedScopeKey}`
            : scopeType === 'daily'
            ? `${selectedScopeKey}`
            : '直近30日';
        return {
          title: DATA_SOURCE_LABELS.live_metrics.shortTitle,
          subtitle: scopeLabel,
          icon: <Activity className="w-3.5 h-3.5 text-emerald-400" />,
          dotColor: 'bg-emerald-400 animate-pulse',
          badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
        };
      }
      case 'monthly_report': {
        return {
          title: DATA_SOURCE_LABELS.monthly_report.shortTitle,
          subtitle: selectedReportMonth,
          icon: <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />,
          dotColor: 'bg-teal-400',
          badgeClass: 'bg-teal-950/80 text-teal-300 border-teal-800',
        };
      }
      case 'user_upload': {
        const fileName = uploadedData?.file_name || 'オンデマンドCSV';
        return {
          title: DATA_SOURCE_LABELS.user_upload.shortTitle,
          subtitle: fileName,
          icon: <Upload className="w-3.5 h-3.5 text-cyan-400" />,
          dotColor: 'bg-cyan-400',
          badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-800',
        };
      }
    }
  };

  const details = getDisplayDetails();
  const isFiltered = isFilterCriteriaActive(filterCriteria);
  const filterBadges = getFilterSummaryBadges(filterCriteria);

  // 該当件数の計算
  const counts = (() => {
    if (activeSource === 'live_metrics' && currentScopeData?.users) {
      return {
        matched: currentScopeData.users.length,
        total: indexMeta?.summary?.total_seats || currentScopeData.users.length,
      };
    }
    const report = activeSource === 'user_upload' ? uploadedData : currentReportData;
    if (report?.user_details) {
      return {
        matched: report.user_details.length,
        total: report.user_details.length,
      };
    }
    return { matched: 0, total: 0 };
  })();

  return (
    <div className="flex items-center space-x-1.5">
      {/* 統合データバッジ & トリガーボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-indigo-500/80 hover:bg-slate-850 transition-all cursor-pointer shadow-sm group select-none max-w-[500px]"
        title="クリックして分析対象データソースおよびANDフィルター条件を変更 (ショートカット: / または Ctrl+K)"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {/* ソースインジケーター */}
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${details.dotColor}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${details.dotColor}`} />
          </span>
          <div className="p-1 rounded-md bg-slate-800 text-slate-300 group-hover:text-white">
            {details.icon}
          </div>
        </div>

        {/* ソース名称 & 期間 */}
        <div className="flex items-center space-x-1.5 shrink-0 text-left">
          <span className="text-xs font-bold text-white tracking-tight">
            {details.title}
          </span>
          <span className="text-[11px] px-1.5 py-0.2 rounded border bg-slate-950/70 border-slate-700 text-slate-300 font-mono">
            {details.subtitle}
          </span>
        </div>

        {/* ディバイダー */}
        <div className="w-px h-3.5 bg-slate-700 shrink-0" />

        {/* フィルター要約ピル (未適用時は「全体」、適用時はチップ要約) */}
        <div className="flex items-center space-x-1 overflow-hidden shrink min-w-0">
          {!isFiltered ? (
            <span className="text-[11px] text-slate-400 truncate">
              フィルタなし (全体: {counts.total}名)
            </span>
          ) : (
            <div className="flex items-center space-x-1 truncate">
              <Filter className="w-3 h-3 text-purple-400 shrink-0" />
              {filterBadges.slice(0, 2).map((b) => (
                <span
                  key={b.key}
                  className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800 font-medium truncate max-w-[100px]"
                >
                  {b.label}
                </span>
              ))}
              {filterBadges.length > 2 && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                  +{filterBadges.length - 2}
                </span>
              )}
              <span className="text-[11px] text-indigo-300 font-semibold ml-1 shrink-0">
                ({counts.matched}名)
              </span>
            </div>
          )}
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 shrink-0 ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* ワンクリック全解除ボタン */}
      {isFiltered && (
        <button
          type="button"
          onClick={onResetFilterCriteria}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-700/80 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm"
          title="すべてのフィルター条件を即座に解除して全体表示に戻す"
          aria-label="フィルター全解除"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* 大型モーダル */}
      <DataSelectionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        activeSource={activeSource}
        onSelectSource={onSelectSource}
        indexMeta={indexMeta}
        scopeType={scopeType}
        selectedScopeKey={selectedScopeKey}
        onSelectLiveScope={onSelectLiveScope}
        availableReports={availableReports}
        selectedReportMonth={selectedReportMonth}
        onSelectReportMonth={onSelectReportMonth}
        uploadedData={uploadedData}
        onUploadFileLoaded={onUploadFileLoaded}
        onClearUploadedFile={onClearUploadedFile}
        filterCriteria={filterCriteria}
        onApplyFilterCriteria={onApplyFilterCriteria}
        availableCostCenters={availableCostCenters}
        availableOrganizations={availableOrganizations}
        availableGroups={availableGroups}
        availableTags={availableTags}
        currentScopeData={currentScopeData}
        currentReportData={currentReportData}
      />
    </div>
  );
};
