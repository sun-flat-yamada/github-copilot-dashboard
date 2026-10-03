import { expect, test, type Page } from '@playwright/test';

/**
 * 主要フローのスモーク (P2-6 / C-04)。デモデータ (`npm run demo:generate`) を ?demo=true で表示して検証する。
 * 値そのものではなく「操作すると画面が正しく変わる」ことを保護する (値の検証は RTL / ユニットテストの役割)。
 */
const kpiText = (page: Page, id: string) => page.getByTestId(`metric-${id}`).first().innerText();

async function openDemo(page: Page) {
  await page.goto('/?demo=true');
  await expect(page.getByTestId('metric-total_spend').first()).toBeVisible();
}

test('demo banner is shown for demo data and every KPI is badged as demo', async ({ page }) => {
  await openDemo(page);
  const banner = page.getByTestId('data-status-demo-data');
  await expect(banner).toBeVisible();
  await expect(banner).toContainText('デモ');
  await expect(page.getByTestId('metric-total_spend').first().getByTestId('metric-badge-demo')).toBeVisible();
});

test('applying a filter changes the KPI cards', async ({ page }) => {
  await openDemo(page);
  const before = await kpiText(page, 'total_spend');

  await page.getByRole('button', { name: '分析対象データ' }).click();
  const dialog = page.getByRole('dialog');
  // 先頭の実在する Cost Center を選ぶ (all / 未割当 を除く)
  const costCenter = dialog.locator('select').filter({ has: page.locator('option[value="__unassigned__"]') }).first();
  const value = await costCenter.locator('option').evaluateAll((opts) =>
    (opts as HTMLOptionElement[]).map((o) => o.value).find((v) => v !== 'all' && v !== '__unassigned__')
  );
  expect(value, 'demo data must contain at least one cost center').toBeTruthy();
  await costCenter.selectOption(value!);
  await dialog.getByRole('button', { name: /この条件で分析を適用/ }).click();
  await expect(dialog).toBeHidden();

  await expect.poll(() => kpiText(page, 'total_spend')).not.toBe(before);

  // 全解除で元に戻る
  await page.getByRole('button', { name: 'フィルター全解除' }).click();
  await expect.poll(() => kpiText(page, 'total_spend')).toBe(before);
});

test('a past month can be opened from the data selector', async ({ page }) => {
  await openDemo(page);
  await page.getByRole('button', { name: '分析対象データ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: '月次レポート' }).click();
  const reportSelect = dialog.locator('select').filter({ has: page.locator('option', { hasText: '(確定版)' }) });
  const months = await reportSelect.locator('option').evaluateAll((opts) => (opts as HTMLOptionElement[]).map((o) => o.value));
  expect(months.length, 'demo data must have a past month').toBeGreaterThan(1);
  const past = months[months.length - 1];
  await reportSelect.selectOption(past);
  await dialog.getByRole('button', { name: /この条件で分析を適用/ }).click();
  await expect(dialog).toBeHidden();

  // 選択中のデータセレクターに過去月が表示され、画面は取得失敗にならない
  await expect(page.getByRole('button', { name: '分析対象データ' })).toContainText(past);
  await expect(page.getByText('データの読み込みに失敗しました')).toHaveCount(0);
});
