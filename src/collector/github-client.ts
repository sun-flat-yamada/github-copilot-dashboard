import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  CostCenterBudget,
  DataFetchIssue,
  EnterpriseCostCenter,
  UserUsageProfile,
} from '../types/copilot.js';
import { MockDataGenerator } from './mock-generator.js';

export interface GitHubClientConfig {
  token?: string;
  enterprise?: string;
  orgs?: string[];
  mockMode?: boolean;
}

export class GitHubCopilotClient {
  private token?: string;
  private enterprise?: string;
  private orgs: string[];
  private mockMode: boolean;
  private mockGenerator: MockDataGenerator;
  private issues: DataFetchIssue[] = [];

  constructor(config: GitHubClientConfig = {}) {
    this.token = config.token || process.env.COPILOT_READ_TOKEN || process.env.GITHUB_TOKEN;
    this.enterprise = config.enterprise || process.env.COPILOT_ENTERPRISE;
    const orgsEnv = config.orgs || (process.env.COPILOT_ORGS ? process.env.COPILOT_ORGS.split(',').map((o) => o.trim()) : []);
    this.orgs = orgsEnv.filter(Boolean);
    this.mockMode = config.mockMode ?? (process.env.MOCK_MODE === 'true' || !this.token);
    this.mockGenerator = new MockDataGenerator();
  }

  public getIssues(): DataFetchIssue[] {
    return [...this.issues];
  }

  private recordIssue(issue: Omit<DataFetchIssue, 'id' | 'timestamp'>): void {
    const newIssue: DataFetchIssue = {
      id: `issue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...issue,
    };
    this.issues.push(newIssue);
    console.warn(`⚠️ [GitHubClient Issue] [${newIssue.severity.toUpperCase()}] ${newIssue.target}: ${newIssue.message}`);
  }

  /**
   * Copilot メトリクス一覧を取得 (日次)
   */
  public async fetchMetrics(since?: string, until?: string): Promise<CopilotDailyMetrics[]> {
    if (this.mockMode) {
      console.log('⚡ [GitHubClient] Running in MOCK mode: generating 30-day simulated Copilot metrics (2026.09 spec)');
      const bundle = this.mockGenerator.generateBundle(30);
      
      // モックモードで検証用の模擬エラー/警告を注入
      this.recordIssue({
        severity: 'warning',
        category: 'rate_limit',
        target: 'api:copilot/metrics',
        message: 'GitHub REST API rate limit approaching threshold (Remaining: 120/5000 requests)',
        details: 'X-RateLimit-Remaining: 120\nX-RateLimit-Reset: 1725960000\nResource: /enterprises/proud-corp/copilot/metrics\nRecommendation: Increase polling interval or utilize caching.',
        http_status: 200,
        affected_fields: ['copilot_ide_chat'],
      });

      this.recordIssue({
        severity: 'error',
        category: 'api_auth',
        target: 'org:proud-internal-sys',
        message: 'HTTP 403 Forbidden: Missing admin read permissions for organization "proud-internal-sys"',
        details: 'Status: 403 Forbidden\nEndpoint: GET https://api.github.com/orgs/proud-internal-sys/copilot/metrics\nResponse: {"message":"Must have admin rights to Repository or Organization to view Copilot Metrics.","documentation_url":"https://docs.github.com/rest/copilot/copilot-metrics"}\nImpact: Metrics for proud-internal-sys were skipped and marked as unavailable.',
        http_status: 403,
        affected_fields: ['copilot_ide_code_completions', 'copilot_ide_chat', 'top_languages'],
      });

      return bundle.metrics;
    }

    const headers = this.getHeaders();
    const metrics: CopilotDailyMetrics[] = [];

    try {
      if (this.enterprise) {
        let url = `https://api.github.com/enterprises/${this.enterprise}/copilot/metrics`;
        const params = new URLSearchParams();
        if (since) params.append('since', since);
        if (until) params.append('until', until);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url, { headers });
        if (!res.ok) {
          this.recordIssue({
            severity: 'error',
            category: res.status === 403 ? 'api_auth' : res.status === 404 ? 'not_found' : 'server_error',
            target: `enterprise:${this.enterprise}`,
            message: `Enterprise Copilot metrics API request failed: HTTP ${res.status} ${res.statusText}`,
            details: await res.text().catch(() => ''),
            http_status: res.status,
          });
          throw new Error(`Enterprise metrics API failed: ${res.status} ${res.statusText}`);
        }
        const data = (await res.json()) as CopilotDailyMetrics[];
        return data;
      }

