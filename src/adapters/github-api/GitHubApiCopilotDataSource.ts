import { ICopilotDataSource } from '../../domain/ports/ICopilotDataSource.js';
import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
  CostCenterBudget,
  UserUsageProfile,
  DataFetchIssue,
  DataSourceId,
  SourceStatus,
} from '../../domain/entities/copilot.js';
import { TeamDailyMetrics } from '../../domain/entities/agent-metrics.js';
import { RawApiFetcher } from './RawApiFetcher.js';
import { NormalizerRegistry } from './NormalizerRegistry.js';
import { DomainMapper } from './DomainMapper.js';
import { normalizeMetrics20260310 } from './normalizers/metrics-2026-03-10.js';
import { normalizeSeats20260310 } from './normalizers/seats-2026-03-10.js';
import { normalizeTeams20260310 } from './normalizers/teams-2026-03-10.js';
import { normalizeCostCenter20260310 } from './normalizers/cost-centers-2026-03-10.js';
import { pickCostCenterRecords } from './schemas/cost-centers-schema.js';

export interface GitHubApiDataSourceConfig {
  fetcher?: RawApiFetcher;
  enterprise?: string;
  orgs?: string[];
}

interface SeatsPage {
  total_seats?: number;
  seats?: unknown[];
}

/** 失敗理由として index.json に残す文字数の上限 (個人情報や巨大な本文を残さない) */
const MAX_ERROR_SUMMARY_LENGTH = 300;
/** data_integrity issue に列挙する隔離レコードの理由の最大件数 */
const MAX_QUARANTINE_REASONS = 3;

export class GitHubApiCopilotDataSource implements ICopilotDataSource {
  private fetcher: RawApiFetcher;
  private enterprise?: string;
  private orgs: string[];
  private issues: DataFetchIssue[] = [];
  private statuses = new Map<DataSourceId, SourceStatus>();
  private metricsNormalizers = new NormalizerRegistry<unknown, CopilotDailyMetrics>();
  private seatsNormalizers = new NormalizerRegistry<unknown, CopilotSeatAssignment>();
  private teamsNormalizers = new NormalizerRegistry<unknown, TeamDailyMetrics>();

  constructor(config: GitHubApiDataSourceConfig = {}) {
    this.fetcher = config.fetcher || new RawApiFetcher();
    this.enterprise = config.enterprise || process.env.COPILOT_ENTERPRISE || undefined;
    this.orgs =
      config.orgs ||
      (process.env.COPILOT_ORGS
        ? process.env.COPILOT_ORGS.split(',').map((s) => s.trim()).filter(Boolean)
        : []);

    // 既定の Normalizers を登録
    this.metricsNormalizers.register('2026-03-10', normalizeMetrics20260310);
    this.seatsNormalizers.register('2026-03-10', normalizeSeats20260310);
    this.teamsNormalizers.register('2026-03-10', normalizeTeams20260310);
  }

  async fetchMetrics(): Promise<CopilotDailyMetrics[]> {
    if (!this.isConfigured()) {
      this.reportMissingConfig('metrics', 'config:copilot-metrics', 'Copilot Metrics');
      return [];
    }
    if (!this.hasToken('metrics')) return [];

    const normalizer = this.metricsNormalizers.getNormalizer(this.fetcher.getApiVersion());

    try {
      const raws: unknown[] = [];
      if (this.enterprise) {
        const raw = await this.fetcher.fetchRaw<unknown>('/enterprises/{ent}/copilot/metrics', {
          ent: this.enterprise,
        });
        if (Array.isArray(raw)) raws.push(...raw);
      } else {
        for (const org of this.orgs) {
          const raw = await this.fetcher.fetchRaw<unknown>('/orgs/{org}/copilot/metrics', { org });
          if (Array.isArray(raw)) raws.push(...raw);
        }
      }

      const { records, quarantined } = this.normalizeEach(raws, (item) =>
        DomainMapper.toDailyMetrics(normalizer(item))
      );
      this.reportQuarantine('copilot/metrics', quarantined);
      this.setStatus('metrics', quarantined.length > 0 ? 'partial' : 'ok', records.length, quarantined.length);
      return records;
    } catch (err: any) {
      this.recordIssue('copilot/metrics', err);
      this.setFailed('metrics', err);
      return [];
    }
  }

