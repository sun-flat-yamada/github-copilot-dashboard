import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Header Settings Menu Consolidation Tests (Issue #95)', () => {
  it('verifies DashboardHeader.tsx consolidates currency switcher and display mode into three-dots menu', () => {
    const headerPath = path.resolve(projectRoot, 'dashboard/src/components/layout/DashboardHeader.tsx');
    const headerContent = fs.readFileSync(headerPath, 'utf-8');

    // 1. Standalone CurrencySelector should be removed from header right actions
    assert.doesNotMatch(
      headerContent,
      /<CurrencySelector\s*\/>/,
      'Standalone <CurrencySelector /> must be removed from DashboardHeader'
    );

    // 2. Three-dots trigger button must be present
    assert.match(headerContent, /data-testid="header-settings-menu-button"/);
    assert.match(headerContent, /MoreVertical/);
    assert.match(headerContent, /aria-label="表示設定メニュー"/);
    assert.match(headerContent, /title="表示設定（通貨・表示モード）"/);

    // 3. Dropdown menu panel structure
    assert.match(headerContent, /表示設定 \(Display Settings\)/);

    // 4. Section 1: Display Mode (Theme)
    assert.match(headerContent, /表示モード/);
    assert.match(headerContent, /data-testid="theme-toggle-button"/);
    assert.match(headerContent, /Sun/);
    assert.match(headerContent, /Moon/);

    // 5. Section 2: Currency Switcher
    assert.match(headerContent, /サブ表示通貨/);
    assert.match(headerContent, /Coins/);
    assert.match(headerContent, /setSubCurrencyCode/);
    assert.match(headerContent, /availableSubCurrencies/);

    // 6. Keyboard accessibility & outside click handling
    assert.match(headerContent, /e\.key === 'Escape'/);
    assert.match(headerContent, /handleClickOutside/);
  });

  it('verifies CurrencyContext provides expected currency options for the consolidated menu', async () => {
    const currencyContextPath = path.resolve(projectRoot, 'dashboard/src/contexts/CurrencyContext.tsx');
    const currencyContent = fs.readFileSync(currencyContextPath, 'utf-8');

    assert.match(currencyContent, /availableSubCurrencies/);
    assert.match(currencyContent, /code:\s*'none'/);
    assert.match(currencyContent, /code:\s*'JPY'/);
    assert.match(currencyContent, /code:\s*'EUR'/);
    assert.match(currencyContent, /export const useCurrency/);
  });
});
