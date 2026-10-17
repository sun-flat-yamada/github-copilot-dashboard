import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('clearly distinguishes KPI summary widgets from analysis section widgets in the Widget Catalog panel with category grouping and filters', async () => {
    const { user } = await renderApp();

    // Remove 1 KPI widget ('kpi_acceptance_rate') and 1 section widget ('budget') so we can inspect both active and unplaced states
    await user.click(screen.getByTestId('widget-remove-kpi_acceptance_rate'));
    await user.click(screen.getByTestId('widget-remove-budget'));

    // Open the Widget Catalog panel
    await user.click(screen.getByTestId('widget-add-button'));
    const catalogPanel = screen.getByTestId('widget-catalog-panel');
    assert.ok(catalogPanel);

    // Both KPI group and Section group are rendered in 'all' filter mode
    const kpiGroup = within(catalogPanel).getByTestId('widget-catalog-group-kpi');
    const sectionGroup = within(catalogPanel).getByTestId('widget-catalog-group-section');
    assert.ok(kpiGroup);
    assert.ok(sectionGroup);

    // Placement counters accurately reflect active vs total per category (4/5 KPI, 5/11 Section)
    assert.equal(within(catalogPanel).getByTestId('widget-catalog-kpi-status').textContent, '4 / 5 配置中');
    assert.equal(within(catalogPanel).getByTestId('widget-catalog-section-status').textContent, '5 / 11 配置中');

    // KPI items live inside widget-catalog-group-kpi with data-widget-category="kpi"
    const kpiItems = kpiGroup.querySelectorAll<HTMLElement>('[data-widget-category="kpi"]');
    assert.equal(kpiItems.length, 5);
    assert.equal(kpiGroup.querySelectorAll('[data-widget-category="section"]').length, 0);

    // Section items live inside widget-catalog-group-section with data-widget-category="section"
    const sectionItems = sectionGroup.querySelectorAll<HTMLElement>('[data-widget-category="section"]');
    assert.equal(sectionItems.length, 11);
    assert.equal(sectionGroup.querySelectorAll('[data-widget-category="kpi"]').length, 0);

    // Filter to KPI widgets only
    await user.click(within(catalogPanel).getByTestId('widget-catalog-filter-kpi'));
    assert.ok(within(catalogPanel).getByTestId('widget-catalog-group-kpi'));
    assert.equal(within(catalogPanel).queryByTestId('widget-catalog-group-section'), null);

    // Filter to Analysis Section widgets only
    await user.click(within(catalogPanel).getByTestId('widget-catalog-filter-section'));
    assert.equal(within(catalogPanel).queryByTestId('widget-catalog-group-kpi'), null);
    assert.ok(within(catalogPanel).getByTestId('widget-catalog-group-section'));

    // Filter back to All
    await user.click(within(catalogPanel).getByTestId('widget-catalog-filter-all'));
    assert.ok(within(catalogPanel).getByTestId('widget-catalog-group-kpi'));
    assert.ok(within(catalogPanel).getByTestId('widget-catalog-group-section'));
  });

  it('allows text selection inside widgets and moves widgets only when dragged via the dedicated drag handle', async () => {
    await renderApp();

    const kpiCard = screen.getByTestId('overview-widget-kpi_total_spend');
    const kpiContent = screen.getByTestId('widget-content-kpi_total_spend');
    const kpiHandle = screen.getByTestId('widget-drag-handle-kpi_total_spend');
    const secondKpiCard = screen.getByTestId('overview-widget-kpi_active_rate');

    const advisorCard = screen.getByTestId('overview-widget-advisor');
    const advisorHandle = screen.getByTestId('widget-drag-handle-advisor');
    const allocationCard = screen.getByTestId('overview-widget-allocation');

    // 1. Outer widget containers must NOT have draggable="true" so browser text selection works inside widgets
    assert.notEqual(kpiCard.getAttribute('draggable'), 'true');
    assert.notEqual(advisorCard.getAttribute('draggable'), 'true');
    assert.equal(kpiContent.classList.contains('select-text'), true);

    // Dedicated drag handles MUST have draggable="true"
    assert.equal(kpiHandle.getAttribute('draggable'), 'true');
    assert.equal(advisorHandle.getAttribute('draggable'), 'true');

    // 2. Dragging text inside widget content (e.g. selecting/dragging text) must NOT move the widget
    fireEvent.dragStart(kpiContent, {
      dataTransfer: {
        effectAllowed: 'none',
        types: ['text/plain'],
        setData: () => {},
        getData: (type: string) => (type === 'text/plain' ? 'kpi_total_spend' : ''),
      },
    });
    fireEvent.dragOver(secondKpiCard, {
      dataTransfer: {
        dropEffect: 'none',
        types: ['text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'kpi_total_spend' : ''),
      },
    });
    fireEvent.drop(secondKpiCard, {
      dataTransfer: {
        types: ['text/plain'],
        getData: (type: string) => (type === 'text/plain' ? 'kpi_total_spend' : ''),
      },
    });
    assert.deepEqual(
      getRenderedWidgetIds().slice(0, 2),
      ['kpi_total_spend', 'kpi_active_rate'],
      'dragging text inside widget content must not reorder widgets'
    );

    // 3. Dragging the dedicated drag handle ('widget-drag-handle-kpi_total_spend') and dropping onto 'kpi_active_rate' moves the widget
    const dataStore: Record<string, string> = {};
    const mockDataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      get types() {
        return Object.keys(dataStore);
      },
      setData: (type: string, val: string) => {
        dataStore[type] = val;
      },
      getData: (type: string) => dataStore[type] ?? '',
      setDragImage: () => {},
    };

    fireEvent.dragStart(kpiHandle, { dataTransfer: mockDataTransfer });
    fireEvent.dragOver(secondKpiCard, { dataTransfer: mockDataTransfer });
    fireEvent.drop(secondKpiCard, { dataTransfer: mockDataTransfer });
    fireEvent.dragEnd(kpiHandle, { dataTransfer: mockDataTransfer });

    assert.deepEqual(
      getRenderedWidgetIds().slice(0, 2),
      ['kpi_active_rate', 'kpi_total_spend'],
      'dragging via widget-drag-handle must reorder KPI widgets'
    );

    // 4. Dragging a section widget via its dedicated drag handle ('widget-drag-handle-advisor') onto 'allocation' moves the section widget
    const sectionDataStore: Record<string, string> = {};
    const sectionDataTransfer = {
      effectAllowed: 'none',
      dropEffect: 'none',
      get types() {
        return Object.keys(sectionDataStore);
      },
      setData: (type: string, val: string) => {
        sectionDataStore[type] = val;
      },
      getData: (type: string) => sectionDataStore[type] ?? '',
      setDragImage: () => {},
    };

    fireEvent.dragStart(advisorHandle, { dataTransfer: sectionDataTransfer });
    fireEvent.dragOver(allocationCard, { dataTransfer: sectionDataTransfer });
    fireEvent.drop(allocationCard, { dataTransfer: sectionDataTransfer });
    fireEvent.dragEnd(advisorHandle, { dataTransfer: sectionDataTransfer });

    assert.deepEqual(
      getRenderedWidgetIds().slice(5, 7),
      ['allocation', 'advisor'],
      'dragging via widget-drag-handle must reorder section widgets'
    );
  });

  it('arranges KPI summary widgets in a 3x2 grid (max 3 columns) with smartphone-portrait baseline width', async () => {
    const { user } = await renderApp();

    // 1. Main widget list uses 1 col on mobile, 2 cols on tablet (md), and 3 cols (3x2 for 5-6 KPI widgets) on desktop (lg)
    const widgetList = screen.getByTestId('overview-widget-list');
    assert.equal(widgetList.classList.contains('grid-cols-1'), true);
    assert.equal(widgetList.classList.contains('md:grid-cols-2'), true);
    assert.equal(widgetList.classList.contains('lg:grid-cols-3'), true);
    assert.equal(widgetList.classList.contains('xl:grid-cols-5'), false);
    assert.equal(widgetList.classList.contains('sm:grid-cols-2'), false);

    // 2. Each KPI widget frame carries smartphone-portrait 1-column baseline width (min-w-[min(100%,21rem)]) and expands with w-full
    for (const kpiId of [
      'kpi_total_spend',
      'kpi_active_rate',
      'kpi_idle_waste',
      'kpi_budget_utilization',
      'kpi_acceptance_rate',
    ]) {
      const kpiFrame = screen.getByTestId(`overview-widget-${kpiId}`);
      assert.equal(kpiFrame.classList.contains('w-full'), true);
      assert.equal(kpiFrame.classList.contains('min-w-[min(100%,21rem)]'), true);
    }

    // 3. Catalog KPI group also uses 3x2 grid and smartphone-portrait baseline width
    await user.click(screen.getByTestId('widget-add-button'));
    const catalogKpiGrid = screen.getByTestId('widget-catalog-kpi-grid');
    assert.equal(catalogKpiGrid.classList.contains('grid-cols-1'), true);
    assert.equal(catalogKpiGrid.classList.contains('md:grid-cols-2'), true);
    assert.equal(catalogKpiGrid.classList.contains('lg:grid-cols-3'), true);
  });
});



