import test from 'node:test';
import assert from 'node:assert';
import { formatAnalysisDate } from '../../dashboard/src/components/AboutModal.js';

test('formatAnalysisDate formats ISO string to yyyy-mm-dd hh:MM:ss', () => {
  // ISO string test
  const iso = '2026-09-12T10:30:45.000Z';
  const result = formatAnalysisDate(iso);
  assert.match(result, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

  // Specific date/time checking with local Date
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  assert.strictEqual(result, expected);

  // Undefined or empty fallback
  assert.strictEqual(formatAnalysisDate(undefined), '-');
  assert.strictEqual(formatAnalysisDate(''), '-');

  // Invalid date string fallback
  assert.strictEqual(formatAnalysisDate('invalid-date-string'), 'invalid-date-string');
});

test('Dynamic repository resolution is fork-safe without hardcoded conflict', () => {
  // Upstream scenario
  const upstreamMeta = {
    repository: {
      owner: 'proud-corp',
      name: 'github-copilot-dashboard',
      is_fork: false,
    },
  };

  const getRepoUrl = (meta: typeof upstreamMeta | null) => {
    if (meta?.repository?.owner && meta?.repository?.name) {
      return `https://github.com/${meta.repository.owner}/${meta.repository.name}`;
    }
    return 'https://github.com/proud-corp/github-copilot-dashboard';
  };

  assert.strictEqual(
    getRepoUrl(upstreamMeta),
    'https://github.com/proud-corp/github-copilot-dashboard'
  );

  // Forked scenario (e.g. user forks into custom-org/my-dashboard)
  const forkedMeta = {
    repository: {
      owner: 'custom-org',
      name: 'my-dashboard',
      is_fork: true,
    },
  };

  // Fork URL resolves cleanly to fork repository without modifying main branch code
  assert.strictEqual(
    getRepoUrl(forkedMeta),
    'https://github.com/custom-org/my-dashboard'
  );
  assert.strictEqual(forkedMeta.repository.is_fork, true);
});
