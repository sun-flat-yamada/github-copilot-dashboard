import { createReprocessApp } from '../adapters/composition-root.js';

/**
 * Raw Landing から成果物を作り直す。
 *   npm run pipeline:reprocess                 最新の run を再生
 *   npm run pipeline:reprocess -- --run <id>   指定した run を再生
 */
async function main() {
  const idx = process.argv.indexOf('--run');
  const runId = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (idx >= 0 && !runId) throw new Error('--run requires a run id');

  const { orchestrator, runId: used } = createReprocessApp({ runId });
  console.log(`♻️  Reprocessing from raw landing run ${used} (no network access).`);
  await orchestrator.run();
}

main().catch((err) => {
  console.error('❌ Reprocess failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
