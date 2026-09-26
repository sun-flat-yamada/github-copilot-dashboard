import { createPipelineApp } from '../adapters/composition-root.js';

async function main() {
  const isMock = process.argv.includes('--mock') || process.argv.includes('--demo') || process.env.MOCK_MODE === 'true';
  const orchestrator = createPipelineApp({
    isMock,
    // Note: is_mock_mode: isMock is configured for metadata generation
  });
  await orchestrator.run();
}

main().catch((err) => {
  console.error('❌ Pipeline failed with exception:', err);
  process.exit(1);
});
