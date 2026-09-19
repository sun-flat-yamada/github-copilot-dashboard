import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('=====================================================');
console.log('🚀 Generating Live Metrics DEMO Data Partition...');
console.log('=====================================================');

try {
  execSync('npx tsx src/cli/run-pipeline.ts --demo', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      MOCK_MODE: 'true',
    },
  });
  console.log('\n✅ DEMO dataset successfully generated in data/demo/ and dashboard/public/data/demo/');
} catch (err: any) {
  console.error('\n❌ Failed to generate DEMO data:', err.message);
  process.exit(1);
}
