import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { builtinModules } from 'node:module';
import { checkBundle } from '../../../scripts/check-bundle.js';

function makeDist(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<html><head><script type="module" crossorigin src="./assets/index-abc.js"></script></head></html>'
  );
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'assets', name), content);
  return dir;
}

describe('bundle budget gate (scripts/check-bundle.ts)', () => {
  it('passes a main chunk within budget', () => {
    const dist = makeDist({ 'index-abc.js': 'x'.repeat(10_000) });
    assert.deepEqual(checkBundle(dist, 300).errors, []);
  });

  it('fails when the main chunk exceeds the budget', () => {
    const dist = makeDist({ 'index-abc.js': 'x'.repeat(300_001) });
    const { errors } = checkBundle(dist, 300);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /over the 300 kB budget/);
  });

  it('does not count lazy chunks against the main budget', () => {
    const dist = makeDist({ 'index-abc.js': 'x'.repeat(1_000), 'vendor-charts-1.js': 'x'.repeat(500_000) });
    assert.deepEqual(checkBundle(dist, 300).errors, []);
  });

  it('fails when a chunk contains a Node built-in stub or zod', () => {
    const dist = makeDist({
      'index-abc.js': 'x',
      'a.js': 'var m=__vite-browser-external;',
      'b.js': 'class ZodError extends Error{}',
    });
    const { errors } = checkBundle(dist, 300);
    assert.equal(errors.length, 2);
  });

  it('fails when index.html has no module script', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-budget-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    assert.match(checkBundle(dir, 300).errors[0], /main chunk not found/);
  });
});

/** Walk every relative import reachable from dashboard/src/main.tsx (static and dynamic) */
function collectBrowserModules(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  const exts = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const code = fs.readFileSync(file, 'utf-8');
    const specs = [...code.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
    for (const spec of specs) {
      const base = path.resolve(path.dirname(file), spec.replace(/\.js$/, ''));
      const resolved = [base, ...exts.map((e) => base + e)].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (resolved) queue.push(resolved);
    }
  }
  return [...seen];
}

describe('browser code does not use Node built-ins or zod', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const nodeBuiltins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

  it('has no fs / path / zod import reachable from the dashboard entry', () => {
    const offenders: string[] = [];
    for (const file of collectBrowserModules(path.join(root, 'dashboard/src/main.tsx'))) {
      // `import type` is erased at build time, so it cannot pull a module into the bundle
      const code = fs.readFileSync(file, 'utf-8').replace(/^\s*import\s+type\s[^;]*;/gm, '');
      for (const m of code.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^.'"][^'"]*)['"]/g)) {
        const spec = m[1];
        if (nodeBuiltins.has(spec) || spec === 'zod' || spec.startsWith('zod/')) {
          offenders.push(`${path.relative(root, file)} imports '${spec}'`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
