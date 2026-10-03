import { RawApiClient } from '../RawApiClient.js';
import { parseNdjson } from './ndjson.js';
import { UserReportRow, validateUserReportRow } from './user-report-schema.js';
import { userKey } from './user-report-mapper.js';

/** users-1-day レポートの取得対象 (Enterprise 全体、または 1 つの Organization) */
export type ReportScope = { kind: 'enterprise'; slug: string } | { kind: 'org'; slug: string };

export const scopeLabel = (scope: ReportScope): string => `${scope.kind}:${scope.slug}`;

/** 取得ウィンドウの日数 (当月の月初までを含める。下記 reportWindowDays 参照) */
export const REPORT_WINDOW_DAYS = 30;

/** レポート取得の並列度。Enterprise + Org の併用でも二次レート制限に当たらない控えめな値 */
const DEFAULT_CONCURRENCY = 3;

interface ReportLinks {
  download_links?: unknown;
  report_day?: unknown;
}

export type DayOutcome =
  | { scope: ReportScope; day: string; outcome: 'ok'; rows: number }
  /** 204 (本文なし) / 404: その日のレポートがまだ無い (未生成・範囲外・集計対象のユーザーが居ない) */
  | { scope: ReportScope; day: string; outcome: 'empty'; status: number }
  | { scope: ReportScope; day: string; outcome: 'error'; error: Error };

export interface UsersRangeResult {
  /** 日付 → 重複排除済みのユーザー行 (Enterprise の行を優先) */
  rowsByDay: Map<string, UserReportRow[]>;
  outcomes: DayOutcome[];
  /** 検証に失敗して隔離した行数 (範囲外の日付の行を含む) */
  quarantined: number;
  /** quarantined のうち、要求した日と異なる日付 (範囲外) の行数 */
  outOfRange: number;
  quarantineReasons: string[];
  /** NDJSON として壊れていた行数 */
  malformedLines: number;
  /** Enterprise と Org の両方に現れた同一ユーザーの行を 1 件に集約した数 */
  duplicatesCollapsed: number;
}

/**
 * 取得するレポート日の一覧 (昇順, YYYY-MM-DD, UTC)。
 *
 * 終端は「昨日」。当日分は集計が済んでおらず、完全な日として提供されない。
 * 始端は「当月の月初」と「30 日前」の早い方。月末 (29〜31 日) の実行でも、当月の月次集計に
 * 月初からの全日が含まれるようにするため。Reports API は直近 1 年分まで取得できる。
 */
