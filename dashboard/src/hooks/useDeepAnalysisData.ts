import { useState, useEffect, useMemo, useRef } from 'react';
import {
  DataSourceType,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  UserUsageProfile,
} from '../../../src/types/copilot';
import {
  DeepAnalysisArchive,
  DeepAnalysisDataSourceInfo,
} from '../../../src/types/deep-analysis';
import { getCandidateDataUrls, fetchDataWithFallback } from '../utils/pathResolver';

/**
 * 月次レポート (CSV の集計) にはユーザー別の日次利用実績が含まれない。
 * 以前は、全員の受諾率 35%・チャット比率 45〜65%・組織全体の日次形状で個人の日次履歴を合成し、
 * 個人の「健全度スコア」「兆候確率」を算出していた。実測のない値による個人診断は行わない。
 */
const MONTHLY_AGGREGATE_ONLY_DETAILS =
  '月次レポート (CSV) にはユーザー別の日次利用実績が含まれないため、日次の診断・推移は表示できません。実測 (ユーザー別の日次利用データ) が収集された月のみ診断できます。';

interface UseDeepAnalysisDataParams {
  /** データの取得元ディレクトリ ('./data' または './data/demo')。デモ/実データを暗黙に混在させない */
  dataBaseDir: string;
  activeSource: DataSourceType;
  currentData: ScopeAggregatedData | null;
  selectedReportMonth: string;
  currentReportData: MonthlyReportAggregatedData | null;
  uploadedData: MonthlyReportAggregatedData | null;
  selectedTags: string[];
}

export interface UseDeepAnalysisDataResult {
  profiles: UserUsageProfile[];
  sourceInfo: DeepAnalysisDataSourceInfo;
  loading: boolean;
  error: string | null;
}

export interface ResolveDeepAnalysisProfilesParams {
  activeSource: DataSourceType;
  currentData: ScopeAggregatedData | null;
  selectedReportMonth: string;
  /** 保存済みの月次ディープ分析アーカイブ (無ければ null) */
  archiveData: DeepAnalysisArchive | null;
  currentReportData: MonthlyReportAggregatedData | null;
  uploadedData: MonthlyReportAggregatedData | null;
  selectedTags: string[];
}

/**
 * アクティブなデータソースから、ディープ分析・ユーザー別推移に使うプロファイル群と
 * データソース情報を導出する (React に依存しない純粋関数)。
 *
 * 実測のあるプロファイル (Live Metrics / 保存済み月次アーカイブ) だけを返し、月次レポート (CSV の集計) や
 * アップロードデータからは個人別のプロファイルを合成しない。
 */
export function resolveDeepAnalysisProfiles({
  activeSource,
  currentData,
  selectedReportMonth,
  archiveData,
  currentReportData,
  uploadedData,
  selectedTags,
}: ResolveDeepAnalysisProfilesParams): {
  profiles: UserUsageProfile[];
  sourceInfo: DeepAnalysisDataSourceInfo;
} {
  // A. Live Metrics
  if (activeSource === 'live_metrics') {
    const rawProfiles = currentData?.user_profiles || [];
    const totalUsers = currentData?.users?.length || rawProfiles.length;

    const filteredProfiles =
      selectedTags.length > 0
        ? rawProfiles.filter(
            (p) => p.tags && selectedTags.every((t) => p.tags!.includes(t))
          )
        : rawProfiles;

    return {
      profiles: filteredProfiles,
      sourceInfo: {
        sourceType: 'live_metrics',
        label: 'Live Metrics (確定テレメトリ)',
        isEstimated: false,
        monthOrFileName: currentData?.scope_key || 'live',
        totalUsers,
        filteredUsers: filteredProfiles.length,
        ...(rawProfiles.length === 0 && totalUsers > 0
          ? {
              details:
                'ユーザー別の日次利用実績 (プロファイル) がまだ収集できていないため、診断・推移は表示できません。',
            }
          : {}),
      },
    };
  }

  // B. Monthly Report
  if (activeSource === 'monthly_report') {
    // B-1. 保存済み月次アーカイブが存在する場合
    if (archiveData && archiveData.user_profiles.length > 0) {
      const totalUsers = archiveData.user_profiles.length;
      const filteredProfiles =
        selectedTags.length > 0
          ? archiveData.user_profiles.filter(
              (p) => p.tags && selectedTags.every((t) => p.tags!.includes(t))
            )
          : archiveData.user_profiles;

      return {
        profiles: filteredProfiles,
        sourceInfo: {
          sourceType: 'monthly_report',
          label: `月次アーカイブ [${selectedReportMonth}] (確定テレメトリ)`,
          isEstimated: false,
          monthOrFileName: selectedReportMonth,
          totalUsers,
          filteredUsers: filteredProfiles.length,
        },
      };
    }

    // B-2. 月次集計のみ (ユーザー別の日次実績なし)。個人診断用のプロファイルは合成しない
    if (currentReportData) {
      return {
        profiles: [],
        sourceInfo: {
          sourceType: 'monthly_report',
          label: `月次利用レポート [${selectedReportMonth}] (月次集計のみ・日次診断不可)`,
          isEstimated: false,
          details: MONTHLY_AGGREGATE_ONLY_DETAILS,
          monthOrFileName: selectedReportMonth,
          totalUsers: currentReportData.user_details?.length || 0,
          filteredUsers: 0,
        },
      };
    }
  }

  // C. User Upload (月次集計のみ)
  if (activeSource === 'user_upload') {
    const targetReport = uploadedData || currentReportData;
    if (targetReport) {
      return {
        profiles: [],
        sourceInfo: {
          sourceType: 'user_upload',
          label: `アップロードデータ [${targetReport.file_name || 'CSV'}] (月次集計のみ・日次診断不可)`,
          isEstimated: false,
          details: MONTHLY_AGGREGATE_ONLY_DETAILS,
          monthOrFileName: targetReport.file_name,
          totalUsers: targetReport.user_details?.length || 0,
          filteredUsers: 0,
        },
      };
    }
  }

  // フォールバック (データなし)
  return {
    profiles: [],
    sourceInfo: {
      sourceType: activeSource,
      label: 'データ未ロード',
      isEstimated: false,
      totalUsers: 0,
      filteredUsers: 0,
    },
  };
}

