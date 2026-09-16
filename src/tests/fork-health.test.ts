import test from 'node:test';
import assert from 'node:assert';
import {
  checkGitRemotes,
  checkWorkingTree,
  checkDataIsolation,
  checkCopilotDataBranch,
  checkEnvironmentConfig,
  runAllHealthChecks,
} from '../../scripts/verify-fork-health.js';

test('Fork Health & Sync Diagnostics Tests', async (t) => {
  await t.test('checkGitRemotes detects configured remotes', () => {
    const results = checkGitRemotes();
    assert.ok(results.length >= 1, 'Should return at least one check result');
    const originCheck = results.find(r => r.name === 'Origin Remote');
    assert.ok(originCheck, 'Origin Remote check must be present');
    assert.ok(['pass', 'fail'].includes(originCheck.status));
  });

  await t.test('checkWorkingTree evaluates active branch and cleanliness', () => {
    const results = checkWorkingTree();
    assert.ok(results.length >= 2, 'Should return branch and cleanliness results');
    const branchCheck = results.find(r => r.name === 'Active Branch');
    assert.ok(branchCheck);
    assert.ok(['pass', 'warn'].includes(branchCheck.status));
  });

  await t.test('checkDataIsolation verifies code-data decoupling (SDD-05)', () => {
    const results = checkDataIsolation();
    const isolationCheck = results.find(r => r.name === 'Code-Data Decoupling (SDD-05)');
    assert.ok(isolationCheck, 'Data isolation check must be performed');
    assert.strictEqual(isolationCheck.status, 'pass', 'Main branch must not track runtime data files');
  });

  await t.test('checkCopilotDataBranch verifies orphan branch presence or initialization plan', () => {
    const results = checkCopilotDataBranch();
    assert.ok(results.length >= 1, 'Should return storage branch result');
    const branchCheck = results.find(r => r.name === 'copilot-data Orphan Branch');
    assert.ok(branchCheck);
    assert.ok(['pass', 'info'].includes(branchCheck.status));
  });

  await t.test('checkEnvironmentConfig validates user mapping safely without leaking PII', () => {
    const originalEnv = process.env.COPILOT_USER_MAPPING;
    try {
      // Test valid JSON
      process.env.COPILOT_USER_MAPPING = JSON.stringify([
        { github_user: 'test-user', department: 'Platform' }
      ]);
      const validResults = checkEnvironmentConfig();
      const mappingCheck = validResults.find(r => r.name === 'User Mapping (COPILOT_USER_MAPPING)');
      assert.ok(mappingCheck);
      assert.strictEqual(mappingCheck.status, 'pass');
      assert.ok(!mappingCheck.message.includes('test-user'), 'Must NOT leak usernames or departments in check message');

      // Test invalid JSON
      process.env.COPILOT_USER_MAPPING = 'invalid-json-structure';
      const invalidResults = checkEnvironmentConfig();
      const invalidCheck = invalidResults.find(r => r.name === 'User Mapping (COPILOT_USER_MAPPING)');
      assert.ok(invalidCheck);
      assert.strictEqual(invalidCheck.status, 'fail');
    } finally {
      if (originalEnv !== undefined) {
        process.env.COPILOT_USER_MAPPING = originalEnv;
      } else {
        delete process.env.COPILOT_USER_MAPPING;
      }
    }
  });

  await t.test('runAllHealthChecks aggregates all results and counts', () => {
    const summary = runAllHealthChecks();
    assert.ok(summary.checks.length >= 5);
    assert.strictEqual(
      summary.passed + summary.warnings + summary.failures,
      summary.checks.filter(c => c.status !== 'info').length
    );
  });
});
