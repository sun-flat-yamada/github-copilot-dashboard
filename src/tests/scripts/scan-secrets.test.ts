import { describe, it, before, after, type TestContext } from 'node:test';
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

// Issue #206: email addresses (every file) and machine-specific absolute paths (.devs/changes/ only).
// The test source is itself scanned, so every value that must be detected is built at runtime.
const at = (local: string, domain: string) => [local, domain].join('@');
const slash = (...parts: string[]) => parts.join('/');
const NAME = 'alice';
const PERSONAL_EMAIL = at(NAME, 'corp.co.jp');
const FILE_SCHEME = ['file:', '', '', ''].join('/');

const ABSOLUTE_PATHS: Record<string, string> = {
  'Windows home (backslash)': ['C:', 'Users', NAME, 'repo', 'x.md'].join('\\'),
  'Windows home (slash)': slash('C:', 'Users', NAME, 'repo', 'x.md'),
  'POSIX home': `/${slash('home', NAME, 'src', 'test', 'x.ts')}`,
  'macOS home': `/${slash('Users', NAME, 'repo')}`,
  '/root/': `/${slash('root', '.ssh', 'config')}`,
  '/tmp/': `/${slash('tmp', 'scan-abc123', 'x.md')}`,
  'file:/// URI': `${FILE_SCHEME}${slash('c:', 'work', 'repo', 'x.md')}`,
};

function scan(files: Record<string, string>, t: TestContext): { clean: boolean; output: string } {
  const root = createTree(files);
  t.mock.method(console, 'log', () => {});
  const errors = t.mock.method(console, 'error', () => {});
  try {
    const clean = runSecretScan(root);
    const output = errors.mock.calls.map((call) => call.arguments.join(' ')).join('\n');
    return { clean, output };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('PII and absolute-path rules (runSecretScan)', () => {
  it('fails for an email address outside the allowlist in an artifact', (t) => {
    assert.equal(scan({ [ARTIFACT]: `Contact: ${PERSONAL_EMAIL}\n` }, t).clean, false);
  });

  it('fails for an email address outside the allowlist in a regular source file', (t) => {
    const { clean, output } = scan({ 'src/index.ts': `// owner ${PERSONAL_EMAIL}\n` }, t);
    assert.equal(clean, false);
    assert.match(output, /\[PII\] Email Address/);
  });

  for (const [label, value] of Object.entries(ABSOLUTE_PATHS)) {
    it(`fails for a ${label} path in an artifact`, (t) => {
      const { clean, output } = scan({ [ARTIFACT]: `- [x.md](${value})\n` }, t);
      assert.equal(clean, false);
      assert.match(output, /\[path\] Machine-Specific Absolute Path/);
    });

    it(`passes for a ${label} path in a regular source file`, (t) => {
      assert.equal(scan({ 'scripts/x.ts': `// see ${value}\n` }, t).clean, true);
    });
  }

  it('passes for allowlisted emails, version specifiers, placeholders and relative paths', (t) => {
    const allowed = [
      at('dev', 'example.com'),
      at('dev', 'mail.example.org'),
      at('dev', 'example.net'),
      at('dev', 'corp.example'),
      at('dev', 'host.test'),
      at('dev', 'host.invalid'),
      `${at('git', 'github.com')}:owner/repo`,
      `https://${at('x-access-token:<token>', 'github.com')}/owner/repo`,
      at('12345+bot', 'users.noreply.github.com'),
      at('noreply', 'corp.co.jp'),
      at('no-reply', 'corp.co.jp'),
      `"${at('@types/node', '20.1.0')}"`,
      `uses: ${at('actions/checkout', 'v4')}`,
      `npx ${at('pkg', '1.2.3')}`,
    ].join('\n');
    const paths = [
      `/${slash('home', '<user>', 'repo')}`,
      ['C:', 'Users', '<user>', 'repo'].join('\\'),
      `/${slash('home', 'runner', 'work', 'repo')}`,
      `${FILE_SCHEME}<repo-root>/x.md`,
      'Use repository-relative links instead of `file:///` URIs.',
      'Temporary files go under `/tmp/` outside the repository.',
      '[View](../../../dashboard/src/views/users/View.tsx), Overview/Users/BudgetViewPlugin.tsx',
    ].join('\n');
    assert.equal(scan({ [ARTIFACT]: `${allowed}\n${paths}\n`, 'src/x.ts': `${allowed}\n` }, t).clean, true);
  });

  it('checks every value on a line, so an allowed value does not hide a disallowed one', (t) => {
    const line = `${at('dev', 'example.com')} and ${PERSONAL_EMAIL} (test sample)`;
    assert.equal(scan({ 'src/x.ts': `${line}\n` }, t).clean, false);
  });

  it('never prints any part of a detected local part or user name', (t) => {
    const local = 'zqxjkv';
    const user = 'wvbnmq';
    const content = [
      `Owner: ${at(local, 'corp.co.jp')}`,
      `Path: /${slash('home', user, 'src')}`,
      `Both: ${at(local, 'corp.co.jp')} ${['C:', 'Users', user, 'x'].join('\\')}`,
    ].join('\n');
    const { clean, output } = scan({ [ARTIFACT]: `${content}\n` }, t);
    assert.equal(clean, false);
    assert.match(output, /<email>/);
    assert.match(output, /<abs-path>/);
    for (const value of [local, user]) {
      for (let i = 0; i + 3 <= value.length; i++) {
        assert.ok(!output.includes(value.slice(i, i + 3)), 'output leaks part of a detected value');
      }
    }
  });
});

describe('Worktree git file (collectScanTargets)', () => {
  const gitFile = ['', 'git'].join('.');
  const gitdir = `gitdir: /${slash('home', NAME, 'repo', gitFile, 'worktrees', 'x')}`;

  it('does not collect a worktree git file that points to an absolute gitdir', () => {
    const root = createTree({ [gitFile]: `${gitdir}\n`, 'src/index.ts': 'export {};\n' });
    try {
      const scanned = collectScanTargets(root).map((file) => path.relative(root, file));
      assert.deepEqual(scanned, [path.join('src', 'index.ts')]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('passes the scan with a worktree git file at the root', (t) => {
    assert.equal(scan({ [gitFile]: `${gitdir}\n`, [ARTIFACT]: '# Plan\n' }, t).clean, true);
  });
});
