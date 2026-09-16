import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

export interface HealthCheckResult {
  category: string;
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  remediation?: string;
}

export interface ForkHealthSummary {
  passed: number;
  warnings: number;
  failures: number;
  checks: HealthCheckResult[];
}

/**
 * Safely runs a git command and returns trimmed stdout, or null on error.
 */
export function runGit(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * 1. Verify Git remotes (origin and upstream)
 */
export function checkGitRemotes(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const remotesRaw = runGit('remote -v') || '';
  const lines = remotesRaw.split('\n').filter(Boolean);

  const remotes: Record<string, string> = {};
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && !remotes[parts[0]]) {
      remotes[parts[0]] = parts[1];
    }
  }

  if (remotes['origin']) {
    results.push({
      category: 'Git Remotes',
      name: 'Origin Remote',
      status: 'pass',
      message: `origin is configured: ${remotes['origin']}`,
    });
  } else {
    results.push({
      category: 'Git Remotes',
      name: 'Origin Remote',
      status: 'fail',
      message: 'No origin remote found.',
      remediation: 'Configure origin remote with: git remote add origin <url>',
    });
  }

  if (remotes['upstream']) {
    results.push({
      category: 'Git Remotes',
      name: 'Upstream Remote',
      status: 'pass',
      message: `upstream is configured: ${remotes['upstream']}`,
    });
  } else {
    const isUpstreamOrigin = remotes['origin']?.includes('sun-flat-yamada/github-copilot-dashboard');
    if (isUpstreamOrigin) {
      results.push({
        category: 'Git Remotes',
        name: 'Upstream Remote',
        status: 'info',
        message: 'Current repository is the upstream source (sun-flat-yamada/github-copilot-dashboard).',
      });
    } else {
      results.push({
        category: 'Git Remotes',
        name: 'Upstream Remote',
        status: 'warn',
        message: 'Upstream remote is not configured in this downstream fork.',
        remediation: 'Run: git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git',
      });
    }
  }

  return results;
}

/**
 * 2. Verify Working Tree and Current Branch
 */
export function checkWorkingTree(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const branch = runGit('rev-parse --abbrev-ref HEAD') || 'unknown';

  if (branch === 'main') {
    results.push({
      category: 'Working Tree',
      name: 'Active Branch',
      status: 'pass',
      message: `Currently on primary synchronization branch '${branch}'.`,
    });
  } else {
    results.push({
      category: 'Working Tree',
      name: 'Active Branch',
      status: 'warn',
      message: `Currently on branch '${branch}'. Sync operations should typically be performed on 'main'.`,
      remediation: 'Switch to main before syncing: git checkout main',
    });
  }

  const statusOutput = runGit('status --porcelain') || '';
  if (statusOutput.length === 0) {
    results.push({
      category: 'Working Tree',
      name: 'Working Tree Cleanliness',
      status: 'pass',
      message: 'Working tree is completely clean. Safe to perform fast-forward merge.',
    });
  } else {
    const modifiedCount = statusOutput.split('\n').length;
    results.push({
      category: 'Working Tree',
      name: 'Working Tree Cleanliness',
      status: 'warn',
      message: `Working tree has ${modifiedCount} uncommitted or untracked change(s).`,
      remediation: 'Commit, stash, or clean working changes before running upstream sync.',
    });
  }

  return results;
}

/**
 * 3. Verify Fork-Safe Storage Isolation (Never commit data files to main branch)
 */
export function checkDataIsolation(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const trackedDataFiles = runGit('ls-files data/ dashboard/public/data/daily/ dashboard/public/data/monthly/') || '';

  const trackedList = trackedDataFiles.split('\n').filter(f => f.trim().length > 0);

  if (trackedList.length === 0) {
    results.push({
      category: 'Data Isolation',
      name: 'Code-Data Decoupling (SDD-05)',
      status: 'pass',
      message: 'Zero runtime data files tracked on main branch. Fork-Safe Storage is preserved.',
    });
  } else {
    results.push({
      category: 'Data Isolation',
      name: 'Code-Data Decoupling (SDD-05)',
      status: 'fail',
      message: `Found ${trackedList.length} runtime data file(s) tracked in Git index!`,
      remediation: 'Untrack data files immediately: git rm -r --cached data/ dashboard/public/data/ && git commit -m "fix: untrack data files"',
    });
  }

  // Check .gitignore contains data rules
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const hasDataIgnore = /^\/?data\/?/m.test(gitignoreContent);
    if (hasDataIgnore) {
      results.push({
        category: 'Data Isolation',
        name: '.gitignore Data Rules',
        status: 'pass',
        message: '.gitignore correctly excludes data directories.',
      });
    } else {
      results.push({
        category: 'Data Isolation',
        name: '.gitignore Data Rules',
        status: 'warn',
        message: '.gitignore is missing explicit data/ exclusion patterns.',
        remediation: 'Add data/ to .gitignore to prevent accidental commits.',
      });
    }
  }

  return results;
}

/**
 * 4. Verify copilot-data Dedicated Branch
 */
