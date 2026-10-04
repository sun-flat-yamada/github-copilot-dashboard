import type { BillingReconciliationReport } from '../../domain/entities/billing-reconciliation.js';
import {
  RECONCILIATION_ISSUE_LABEL,
  buildIssueDraft,
  reconciliationMarker,
} from '../../processor/billing-reconciliation.js';

/**
 * 許容差超過の issue 化 (P4-4 / E-03)。同じ月について重複して起票しない。
 * GitHub への依存は最小のインタフェースに閉じ込め、テストでは偽の実装を渡す。
 */

export interface ExistingIssue {
  number: number;
  state: 'open' | 'closed';
  body: string | null;
}

export interface GitHubIssuesApi {
  /** リポジトリが非公開か。判定できなければ false (公開として扱う = 金額を載せない) */
  isPrivate(): Promise<boolean>;
  /** ラベル付きの issue (open / closed の両方。pull request は含めない) */
  listIssues(label: string): Promise<ExistingIssue[]>;
  createIssue(input: { title: string; body: string; labels: string[] }): Promise<{ number: number; url: string }>;
}

export interface IssueFilingEntry {
  month: string;
  action: 'created' | 'skipped_existing' | 'dry_run';
  issue_number?: number;
  url?: string;
}

export interface IssueFilingResult {
  /** 許容差超過ではない月 (match / within_tolerance / unavailable) は対象外 */
  considered: number;
  entries: IssueFilingEntry[];
}

export async function fileReconciliationIssues(
  reports: readonly BillingReconciliationReport[],
  api: GitHubIssuesApi,
  options: { dryRun?: boolean } = {}
): Promise<IssueFilingResult> {
  const exceeded = reports.filter((r) => r.status === 'exceeded');
  const result: IssueFilingResult = { considered: exceeded.length, entries: [] };
  if (exceeded.length === 0) return result;

  // 既存の確認ができないまま起票しない (重複を作らない)。一覧の取得に失敗したら例外のまま伝える
  const existing = await api.listIssues(RECONCILIATION_ISSUE_LABEL);
  const redact = !(await api.isPrivate());
  const seen = new Set<string>();

  for (const report of [...exceeded].sort((a, b) => a.month.localeCompare(b.month))) {
    const marker = reconciliationMarker(report.month);
    const found = existing.find((i) => i.body?.includes(marker));
    if (found || seen.has(report.month)) {
      result.entries.push({ month: report.month, action: 'skipped_existing', issue_number: found?.number });
      continue;
    }
    seen.add(report.month);
    if (options.dryRun) {
      result.entries.push({ month: report.month, action: 'dry_run' });
      continue;
    }
    const draft = buildIssueDraft(report, { redact });
    const created = await api.createIssue({ title: draft.title, body: draft.body, labels: draft.labels });
    existing.push({ number: created.number, state: 'open', body: draft.body });
    result.entries.push({ month: report.month, action: 'created', issue_number: created.number, url: created.url });
  }
  return result;
}

/** GitHub REST を使う実装。トークンはヘッダにだけ使い、出力しない */
export function createGitHubRestIssuesApi(options: {
  repository: string;
  token: string;
  apiUrl?: string;
  fetchImpl?: typeof fetch;
}): GitHubIssuesApi {
  const base = (options.apiUrl ?? 'https://api.github.com').replace(/\/$/, '');
  const doFetch = options.fetchImpl ?? fetch;
  const headers = {
    Authorization: `Bearer ${options.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
  const request = async (method: string, path: string, body?: unknown): Promise<any> => {
    const res = await doFetch(`${base}/repos/${options.repository}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`GitHub API ${method} ${path.split('?')[0] || '/'} failed with HTTP ${res.status}`);
    return res.json();
  };

  return {
    async isPrivate() {
      try {
        const repo = await request('GET', '');
        return repo?.private === true;
      } catch {
        return false;
      }
    },
    async listIssues(label) {
      const out: ExistingIssue[] = [];
      for (let page = 1; page <= 20; page++) {
        const items: any[] = await request(
          'GET',
          `/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100&page=${page}`
        );
        for (const i of items) {
          if (i.pull_request) continue;
          out.push({ number: i.number, state: i.state === 'closed' ? 'closed' : 'open', body: i.body ?? null });
        }
        if (items.length < 100) break;
      }
      return out;
    },
    async createIssue(input) {
      const created = await request('POST', '/issues', input);
      return { number: created.number, url: created.html_url };
    },
  };
}
