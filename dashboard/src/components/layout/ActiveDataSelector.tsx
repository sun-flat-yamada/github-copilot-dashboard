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

  // フィルター要素の分配 (少なくとも6要素を表示、上段・下段の2行均等配分)
  const MAX_VISIBLE_BADGES = 6;
  const visibleBadges = filterBadges.slice(0, MAX_VISIBLE_BADGES);
  const remainingCount = filterBadges.length - visibleBadges.length;
  const splitIndex =
    visibleBadges.length <= 3
      ? visibleBadges.length
      : Math.ceil(visibleBadges.length / 2);
  const firstRowBadges = visibleBadges.slice(0, splitIndex);
  const secondRowBadges = visibleBadges.slice(splitIndex);

  // ホバー時チップ用テキスト (全内容およびショートカットTipsを明記)
  const getTooltipText = () => {
    const shortcutText = '(ショートカット: / または Ctrl+K)';
    const sourceInfo = `【${details.title}】期間/スコープ: ${details.subtitle}`;

    if (!isFiltered) {
      return `${sourceInfo}\nフィルター: なし (全体: ${counts.total}名)\nクリックしてデータソースおよびフィルター条件を変更 ${shortcutText}`;
    }

    const filterList = filterBadges.map((b) => b.label).join(', ');
    return `${sourceInfo}\n適用フィルター (${filterBadges.length}件 / 該当: ${counts.matched}名 / 全体: ${counts.total}名):\n・${filterList}\nクリックしてデータソースおよびフィルター条件を変更 ${shortcutText}`;
  };

  return (
    <div className="flex items-center space-x-1.5 h-full">
      {/* 統合データバッジ & トリガーボタン (タイトル表示部と同等の高さを活用した2行レイアウト) */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2.5 px-3 py-1 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-indigo-500/80 hover:bg-slate-850 transition-all cursor-pointer shadow-sm group select-none max-w-full"
        title={getTooltipText()}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        {/* ソースインジケーター & 2行ソース情報 (タイトル表示部と調和する階層構造) */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="relative flex items-center justify-center p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white shrink-0">
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${details.dotColor}`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${details.dotColor}`}
              />
            </span>
            {details.icon}
          </div>
          <div className="flex flex-col text-left justify-center shrink-0">
            <span className="text-xs font-bold text-white tracking-tight leading-none">
              {details.title}
            </span>
            <span className="inline-flex items-center text-[10px] px-1.5 py-0.2 rounded border bg-slate-950/70 border-slate-700/80 text-slate-300 font-mono leading-tight mt-1 self-start">
              {details.subtitle}
            </span>
          </div>
        </div>

        {/* ディバイダー */}
        <div className="w-px h-8 bg-slate-700/80 shrink-0" />

        {/* フィルター要約ピル (タイトル部と同等の高さを活用した2行配置・少なくとも6要素表示) */}
        <div className="flex flex-col justify-center min-w-0 shrink">
          {!isFiltered ? (
            <div className="flex flex-col text-left justify-center px-0.5">
              <span className="text-[11px] text-slate-300 font-medium leading-none">
                フィルタなし
              </span>
              <span className="text-[10px] text-slate-500 font-mono leading-tight mt-1">
                全体: {counts.total}名
              </span>
            </div>
          ) : (
            <div className="flex flex-col justify-center space-y-1 min-w-0">
              {/* 1行目: 最大3要素 */}
              <div className="flex items-center space-x-1 min-w-0">
                <Filter className="w-3 h-3 text-purple-400 shrink-0" />
                {firstRowBadges.map((b) => (
                  <span
                    key={b.key}
                    title={b.label}
                    className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800 font-medium truncate max-w-[85px] sm:max-w-[110px]"
                  >
                    {b.label}
                  </span>
                ))}
                {secondRowBadges.length === 0 && (
                  <span className="text-[10px] text-indigo-300 font-semibold ml-0.5 shrink-0 whitespace-nowrap">
                    ({counts.matched}名)
                  </span>
                )}
              </div>
              {/* 2行目: 次の最大3要素 + 残数 + 該当人数 */}
              {secondRowBadges.length > 0 && (
                <div className="flex items-center space-x-1 min-w-0">
                  {secondRowBadges.map((b) => (
                    <span
                      key={b.key}
                      title={b.label}
                      className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800 font-medium truncate max-w-[85px] sm:max-w-[110px]"
                    >
                      {b.label}
                    </span>
                  ))}
                  {remainingCount > 0 && (
                    <span
                      title={`他 ${remainingCount} 件: ${filterBadges
                        .slice(MAX_VISIBLE_BADGES)
                        .map((b) => b.label)
                        .join(', ')}`}
                      className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold shrink-0"
                    >
                      +{remainingCount}
                    </span>
                  )}
                  <span className="text-[10px] text-indigo-300 font-semibold ml-0.5 shrink-0 whitespace-nowrap">
                    ({counts.matched}名)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 shrink-0 ml-0.5 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* ワンクリック全解除ボタン */}
      {isFiltered && (
        <button
          type="button"
          onClick={onResetFilterCriteria}
          className="self-stretch p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-700/80 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 transition-all cursor-pointer shadow-sm flex items-center justify-center shrink-0"
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
