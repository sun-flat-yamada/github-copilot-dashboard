import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AnalysisScopeType,
  DataSourceType,
  DataFetchIssue,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  GroupSummary,
} from '../../../src/types/copilot';

export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  isFork: boolean;
}

export function checkIsDemoMode(): boolean {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('demo') === 'true' ||
      params.get('mock') === 'true' ||
      params.get('mode') === 'demo' ||
      params.get('data') === 'demo'
    ) {
      return true;
    }
  }
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_MODE === 'true') {
    return true;
  }
  return false;
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

  // キャッシュ
  const currentDataRef = useRef<ScopeAggregatedData | null>(null);
  currentDataRef.current = currentData;
  const scopeDataCacheRef = useRef<Map<string, ScopeAggregatedData>>(new Map());

  // Monthly Usage Report スコープ
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>('2026-08');
  const [currentReportData, setCurrentReportData] = useState<MonthlyReportAggregatedData | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const currentReportDataRef = useRef<MonthlyReportAggregatedData | null>(null);
  currentReportDataRef.current = currentReportData;
  const reportCacheRef = useRef<Map<string, MonthlyReportAggregatedData>>(new Map());

  // User Upload スコープ (On-demand)
  const [uploadedData, setUploadedData] = useState<MonthlyReportAggregatedData | null>(null);

  // タグANDフィルター
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  // 全体の異常一覧
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
  const loadIndex = useCallback(async (forcedDir?: string) => {
    const dir = forcedDir || (isDemoMode ? './data/demo' : './data');
    try {
      let res = await fetch(`${dir}/index.json`);
      // 通常パスで404かつDEMOパス未指定時は、./data/demo/index.json へのフォールバックを試みる
      if (!res.ok && dir !== './data/demo') {
        try {
          const fallbackRes = await fetch('./data/demo/index.json');
          if (fallbackRes.ok) {
            res = fallbackRes;
            setIsDemoMode(true);
          }
        } catch {
          // ignore fallback error
        }
      }
      if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
      const meta = (await res.json()) as IndexMetadata;
      setIndexMeta(meta);

      // メタデータ自身が is_mock_mode を宣言している場合は DEMO モード確定
      if (meta.is_mock_mode && !isDemoMode) {
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
    } catch (e: any) {
      console.error('Error fetching index:', e);
      setError(e.message || 'Failed to initialize analytics index');
    }
  }, [isDemoMode]);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  // 手動でDEMOモードとLIVEモードを切り替えるハンドラー
  const toggleDemoMode = useCallback((forcedMode?: boolean) => {
    setIsDemoMode((prev) => {
      const next = forcedMode !== undefined ? forcedMode : !prev;
      scopeDataCacheRef.current.clear();
      reportCacheRef.current.clear();
      currentDataRef.current = null;
      currentReportDataRef.current = null;
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
      setCurrentData(cached);
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

        if (scopeType === 'monthly') {
          subDir = 'monthly';
        } else if (scopeType === 'custom') {
          subDir = 'custom';
          fileName = `${selectedKey.replace(/[:\/]/g, '_')}.json`;
        }

        const url = `${dataBaseDir}/${subDir}/${fileName}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Data for scope ${scopeType} (${selectedKey}) not found at ${url}`);
        }
        const data = (await res.json()) as ScopeAggregatedData;
        if (!isCancelled) {
          scopeDataCacheRef.current.set(cacheKey, data);
          setCurrentData(data);
        }
      } catch (e: any) {
        if (!isCancelled) {
          console.error('Failed to load scope data:', e);
          setError(e.message);
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
  }, [scopeType, selectedKey, indexMeta, noLiveData, dataBaseDir]);

  // 3. Monthly Usage Report データの取得
  useEffect(() => {
    if (!selectedReportMonth) return;

    if (currentReportDataRef.current?.report_month === selectedReportMonth) {
      return;
    }

    const cached = reportCacheRef.current.get(`${dataBaseDir}:${selectedReportMonth}`);
    if (cached) {
      setCurrentReportData(cached);
      setReportLoading(false);
      setReportError(null);
      return;
    }

    let isCancelled = false;

    async function loadReportData() {
      setReportLoading(true);
      setReportError(null);
      try {
        const url = `${dataBaseDir}/reports/${selectedReportMonth}.json`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Monthly report for ${selectedReportMonth} not found at ${url}`);
        }
        const data = (await res.json()) as MonthlyReportAggregatedData;
        if (!isCancelled) {
          reportCacheRef.current.set(`${dataBaseDir}:${selectedReportMonth}`, data);
          setCurrentReportData(data);
        }
      } catch (e: any) {
        if (!isCancelled) {
          console.error('Failed to load report data:', e);
          setReportError(e.message);
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

  // タグ操作ハンドラー
  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  // アクティブなレポートデータ (monthly_report または user_upload)
  const activeReportData = useMemo(() => {
    if (activeSource === 'user_upload') {
      return uploadedData;
    }
    return currentReportData;
  }, [activeSource, uploadedData, currentReportData]);

  // 利用可能な全タグの抽出 (現在のデータソースから)
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();

    if (activeSource === 'live_metrics' && currentData?.users) {
      for (const u of currentData.users) {
        for (const t of u.tags || []) {
          if (t) tagSet.add(t);
        }
      }
    } else if (activeReportData?.user_details) {
      for (const u of activeReportData.user_details) {
        for (const t of u.tags || []) {
          if (t) tagSet.add(t);
        }
      }
    }

    return Array.from(tagSet).sort();
  }, [activeSource, currentData, activeReportData]);

  // タグANDフィルターを適用した Live Metrics データ
  const filteredCurrentData = useMemo<ScopeAggregatedData | null>(() => {
    if (!currentData) return null;
    if (selectedTags.length === 0) return currentData;

    // AND条件 (選択された全タグを保持しているユーザーのみ抽出)
    const filteredUsers = currentData.users.filter(
      (u) => u.tags && selectedTags.every((t) => u.tags!.includes(t))
    );
    const matchingLogins = new Set(filteredUsers.map((u) => u.login.toLowerCase()));

    const filteredProfiles = currentData.user_profiles?.filter((p) =>
      matchingLogins.has(p.login.toLowerCase())
    );

    const activeUsers = filteredUsers.filter(
      (u) => u.status === 'active' || u.status === 'low_active'
    ).length;
    const idleUsers = filteredUsers.filter(
      (u) => u.status === 'idle' || u.status === 'never_used'
    ).length;
    const totalSpend = filteredUsers.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
    const idleWaste = filteredUsers
      .filter((u) => u.status === 'idle' || u.status === 'never_used')
      .reduce((sum, u) => sum + u.monthly_cost_usd, 0);

    // グループ別再集計
    const buildFilteredGroups = (field: 'department' | 'cost_center' | 'organization') => {
      const res: Record<string, GroupSummary> = {};
      for (const u of filteredUsers) {
        const key = u[field] || 'Unassigned';
        if (!res[key]) {
          res[key] = {
            group_name: key,
            total_seats: 0,
            active_seats: 0,
            idle_seats: 0,
            total_cost_usd: 0,
            potential_savings_usd: 0,
            active_ratio: 0,
            acceptance_rate: 0.35,
            total_suggestions: 0,
            total_acceptances: 0,
            total_chats: 0,
            total_pr_summaries: 0,
          };
        }
        res[key].total_seats += 1;
        if (u.status === 'active' || u.status === 'low_active') res[key].active_seats += 1;
        if (u.status === 'idle' || u.status === 'never_used') {
          res[key].idle_seats += 1;
          res[key].potential_savings_usd += u.monthly_cost_usd;
        }
        res[key].total_cost_usd += u.monthly_cost_usd;
      }
      for (const g of Object.values(res)) {
        g.active_ratio = g.total_seats > 0 ? Number((g.active_seats / g.total_seats).toFixed(2)) : 0;
        g.total_cost_usd = Number(g.total_cost_usd.toFixed(2));
        g.potential_savings_usd = Number(g.potential_savings_usd.toFixed(2));
      }
      return res;
    };

    return {
      ...currentData,
      overview: {
        ...currentData.overview,
        total_seats: filteredUsers.length,
        active_users: activeUsers,
        idle_seats: idleUsers,
        total_spend_usd: Number(totalSpend.toFixed(2)),
        idle_waste_usd: Number(idleWaste.toFixed(2)),
        active_ratio: filteredUsers.length > 0 ? Number((activeUsers / filteredUsers.length).toFixed(2)) : 0,
      },
      users: filteredUsers,
      user_profiles: filteredProfiles,
      by_department: buildFilteredGroups('department'),
      by_cost_center: buildFilteredGroups('cost_center'),
      by_organization: buildFilteredGroups('organization'),
    };
  }, [currentData, selectedTags]);

  // タグANDフィルターを適用したレポートデータ
  const filteredActiveReportData = useMemo<MonthlyReportAggregatedData | null>(() => {
    if (!activeReportData) return null;
    if (selectedTags.length === 0) return activeReportData;

    const filteredDetails = activeReportData.user_details.filter(
      (u) => u.tags && selectedTags.every((t) => u.tags!.includes(t))
    );

    const totalSpend = filteredDetails.reduce((sum, u) => sum + u.total_spend_usd, 0);
    const totalRequests = filteredDetails.reduce((sum, u) => sum + u.total_requests, 0);

    const buildFilteredReportGroups = (field: 'department' | 'cost_center' | 'organization') => {
      const res: Record<string, GroupSummary> = {};
      for (const u of filteredDetails) {
        const key = u[field] || 'Unassigned';
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

    return {
      ...activeReportData,
      overview: {
        ...activeReportData.overview,
        total_net_spend_usd: Number(totalSpend.toFixed(2)),
        total_requests: totalRequests,
        total_active_users: filteredDetails.length,
      },
      user_details: filteredDetails,
      by_department: buildFilteredReportGroups('department'),
      by_cost_center: buildFilteredReportGroups('cost_center'),
      by_organization: buildFilteredReportGroups('organization'),
    };
  }, [activeReportData, selectedTags]);

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
    // DEMOモード状態と切替
    isDemoMode,
    toggleDemoMode,
    dataBaseDir,
    // タグANDフィルター
    availableTags,
    selectedTags,
    handleToggleTag,
    handleClearTags,
  };
}
