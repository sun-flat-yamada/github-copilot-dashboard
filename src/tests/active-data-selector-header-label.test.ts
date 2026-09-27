import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

describe('ActiveDataSelector Header Explicit Label & Modal Header Tests (#138)', () => {
  const rootDir = process.cwd();
  const selectorPath = path.resolve(rootDir, 'dashboard/src/components/layout/ActiveDataSelector.tsx');
  const modalPath = path.resolve(rootDir, 'dashboard/src/components/layout/DataSelectionModal.tsx');

  it('verifies ActiveDataSelector explicitly renders 分析対象データ badge and aria-label', () => {
    const content = fs.readFileSync(selectorPath, 'utf-8');

    // 1. Explicit 分析対象データ badge
    assert.match(
      content,
      /分析対象データ\s*<\/span>/,
      'ActiveDataSelector must render 分析対象データ text inside badge'
    );
    assert.match(
      content,
      /<span className="text-\[11px\] font-bold text-indigo-300 px-2 py-0\.5 rounded-lg bg-indigo-950\/80 border border-indigo-700\/70 whitespace-nowrap shrink-0 shadow-xs">\s*分析対象データ\s*<\/span>/,
      'ActiveDataSelector must embed styled 分析対象データ badge with shrink-0 and whitespace-nowrap'
    );

    // 2. Accessibility aria-label
    assert.match(
      content,
      /aria-label="分析対象データ"/,
      'ActiveDataSelector trigger button must provide accessible aria-label="分析対象データ"'
    );

    // 3. Tooltip text prefix
    assert.match(
      content,
      /【分析対象データ:\s*\$\{details\.title\}】/,
      'Tooltip text must explicitly prefix with 【分析対象データ: ...】'
    );
  });

  it('verifies DataSelectionModal header title explicitly displays 分析対象データ', () => {
    const content = fs.readFileSync(modalPath, 'utf-8');

    assert.match(
      content,
      /<h3 id="data-selection-modal-title" className="text-base sm:text-lg font-bold text-white tracking-tight">\s*分析対象データ\s*<\/h3>/,
      'DataSelectionModal header title must explicitly display 分析対象データ'
    );
  });
});
