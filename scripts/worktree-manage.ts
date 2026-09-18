import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const REPO_DIR_NAME = path.basename(REPO_ROOT);
const WORKTREES_PARENT_DIR = path.resolve(REPO_ROOT, '..', `${REPO_DIR_NAME}-worktrees`);

function runGit(cmd: string, cwd: string = REPO_ROOT): string {
  return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function toSlug(branchName: string): string {
  return branchName.replace(/[/\\:]/g, '-');
}

function printUsage(): void {
  console.log(`
🔄 Git Worktree Manager for Multi-Agent Concurrent Workflows
Usage:
  npm run worktree:add <branch-name> [base-ref]
  npm run worktree:list
  npm run worktree:clean <branch-name>

Examples:
  npm run worktree:add feat/42-export-cost-centers
  npm run worktree:add fix/43-prorate-calc main
  npm run worktree:list
  npm run worktree:clean feat/42-export-cost-centers
`);
}

function addWorktree(branchName: string, baseRef: string = 'main'): void {
  if (!branchName) {
    console.error('❌ Error: Branch name is required.');
    printUsage();
    process.exit(1);
  }

  const slug = toSlug(branchName);
  const targetPath = path.resolve(WORKTREES_PARENT_DIR, slug);

  if (fs.existsSync(targetPath)) {
    console.error(`❌ Error: Target worktree directory already exists: ${targetPath}`);
    process.exit(1);
  }

  // Ensure worktrees container directory exists
  if (!fs.existsSync(WORKTREES_PARENT_DIR)) {
    fs.mkdirSync(WORKTREES_PARENT_DIR, { recursive: true });
  }

  console.log(`🔄 Fetching latest base ref: origin/${baseRef}...`);
  try {
    runGit(`fetch origin ${baseRef}`);
  } catch {
    console.warn(`⚠️ Warning: Could not fetch origin/${baseRef}, attempting local base...`);
  }

  console.log(`🌿 Creating sibling worktree at: ${targetPath}`);
  try {
    runGit(`worktree add "${targetPath}" -b "${branchName}" "origin/${baseRef}"`);
    console.log(`
✅ Sibling Worktree successfully provisioned!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 Path:   ${targetPath}
🌿 Branch: ${branchName} (based on origin/${baseRef})

🚀 Next Steps:
  1. cd "${targetPath}"
  2. npm ci (if dependencies needed)
  3. Perform your changes and run quality gate:
     npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
  4. Create Pull Request (Rebase onto latest base first)
  5. Once merged, return to root and run:
     npm run worktree:clean ${branchName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  } catch (err: any) {
    console.error(`❌ Failed to create worktree: ${err.message}`);
    process.exit(1);
  }
}

function listWorktrees(): void {
  console.log('📋 Active Git Worktrees:');
  try {
    const output = runGit('worktree list');
    console.log(output);
  } catch (err: any) {
    console.error(`❌ Failed to list worktrees: ${err.message}`);
    process.exit(1);
  }
}

function cleanWorktree(branchName: string): void {
  if (!branchName) {
    console.error('❌ Error: Branch name is required to clean.');
    printUsage();
    process.exit(1);
  }

  const slug = toSlug(branchName);
  const targetPath = path.resolve(WORKTREES_PARENT_DIR, slug);

  console.log(`🧹 Cleaning up worktree for branch: ${branchName}...`);

  // Remove worktree directory via git
  try {
    runGit(`worktree remove "${targetPath}" --force`);
    console.log(`✅ Removed worktree: ${targetPath}`);
  } catch (err: any) {
    console.warn(`⚠️ Warning: git worktree remove returned: ${err.message}`);
    if (fs.existsSync(targetPath)) {
      console.log(`🗑️ Manually deleting residual folder: ${targetPath}`);
      fs.rmSync(targetPath, { recursive: true, force: true });
    }
  }

  // Prune worktree metadata
  try {
    runGit('worktree prune');
  } catch {
    // ignore
  }

  // Attempt to delete local branch safely
  try {
    runGit(`branch -d "${branchName}"`);
    console.log(`✅ Deleted local branch: ${branchName}`);
  } catch {
    console.log(`ℹ️ Note: Local branch "${branchName}" was not deleted (might not be fully merged yet). To force delete: git branch -D "${branchName}"`);
  }

  console.log(`\n🎉 Cleanup complete.`);
}

function main(): void {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'add':
      addWorktree(args[1], args[2]);
      break;
    case 'list':
      listWorktrees();
      break;
    case 'clean':
      cleanWorktree(args[1]);
      break;
    default:
      printUsage();
      process.exit(command ? 1 : 0);
  }
}

main();
