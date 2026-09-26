import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  CostCenterBudget,
  UserUsageProfile,
  DataFetchIssue,
} from '../entities/copilot.js';
import { TeamDailyMetrics } from '../entities/agent-metrics.js';

/**
 * Port interface for data collection from GitHub API or simulation models.
 * Implemented by: GitHubApiCopilotDataSource, MockCopilotDataSource
 */
export interface ICopilotDataSource {
  fetchMetrics(): Promise<CopilotDailyMetrics[]>;
  fetchSeats(): Promise<CopilotSeatAssignment[]>;
  fetchCostCenters(): Promise<EnterpriseCostCenter[]>;
  fetchCostCenterBudgets(): Promise<CostCenterBudget[]>;
  fetchUserProfiles(): Promise<UserUsageProfile[]>;
  fetchTeamMetrics?(teamSlug: string): Promise<TeamDailyMetrics[]>;
  getIssues(): DataFetchIssue[];
}
