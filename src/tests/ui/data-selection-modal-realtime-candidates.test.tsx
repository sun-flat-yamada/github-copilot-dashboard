import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataSelectionModal } from '../../../dashboard/src/components/layout/DataSelectionModal.js';
import {
  DEFAULT_FILTER_CRITERIA,
  DATA_SOURCE_LABELS,
  type MonthlyReportAggregatedData,
  type ScopeAggregatedData,
} from '../../../src/types/copilot.js';

afterEach(() => {
  cleanup();
});

function createMockScopeData(): ScopeAggregatedData {
  return {
    scope_type: 'monthly',
    scope_key: '2026-09',
    date_range: { start: '2026-09-01', end: '2026-09-30', days_count: 30 },
    overview: {
      total_seats: 2,
      active_users: 2,
      total_spend_usd: 38,
      idle_seats: 0,
      idle_waste_usd: 0,
    },
    users: [
      {
        login: 'live-user-1',
        display_name: 'Live User 1',
        cost_center: 'CC-LIVE',
        organization: 'Org-LIVE',
        department: 'Group-LIVE',
        tags: ['live-frontend', 'live-backend'],
      },
      {
        login: 'live-user-2',
        display_name: 'Live User 2',
        cost_center: 'CC-LIVE',
        organization: 'Org-LIVE',
        department: 'Group-LIVE',
        tags: ['live-frontend'],
      },
    ],
    user_profiles: [],
    daily_trends: [],
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    top_languages: [],
    cost_center_budgets: [],
  } as unknown as ScopeAggregatedData;
}

