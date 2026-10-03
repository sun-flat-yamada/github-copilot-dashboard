import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  evaluatePlanFirst,
  isImplementationFile,
  parseGitLog,
  type CommitChange,
} from '../../../scripts/plan-first-check.js';

const PLAN = '.devs/changes/2026-10-03_X/implementation_plan.md';
const commit = (sha: string, ...files: Array<[string, string]>): CommitChange => ({
  sha,
  files: files.map(([status, path]) => ({ status, path })),
});

describe('plan-first check: implementation_plan.md before the implementation', () => {
  it('passes when the plan is committed before the first implementation commit', () => {
    const r = evaluatePlanFirst([commit('aaaaaaa1', ['A', PLAN]), commit('bbbbbbb2', ['M', 'src/a.ts'])]);
    assert.equal(r.ok, true);
    assert.equal(r.exempt, false);
  });

  it('fails when the plan is committed after the implementation', () => {
    const r = evaluatePlanFirst([commit('aaaaaaa1', ['M', 'src/a.ts']), commit('bbbbbbb2', ['A', PLAN])]);
    assert.equal(r.ok, false);
    assert.match(r.message, /after the first implementation commit/);
  });

  it('fails when the plan shares a commit with the implementation', () => {
    const r = evaluatePlanFirst([commit('aaaaaaa1', ['A', PLAN], ['M', 'scripts/x.ts'])]);
    assert.equal(r.ok, false);
    assert.match(r.message, /same commit/);
  });

  it('fails when there is no plan at all', () => {
    const r = evaluatePlanFirst([commit('aaaaaaa1', ['M', 'dashboard/src/App.tsx'])]);
    assert.equal(r.ok, false);
    assert.match(r.message, /no `.devs\/changes/);
  });

  it('is exempt for documentation-only and plan-only branches', () => {
    for (const commits of [
      [commit('a1', ['M', 'docs/specifications/14_x.md'], ['M', 'README.md'])],
      [commit('a1', ['A', PLAN])],
      [] as CommitChange[],
    ]) {
      const r = evaluatePlanFirst(commits);
      assert.equal(r.ok, true);
      assert.equal(r.exempt, true);
    }
  });

  it('does not accept a modified (not added) plan or a plan outside .devs/changes', () => {
    assert.equal(evaluatePlanFirst([commit('a1', ['M', PLAN]), commit('b2', ['M', 'src/a.ts'])]).ok, false);
    assert.equal(
      evaluatePlanFirst([commit('a1', ['A', 'implementation_plan.md']), commit('b2', ['M', 'src/a.ts'])]).ok,
      false
    );
  });

  it('classifies files', () => {
    for (const f of ['src/a.ts', 'scripts/x.ts', 'package.json', '.github/workflows/a.yml', '.agents/skills/x/helper.ts']) {
      assert.equal(isImplementationFile(f), true, f);
    }
    for (const f of ['docs/x.png', '.devs/changes/d/task.md', '.agents/rules/r.md', 'README.md']) {
      assert.equal(isImplementationFile(f), false, f);
    }
  });

  it('parses `git log --name-status` output', () => {
    const out = `COMMIT abc\nA\t${PLAN}\n\nCOMMIT def\nM\tsrc/a.ts\nD\tsrc/b.ts\n`;
    assert.deepEqual(parseGitLog(out), [
      { sha: 'abc', files: [{ status: 'A', path: PLAN }] },
      {
        sha: 'def',
        files: [
          { status: 'M', path: 'src/a.ts' },
          { status: 'D', path: 'src/b.ts' },
        ],
      },
    ]);
  });
});
