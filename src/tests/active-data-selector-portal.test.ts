import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('ActiveDataSelector Viewport Layout, Pinned Offset & React Portal Tests', () => {
  const componentPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/layout/ActiveDataSelector.tsx'
  );
  const specJaPath = path.resolve(
    process.cwd(),
    'docs/specifications/07_dashboard_ui_ux_spec.ja.md'
  );
  const specEnPath = path.resolve(
    process.cwd(),
    'docs/specifications/07_dashboard_ui_ux_spec.md'
  );

  it('verifies ActiveDataSelector imports createPortal from react-dom', () => {
    const content = fs.readFileSync(componentPath, 'utf-8');
    assert.match(
      content,
      /import\s+.*createPortal.*from\s+['"]react-dom['"]/,
      'ActiveDataSelector must import createPortal from react-dom'
    );
  });

  it('verifies ActiveDataSelector mounts modal via createPortal to document.body', () => {
    const content = fs.readFileSync(componentPath, 'utf-8');
    assert.match(
      content,
      /createPortal\s*\(/,
      'ActiveDataSelector must call createPortal to mount modal'
    );
    assert.match(
      content,
      /document\.body\s*\)/,
      'createPortal target container must be document.body'
    );
    assert.match(
      content,
      /typeof\s+document\s*!==\s*['"]undefined['"]/,
      'Must include SSR/safe environment guard before accessing document'
    );
  });

  it('verifies ActiveDataSelector pins top offset and avoids viewport vertical centering', () => {
    const content = fs.readFileSync(componentPath, 'utf-8');
    // Must use items-start to pin top offset instead of items-center
    assert.match(
      content,
      /items-start/,
      'Modal container must use items-start to pin top offset and prevent jitter on tab switch'
    );
    assert.doesNotMatch(
      content,
      /items-center justify-center.*bg-black/,
      'Must not vertically center the backdrop container to avoid vertical shifting'
    );
    // Top padding offset
    assert.match(
      content,
      /pt-16\s+sm:pt-20/,
      'Modal container must have top padding offset (pt-16 sm:pt-20)'
    );
  });

  it('verifies ActiveDataSelector fixes modal card height and enables internal scrolling', () => {
    const content = fs.readFileSync(componentPath, 'utf-8');
    // Fixed vertical height
    assert.match(
      content,
      /h-\[600px\]/,
      'Modal card must enforce fixed vertical height h-[600px] to prevent height jumping'
    );
    // Fixed headers, tabs and footers
    assert.match(
      content,
      /flex-shrink-0/,
      'Header, tabs and footer must set flex-shrink-0'
    );
    // Internal body scroll container
    assert.match(
      content,
      /flex-1\s+min-h-0\s+overflow-y-auto/,
      'Modal body must have flex-1 min-h-0 overflow-y-auto for internal scrolling'
    );
    // Dialog accessibility semantics
    assert.match(
      content,
      /role=["']dialog["']/,
      'Modal overlay must have role="dialog"'
    );
    assert.match(
      content,
      /aria-modal=["']true["']/,
      'Modal overlay must have aria-modal="true"'
    );
  });

  it('verifies SDD specifications reflect pinned top offset and fixed height layout', () => {
    const jaContent = fs.readFileSync(specJaPath, 'utf-8');
    const enContent = fs.readFileSync(specEnPath, 'utf-8');

    assert.match(
      jaContent,
      /createPortal/,
      '07_dashboard_ui_ux_spec.ja.md must document createPortal isolation'
    );
    assert.match(
      jaContent,
      /items-start pt-16 sm:pt-20/,
      '07_dashboard_ui_ux_spec.ja.md must document pinned top offset'
    );
    assert.match(
      jaContent,
      /h-\[600px\]/,
      '07_dashboard_ui_ux_spec.ja.md must document fixed modal height'
    );

    assert.match(
      enContent,
      /createPortal/,
      '07_dashboard_ui_ux_spec.md must document createPortal isolation'
    );
    assert.match(
      enContent,
      /items-start pt-16 sm:pt-20/,
      '07_dashboard_ui_ux_spec.md must document pinned top offset'
    );
    assert.match(
      enContent,
      /h-\[600px\]/,
      '07_dashboard_ui_ux_spec.md must document fixed modal height'
    );
  });
});
