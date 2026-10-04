import { ForkSafeStorageWriter } from '../adapters/storage/ForkSafeStorageWriter.js';
import { BillingReconciliationService } from '../application/pipeline/billing-reconciliation.js';
import { createGitHubRestIssuesApi, fileReconciliationIssues } from '../application/pipeline/billing-reconciliation-issues.js';
import type { BillingReconciliationReport } from '../domain/entities/billing-reconciliation.js';
import { parseTolerance } from '../processor/billing-reconciliation.js';

/**
 * 請求突合 (P4-4 / E-03)。
 *   npm run billing:report [-- --month YYYY-MM]              突合結果を表示する
 *   npm run billing:issues [-- --month YYYY-MM] [--dry-run]  許容差を超えた月を GitHub issue にする (同じ月は重複しない)
 * 許容差は COPILOT_RECONCILIATION_TOLERANCE (JSON `{"absolute_usd":1,"percent":1}`、既定 1 USD かつ 1 %)。
 * issue 化には GITHUB_TOKEN (issues: write) と GITHUB_REPOSITORY が必要。請求額は issue に載せない (SDD-17 §5)。
 */

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const MONTH = /^\d{4}-\d{2}$/;

function usd(n: number | null): string {
  return n === null ? 'n/a' : n.toFixed(2);
}

function print(reports: BillingReconciliationReport[]): void {
  if (reports.length === 0) {
    console.log('ℹ️ No billing reconciliation data (the Billing API AI credit usage has not been collected yet).');
    return;
  }
  for (const r of reports) {
    console.log(
      `${r.month}  ${r.status.padEnd(16)} computed=$${usd(r.computed_usd)} billed(gross)=$${usd(r.billed_gross_usd)} ` +
        `diff=$${usd(r.difference_usd)} (${r.difference_percent === null ? 'n/a' : `${r.difference_percent.toFixed(2)}%`}) ` +
        `days=${r.days_covered} tolerance=$${r.tolerance.absolute_usd}&${r.tolerance.percent}% pricing=${r.versions.pricing_catalog_version}`
    );
  }
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2);
  const storage = new ForkSafeStorageWriter({ isDemo: args.includes('--demo') });
  const svc = new BillingReconciliationService(storage);

  const month = option(args, '--month');
  if (month !== undefined && !MONTH.test(month)) return usage(`--month must be YYYY-MM: ${month}`);

  const parsed = parseTolerance(process.env.COPILOT_RECONCILIATION_TOLERANCE);
  if (parsed.error) console.warn(`⚠️ ${parsed.error}`);
  // 保存済みの許容差ではなく、現在の設定で判定し直す (許容差の変更を過去月にも反映する)
  const all = svc.reports(parsed.tolerance);
  const judged = month ? [all.find((r) => r.month === month) ?? svc.reportFor(month)] : all;

  if (command === 'report') {
    print(judged);
    return 0;
  }

  if (command === 'issues') {
    const dryRun = args.includes('--dry-run');
    const repository = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    if (!dryRun && (!repository || !token)) return usage('GITHUB_REPOSITORY and GITHUB_TOKEN are required (or pass --dry-run).');
    if (judged.every((r) => r.status !== 'exceeded')) {
      console.log('✅ No month exceeds the reconciliation tolerance; no issue to file.');
      return 0;
    }
    // --dry-run は作成だけを行わない。認証情報があれば既存 issue の確認 (読み取り) はする
    const api =
      repository && token
        ? createGitHubRestIssuesApi({ repository, token, apiUrl: process.env.GITHUB_API_URL })
        : { isPrivate: async () => false, listIssues: async () => [], createIssue: async () => ({ number: 0, url: '' }) };
    const result = await fileReconciliationIssues(judged, api, { dryRun });
    for (const e of result.entries) {
      console.log(`${e.action === 'created' ? '🆕' : e.action === 'dry_run' ? '📝' : '⏭️'} ${e.month}: ${e.action}${e.issue_number ? ` #${e.issue_number}` : ''}`);
    }
    return 0;
  }

  return usage('Usage: tsx src/cli/billing-reconcile.ts <report|issues> [--month YYYY-MM] [--dry-run]');
}

function usage(message: string): number {
  console.error(`❌ ${message}`);
  return 2;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
);
