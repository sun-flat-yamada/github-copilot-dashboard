import { execFileSync } from 'node:child_process';
import { RawLandingStore } from '../adapters/raw-landing/RawLandingStore.js';
import { RetentionService } from '../application/pipeline/retention.js';
import { confirmMatches, parseRetentionMonths, retentionExecutionRefusal } from '../processor/retention.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';

/**
 * 保持期間ポリシー (P4-6 / E-05)。SDD-17 §8。
 *   npm run retention:plan                                         ドライラン: 期限切れの対象を一覧する (何も変更しない)
 *   npm run retention:apply -- --execute --confirm <カットオフ月> [--actor <alias>]
 *                                                                  明示実行: 計画の対象を削除し audit/retention/log.json に記録する
 * `retention:apply` を --execute 無しで実行してもドライランになる。保持月数は COPILOT_DATA_RETENTION_MONTHS (既定 60)。
 * processed/** (確定済みの月次 closes/ と改訂履歴を含む) は削除しない。main ブランチ汚染の checkout では実行しない。
 */

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(1)} MiB`;
}

function main(): number {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'plan' && command !== 'apply') {
    console.error('❌ Usage: tsx src/cli/retention.ts <plan|apply> [--execute --confirm <YYYY-MM>] [--actor <alias>]');
    return 2;
  }
  if (args.includes('--demo')) {
    console.error('❌ Retention is not applied to demo data.');
    return 2;
  }

  const { months, error } = parseRetentionMonths(process.env.COPILOT_DATA_RETENTION_MONTHS);
  if (error) console.warn(`⚠️ ${error}`);

  const storage = new ForkSafeStorage();
  const service = new RetentionService(storage);
  const now = new Date();
  const plan = service.plan(now, months);
  const summary = service.summarizePlan(plan);

  console.log(`🗓️ Retention: keep the latest ${plan.retention_months} month(s); months before ${plan.keep_from} are expired.`);
  const categories = Object.entries(summary);
  if (categories.length === 0) console.log('✅ Nothing is past the retention period.');
  for (const [category, s] of categories) {
    console.log(`   - ${category}: ${s!.count} item(s), ${formatBytes(s!.bytes)} (${s!.keys.slice(0, 6).join(', ')}${s!.keys.length > 6 ? ', ...' : ''})`);
  }
  for (const s of plan.skipped) {
    console.log(`   ⏭️ kept ${s.category}/${s.key}: ${s.reason === 'not_closed' ? 'the month is not closed yet (npm run month:close)' : 'unrecognized name'}`);
  }
  console.log('   Never deleted: processed/** (closed-month snapshots and revisions in processed/closes/), index.json, error-log.json, catalog/, config/, audit/retention/.');

  const execute = command === 'apply' && args.includes('--execute');
  if (!execute) {
    console.log(`ℹ️ Dry run: nothing was changed.${plan.items.length > 0 ? ` To delete: npm run retention:apply -- --execute --confirm ${plan.keep_from}` : ''}`);
    if (plan.items.length > 0 && process.env.GITHUB_ACTIONS === 'true') {
      console.log(`::warning title=Data retention::${plan.items.length} item(s) are past the ${plan.retention_months}-month retention period. Review with npm run retention:plan and apply it explicitly.`);
    }
    return 0;
  }

  if (!confirmMatches(option(args, '--confirm'), plan)) {
    console.error(`❌ --confirm must equal the cutoff month of the current plan (${plan.keep_from}). Nothing was deleted.`);
    return 2;
  }
  const refusal = retentionExecutionRefusal({
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    trackedDataFiles: (git(['ls-files', 'data/']) ?? '').split('\n').filter((l) => l.trim()).length,
    isDemo: storage.isDemoStorage(),
  });
  if (refusal) {
    console.error(`❌ ${refusal}`);
    return 1;
  }
  if (plan.items.length === 0) {
    console.log('✅ Nothing to delete.');
    return 0;
  }

  const record = service.execute(plan, RawLandingStore.newRunId(now), now, option(args, '--actor'));
  console.log(`${record.status === 'completed' ? '🗑️' : '❌'} Retention run ${record.run_id}: ${record.status}. Recorded in audit/retention/log.json.`);
  for (const e of record.errors) console.error(`   - ${e}`);
  return record.status === 'completed' ? 0 : 1;
}

process.exit(main());
