import { ICopilotDataSource } from '../../domain/ports/ICopilotDataSource.js';
import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  CostCenterBudget,
  UserUsageProfile,
  DataFetchIssue,
} from '../../domain/entities/copilot.js';
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

  getIssues(): DataFetchIssue[] {
    return [];
  }
}
