import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AnalysisScopeType,
  DataSourceType,
  DataFetchIssue,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  FilterCriteria,
  DEFAULT_FILTER_CRITERIA,
  GroupSummary,
} from '../../../src/types/copilot';
import {
  resolveDataPath,
  getCandidateDataUrls,
  fetchDataWithFallback,
} from '../utils/pathResolver';
import { buildFilteredModelBreakdown } from '../utils/reportModelBreakdown';
import {
  applyFilterCriteriaToLiveScope,
  generateDatasetVersionKey,
  isFilterCriteriaActive,
  countActiveFilterConditions,
  getFilterSummaryBadges,
  matchUserWithCriteria,
  FilterableUser,
} from '../utils/filterEngine';

export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  isFork: boolean;
}

import { DemoModeService } from '../../../src/application/services/DemoModeService';
export const checkIsDemoMode = DemoModeService.checkIsDemoMode;

export function sliceScopeDataByDateRange(
  baseData: ScopeAggregatedData,
  startDate: string,
  endDate: string
): ScopeAggregatedData {
  const filteredTrends = (baseData.daily_trends || []).filter(
    (d) => d.date >= startDate && d.date <= endDate
  );
  const daysCount = filteredTrends.length || 1;

  const totalSpend = filteredTrends.reduce((sum, d) => sum + (d.daily_cost_usd || 0), 0);
  const totalSuggestions = filteredTrends.reduce((sum, d) => sum + (d.suggestions || 0), 0);
  const totalAcceptances = filteredTrends.reduce((sum, d) => sum + (d.acceptances || 0), 0);
  const totalChats = filteredTrends.reduce((sum, d) => sum + (d.chats || 0), 0);
  const totalPrSummaries = filteredTrends.reduce((sum, d) => sum + (d.pr_summaries || 0), 0);
  const acceptanceRate = totalSuggestions > 0 ? totalAcceptances / totalSuggestions : 0;

  const filteredUserProfiles = (baseData.user_profiles || []).map((p) => {
    const history = (p.daily_history || []).filter(
      (h) => h.date >= startDate && h.date <= endDate
    );
    const userSuggestions = history.reduce((s, h) => s + (h.suggestions || 0), 0);
    const userAcceptances = history.reduce((s, h) => s + (h.acceptances || 0), 0);
    const userChats = history.reduce((s, h) => s + (h.total_chats || 0), 0);
    const userSpend = history.reduce((s, h) => s + (h.daily_cost_usd || 0), 0);
    const userRate = userSuggestions > 0 ? userAcceptances / userSuggestions : 0;
    return {
      ...p,
      daily_history: history,
      total_suggestions: userSuggestions,
      total_acceptances: userAcceptances,
      total_chats: userChats,
      acceptance_rate: userRate,
      total_cost_usd: Math.round(userSpend * 100) / 100,
    };
  });

  const activeUsersCount = filteredUserProfiles.filter(
    (p) => (p.total_suggestions || 0) > 0 || (p.total_chats || 0) > 0
  ).length;

  return {
    ...baseData,
    scope_type: 'custom',
    scope_key: `custom:${startDate}_${endDate}`,
    date_range: {
      start: startDate,
      end: endDate,
      days_count: daysCount,
    },
    daily_trends: filteredTrends,
    user_profiles: filteredUserProfiles,
    overview: {
      ...baseData.overview,
      total_spend_usd: Math.round(totalSpend * 100) / 100,
      total_suggestions: totalSuggestions,
      total_acceptances: totalAcceptances,
      overall_acceptance_rate: Math.round(acceptanceRate * 10000) / 10000,
      total_chats: totalChats,
      total_pr_summaries: totalPrSummaries,
      active_users: activeUsersCount,
    },
  };
}

