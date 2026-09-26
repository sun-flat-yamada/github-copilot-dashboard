import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('ActiveDataSelector & DataSelectionModal Viewport Layout & React Portal Tests', () => {
  const triggerComponentPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/layout/ActiveDataSelector.tsx'
  );
  const modalComponentPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/layout/DataSelectionModal.tsx'
  );
  const specJaPath = path.resolve(
    process.cwd(),
    'docs/specifications/07_dashboard_ui_ux_spec.ja.md'
  );
  const specEnPath = path.resolve(
    process.cwd(),
    'docs/specifications/07_dashboard_ui_ux_spec.md'
  );

  it('verifies ActiveDataSelector embeds DataSelectionModal and provides modal trigger & reset', () => {
    const content = fs.readFileSync(triggerComponentPath, 'utf-8');
    assert.match(
      content,
      /import\s+.*DataSelectionModal.*from\s+['"]\.\/DataSelectionModal['"]/,
      'ActiveDataSelector must import DataSelectionModal'
    );
    assert.match(
      content,
      /<DataSelectionModal/,
      'ActiveDataSelector must render DataSelectionModal'
    );
    assert.match(
      content,
      /onResetFilterCriteria/,
      'ActiveDataSelector must support one-click reset for filter criteria'
    );
  });

  it('verifies DataSelectionModal imports createPortal from react-dom and mounts to document.body', () => {
    const content = fs.readFileSync(modalComponentPath, 'utf-8');
    assert.match(
      content,
      /import\s+.*createPortal.*from\s+['"]react-dom['"]/,
      'DataSelectionModal must import createPortal from react-dom'
    );
    assert.match(
      content,
      /createPortal\s*\(/,
      'DataSelectionModal must call createPortal to mount modal'
    );
    assert.match(
      content,
      /document\.body\s*\)/,
      'createPortal target container must be document.body'
    );
    assert.match(
      content,
      /typeof\s+document\s*(!==|===)\s*['"]undefined['"]/,
      'Must include SSR/safe environment guard before accessing document'
    );
  });

  it('verifies DataSelectionModal utilizes screen real estate with fixed modal height and internal scrolling', () => {
    const content = fs.readFileSync(modalComponentPath, 'utf-8');
    // Screen utilization: large width and height
    assert.match(
      content,
      /w-\[92vw\]\s+max-w-5xl\s+h-\[85vh\]/,
      'Modal card must utilize screen real estate (w-[92vw] max-w-5xl h-[85vh])'
    );
    // Fixed headers and footers
    assert.match(
      content,
      /flex-shrink-0/,
      'Header and footer must set flex-shrink-0 to prevent collapsing'
    );
    // Internal body scroll container
    assert.match(
      content,
      /overflow-y-auto/,
      'Modal body columns must enable internal vertical scrolling'
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

  it('verifies SDD specifications reflect createPortal isolation, large modal layout, and reactive update contract', () => {
    const jaContent = fs.readFileSync(specJaPath, 'utf-8');
    const enContent = fs.readFileSync(specEnPath, 'utf-8');

    assert.match(
      jaContent,
      /createPortal/,
      '07_dashboard_ui_ux_spec.ja.md must document createPortal isolation'
    );
    assert.match(
      jaContent,
      /DataSelectionModal/,
      '07_dashboard_ui_ux_spec.ja.md must document DataSelectionModal'
    );
    assert.match(
      jaContent,
      /datasetVersionKey/,
      '07_dashboard_ui_ux_spec.ja.md must document reactive datasetVersionKey guarantee'
    );

    assert.match(
      enContent,
      /createPortal/,
      '07_dashboard_ui_ux_spec.md must document createPortal isolation'
    );
    assert.match(
      enContent,
      /DataSelectionModal/,
      '07_dashboard_ui_ux_spec.md must document DataSelectionModal'
    );
    assert.match(
      enContent,
      /datasetVersionKey/,
      '07_dashboard_ui_ux_spec.md must document reactive datasetVersionKey guarantee'
    );
  });

  it('verifies ActiveDataSelector renders at least 6 filter elements in 2-row layout with responsive truncation and full tooltip with shortcut tips', () => {
    const content = fs.readFileSync(triggerComponentPath, 'utf-8');

    // Display at least 6 filter elements
    assert.match(
      content,
      /MAX_VISIBLE_BADGES\s*=\s*6/,
      'ActiveDataSelector must configure at least 6 visible filter elements'
    );
    assert.match(
      content,
      /firstRowBadges/,
      'ActiveDataSelector must split badges into first row'
    );
    assert.match(
      content,
      /secondRowBadges/,
      'ActiveDataSelector must split badges into second row'
    );

    // Responsive truncation
    assert.match(
      content,
      /truncate/,
      'Filter badges must use truncate for responsive ellipsis'
    );

    // Comprehensive hover tooltip with shortcut tips
    assert.match(
      content,
      /getTooltipText/,
      'ActiveDataSelector must generate comprehensive tooltip text'
    );
    assert.match(
      content,
      /ショートカット:\s*\/.*Ctrl\+K/,
      'Tooltip text must preserve keyboard shortcut tips'
    );
  });
});
