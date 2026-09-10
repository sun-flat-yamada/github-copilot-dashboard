import React, { useState, useEffect, useMemo } from 'react';
import {
  AnalysisScopeType,
  DataFetchIssue,
  GroupingDimension,
  IndexMetadata,
  ScopeAggregatedData,
  UserSeatStatus,
} from '../../src/types/copilot';
import { ScopeSelector } from './components/ScopeSelector';
import { GroupingSelector } from './components/GroupingSelector';
import { KpiSummaryCards } from './components/KpiSummaryCards';
import { IdleSeatAdvisor } from './components/IdleSeatAdvisor';
import { CostAllocationCharts } from './components/CostAllocationCharts';
import { UsageMetricsCharts } from './components/UsageMetricsCharts';
import { UserDetailTable } from './components/UserDetailTable';
import { ErrorLogModal } from './components/ErrorLogModal';
import { CostCenterBudgetCards } from './components/CostCenterBudgetCards';
import { UserTrendViewer } from './components/UserTrendViewer';
import { GroupUsageRanking } from './components/GroupUsageRanking';
import {
  Sparkles,
  GitFork,
  RefreshCw,
  BarChart3,
  Users2,
  PieChart as PieIcon,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Trophy,
  Landmark,
  Bot,
} from 'lucide-react';

type TabType = 'overview' | 'ranking' | 'trend' | 'budget' | 'usage' | 'users';

