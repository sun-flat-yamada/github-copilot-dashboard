import React, { useState, useMemo } from 'react';
import {
  AnalysisScopeType,
  DashboardAppMode,
  GroupingDimension,
  UserSeatStatus,
} from '../../src/types/copilot';
import { useDashboardData } from './hooks/useDashboardData';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { DashboardNavTabs, TabType } from './components/layout/DashboardNavTabs';
import { ScopeSelector } from './components/ScopeSelector';
import { GroupingSelector } from './components/GroupingSelector';
import { KpiSummaryCards } from './components/KpiSummaryCards';
import { IdleSeatAdvisor } from './components/IdleSeatAdvisor';
import { CostAllocationCharts } from './components/CostAllocationCharts';
import { UsageMetricsCharts } from './components/UsageMetricsCharts';
import { UserDetailTable } from './components/UserDetailTable';
import { ErrorLogModal } from './components/ErrorLogModal';
import { AboutModal } from './components/AboutModal';
import { CostCenterBudgetCards } from './components/CostCenterBudgetCards';
import { UserTrendViewer } from './components/UserTrendViewer';
import { GroupUsageRanking } from './components/GroupUsageRanking';
import { MonthlyReportView } from './components/MonthlyReportView';
import { ReportDropzoneModal } from './components/ReportDropzoneModal';
import { ModelRadarView } from './components/ModelRadarView';
import { DeepAnalysisView } from './components/DeepAnalysisView';
import { RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // アプリケーション表示モード (Live Metrics vs Monthly Usage Report)
  const [appMode, setAppMode] = useState<DashboardAppMode>('live_metrics');

  // データ取得カスタムフック
  const {
    indexMeta,
    scopeType,
    setScopeType,
    selectedKey,
    setSelectedKey,
    currentData,
    loading,
    error,
    noLiveData,
    selectedReportMonth,
    setSelectedReportMonth,
    currentReportData,
    reportLoading,
    reportError,
    repoInfo,
    availableReports,
    allIssues,
    hasErrors,
    handleReportLoadedClientSide,
  } = useDashboardData(appMode);

  // UI状態
  const [currentGrouping, setCurrentGrouping] = useState<GroupingDimension>('department');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [userTableFilterStatus, setUserTableFilterStatus] = useState<UserSeatStatus | 'all'>('all');
  const [focusedUserLogin, setFocusedUserLogin] = useState<string>('');
  const [focusedRadarModelId, setFocusedRadarModelId] = useState<string>('claude-3-7-sonnet');

  // モーダル状態
  const [isDropzoneModalOpen, setIsDropzoneModalOpen] = useState<boolean>(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // Starボタンのローカル状態
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

  // 選択中の集計軸における利用可能グループ一覧
  const availableGroups = useMemo(() => {
    if (!currentData) return [];
    const set = new Set<string>();
    for (const p of currentData.user_profiles || []) {
      if (currentGrouping === 'department' && p.department) set.add(p.department);
      else if (currentGrouping === 'cost_center' && p.cost_center) set.add(p.cost_center);
      else if (currentGrouping === 'organization' && p.organization) set.add(p.organization);
    }
    if (set.size === 0) {
      const summaries =
        currentGrouping === 'department'
          ? currentData.by_department
          : currentGrouping === 'cost_center'
          ? currentData.by_cost_center
          : currentData.by_organization;
      for (const key of Object.keys(summaries || {})) {
        if (key) set.add(key);
      }
    }
    return Array.from(set).sort();
  }, [currentData, currentGrouping]);

  const handleFilterIdle = () => {
    setUserTableFilterStatus('idle');
    setActiveTab('users');
  };

  const handleSelectUserForTrend = (login: string) => {
    setFocusedUserLogin(login);
    setActiveTab('trend');
  };

  const handleOpenRadar = (modelId?: string) => {
    if (modelId) {
      setFocusedRadarModelId(modelId);
    }
    setAppMode('model_radar');
  };

  const handleOpenDeepAnalysis = (login?: string) => {
    if (login) {
      setFocusedUserLogin(login);
    }
    setAppMode('deep_analysis');
  };

  return (
    <div className="min-h-screen bg-[#090d13] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* 1. トップナビゲーションバー */}
      <DashboardHeader
        appMode={appMode}
        onModeChange={setAppMode}
        availableReportsCount={availableReports.length}
        repoInfo={repoInfo}
        isStarred={isStarred}
        onToggleStar={handleToggleStar}
        allIssuesCount={allIssues.length}
        hasErrors={hasErrors}
        onOpenErrorModal={() => setIsErrorModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
      />

      {/* 2. メインコンテンツエリア */}
      <main className={`${appMode === 'model_radar' ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6 w-full`}>
        {/* モード A: Monthly Usage Report モード */}
        {appMode === 'monthly_report' && (
          <>
            {reportLoading && !currentReportData && (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-sm text-slate-400">Monthly Usage Report を解析・ロード中...</p>
              </div>
            )}

            {reportError && !reportLoading && (
              <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold">レポートデータの読み込みに失敗しました:</p>
                  <p className="mt-1 font-mono">{reportError}</p>
                </div>
                <button
                  onClick={() => setIsDropzoneModalOpen(true)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                >
                  手元の CSV をドロップ
                </button>
              </div>
            )}

            {currentReportData && (
              <div className={reportLoading ? 'opacity-60 pointer-events-none transition-opacity duration-200' : 'transition-opacity duration-200'}>
                <MonthlyReportView
                  reportData={currentReportData}
                  availableReportMonths={availableReports}
                  selectedMonth={selectedReportMonth}
                  onSelectMonth={setSelectedReportMonth}
                  onOpenDropzone={() => setIsDropzoneModalOpen(true)}
                />
              </div>
            )}
          </>
        )}

        {/* モード B: API 連携 Live Metrics モード */}
        {appMode === 'live_metrics' && (
          <>
            {/* スコープ選択コントロール */}
            <ScopeSelector
              indexMeta={indexMeta}
              scopeType={scopeType}
              selectedKey={selectedKey}
              onScopeChange={handleScopeChange}
            />

            {/* コントロールバー: グループ軸選択 & ナビゲーションタブ */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <GroupingSelector
                currentGrouping={currentGrouping}
                onGroupingChange={handleGroupingChange}
                selectedGroup={selectedGroup}
                onGroupChange={setSelectedGroup}
                availableGroups={availableGroups}
              />

              <DashboardNavTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                onOpenRadar={() => handleOpenRadar()}
                onOpenDeepAnalysis={() => handleOpenDeepAnalysis()}
              />
            </div>

            {/* ローディング / エラー / データなし表示 */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-slate-400">分析データをロード中...</p>
              </div>
            )}

            {!loading && noLiveData && (
              <div className="p-4 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-200 text-xs space-y-1">
                <p className="font-semibold">📡 ライブ利用データはまだありません</p>
                <p className="mt-1">
                  COPILOT_READ_TOKEN / COPILOT_ENTERPRISE(または COPILOT_ORGS)を設定すると、Copilot Metrics /
                  Seats の集計が表示されます。Enterprise Owner 権限が無い場合でも、Monthly Usage Report や AI
                  モデルベンチマークなど、認証情報に依存しない機能は引き続きご利用いただけます。
                </p>
              </div>
            )}

            {error && !loading && !noLiveData && (
              <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
                <p className="font-semibold">データの読み込みに失敗しました:</p>
                <p className="mt-1 font-mono">{error}</p>
              </div>
            )}

            {/* データ表示 */}
            {!loading && currentData && (
              <div className="flex flex-col space-y-6">
                {/* KPI サマリー */}
                <KpiSummaryCards data={currentData} />

                {/* 遊休シート・コスト最適化アドバイザー */}
                <IdleSeatAdvisor data={currentData} onFilterIdleUsers={handleFilterIdle} />

                {/* タブに応じた表示 */}
                {activeTab === 'overview' && (
                  <div className="flex flex-col space-y-6">
                    <CostAllocationCharts data={currentData} grouping={currentGrouping} />
                    <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
                    <UserDetailTable
                      data={currentData}
                      filterStatus={userTableFilterStatus}
                      onSelectUserForTrend={handleSelectUserForTrend}
                      onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
                    />
                  </div>
                )}

                {activeTab === 'ranking' && (
                  <div className="flex flex-col space-y-6">
                    <GroupUsageRanking
                      data={currentData}
                      grouping={currentGrouping}
                      selectedGroup={selectedGroup}
                      onGroupChange={setSelectedGroup}
                      onSelectUserForTrend={handleSelectUserForTrend}
                    />
                  </div>
                )}

                {activeTab === 'trend' && (
                  <div className="flex flex-col space-y-6">
                    <UserTrendViewer
                      profiles={currentData.user_profiles}
                      initialSelectedLogin={focusedUserLogin}
                      onOpenRadar={handleOpenRadar}
                      onOpenDeepAnalysis={handleOpenDeepAnalysis}
                    />
                  </div>
                )}

                {activeTab === 'budget' && (
                  <div className="flex flex-col space-y-6">
                    <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
                    <CostAllocationCharts data={currentData} grouping="cost_center" />
                  </div>
                )}

                {activeTab === 'usage' && (
                  <div className="flex flex-col space-y-6">
                    <UsageMetricsCharts data={currentData} />
                    <CostAllocationCharts data={currentData} grouping={currentGrouping} />
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    <UserDetailTable
                      data={currentData}
                      filterStatus={userTableFilterStatus}
                      onSelectUserForTrend={handleSelectUserForTrend}
                      onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* モード C: AIモデル特性レーダー モード */}
        {appMode === 'model_radar' && (
          <ModelRadarView
            initialSelectedModelId={focusedRadarModelId}
            aggregatedData={currentData}
            monthlyReportData={currentReportData}
            onNavigateToTrend={(modelId) => {
              setFocusedRadarModelId(modelId);
              setActiveTab('trend');
              setAppMode('live_metrics');
            }}
          />
        )}

        {/* モード D: ディープ分析 (高度診断) モード */}
        {appMode === 'deep_analysis' && (
          <>
            {loading && (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
                <p className="text-sm text-slate-400">ディープ分析用データをロード中...</p>
              </div>
            )}

            {!loading && currentData && (
              <DeepAnalysisView
                aggregatedData={currentData}
                initialSelectedLogin={focusedUserLogin}
              />
            )}

            {!loading && !currentData && (
              <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs">
                <p className="font-semibold">分析対象データの取得に失敗しました。</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* 異常検出モーダル */}
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

      {/* ローカル CSV ドロップゾーンモーダル */}
      <ReportDropzoneModal
        isOpen={isDropzoneModalOpen}
        onClose={() => setIsDropzoneModalOpen(false)}
        onReportLoaded={handleReportLoadedClientSide}
      />
    </div>
  );
};

export default App;
