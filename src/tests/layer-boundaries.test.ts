import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Import-direction guard (C-07): the Clean Architecture layers under `src/` must not
// depend on the SPA (`dashboard/`), and the domain layer must not depend on outer layers.

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');

function listSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests') continue;
      out.push(...listSources(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function resolvedImports(file: string): string[] {
  const text = fs.readFileSync(file, 'utf-8');
  const specs = [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]*)['"]/g)].map((m) => m[1]);
  return specs.map((s) => path.resolve(path.dirname(file), s));
}

describe('Layer boundaries (import direction)', () => {
  const files = listSources(SRC_ROOT);

  it('finds source files to check', () => {
    assert.ok(files.length > 0);
  });

  it('src/** (non-test) never imports from dashboard/', () => {
    const dashboardRoot = path.join(REPO_ROOT, 'dashboard') + path.sep;
    const offenders = files.filter((f) => resolvedImports(f).some((r) => (r + path.sep).startsWith(dashboardRoot)));
    assert.deepEqual(offenders.map((f) => path.relative(REPO_ROOT, f)), []);
  });

  it('src/domain/** never imports from application, adapters or frameworks', () => {
    const outer = ['application', 'adapters', 'frameworks'].map((d) => path.join(SRC_ROOT, d) + path.sep);
    const offenders = files
      .filter((f) => f.startsWith(path.join(SRC_ROOT, 'domain') + path.sep))
      .filter((f) => resolvedImports(f).some((r) => outer.some((o) => (r + path.sep).startsWith(o))));
    assert.deepEqual(offenders.map((f) => path.relative(REPO_ROOT, f)), []);
  });

  it('removed DataStore-path modules stay removed', () => {
    for (const p of ['dashboard/src/AppV2.tsx', 'src/application/store', 'src/adapters/views', 'src/frameworks']) {
      assert.equal(fs.existsSync(path.join(REPO_ROOT, p)), false, `${p} must not exist (ADR-0001 §5)`);
    }
  });

  it('presenters unused by the production path stay removed (#226)', () => {
    for (const name of ['Trend', 'Overview', 'Budget', 'ModelRadar', 'Users', 'DeepAnalysis']) {
      const p = `src/adapters/presenters/${name}Presenter.ts`;
      assert.equal(fs.existsSync(path.join(REPO_ROOT, p)), false, `${p} must not exist (the view builds its own view model)`);
    }
  });
});
