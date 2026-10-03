import * as fs from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * Playwright スモークテスト (P2-6)。`npm run e2e` で実行する。
 *
 * - 前提: `npm run demo:generate` でデモデータ (dashboard/public/data/demo, gitignore 済み) が生成されていること。
 * - ブラウザ: 事前インストール済みの Chromium を使い、再ダウンロードしない。
 *   `PLAYWRIGHT_CHROMIUM_EXECUTABLE` を指定するか、`PLAYWRIGHT_BROWSERS_PATH` 配下の `chromium` を自動検出する。
 *   どちらも無いとき (CI) は Playwright 管理のブラウザ (`npx playwright install chromium`) を使う。
 */
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
const preinstalled = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, browsersPath && `${browsersPath}/chromium`]
  .filter((p): p is string => Boolean(p))
  .find((p) => fs.existsSync(p));

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    launchOptions: preinstalled ? { executablePath: preinstalled, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
