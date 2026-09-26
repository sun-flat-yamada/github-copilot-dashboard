import React, { useState, useMemo } from 'react';
import { AnalysisViewId } from '../../src/types/views';
import { AnalysisScopeType, DataSourceType, GroupingDimension } from '../../src/types/copilot';
import { useStoreSelector } from '../../src/frameworks/react/hooks/useStoreSelector';
import { useStoreDispatch } from '../../src/frameworks/react/hooks/useStoreDispatch';
import { useViewPlugin } from '../../src/frameworks/react/hooks/useViewPlugin';
import { useTheme } from './hooks/useTheme';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { ViewNavigation } from './components/layout/ViewNavigation';
import { ScopeSelector } from './components/ScopeSelector';
import { GroupingSelector } from './components/GroupingSelector';
import { TagFilterBar } from './components/TagFilterBar';
import { ErrorLogModal } from './components/ErrorLogModal';
import { AboutModal } from './components/AboutModal';
import { RefreshCw, AlertCircle } from 'lucide-react';

export const AppV2: React.FC = () => {
  const dispatch = useStoreDispatch();
  const activeSource = useStoreSelector((s) => s.activeSource);
  const scopeType = useStoreSelector((s) => s.activeScopeType);
  const selectedKey = useStoreSelector((s) => s.activeScopeKey);
  const selectedTags = useStoreSelector((s) => s.selectedTags);
  const grouping = useStoreSelector((s) => s.groupingDimension);
  const selectedGroup = useStoreSelector((s) => s.selectedGroup);
  const userStatusFilter = useStoreSelector((s) => s.userStatusFilter);
  const indexMeta = useStoreSelector((s) => s.indexMeta);
  const isLoading = useStoreSelector((s) => s.isLoading);
  const isDemoMode = useStoreSelector((s) => s.isDemoMode);
  const issues = useStoreSelector((s) => s.issues);
  const derived = useStoreSelector((s) => s.derived);
  const deepAnalysisProfiles = useStoreSelector((s) => s.deepAnalysisProfiles);

  const [activeView, setActiveView] = useState<AnalysisViewId>('overview');
  const [focusedUserLogin, setFocusedUserLogin] = useState<string>('');
  const [focusedRadarModelId, setFocusedRadarModelId] = useState<string>('');
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isStarred, setIsStarred] = useState<boolean>(false);

  const { theme, toggleTheme } = useTheme();
  const { plugin, activeViewId: resolvedViewId, isDataReady, presenter } = useViewPlugin(activeView);

  const filteredScopeData = derived.get('filteredScopeData') as any;
  const filteredReportData = derived.get('filteredReportData') as any;
  const availableTags = (derived.get('availableTags') as string[]) || [];
  const availableGroups = (derived.get('availableGroups') as string[]) || [];

  const repoInfo = useMemo(() => ({
    owner: indexMeta?.repository?.owner || 'owner',
    name: indexMeta?.repository?.name || 'repo',
    url: `https://github.com/${indexMeta?.repository?.owner || 'owner'}/${indexMeta?.repository?.name || 'repo'}`,
    isFork: !!indexMeta?.repository?.is_fork,
    is_fork: !!indexMeta?.repository?.is_fork,
  }), [indexMeta]);

  const ActiveComponent = plugin?.component;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <DashboardHeader
        activeSource={activeSource}
        onSelectSource={(source: DataSourceType) => dispatch({ type: 'SET_ACTIVE_SOURCE', source })}
        indexMeta={indexMeta}
        scopeType={scopeType}
        selectedScopeKey={selectedKey}
        onSelectLiveScope={(type: AnalysisScopeType, key: string) => dispatch({ type: 'SET_SCOPE', scopeType: type, key })}
        availableReports={indexMeta?.available_reports || []}
        selectedReportMonth={indexMeta?.available_reports?.[0] || ''}
        onSelectReportMonth={() => {}}
        uploadedData={null}
        onUploadFileLoaded={(data) => dispatch({ type: 'SET_UPLOADED_DATA', data })}
        onClearUploadedFile={() => dispatch({ type: 'SET_UPLOADED_DATA', data: null })}
        repoInfo={repoInfo}
        isStarred={isStarred}
        onToggleStar={() => setIsStarred(!isStarred)}
        allIssuesCount={issues.length}
        hasErrors={issues.some((i) => i.severity === 'error')}
        onOpenErrorModal={() => setIsErrorModalOpen(true)}
        onOpenAboutModal={() => setIsAboutModalOpen(true)}
        isDemoMode={isDemoMode}
        onToggleDemoMode={() => dispatch({ type: 'SET_DEMO_MODE', isDemo: !isDemoMode })}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <ViewNavigation
        activeView={resolvedViewId}
        onSelectView={(view: AnalysisViewId) => {
          setFocusedUserLogin('');
          setActiveView(view);
        }}
        activeSource={activeSource}
      />

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6">
        <div className="flex flex-col space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80 shadow-sm">
          {activeSource === 'live_metrics' && (
            <ScopeSelector
              indexMeta={indexMeta}
              scopeType={scopeType}
              selectedKey={selectedKey}
              onScopeChange={(type, key) => dispatch({ type: 'SET_SCOPE', scopeType: type, key })}
            />
          )}

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
            <GroupingSelector
              currentGrouping={grouping}
              onGroupingChange={(dim: GroupingDimension) => dispatch({ type: 'SET_GROUPING', dimension: dim })}
              selectedGroup={selectedGroup || 'all'}
              onGroupChange={(grp: string) => dispatch({ type: 'SET_SELECTED_GROUP', group: grp })}
              availableGroups={availableGroups}
            />
          </div>

          <TagFilterBar
            availableTags={availableTags}
            selectedTags={selectedTags}
            onToggleTag={(tag: string) => dispatch({ type: 'TOGGLE_TAG', tag })}
            onClearTags={() => dispatch({ type: 'SET_TAGS', tags: [] })}
            filteredCount={filteredScopeData?.users?.length || 0}
            totalCount={indexMeta?.summary?.total_seats || 0}
          />
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400">データを読み込み中...</p>
          </div>
        )}

        {!isDataReady && !isLoading && (
          <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>このViewに必要な派生データを計算中です...</span>
          </div>
        )}

        {ActiveComponent && (
          <ActiveComponent
            presenter={presenter}
            activeSource={activeSource}
            currentData={filteredScopeData}
            currentReportData={filteredReportData}
            deepAnalysisProfiles={deepAnalysisProfiles}
            focusedUserLogin={focusedUserLogin}
            setFocusedUserLogin={setFocusedUserLogin}
            focusedRadarModelId={focusedRadarModelId}
            setFocusedRadarModelId={setFocusedRadarModelId}
            onNavigateToView={(viewId: AnalysisViewId) => setActiveView(viewId)}
            currentGrouping={grouping}
            selectedGroup={selectedGroup || 'all'}
            onGroupingChange={(dim: GroupingDimension) => dispatch({ type: 'SET_GROUPING', dimension: dim })}
            onGroupChange={(grp: string) => dispatch({ type: 'SET_SELECTED_GROUP', group: grp })}
            availableGroups={availableGroups}
            userTableFilterStatus={userStatusFilter}
          />
        )}
      </main>

      <ErrorLogModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        issues={issues}
        repoInfo={repoInfo}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        indexMeta={indexMeta}
        repoInfo={repoInfo}
      />
    </div>
  );
};

export default AppV2;
