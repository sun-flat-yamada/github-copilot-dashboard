import React, { useState, useMemo } from 'react';
import {
  AnalysisScopeType,
  CostCenterBudget,
  GroupingDimension,
  UserSeatStatus,
} from '../../src/types/copilot';
import { useDashboardData } from './hooks/useDashboardData';
import { useAccordionGroup } from './hooks/useAccordionGroup';
import { useDeepAnalysisData } from './hooks/useDeepAnalysisData';
import { useTheme } from './hooks/useTheme';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { ViewNavigation } from './components/layout/ViewNavigation';
import { toNavigationItem } from './views/navigation';
import { ViewHost } from './views/ViewHost';
import type { ViewRegistry } from './views/viewRegistry';
import type { ViewContext } from './views/types';
import { ErrorLogModal } from './components/ErrorLogModal';
import { AboutModal } from './components/AboutModal';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { DataStatusBanner } from './components/common/DataStatusBanner';
import { buildDataStatusItems, resolveIsDemoData } from './utils/dataStatus';
import { BudgetUtilizationRule } from '../../src/domain/rules/BudgetUtilizationRule';
import { RefreshCw, AlertCircle } from 'lucide-react';

const ALL_SECTION_IDS = [
  'advisor',
  'yearly-trend',
  'allocation',
  'budget',
  'users',
  'trend',
  'usage',
  'report_charts',
  'report_users',
];

interface AppShellProps {
  /** 描画対象のビュー集合。本番は defaultViewRegistry (App.tsx)、テストは import.meta.glob を使わず明示的に渡す */
  registry: ViewRegistry;
}