export function checkCopilotDataBranch(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const localBranch = runGit('branch --list copilot-data') || '';
  const remoteBranch = runGit('branch -r --list origin/copilot-data') || '';

  if (localBranch.length > 0 || remoteBranch.length > 0) {
    results.push({
      category: 'Storage Branch',
      name: 'copilot-data Orphan Branch',
      status: 'pass',
      message: `Dedicated data branch 'copilot-data' exists (${localBranch ? 'local' : ''}${localBranch && remoteBranch ? ', ' : ''}${remoteBranch ? 'remote' : ''}).`,
    });
  } else {
    results.push({
      category: 'Storage Branch',
      name: 'copilot-data Orphan Branch',
      status: 'info',
      message: "'copilot-data' branch not yet created on remote. It will be initialized upon the first pipeline run.",
    });
  }

  return results;
}

/**
 * 5. Environment & Configuration Check (Safe, zero-leakage)
 */
export function checkEnvironmentConfig(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];

  const hasToken = Boolean(process.env.COPILOT_READ_TOKEN);
  const isMock = process.env.MOCK_MODE === 'true';

  if (hasToken) {
    results.push({
      category: 'Environment & Config',
      name: 'Authentication Token',
      status: 'pass',
      message: 'COPILOT_READ_TOKEN is configured in local environment.',
    });
  } else if (isMock) {
    results.push({
      category: 'Environment & Config',
      name: 'Authentication Token',
      status: 'info',
      message: 'MOCK_MODE=true is enabled. Running in simulation mode without API token.',
    });
  } else {
    results.push({
      category: 'Environment & Config',
      name: 'Authentication Token',
      status: 'info',
      message: 'COPILOT_READ_TOKEN is not set locally (expected in GitHub Actions CI/CD Secrets).',
    });
  }

  const userMappingRaw = process.env.COPILOT_USER_MAPPING;
  if (userMappingRaw) {
    try {
      const parsed = JSON.parse(userMappingRaw);
      if (Array.isArray(parsed)) {
        results.push({
          category: 'Environment & Config',
          name: 'User Mapping (COPILOT_USER_MAPPING)',
          status: 'pass',
          message: `COPILOT_USER_MAPPING is valid JSON with ${parsed.length} entry/entries. (Values hidden for PII protection)`,
        });
      } else {
        results.push({
          category: 'Environment & Config',
          name: 'User Mapping (COPILOT_USER_MAPPING)',
          status: 'warn',
          message: 'COPILOT_USER_MAPPING is not a valid JSON array.',
          remediation: 'Ensure COPILOT_USER_MAPPING is a JSON array of objects: [{"github_user": "...", ...}]',
        });
      }
    } catch {
      results.push({
        category: 'Environment & Config',
        name: 'User Mapping (COPILOT_USER_MAPPING)',
        status: 'fail',
        message: 'COPILOT_USER_MAPPING is malformed JSON.',
        remediation: 'Validate JSON syntax before setting COPILOT_USER_MAPPING in Secrets/Variables.',
      });
    }
  }

  return results;
}

/**
 * Execute all health checks and aggregate results
 */
export function runAllHealthChecks(): ForkHealthSummary {
  const allChecks: HealthCheckResult[] = [
    ...checkGitRemotes(),
    ...checkWorkingTree(),
    ...checkDataIsolation(),
    ...checkCopilotDataBranch(),
    ...checkEnvironmentConfig(),
  ];

  const passed = allChecks.filter(c => c.status === 'pass').length;
  const warnings = allChecks.filter(c => c.status === 'warn').length;
  const failures = allChecks.filter(c => c.status === 'fail').length;

  return { passed, warnings, failures, checks: allChecks };
}

/**
 * Formatted CLI Reporter
 */
export function printHealthReport(summary: ForkHealthSummary): void {
  console.log('\n======================================================');
  console.log('🩺 GitHub Copilot Dashboard: Fork Health & Sync Audit');
  console.log('======================================================\n');

  let currentCategory = '';
  for (const check of summary.checks) {
    if (check.category !== currentCategory) {
      currentCategory = check.category;
      console.log(`\n📁 [${currentCategory}]`);
    }

    const icon = {
      pass: '✅',
      warn: '⚠️ ',
      fail: '❌',
      info: 'ℹ️ ',
    }[check.status];

    console.log(`  ${icon} ${check.name}: ${check.message}`);
    if (check.remediation) {
      console.log(`     👉 Recommendation: ${check.remediation}`);
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`Summary: ${summary.passed} Passed, ${summary.warnings} Warning(s), ${summary.failures} Failure(s)`);
  console.log('------------------------------------------------------\n');

  if (summary.failures > 0) {
    console.error('❌ Critical health check failures detected. Remediate issues above before syncing.\n');
  } else if (summary.warnings > 0) {
    console.log('⚠️  Checks completed with warnings. Proceed with caution.\n');
  } else {
    console.log('✅ Fork environment is healthy and ready for seamless Upstream synchronization!\n');
  }
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const isQuick = process.argv.includes('--quick');
  const summary = runAllHealthChecks();
  printHealthReport(summary);

  if (!isQuick && summary.failures === 0) {
    console.log('💡 Quick Sync Checklist:');
    console.log('   1. git fetch upstream main');
    console.log('   2. git merge upstream/main --ff-only');
    console.log('   3. npm ci && npm run typecheck && npm test && npm run secret-scan && npm run build');
    console.log('   4. git push origin main\n');
  }

  process.exit(summary.failures > 0 ? 1 : 0);
}