  async fetchSeats(): Promise<CopilotSeatAssignment[]> {
    if (!this.isConfigured()) {
      this.reportMissingConfig('seats', 'config:copilot-billing-seats', 'Copilot Seats');
      return [];
    }
    if (!this.hasToken('seats')) return [];

    const normalizer = this.seatsNormalizers.getNormalizer(this.fetcher.getApiVersion());

    // 取得対象 (Enterprise があればそれのみ、無ければ各 Org)。
    // いずれかの対象が失敗した場合は、不完全な席数を「現在値」として返さないよう全体を失敗扱いにする
    // (呼び出し側は Last-known-good を維持する)。
    const targets: Array<{ endpoint: string; params: Record<string, string>; label: string }> = this.enterprise
      ? [{ endpoint: '/enterprises/{ent}/copilot/billing/seats', params: { ent: this.enterprise }, label: 'copilot/billing/seats' }]
      : this.orgs.map((org) => ({
          endpoint: '/orgs/{org}/copilot/billing/seats',
          params: { org },
          label: 'copilot/billing/seats',
        }));

    const rawSeats: unknown[] = [];
    let expectedTotal = 0;
    let expectedTotalKnown = true;
    let truncated = false;
    let failedTargets = 0;
    let lastError: unknown;

    for (const target of targets) {
      try {
        const result = await this.fetcher.fetchPaginated<SeatsPage, unknown>(
          target.endpoint,
          target.params,
          (page) => (Array.isArray(page?.seats) ? page.seats : [])
        );
        rawSeats.push(...result.items);
        if (typeof result.firstPage?.total_seats === 'number') {
          expectedTotal += result.firstPage.total_seats;
        } else {
          expectedTotalKnown = false;
        }
        truncated = truncated || result.truncated;
      } catch (err: any) {
        failedTargets++;
        lastError = err;
        this.recordIssue(target.label, err);
      }
    }

    if (failedTargets > 0) {
      this.setFailed('seats', lastError, failedTargets > 1 ? `${failedTargets} of ${targets.length} targets failed` : undefined);
      return [];
    }

    const { records, quarantined } = this.normalizeEach(rawSeats, (item) =>
      DomainMapper.toSeatAssignment(normalizer(item))
    );
    this.reportQuarantine('copilot/billing/seats', quarantined);

    let integrityWarning = false;
    if (truncated) {
      integrityWarning = true;
      this.pushIssue({
        severity: 'warning',
        category: 'data_integrity',
        target: 'copilot/billing/seats',
        message: 'Seat pagination was truncated at the safety limit; the seat list may be incomplete.',
      });
    }
    if (expectedTotalKnown && !truncated && expectedTotal !== rawSeats.length) {
      integrityWarning = true;
      this.pushIssue({
        severity: 'warning',
        category: 'data_integrity',
        target: 'copilot/billing/seats',
        message: `Seat count mismatch: total_seats=${expectedTotal} but ${rawSeats.length} seat record(s) were retrieved.`,
        details: 'The seat list changed during pagination or the API returned an inconsistent total. Re-run the pipeline; if it persists, investigate the pagination.',
      });
    }

    const unknownPlanCount = records.filter((s) => s.plan_type === 'unknown').length;
    if (unknownPlanCount > 0) {
      this.pushIssue({
        severity: 'warning',
        category: 'data_integrity',
        target: 'copilot/billing/seats',
        message: `${unknownPlanCount} seat(s) have a missing or unrecognized plan_type; their seat cost is treated as unconfirmed (not estimated).`,
        affected_fields: ['plan_type'],
      });
    }

    const nullOrgCount = records.filter((s) => s.organization === null).length;
    if (nullOrgCount > 0) {
      this.pushIssue({
        severity: 'warning',
        category: 'data_integrity',
        target: 'copilot/billing/seats',
        message: `${nullOrgCount} seat(s) have no organization (organization: null); they are grouped as unassigned.`,
        affected_fields: ['organization'],
      });
    }

    this.setStatus(
      'seats',
      quarantined.length > 0 || integrityWarning ? 'partial' : 'ok',
      records.length,
      quarantined.length
    );
    return records;
  }

