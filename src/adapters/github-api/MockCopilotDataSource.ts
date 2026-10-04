import { ICopilotDataSource } from '../../domain/ports/ICopilotDataSource.js';
import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  CostCenterBudget,
  UserUsageProfile,
  DataFetchIssue,
  SourceStatus,
} from '../../domain/entities/copilot.js';
import type { QualityObservations } from '../../domain/entities/data-quality.js';
import { TeamDailyMetrics } from '../../domain/entities/agent-metrics.js';
import { MockDataGenerator, MockDataBundle } from '../../collector/mock-generator.js';

export interface MockDataSourceConfig {
  days?: number;
  seatCount?: number;
  generator?: MockDataGenerator;
}

export class MockCopilotDataSource implements ICopilotDataSource {
  private generator: MockDataGenerator;
  private bundle: MockDataBundle;
  private days: number;
  private seatCount: number;

  constructor(config: MockDataSourceConfig = {}) {
    this.generator = config.generator || new MockDataGenerator();
    this.days = config.days ?? 30;
    this.seatCount = config.seatCount ?? 85;
    this.bundle = this.generator.generateBundle(this.days, this.seatCount);
  }

  async fetchMetrics(): Promise<CopilotDailyMetrics[]> {
    return [...this.bundle.metrics];
  }

  async fetchSeats(): Promise<CopilotSeatAssignment[]> {
    return [...this.bundle.seats];
  }

  async fetchCostCenters(): Promise<EnterpriseCostCenter[]> {
    return [...this.bundle.costCenters];
  }

  async fetchCostCenterBudgets(): Promise<CostCenterBudget[]> {
    return [...this.bundle.costCenterBudgets];
  }

  async fetchUserProfiles(): Promise<UserUsageProfile[]> {
    return [...this.bundle.userProfiles];
  }

  async fetchTeamMetrics(teamSlug: string): Promise<TeamDailyMetrics[]> {
    const today = new Date().toISOString().slice(0, 10);
    return [
      {
        team_slug: teamSlug,
        team_name: teamSlug.replace(/-/g, ' ').toUpperCase(),
        date: today,
        total_active_users: 15,
        total_engaged_users: 12,
        total_code_suggestions: 240,
        total_code_acceptances: 85,
        total_chat_turns: 45,
        total_agent_sessions: 18,
        ai_credits_used: 120,
      },
    ];
  }

  /**
   * 代表的な issue (エラーログ画面の表示パターン用)。severity / category を一通り含む。
   * 実データの障害ではない (DEMO の見本)。
   */
  getIssues(): DataFetchIssue[] {
    const at = new Date().toISOString();
    return [
      {
        id: 'demo_issue_ai_credits_auth',
        timestamp: at,
        severity: 'error',
        category: 'api_auth',
        target: 'api:ai-credits',
        message: 'Billing API (AI credit usage) returned 403. The token lacks the billing scope; AI credit amounts are kept from the last successful run.',
        http_status: 403,
      },
      {
        id: 'demo_issue_rate_limit',
        timestamp: at,
        severity: 'warning',
        category: 'rate_limit',
        target: 'org:proud-ai-labs',
        message: 'Rate limit reached while collecting seat details; the request was retried and completed.',
        http_status: 429,
      },
      {
        id: 'demo_issue_org_not_found',
        timestamp: at,
        severity: 'warning',
        category: 'not_found',
        target: 'org:proud-internal-sys',
        message: 'Organization metrics are unavailable (404). Seats of this organization are shown as data-unavailable.',
        http_status: 404,
      },
      {
        id: 'demo_issue_quarantine',
        timestamp: at,
        severity: 'warning',
        category: 'data_integrity',
        target: 'source:seats',
        message: '2 seat records failed validation and were quarantined.',
        affected_fields: ['plan_type', 'created_at'],
      },
      {
        id: 'demo_issue_server_error',
        timestamp: at,
        severity: 'error',
        category: 'server_error',
        target: 'api:cost-centers',
        message: 'Cost center API returned 502 on the first attempt; the second attempt succeeded.',
        http_status: 502,
      },
    ];
  }

  /** 品質履歴の見本用の観測。直近 30 日を要求し、2 件を隔離した状態 */
  getQualityObservations(): QualityObservations {
    const days = this.bundle.metrics.map((m) => m.date);
    return {
      requested_days: days,
      available_days: days,
      duplicates_collapsed: 4,
      out_of_range: 0,
      quarantined: 2,
      malformed_lines: 0,
    };
  }

  /** 全て成功ではなく、一部失敗 (seats) と失敗 (ai_credits) を含める。画面の縮退表示を確認するための見本 */
  getSourceStatuses(): SourceStatus[] {
    const now = new Date().toISOString();
    const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ok = (source: SourceStatus['source'], records: number): SourceStatus => ({
      source,
      status: 'ok',
      records,
      last_attempt_at: now,
      last_success_at: now,
    });
    return [
      ok('metrics', this.bundle.metrics.length),
      { ...ok('seats', this.bundle.seats.length), status: 'partial', quarantined: 2 },
      ok('cost_centers', this.bundle.costCenters.length),
      {
        source: 'ai_credits',
        status: 'failed',
        records: 0,
        last_attempt_at: now,
        last_success_at: week,
        error: 'Billing API returned 403 (token lacks the billing scope)',
      },
    ];
  }
}
