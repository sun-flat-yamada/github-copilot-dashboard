import React, { useState, useEffect, useMemo } from 'react';
import {
  AnalysisScopeType,
  DashboardAppMode,
  DataFetchIssue,
  GroupingDimension,
  IndexMetadata,
  MonthlyReportAggregatedData,
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
import { AboutModal } from './components/AboutModal';
import { CostCenterBudgetCards } from './components/CostCenterBudgetCards';
import { UserTrendViewer } from './components/UserTrendViewer';
import { GroupUsageRanking } from './components/GroupUsageRanking';
import { ModeSwitcher } from './components/ModeSwitcher';
import { MonthlyReportView } from './components/MonthlyReportView';
import { ReportDropzoneModal } from './components/ReportDropzoneModal';
import { ModelRadarView } from './components/ModelRadarView';
import { DeepAnalysisView } from './components/DeepAnalysisView';
import {
  Sparkles,
  RefreshCw,
  BarChart3,
  Users2,
  PieChart as PieIcon,
  AlertTriangle,
  AlertCircle,
  Trophy,
  Landmark,
  Bot,
  Compass,
  BrainCircuit,
  Info,
  Star,
} from 'lucide-react';

type TabType = 'overview' | 'ranking' | 'trend' | 'budget' | 'usage' | 'users';

export const App: React.FC = () => {
  // アプリケーション表示モード (Live Metrics vs Monthly Usage Report)
  const [appMode, setAppMode] = useState<DashboardAppMode>('live_metrics');

  const [indexMeta, setIndexMeta] = useState<IndexMetadata | null>(null);
  const [scopeType, setScopeType] = useState<AnalysisScopeType>('monthly');
  const [selectedKey, setSelectedKey] = useState<string>('2026-09');
  const [currentGrouping, setCurrentGrouping] = useState<GroupingDimension>('department');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [userTableFilterStatus, setUserTableFilterStatus] = useState<UserSeatStatus | 'all'>('all');
  const [focusedUserLogin, setFocusedUserLogin] = useState<string>('');
  const [focusedRadarModelId, setFocusedRadarModelId] = useState<string>('claude-3-7-sonnet');

  const [currentData, setCurrentData] = useState<ScopeAggregatedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // ライブメトリクス(Copilot Metrics/Seats API)データが1件も無い状態
  // (認証情報未設定・Enterprise Owner権限なし等)。エラーではなく想定内の状態として扱う。
  const [noLiveData, setNoLiveData] = useState<boolean>(false);

  // Monthly Usage Report モード用ステート
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>('2026-08');
  const [currentReportData, setCurrentReportData] = useState<MonthlyReportAggregatedData | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isDropzoneModalOpen, setIsDropzoneModalOpen] = useState<boolean>(false);

  // 異常検出モーダルの開閉
  const [isErrorModalOpen, setIsErrorModalOpen] = useState<boolean>(false);

  // About モーダルの開閉
  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);

  // Starボタンのローカル状態（付与のみ）
  const [isStarred, setIsStarred] = useState<boolean>(false);

  // 生成元 GitHub リポジトリ情報 (Fork セーフ・動的解決)
  const repoInfo = useMemo(() => {
    if (indexMeta?.repository?.owner && indexMeta?.repository?.name) {
      return {
        owner: indexMeta.repository.owner,
        name: indexMeta.repository.name,
        url: `https://github.com/${indexMeta.repository.owner}/${indexMeta.repository.name}`,
        isFork: !!indexMeta.repository.is_fork,
      };
    }
    // GitHub Pages ホスト名から自動判定 (<owner>.github.io/<repo>/)
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
      const owner = window.location.hostname.replace(/\.github\.io$/, '');
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const name = pathParts[0] || 'github-copilot-dashboard';
      return {
        owner,
        name,
        url: `https://github.com/${owner}/${name}`,
        isFork: false,
      };
    }
    return {
      owner: 'proud-corp',
      name: 'github-copilot-dashboard',
      url: 'https://github.com/proud-corp/github-copilot-dashboard',
      isFork: false,
    };
  }, [indexMeta]);

  // 利用可能なレポート月一覧
  const availableReports = useMemo(() => {
    return indexMeta?.available_reports || ['2026-09', '2026-08'];
  }, [indexMeta]);

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

        // デフォルトスコープの適用 (ライブメトリクスデータが存在する場合のみ)
        const defaultMonth = meta.default_scopes.latest_month;
        if (defaultMonth) {
          setSelectedKey(defaultMonth);
          setScopeType('monthly');
        } else {
          // COPILOT_READ_TOKEN / COPILOT_ENTERPRISE / COPILOT_ORGS が未設定、または
          // Enterprise Owner 権限が無い等でライブ利用データが1件も無い状態。
          // Monthly Usage Report や AIモデルベンチマークなど、認証情報に依存しない
          // 機能は影響を受けず引き続き利用できる。
          setNoLiveData(true);
          setLoading(false);
        }

        // デフォルトレポート月の適用 (レポートが存在する場合のみ)
        const defaultReport = meta.default_scopes.latest_report || meta.available_reports?.[0];
        if (defaultReport) {
          setSelectedReportMonth(defaultReport);
        }
      } catch (e: any) {
        console.error('Error fetching index:', e);
        setError(e.message || 'Failed to initialize analytics index');
      }
    }
    loadIndex();
  }, []);

  // 2. 選択スコープ (Live Metrics) のデータ取得
  useEffect(() => {
    // indexMeta のロード完了(初回)前、およびライブ利用データが1件も無い場合は
    // 存在しないファイルへのフェッチを試みない (index.json ロード前の初期値による
    // 競合フェッチも防止する)
    if (!indexMeta || noLiveData || !selectedKey || appMode !== 'live_metrics') return;

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
  }, [scopeType, selectedKey, appMode, indexMeta, noLiveData]);

  // 3. Monthly Usage Report データの取得
  useEffect(() => {
    if (!selectedReportMonth) return;
    // すでにローカルドロップの最新データがセットされており、同じ月なら再取得を避ける
    if (currentReportData?.source_type === 'local_drop' && currentReportData.report_month === selectedReportMonth) {
      return;
    }

    async function loadReportData() {
      setReportLoading(true);
      setReportError(null);
      try {
        const url = `./data/reports/${selectedReportMonth}.json`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Monthly report for ${selectedReportMonth} not found at ${url}`);
        }
        const data = (await res.json()) as MonthlyReportAggregatedData;
        setCurrentReportData(data);
      } catch (e: any) {
        console.error('Failed to load report data:', e);
        setReportError(e.message);
      } finally {
        setReportLoading(false);
      }
    }

    loadReportData();
  }, [selectedReportMonth, appMode]);

  const handleReportLoadedClientSide = (data: MonthlyReportAggregatedData) => {
    setCurrentReportData(data);
    setSelectedReportMonth(data.report_month);
    setAppMode('monthly_report');
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
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* ブランド & タイトル & Aboutボタン (十分な表示幅を確保し、縮小・オーバーラップを完全防止) */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 flex-shrink-0 min-w-max">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-tight whitespace-nowrap">
                  GitHub Copilot Analytics
                </h1>
                {/* About ボタン (クリックで分析ページ作成日時などのメタデータを表示) */}
                <button
                  onClick={() => setIsAboutModalOpen(true)}
                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors flex items-center cursor-pointer flex-shrink-0"
                  title="システム情報・分析作成日時 (About)"
                  aria-label="About"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden md:block whitespace-nowrap">
                3-Axis Allocation (Org, Cost Center, User Mapping)
              </p>
            </div>
          </div>

          {/* 右側アクション (モード切替、リポジトリリンク、エラー通知) */}
          <div className="flex items-center space-x-2 sm:space-x-3 text-xs min-w-0 flex-shrink justify-end">
            {/* モード切替スイッチ (レスポンシブ: 2xl以上でフル表示、2xl未満でアクティブモードのみドロップダウン) */}
            <ModeSwitcher
              currentMode={appMode}
              onModeChange={setAppMode}
              reportCount={availableReports.length}
            />

            {/* 生成元 GitHub リポジトリリンク & Star (Forkセーフ・動的解決) */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex-shrink-0">
              <a
                href={repoInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-800 p-2 rounded-l-xl transition-all group cursor-pointer"
                title={`GitHubリポジトリを開く: ${repoInfo.owner}/${repoInfo.name}\nURL: ${repoInfo.url}`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <div className="w-px h-4 bg-slate-700" />
              <button
                onClick={() => {
                  if (!isStarred) {
                    setIsStarred(true);
                    window.open(repoInfo.url, '_blank', 'noopener,noreferrer');
                  }
                }}
                className={`flex items-center justify-center p-2 rounded-r-xl transition-all group cursor-pointer ${
                  isStarred
                    ? 'text-amber-400 bg-slate-800'
                    : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                }`}
                title={isStarred ? 'Star on GitHub (Star済み)' : 'Star on GitHub'}
                aria-label="Star on GitHub"
              >
                <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400 text-amber-400' : 'transition-colors'}`} />
              </button>
            </div>

            {/* 異常検出 (Error / Warning) アイコンボタン */}
            {allIssues.length > 0 && (
              <button
                onClick={() => setIsErrorModalOpen(true)}
                className={`relative p-2 rounded-xl border transition-all flex items-center space-x-1.5 cursor-pointer shadow-md flex-shrink-0 ${
                  hasErrors
                    ? 'bg-rose-950/70 border-rose-800 text-rose-400 hover:bg-rose-900/80 hover:border-rose-600 animate-pulse'
                    : 'bg-amber-950/70 border-amber-800 text-amber-400 hover:bg-amber-900/80 hover:border-amber-600'
                }`}
                title="データ取得時の異常・エラー一覧を表示"
              >
                {hasErrors ? (
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span className="hidden md:inline-block text-xs font-bold">
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
      <main className={`${appMode === 'model_radar' ? 'max-w-[1600px]' : 'max-w-7xl'} mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col space-y-6 w-full`}>
        {/* モード A: Monthly Usage Report モード */}
        {appMode === 'monthly_report' && (
          <>
            {reportLoading && (
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

            {!reportLoading && currentReportData && (
              <MonthlyReportView
                reportData={currentReportData}
                availableReportMonths={availableReports}
                selectedMonth={selectedReportMonth}
                onSelectMonth={setSelectedReportMonth}
                onOpenDropzone={() => setIsDropzoneModalOpen(true)}
              />
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

                <button
                  onClick={() => handleOpenRadar()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/60 transition-all shadow-sm"
                  title="著名ベンチマーク最新データに基づくAIモデル特性レーダーを開く"
                >
                  <Compass className="w-3.5 h-3.5 text-purple-400" />
                  <span>モデル特性レーダー</span>
                </button>

                <button
                  onClick={() => handleOpenDeepAnalysis()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-cyan-300 hover:text-white bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 transition-all shadow-sm"
                  title="個人の利用実績から非効率AI利用パターンの兆候を深掘り診断"
                >
                  <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ディープ分析 (高度診断)</span>
                </button>
              </div>
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

      {/* 異常検出モーダル (幅80vw、高さ80vh) */}
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