function createMockReportData(): MonthlyReportAggregatedData {
  return {
    report_month: '2026-09',
    source_type: 'persisted',
    file_name: 'report-2026-09.csv',
    parsed_at: '2026-10-01T00:00:00Z',
    overview: {
      total_net_spend_usd: 20,
      total_gross_spend_usd: 38,
      total_discount_usd: 18,
      total_requests: 10,
      total_active_users: 1,
      top_model: 'gpt-4o',
      top_sku: 'copilot',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [],
    daily_trends: [],
    user_details: [
      {
        login: 'report-user-1',
        display_name: 'Report User 1',
        cost_center: 'CC-REPORT',
        organization: 'Org-REPORT',
        department: 'Group-REPORT',
        tags: ['report-mobile', 'report-infra'],
        total_requests: 10,
        total_spend_usd: 19,
        gross_spend_usd: 19,
        net_spend_usd: 10,
        primary_model: 'gpt-4o',
      },
    ],
  } as unknown as MonthlyReportAggregatedData;
}

function createMockUploadedData(): MonthlyReportAggregatedData {
  return {
    report_month: '2026-09',
    source_type: 'local_drop',
    file_name: 'uploaded.csv',
    parsed_at: '2026-10-01T00:00:00Z',
    overview: {
      total_net_spend_usd: 10,
      total_gross_spend_usd: 19,
      total_discount_usd: 9,
      total_requests: 5,
      total_active_users: 1,
      top_model: 'claude-3-7-sonnet',
      top_sku: 'copilot',
    },
    by_department: {},
    by_cost_center: {},
    by_organization: {},
    model_breakdown: [],
    sku_breakdown: [],
    daily_trends: [],
    user_details: [
      {
        login: 'upload-user-1',
        display_name: 'Upload User 1',
        cost_center: 'CC-UPLOAD',
        organization: 'Org-UPLOAD',
        department: 'Group-UPLOAD',
        tags: ['upload-ai', 'upload-ml'],
        total_requests: 5,
        total_spend_usd: 19,
        gross_spend_usd: 19,
        net_spend_usd: 10,
        primary_model: 'claude-3-7-sonnet',
      },
    ],
  } as unknown as MonthlyReportAggregatedData;
}

describe('DataSelectionModal Real-Time STEP2 Candidates Reflection', () => {
  it('updates STEP2 candidates (tags, costCenter, org, group) in real-time when switching STEP1 data source', async () => {
    const user = userEvent.setup({ document });
    const scopeData = createMockScopeData();
    const reportData = createMockReportData();
    const uploadData = createMockUploadedData();

    render(
      <DataSelectionModal
        isOpen={true}
        onClose={() => {}}
        activeSource="live_metrics"
        onSelectSource={() => {}}
        indexMeta={null}
        scopeType="monthly"
        selectedScopeKey="2026-09"
        onSelectLiveScope={() => {}}
        availableReports={['2026-09']}
        selectedReportMonth="2026-09"
        onSelectReportMonth={() => {}}
        uploadedData={uploadData}
        onUploadFileLoaded={() => {}}
        onClearUploadedFile={() => {}}
        filterCriteria={DEFAULT_FILTER_CRITERIA}
        onApplyFilterCriteria={() => {}}
        availableCostCenters={['CC-LIVE']}
        availableOrganizations={['Org-LIVE']}
        availableGroups={['Group-LIVE']}
        availableTags={['live-frontend', 'live-backend']}
        currentScopeData={scopeData}
        currentReportData={reportData}
      />
    );

    const dialog = screen.getByRole('dialog');

    // 1. 初期状態 (live_metrics): live 系のタグ・選択肢が存在
    expectTags(dialog, ['live-frontend', 'live-backend']);
    expectNoTags(dialog, ['report-mobile', 'report-infra', 'upload-ai', 'upload-ml']);
    expectSelectOptions(dialog, 'CostCenter', ['all', '__unassigned__', 'CC-LIVE']);
    expectSelectOptions(dialog, 'GitHub Organization', ['all', '__unassigned__', 'Org-LIVE']);
    expectSelectOptions(dialog, 'ユーザー定義Gr', ['all', '__unassigned__', 'Group-LIVE']);

    // 2. STEP1 でカード2 (登録済み月次利用レポート) をクリック
    const reportCard = within(dialog).getByText(DATA_SOURCE_LABELS.monthly_report.shortTitle);
    await user.click(reportCard);

    // STEP2 のタグ・選択肢が即座に report 系の候補に更新されること
    expectTags(dialog, ['report-mobile', 'report-infra']);
    expectNoTags(dialog, ['live-frontend', 'live-backend', 'upload-ai', 'upload-ml']);
    expectSelectOptions(dialog, 'CostCenter', ['all', '__unassigned__', 'CC-REPORT']);
    expectSelectOptions(dialog, 'GitHub Organization', ['all', '__unassigned__', 'Org-REPORT']);
    expectSelectOptions(dialog, 'ユーザー定義Gr', ['all', '__unassigned__', 'Group-REPORT']);

    // 3. STEP1 でカード3 (オンデマンド登録CSV) をクリック
    const uploadCard = within(dialog).getByText(DATA_SOURCE_LABELS.user_upload.shortTitle);
    await user.click(uploadCard);

    // STEP2 のタグ・選択肢が即座に upload 系の候補に更新されること
    expectTags(dialog, ['upload-ai', 'upload-ml']);
    expectNoTags(dialog, ['live-frontend', 'live-backend', 'report-mobile', 'report-infra']);
    expectSelectOptions(dialog, 'CostCenter', ['all', '__unassigned__', 'CC-UPLOAD']);
    expectSelectOptions(dialog, 'GitHub Organization', ['all', '__unassigned__', 'Org-UPLOAD']);
    expectSelectOptions(dialog, 'ユーザー定義Gr', ['all', '__unassigned__', 'Group-UPLOAD']);

    // 4. STEP1 でカード1 (自動定期収集データ) に戻す
    const liveCard = within(dialog).getByText(DATA_SOURCE_LABELS.live_metrics.shortTitle);
    await user.click(liveCard);

    // 再び live 系の候補に即時復帰すること
    expectTags(dialog, ['live-frontend', 'live-backend']);
    expectNoTags(dialog, ['report-mobile', 'report-infra', 'upload-ai', 'upload-ml']);
    expectSelectOptions(dialog, 'CostCenter', ['all', '__unassigned__', 'CC-LIVE']);
  });

  it('prunes invalid tags and resets invalid select filters when switching data source', async () => {
    const user = userEvent.setup({ document });
    const scopeData = createMockScopeData();
    const reportData = createMockReportData();
    let appliedCriteria = DEFAULT_FILTER_CRITERIA;
    let appliedSource = 'live_metrics';

    render(
      <DataSelectionModal
        isOpen={true}
        onClose={() => {}}
        activeSource="live_metrics"
        onSelectSource={(source) => {
          appliedSource = source;
        }}
        indexMeta={null}
        scopeType="monthly"
        selectedScopeKey="2026-09"
        onSelectLiveScope={() => {}}
        availableReports={['2026-09']}
        selectedReportMonth="2026-09"
        onSelectReportMonth={() => {}}
        uploadedData={null}
        onUploadFileLoaded={() => {}}
        onClearUploadedFile={() => {}}
        filterCriteria={{
          ...DEFAULT_FILTER_CRITERIA,
          tags: ['live-frontend'],
          costCenter: 'CC-LIVE',
        }}
        onApplyFilterCriteria={(criteria) => {
          appliedCriteria = criteria;
        }}
        availableCostCenters={['CC-LIVE']}
        availableOrganizations={['Org-LIVE']}
        availableGroups={['Group-LIVE']}
        availableTags={['live-frontend', 'live-backend']}
        currentScopeData={scopeData}
        currentReportData={reportData}
      />
    );

    const dialog = screen.getByRole('dialog');

    // 初期状態 (live_metrics): CostCenter は CC-LIVE
    const costCenterSelects = within(dialog).getAllByRole('combobox') as HTMLSelectElement[];
    const ccSelect = costCenterSelects.find((s) => s.closest('div')?.textContent?.includes('CostCenter'));
    assert.ok(ccSelect);
    assert.strictEqual(ccSelect.value, 'CC-LIVE');

    // STEP1 で月次レポートへ切り替え
    const reportCard = within(dialog).getByText(DATA_SOURCE_LABELS.monthly_report.shortTitle);
    await user.click(reportCard);

    // monthly_report には CC-LIVE は存在しないため 'all' にリセットされていること
    assert.strictEqual(ccSelect.value, 'all');

    // 適用ボタンをクリック
    const applyButton = within(dialog).getByRole('button', { name: /この条件で分析を適用/ });
    await user.click(applyButton);

    // 適用された条件で、無効になった tags (live-frontend) と costCenter (CC-LIVE) が安全に刈り取られていること
    assert.strictEqual(appliedSource, 'monthly_report');
    assert.deepStrictEqual(appliedCriteria.tags, []);
    assert.strictEqual(appliedCriteria.costCenter, 'all');
  });

  it('updates preview user count stats in real-time when switching data source and toggling tags', async () => {
    const user = userEvent.setup({ document });
    const scopeData = createMockScopeData();
    const reportData = createMockReportData();

    render(
      <DataSelectionModal
        isOpen={true}
        onClose={() => {}}
        activeSource="live_metrics"
        onSelectSource={() => {}}
        indexMeta={null}
        scopeType="monthly"
        selectedScopeKey="2026-09"
        onSelectLiveScope={() => {}}
        availableReports={['2026-09']}
        selectedReportMonth="2026-09"
        onSelectReportMonth={() => {}}
        uploadedData={null}
        onUploadFileLoaded={() => {}}
        onClearUploadedFile={() => {}}
        filterCriteria={DEFAULT_FILTER_CRITERIA}
        onApplyFilterCriteria={() => {}}
        availableCostCenters={['CC-LIVE']}
        availableOrganizations={['Org-LIVE']}
        availableGroups={['Group-LIVE']}
        availableTags={['live-frontend', 'live-backend']}
        currentScopeData={scopeData}
        currentReportData={reportData}
      />
    );

    const dialog = screen.getByRole('dialog');

    // 1. 初期状態 (live_metrics): 2 / 2 名
    expectPreviewCounts(dialog, 2, 2);

    // 2. live-backend タグを選択 -> live-user-1 のみが持つため 1 / 2 名に即時絞り込み
    const backendTagBtn = within(dialog).getByRole('button', { name: /live-backend/ });
    await user.click(backendTagBtn);
    expectPreviewCounts(dialog, 1, 2);

    // 3. STEP1 で月次レポートへ切り替え
    const reportCard = within(dialog).getByText(DATA_SOURCE_LABELS.monthly_report.shortTitle);
    await user.click(reportCard);

    // reportData (1名) に切り替わり、live-backend はプルーニングされるため 1 / 1 名に即時反映
    expectPreviewCounts(dialog, 1, 1);

    // 4. report-mobile タグをクリックして選択 -> report-user-1 が持っているため 1 / 1 名
    const mobileTagBtn = within(dialog).getByRole('button', { name: /report-mobile/ });
    await user.click(mobileTagBtn);
    expectPreviewCounts(dialog, 1, 1);
  });
});

function expectPreviewCounts(container: HTMLElement, matched: number, total: number) {
  const label = within(container).getByText('選択ユーザー数:');
  const countContainer = label.parentElement;
  assert.ok(countContainer, 'Count container should exist');
  assert.ok(
    countContainer.textContent?.includes(`${matched}`),
    `Count container should show matched count ${matched}, got: ${countContainer.textContent}`
  );
  assert.ok(
    countContainer.textContent?.includes(`/ ${total} 名`),
    `Count container should show total count / ${total} 名, got: ${countContainer.textContent}`
  );
}

function expectTags(container: HTMLElement, expectedTags: string[]) {
  expectedTags.forEach((tag) => {
    const btn = within(container).queryByRole('button', { name: new RegExp(tag) });
    assert.ok(btn, `Tag button for "${tag}" should be present`);
  });
}

function expectNoTags(container: HTMLElement, unexpectedTags: string[]) {
  unexpectedTags.forEach((tag) => {
    const btn = within(container).queryByRole('button', { name: new RegExp(tag) });
    assert.strictEqual(btn, null, `Tag button for "${tag}" should NOT be present`);
  });
}

function expectSelectOptions(container: HTMLElement, labelSubstring: string, expectedValues: string[]) {
  const selects = within(container).getAllByRole('combobox') as HTMLSelectElement[];
  const targetSelect = selects.find((sel) => {
    const label = sel.closest('div')?.querySelector('label')?.textContent;
    return label?.includes(labelSubstring);
  });
  assert.ok(targetSelect, `Select with label containing "${labelSubstring}" should exist`);

  const actualValues = Array.from(targetSelect.options).map((o) => o.value);
  assert.deepStrictEqual(
    actualValues,
    expectedValues,
    `Options for ${labelSubstring} should match expected values`
  );
}
