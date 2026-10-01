import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  CostCenterBudget,
  UserUsageProfile,
  DataFetchIssue,
  SourceStatus,
} from '../entities/copilot.js';
import { TeamDailyMetrics } from '../entities/agent-metrics.js';

/**
 * Port interface for data collection from GitHub API or simulation models.
 * Implemented by: GitHubApiCopilotDataSource, MockCopilotDataSource
 *
 * 各 fetch* は例外を投げず、失敗は getIssues() / getSourceStatuses() で表現する。
 * 「取得失敗」と「データなし」を区別するため、呼び出し側は戻り値の空配列だけで
 * 判断せず、必ず getSourceStatuses() を参照すること。
 */
export interface ICopilotDataSource {
  fetchMetrics(): Promise<CopilotDailyMetrics[]>;
  fetchSeats(): Promise<CopilotSeatAssignment[]>;
  fetchCostCenters(): Promise<EnterpriseCostCenter[]>;
  fetchCostCenterBudgets(): Promise<CostCenterBudget[]>;
  fetchUserProfiles(): Promise<UserUsageProfile[]>;
  fetchTeamMetrics?(teamSlug: string): Promise<TeamDailyMetrics[]>;
  getIssues(): DataFetchIssue[];
  /** ソース (metrics / seats / cost_centers) ごとの直近の取得状態 */
  getSourceStatuses(): SourceStatus[];
}
