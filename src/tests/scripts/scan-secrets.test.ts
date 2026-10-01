import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectScanTargets, runSecretScan } from '../../../scripts/scan-secrets.js';

// change-dev の成果物 (.devs/changes/) は PR で共有されるため secret-scan の対象とし、
// .devs/ のそれ以外と、ほかのドットディレクトリ (.agents/, .github/ など) は従来どおり対象外とする。
const ARTIFACT = '.devs/changes/2026-10-01_Example/implementation_plan.md';

function createTree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-secrets-test-'));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

describe('Secret scanner file walk (collectScanTargets)', () => {
  let root: string;
  let scanned: string[];

  before(() => {
    root = createTree({
      [ARTIFACT]: '# Plan\n',
      '.devs/other/x.md': '# Local note\n',
      '.devs/notes.md': '# Local note\n',
      '.agents/rules/x.md': '# Rule\n',
      '.github/workflows/x.yml': 'name: x\n',
      'src/index.ts': 'export {};\n',
    });
    scanned = collectScanTargets(root).map((file) => path.relative(root, file).split(path.sep).join('/'));
  });

  after(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('includes change-dev artifacts under .devs/changes/', () => {
    assert.ok(scanned.includes(ARTIFACT));
  });

  it('does not scan the rest of .devs/', () => {
    assert.ok(!scanned.includes('.devs/other/x.md'));
    assert.ok(!scanned.includes('.devs/notes.md'));
  });

  it('keeps skipping other dot-directories while scanning regular files', () => {
    assert.deepEqual([...scanned].sort(), [ARTIFACT, 'src/index.ts'].sort());
  });
});

describe('Secret scan of change-dev artifacts (runSecretScan)', () => {
  it('fails when an artifact under .devs/changes/ contains a secret', (t) => {
    // テストソース自体がスキャンで検出されないよう、秘密鍵ヘッダーは実行時に組み立てる
    const privateKeyHeader = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
    const root = createTree({ [ARTIFACT]: `# Plan\n\n${privateKeyHeader}\n` });
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    try {
      assert.equal(runSecretScan(root), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
