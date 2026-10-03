import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * アクセシビリティ検査 (P3-3 / D-07)。axe-core の自動検査 (ライト / ダーク) と、
 * 「表で見る」切替・キーボード操作の挙動を確認する。デモデータ (`npm run demo:generate`) を使う。
 *
 * 自動検査は「critical / serious の違反ゼロ」を保証する。色コントラストはテーマ全体の既存配色に依存するため
 * ここでは対象外とし、手動チェックリスト (SDD-07 §2.17) で扱う。
 */
async function openDemo(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('copilot_dashboard_theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
  await page.goto('/?demo=true');
  await expect(page.getByTestId('metric-total_spend').first()).toBeVisible();
}

for (const theme of ['dark', 'light'] as const) {
  test(`no critical/serious axe violations on the overview (${theme})`, async ({ page }) => {
    await openDemo(page, theme);
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      document.documentElement.classList.toggle('dark', t === 'dark');
    }, theme);
    // チャートを含む折りたたみセクション (コスト内訳) を開いてから検査する
    const allocation = page.getByRole('button', { name: /グループ別 コスト内訳/ }).first();
    if ((await allocation.getAttribute('aria-expanded')) === 'false') await allocation.click();
    await expect(page.getByTestId('cost-ranked-bar')).toBeVisible();
    const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
    const blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
}

test('cost ranking chart: text labels, keyboard focus and table toggle', async ({ page }) => {
  await openDemo(page, 'dark');
  const chart = page.getByTestId('cost-ranked-bar');
  // 初期状態で折りたたまれている場合は開く
  if (!(await chart.isVisible())) {
    await page.getByRole('button', { name: /グループ別 コスト内訳/ }).first().click();
  }
  await expect(chart).toBeVisible();
  const rows = chart.getByTestId('cost-ranked-bar-row');
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(rows.first()).toContainText('$');

  // キーボード: トグルへフォーカスし Enter で表へ
  const toggle = page.getByTestId('cost-ranked-bar-toggle');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(chart.getByRole('table')).toBeVisible();
  await expect(chart.getByRole('columnheader', { name: 'シェア' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(chart.getByRole('table')).toHaveCount(0);

  // 行はキーボードでフォーカスできる
  await rows.first().focus();
  await expect(rows.first()).toBeFocused();
});
