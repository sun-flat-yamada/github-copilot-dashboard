import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('ActiveDataSelector Viewport Overflow & React Portal Tests', () => {
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

  it('verifies ActiveDataSelector modal enforces viewport overflow prevention constraints', () => {
    const content = fs.readFileSync(componentPath, 'utf-8');
    // max-h constraint on modal dialog to prevent clipping on small viewports
    assert.match(
      content,
      /max-h-\[90vh\]/,
      'Modal card must enforce max-h-[90vh] to stay within viewport bounds'
    );
    // overflow-y-auto on backdrop/overlay or card to ensure accessibility
    assert.match(
      content,
      /overflow-y-auto/,
      'Modal card or backdrop must support vertical scrolling'
    );
    // dialog accessibility semantics
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

  it('verifies SDD specifications reflect createPortal isolation and viewport layout', () => {
    const jaContent = fs.readFileSync(specJaPath, 'utf-8');
    const enContent = fs.readFileSync(specEnPath, 'utf-8');

    assert.match(
      jaContent,
      /createPortal/,
      '07_dashboard_ui_ux_spec.ja.md must document createPortal isolation'
    );
    assert.match(
      jaContent,
      /backdrop-filter/,
      '07_dashboard_ui_ux_spec.ja.md must mention Containing Block prevention'
    );

    assert.match(
      enContent,
      /createPortal/,
      '07_dashboard_ui_ux_spec.md must document createPortal isolation'
    );
    assert.match(
      enContent,
      /backdrop-filter/,
      '07_dashboard_ui_ux_spec.md must mention Containing Block prevention'
    );
  });
});
