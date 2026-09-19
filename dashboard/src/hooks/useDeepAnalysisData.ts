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
import { adaptReportToProfiles } from '../utils/deepAnalysisAdapter';

interface UseDeepAnalysisDataParams {
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

export function useDeepAnalysisData({
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

    if (archiveCacheRef.current.has(selectedReportMonth)) {
      setArchiveData(archiveCacheRef.current.get(selectedReportMonth) || null);
      setArchiveLoading(false);
      return;
    }

    let isCancelled = false;

    async function fetchArchive() {
      setArchiveLoading(true);
      setArchiveError(null);
      try {
        const url = `./data/deep-analysis/${selectedReportMonth}.json`;
        const res = await fetch(url);
        if (res.ok) {
          const data = (await res.json()) as DeepAnalysisArchive;
          if (data && Array.isArray(data.user_profiles)) {
            if (!isCancelled) {
              archiveCacheRef.current.set(selectedReportMonth, data);
              setArchiveData(data);
            }
            return;
          }
        }
        // アーカイブが存在しない場合はnullをキャッシュしてフォールバックへ
        if (!isCancelled) {
          archiveCacheRef.current.set(selectedReportMonth, null);
          setArchiveData(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          archiveCacheRef.current.set(selectedReportMonth, null);
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
  }, [activeSource, selectedReportMonth]);

  // 2. プロファイル群の統合導出
  const resolved = useMemo<{
    profiles: UserUsageProfile[];
    sourceInfo: DeepAnalysisDataSourceInfo;
  }>(() => {
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

      // B-2. 月次レポートからの動的アダプト
      if (currentReportData) {
        const adaptedProfiles = adaptReportToProfiles(currentReportData, selectedTags);
        const totalUsers = currentReportData.user_details?.length || 0;

        return {
          profiles: adaptedProfiles,
          sourceInfo: {
            sourceType: 'monthly_report',
            label: `月次利用レポート [${selectedReportMonth}] (按分推定診断)`,
            isEstimated: true,
            monthOrFileName: selectedReportMonth,
            totalUsers,
            filteredUsers: adaptedProfiles.length,
          },
        };
      }
    }

    // C. User Upload
    if (activeSource === 'user_upload') {
      const targetReport = uploadedData || currentReportData;
      if (targetReport) {
        const adaptedProfiles = adaptReportToProfiles(targetReport, selectedTags);
        const totalUsers = targetReport.user_details?.length || 0;

        return {
          profiles: adaptedProfiles,
          sourceInfo: {
            sourceType: 'user_upload',
            label: `アップロードデータ [${targetReport.file_name || 'CSV'}] (按分推定診断)`,
            isEstimated: true,
            monthOrFileName: targetReport.file_name,
            totalUsers,
            filteredUsers: adaptedProfiles.length,
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
  }, [
    activeSource,
    currentData,
    selectedReportMonth,
    archiveData,
    currentReportData,
    uploadedData,
    selectedTags,
  ]);

  return {
    profiles: resolved.profiles,
    sourceInfo: resolved.sourceInfo,
    loading: archiveLoading,
    error: archiveError,
  };
}
