import * as fs from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateDemoMappingGpg, DEMO_MAPPING_GPG_RELATIVE_PATH } from './generate-demo-mapping-gpg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('=====================================================');
console.log('🚀 Generating Live Metrics DEMO Data Partition (2026.09 LTS)...');
console.log('=====================================================');

try {
  // 1. DEMO専用 GPG 暗号化マッピングファイルの準備
  const fixtureGpgPath = path.resolve(projectRoot, DEMO_MAPPING_GPG_RELATIVE_PATH);
  if (!fs.existsSync(fixtureGpgPath)) {
    console.log('📦 GPG-encrypted DEMO user mapping fixture not found. Generating...');
    generateDemoMappingGpg(fixtureGpgPath);
  } else {
    console.log(`✅ Using existing GPG-encrypted DEMO user mapping: ${DEMO_MAPPING_GPG_RELATIVE_PATH}`);
  }

  // 2. DEMOパーティション用の古いCSVレポートキャッシュを削除し、最新モック定義で再生成させる
  const demoReportsRawDir = path.resolve(projectRoot, 'data/demo/reports/monthly');
  if (fs.existsSync(demoReportsRawDir)) {
    fs.rmSync(demoReportsRawDir, { recursive: true, force: true });
  }

  // 3. パイプラインを DEMO モードで実行
  execSync('npx tsx src/cli/run-pipeline.ts --demo', {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      MOCK_MODE: 'true',
    },
  });

  // 4. DEMOパーティションの config/ にも暗号化ファイルを配備
  const demoDataConfigDir = path.resolve(projectRoot, 'data/demo/config');
  const demoPublicConfigDir = path.resolve(projectRoot, 'dashboard/public/data/demo/config');
  fs.mkdirSync(demoDataConfigDir, { recursive: true });
  fs.mkdirSync(demoPublicConfigDir, { recursive: true });

  const destGpgName = 'copilot-user-mapping.demo.json.gpg';
  fs.copyFileSync(fixtureGpgPath, path.join(demoDataConfigDir, destGpgName));
  fs.copyFileSync(fixtureGpgPath, path.join(demoPublicConfigDir, destGpgName));
  console.log(`🔐 Deployed encrypted user mapping to:`);
  console.log(`   - data/demo/config/${destGpgName}`);
  console.log(`   - dashboard/public/data/demo/config/${destGpgName}`);

  console.log('\n✅ DEMO dataset successfully generated in data/demo/ and dashboard/public/data/demo/');
} catch (err: any) {
  console.error('\n❌ Failed to generate DEMO data:', err.message);
  process.exit(1);
}

