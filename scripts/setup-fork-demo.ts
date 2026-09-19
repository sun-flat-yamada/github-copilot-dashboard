import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DEFAULT_UPSTREAM_URL = 'https://github.com/sun-flat-yamada/github-copilot-dashboard.git';

interface SetupOptions {
  push: boolean;
  localOnly: boolean;
  upstreamUrl: string;
}

function parseArgs(): SetupOptions {
  const args = process.argv.slice(2);
  let push = false;
  let localOnly = false;
  let upstreamUrl = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--push') {
      push = true;
    } else if (arg === '--local' || arg === '--offline') {
      localOnly = true;
    } else if (arg === '--upstream' && i + 1 < args.length) {
      upstreamUrl = args[++i];
    } else if (arg.startsWith('--upstream=')) {
      upstreamUrl = arg.slice('--upstream='.length);
    }
  }

  // upstreamUrl が未指定の場合、既存の git remote 'upstream' を探す
  if (!upstreamUrl) {
    try {
      upstreamUrl = execSync('git config --get remote.upstream.url', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch {
      upstreamUrl = DEFAULT_UPSTREAM_URL;
    }
  }

  return { push, localOnly, upstreamUrl };
}

function copyDirectory(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

export function setupForkDemoData(options?: Partial<SetupOptions>): boolean {
  const opts: SetupOptions = {
    ...parseArgs(),
    ...options,
  };

  console.log('=====================================================');
  console.log('🚀 GitHub Copilot Dashboard: Fork DEMO Setup & Import');
  console.log('=====================================================');
  console.log(`📡 Upstream Source: ${opts.upstreamUrl}`);
  console.log(`⚙️ Mode: ${opts.localOnly ? 'Local synthesis only' : 'Fetch from upstream (with local fallback)'}`);
  console.log(`📤 Push to Fork Remote: ${opts.push ? 'Yes (copilot-data branch)' : 'No (local only)'}`);
  console.log('-----------------------------------------------------');

  const targetDemoDir = path.resolve(projectRoot, 'data/demo');
  const targetPublicDemoDir = path.resolve(projectRoot, 'dashboard/public/data/demo');

  let importSuccess = false;

  // 1. Upstream から DEMO データの取り込みを試行 (localOnly でない場合)
  if (!opts.localOnly) {
    console.log(`\n🔍 Checking upstream 'copilot-data' branch for DEMO dataset...`);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork-demo-import-'));

    try {
      execSync(`git clone --branch copilot-data --single-branch --depth 1 "${opts.upstreamUrl}" "${tempDir}"`, {
        stdio: 'pipe',
      });

      const upstreamDemoDir = path.join(tempDir, 'data', 'demo');
      if (fs.existsSync(upstreamDemoDir) && fs.existsSync(path.join(upstreamDemoDir, 'index.json'))) {
        console.log(`✅ Found valid DEMO dataset in upstream copilot-data! Importing partitions...`);
        copyDirectory(upstreamDemoDir, targetDemoDir);
        copyDirectory(upstreamDemoDir, targetPublicDemoDir);
        importSuccess = true;
        console.log(`📂 Imported upstream DEMO dataset to:`);
        console.log(`   - ${targetDemoDir}`);
        console.log(`   - ${targetPublicDemoDir}`);
      } else {
        console.warn(`⚠️ Upstream 'copilot-data' cloned, but 'data/demo/' was not found.`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Could not clone upstream 'copilot-data' (${e.message}).`);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  // 2. Upstream 取得に失敗、または --local の場合はローカル合成生成
  if (!importSuccess) {
    console.log(`\n⚡ Synthesizing fresh 2026 LTS DEMO dataset locally (offline-safe)...`);
    try {
      execSync('npx tsx scripts/generate-demo-data.ts', {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      importSuccess = true;
    } catch (err: any) {
      console.error(`❌ Failed to generate local DEMO dataset:`, err.message);
      return false;
    }
  }

  // 3. ユーザーのフォークのリモート copilot-data ブランチへの反映 (--push 指定時)
  if (opts.push) {
    console.log(`\n🚀 Pushing imported DEMO dataset to fork's 'copilot-data' branch...`);
    try {
      execSync('npx tsx scripts/sync-demo-to-copilot-data.ts --push', {
        cwd: projectRoot,
        stdio: 'inherit',
      });
      console.log(`🎉 Fork 'copilot-data' branch is now seeded with DEMO data!`);
    } catch (err: any) {
      console.error(`⚠️ Notice: Failed to push to remote 'copilot-data' branch:`, err.message);
      console.log(`   You can push manually later with: npm run demo:sync -- --push`);
    }
  } else {
    console.log('\n💡 Next Steps for your Fork:');
    console.log('   1. Test dashboard locally:');
    console.log('      npm run dev');
    console.log('      (Open http://localhost:3000/?demo=true)');
    console.log('   2. Seed your fork\'s remote GitHub Actions / Pages with DEMO data:');
    console.log('      npm run demo:setup -- --push');
    console.log('   3. Run automated tests with DEMO data:');
    console.log('      npm test');
  }

  console.log('\n=====================================================');
  console.log('🎉 Fork DEMO setup completed successfully!');
  console.log('=====================================================');
  return true;
}

// CLI 直接実行時
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const success = setupForkDemoData();
  if (!success) {
    process.exit(1);
  }
}
