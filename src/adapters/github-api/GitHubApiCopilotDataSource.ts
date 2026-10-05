import { AiCreditUsageClient } from './ai-credits/AiCreditUsageClient.js';
import { toCostLine } from '../../domain/facts/mappers.js';
import type { CostLine } from '../../domain/facts/schemas.js';
import type { QualityObservations } from '../../domain/entities/data-quality.js';
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
import {
  UsageReportsClient,
  ReportScope,
  UsersRangeResult,
  reportWindowDays,
  scopeLabel,
} from './usage-reports/UsageReportsClient.js';
import { buildAllDailyMetrics, buildUserProfiles } from './usage-reports/user-report-mapper.js';
import { buildTeamDailyMetrics } from './usage-reports/team-metrics-mapper.js';
import { UserReportRow } from './usage-reports/user-report-schema.js';
import { RawApiFetcher } from './RawApiFetcher.js';
import { RawApiClient } from './RawApiClient.js';
import { NormalizerRegistry } from './NormalizerRegistry.js';
import { DomainMapper } from './DomainMapper.js';
import { normalizeSeats20260310 } from './normalizers/seats-2026-03-10.js';
import { normalizeCostCenter20260310 } from './normalizers/cost-centers-2026-03-10.js';
import { pickCostCenterRecords } from './schemas/cost-centers-schema.js';

export interface GitHubApiDataSourceConfig {
  fetcher?: RawApiClient;
  enterprise?: string;
  /**
   * 収集する Organization。`['auto']` (環境変数 `COPILOT_ORGS=auto`) はトークンが所属する Organization を
   * `GET /user/orgs` で自動探索する。空 / 未指定でも、Enterprise スコープが権限不足のときは自動探索へフォールバックする。
   */
  orgs?: string[];
  /** 取得するレポート日 (昇順)。省略時は直近の窓 (reportWindowDays)。再処理が収集時の日付を再現するのに使う */
  reportDays?: string[];
}

interface SeatsPage {
  total_seats?: number;
  seats?: unknown[];
}

/** 権限不足・不可視 (再試行しても結果が変わらない) を示す HTTP ステータス */
const DENIED_STATUSES = new Set([401, 403]);
/** Seats では 404 (対象が見えない) も権限不足として扱う */
const SEATS_DENIED_STATUSES = new Set([401, 403, 404]);
/** 自動探索した Organization を issue に列挙する最大件数 */
const MAX_LISTED_ORGS = 10;

/** 失敗理由として index.json に残す文字数の上限 (個人情報や巨大な本文を残さない) */
const MAX_ERROR_SUMMARY_LENGTH = 300;
/** data_integrity issue に列挙する隔離レコードの理由の最大件数 */
const MAX_QUARANTINE_REASONS = 3;

export class GitHubApiCopilotDataSource implements ICopilotDataSource {
  private fetcher: RawApiClient;
  private enterprise?: string;
  private orgs: string[];
  /** COPILOT_ORGS=auto: Organization を GET /user/orgs で自動探索する */
  private orgsAuto: boolean;
  /** 自動探索の結果 (fetchMetrics と fetchSeats で 1 回の呼び出しを共有する) */
  private discovery: Promise<string[]> | null = null;
  /** 実際に収集対象にした Organization (設定値または自動探索の結果)。Run Manifest に残す */
  private effectiveOrgs: string[] | null = null;
  private reportDays?: string[];
  /** 直近の fetchMetrics で実際に取得を試みたレポート日 */
  private requestedDays: string[] = [];
  private issues: DataFetchIssue[] = [];
  private statuses = new Map<DataSourceId, SourceStatus>();
  /** 直近の fetchMetrics で取得したユーザー行 (日付 → 重複排除済み)。fetchUserProfiles が使う */
  private userRowsByDay: Map<string, UserReportRow[]> | null = null;
  private qualityObservations: QualityObservations | null = null;
  /** 直近の fetchSeats で取得したシート (重複排除済み)。fetchTeamMetrics がチームの所属に使う */
  private lastSeats: CopilotSeatAssignment[] | null = null;
  private seatsNormalizers = new NormalizerRegistry<unknown, CopilotSeatAssignment>();

