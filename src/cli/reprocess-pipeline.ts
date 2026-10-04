import { createReprocessApp } from '../adapters/composition-root.js';
import { parseReprocessArgs } from './reprocess-args.js';

/**
 * Raw Landing から成果物を作り直す。
 *   npm run pipeline:reprocess                 最新の run を再生
 *   npm run pipeline:reprocess -- --run <id>   指定した run を再生
 *   npm run pipeline:reprocess -- --revise <YYYY-MM> --reason "<理由>" [--actor <別名>]
 *                                              確定済みの月の改訂を許可する (履歴に残す。--revise は複数指定可)
 * 確定済みの月 (月次締め) は、--revise の指定が無い限り上書きしない。
 */
async function main() {
  const args = parseReprocessArgs(process.argv.slice(2));
  const { orchestrator, runId: used } = createReprocessApp({ runId: args.runId, revision: args.revision });
  console.log(`♻️  Reprocessing from raw landing run ${used} (no network access).`);
  if (args.revision) {
    console.log(`🔒 Revision allowed for closed month(s): ${args.revision.months.join(', ')}.`);
  }
  await orchestrator.run();
}

main().catch((err) => {
  console.error('❌ Reprocess failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
