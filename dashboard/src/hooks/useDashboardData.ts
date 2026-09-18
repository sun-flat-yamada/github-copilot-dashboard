import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AnalysisScopeType,
  DashboardAppMode,
  DataFetchIssue,
  IndexMetadata,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
} from '../../../src/types/copilot';

export interface RepoInfo {
  owner: string;
  name: string;
  url: string;
  isFork: boolean;
}

export function useDashboardData(appMode: DashboardAppMode) {
  const [indexMeta, setIndexMeta] = useState<IndexMetadata | null>(null);
  const [scopeType, setScopeType] = useState<AnalysisScopeType>('monthly');
  const [selectedKey, setSelectedKey] = useState<string>('2026-09');

  const [currentData, setCurrentData] = useState<ScopeAggregatedData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [noLiveData, setNoLiveData] = useState<boolean>(false);

  // Live Metrics 用キャッシュ & 最新参照
  const currentDataRef = useRef<ScopeAggregatedData | null>(null);
  currentDataRef.current = currentData;
  const scopeDataCacheRef = useRef<Map<string, ScopeAggregatedData>>(new Map());

  // Monthly Usage Report モード用ステート & キャッシュ & 最新参照
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>('2026-08');
  const [currentReportData, setCurrentReportData] = useState<MonthlyReportAggregatedData | null>(null);
  const [reportLoading, setReportLoading] = useState<boolean>(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const currentReportDataRef = useRef<MonthlyReportAggregatedData | null>(null);
  currentReportDataRef.current = currentReportData;
  const reportCacheRef = useRef<Map<string, MonthlyReportAggregatedData>>(new Map());

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
  const loadIndex = useCallback(async () => {
    try {
      const res = await fetch('./data/index.json');
      if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
      const meta = (await res.json()) as IndexMetadata;
      setIndexMeta(meta);

      // デフォルトスコープの適用
      const defaultMonth = meta.default_scopes.latest_month;
      if (defaultMonth) {
        setSelectedKey(defaultMonth);
        setScopeType('monthly');
      } else {
        setNoLiveData(true);
        setLoading(false);
      }

      // デフォルトレポート月の適用
      const defaultReport = meta.default_scopes.latest_report || meta.available_reports?.[0];
      if (defaultReport) {
        setSelectedReportMonth(defaultReport);
      }
    } catch (e: any) {
      console.error('Error fetching index:', e);
      setError(e.message || 'Failed to initialize analytics index');
    }
  }, []);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  // 2. 選択スコープ (Live Metrics) のデータ取得
  useEffect(() => {
    if (!indexMeta || noLiveData || !selectedKey || appMode !== 'live_metrics') return;

    // すでに同一スコープのデータがロード済みの場合は再フェッチをスキップ（モード切替時の画面ちらつき防止）
    if (
      currentDataRef.current?.scope_key === selectedKey &&
      currentDataRef.current?.scope_type === scopeType
    ) {
      return;
    }

    const cacheKey = `${scopeType}:${selectedKey}`;
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

        const url = `./data/${subDir}/${fileName}`;
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
  }, [scopeType, selectedKey, appMode, indexMeta, noLiveData]);

  // 3. Monthly Usage Report データの取得 (無限ループ抑止・インメモリキャッシュ・レースコンディション防止)
  useEffect(() => {
    if (!selectedReportMonth) return;

    // A. 既にステートに該当月がセットされている場合は何もしない（サーバー取得・ローカル読込問わずスキップ）
    if (currentReportDataRef.current?.report_month === selectedReportMonth) {
      return;
    }

    // B. キャッシュに存在する場合は即時反映（ネットワーク通信・スピナーなし）
    const cached = reportCacheRef.current.get(selectedReportMonth);
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
        const url = `./data/reports/${selectedReportMonth}.json`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Monthly report for ${selectedReportMonth} not found at ${url}`);
        }
        const data = (await res.json()) as MonthlyReportAggregatedData;
        if (!isCancelled) {
          reportCacheRef.current.set(selectedReportMonth, data);
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

  const handleReportLoadedClientSide = useCallback((data: MonthlyReportAggregatedData) => {
    reportCacheRef.current.set(data.report_month, data);
    setCurrentReportData(data);
    setSelectedReportMonth(data.report_month);
  }, []);

  return {
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
  };
}
