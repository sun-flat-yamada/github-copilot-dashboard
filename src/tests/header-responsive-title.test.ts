import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

describe('Header Responsive Title & Icon-Only Collapse Tests (#99)', () => {
  const worktreeRoot = process.cwd();
  const headerPath = path.resolve(worktreeRoot, 'dashboard/src/components/layout/DashboardHeader.tsx');

  it('verifies DashboardHeader.tsx exists and is readable', () => {
    assert.ok(fs.existsSync(headerPath), 'DashboardHeader.tsx must exist');
  });

  it('verifies left container does not have min-w-max that forces horizontal overflow', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');
    // Ensure min-w-max is removed from the brand/title section
    assert.doesNotMatch(
      content,
      /className="flex items-center space-x-[^"]*min-w-max"/,
      'Left title container must not include min-w-max'
    );
  });

  it('verifies Sparkles icon has an accessible tooltip title', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');
    assert.match(
      content,
      /title="GitHub Copilot Analytics"[\s\S]*?<Sparkles className="w-5 h-5" \/>/,
      'Sparkles icon wrapper must have title="GitHub Copilot Analytics"'
    );
  });

  it('verifies title block collapses to icon-only on narrow viewports (< xl: 1280px)', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');
    assert.match(
      content,
      /className="hidden xl:flex flex-col justify-center"/,
      'Title and mode badges must be wrapped in hidden xl:flex to collapse on narrow viewports'
    );
    assert.match(
      content,
      /<h1 className="text-sm sm:text-base font-bold text-white tracking-tight whitespace-nowrap">\s*GitHub Copilot Analytics\s*<\/h1>/,
      'h1 title must reside inside the responsive wrapper'
    );
  });

  it('verifies Information icon button is placed outside the collapsible title block to remain visible adjacent to Sparkles', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');
    // Information icon should be after the hidden xl:flex container and remain a sibling of Sparkles
    const [beforeInfo, afterInfo] = content.split('<button\n            onClick={onOpenAboutModal}');
    assert.ok(beforeInfo && afterInfo, 'About modal trigger button must exist');
    assert.ok(
      beforeInfo.includes('hidden xl:flex flex-col justify-center'),
      'Info icon button must appear after the hidden xl:flex container'
    );
    assert.ok(
      afterInfo.includes('<Info className="w-3.5 h-3.5" />'),
      'Info icon button must render the Info icon'
    );
  });

  it('verifies DEMO and LIVE badges are retained inside the title container for xl+ screens', () => {
    const content = fs.readFileSync(headerPath, 'utf-8');
    assert.match(content, /data-testid="mock-mode-badge"/);
    assert.match(content, /DEMO \(Mock\)/);
    assert.match(content, /data-testid="live-mode-badge"/);
    assert.match(content, />LIVE</);
  });
});
