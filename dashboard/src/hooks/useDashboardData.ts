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
} from '../../../src/types/copilot';
import {
  resolveDataPath,
  getCandidateDataUrls,
  fetchDataWithFallback,
} from '../utils/pathResolver';
import {
  applyFilterCriteriaToLiveScope,
  applyFilterCriteriaToMonthlyReport,
  generateDatasetVersionKey,
  isFilterCriteriaActive,
  countActiveFilterConditions,
  getFilterSummaryBadges,
} from '../utils/filterEngine';
import { isUnassignedValue } from '../../../src/domain/constants/unassigned';

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

  // 期間内に日次の利用実績が 1 日も無い (利用状況メトリクスが取得できていない) 場合、
  // 利用指標を 0 で埋めず欠損 (null) のままにする
  const hasDailyUsage = filteredTrends.length > 0;

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
      total_suggestions: hasDailyUsage ? totalSuggestions : null,
      total_acceptances: hasDailyUsage ? totalAcceptances : null,
      overall_acceptance_rate: hasDailyUsage ? Math.round(acceptanceRate * 10000) / 10000 : null,
      total_chats: hasDailyUsage ? totalChats : null,
      total_pr_summaries: hasDailyUsage ? totalPrSummaries : null,
      active_users: activeUsersCount,
    },
  };
}

