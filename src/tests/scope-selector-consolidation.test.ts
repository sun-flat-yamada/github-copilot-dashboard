import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

describe('ScopeSelector Consolidation & DataSelectionModal Enhancements Tests (#94)', () => {
  it('verifies ScopeSelector.tsx has been deleted from components', () => {
    const scopeSelectorPath = path.join(REPO_ROOT, 'dashboard/src/components/ScopeSelector.tsx');
    assert.equal(
      fs.existsSync(scopeSelectorPath),
      false,
      'ScopeSelector.tsx should be removed as it duplicates DataSelectionModal functionality'
    );
  });

  it('verifies App.tsx does not import or render ScopeSelector', () => {
    const appPath = path.join(REPO_ROOT, 'dashboard/src/App.tsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    assert.equal(
      appContent.includes("from './components/ScopeSelector'"),
      false,
      'App.tsx must not import ScopeSelector'
    );
    assert.equal(
      appContent.includes('<ScopeSelector'),
      false,
      'App.tsx must not render ScopeSelector'
    );
  });

  it('verifies DataSelectionModal.tsx includes 直近30日間 and 指定期間 scope selection controls', () => {
    const modalPath = path.join(REPO_ROOT, 'dashboard/src/components/layout/DataSelectionModal.tsx');
    const modalContent = fs.readFileSync(modalPath, 'utf8');

    assert.match(modalContent, /直近30日間/, 'DataSelectionModal must include 直近30日間 button');
    assert.match(modalContent, /指定期間/, 'DataSelectionModal must include 指定期間 button');
    assert.match(modalContent, /customStartDate/, 'DataSelectionModal must manage customStartDate');
    assert.match(modalContent, /customEndDate/, 'DataSelectionModal must manage customEndDate');
    assert.match(modalContent, /latest-30d/, 'DataSelectionModal must support latest-30d scope key');
  });

  it('verifies ActiveDataSelector formats custom range labels cleanly', () => {
    const selectorPath = path.join(REPO_ROOT, 'dashboard/src/components/layout/ActiveDataSelector.tsx');
    const selectorContent = fs.readFileSync(selectorPath, 'utf8');

    assert.match(selectorContent, /latest-30d/, 'ActiveDataSelector must handle latest-30d');
    assert.match(selectorContent, /custom:/, 'ActiveDataSelector must handle custom: prefix ranges');
  });
});