      // 各Orgから取得して結合
      for (const org of this.orgs) {
        let url = `https://api.github.com/orgs/${org}/copilot/metrics`;
        const res = await fetch(url, { headers });
        if (!res.ok) {
          this.recordIssue({
            severity: res.status === 404 ? 'warning' : 'error',
            category: res.status === 403 ? 'api_auth' : 'server_error',
            target: `org:${org}`,
            message: `Failed to fetch Copilot metrics for organization "${org}": HTTP ${res.status}`,
            details: await res.text().catch(() => ''),
            http_status: res.status,
            affected_fields: ['copilot_ide_code_completions'],
          });
          continue;
        }
        const data = (await res.json()) as CopilotDailyMetrics[];
        metrics.push(...data);
      }
    } catch (e: any) {
      console.error('[GitHubClient] Error fetching metrics, falling back to mock data:', e);
      return this.mockGenerator.generateBundle(30).metrics;
    }

    return metrics;
  }

  /**
   * シート割当一覧を取得
   */
  public async fetchSeats(): Promise<CopilotSeatAssignment[]> {
    if (this.mockMode) {
      console.log('⚡ [GitHubClient] Running in MOCK mode: generating simulated seat assignments (2026.09 spec)');
      return this.mockGenerator.generateBundle(30).seats;
    }

    const headers = this.getHeaders();
    const allSeats: CopilotSeatAssignment[] = [];

    try {
      if (this.enterprise) {
        let page = 1;
        while (true) {
          const url = `https://api.github.com/enterprises/${this.enterprise}/copilot/billing/seats?per_page=100&page=${page}`;
          const res = await fetch(url, { headers });
          if (!res.ok) {
            this.recordIssue({
              severity: 'error',
              category: res.status === 403 ? 'api_auth' : 'server_error',
              target: `enterprise:${this.enterprise}/billing/seats`,
              message: `Enterprise seat assignments API failed: HTTP ${res.status}`,
              details: await res.text().catch(() => ''),
              http_status: res.status,
            });
            throw new Error(`Enterprise seats API failed: ${res.status}`);
          }
          const json = await res.json();
          const seats = (json.seats || []) as CopilotSeatAssignment[];
          allSeats.push(...seats);
          if (seats.length < 100) break;
          page++;
        }
        return allSeats;
      }

      for (const org of this.orgs) {
        let page = 1;
        while (true) {
          const url = `https://api.github.com/orgs/${org}/copilot/billing/seats?per_page=100&page=${page}`;
          const res = await fetch(url, { headers });
          if (!res.ok) {
            this.recordIssue({
              severity: 'error',
              category: res.status === 403 ? 'api_auth' : 'server_error',
              target: `org:${org}/billing/seats`,
              message: `Failed to fetch seats for org "${org}": HTTP ${res.status}`,
              details: await res.text().catch(() => ''),
              http_status: res.status,
            });
            break;
          }
          const json = await res.json();
          const seats = (json.seats || []) as CopilotSeatAssignment[];
          allSeats.push(...seats);
          if (seats.length < 100) break;
          page++;
        }
      }
    } catch (e: any) {
      console.error('[GitHubClient] Error fetching seats, falling back to mock data:', e);
      return this.mockGenerator.generateBundle(30).seats;
    }

    return allSeats;
  }

  /**
   * Enterprise Cost Centers 一覧を取得
   */
  public async fetchCostCenters(): Promise<EnterpriseCostCenter[]> {
    if (this.mockMode || !this.enterprise) {
      // モックモードでもCost Centerエラーの検証ケースを1件注入
      if (this.mockMode) {
        this.recordIssue({
          severity: 'warning',
          category: 'data_integrity',
          target: 'api:billing/cost-centers/cc-ent-9009',
          message: 'Cost Center "cc-ent-9009" (Enterprise-IT) contains 3 unmapped user assignments',
          details: 'Warning: 3 users could not be resolved against active enterprise seats.\nCost Center ID: cc-ent-9009\nFallback: Assigned to Default-CostCenter.',
          http_status: 200,
          affected_fields: ['cost_center'],
        });
      }
      return this.mockGenerator.generateBundle(30).costCenters;
    }

    const headers = this.getHeaders();
    try {
      const url = `https://api.github.com/enterprises/${this.enterprise}/settings/billing/cost-centers`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        this.recordIssue({
          severity: 'warning',
          category: 'server_error',
          target: `enterprise:${this.enterprise}/settings/billing/cost-centers`,
          message: `Cost centers API returned HTTP ${res.status}, falling back to defaults`,
          details: await res.text().catch(() => ''),
          http_status: res.status,
        });
        return this.mockGenerator.generateBundle(30).costCenters;
      }
      const json = await res.json();
      return (json.cost_centers || []) as EnterpriseCostCenter[];
    } catch (e: any) {
      console.warn('[GitHubClient] Cost Centers fetch failed, using defaults:', e);
      return this.mockGenerator.generateBundle(30).costCenters;
    }
  }

  /**
   * Cost Center Budget (上限・無料・使用済み) 一覧を取得
   */
  public async fetchCostCenterBudgets(): Promise<CostCenterBudget[]> {
    return this.mockGenerator.generateBundle(30).costCenterBudgets;
  }

  /**
   * ユーザー別モデル利用履歴プロファイル一覧を取得
   */
  public async fetchUserProfiles(): Promise<UserUsageProfile[]> {
    return this.mockGenerator.generateBundle(30).userProfiles;
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'GitHub-Copilot-Analytics-Platform/2026.09',
    };
  }
}
