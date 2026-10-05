import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  CostCenterBudget,
  UserUsageProfile,
  DataFetchIssue,
  SourceStatus,
} from '../entities/copilot.js';
import type { CostLine } from '../facts/schemas.js';
import type { QualityObservations } from '../entities/data-quality.js';
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
  /**
   * Cost Center 予算。GitHub の公開 API は予算 (上限・無料枠) を返さないため、実データの実装は空配列を返す
   * (上限は COPILOT_COST_CENTER_BUDGETS の宣言をパイプラインが評価する。SDD-03 §4.3 / SDD-06 §1.2)。
   */
  fetchCostCenterBudgets(): Promise<CostCenterBudget[]>;
  /**
   * Billing の AI credit usage (Enterprise 単位) を正準の費用行として返す (P1-5)。
   * 状態は getSourceStatuses() の 'ai_credits' に反映する。未対応の実装・モックでは未定義。
   */
  fetchAiCreditUsage?(): Promise<CostLine[]>;
  fetchUserProfiles(): Promise<UserUsageProfile[]>;
  /**
   * チーム別の日次メトリクス。users-1-day の行とシートの assigning_teams から導出する (SDD-03 §2.4)。
   * 廃止済みの /orgs/{org}/teams/{team}/copilot/metrics は呼ばない。fetchMetrics / fetchSeats の後に呼ぶ。
   */
  fetchTeamMetrics?(teamSlug: string): Promise<TeamDailyMetrics[]>;
  getIssues(): DataFetchIssue[];
  /** ソース (metrics / seats / cost_centers) ごとの直近の取得状態 */
  getSourceStatuses(): SourceStatus[];
  /**
   * 直近の fetchMetrics で観測したデータ品質 (欠損日・重複・範囲外・隔離)。
   * 実収集をしていない (モック・未設定・失敗) ときは null。
   */
  getQualityObservations?(): QualityObservations | null;
}