  constructor(config: GitHubApiDataSourceConfig = {}) {
    this.fetcher = config.fetcher || new RawApiFetcher();
    this.reportDays = config.reportDays;
    this.enterprise = config.enterprise || process.env.COPILOT_ENTERPRISE || undefined;
    const orgs =
      config.orgs ||
      (process.env.COPILOT_ORGS
        ? process.env.COPILOT_ORGS.split(',').map((s) => s.trim()).filter(Boolean)
        : []);
    this.orgsAuto = orgs.length === 1 && orgs[0].toLowerCase() === 'auto';
    this.orgs = this.orgsAuto ? [] : orgs;

    // 既定の Normalizers を登録
    this.seatsNormalizers.register('2026-03-10', normalizeSeats20260310);
  }

  /**
   * 利用状況メトリクス。Usage Metrics Reports API (users-1-day: 署名付き URL → NDJSON) から、
   * Enterprise と各 Organization のユーザー別 1 日レポートを取得し、ユーザーで重複排除して
   * 日次メトリクスを組み立てる。旧 `/copilot/metrics` エンドポイントは呼ばない (2026-04 に廃止)。
   *
   * 状態: 全て取得 → ok / 一部の日・スコープが失敗、または行を隔離 → partial /
   *       1 件も取得できない → failed (呼び出し側は Last-known-good を維持する)
   */
  async fetchMetrics(): Promise<CopilotDailyMetrics[]> {
    this.userRowsByDay = null;
    this.qualityObservations = null;
    if (!this.isConfigured()) {
      this.reportMissingConfig('metrics', 'config:copilot-metrics', 'Copilot Metrics');
      return [];
    }
    if (!this.hasToken('metrics')) return [];

    const days = this.reportDays ?? reportWindowDays();
    this.requestedDays = days;

    try {
      const client = new UsageReportsClient(this.fetcher);
      const entScope: ReportScope[] = this.enterprise ? [{ kind: 'enterprise', slug: this.enterprise }] : [];
      const toOrgScopes = (orgs: string[]): ReportScope[] => orgs.map((slug) => ({ kind: 'org' as const, slug }));

      let result: UsersRangeResult;
      let fellBack = false;
      if (this.enterprise && this.orgs.length === 0 && !this.orgsAuto) {
        // Level 1: Enterprise スコープだけを先に試す。権限不足ならアクセス可能な Organization へフォールバックする
        const entResult = await client.fetchUsersRange(entScope, days);
        const orgs = isReportScopeDenied(entResult) ? await this.discoverOrgs('the enterprise usage report scope was denied') : [];
        if (orgs.length > 0) {
          fellBack = true;
          result = combineRangeResults(entResult, await client.fetchUsersRange(toOrgScopes(orgs), days));
        } else {
          result = entResult;
        }
      } else {
        // Enterprise を優先 (重複排除で Enterprise の行を採る)。Org は併用する
        const orgs = await this.resolveOrgs();
        result = await client.fetchUsersRange([...entScope, ...toOrgScopes(orgs)], days);
      }

      const ok = result.outcomes.filter((o) => o.outcome === 'ok').length;
      const empty = result.outcomes.filter((o) => o.outcome === 'empty').length;
      const errors = result.outcomes.filter(
        (o): o is Extract<typeof o, { outcome: 'error' }> => o.outcome === 'error'
      );

      // 同じ原因 (スコープ × エラー種別) の失敗は 1 件の issue にまとめる。
      // 権限不足 (401/403) のスコープは、他のスコープが取得できていれば警告にとどめる (そのスコープだけ除外して集計を続ける)
      const reported = new Set<string>();
      for (const e of errors) {
        const key = `${scopeLabel(e.scope)}:${e.error.name}:${(e.error as any).status ?? ''}`;
        if (reported.has(key)) continue;
        reported.add(key);
        const target = `copilot/metrics/reports/users-1-day (${scopeLabel(e.scope)})`;
        if (ok > 0 && isDenied(e.error, DENIED_STATUSES)) {
          this.recordDeniedScope(target, scopeLabel(e.scope), e.error, 'usage metrics');
        } else {
          this.recordIssue(target, e.error);
        }
      }
      if (fellBack && ok > 0 && !errors.some((e) => e.scope.kind === 'enterprise')) {
        // Enterprise は 404 (レポートなし) のみ: 権限不足の可能性が高い。フォールバックしたことを残す
        this.pushIssue({
          severity: 'warning',
          category: 'not_found',
          target: `copilot/metrics/reports/users-1-day (enterprise:${this.enterprise})`,
          message: `No enterprise usage report was available (HTTP 404 for every day); collected the organization scope instead.`,
          details: ENTERPRISE_FALLBACK_DETAILS,
          http_status: 404,
        });
      }

      if (result.quarantined > 0 || result.malformedLines > 0) {
        const detail = [
          ...result.quarantineReasons,
          result.malformedLines > 0 ? `${result.malformedLines} malformed NDJSON line(s)` : '',
        ]
          .filter(Boolean)
          .join('\n');
        this.pushIssue({
          severity: 'warning',
          category: 'data_integrity',
          target: 'copilot/metrics/reports/users-1-day',
          message: `${result.quarantined + result.malformedLines} report row(s) failed validation and were quarantined (excluded from aggregation).`,
          details: detail || undefined,
        });
      }

      if (ok === 0) {
        // 1 件も取得できなかった。認証・権限・設定の誤りを示すことが多い (空の結果を「データなし」と偽らない)
        const reason =
          errors.length > 0
            ? `all ${errors.length} report request(s) failed`
            : `no usage report was available (HTTP 404/204 for all ${empty} request(s))`;
        if (errors.length === 0) {
          this.pushIssue({
            severity: 'error',
            category: 'not_found',
            target: 'copilot/metrics/reports/users-1-day',
            message: `No Copilot usage report was available for ${days[0]} .. ${days[days.length - 1]}.`,
            details:
              'Check that the token can read Copilot usage metrics (enterprise: manage_billing:copilot or read:enterprise; organization: read:org), ' +
              'that the "Copilot usage metrics" policy is enabled, and that COPILOT_ENTERPRISE / COPILOT_ORGS are correct.',
          });
        }
        this.setFailed('metrics', errors[0]?.error ?? new Error(reason), errors.length > 0 ? reason : undefined);
        return [];
      }

      this.userRowsByDay = result.rowsByDay;
      this.qualityObservations = {
        requested_days: [...days],
        available_days: [...result.rowsByDay.keys()].sort(),
        duplicates_collapsed: result.duplicatesCollapsed,
        out_of_range: result.outOfRange,
        quarantined: result.quarantined - result.outOfRange,
        malformed_lines: result.malformedLines,
      };
      const daily = buildAllDailyMetrics(result.rowsByDay);
      this.setStatus(
        'metrics',
        fellBack || errors.length > 0 || result.quarantined > 0 || result.malformedLines > 0 ? 'partial' : 'ok',
        daily.length,
        result.quarantined + result.malformedLines
      );
      return daily;
    } catch (err: any) {
      this.recordIssue('copilot/metrics/reports/users-1-day', err);
      this.setFailed('metrics', err);
      return [];
    }
  }