export function useDashboardData(initialSource: DataSourceType = 'live_metrics') {
  const [activeSource, setActiveSource] = useState<DataSourceType>(initialSource);
  const [indexMeta, setIndexMeta] = useState<IndexMetadata | null>(null);

  // DEMOモード状態 (URLパラメータ・環境変数・手動切替)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(checkIsDemoMode);

  // DEMOモード時は ./data/demo、LIVEモード時は ./data を参照
  const dataBaseDir = useMemo(() => {
    return isDemoMode ? './data/demo' : './data';
  }, [isDemoMode]);

  // Live Metrics スコープ
  const [scopeType, setScopeType] = useState<AnalysisScopeType>('monthly');
  const [selectedKey, setSelectedKey] = useState<string>('2026-09');
  const [currentData, setCurrentData] = useState<ScopeAggregatedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [noLiveData, setNoLiveData] = useState<boolean>(false);
  // 現在表示中の Live Metrics データが実際に /demo/ パスから取得されたものか (ソース単位で追跡)
  const [scopeDataIsDemoSourced, setScopeDataIsDemoSourced] = useState<boolean | undefined>(undefined);

  // キャッシュ (取得元が demo パスだったかどうかも併せて保持する)
  const currentDataRef = useRef<ScopeAggregatedData | null>(null);
  currentDataRef.current = currentData;
  const scopeDataCacheRef = useRef<Map<string, { data: ScopeAggregatedData; isDemoSourced: boolean }>>(new Map());

  // Monthly Usage Report スコープ
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>('2026-08');
  const [currentReportData, setCurrentReportData] = useState<MonthlyReportAggregatedData | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const currentReportDataRef = useRef<MonthlyReportAggregatedData | null>(null);
  currentReportDataRef.current = currentReportData;
  const reportCacheRef = useRef<Map<string, { data: MonthlyReportAggregatedData; isDemoSourced: boolean }>>(new Map());
  // 現在表示中の Monthly Report データが実際に /demo/ パスから取得されたものか (ソース単位で追跡)
  const [reportDataIsDemoSourced, setReportDataIsDemoSourced] = useState<boolean | undefined>(undefined);

  // User Upload スコープ (On-demand)
  const [uploadedData, setUploadedData] = useState<MonthlyReportAggregatedData | null>(null);

  // 統合フィルター条件 (2階層特定モデル: 組織財務・属性タグ・ユーザー正規表現)
  const [filterCriteria, setFilterCriteria] = useState<FilterCriteria>(DEFAULT_FILTER_CRITERIA);
  const selectedTags = filterCriteria.tags;

  // 生成元 GitHub リポジトリ情報 (Fork セーフ・動的解決)
  const repoInfo: RepoInfo = useMemo(() => {
    if (indexMeta?.repository?.owner && indexMeta?.repository?.name) {
      return {
        owner: indexMeta.repository.owner,
        name: indexMeta.repository.name,
        url: `https://github.com/${indexMeta.repository.owner}/${indexMeta.repository.name}`,
        isFork: !!indexMeta.repository.is_fork,
      };
    }
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

  // クライアント側ランタイムfetchエラー追跡状態
  const [runtimeIssues, setRuntimeIssues] = useState<Map<string, DataFetchIssue>>(new Map());

  const addRuntimeIssue = useCallback((issue: DataFetchIssue) => {
    setRuntimeIssues((prev) => {
      const next = new Map(prev);
      next.set(issue.id, issue);
      return next;
    });
  }, []);

  const clearRuntimeIssue = useCallback((idPrefix: string) => {
    setRuntimeIssues((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.includes(idPrefix)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  // 全体の異常一覧 (indexMeta由来 + currentData由来 + クライアント側ランタイムエラー)
  const allIssues: DataFetchIssue[] = useMemo(() => {
    const map = new Map<string, DataFetchIssue>();
    for (const issue of indexMeta?.issues || []) {
      map.set(issue.id, issue);
    }
    for (const issue of currentData?.issues || []) {
      map.set(issue.id, issue);
    }
    for (const issue of runtimeIssues.values()) {
      map.set(issue.id, issue);
    }
    return Array.from(map.values());
  }, [indexMeta, currentData, runtimeIssues]);

  const hasErrors = allIssues.some((i) => i.severity === 'error');

  // 1. 初回インデックスのロード
  const loadIndex = useCallback(async (forcedDir?: string) => {
    const dir = forcedDir || (isDemoMode ? './data/demo' : './data');
    const altDir = dir === './data/demo' ? './data' : './data/demo';
    try {
      let res = await fetch(resolveDataPath(`${dir}/index.json`));
      // 双方向フォールバック: 指定パスで失敗した場合はもう一方のパス (./data <=> ./data/demo) を自動試行
      if (!res.ok) {
        try {
          const fallbackRes = await fetch(resolveDataPath(`${altDir}/index.json`));
          if (fallbackRes.ok) {
            res = fallbackRes;
            setIsDemoMode(altDir === './data/demo');
          }
        } catch {
          // ignore fallback error
        }
      }
      if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
      const meta = (await res.json()) as IndexMetadata;
      setIndexMeta(meta);

      // メタデータ自身が is_mock_mode を宣言している、または proud-corp の場合は DEMO モード確定
      const totalSeats = meta.summary?.total_seats ?? 0;
      const availableDaysCount = meta.available_days?.length ?? 0;
      const hasRealMetrics = totalSeats > 0 || availableDaysCount > 0;
      const shouldBeDemo =
        meta.is_mock_mode === true ||
        meta.repository?.owner === 'proud-corp' ||
        (!hasRealMetrics && (dir === './data/demo' || !meta.repository?.owner));

      if (shouldBeDemo && !isDemoMode) {
        setIsDemoMode(true);
      }

      const defaultMonth = meta.default_scopes.latest_month || meta.available_months?.[0];
      if (defaultMonth) {
        setSelectedKey(defaultMonth);
        setScopeType('monthly');
        setNoLiveData(false);
      } else {
        setNoLiveData(true);
        setLoading(false);
      }

      const defaultReport = meta.default_scopes.latest_report || meta.available_reports?.[0];
      if (defaultReport) {
        setSelectedReportMonth(defaultReport);
      }
      clearRuntimeIssue('index');
    } catch (e: any) {
      console.error('Error fetching index:', e);
      setError(e.message || 'Failed to initialize analytics index');
      addRuntimeIssue({
        id: 'runtime-error-index',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'not_found',
        target: `${dir}/index.json`,
        message: `インデックスメタデータの読み込みに失敗しました: ${e.message}`,
        details: `取得先URL: ${resolveDataPath(`${dir}/index.json`)}\nDEMOデータセットアップコマンド: npm run demo:setup`,
        http_status: 404,
        affected_fields: ['index'],
      });
    }
  }, [isDemoMode, addRuntimeIssue, clearRuntimeIssue]);

  // 初回マウント時のみ実行する。loadIndex は isDemoMode に依存する useCallback のため、
  // 依存配列に含めると Live Metrics / Monthly Report 取得時のDEMOフォールバック (isDemoMode の
  // 暗黙的な変化) の度に index.json が再取得され、ユーザーが選択済みの selectedKey /
  // selectedReportMonth が最新月へ強制的に巻き戻ってしまう。明示的なモード切替は
  // toggleDemoMode が loadIndex を直接呼び出すため、ここでは初回ロードのみを行う。
  useEffect(() => {
    loadIndex();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 手動でDEMOモードとLIVEモードを切り替えるハンドラー
  const toggleDemoMode = useCallback((forcedMode?: boolean) => {
    setIsDemoMode((prev) => {
      const next = forcedMode !== undefined ? forcedMode : !prev;
      scopeDataCacheRef.current.clear();
      reportCacheRef.current.clear();
      currentDataRef.current = null;
      currentReportDataRef.current = null;
      setError(null);
      setReportError(null);
      setRuntimeIssues(new Map());
      loadIndex(next ? './data/demo' : './data');
      return next;
    });
  }, [loadIndex]);

  // 2. Live Metrics データの取得
  useEffect(() => {
    if (!indexMeta || noLiveData || !selectedKey) return;

    if (
      currentDataRef.current?.scope_key === selectedKey &&
      currentDataRef.current?.scope_type === scopeType
    ) {
      return;
    }

    const cacheKey = `${dataBaseDir}:${scopeType}:${selectedKey}`;
    const cached = scopeDataCacheRef.current.get(cacheKey);
    if (cached) {
      setCurrentData(cached.data);
      setScopeDataIsDemoSourced(cached.isDemoSourced);
      setLoading(false);
      setError(null);
      return;
    }

    let isCancelled = false;

    async function loadScopeData() {
      setLoading(true);
      setError(null);
      try {
        let subDir = 'daily';
        let fileName = `${selectedKey}.json`;

        let candidateUrls: string[];
        if (scopeType === 'monthly') {
          subDir = 'monthly';
          candidateUrls = getCandidateDataUrls(dataBaseDir, subDir, fileName);
        } else if (scopeType === 'custom') {
          subDir = 'custom';
          if (selectedKey.startsWith('custom:')) {
            const customFileName = `${selectedKey.replace(/[:\/]/g, '_')}.json`;
            candidateUrls = [
              ...getCandidateDataUrls(dataBaseDir, 'custom', customFileName),
              ...getCandidateDataUrls(dataBaseDir, 'custom', 'latest-30d.json'),
            ];
          } else {
            fileName = `${selectedKey.replace(/[:\/]/g, '_')}.json`;
            candidateUrls = getCandidateDataUrls(dataBaseDir, subDir, fileName);
          }
        } else {
          candidateUrls = getCandidateDataUrls(dataBaseDir, subDir, fileName);
        }

        const { res, finalUrl } = await fetchDataWithFallback(candidateUrls);

        if (!res.ok) {
          throw new Error(`Data for scope ${scopeType} (${selectedKey}) not found at ${candidateUrls[0]}`);
        }
        // このリクエスト単体が /demo/ パスへフォールバックしたかどうかをソース単位で記録する。
        // グローバルな isDemoMode (ユーザーの既定ディレクトリ選好) は書き換えない。これにより、
        // Live Metrics だけがフォールバックしても Monthly Report 等 他ソースの表示が
        // 誤って「DEMO」表示になることを防ぐ。
        const isDemoSourced = finalUrl.includes('/demo/');
        let data = (await res.json()) as ScopeAggregatedData;

        if (scopeType === 'custom' && selectedKey.startsWith('custom:')) {
          const parts = selectedKey.slice('custom:'.length).split('_');
          if (parts.length === 2 && parts[0] && parts[1]) {
            data = sliceScopeDataByDateRange(data, parts[0], parts[1]);
          }
        }

        if (!isCancelled) {
          scopeDataCacheRef.current.set(cacheKey, { data, isDemoSourced });
          setCurrentData(data);
          setScopeDataIsDemoSourced(isDemoSourced);
          clearRuntimeIssue(`scope-${scopeType}-${selectedKey}`);
        }
      } catch (e: any) {
        if (!isCancelled) {
          console.error('Failed to load scope data:', e);
          setError(e.message);
          addRuntimeIssue({
            id: `runtime-error-scope-${scopeType}-${selectedKey}`,
            timestamp: new Date().toISOString(),
            severity: 'error',
            category: 'not_found',
            target: `data:${scopeType}:${selectedKey}`,
            message: `データの読み込みに失敗しました: ${e.message}`,
            details: `取得先URL: ${dataBaseDir}/${scopeType === 'monthly' ? 'monthly' : scopeType === 'custom' ? 'custom' : 'daily'}/${selectedKey}.json\nスコープ: ${scopeType} (${selectedKey})\nアクティブソース: ${activeSource}\n\n【対処手順】\n1. DEMOデータを使用する場合: 画面上部の「DEMO (Mock)」バッジを確認し、必要に応じて 'npm run demo:setup' を実行してください。\n2. 実データ運用の場合は、GitHub Actions によるデータ同期パイプライン (copilot-analysis-cron.yml) が正常完了していることを確認してください。`,
            http_status: 404,
            affected_fields: ['live_metrics', scopeType],
          });
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadScopeData();

    return () => {
      isCancelled = true;
    };
  }, [scopeType, selectedKey, indexMeta, noLiveData, dataBaseDir, addRuntimeIssue, clearRuntimeIssue, activeSource]);

  // 3. Monthly Usage Report データの取得
  useEffect(() => {
    if (!selectedReportMonth) return;

    if (currentReportDataRef.current?.report_month === selectedReportMonth) {
      return;
    }

    const cached = reportCacheRef.current.get(`${dataBaseDir}:${selectedReportMonth}`);
    if (cached) {
      setCurrentReportData(cached.data);
      setReportDataIsDemoSourced(cached.isDemoSourced);
      setReportLoading(false);
      setReportError(null);
      return;
    }

    let isCancelled = false;

    async function loadReportData() {
      setReportLoading(true);
      setReportError(null);
      try {
        const candidateUrls = getCandidateDataUrls(dataBaseDir, 'reports', `${selectedReportMonth}.json`);
        const { res, finalUrl } = await fetchDataWithFallback(candidateUrls);

        if (!res.ok) {
          throw new Error(`Monthly report for ${selectedReportMonth} not found at ${candidateUrls[0]}`);
        }
        // Live Metrics と同様、このリクエスト単体のフォールバック有無をソース単位で記録する。
        // グローバルな isDemoMode は書き換えない (Monthly Report がフォールバックしても
        // Live Metrics 側の表示に影響を与えないようにするため)。
        const isDemoSourced = finalUrl.includes('/demo/');
        const data = (await res.json()) as MonthlyReportAggregatedData;
        if (!isCancelled) {
          reportCacheRef.current.set(`${dataBaseDir}:${selectedReportMonth}`, { data, isDemoSourced });
          setCurrentReportData(data);
          setReportDataIsDemoSourced(isDemoSourced);
          clearRuntimeIssue(`report-${selectedReportMonth}`);
        }
      } catch (e: any) {
        if (!isCancelled) {
          console.error('Failed to load report data:', e);
          setReportError(e.message);
          addRuntimeIssue({
            id: `runtime-error-report-${selectedReportMonth}`,
            timestamp: new Date().toISOString(),
            severity: 'error',
            category: 'not_found',
            target: `data:reports:${selectedReportMonth}`,
            message: `月次レポートの読み込みに失敗しました: ${e.message}`,
            details: `取得先URL: ${dataBaseDir}/reports/${selectedReportMonth}.json\nレポート月: ${selectedReportMonth}`,
            http_status: 404,
            affected_fields: ['monthly_report'],
          });
        }
      } finally {
        if (!isCancelled) {
          setReportLoading(false);
        }
      }
    }

    loadReportData();

    return () => {
      isCancelled = true;
    };
  }, [selectedReportMonth]);

  // アップロードファイル読み込みハンドラー
  const handleUploadFileLoaded = useCallback((data: MonthlyReportAggregatedData) => {
    setUploadedData(data);
    setActiveSource('user_upload');
  }, []);

  const handleClearUploadedFile = useCallback(() => {
    setUploadedData(null);
    if (activeSource === 'user_upload') {
      setActiveSource('live_metrics');
    }
  }, [activeSource]);

  // タグ操作ハンドラー (filterCriteria.tags と同期)
  const handleToggleTag = useCallback((tag: string) => {
    setFilterCriteria((prev) => {
      const nextTags = prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags: nextTags };
    });
  }, []);

  const handleClearTags = useCallback(() => {
    setFilterCriteria((prev) => ({ ...prev, tags: [] }));
  }, []);

  const resetFilterCriteria = useCallback(() => {
    setFilterCriteria(DEFAULT_FILTER_CRITERIA);
  }, []);

  // アクティブなレポートデータ (monthly_report または user_upload)
  const activeReportData = useMemo(() => {
    if (activeSource === 'user_upload') {
      return uploadedData;
    }
    return currentReportData;
  }, [activeSource, uploadedData, currentReportData]);

  // 現在アクティブ選択中のデータソースが実際に DEMO データを表示しているか (ソース単位の実態)。
  // グローバルな isDemoMode (既定ディレクトリ選好) とは独立しており、
  // - live_metrics: Live Metrics 取得が /demo/ へフォールバックしたか
  // - monthly_report: Monthly Report 取得が /demo/ へフォールバックしたか
  // - user_upload: ユーザーが自分のファイルをアップロードした実データのため常に false (DEMO扱いしない)
  // 該当データが未取得の場合は undefined を返し、呼び出し側で静的ヒューリスティックにフォールバックできるようにする。
  const activeDataIsDemoSourced = useMemo((): boolean | undefined => {
    if (activeSource === 'user_upload') {
      return false;
    }
    if (activeSource === 'monthly_report') {
      return reportDataIsDemoSourced;
    }
    return scopeDataIsDemoSourced;
  }, [activeSource, scopeDataIsDemoSourced, reportDataIsDemoSourced]);

  // フィルター選択肢候補の抽出 (現在のデータソースから動的に導出)
  const {
    availableCostCenters,
    availableOrganizations,
    availableGroups,
    availableTags,
  } = useMemo(() => {
    const costCenters = new Set<string>();
    const orgs = new Set<string>();
    const groups = new Set<string>();
    const tags = new Set<string>();

    if (activeSource === 'live_metrics' && currentData?.users) {
      for (const u of currentData.users) {
        if (u.cost_center && u.cost_center.trim() && u.cost_center !== 'Unassigned') {
          costCenters.add(u.cost_center.trim());
        }
        if (u.organization && u.organization.trim() && u.organization !== 'Unassigned') {
          orgs.add(u.organization.trim());
        }
        if (u.department && u.department.trim() && u.department !== 'Unassigned') {
          groups.add(u.department.trim());
        }
        for (const t of u.tags || []) {
          if (t && t.trim()) tags.add(t.trim());
        }
      }
    } else if (activeReportData?.user_details) {
      for (const u of activeReportData.user_details) {
        if (u.cost_center && u.cost_center.trim() && u.cost_center !== 'Unassigned') {
          costCenters.add(u.cost_center.trim());
        }
        if (u.organization && u.organization.trim() && u.organization !== 'Unassigned') {
          orgs.add(u.organization.trim());
        }
        if (u.department && u.department.trim() && u.department !== 'Unassigned') {
          groups.add(u.department.trim());
        }
        for (const t of u.tags || []) {
          if (t && t.trim()) tags.add(t.trim());
        }
      }
    }

    return {
      availableCostCenters: Array.from(costCenters).sort(),
      availableOrganizations: Array.from(orgs).sort(),
      availableGroups: Array.from(groups).sort(),
      availableTags: Array.from(tags).sort(),
    };
  }, [activeSource, currentData, activeReportData]);

  // 統合フィルター条件 (FilterCriteria) を適用した Live Metrics データ (SDD-15 準拠・完全再集計)
  const filteredCurrentData = useMemo<ScopeAggregatedData | null>(() => {
    if (!currentData) return null;
    return applyFilterCriteriaToLiveScope(currentData, filterCriteria);
  }, [currentData, filterCriteria]);

  // 統合フィルター条件 (FilterCriteria) を適用したレポートデータ (SDD-15 準拠・完全再集計)
  const filteredActiveReportData = useMemo<MonthlyReportAggregatedData | null>(() => {
    if (!activeReportData) return null;
    if (!isFilterCriteriaActive(filterCriteria)) {
      if (selectedTags.length === 0) return activeReportData;
    }

    const filteredDetails = activeReportData.user_details.filter((u) => {
      const userItem: FilterableUser = {
        login: u.login,
        display_name: u.display_name,
        cost_center: u.cost_center,
        organization: u.organization,
        department: u.department,
        tags: u.tags,
      };
      return matchUserWithCriteria(userItem, filterCriteria);
    });

    const totalNetSpend = filteredDetails.reduce(
      (sum, u) => sum + (u.net_spend_usd ?? u.total_spend_usd),
      0
    );
    const totalGrossSpend = filteredDetails.reduce(
      (sum, u) => sum + (u.gross_spend_usd ?? u.total_spend_usd),
      0
    );
    const totalDiscount = totalGrossSpend - totalNetSpend;
    const totalRequests = filteredDetails.reduce(
      (sum, u) => sum + u.total_requests,
      0
    );

    const buildFilteredReportGroups = (field: 'department' | 'cost_center' | 'organization') => {
      const res: Record<string, GroupSummary> = {};
      for (const u of filteredDetails) {
        const key = (u[field] || '').trim() || 'Unassigned';
        if (!res[key]) {
          res[key] = {
            group_name: key,
            total_seats: 0,
            active_seats: 0,
            idle_seats: 0,
            total_cost_usd: 0,
            potential_savings_usd: 0,
            active_ratio: 1.0,
            acceptance_rate: 0.35,
            total_suggestions: 0,
            total_acceptances: 0,
            total_chats: 0,
            total_pr_summaries: 0,
          };
        }
        res[key].total_seats += 1;
        res[key].active_seats += 1;
        res[key].total_cost_usd += u.total_spend_usd;
        res[key].total_suggestions += u.total_requests;
      }
      for (const g of Object.values(res)) {
        g.total_cost_usd = Number(g.total_cost_usd.toFixed(2));
      }
      return res;
    };

    const filteredModelBreakdown = buildFilteredModelBreakdown(filteredDetails);

    return {
      ...activeReportData,
      overview: {
        ...activeReportData.overview,
        total_active_users: filteredDetails.length,
        total_net_spend_usd: Number(totalNetSpend.toFixed(2)),
        total_gross_spend_usd: Number(totalGrossSpend.toFixed(2)),
        total_discount_usd: Number(totalDiscount.toFixed(2)),
        total_requests: totalRequests,
        top_model: filteredModelBreakdown[0]?.model_name || 'N/A',
      },
      user_details: filteredDetails,
      model_breakdown: filteredModelBreakdown,
      by_department: buildFilteredReportGroups('department'),
      by_cost_center: buildFilteredReportGroups('cost_center'),
      by_organization: buildFilteredReportGroups('organization'),
    };
  }, [activeReportData, selectedTags]);

  // 決定論的データセットバージョンキー (表示更新・再マウント保証)
  const currentScopeKey =
    activeSource === 'live_metrics'
      ? selectedKey
      : activeReportData?.report_month || selectedReportMonth;
  const datasetVersionKey = useMemo(() => {
    return generateDatasetVersionKey(activeSource, currentScopeKey, filterCriteria);
  }, [activeSource, currentScopeKey, filterCriteria]);

  return {
    activeSource,
    setActiveSource,
    indexMeta,
    scopeType,
    setScopeType,
    selectedKey,
    setSelectedKey,
    currentData: filteredCurrentData,
    rawCurrentData: currentData,
    loading,
    error,
    noLiveData,
    selectedReportMonth,
    setSelectedReportMonth,
    currentReportData: filteredActiveReportData,
    rawCurrentReportData: activeReportData,
    reportLoading,
    reportError,
    uploadedData,
    handleUploadFileLoaded,
    handleClearUploadedFile,
    repoInfo,
    availableReports,
    allIssues,
    hasErrors,
    // DEMOモード状態と切替 (グローバルな既定ディレクトリ選好)
    isDemoMode,
    toggleDemoMode,
    dataBaseDir,
    // 現在アクティブなデータソースが実際に DEMO データかどうか (ソース単位・ヘッダーバッジ用)
    activeDataIsDemoSourced,
    // 統合フィルター条件 (2階層特定モデル & SDD-15)
    filterCriteria,
    setFilterCriteria,
    resetFilterCriteria,
    datasetVersionKey,
    isFilterActive: isFilterCriteriaActive(filterCriteria),
    filterConditionsCount: countActiveFilterConditions(filterCriteria),
    filterSummaryBadges: getFilterSummaryBadges(filterCriteria),
    availableCostCenters,
    availableOrganizations,
    availableGroups,
    // タグANDフィルター (後方互換性エイリアス)
    availableTags,
    selectedTags,
    handleToggleTag,
    handleClearTags,
  };
}
