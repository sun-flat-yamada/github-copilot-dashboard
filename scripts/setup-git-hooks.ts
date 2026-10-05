#!/usr/bin/env node
/**
 * scripts/setup-git-hooks.ts
 *
 * Installs or updates local git hooks (e.g. pre-push) to enforce:
 *  1. No direct pushes to main branch
 *  2. Pre-push typecheck (tsc --noEmit)
 *  3. Pre-push secret & PII scan
 */

import * as fs from 'fs';
import * as path from 'path';

const PRE_PUSH_CONTENT = `#!/bin/sh
# Prevent direct pushes to main branch and enforce local quality gates before push

protected_branch='refs/heads/main'

while read -r local_ref local_oid remote_ref remote_oid
do
    if [ "$remote_ref" = "$protected_branch" ]; then
        echo "❌ [ERROR] Direct push to 'main' branch is prohibited!"
        echo "👉 Please create a feature branch and submit a Pull Request."
        exit 1
    fi
done

echo "🛡️  Running pre-push quality gate..."

echo "➡️  Step 1/2: TypeScript typecheck (npm run typecheck)..."
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ [ERROR] TypeScript typecheck failed! Aborting push."
    echo "👉 Fix type errors locally and try again."
    exit 1
fi

echo "➡️  Step 2/2: Secret & PII scan (npm run secret-scan)..."
npm run secret-scan
if [ $? -ne 0 ]; then
    echo "❌ [ERROR] Secret & PII scan failed! Aborting push."
    echo "👉 Remove secrets or PII and try again."
    exit 1
fi

echo "✅ Pre-push quality gate passed successfully!"
exit 0
`;

function setupHooks() {
  const gitDir = path.resolve(process.cwd(), '.git');
  if (!fs.existsSync(gitDir)) {
    console.warn('⚠️ No .git directory found. Skipping hook installation (probably inside a worktree or CI).');
    return;
  }

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const prePushPath = path.join(hooksDir, 'pre-push');
  fs.writeFileSync(prePushPath, PRE_PUSH_CONTENT, { encoding: 'utf-8', mode: 0o755 });

  console.log('✅ Successfully installed enhanced pre-push hook at .git/hooks/pre-push');
}

setupHooks();