export function useDeepAnalysisData({
  dataBaseDir,
  activeSource,
  currentData,
  selectedReportMonth,
  currentReportData,
  uploadedData,
  selectedTags,
}: UseDeepAnalysisDataParams): UseDeepAnalysisDataResult {
  const [archiveData, setArchiveData] = useState<DeepAnalysisArchive | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // アーカイブキャッシュ
  const archiveCacheRef = useRef<Map<string, DeepAnalysisArchive | null>>(new Map());

  // 1. Monthly Report 選択時のディープ分析アーカイブ取得
  useEffect(() => {
    if (activeSource !== 'monthly_report' || !selectedReportMonth) {
      setArchiveData(null);
      setArchiveLoading(false);
      setArchiveError(null);
      return;
    }

    const cacheKey = `${dataBaseDir}:${selectedReportMonth}`;
    if (archiveCacheRef.current.has(cacheKey)) {
      setArchiveData(archiveCacheRef.current.get(cacheKey) || null);
      setArchiveLoading(false);
      return;
    }

    let isCancelled = false;

    async function fetchArchive() {
      setArchiveLoading(true);
      setArchiveError(null);
      // 取得が終わるまで、別の月のアーカイブを現在の月のものとして使い続けない
      setArchiveData(null);
      try {
        // 選択中のデータ (LIVE / DEMO) のアーカイブだけを読む。無い場合に DEMO のアーカイブへ
        // 暗黙にフォールバックしない (デモ由来のデータが「確定テレメトリ」と表示されるのを防ぐ)。
        const candidateUrls = getCandidateDataUrls(dataBaseDir, 'deep-analysis', `${selectedReportMonth}.json`);
        const { res } = await fetchDataWithFallback(candidateUrls);
        if (res.ok) {
          const data = (await res.json()) as DeepAnalysisArchive;
          if (data && Array.isArray(data.user_profiles)) {
            if (!isCancelled) {
              archiveCacheRef.current.set(cacheKey, data);
              setArchiveData(data);
            }
            return;
          }
        }
        // アーカイブが存在しない場合はnullをキャッシュ (月次集計のみとして扱う)
        if (!isCancelled) {
          archiveCacheRef.current.set(cacheKey, null);
          setArchiveData(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          archiveCacheRef.current.set(cacheKey, null);
          setArchiveData(null);
        }
      } finally {
        if (!isCancelled) {
          setArchiveLoading(false);
        }
      }
    }

    fetchArchive();

    return () => {
      isCancelled = true;
    };
  }, [activeSource, selectedReportMonth, dataBaseDir]);

  // 2. プロファイル群の統合導出 (純粋関数 resolveDeepAnalysisProfiles に委譲)
  const resolved = useMemo(
    () =>
      resolveDeepAnalysisProfiles({
        activeSource,
        currentData,
        selectedReportMonth,
        archiveData,
        currentReportData,
        uploadedData,
        selectedTags,
      }),
    [
      activeSource,
      currentData,
      selectedReportMonth,
      archiveData,
      currentReportData,
      uploadedData,
      selectedTags,
    ]
  );

  return {
    profiles: resolved.profiles,
    sourceInfo: resolved.sourceInfo,
    loading: archiveLoading,
    error: archiveError,
  };
}
