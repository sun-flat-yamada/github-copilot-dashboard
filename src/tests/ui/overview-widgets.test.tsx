import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../../dashboard/src/AppShell.js';
import {
  DEFAULT_LIVE_WIDGET_IDS,
  OVERVIEW_WIDGETS_STORAGE_KEY,
} from '../../../dashboard/src/hooks/useOverviewWidgets.js';
import {
  buildFileMap,
  discoverViewRegistry,
  installFakeDataServer,
  type FakeDataServer,
} from './test-harness.js';

let server: FakeDataServer | undefined;

afterEach(() => {
  cleanup();
  server?.restore();
  server = undefined;
  window.localStorage.clear();
});

async function renderApp(files: Record<string, unknown> = buildFileMap('/data', { is_mock_mode: false })) {
  server = installFakeDataServer(files);
  const registry = await discoverViewRegistry();
  const user = userEvent.setup({ document });
  render(<AppShell registry={registry} />);
  await screen.findByTestId('overview-widget-list', undefined, { timeout: 5000 });
  return { user, registry };
}

function getRenderedWidgetIds(): string[] {
  const container = screen.getByTestId('overview-widget-list');
  const cards = container.querySelectorAll<HTMLElement>('[data-widget-id]');
  return Array.from(cards).map((el) => el.getAttribute('data-widget-id') ?? '');
}

describe('Dashboard Tab & Widgets (Separation from Cost Breakdown, KPI Widgets, Add, Remove, Reorder, Reset, Persistence)', () => {
  it('opens the dedicated Dashboard tab on initial visit and separates it from the Cost Breakdown (overview) tab', async () => {
    const { user } = await renderApp();

    // Initial view is the dedicated Dashboard tab with all 5 KPI widgets + 6 section widgets = 11 widgets
    assert.ok(screen.getByTestId('dashboard-view'));
    assert.deepEqual(getRenderedWidgetIds(), DEFAULT_LIVE_WIDGET_IDS);
    assert.equal(screen.getByTestId('overview-widget-count').textContent, '11 ウィジェット');
    assert.equal(screen.queryByTestId('overview-widget-customized-badge'), null);
    assert.equal((screen.getByTestId('widget-reset-button') as HTMLButtonElement).disabled, true);

    // Switching to 'コスト内訳' (overview) renders the fixed Cost Breakdown view without widget customization controls
    await user.click(screen.getByRole('button', { name: /^コスト内訳$/ }));
    await screen.findByTestId('overview-cost-view', undefined, { timeout: 5000 });
    assert.equal(screen.queryByTestId('widget-add-button'), null);
    assert.ok(screen.getByTestId('kpi-summary-cards'));

    // Switching back to 'Dashboard' restores the customizable widget view
    await user.click(screen.getByRole('button', { name: /^Dashboard$/ }));
    await screen.findByTestId('dashboard-view', undefined, { timeout: 5000 });
    assert.ok(screen.getByTestId('widget-add-button'));
  });

  it('widgetizes KPI items (total_spend, acceptance_rate, etc.) alongside section widgets with add/remove/reorder/reset/persistence', async () => {
    const { user, registry } = await renderApp();

    // 1. Move 'kpi_total_spend' (当月 月額費用 (シート費)) down -> 'kpi_active_rate' becomes first, 'kpi_total_spend' becomes second
    await user.click(screen.getByTestId('widget-move-down-kpi_total_spend'));
    assert.deepEqual(getRenderedWidgetIds().slice(0, 2), ['kpi_active_rate', 'kpi_total_spend']);
    assert.ok(screen.getByTestId('overview-widget-customized-badge'));

    // 2. Remove 'kpi_acceptance_rate' (Inline補完受諾率) and 'budget' section widget
    await user.click(screen.getByTestId('widget-remove-kpi_acceptance_rate'));
    await user.click(screen.getByTestId('widget-remove-budget'));
    assert.equal(getRenderedWidgetIds().includes('kpi_acceptance_rate'), false);
    assert.equal(getRenderedWidgetIds().includes('budget'), false);
    assert.equal(screen.getByTestId('overview-widget-count').textContent, '9 ウィジェット');

    // 3. Open catalog and add 'credits' widget and re-add 'kpi_acceptance_rate'
    await user.click(screen.getByTestId('widget-add-button'));
    const catalogPanel = screen.getByTestId('widget-catalog-panel');
    assert.ok(catalogPanel);
    await user.click(within(catalogPanel).getByTestId('widget-add-item-credits'));
    await user.click(within(catalogPanel).getByTestId('widget-add-item-kpi_acceptance_rate'));
    assert.deepEqual(getRenderedWidgetIds().slice(-2), ['credits', 'kpi_acceptance_rate']);
    assert.equal(screen.getByTestId('overview-widget-count').textContent, '11 ウィジェット');

    const expectedCustomOrder = [
      'kpi_active_rate',
      'kpi_total_spend',
      'kpi_idle_waste',
      'kpi_budget_utilization',
      'advisor',
      'allocation',
      'yearly-trend',
      'usage',
      'users',
      'credits',
      'kpi_acceptance_rate',
    ];
    assert.deepEqual(getRenderedWidgetIds(), expectedCustomOrder);

    // Verify localStorage has saved the visitor's custom layout
    const storedRaw = window.localStorage.getItem(OVERVIEW_WIDGETS_STORAGE_KEY);
    assert.ok(storedRaw, 'widget state must be saved in localStorage');
    const stored = JSON.parse(storedRaw);
    assert.deepEqual(stored.liveWidgets, expectedCustomOrder);

    // 4. Simulate visitor returning to the page (unmount and remount without clearing localStorage)
    cleanup();
    render(<AppShell registry={registry} />);
    await screen.findByTestId('overview-widget-list', undefined, { timeout: 5000 });
    assert.deepEqual(
      getRenderedWidgetIds(),
      expectedCustomOrder,
      'visitor previous widget configuration must be restored on revisit'
    );

    // 5. Reset to default preset
    const resetBtn = screen.getByTestId('widget-reset-button') as HTMLButtonElement;
    assert.equal(resetBtn.disabled, false);
    await user.click(resetBtn);

    assert.deepEqual(getRenderedWidgetIds(), DEFAULT_LIVE_WIDGET_IDS);
    assert.equal(screen.queryByTestId('overview-widget-customized-badge'), null);
    assert.equal(resetBtn.disabled, true);

    const storedAfterReset = JSON.parse(window.localStorage.getItem(OVERVIEW_WIDGETS_STORAGE_KEY) ?? '{}');
    assert.deepEqual(storedAfterReset.liveWidgets, DEFAULT_LIVE_WIDGET_IDS);
  });
});