  async fetchSeats(): Promise<CopilotSeatAssignment[]> {
    this.lastSeats = null;
    if (!this.isConfigured()) {
      this.reportMissingConfig('seats', 'config:copilot-billing-seats', 'Copilot Seats');
      return [];
    }
    if (!this.hasToken('seats')) return [];

    const normalizer = this.seatsNormalizers.getNormalizer(this.fetcher.getApiVersion());

    // 取得対象: Enterprise と各 Organization を併用する (Enterprise を先頭に。重複排除では先頭の記録を採る)。
    // - 権限不足・不可視 (401/403/404) の対象は、再試行しても結果が変わらないため除外して警告にとどめ、
    //   取得できた対象のシートを採用する (partial)。Enterprise が拒否され COPILOT_ORGS が未設定なら Org を自動探索する。
    // - 一時的な失敗 (5xx・429・通信エラー) が 1 つでもあれば、不完全な席数を「現在値」として返さないよう全体を失敗扱いにする
    //   (呼び出し側は Last-known-good を維持する)。
    type SeatTarget = { endpoint: string; params: Record<string, string>; scope: string };
    type SeatOutcome =
      | { target: SeatTarget; ok: true; items: unknown[]; total?: number; truncated: boolean }
      | { target: SeatTarget; ok: false; error: unknown };

    const fetchTarget = async (target: SeatTarget): Promise<SeatOutcome> => {
      try {
        const result = await this.fetcher.fetchPaginated<SeatsPage, unknown>(target.endpoint, target.params, (page) =>
          Array.isArray(page?.seats) ? page.seats : []
        );
        const total = result.firstPage?.total_seats;
        return { target, ok: true, items: result.items, total: typeof total === 'number' ? total : undefined, truncated: result.truncated };
      } catch (error) {
        return { target, ok: false, error };
      }
    };
    const orgTarget = (org: string): SeatTarget => ({
      endpoint: '/orgs/{org}/copilot/billing/seats',
      params: { org },
      scope: `org:${org}`,
    });

    const outcomes: SeatOutcome[] = [];
    if (this.enterprise) {
      const ent = await fetchTarget({
        endpoint: '/enterprises/{ent}/copilot/billing/seats',
        params: { ent: this.enterprise },
        scope: `enterprise:${this.enterprise}`,
      });
      outcomes.push(ent);
      const entDenied = !ent.ok && isDenied(ent.error, SEATS_DENIED_STATUSES);
      const orgs =
        this.orgs.length === 0 && !this.orgsAuto
          ? entDenied
            ? await this.discoverOrgs('the enterprise seat scope was denied')
            : []
          : await this.resolveOrgs();
      for (const org of orgs) outcomes.push(await fetchTarget(orgTarget(org)));
    } else {
      for (const org of await this.resolveOrgs()) outcomes.push(await fetchTarget(orgTarget(org)));
    }

    const succeeded = outcomes.filter((o): o is Extract<SeatOutcome, { ok: true }> => o.ok);
    const failed = outcomes.filter((o): o is Extract<SeatOutcome, { ok: false }> => !o.ok);
    const transient = failed.filter((o) => !isDenied(o.error, SEATS_DENIED_STATUSES));

    if (outcomes.length === 0) {
      // COPILOT_ORGS=auto で 1 件も見つからなかった (探索側で issue を記録済み)
      this.setFailed('seats', new Error('no organization to collect seats from'));
      return [];
    }
    if (succeeded.length === 0 || transient.length > 0) {
      for (const f of failed) this.recordIssue('copilot/billing/seats', f.error);
      const lastError = (transient[transient.length - 1] ?? failed[failed.length - 1]).error;
      this.setFailed('seats', lastError, failed.length > 1 ? `${failed.length} of ${outcomes.length} targets failed` : undefined);
      return [];
    }
    for (const f of failed) this.recordDeniedScope('copilot/billing/seats', f.target.scope, f.error, 'seats');

    const rawSeats = succeeded.flatMap((o) => o.items);
    const truncated = succeeded.some((o) => o.truncated);
    const expectedTotalKnown = succeeded.every((o) => o.total !== undefined);
    const expectedTotal = succeeded.reduce((sum, o) => sum + (o.total ?? 0), 0);

    const { records: allRecords, quarantined } = this.normalizeEach(rawSeats, (item) =>
      DomainMapper.toSeatAssignment(normalizer(item))
    );
    this.reportQuarantine('copilot/billing/seats', quarantined);
    // Enterprise と Organization の両方に現れる同一ユーザーは 1 席として数える (二重計上を防ぐ)
    const records = succeeded.length > 1 ? mergeSeatsByLogin(allRecords) : allRecords;

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
    // 件数の照合は対象が 1 つのときだけ (複数対象では重複排除により件数が一致しないのが正常)
    if (succeeded.length === 1 && expectedTotalKnown && !truncated && expectedTotal !== rawSeats.length) {
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
      failed.length > 0 || quarantined.length > 0 || integrityWarning ? 'partial' : 'ok',
      records.length,
      quarantined.length
    );
    this.lastSeats = records;
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
      if (isDenied(err, DENIED_STATUSES)) {
        // Enterprise Owner / Billing Manager 以外のトークン: 障害ではなく対象外。属性マッピングの cost_center で配賦を続ける
        this.skipForPermission('cost_centers', 'billing/cost-centers', 'Cost Centers', err);
        return [];
      }
      this.recordIssue('billing/cost-centers', err);
      this.setFailed('cost_centers', err);
      return [];
    }
  }

  /**
   * Billing の AI credit usage (Enterprise 単位。REST にはこの Org 単位のエンドポイントが無い)。
   * 状態: 全日取得 → ok / 一部の日が失敗・行を隔離 → partial / 1 日も取得できない → failed。
   * Enterprise 未設定は対象外 (skipped)。収集時に無かった要求の再生 (古い run の再処理) も対象外にする。
   */
  async fetchAiCreditUsage(): Promise<CostLine[]> {
    if (!this.enterprise) {
      this.setStatus('ai_credits', 'skipped', 0);
      return [];
    }
    if (!this.hasToken('ai_credits')) return [];

    const days = this.reportDays ?? reportWindowDays();
    try {
      const result = await new AiCreditUsageClient(this.fetcher).fetchRange(this.enterprise, days);
      const errors = result.outcomes.filter(
        (o): o is Extract<typeof o, { outcome: 'error' }> => o.outcome === 'error'
      );

      if (errors.length > 0 && errors.every((e) => e.error.name === 'ReplayMissError')) {
        this.setStatus('ai_credits', 'skipped', 0);
        return [];
      }

      const okDays = result.outcomes.filter((o) => o.outcome === 'ok').length;
      if (okDays === 0 && errors.length > 0 && errors.every((e) => isDenied(e.error, DENIED_STATUSES))) {
        // 権限不足 (403): 障害ではなく対象外。AI Credits の金額は Monthly Usage Report (CSV) / シート情報で補う
        this.skipForPermission('ai_credits', 'billing/ai_credit/usage', 'AI Credit usage', errors[0].error);
        return [];
      }

      const reported = new Set<string>();
      for (const e of errors) {
        const key = `${e.error.name}:${(e.error as any).status ?? ''}`;
        if (reported.has(key)) continue;
        reported.add(key);
        this.recordIssue('billing/ai_credit/usage', e.error);
      }

      if (result.quarantined > 0) {
        this.pushIssue({
          severity: 'warning',
          category: 'data_integrity',
          target: 'billing/ai_credit/usage',
          message: `${result.quarantined} usage item(s) failed validation and were quarantined (excluded).`,
          details: result.quarantineReasons.join('\n') || undefined,
        });
      }

      if (okDays === 0) {
        const reason =
          errors.length > 0
            ? `all ${errors.length} request(s) failed`
            : 'no AI credit usage report was available (HTTP 404 for all requests)';
        if (errors.length === 0) {
          this.pushIssue({
            severity: 'warning',
            category: 'not_found',
            target: 'billing/ai_credit/usage',
            message: `No AI credit usage report was available for ${days[0]} .. ${days[days.length - 1]}.`,
            details:
              'The token needs read access to enterprise billing (enterprise administrator / billing manager). GitHub may return 404 for insufficient permission.',
          });
        }
        this.setFailed('ai_credits', errors[0]?.error ?? new Error(reason), errors.length > 0 ? reason : undefined);
        return [];
      }

      const lines: CostLine[] = [];
      for (const [day, items] of result.itemsByDay) for (const item of items) lines.push(toCostLine(day, item));
      this.setStatus(
        'ai_credits',
        errors.length > 0 || result.quarantined > 0 ? 'partial' : 'ok',
        lines.length,
        result.quarantined
      );
      return lines;
    } catch (err: any) {
      this.recordIssue('billing/ai_credit/usage', err);
      this.setFailed('ai_credits', err);
      return [];
    }
  }

  /**
   * Cost Center の予算 (上限・無料枠) は GitHub の公開 REST API から取得しない (SDD-03 §4.3)。
   * 上限と無料枠は管理者の宣言 `COPILOT_COST_CENTER_BUDGETS` だけが出所で、パイプラインが
   * シート費用と突き合わせて評価する (BillingCalculator.computeCostCenterBudgets, SDD-06 §1.2)。
   * そのためこのアダプターは契約として空配列を返し、HTTP 呼び出しも障害の記録もしない (推測で値を作らない)。
   */
  async fetchCostCenterBudgets(): Promise<CostCenterBudget[]> {
    return [];
  }

  /**
   * ユーザー別の利用プロファイル (日次履歴付き)。直近の fetchMetrics で取得した実測 (users-1-day) から作る。
   * 表示名・部署・Cost Center などの属性は、呼び出し側 (パイプライン) がシートとマッピングで補う。
   */
  async fetchUserProfiles(): Promise<UserUsageProfile[]> {
    return this.userRowsByDay ? buildUserProfiles(this.userRowsByDay) : [];
  }

  /**
   * チーム別の日次メトリクス (SDD-03 §2.4)。廃止済みの `GET /orgs/{org}/teams/{team}/copilot/metrics`
   * (2026-04 Sunset) は呼ばず、同じ実行の fetchMetrics (users-1-day の重複排除済みユーザー行) と
   * fetchSeats (assigning_teams / assigning_team) を結合して組み立てる。追加の API 呼び出しはしない。
   * どちらかが未取得・失敗のときは空配列 (取得状態は metrics / seats の SourceStatus に出ている)。
   */
  async fetchTeamMetrics(teamSlug: string): Promise<TeamDailyMetrics[]> {
    if (!this.userRowsByDay || !this.lastSeats) return [];
    return buildTeamDailyMetrics(teamSlug, this.userRowsByDay, this.lastSeats);
  }


  getQualityObservations(): QualityObservations | null {
    return this.qualityObservations;
  }

  /** Run Manifest に残す収集設定 (スラッグと日付のみ) */
  getCollectionConfig(): { enterprise?: string; orgs: string[]; report_days: string[] } {
    return {
      ...(this.enterprise ? { enterprise: this.enterprise } : {}),
      // 自動探索した Organization も残す (再処理が同じエンドポイントを要求できるように)
      orgs: [...(this.effectiveOrgs ?? this.orgs)],
      report_days: [...this.requestedDays],
    };
  }

  getIssues(): DataFetchIssue[] {
    return [...this.issues];
  }

  getSourceStatuses(): SourceStatus[] {
    const order: DataSourceId[] = ['metrics', 'seats', 'cost_centers', 'ai_credits'];
    return order
      .map((id) => this.statuses.get(id))
      .filter((s): s is SourceStatus => s !== undefined)
      .map((s) => ({ ...s }));
  }

  // ---------------------------------------------------------------------------
  // internals
  // ---------------------------------------------------------------------------

  private isConfigured(): boolean {
    return Boolean(this.enterprise) || this.orgs.length > 0 || this.orgsAuto;
  }

  /** 設定された Organization、または COPILOT_ORGS=auto のときは自動探索の結果 */
  private async resolveOrgs(): Promise<string[]> {
    if (this.orgsAuto) return this.discoverOrgs('COPILOT_ORGS=auto');
    return this.orgs;
  }

  /**
   * Level 2: トークンが所属する Organization を `GET /user/orgs` で探索する (1 回だけ呼び、結果を共有する)。
   * 探索の失敗 (GitHub App のインストールトークンは呼べない等) はソースを失敗させず、警告として残して空を返す。
   */
  private discoverOrgs(reason: string): Promise<string[]> {
    if (!this.discovery) {
      this.discovery = (async () => {
        try {
          const result = await this.fetcher.fetchPaginated<unknown, string>('/user/orgs', {}, (page) =>
            Array.isArray(page)
              ? page
                  .map((o) => (o && typeof o === 'object' ? (o as { login?: unknown }).login : undefined))
                  .filter((login): login is string => typeof login === 'string' && login.length > 0)
              : []
          );
          const orgs = [...new Set(result.items)].sort((a, b) => a.localeCompare(b));
          this.effectiveOrgs = orgs;
          if (orgs.length > 0) {
            // 成功は障害ではないので issue にしない (対象の Organization は Run Manifest の config.orgs に残る)
            const listed =
              orgs.slice(0, MAX_LISTED_ORGS).join(', ') +
              (orgs.length > MAX_LISTED_ORGS ? `, … (+${orgs.length - MAX_LISTED_ORGS})` : '');
            console.log(`🔎 Organization auto-discovery (${reason}): ${orgs.length} organization(s) via GET /user/orgs: ${listed}.`);
          } else {
            this.pushIssue({
              severity: 'warning',
              category: 'not_found',
              target: 'config:org-discovery',
              message: `Organization auto-discovery (${reason}): GET /user/orgs returned no organization for the token.`,
              details: ORG_DISCOVERY_DETAILS,
            });
          }
          return orgs;
        } catch (err: any) {
          if (err?.name === 'ReplayMissError') return [];
          this.pushIssue({
            severity: 'warning',
            category: 'api_auth',
            target: 'config:org-discovery',
            message: `Organization auto-discovery (GET /user/orgs) failed (${reason}): ${String(err?.message ?? err).slice(0, MAX_ERROR_SUMMARY_LENGTH)}`,
            details: ORG_DISCOVERY_DETAILS,
            ...(typeof err?.status === 'number' ? { http_status: err.status } : {}),
          });
          return [];
        }
      })();
    }
    return this.discovery;
  }

  /** 権限不足で除外したスコープ (他のスコープは取得できた) を警告として残す */
  private recordDeniedScope(endpoint: string, scope: string, err: any, what: string): void {
    const status: number | undefined = typeof err?.status === 'number' ? err.status : undefined;
    this.pushIssue({
      severity: 'warning',
      category: status === 404 ? 'not_found' : 'api_auth',
      target: `${endpoint} (${scope})`,
      message: `Access to ${scope} was denied (HTTP ${status ?? 'error'}); its ${what} are excluded and the other accessible scopes were collected.`,
      details: scope.startsWith('enterprise:') ? ENTERPRISE_FALLBACK_DETAILS : 'Grant the token access to this organization (organization owner / billing manager, read:org or manage_billing:copilot) to include it.',
      ...(status !== undefined ? { http_status: status } : {}),
    });
  }

  /** Enterprise 専用機能が権限不足 (401/403) のとき: 対象外 (skipped) として警告を残す */
  private skipForPermission(source: DataSourceId, endpoint: string, label: string, err: any): void {
    const status: number = typeof err?.status === 'number' ? err.status : 403;
    this.pushIssue({
      severity: 'warning',
      category: 'api_auth',
      target: endpoint,
      message: `${label} requires enterprise billing permission (HTTP ${status}); skipped. Aggregation continues without it.`,
      details:
        source === 'cost_centers'
          ? 'Cost allocation uses the cost_center attribute of COPILOT_USER_MAPPING instead. An enterprise owner or billing manager token is needed to read GitHub Cost Centers.'
          : 'AI credit amounts come from the Monthly Usage Report (CSV) import instead. An enterprise owner or billing manager token is needed to read AI credit usage.',
      http_status: status,
    });
    this.setStatus(source, 'skipped', 0);
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

const ENTERPRISE_FALLBACK_DETAILS =
  'Enterprise endpoints (/enterprises/{enterprise}/...) require an enterprise owner or billing manager token. ' +
  'Collection continued with the organization scope (COPILOT_ORGS, or the organizations discovered via GET /user/orgs).';

const ORG_DISCOVERY_DETAILS =
  'Set COPILOT_ORGS (comma-separated organization slugs) to pin the organizations to collect. ' +
  'GET /user/orgs needs a user token (classic PAT with read:org, or a fine-grained PAT); GitHub App installation tokens cannot call it.';

/** 権限不足・不可視を示す失敗か (レート制限 429 は含まない) */
function isDenied(err: unknown, statuses: Set<number>): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && statuses.has(status);
}