export const App: React.FC = () => {
  const [indexMeta, setIndexMeta] = useState<IndexMetadata | null>(null);
  const [scopeType, setScopeType] = useState<AnalysisScopeType>('monthly');
  const [selectedKey, setSelectedKey] = useState<string>('2026-09');
  const [currentGrouping, setCurrentGrouping] = useState<GroupingDimension>('department');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [userTableFilterStatus, setUserTableFilterStatus] = useState<UserSeatStatus | 'all'>('all');
  const [focusedUserLogin, setFocusedUserLogin] = useState<string>('');

  const [currentData, setCurrentData] = useState<ScopeAggregatedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 異常検出モーダルの開閉
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);

  // 全体の異常一覧 (indexMeta と currentData から統合)
  const allIssues: DataFetchIssue[] = useMemo(() => {
    const map = new Map<string, DataFetchIssue>();
    for (const issue of indexMeta?.issues || []) {
      map.set(issue.id, issue);
    }
    for (const issue of currentData?.issues || []) {
      map.set(issue.id, issue);
    }
    return Array.from(map.values());
  }, [indexMeta, currentData]);

  const hasErrors = allIssues.some((i) => i.severity === 'error');

  // 1. 初回インデックスのロード
  useEffect(() => {
    async function loadIndex() {
      try {
        const res = await fetch('./data/index.json');
        if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
        const meta = (await res.json()) as IndexMetadata;
        setIndexMeta(meta);

        // デフォルトスコープの適用
        const defaultMonth = meta.default_scopes.latest_month;
        setSelectedKey(defaultMonth);
        setScopeType('monthly');
      } catch (e: any) {
        console.error('Error fetching index:', e);
        setError(e.message || 'Failed to initialize analytics index');
      }
    }
    loadIndex();
  }, []);

  // 2. 選択スコープのデータ取得
  useEffect(() => {
    if (!selectedKey) return;

    async function loadScopeData() {
      setLoading(true);
      setError(null);
      try {
        let subDir = 'daily';
        let fileName = `${selectedKey}.json`;

        if (scopeType === 'monthly') {
          subDir = 'monthly';
        } else if (scopeType === 'custom') {
          subDir = 'custom';
          fileName = `${selectedKey.replace(/[:\/]/g, '_')}.json`;
        }

        const url = `./data/${subDir}/${fileName}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Data for scope ${scopeType} (${selectedKey}) not found at ${url}`);
        }
        const data = (await res.json()) as ScopeAggregatedData;
        setCurrentData(data);
      } catch (e: any) {
        console.error('Failed to load scope data:', e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadScopeData();
  }, [scopeType, selectedKey]);

  const handleScopeChange = (type: AnalysisScopeType, key: string) => {
    setScopeType(type);
    setSelectedKey(key);
  };

  const handleFilterIdle = () => {
    setUserTableFilterStatus('idle');
    setActiveTab('users');
  };

  const handleSelectUserForTrend = (login: string) => {
    setFocusedUserLogin(login);
    setActiveTab('trend');
  };

  return (
    <div className="min-h-screen bg-[#090d13] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* 1. トップナビゲーションバー */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-white tracking-tight">GitHub Copilot Analytics</h1>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700/80">
                  2026.09 LTS
                </span>
                <span className="hidden sm:inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Fork-Safe Storage</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">3-Axis Allocation (Org, Cost Center, User Mapping)</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            {indexMeta && (
              <div className="hidden md:flex items-center space-x-2 text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
                <GitFork className="w-3.5 h-3.5 text-slate-500" />
                <span>Repo: <strong className="text-slate-200">{indexMeta.repository.owner}/{indexMeta.repository.name}</strong></span>
                <span className="text-slate-600">|</span>
                <span>更新: <strong className="text-slate-300">{new Date(indexMeta.generated_at).toLocaleString('ja-JP')}</strong></span>
              </div>
            )}

            {/* 異常検出 (Error / Warning) アイコンボタン */}
            {allIssues.length > 0 && (
              <button
                onClick={() => setIsErrorModalOpen(true)}
                className={`relative p-2 rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer shadow-md ${
                  hasErrors
                    ? 'bg-rose-950/70 border-rose-800 text-rose-400 hover:bg-rose-900/80 hover:border-rose-600 animate-pulse'
                    : 'bg-amber-950/70 border-amber-800 text-amber-400 hover:bg-amber-900/80 hover:border-amber-600'
                }`}
                title="データ取得時の異常・エラー一覧を表示"
              >
                {hasErrors ? (
                  <AlertCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <span className="hidden sm:inline-block text-xs font-bold">
                  {hasErrors ? 'エラー検知' : '警告あり'}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    hasErrors ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
                  }`}
                >
                  {allIssues.length}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. メインコンテンツエリア */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6 w-full">
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
            onGroupingChange={setCurrentGrouping}
          />

          <div className="inline-flex flex-wrap rounded-lg bg-slate-900 border border-slate-800 p-1 self-start lg:self-auto gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieIcon className="w-3.5 h-3.5" />
              <span>コスト配賦</span>
            </button>

            <button
              onClick={() => setActiveTab('ranking')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'ranking'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>グループ内ランキング</span>
            </button>

            <button
              onClick={() => setActiveTab('trend')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'trend'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>ユーザー別モデル推移</span>
            </button>

            <button
              onClick={() => setActiveTab('budget')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'budget'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>CostCenter予算</span>
            </button>

            <button
              onClick={() => setActiveTab('usage')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'usage'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>利用量・AI分析</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === 'users'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>ユーザー明細</span>
            </button>
          </div>
        </div>

        {/* ローディング / エラー表示 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-sm text-slate-400">分析データをロード中...</p>
          </div>
        )}

        {error && !loading && (
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
                />
              </div>
            )}

            {activeTab === 'ranking' && (
              <div className="flex flex-col space-y-6">
                <GroupUsageRanking
                  data={currentData}
                  onSelectUserForTrend={handleSelectUserForTrend}
                />
              </div>
            )}

            {activeTab === 'trend' && (
              <div className="flex flex-col space-y-6">
                <UserTrendViewer
                  profiles={currentData.user_profiles}
                  initialSelectedLogin={focusedUserLogin}
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
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* 異常検出モーダル (幅80vw、高さ80vh) */}
      <ErrorLogModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        issues={allIssues}
        repoInfo={indexMeta?.repository}
      />
    </div>
  );
};

export default App;
