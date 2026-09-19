import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const DATA_BRANCH = 'copilot-data';
const shouldPush = process.argv.includes('--push');

console.log('=====================================================');
console.log(`🚀 Synchronizing DEMO dataset to '${DATA_BRANCH}' branch...`);
console.log('=====================================================');

const sourceDemoDir = path.resolve(projectRoot, 'data/demo');
if (!fs.existsSync(sourceDemoDir)) {
  console.log('ℹ️  data/demo/ not found. Generating DEMO dataset first...');
  execSync('npm run demo:generate', { cwd: projectRoot, stdio: 'inherit' });
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-data-demo-sync-'));

try {
  const remoteUrl = execSync('git config --get remote.origin.url', {
    cwd: projectRoot,
    encoding: 'utf-8',
  }).trim();

  console.log(`📡 Checking '${DATA_BRANCH}' branch from remote: ${remoteUrl}...`);
  let isExistingBranch = false;
  try {
    execSync(`git clone --branch ${DATA_BRANCH} --single-branch --depth 1 "${remoteUrl}" "${tempDir}"`, {
      stdio: 'pipe',
    });
    isExistingBranch = true;
    console.log(`✅ Successfully cloned existing '${DATA_BRANCH}' branch into isolated temp workspace.`);
  } catch {
    console.log(`ℹ️  No remote '${DATA_BRANCH}' branch found or clone failed; initializing new orphan branch...`);
    execSync(`git init "${tempDir}"`, { stdio: 'pipe' });
    execSync(`git -C "${tempDir}" checkout --orphan ${DATA_BRANCH}`, { stdio: 'pipe' });
    execSync(`git -C "${tempDir}" remote add origin "${remoteUrl}"`, { stdio: 'pipe' });
  }

  const targetDemoDir = path.join(tempDir, 'data', 'demo');
  if (fs.existsSync(targetDemoDir)) {
    fs.rmSync(targetDemoDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDemoDir, { recursive: true });

  console.log(`📂 Copying DEMO partitions from ${sourceDemoDir} to ${targetDemoDir}...`);
  fs.cpSync(sourceDemoDir, targetDemoDir, { recursive: true });

  execSync(`git -C "${tempDir}" config user.name "github-actions[bot]"`, { stdio: 'pipe' });
  execSync(`git -C "${tempDir}" config user.email "github-actions[bot]@users.noreply.github.com"`, { stdio: 'pipe' });
  execSync(`git -C "${tempDir}" add data/demo/`, { stdio: 'inherit' });

  let hasChanges = true;
  try {
    execSync(`git -C "${tempDir}" diff --cached --quiet`, { stdio: 'pipe' });
    hasChanges = false;
  } catch {
    hasChanges = true;
  }

  if (!hasChanges) {
    console.log(`ℹ️  No changes detected in DEMO dataset partitions on '${DATA_BRANCH}'. Branch is up to date.`);
  } else {
    const commitMsg = `chore(demo): record Live Metrics DEMO dataset partitions (${new Date().toISOString().slice(0, 10)}) [skip ci]`;
    execSync(`git -C "${tempDir}" commit -m "${commitMsg}"`, { stdio: 'inherit' });
    console.log(`✅ Staged and committed DEMO dataset on '${DATA_BRANCH}' branch.`);

    if (shouldPush) {
      console.log(`🚀 Pushing DEMO dataset to remote '${DATA_BRANCH}'...`);
      execSync(`git -C "${tempDir}" push origin ${DATA_BRANCH}`, { stdio: 'inherit' });
      console.log(`🎉 Successfully pushed DEMO dataset to origin/${DATA_BRANCH}!`);
    } else {
      console.log(`💡 Local commit created in isolated work directory.`);
      console.log(`   To push to remote '${DATA_BRANCH}', run: npm run demo:sync -- --push`);
    }
  }
} catch (err: any) {
  console.error('❌ Failed to sync DEMO dataset to copilot-data branch:', err.message);
  process.exit(1);
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error
  }
}