export const AppShell: React.FC<AppShellProps> = ({ registry: defaultViewRegistry }) => {
  // 1. データ取得カスタムフック (3データソース統合 & タグANDフィルター対応)
  const {
    activeSource,
    setActiveSource,
    indexMeta,
    scopeType,
    setScopeType,
    selectedKey,
    setSelectedKey,
    currentData,
    previousData,
    rawCurrentData,
    rawCurrentReportData,
    loading,
    error,
    noLiveData,
    selectedReportMonth,
    setSelectedReportMonth,
    currentReportData,
    reportLoading,
    reportError,
    uploadedData,
    handleUploadFileLoaded,
    handleClearUploadedFile,
    repoInfo,
    availableReports,
    allIssues,
    hasErrors,
    availableTags,
    selectedTags,
    isDemoMode,
    toggleDemoMode,
    dataBaseDir,
    activeDataIsDemoSourced,
    // 統合フィルター条件 (2階層特定モデル & SDD-15)
    filterCriteria,
    setFilterCriteria,
    resetFilterCriteria,
    datasetVersionKey,
    availableCostCenters,
    availableOrganizations,
    availableGroups: hookAvailableGroups,
  } = useDashboardData('live_metrics');

  // ディープ分析用データ統合フック (自動定期収集データ / Monthly Report / User Upload 全対応)
  const {
    profiles: deepAnalysisProfiles,
    sourceInfo: deepAnalysisSourceInfo,
  } = useDeepAnalysisData({
    dataBaseDir,
    activeSource,
    currentData,
    selectedReportMonth,
    currentReportData,
    uploadedData,
    selectedTags,
  });

  // 2. 分析View選択 (要件4: モード切替からView切替への抜本移行)
  const [activeView, setActiveView] = useState<string>('overview');

  // 3. 集計軸 & フィルター状態
  const [currentGrouping, setCurrentGrouping] = useState<GroupingDimension>('department');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [userTableFilterStatus, setUserTableFilterStatus] = useState<UserSeatStatus | 'all'>('all');
  const [focusedUserLogin, setFocusedUserLogin] = useState<string>('');
  // 空文字時は ModelRadarView 側でアクティブ選択データの Top3 利用モデルが自動選択される (SDD-10)
  const [focusedRadarModelId, setFocusedRadarModelId] = useState<string>('');

  // 4. モーダル状態
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // 5. アコーディオン逐次開示フック (要件6: サマリー以外初期折りたたみ & 全展開/全収納)
  const { isExpanded, toggle, expandAll, collapseAll } = useAccordionGroup({
    initialExpandedIds: [],
    allIds: ALL_SECTION_IDS,
  });

  // 6. 表示テーマ管理 (Darkモードデフォルト & Lightモード切り替え)
  const { theme, toggleTheme } = useTheme();

  // Starボタン状態
  const [isStarred, setIsStarred] = useState<boolean>(false);
  const handleToggleStar = () => {
    if (!isStarred) {
      setIsStarred(true);
      window.open(repoInfo.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleScopeChange = (type: AnalysisScopeType, key: string) => {
    setScopeType(type);
    setSelectedKey(key);
  };

  const handleGroupingChange = (grouping: GroupingDimension) => {
    setCurrentGrouping(grouping);
    setSelectedGroup('all');
  };

  const handleFilterIdle = () => {
    setUserTableFilterStatus('idle');
    setActiveView('users');
    if (!isExpanded('users')) toggle('users');
  };

  const handleSelectUserForTrend = (login: string) => {
    setFocusedUserLogin(login);
    setActiveView('trend');
    if (!isExpanded('trend')) toggle('trend');
  };

  const handleOpenRadar = (modelId?: string) => {
    if (modelId) setFocusedRadarModelId(modelId);
    setActiveView('model_radar');
  };

  // Viewナビゲーションタブからの直接遷移時は個別モデル指定をリセットし、
  // モデル特性レーダーが常にアクティブ選択データのTop3利用モデルをデフォルト選択できるようにする
  // (特定モデルへのフォーカス遷移は handleOpenRadar 経由のみ)
  const handleSelectView = (view: string) => {
    if (view === 'model_radar') {
      setFocusedRadarModelId('');
    }
    setActiveView(view);
  };

  const handleOpenDeepAnalysis = (login?: string) => {
    if (login) setFocusedUserLogin(login);
    setActiveView('deep_analysis');
  };

  const isReportSource = activeSource === 'monthly_report' || activeSource === 'user_upload';

  // 月次レポート用 Cost Center 予算データの合成 (マスター枠との突合 or 実績ベース)
  const reportBudgets = useMemo<CostCenterBudget[]>(() => {
    if (!currentReportData?.by_cost_center) return [];

    const masterBudgets = rawCurrentData?.cost_center_budgets || [];
    const masterMap = new Map<string, CostCenterBudget>();
    masterBudgets.forEach((b) => masterMap.set(b.cost_center_name, b));

    const result: CostCenterBudget[] = [];
    const processedNames = new Set<string>();

    // 1. レポートに存在する各 Cost Center について予算を算出
    Object.entries(currentReportData.by_cost_center).forEach(([ccName, gs], idx) => {
      processedNames.add(ccName);
      const master = masterMap.get(ccName);
      const actualSpend = gs.total_cost_usd;
      const spendingLimit = master ? master.spending_limit_usd : 0;
      const freeTier = master ? master.free_tier_budget_usd : 0;
      // 予算の評価はパイプライン・フィルター再集計と同じ共通ルール (BudgetUtilizationRule) を使う
      const evaluation = BudgetUtilizationRule.evaluateUsd(spendingLimit, freeTier, actualSpend);

      result.push({
        cost_center_id: master?.cost_center_id || `cc-report-${idx + 1}`,
        cost_center_name: ccName,
        cost_center_code: master?.cost_center_code || ccName.toUpperCase().replace(/[^A-Z0-9]/g, '-'),
        spending_limit_usd: spendingLimit,
        free_tier_budget_usd: freeTier,
        current_spend_usd: actualSpend,
        ...evaluation,
      });
    });

    // 2. レポートには未登場だがマスターに存在する Cost Center
    masterBudgets.forEach((b) => {
      if (!processedNames.has(b.cost_center_name)) {
        result.push({
          ...b,
          current_spend_usd: 0,
          ...BudgetUtilizationRule.evaluateUsd(b.spending_limit_usd, b.free_tier_budget_usd, 0),
        });
      }
    });

    return result.sort((a, b) => b.current_spend_usd - a.current_spend_usd);
  }, [currentReportData, rawCurrentData]);

  // 画面最上部のデータ状態バナー (デモ表示 / ソース取得失敗)。実測・前回値・欠損・デモを画面上で区別する
  const dataStatusItems = useMemo(
    () => buildDataStatusItems({ indexMeta, activeSource, activeDataIsDemoSourced }),
    [indexMeta, activeSource, activeDataIsDemoSourced]
  );
  // 「実データを表示」ボタンは、ユーザーが明示的にデモを選択している場合だけ出す
  // (データ自身が is_mock_mode を宣言している場合は、戻す先の実データがない)
  const canSwitchToLive = isDemoMode && indexMeta?.is_mock_mode !== true ? () => toggleDemoMode(false) : undefined;

  // View Registry へ渡す描画コンテキスト (各ビューはこれだけに依存する)
  const viewContext: ViewContext = {
    activeSource,
    dataBaseDir,
    isReportSource,
    isDemoData: resolveIsDemoData({ indexMeta, activeSource, activeDataIsDemoSourced }),
    currentData,
    previousData,
    currentReportData,
    reportBudgets,
    deepAnalysisProfiles,
    deepAnalysisSourceInfo,
    focusedUserLogin,
    setFocusedUserLogin,
    focusedRadarModelId,
    userTableFilterStatus,
    currentGrouping,
    selectedGroup,
    setSelectedGroup,
    onGroupingChange: handleGroupingChange,
    accordion: { isExpanded, toggle, expandAll, collapseAll },
    onFilterIdle: handleFilterIdle,
    onSelectUserForTrend: handleSelectUserForTrend,
    onOpenRadar: handleOpenRadar,
    onOpenDeepAnalysis: handleOpenDeepAnalysis,
    onOpenTrendForModel: (modelId) => {
      setFocusedRadarModelId(modelId);
      setActiveView('trend');
    },
  };
  const navigationItems = defaultViewRegistry.getVisible(viewContext).map(toNavigationItem);

  const currentActiveMonth = selectedReportMonth || (selectedKey && selectedKey.length >= 7 ? selectedKey.slice(0, 7) : indexMeta?.default_scopes?.latest_month);

  return (
    <CurrencyProvider indexMeta={indexMeta} activeMonth={currentActiveMonth} dataBaseDir={dataBaseDir}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white transition-colors duration-200">
        {/* 1. トップナビゲーションバー (ヘッダー部にアクティブデータ選択を統合 ★要件1) */}
      <DashboardHeader
        activeSource={activeSource}
        onSelectSource={setActiveSource}
        indexMeta={indexMeta}
        scopeType={scopeType}
        selectedScopeKey={selectedKey}
        onSelectLiveScope={handleScopeChange}
        availableReports={availableReports}
        selectedReportMonth={selectedReportMonth}
        onSelectReportMonth={setSelectedReportMonth}
        uploadedData={uploadedData}
        onUploadFileLoaded={handleUploadFileLoaded}
        onClearUploadedFile={handleClearUploadedFile}
        filterCriteria={filterCriteria}
        onApplyFilterCriteria={setFilterCriteria}
        onResetFilterCriteria={resetFilterCriteria}
        availableCostCenters={availableCostCenters}
        availableOrganizations={availableOrganizations}
        availableGroups={hookAvailableGroups}
        availableTags={availableTags}
        currentScopeData={rawCurrentData}
        currentReportData={rawCurrentReportData}
        repoInfo={repoInfo}
        isStarred={isStarred}
        onToggleStar={handleToggleStar}
        allIssuesCount={allIssues.length}
        hasErrors={hasErrors}
        onOpenErrorModal={() => setIsErrorModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
        isDemoMode={isDemoMode}
        onToggleDemoMode={toggleDemoMode}
        activeDataIsDemoSourced={activeDataIsDemoSourced}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* 2. 分析Viewナビゲーションバー (6つのView切り替え ★要件4) */}
      <ViewNavigation
        activeView={activeView}
        onSelectView={handleSelectView}
        activeSource={activeSource}
        items={navigationItems}
      />

      {/* 3. メインコンテンツエリア (フルレスポンシブ & 1カラム垂直スタック ★要件5 & 構造的リアクティビティキーイング SDD-15) */}
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6" key={datasetVersionKey}>
        {/* データ状態バナー: デモ表示・ソース取得失敗を最上部で明示する (D-05 / C-06) */}
        <DataStatusBanner items={dataStatusItems} onSwitchToLive={canSwitchToLive} />

        {/* ローディング表示 */}
        {((activeSource === 'live_metrics' && loading) ||
          (isReportSource && reportLoading && !currentReportData)) && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400">データを読み込み中...</p>
          </div>
        )}

        {/* エラー表示 */}
        {((activeSource === 'live_metrics' && error && !loading) ||
          (isReportSource && reportError && !reportLoading)) && (
          <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <p className="font-semibold text-red-100 flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>データの読み込みに失敗しました:</span>
              </p>
              <p className="mt-1 font-mono text-red-300 break-all">{isReportSource ? reportError : error}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
              {!isDemoMode && (
                <button
                  type="button"
                  onClick={() => toggleDemoMode(true)}
                  data-testid="show-demo-data-button"
                  className="px-3 py-1.5 bg-amber-900/70 hover:bg-amber-800 text-amber-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-amber-700/60 cursor-pointer"
                >
                  <span>デモデータを表示</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsErrorModalOpen(true)}
                className="px-3 py-1.5 bg-rose-900/80 hover:bg-rose-800 text-rose-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-rose-700/60 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                <span>エラー詳細を確認</span>
              </button>
            </div>
          </div>
        )}

        {/* ライブ利用データなし表示 */}
        {activeSource === 'live_metrics' && !loading && noLiveData && (
          <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-200 text-xs space-y-1">
            <p className="font-semibold">📡 ライブ利用データはまだありません</p>
            <p className="mt-1">
              COPILOT_READ_TOKEN / COPILOT_ENTERPRISE を設定すると自動収集されます。ヘッダーのデータセレクターから
              Monthly Usage Report や User Upload (CSV) を選択して即座に分析を開始することも可能です。
            </p>
            {!isDemoMode && (
              <button
                type="button"
                onClick={() => toggleDemoMode(true)}
                data-testid="show-demo-data-button"
                className="mt-2 px-3 py-1.5 bg-amber-900/70 hover:bg-amber-800 text-amber-100 rounded-lg text-xs font-semibold transition-colors border border-amber-700/60 cursor-pointer"
              >
                デモデータを表示
              </button>
            )}
          </div>
        )}

        {/* 分析Viewの描画: View Registry が唯一の入口 (ビュー追加で App.tsx は変更しない) */}
        <ViewHost registry={defaultViewRegistry} activeView={activeView} ctx={viewContext} />
      </main>

      {/* 異常検出ログモーダル */}
      <ErrorLogModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        issues={allIssues}
        repoInfo={indexMeta?.repository}
      />

      {/* システム情報・作成日時 About モーダル */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        indexMeta={indexMeta}
        repoInfo={repoInfo}
      />
    </div>
    </CurrencyProvider>
  );
};

export default AppShell;