/**
 * Enterprise スコープのレポートが 1 日も取得できず、失敗が全て権限不足 (401/403) か 404 (レポートなし) のとき true。
 * 一時的な失敗 (5xx 等) を含むときはフォールバックしない (Enterprise の結果として扱う)。
 */
function isReportScopeDenied(result: UsersRangeResult): boolean {
  if (result.outcomes.length === 0) return false;
  return result.outcomes.every(
    (o) =>
      (o.outcome === 'error' && isDenied(o.error, DENIED_STATUSES)) || (o.outcome === 'empty' && o.status === 404)
  );
}

/** Enterprise の (取得できなかった) 結果に Organization の結果を足す。Enterprise の行は無いので重複排除は不要 */
function combineRangeResults(ent: UsersRangeResult, orgs: UsersRangeResult): UsersRangeResult {
  return {
    ...orgs,
    outcomes: [...ent.outcomes, ...orgs.outcomes],
    quarantined: ent.quarantined + orgs.quarantined,
    outOfRange: ent.outOfRange + orgs.outOfRange,
    quarantineReasons: [...ent.quarantineReasons, ...orgs.quarantineReasons].slice(0, MAX_QUARANTINE_REASONS),
    malformedLines: ent.malformedLines + orgs.malformedLines,
  };
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

/**
 * Enterprise と Organization の取得結果を、ログイン名 (大文字小文字を区別しない) で 1 席にまとめる。
 * 先に現れた記録 (Enterprise が先頭) を採り、その organization が null のときだけ後続の記録で補う。
 */
export function mergeSeatsByLogin(seats: CopilotSeatAssignment[]): CopilotSeatAssignment[] {
  const byLogin = new Map<string, CopilotSeatAssignment>();
  for (const seat of seats) {
    const key = seat.assignee.login.toLowerCase();
    const existing = byLogin.get(key);
    if (!existing) {
      byLogin.set(key, seat);
    } else if (existing.organization === null && seat.organization !== null) {
      byLogin.set(key, { ...existing, organization: seat.organization });
    }
  }
  return Array.from(byLogin.values());
}
