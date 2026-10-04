import * as path from 'node:path';
import { ReportGenerationService } from '../application/pipeline/report-generation.js';
import { loadReportDefinitions } from '../processor/report-engine.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';

/**
 * 定義駆動レポート (P4-5 / E-04)。
 *   npm run reports:validate [-- --dir reports]                         定義 (reports/*.yaml) を検証する
 *   npm run reports:generate -- --due                                   スケジュールに従って未生成のレポートを生成する
 *   npm run reports:generate -- --id <id> [--month YYYY-MM] [--demo]    1 件を手動で生成する
 * 生成物は data/audit/report-outputs/ (Pages へは配信しない)。不正な定義があっても他の定義は生成し、最後に exit 1 で知らせる。
 */

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

function usage(message: string): number {
  console.error(`❌ ${message}`);
  return 2;
}

function main(): number {
  const [command, ...args] = process.argv.slice(2);
  const dir = path.resolve(process.cwd(), option(args, '--dir') ?? 'reports');
  const loaded = loadReportDefinitions(dir);

  for (const bad of loaded.invalid) {
    console.error(`❌ ${bad.file}`);
    for (const e of bad.errors) console.error(`   - ${e}`);
  }

  if (command === 'validate') {
    for (const d of loaded.definitions) console.log(`✅ ${d.file} (${d.definition.id}, dataset=${d.definition.dataset}, schedule=${d.definition.schedule ?? 'manual'})`);
    if (loaded.definitions.length === 0 && loaded.invalid.length === 0) console.log(`ℹ️ No report definitions in ${dir}.`);
    return loaded.invalid.length > 0 ? 1 : 0;
  }

  if (command !== 'generate') return usage('Usage: tsx src/cli/reports.ts <validate|generate> [--due] [--id <id>] [--month YYYY-MM] [--demo] [--dir <dir>]');

  const due = args.includes('--due');
  const id = option(args, '--id');
  const month = option(args, '--month');
  if (!due && !id) return usage('generate needs --due or --id <id>.');
  if (month !== undefined && !/^\d{4}-\d{2}$/.test(month)) return usage(`--month must be YYYY-MM: ${month}`);

  const storage = new ForkSafeStorage({ isDemo: args.includes('--demo') });
  const service = new ReportGenerationService(storage);
  const now = new Date();
  let failed = loaded.invalid.length > 0;
  let generated = 0;

  const selected = id ? loaded.definitions.filter((d) => d.definition.id === id) : loaded.definitions;
  if (id && selected.length === 0) {
    console.error(`❌ No valid report definition with id "${id}".`);
    return 1;
  }
  for (const entry of selected) {
    const targets = id
      ? [service.manualTarget(entry, month)].filter((t): t is NonNullable<typeof t> => t !== null)
      : service.dueTargets(entry, now);
    if (id && targets.length === 0) console.log(`⚠️ ${entry.definition.id}: no ${entry.definition.dataset} data to report on.`);
    for (const target of targets) {
      try {
        const r = service.generate(entry, target, now);
        if (r.status === 'generated') {
          generated++;
          console.log(`🆕 ${r.report_id} ${r.period}: ${r.files.map((f) => path.relative(process.cwd(), f)).join(', ')}`);
        } else {
          console.log(`⚠️ ${r.report_id} ${r.period}: no data for ${target.dataMonth}`);
        }
      } catch (e) {
        failed = true;
        console.error(`❌ ${entry.definition.id} ${target.period}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  if (due && generated === 0 && !failed) console.log('✅ All scheduled reports are up to date.');
  return failed ? 1 : 0;
}

process.exit(main());
