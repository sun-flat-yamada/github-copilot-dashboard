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
import { RawApiFetcher } from './RawApiFetcher.js';
import { NormalizerRegistry } from './NormalizerRegistry.js';
import { DomainMapper } from './DomainMapper.js';
import { normalizeMetrics20260310 } from './normalizers/metrics-2026-03-10.js';
import { normalizeSeats20260310 } from './normalizers/seats-2026-03-10.js';

export interface GitHubApiDataSourceConfig {
  fetcher?: RawApiFetcher;
  enterprise?: string;
  orgs?: string[];
}

export class GitHubApiCopilotDataSource implements ICopilotDataSource {
  private fetcher: RawApiFetcher;
  private enterprise?: string;
  private orgs: string[];
  private issues: DataFetchIssue[] = [];
  private metricsNormalizers = new NormalizerRegistry<unknown, CopilotDailyMetrics>();
  private seatsNormalizers = new NormalizerRegistry<unknown, CopilotSeatAssignment>();

  constructor(config: GitHubApiDataSourceConfig = {}) {
    this.fetcher = config.fetcher || new RawApiFetcher();
    this.enterprise = config.enterprise || process.env.COPILOT_ENTERPRISE;
    this.orgs = config.orgs || (process.env.COPILOT_ORGS ? process.env.COPILOT_ORGS.split(',').map((s) => s.trim()) : []);

    // 既定の Normalizers を登録
    this.metricsNormalizers.register('2026-03-10', normalizeMetrics20260310);
    this.seatsNormalizers.register('2026-03-10', normalizeSeats20260310);
  }

  async fetchMetrics(): Promise<CopilotDailyMetrics[]> {
    const apiVer = this.fetcher.getApiVersion();
    const normalizer = this.metricsNormalizers.getNormalizer(apiVer);

    try {
      if (this.enterprise) {
        const raw = await this.fetcher.fetchRaw<any[]>('/enterprises/{ent}/copilot/metrics', {
          ent: this.enterprise,
        });
        if (!Array.isArray(raw)) return [];
        return raw.map((item) => DomainMapper.toDailyMetrics(normalizer(item)));
      }

      if (this.orgs.length > 0) {
        const allMetrics: CopilotDailyMetrics[] = [];
        for (const org of this.orgs) {
          const raw = await this.fetcher.fetchRaw<any[]>('/orgs/{org}/copilot/metrics', { org });
          if (Array.isArray(raw)) {
            allMetrics.push(...raw.map((item) => DomainMapper.toDailyMetrics(normalizer(item))));
          }
        }
        return allMetrics;
      }

      return [];
    } catch (err: any) {
      this.recordIssue('copilot/metrics', err);
      return [];
    }
  }

  async fetchSeats(): Promise<CopilotSeatAssignment[]> {
    const apiVer = this.fetcher.getApiVersion();
    const normalizer = this.seatsNormalizers.getNormalizer(apiVer);

    try {
      const seats: CopilotSeatAssignment[] = [];
      if (this.enterprise) {
        const raw = await this.fetcher.fetchRaw<{ seats?: any[] }>('/enterprises/{ent}/copilot/billing/seats', {
          ent: this.enterprise,
        });
        if (Array.isArray(raw?.seats)) {
          seats.push(...raw.seats.map((s) => DomainMapper.toSeatAssignment(normalizer(s))));
        }
      } else {
        for (const org of this.orgs) {
          const raw = await this.fetcher.fetchRaw<{ seats?: any[] }>('/orgs/{org}/copilot/billing/seats', { org });
          if (Array.isArray(raw?.seats)) {
            seats.push(...raw.seats.map((s) => DomainMapper.toSeatAssignment(normalizer(s))));
          }
        }
      }
      return seats;
    } catch (err: any) {
      this.recordIssue('copilot/billing/seats', err);
      return [];
    }
  }

  async fetchCostCenters(): Promise<EnterpriseCostCenter[]> {
    if (!this.enterprise) return [];
    try {
      const raw = await this.fetcher.fetchRaw<{ cost_centers?: any[] }>(
        '/enterprises/{ent}/settings/billing/cost-centers',
        { ent: this.enterprise }
      );
      if (Array.isArray(raw?.cost_centers)) {
        return raw.cost_centers.map((cc) => DomainMapper.toEnterpriseCostCenter(cc));
      }
      return [];
    } catch (err: any) {
      this.recordIssue('billing/cost-centers', err);
      return [];
    }
  }

  async fetchCostCenterBudgets(): Promise<CostCenterBudget[]> {
    // 本番環境では環境変数または Enterprise API から取得
    return [];
  }

  async fetchUserProfiles(): Promise<UserUsageProfile[]> {
    return [];
  }

  async fetchTeamMetrics(teamSlug: string): Promise<TeamDailyMetrics[]> {
    if (this.orgs.length === 0) return [];
    try {
      const raw = await this.fetcher.fetchRaw<TeamDailyMetrics[]>(
        '/orgs/{org}/teams/{team}/copilot/metrics',
        { org: this.orgs[0], team: teamSlug }
      );
      return Array.isArray(raw) ? raw : [];
    } catch (err: any) {
      this.recordIssue(`teams/${teamSlug}/copilot/metrics`, err);
      return [];
    }
  }

  getIssues(): DataFetchIssue[] {
    return [...this.issues];
  }

  private recordIssue(endpoint: string, err: any): void {
    this.issues.push({
      id: `issue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      severity: err.status === 404 ? 'warning' : 'error',
      category: err.status === 401 || err.status === 403 ? 'api_auth' : err.status === 429 ? 'rate_limit' : 'server_error',
      target: endpoint,
      message: err.message || String(err),
      http_status: err.status || 500,
    });
  }
}
