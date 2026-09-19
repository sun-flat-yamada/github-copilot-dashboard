import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  getInitialTheme,
  applyThemeToDocument,
  THEME_STORAGE_KEY,
} from '../../dashboard/src/hooks/useTheme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Theme Management & Light Mode Support Tests', () => {
  it('verifies getInitialTheme defaults to dark mode per requirement', () => {
    const originalWindow = global.window;
    const originalLocalStorage = global.localStorage;

    try {
      // 1. Storage empty -> must return 'dark'
      const mockStorage: Record<string, string> = {};
      (global as any).window = {};
      (global as any).localStorage = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
      };

      assert.equal(getInitialTheme(), 'dark', 'Default theme must be dark');

      // 2. Storage set to 'light' -> must return 'light'
      mockStorage[THEME_STORAGE_KEY] = 'light';
      assert.equal(getInitialTheme(), 'light');

      // 3. Storage set to 'dark' -> must return 'dark'
      mockStorage[THEME_STORAGE_KEY] = 'dark';
      assert.equal(getInitialTheme(), 'dark');

      // 4. Storage set to invalid value -> must fallback to 'dark'
      mockStorage[THEME_STORAGE_KEY] = 'unknown_theme';
      assert.equal(getInitialTheme(), 'dark', 'Invalid theme value must fallback to dark');
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        global.window = originalWindow;
      }
      if (originalLocalStorage === undefined) {
        delete (global as any).localStorage;
      } else {
        global.localStorage = originalLocalStorage;
      }
    }
  });

  it('verifies applyThemeToDocument correctly updates document classes and attributes', () => {
    const originalDocument = global.document;

    try {
      const classes = new Set<string>();
      const attributes: Record<string, string> = {};
      const style: Record<string, string> = {};

      (global as any).document = {
        documentElement: {
          classList: {
            add: (cls: string) => classes.add(cls),
            remove: (cls: string) => classes.delete(cls),
            contains: (cls: string) => classes.has(cls),
          },
          setAttribute: (name: string, value: string) => {
            attributes[name] = value;
          },
          getAttribute: (name: string) => attributes[name] || null,
          style,
        },
      };

      // Apply light theme
      applyThemeToDocument('light');
      assert.equal(classes.has('light'), true);
      assert.equal(classes.has('dark'), false);
      assert.equal(attributes['data-theme'], 'light');
      assert.equal(style.colorScheme, 'light');

      // Apply dark theme
      applyThemeToDocument('dark');
      assert.equal(classes.has('dark'), true);
      assert.equal(classes.has('light'), false);
      assert.equal(attributes['data-theme'], 'dark');
      assert.equal(style.colorScheme, 'dark');
    } finally {
      if (originalDocument === undefined) {
        delete (global as any).document;
      } else {
        global.document = originalDocument;
      }
    }
  });

  it('verifies DashboardHeader.tsx contains theme toggle button next to GitHub link', () => {
    const headerPath = path.resolve(projectRoot, 'dashboard/src/components/layout/DashboardHeader.tsx');
    const headerContent = fs.readFileSync(headerPath, 'utf-8');

    // Button definition & icons
    assert.match(headerContent, /data-testid="theme-toggle-button"/);
    assert.match(headerContent, /Sun/);
    assert.match(headerContent, /Moon/);
    assert.match(headerContent, /aria-label={theme === 'dark' \? 'ライトモードに切り替え' : 'ダークモードに切り替え'}/);

    // Adjacent placement next to GitHub repo link container
    const githubLinkIndex = headerContent.indexOf('repoInfo.url');
    const themeButtonIndex = headerContent.indexOf('data-testid="theme-toggle-button"');
    assert.ok(githubLinkIndex !== -1, 'GitHub link must exist');
    assert.ok(themeButtonIndex !== -1, 'Theme toggle button must exist');
    assert.ok(
      Math.abs(themeButtonIndex - githubLinkIndex) < 3000,
      'Theme toggle button must be placed directly adjacent to GitHub repo link'
    );
  });

  it('verifies index.html has default dark class and FOUC inline script', () => {
    const htmlPath = path.resolve(projectRoot, 'dashboard/index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    assert.match(htmlContent, /<html[^>]*class="[^"]*dark[^"]*"/);
    assert.match(htmlContent, /<html[^>]*data-theme="dark"/);
    assert.match(htmlContent, /localStorage\.getItem\('copilot_dashboard_theme'\)/);
  });

  it('verifies index.css defines semantic light mode and dark mode design tokens', () => {
    const cssPath = path.resolve(projectRoot, 'dashboard/src/index.css');
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    assert.match(cssContent, /html\.dark/);
    assert.match(cssContent, /html\.light/);
    assert.match(cssContent, /--color-slate-950:\s*#f8fafc/);
    assert.match(cssContent, /--color-slate-900:\s*#ffffff/);
    assert.match(cssContent, /--color-slate-800:\s*#e2e8f0/);
    assert.match(cssContent, /--color-slate-100:\s*#0f172a/);
    assert.match(cssContent, /\.recharts-default-tooltip/);
  });
});
