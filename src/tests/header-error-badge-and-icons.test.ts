import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Header Error Indicator & Action Icon Height Tests (#102)', () => {
  const headerPath = path.resolve(projectRoot, 'dashboard/src/components/layout/DashboardHeader.tsx');

  it('verifies DashboardHeader.tsx exists and is readable', () => {
    assert.ok(fs.existsSync(headerPath), 'DashboardHeader.tsx must exist');
  });

  it('verifies visual text labels "エラー検知" and "警告あり" are removed from error button', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');

    // Must not contain visual text span with 'エラー検知' or '警告あり'
    assert.doesNotMatch(
      content,
      /<span[^>]*>\s*\{hasErrors \? ['"]エラー検知['"] : ['"]警告あり['"]\}\s*<\/span>/,
      'Visual text span for エラー検知 / 警告あり must be removed'
    );
    assert.doesNotMatch(
      content,
      /<span[^>]*>\s*エラー検知\s*<\/span>/,
      'Direct visual text for エラー検知 must not exist'
    );
  });

  it('verifies error modal trigger button exists with accessible aria-label and title', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');

    assert.match(
      content,
      /data-testid="header-error-modal-button"/,
      'Error button must have data-testid="header-error-modal-button"'
    );
    assert.match(
      content,
      /aria-label=\{\s*hasErrors\s*\?\s*`エラー検知 \(\$\{allIssuesCount\}件\)`\s*:\s*`警告あり \(\$\{allIssuesCount\}件\)`\s*\}/,
      'Error button must have dynamic accessible aria-label'
    );
    assert.match(
      content,
      /title=\{\s*hasErrors\s*\?\s*`エラー検知 \(\$\{allIssuesCount\}件\): クリックして詳細を表示`\s*:\s*`警告あり \(\$\{allIssuesCount\}件\): クリックして詳細を表示`\s*\}/,
      'Error button must have informative title tooltip'
    );
  });

  it('verifies AlertCircle and AlertTriangle icons are unified to w-4 h-4 shrink-0', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');

    assert.match(
      content,
      /<AlertCircle className="w-4 h-4 shrink-0" \/>/,
      'AlertCircle icon must be w-4 h-4 shrink-0'
    );
    assert.match(
      content,
      /<AlertTriangle className="w-4 h-4 shrink-0" \/>/,
      'AlertTriangle icon must be w-4 h-4 shrink-0'
    );
    // Ensure sm:w-5 sm:h-5 was removed
    assert.doesNotMatch(
      content,
      /sm:w-5 sm:h-5/,
      'sm:w-5 sm:h-5 must not be present on header error icons'
    );
  });

  it('verifies header action elements share unified h-9 (36px) container height', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');

    // 1. GitHub + Star container
    assert.match(
      content,
      /className="flex items-center h-9 bg-slate-900 border border-slate-800 rounded-xl shadow-sm flex-shrink-0"/,
      'GitHub + Star container must have h-9'
    );

    // 2. Settings button
    assert.match(
      content,
      /className={`h-9 w-9 flex items-center justify-center rounded-xl border/,
      'Settings menu button must have h-9 w-9'
    );

    // 3. Error modal button
    assert.match(
      content,
      /className={`relative h-9 px-2\.5 rounded-xl border/,
      'Error modal trigger button must have h-9 px-2.5'
    );
  });

  it('verifies count badge has pixel-perfect pill styling without invalid Tailwind classes', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');

    // py-0.2 was invalid in standard Tailwind
    assert.doesNotMatch(
      content,
      /py-0\.2/,
      'Invalid Tailwind class py-0.2 must not be used'
    );

    assert.match(
      content,
      /min-w-\[18px\] h-\[18px\] px-1 rounded-full text-\[10px\] font-extrabold leading-none/,
      'Count badge must use centered pill dimensions min-w-[18px] h-[18px] with leading-none'
    );
  });
});