  async fetchCostCenters(): Promise<EnterpriseCostCenter[]> {
    // Cost Centers は Enterprise Billing 専用。Org 単体運用では対象外 (障害ではない)
    if (!this.enterprise) {
      this.setStatus('cost_centers', 'skipped', 0);
      return [];
    }
    if (!this.hasToken('cost_centers')) return [];

    try {
      const body = await this.fetcher.fetchRaw<unknown>('/enterprises/{ent}/settings/billing/cost-centers', {
        ent: this.enterprise,
      });
      const { records, quarantined } = this.normalizeEach(pickCostCenterRecords(body), (item) =>
        normalizeCostCenter20260310(item)
      );
      const costCenters = records
        .filter((cc): cc is EnterpriseCostCenter => cc !== null)
        .map((cc) => DomainMapper.toEnterpriseCostCenter(cc));
      this.reportQuarantine('billing/cost-centers', quarantined);
      this.setStatus('cost_centers', quarantined.length > 0 ? 'partial' : 'ok', costCenters.length, quarantined.length);
      return costCenters;
    } catch (err: any) {
      this.recordIssue('billing/cost-centers', err);
      this.setFailed('cost_centers', err);
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
    if (this.orgs.length === 0 || !this.fetcher.hasToken()) return [];
    const apiVer = this.fetcher.getApiVersion();
    const normalizer = this.teamsNormalizers.getNormalizer(apiVer);
    try {
      const raw = await this.fetcher.fetchRaw<unknown[]>(
        '/orgs/{org}/teams/{team}/copilot/metrics',
        { org: this.orgs[0], team: teamSlug }
      );
      if (!Array.isArray(raw)) return [];
      return raw.map((item) => normalizer(item));
    } catch (err: any) {
      this.recordIssue(`teams/${teamSlug}/copilot/metrics`, err);
      return [];
    }
  }

  getIssues(): DataFetchIssue[] {
    return [...this.issues];
  }

  getSourceStatuses(): SourceStatus[] {
    const order: DataSourceId[] = ['metrics', 'seats', 'cost_centers'];
    return order
      .map((id) => this.statuses.get(id))
      .filter((s): s is SourceStatus => s !== undefined)
      .map((s) => ({ ...s }));
  }

  // ---------------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------------

  private isConfigured(): boolean {
    return Boolean(this.enterprise) || this.orgs.length > 0;
  }

  /**
   * COPILOT_ENTERPRISE / COPILOT_ORGS が未設定の場合は「対象外 (skipped)」。
   * 認証情報に依存しない機能 (Monthly Usage Report CSV 等) は継続動作する。
   */
  private reportMissingConfig(source: DataSourceId, target: string, label: string): void {
    this.pushIssue({
      severity: 'warning',
      category: 'api_auth',
      target,
      message: `COPILOT_ENTERPRISE and COPILOT_ORGS are both unset — skipping live ${label} collection.`,
      details: `Set COPILOT_ENTERPRISE (enterprise-wide) or COPILOT_ORGS (comma-separated org slugs) as a repository/organization Actions variable to enable live ${label.toLowerCase()} collection. Monthly Usage Report (CSV import) and other credential-independent features remain unaffected.`,
    });
    this.setStatus(source, 'skipped', 0);
  }

  /**
   * 対象は設定されているがトークンが無い場合。無認証で呼び出して曖昧な 401/404 を得るのではなく、
   * 原因 (COPILOT_READ_TOKEN 未設定) を明示した issue にして、そのソースを失敗扱いにする。
   */
  private hasToken(source: DataSourceId): boolean {
    if (this.fetcher.hasToken()) return true;

    const target = 'config:github-token';
    if (!this.issues.some((i) => i.target === target)) {
      this.pushIssue({
        severity: 'error',
        category: 'api_auth',
        target,
        message: 'COPILOT_READ_TOKEN is not set — live Copilot data cannot be collected.',
        details:
          'Create a token with Copilot billing / Enterprise read permission and register it as the COPILOT_READ_TOKEN Actions secret. GITHUB_TOKEN / GH_TOKEN are also accepted when set.',
      });
    }
    this.statuses.set(source, {
      source,
      status: 'failed',
      records: 0,
      last_attempt_at: new Date().toISOString(),
      last_success_at: null,
      error: 'COPILOT_READ_TOKEN is not set',
    });
    return false;
  }

  /**
   * レコード単位で正規化する。検証に失敗したレコードは隔離し、残りを採用する。
   * (旧実装はバッチ全体を 1 つの map で処理しており、1 件の想定外値で全件が消失していた)
   */
  private normalizeEach<TOut>(
    raws: unknown[],
    normalize: (raw: unknown) => TOut
  ): { records: TOut[]; quarantined: Array<{ index: number; reason: string }> } {
    const records: TOut[] = [];
    const quarantined: Array<{ index: number; reason: string }> = [];
    raws.forEach((raw, index) => {
      try {
        records.push(normalize(raw));
      } catch (err: any) {
        quarantined.push({ index, reason: summarizeValidationError(err) });
      }
    });
    return { records, quarantined };
  }

  private reportQuarantine(target: string, quarantined: Array<{ index: number; reason: string }>): void {
    if (quarantined.length === 0) return;
    // 理由にはレコードの値 (ログイン名など) を含めず、位置とスキーマ上のパスだけを残す
    const reasons = quarantined
      .slice(0, MAX_QUARANTINE_REASONS)
      .map((q) => `records[${q.index}]: ${q.reason}`)
      .join('\n');
    this.pushIssue({
      severity: 'warning',
      category: 'data_integrity',
      target,
      message: `${quarantined.length} record(s) failed validation and were quarantined (excluded from aggregation).`,
      details:
        reasons + (quarantined.length > MAX_QUARANTINE_REASONS ? `\n… and ${quarantined.length - MAX_QUARANTINE_REASONS} more` : ''),
    });
  }

  private setStatus(
    source: DataSourceId,
    status: SourceStatus['status'],
    records: number,
    quarantined = 0
  ): void {
    const now = new Date().toISOString();
    this.statuses.set(source, {
      source,
      status,
      records,
      ...(quarantined > 0 ? { quarantined } : {}),
      last_attempt_at: now,
      last_success_at: status === 'ok' || status === 'partial' ? now : null,
    });
  }

  private setFailed(source: DataSourceId, err: unknown, extra?: string): void {
    const message = (err as any)?.message ?? String(err);
    const summary = extra ? `${extra}: ${message}` : message;
    this.statuses.set(source, {
      source,
      status: 'failed',
      records: 0,
      last_attempt_at: new Date().toISOString(),
      last_success_at: null,
      error: String(summary).slice(0, MAX_ERROR_SUMMARY_LENGTH),
    });
  }

  private pushIssue(issue: Omit<DataFetchIssue, 'id' | 'timestamp'>): void {
    this.issues.push({
      id: `issue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...issue,
    });
  }

  private recordIssue(endpoint: string, err: any): void {
    const status: number | undefined = typeof err?.status === 'number' ? err.status : undefined;
    const isValidationError = err?.name === 'ZodError' || Array.isArray(err?.issues);

    this.pushIssue({
      severity: status === 404 ? 'warning' : 'error',
      category: isValidationError
        ? 'data_integrity'
        : status === 401 || status === 403
        ? 'api_auth'
        : status === 429
        ? 'rate_limit'
        : status === 404
        ? 'not_found'
        : 'server_error',
      target: endpoint,
      message: err?.message || String(err),
      http_status: status ?? 500,
    });
  }
}

/**
 * ZodError (または一般の Error) をレコード値を含まない 1 行の理由に要約する。
 */
function summarizeValidationError(err: any): string {
  const issues: Array<{ path?: Array<string | number>; message?: string }> | undefined = err?.issues;
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .slice(0, 3)
      .map((i) => `${(i.path ?? []).join('.') || '(root)'}: ${i.message ?? 'invalid'}`)
      .join('; ');
  }
  return String(err?.message ?? err).slice(0, 120);
}
