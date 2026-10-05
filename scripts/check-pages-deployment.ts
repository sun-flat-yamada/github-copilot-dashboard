#!/usr/bin/env node
/**
 * scripts/check-pages-deployment.ts
 *
 * Checks or waits for the latest GitHub Pages deployment status.
 * Usage:
 *   npx tsx scripts/check-pages-deployment.ts [--wait] [--timeout-secs 180]
 */

import { execSync } from 'child_process';

interface Deployment {
  id: number;
  sha: string;
  ref: string;
  created_at: string;
  updated_at: string;
  environment: string;
}

interface DeploymentStatus {
  id: number;
  state: 'success' | 'failure' | 'in_progress' | 'queued' | 'waiting' | 'error';
  environment_url: string;
  log_url: string;
  created_at: string;
  description: string;
}

const args = process.argv.slice(2);
const shouldWait = args.includes('--wait');
const timeoutIndex = args.indexOf('--timeout-secs');
const timeoutSecs = timeoutIndex !== -1 ? parseInt(args[timeoutIndex + 1], 10) : 180;

function runGh(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err: unknown) {
    const error = err as { stderr?: string; message?: string };
    const msg = error.stderr || error.message || 'unknown error';
    throw new Error(`gh command failed: ${msg}`);
  }
}

function getLatestDeployment(): Deployment | null {
  const jsonStr = runGh('gh api repos/sun-flat-yamada/github-copilot-dashboard/deployments?per_page=1');
  const deployments = JSON.parse(jsonStr) as Deployment[];
  return deployments.length > 0 ? deployments[0] : null;
}

function getDeploymentStatus(deploymentId: number): DeploymentStatus | null {
  const jsonStr = runGh(`gh api repos/sun-flat-yamada/github-copilot-dashboard/deployments/${deploymentId}/statuses?per_page=1`);
  const statuses = JSON.parse(jsonStr) as DeploymentStatus[];
  return statuses.length > 0 ? statuses[0] : null;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔍 Checking GitHub Pages deployment status for sun-flat-yamada/github-copilot-dashboard...');

  const startTime = Date.now();
  let deployment = getLatestDeployment();

  if (!deployment) {
    console.error('❌ No deployments found for this repository.');
    process.exit(1);
  }

  while (true) {
    deployment = getLatestDeployment();
    if (!deployment) {
      console.error('❌ No deployment found.');
      process.exit(1);
    }

    const status = getDeploymentStatus(deployment.id);
    const state = status ? status.state : 'unknown';

    console.log(`\n📦 Deployment ID: ${deployment.id}`);
    console.log(`   Commit SHA:    ${deployment.sha}`);
    console.log(`   Branch/Ref:    ${deployment.ref}`);
    console.log(`   Created At:    ${deployment.created_at}`);
    console.log(`   Status:        ${state.toUpperCase()}`);

    if (status?.environment_url) {
      console.log(`   Pages URL:     ${status.environment_url}`);
    }
    if (status?.log_url) {
      console.log(`   Action Logs:   ${status.log_url}`);
    }

    if (!shouldWait || state === 'success' || state === 'failure' || state === 'error') {
      if (state === 'success') {
        console.log('\n✅ Deployment completed successfully!');
        process.exit(0);
      } else if (state === 'failure' || state === 'error') {
        console.error('\n❌ Deployment failed!');
        process.exit(1);
      } else {
        console.log(`\nℹ️ Deployment is currently: ${state}`);
        process.exit(0);
      }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (elapsed >= timeoutSecs) {
      console.error(`\n⏳ Timeout reached (${timeoutSecs}s) waiting for deployment.`);
      process.exit(1);
    }

    console.log(`⏳ Waiting for deployment to finalize... (${elapsed}s elapsed, retry in 5s)`);
    await sleep(5000);
  }
}

main().catch((err) => {
  console.error('❌ Error checking deployment status:', err.message);
  process.exit(1);
});
