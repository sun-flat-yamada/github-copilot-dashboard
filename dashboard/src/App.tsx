import React, { useState, useMemo } from 'react';
import {
  AnalysisScopeType,
  GroupingDimension,
  UserSeatStatus,
} from '../../src/types/copilot';
import { AnalysisViewId } from '../../src/types/views';
import { useDashboardData } from './hooks/useDashboardData';
import { useAccordionGroup } from './hooks/useAccordionGroup';
import { useDeepAnalysisData } from './hooks/useDeepAnalysisData';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { ViewNavigation } from './components/layout/ViewNavigation';
import { ScopeSelector } from './components/ScopeSelector';
import { GroupingSelector } from './components/GroupingSelector';
import { TagFilterBar } from './components/TagFilterBar';
import { CollapsibleSection } from './components/common/CollapsibleSection';
import { KpiSummaryCards } from './components/KpiSummaryCards';
import { IdleSeatAdvisor } from './components/IdleSeatAdvisor';
import { CostAllocationCharts } from './components/CostAllocationCharts';
import { UsageMetricsCharts } from './components/UsageMetricsCharts';
import { UserDetailTable } from './components/UserDetailTable';
import { ErrorLogModal } from './components/ErrorLogModal';
import { AboutModal } from './components/AboutModal';
import { CostCenterBudgetCards } from './components/CostCenterBudgetCards';
import { UserTrendViewer } from './components/UserTrendViewer';
import { MonthlyReportKpis } from './components/monthly-report/MonthlyReportKpis';
import { MonthlyReportCharts } from './components/monthly-report/MonthlyReportCharts';
import { MonthlyReportUserTable } from './components/monthly-report/MonthlyReportUserTable';
import { ModelRadarView } from './components/ModelRadarView';
import { DeepAnalysisView } from './components/DeepAnalysisView';
import {
  RefreshCw,
  PieChart as PieIcon,
  Users2,
  Landmark,
  Bot,
  BarChart3,
  AlertTriangle,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';

const ALL_SECTION_IDS = [
  'advisor',
  'allocation',
  'budget',
  'users',
  'trend',
  'usage',
  'report_charts',
  'report_users',
];

export const App: React.FC = () => {
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
    rawCurrentData,
    loading,
    error,
    noLiveData,
    selectedReportMonth,
    setSelectedReportMonth,
    currentReportData,
    rawCurrentReportData,
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
    handleToggleTag,
    handleClearTags,
    isDemoMode,
    toggleDemoMode,
  } = useDashboardData('live_metrics');

  // ディープ分析用データ統合フック (Live Metrics / Monthly Report / User Upload 全対応)
  const {
    profiles: deepAnalysisProfiles,
    sourceInfo: deepAnalysisSourceInfo,
  } = useDeepAnalysisData({
    activeSource,
    currentData,
    selectedReportMonth,
    currentReportData,
    uploadedData,
    selectedTags,
  });

  // 2. 分析View選択 (要件4: モード切替からView切替への抜本移行)
  const [activeView, setActiveView] = useState<AnalysisViewId>('overview');

  // 3. 集計軸 & フィルター状態
  const [currentGrouping, setCurrentGrouping] = useState<GroupingDimension>('department');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [userTableFilterStatus, setUserTableFilterStatus] = useState<UserSeatStatus | 'all'>('all');
  const [focusedUserLogin, setFocusedUserLogin] = useState<string>('');
  const [focusedRadarModelId, setFocusedRadarModelId] = useState<string>('claude-3-7-sonnet');

  // 4. モーダル状態
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // 5. アコーディオン逐次開示フック (要件6: サマリー以外初期折りたたみ & 全展開/全収納)
  const { isExpanded, toggle, expandAll, collapseAll } = useAccordionGroup({
    initialExpandedIds: [],
    allIds: ALL_SECTION_IDS,
  });

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

  // 利用可能グループ一覧
  const availableGroups = useMemo(() => {
    const set = new Set<string>();
    if (activeSource === 'live_metrics' && currentData) {
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
    } else if (currentReportData) {
      for (const u of currentReportData.user_details || []) {
        if (currentGrouping === 'department' && u.department) set.add(u.department);
        else if (currentGrouping === 'cost_center' && u.cost_center) set.add(u.cost_center);
        else if (currentGrouping === 'organization' && u.organization) set.add(u.organization);
      }
    }
    return Array.from(set).sort();
  }, [activeSource, currentData, currentReportData, currentGrouping]);

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

  const handleOpenDeepAnalysis = (login?: string) => {
    if (login) setFocusedUserLogin(login);
    setActiveView('deep_analysis');
  };

  // タグ絞り込み件数の算出
  const totalUserCount = useMemo(() => {
    if (activeSource === 'live_metrics') return rawCurrentData?.users.length ?? 0;
    return rawCurrentReportData?.user_details.length ?? 0;
  }, [activeSource, rawCurrentData, rawCurrentReportData]);

  const filteredUserCount = useMemo(() => {
    if (activeSource === 'live_metrics') return currentData?.users.length ?? 0;
    return currentReportData?.user_details.length ?? 0;
  }, [activeSource, currentData, currentReportData]);

  const isReportSource = activeSource === 'monthly_report' || activeSource === 'user_upload';

  return (
    <div className="min-h-screen bg-[#090d13] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
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
        repoInfo={repoInfo}
        isStarred={isStarred}
        onToggleStar={handleToggleStar}
        allIssuesCount={allIssues.length}
        hasErrors={hasErrors}
        onOpenErrorModal={() => setIsErrorModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
        isDemoMode={isDemoMode}
        onToggleDemoMode={toggleDemoMode}
      />

      {/* 2. 分析Viewナビゲーションバー (6つのView切り替え ★要件4) */}
      <ViewNavigation
        activeView={activeView}
        onSelectView={setActiveView}
        activeSource={activeSource}
      />

      {/* 3. メインコンテンツエリア (1カラム垂直スタック ★要件5) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6 w-full">
        {/* コントロールバー: スコープ表示 & 3軸グループセレクタ & タグANDフィルター ★要件7 */}
        <div className="flex flex-col space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shadow-sm">
          {/* Live Metrics 時のみスコープセレクタ表示 */}
          {activeSource === 'live_metrics' && (
            <ScopeSelector
              indexMeta={indexMeta}
              scopeType={scopeType}
              selectedKey={selectedKey}
              onScopeChange={handleScopeChange}
            />
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
            <GroupingSelector
              currentGrouping={currentGrouping}
              onGroupingChange={handleGroupingChange}
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
              availableGroups={availableGroups}
            />

            {/* アコーディオン全開閉ボタン (要件6) */}
            <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
              <button
                type="button"
                onClick={() => expandAll()}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                title="すべての個別要素を展開"
              >
                <ChevronsDown className="w-3.5 h-3.5" />
                <span>すべて展開</span>
              </button>

              <button
                type="button"
                onClick={collapseAll}
                className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                title="すべての個別要素を収納"
              >
                <ChevronsUp className="w-3.5 h-3.5" />
                <span>すべて折りたたむ</span>
              </button>
            </div>
          </div>

          {/* タグANDフィルターバー (要件7) */}
          <TagFilterBar
            availableTags={availableTags}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onClearTags={handleClearTags}
            filteredCount={filteredUserCount}
            totalCount={totalUserCount}
          />
        </div>

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
          <div className="p-4 bg-red-950/50 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold">データの読み込みに失敗しました:</p>
              <p className="mt-1 font-mono">{error || reportError}</p>
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
          </div>
        )}

        {/* ============================================================ */}
        {/* 分析Viewの描画 (ヘッダー選択データに対して提供 ★要件3 & 4) */}
        {/* ============================================================ */}

        {/* View 1: コスト配賦 & 総合サマリー (Overview) */}
        {activeView === 'overview' && (
          <div className="flex flex-col space-y-6 w-full">
            {/* サマリーブロック (常時展開 ★要件6) */}
            {activeSource === 'live_metrics' && currentData && (
              <KpiSummaryCards data={currentData} />
            )}
            {isReportSource && currentReportData && (
              <MonthlyReportKpis reportData={currentReportData} />
            )}

            {/* 個別要素ブロック (初期折りたたみ ★要件6, 1カラム垂直スタック ★要件5) */}
            {activeSource === 'live_metrics' && currentData && (
              <>
                <CollapsibleSection
                  id="advisor"
                  title="遊休シート・コスト削減アドバイザー"
                  subtitle="30日以上未利用の遊休アカウント検出と削減可能額"
                  icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                      削減可能: ${currentData.overview.idle_waste_usd.toFixed(2)}/月
                    </span>
                  }
                  isExpanded={isExpanded('advisor')}
                  onToggle={() => toggle('advisor')}
                >
                  <IdleSeatAdvisor data={currentData} onFilterIdleUsers={handleFilterIdle} />
                </CollapsibleSection>

                <CollapsibleSection
                  id="allocation"
                  title="グループ別 コスト配賦 & ライセンス稼働状況"
                  subtitle="選択仕訳軸（部署 / Cost Center / Org）に基づく費用シェアと稼働率"
                  icon={<PieIcon className="w-4 h-4 text-purple-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {Object.keys(currentData.by_department || {}).length} 部署
                    </span>
                  }
                  isExpanded={isExpanded('allocation')}
                  onToggle={() => toggle('allocation')}
                >
                  <CostAllocationCharts data={currentData} grouping={currentGrouping} />
                </CollapsibleSection>

                <CollapsibleSection
                  id="budget"
                  title="Cost Center 予算進捗管理"
                  subtitle="上限Budget枠・無料枠・請求対象額とアラート"
                  icon={<Landmark className="w-4 h-4 text-emerald-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {currentData.cost_center_budgets?.length || 0} Cost Centers
                    </span>
                  }
                  isExpanded={isExpanded('budget')}
                  onToggle={() => toggle('budget')}
                >
                  <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
                </CollapsibleSection>

                <CollapsibleSection
                  id="usage"
                  title="日次アクティビティ & 言語別受諾率推移"
                  subtitle="日次アクティブ推移、コード受諾率、主要プログラミング言語シェア"
                  icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      受諾率 {Math.round(currentData.overview.overall_acceptance_rate * 100)}%
                    </span>
                  }
                  isExpanded={isExpanded('usage')}
                  onToggle={() => toggle('usage')}
                >
                  <UsageMetricsCharts data={currentData} />
                </CollapsibleSection>

                <CollapsibleSection
                  id="users"
                  title="ユーザー別利用明細テーブル"
                  subtitle="全アカウントの利用ステータス、推計費用、最終アクティビティ"
                  icon={<Users2 className="w-4 h-4 text-blue-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {currentData.users.length} 名
                    </span>
                  }
                  isExpanded={isExpanded('users')}
                  onToggle={() => toggle('users')}
                >
                  <UserDetailTable
                    data={currentData}
                    filterStatus={userTableFilterStatus}
                    onSelectUserForTrend={handleSelectUserForTrend}
                    onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
                  />
                </CollapsibleSection>
              </>
            )}

            {isReportSource && currentReportData && (
              <>
                <CollapsibleSection
                  id="report_charts"
                  title="3軸集計・費用配賦 & AIモデル別・日別推移"
                  subtitle="部署/Cost Center別シェアとモデル別消費額"
                  icon={<PieIcon className="w-4 h-4 text-teal-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                      {currentReportData.model_breakdown.length} モデル
                    </span>
                  }
                  isExpanded={isExpanded('report_charts')}
                  onToggle={() => toggle('report_charts')}
                >
                  <MonthlyReportCharts reportData={currentReportData} />
                </CollapsibleSection>

                <CollapsibleSection
                  id="report_users"
                  title="ユーザー別月次明細テーブル"
                  subtitle="月次利用リクエスト数、消費額、主要モデル一覧"
                  icon={<Users2 className="w-4 h-4 text-blue-400" />}
                  summaryChips={
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {currentReportData.user_details.length} 名
                    </span>
                  }
                  isExpanded={isExpanded('report_users')}
                  onToggle={() => toggle('report_users')}
                >
                  <MonthlyReportUserTable
                    reportData={currentReportData}
                    onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
                  />
                </CollapsibleSection>
              </>
            )}
          </div>
        )}

        {/* View 2: ユーザー明細 & ランキング (Users) */}
        {activeView === 'users' && (
          <div className="flex flex-col space-y-6 w-full">
            {activeSource === 'live_metrics' && currentData && (
              <UserDetailTable
                data={currentData}
                filterStatus={userTableFilterStatus}
                onSelectUserForTrend={handleSelectUserForTrend}
                onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
              />
            )}

            {isReportSource && currentReportData && (
              <MonthlyReportUserTable
                reportData={currentReportData}
                onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
              />
            )}
          </div>
        )}

        {/* View 3: ユーザー別推移 (Trend) */}
        {activeView === 'trend' && (
          <div className="flex flex-col space-y-6 w-full">
            {activeSource === 'live_metrics' && currentData && (
              <UserTrendViewer
                profiles={currentData.user_profiles}
                initialSelectedLogin={focusedUserLogin}
                onOpenRadar={handleOpenRadar}
                onOpenDeepAnalysis={handleOpenDeepAnalysis}
              />
            )}

            {isReportSource && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-2">
                <Bot className="w-8 h-8 text-indigo-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">日次モデル推移ビュー</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  このビューは日次アクティビティ履歴を含む Live Metrics データで詳細表示されます。
                  ヘッダーのデータセレクターから「Live Metrics」に切り替えてご覧ください。
                </p>
              </div>
            )}
          </div>
        )}

        {/* View 5: CostCenter予算 (Budget) */}
        {activeView === 'budget' && (
          <div className="flex flex-col space-y-6 w-full">
            {activeSource === 'live_metrics' && currentData && (
              <>
                <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
                <CostAllocationCharts data={currentData} grouping="cost_center" />
              </>
            )}

            {isReportSource && currentReportData && (
              <div className="flex flex-col space-y-6 w-full">
                <MonthlyReportCharts reportData={currentReportData} />
              </div>
            )}
          </div>
        )}

        {/* View 6: ディープ分析 (Deep Analysis) */}
        {activeView === 'deep_analysis' && (
          <div className="flex flex-col space-y-6 w-full">
            <DeepAnalysisView
              aggregatedData={currentData}
              userProfiles={deepAnalysisProfiles}
              sourceInfo={deepAnalysisSourceInfo}
              initialSelectedLogin={focusedUserLogin}
            />
          </div>
        )}

        {/* View 7: AIモデル特性レーダー (Model Radar) */}
        {activeView === 'model_radar' && (
          <div className="w-full">
            <ModelRadarView
              initialSelectedModelId={focusedRadarModelId}
              aggregatedData={currentData}
              monthlyReportData={currentReportData}
              onNavigateToTrend={(modelId) => {
                setFocusedRadarModelId(modelId);
                setActiveView('trend');
              }}
            />
          </div>
        )}
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
  );
};

export default App;