export function reportWindowDays(now: Date = new Date(), windowDays: number = REPORT_WINDOW_DAYS): string[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const windowStart = new Date(end.getTime() - (windowDays - 1) * 86400000);
  const start = monthStart < windowStart ? monthStart : windowStart;

  const days: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function endpointFor(scope: ReportScope): { endpoint: string; params: Record<string, string> } {
  return scope.kind === 'enterprise'
    ? { endpoint: '/enterprises/{ent}/copilot/metrics/reports/users-1-day', params: { ent: scope.slug } }
    : { endpoint: '/orgs/{org}/copilot/metrics/reports/users-1-day', params: { org: scope.slug } };
}

/**
 * Usage Metrics Reports API (users-1-day) のクライアント。
 *
 * 1. `GET .../users-1-day?day=YYYY-MM-DD` が `{ download_links, report_day }` を返す
 * 2. download_links (有効期限付きの署名付き URL) を **認証ヘッダーなし** で取得する
 * 3. NDJSON を行ごとに解析し、行ごとに検証する (壊れた行・不正な行は隔離して残りを使う)
 */
export class UsageReportsClient {
  private concurrency: number;

  constructor(
    private readonly fetcher: RawApiClient,
    options: { concurrency?: number } = {}
  ) {
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  }

  /** 1 スコープ・1 日分のユーザー行を取得する。レポートが無い日は rows = null */
  async fetchUsersDay(
    scope: ReportScope,
    day: string
  ): Promise<{
    status: number;
    rows: UserReportRow[] | null;
    quarantined: number;
    outOfRange: number;
    reasons: string[];
    malformedLines: number;
  }> {
    const { endpoint, params } = endpointFor(scope);
    const { status, body } = await this.fetcher.fetchRawAllowing<ReportLinks>(endpoint, params, { day }, [404]);
    if (body === null) {
      return { status, rows: null, quarantined: 0, outOfRange: 0, reasons: [], malformedLines: 0 };
    }

    const links = Array.isArray(body.download_links)
      ? body.download_links.filter((l): l is string => typeof l === 'string')
      : [];
    if (typeof body.report_day === 'string' && body.report_day !== day) {
      throw new Error(`Report day mismatch for ${scopeLabel(scope)}: requested ${day}, received ${body.report_day}`);
    }

    const rows: UserReportRow[] = [];
    let quarantined = 0;
    let outOfRange = 0;
    let malformedLines = 0;
    const reasons: string[] = [];

    for (const link of links) {
      const text = await this.fetcher.downloadSigned(link);
      const parsed = parseNdjson(text);
      malformedLines += parsed.malformed;
      for (const raw of parsed.rows) {
        const result = validateUserReportRow(raw);
        if (!result.ok) {
          quarantined++;
          if (reasons.length < 3) reasons.push(result.reason);
        } else if (result.row.day.slice(0, 10) !== day) {
          quarantined++;
          outOfRange++;
          if (reasons.length < 3) reasons.push('day: row day does not match the report day');
        } else {
          rows.push(result.row);
        }
      }
    }
    return { status, rows, quarantined, outOfRange, reasons, malformedLines };
  }

  /**
   * 複数スコープ × 複数日を取得し、ユーザーで重複排除する。
   * scopes は優先順 (Enterprise を先頭に): 同じユーザーが複数のスコープに現れたら先頭のスコープの行を採る。
   * 日・スコープ単位の失敗は outcomes に記録して他を続行する (呼び出し側が状態を決める)。
   */
  async fetchUsersRange(scopes: ReportScope[], days: string[]): Promise<UsersRangeResult> {
    type Task = { scope: ReportScope; scopeIndex: number; day: string };
    const tasks: Task[] = [];
    scopes.forEach((scope, scopeIndex) => days.forEach((day) => tasks.push({ scope, scopeIndex, day })));

    type Fetched = { task: Task; rows: UserReportRow[] };
    const fetched: Fetched[] = [];
    const outcomes: DayOutcome[] = new Array(tasks.length);
    let quarantined = 0;
    let outOfRange = 0;
    let malformedLines = 0;
    const quarantineReasons: string[] = [];

    let next = 0;
    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= tasks.length) return;
        const task = tasks[i];
        try {
          const result = await this.fetchUsersDay(task.scope, task.day);
          quarantined += result.quarantined;
          outOfRange += result.outOfRange;
          malformedLines += result.malformedLines;
          for (const r of result.reasons) {
            if (quarantineReasons.length < 3) quarantineReasons.push(`${scopeLabel(task.scope)} ${task.day} ${r}`);
          }
          if (result.rows === null) {
            outcomes[i] = { scope: task.scope, day: task.day, outcome: 'empty', status: result.status };
          } else {
            fetched.push({ task, rows: result.rows });
            outcomes[i] = { scope: task.scope, day: task.day, outcome: 'ok', rows: result.rows.length };
          }
        } catch (err: any) {
          outcomes[i] = { scope: task.scope, day: task.day, outcome: 'error', error: err };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, tasks.length) }, worker));

    // スコープの優先順 → 日付の順に重ねて、ユーザーで重複排除する
    fetched.sort((a, b) => a.task.scopeIndex - b.task.scopeIndex || a.task.day.localeCompare(b.task.day));
    const rowsByDay = new Map<string, UserReportRow[]>();
    const seenByDay = new Map<string, Set<string>>();
    let duplicatesCollapsed = 0;
    for (const { task, rows } of fetched) {
      const seen = seenByDay.get(task.day) ?? new Set<string>();
      const list = rowsByDay.get(task.day) ?? [];
      for (const row of rows) {
        const key = userKey(row);
        if (seen.has(key)) {
          duplicatesCollapsed++;
          continue;
        }
        seen.add(key);
        list.push(row);
      }
      seenByDay.set(task.day, seen);
      rowsByDay.set(task.day, list);
    }

    return { rowsByDay, outcomes, quarantined, outOfRange, quarantineReasons, malformedLines, duplicatesCollapsed };
  }
}