export function useDashboardData(initialSource: DataSourceType = 'live_metrics') {
  const [activeSource, setActiveSource] = useState<DataSourceType>(initialSource);
  const [indexMeta, setIndexMeta] = useState<IndexMetadata | null>(null);
  // 取得エフェクト (依存配列に indexMeta を含めない) から最新の index.json の宣言を参照するための ref
  const indexMetaRef = useRef<IndexMetadata | null>(null);
  indexMetaRef.current = indexMeta;

  // DEMOモード状態 (URLパラメータ・環境変数・手動切替)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(checkIsDemoMode);

  // DEMOモード時は ./data/demo、LIVEモード時は ./data を参照
  const dataBaseDir = useMemo(() => {
    return isDemoMode ? './data/demo' : './data';
  }, [isDemoMode]);

  // Live Metrics スコープ
  const [scopeType, setScopeType] = useState<AnalysisScopeType>('monthly');
  // 初期値は空。index.json の default_scopes (実際に存在する期間) から決定する (固定の日付を持たない)
  const [selectedKey, setSelectedKey] = useState<string>('');
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
  const [selectedReportMonth, setSelectedReportMonth] = useState<string>('');
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
    // リポジトリを特定できない場合 (index.json 未取得かつ github.io 以外) は、デモ用の組織名を使わず
    // 公開リポジトリ (upstream) を指す
    return {
      owner: 'sun-flat-yamada',
      name: 'github-copilot-dashboard',
      url: 'https://github.com/sun-flat-yamada/github-copilot-dashboard',
      isFork: false,
    };
  }, [indexMeta]);

  // 利用可能なレポート月一覧
  const availableReports = useMemo(() => {
    return indexMeta?.available_reports || [];
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
    try {
      // 指定されたデータ (LIVE / DEMO) だけを読み込む。読み込めない場合に、もう一方 (DEMO など) へ
      // 暗黙に切り替えない。デモ表示は明示的な操作 (?demo=true / DEMO 切替) のときだけ行う。
      const res = await fetch(resolveDataPath(`${dir}/index.json`));
      if (!res.ok) throw new Error(`Failed to load index.json: ${res.status}`);
      const meta = (await res.json()) as IndexMetadata;
      setIndexMeta(meta);

      // isDemoMode は「どのディレクトリを読むか」の明示的な選択 (URL パラメータ / 環境変数 / 切替操作)。
      // 読み込んだ index.json が is_mock_mode: true を宣言していても、ここでは書き換えない
      // (読み込み先ディレクトリが変わり、同じデータが取れなくなる)。デモ表示かどうかは、
      // 取得元パスと index.json の宣言からソース単位で判定する (activeDataIsDemoSourced)。
      // リポジトリの所有者名や、シート数 0 / データ日数 0 といった状態からデモと推測しない
      // (取得失敗や未設定の実運用データが、黙ってデモ扱いに切り替わっていた)。

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
      // 初期値 loading=true のままだとエラー表示 (error && !loading) に到達せず、スピナーが回り続ける
      setLoading(false);
      addRuntimeIssue({
        id: 'runtime-error-index',
        timestamp: new Date().toISOString(),
        severity: 'error',
        category: 'not_found',
        target: `${dir}/index.json`,
        message: `インデックスメタデータの読み込みに失敗しました: ${e.message}`,
        details: `取得先URL: ${resolveDataPath(`${dir}/index.json`)}\nデータ収集 (GitHub Actions: copilot-analysis-cron.yml) が完了していることを確認してください。デモデータで画面を確認する場合は、画面上の「デモデータを表示」を選択するか、'?demo=true' を付けて開いてください (ローカル: npm run demo:setup)。`,
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
  // forcedMode を省略すると現在の逆へ切り替える。ボタンの onClick に直接渡さないこと
  // (MouseEvent が forcedMode として解釈され、常にデモへ切り替わる)。
  const toggleDemoMode = useCallback((forcedMode?: boolean) => {
    setIsDemoMode((prev) => {
      const next = typeof forcedMode === 'boolean' ? forcedMode : !prev;
      scopeDataCacheRef.current.clear();
      reportCacheRef.current.clear();
      currentDataRef.current = null;
      currentReportDataRef.current = null;
      // 切替先のデータが取得できない場合に、切替前のデータが表示され続けないようにする
      setIndexMeta(null);
      setCurrentData(null);
      setCurrentReportData(null);
      setScopeDataIsDemoSourced(undefined);
      setReportDataIsDemoSourced(undefined);
      setSelectedKey('');
      setSelectedReportMonth('');
      setNoLiveData(false);
      setLoading(true);
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
        // このリクエストの取得元が /demo/ パスかどうかをソース単位で記録する。
        // グローバルな isDemoMode (ユーザーの既定ディレクトリ選好) は書き換えない。これにより、
        // Live Metrics だけがデモの場合でも Monthly Report 等 他ソースの表示が
        // 誤って「DEMO」表示になることを防ぐ。
        // 暗黙のデモフォールバックは行わない (候補にデモパスを含めない) ため、/demo/ パスになるのは
        // ユーザーが明示的にデモを選択した場合のみ。実データ側に置かれた MOCK_MODE 生成データ
        // (index.json が is_mock_mode: true を宣言) もデモ由来として扱う。
        const isDemoSourced = finalUrl.includes('/demo/');
        const demoSourced = isDemoSourced || indexMetaRef.current?.is_mock_mode === true;
        let data = (await res.json()) as ScopeAggregatedData;

        if (scopeType === 'custom' && selectedKey.startsWith('custom:')) {
          const parts = selectedKey.slice('custom:'.length).split('_');
          if (parts.length === 2 && parts[0] && parts[1]) {
            data = sliceScopeDataByDateRange(data, parts[0], parts[1]);
          }
        }

        if (!isCancelled) {
          scopeDataCacheRef.current.set(cacheKey, { data, isDemoSourced: demoSourced });
          setCurrentData(data);
          setScopeDataIsDemoSourced(demoSourced);
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
        // Live Metrics と同様、このリクエストの取得元がデモかどうかをソース単位で記録する。
        // グローバルな isDemoMode は書き換えない (Monthly Report がデモでも
        // Live Metrics 側の表示に影響を与えないようにするため)。
        const isDemoSourced = finalUrl.includes('/demo/');
        const demoSourced = isDemoSourced || indexMetaRef.current?.is_mock_mode === true;
        const data = (await res.json()) as MonthlyReportAggregatedData;
        if (!isCancelled) {
          reportCacheRef.current.set(`${dataBaseDir}:${selectedReportMonth}`, { data, isDemoSourced: demoSourced });
          setCurrentReportData(data);
          setReportDataIsDemoSourced(demoSourced);
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
    // 依存配列は意図的に [selectedReportMonth] だけ。取得は「レポート月が変わったとき」だけ行う。
    // dataBaseDir (DEMO / LIVE の切替) は toggleDemoMode がレポート月を一度リセットして
    // loadIndex が再設定するため、切替時にもこのエフェクトが再実行される。
    // addRuntimeIssue / clearRuntimeIssue は安定した useCallback。currentReportData を依存に含めると無限ループになる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // 未割当 (Default-CostCenter / Unassigned-CC / 未分類 (Unassigned) 等) は、専用の「未割当のみ」選択肢が
  // あるため通常の候補には含めない (単一の定義: isUnassignedValue)。
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

    const collect = (u: { cost_center?: string; organization?: string; department?: string; tags?: string[] }) => {
      if (u.cost_center && !isUnassignedValue(u.cost_center)) costCenters.add(u.cost_center.trim());
      if (u.organization && !isUnassignedValue(u.organization)) orgs.add(u.organization.trim());
      if (u.department && !isUnassignedValue(u.department)) groups.add(u.department.trim());
      for (const t of u.tags || []) {
        if (t && t.trim()) tags.add(t.trim());
      }
    };

    if (activeSource === 'live_metrics' && currentData?.users) {
      for (const u of currentData.users) collect(u);
    } else if (activeReportData?.user_details) {
      for (const u of activeReportData.user_details) collect(u);
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
  // 再集計は filterEngine の単一実装 (applyFilterCriteriaToMonthlyReport) に委譲する。
  // 依存配列は filterCriteria 全体 (Cost Center / Org / 部署 / タグ / ユーザー)。以前はタグ (selectedTags) だけを
  // 依存に含めており、タグ以外の条件を変えてもレポートの KPI・明細が再計算されなかった。
  const filteredActiveReportData = useMemo<MonthlyReportAggregatedData | null>(() => {
    if (!activeReportData) return null;
    return applyFilterCriteriaToMonthlyReport(activeReportData, filterCriteria);
  }, [activeReportData, filterCriteria]);

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
