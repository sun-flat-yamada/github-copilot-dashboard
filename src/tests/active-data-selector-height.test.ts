import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

describe('ActiveDataSelector Height & Unfiltered Truncation Tests (#109)', () => {
  const worktreeRoot = process.cwd();
  const selectorPath = path.resolve(worktreeRoot, 'dashboard/src/components/layout/ActiveDataSelector.tsx');

  it('verifies ActiveDataSelector.tsx exists and is readable', () => {
    assert.ok(fs.existsSync(selectorPath), 'ActiveDataSelector.tsx must exist');
  });

  it('verifies unfiltered view container has min-w-0 to allow proper flex shrinking', () => {
    const content = fs.readFileSync(selectorPath, 'utf-8');
    assert.match(
      content,
      /<div className="flex flex-col text-left justify-center px-0\.5 min-w-0">/,
      'Unfiltered container must have min-w-0 to allow proper flex shrinking'
    );
  });

  it('verifies unfiltered labels have truncate and whitespace-nowrap to prevent vertical height explosion', () => {
    const content = fs.readFileSync(selectorPath, 'utf-8');
    assert.match(
      content,
      /<span className="text-\[11px\] text-slate-300 font-medium leading-none truncate whitespace-nowrap">\s*フィルタなし\s*<\/span>/,
      'Unfiltered "フィルタなし" label must include truncate and whitespace-nowrap'
    );
    assert.match(
      content,
      /<span className="text-\[10px\] text-slate-500 font-mono leading-tight mt-1 truncate whitespace-nowrap">\s*全体: \{counts\.total\}名\s*<\/span>/,
      'Unfiltered "全体: {counts.total}名" label must include truncate and whitespace-nowrap'
    );
  });

  it('verifies source indicator title and subtitle have whitespace-nowrap to prevent wrapping', () => {
    const content = fs.readFileSync(selectorPath, 'utf-8');
    assert.match(
      content,
      /<span className="text-xs font-bold text-white tracking-tight leading-none whitespace-nowrap">\s*\{details\.title\}\s*<\/span>/,
      'details.title must have whitespace-nowrap'
    );
    assert.match(
      content,
      /<span className="inline-flex items-center text-\[10px\] px-1\.5 py-0\.2 rounded border bg-slate-950\/70 border-slate-700\/80 text-slate-300 font-mono leading-tight mt-1 self-start whitespace-nowrap">\s*\{details\.subtitle\}\s*<\/span>/,
      'details.subtitle must have whitespace-nowrap'
    );
  });

  it('verifies filtered and unfiltered states both enforce truncate to ensure uniform height behavior', () => {
    const content = fs.readFileSync(selectorPath, 'utf-8');
    // Filtered state badges
    assert.match(content, /truncate max-w-\[85px\] sm:max-w-\[110px\]/);
    // Unfiltered state labels
    assert.match(content, /truncate whitespace-nowrap/);
  });
});
