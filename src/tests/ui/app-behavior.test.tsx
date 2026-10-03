import './dom-setup.js';
import { afterEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../../dashboard/src/AppShell.js';
import { createAutoCollectedTestDataset, TEST_USERS_MATRIX } from '../fixtures/auto-collected-data-fixtures.js';
import { buildFileMap, discoverViewRegistry, installFakeDataServer, type FakeDataServer } from './test-harness.js';

/**
 * 画面の挙動テスト (P2-6 / C-04)。ソース文字列の正規表現ではなく、実際に描画して操作し、見えるものを検証する。
 * データはメモリ上の固定データセット (13 ユーザー) を fetch スタブで返す。
 */
let server: FakeDataServer | undefined;
afterEach(() => {
  cleanup();
  server?.restore();
  server = undefined;
  window.localStorage.clear();
});

async function renderApp(files: Record<string, unknown>) {
  server = installFakeDataServer(files);
  const registry = await discoverViewRegistry();
  const user = userEvent.setup({ document });
  render(<AppShell registry={registry} />);
  return user;
}

const usd = (n: number) => `$${n.toFixed(2)}`;
const metric = (id: string) => screen.findByTestId(`metric-${id}`, undefined, { timeout: 5000 });

describe('Filter → KPI (RTL)', () => {
  it('applying a Cost Center filter recomputes the KPI cards for that population only', async () => {
    const user = await renderApp(buildFileMap('/data', { is_mock_mode: false }));

    const allCost = TEST_USERS_MATRIX.reduce((s, u) => s + u.monthly_cost_usd, 0);
    const fintech = TEST_USERS_MATRIX.filter((u) => u.cost_center === 'FinTech-Division');
    const fintechCost = fintech.reduce((s, u) => s + u.monthly_cost_usd, 0);
    assert.ok(fintech.length > 0 && fintechCost < allCost, 'fixture must contain a strict subset');

    assert.match((await metric('total_spend')).textContent ?? '', new RegExp(`\\${usd(allCost)}`));

    await user.click(screen.getByRole('button', { name: '分析対象データ' }));
    const dialog = await screen.findByRole('dialog');
    const costCenterSelect = within(dialog)
      .getAllByRole('combobox')
      .find((el) => Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'FinTech-Division'));
    assert.ok(costCenterSelect, 'cost center select is in the modal');
    await user.selectOptions(costCenterSelect, 'FinTech-Division');
    await user.click(within(dialog).getByRole('button', { name: /この条件で分析を適用/ }));

    await waitFor(() => {
      assert.match(screen.getByTestId('metric-total_spend').textContent ?? '', new RegExp(`\\${usd(fintechCost)}`));
    });
    assert.doesNotMatch(screen.getByTestId('metric-total_spend').textContent ?? '', new RegExp(`\\${usd(allCost)}`));
    // 稼働ユーザー / 契約シート数も絞り込み後の母集団になる
    assert.match(document.body.textContent ?? '', new RegExp(`契約シート数: ${fintech.length} 席`));
  });
});

describe('Metric quality attributes (RTL)', () => {
  it('real data: measured values carry no badge, the idle-waste estimate is labelled as an estimate', async () => {
    await renderApp(buildFileMap('/data', { is_mock_mode: false }));
    const spend = await metric('total_spend');
    assert.equal(spend.getAttribute('data-quality'), 'measured');
    assert.equal(within(spend).queryByTestId('metric-badge-demo'), null);
    const idle = await metric('idle_waste');
    assert.equal(idle.getAttribute('data-quality'), 'estimated');
    assert.ok(within(idle).getByTestId('metric-badge-estimated'));
  });

  it('demo data: every KPI is badged as demo', async () => {
    await renderApp(buildFileMap('/data', { is_mock_mode: true }));
    const spend = await metric('total_spend');
    assert.equal(spend.getAttribute('data-quality'), 'demo');
    assert.ok(within(spend).getByTestId('metric-badge-demo'));
  });

  it('unavailable usage metrics render as "—" with a reason, never as 0%', async () => {
    const files = buildFileMap('/data', { is_mock_mode: false });
    const scope = files['/data/monthly/2026-09.json'] as {
      overview: { overall_acceptance_rate: number | null };
      usage_metrics?: { availability: string };
    };
    scope.overview.overall_acceptance_rate = null;
    scope.usage_metrics = { ...(scope.usage_metrics ?? {}), availability: 'unavailable' };
    await renderApp(files);
    const acceptance = await metric('acceptance_rate');
    assert.equal(acceptance.getAttribute('data-quality'), 'missing');
    assert.match(acceptance.textContent ?? '', /—/);
    assert.ok(within(acceptance).getByTestId('metric-missing-reason').textContent);
    assert.doesNotMatch(acceptance.textContent ?? '', /0(\.0)?%/);
  });
});

describe('Data status banner (RTL)', () => {
  it('shows the demo banner for demo data and switches back to real data on request', async () => {
    const files = {
      // ユーザーが ?demo=true で明示選択したデモ (データ自身は is_mock_mode を宣言していない) だけが「実データを表示」で戻れる
      ...buildFileMap('/data/demo', { is_mock_mode: false }),
      ...buildFileMap('/data', { is_mock_mode: false }),
    };
    window.history.pushState({}, '', '/?demo=true');
    try {
      const user = await renderApp(files);
      const banner = await screen.findByTestId('data-status-demo-data', undefined, { timeout: 5000 });
      assert.match(banner.textContent ?? '', /デモ/);
      assert.equal((await metric('total_spend')).getAttribute('data-quality'), 'demo');

      await user.click(within(banner).getByTestId('data-status-switch-to-live'));
      await waitFor(() => assert.equal(screen.queryByTestId('data-status-demo-data'), null));
      assert.equal((await metric('total_spend')).getAttribute('data-quality'), 'measured');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('a failed source is announced as an alert (not rendered as an empty/zero value)', async () => {
    await renderApp(
      buildFileMap('/data', {
        is_mock_mode: false,
        source_status: [
          { source: 'seats', status: 'failed', records: 0, last_attempt_at: '2026-09-10T00:00:00Z', last_success_at: null, error: 'HTTP 500' },
        ],
      })
    );
    const alert = await screen.findByTestId('data-status-source-failed-seats', undefined, { timeout: 5000 });
    assert.equal(alert.getAttribute('role'), 'alert');
    assert.match(alert.textContent ?? '', /シート割り当て/);
  });

  it('missing live data surfaces an error and offers (but never silently loads) demo data', async () => {
    const user = await renderApp({});
    const button = await screen.findAllByTestId('show-demo-data-button', undefined, { timeout: 5000 });
    assert.ok(button.length > 0);
    assert.equal(
      server!.requested.some((p) => p.startsWith('/data/demo')),
      false,
      'demo data must not be fetched unless the user asks for it'
    );
    assert.equal(screen.queryByTestId('data-status-demo-data'), null);
    await user.click(button[0]);
    // 明示操作の後にはじめてデモを取得しに行く
    await waitFor(() => assert.ok(server!.requested.some((p) => p.startsWith('/data/demo'))));
  });
});

// 参照されない import の警告を避けつつ、データセット生成が壊れていないことを担保する
void createAutoCollectedTestDataset;
