import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createViewRegistry, getMissingDatasets } from '../../dashboard/src/views/viewRegistry.js';
import { ViewHost } from '../../dashboard/src/views/ViewHost.js';
import { toNavigationItem } from '../../dashboard/src/views/navigation.js';
import type { ViewContext, ViewManifest } from '../../dashboard/src/views/types.js';
import { ANALYSIS_VIEW_REGISTRY } from '../domain/entities/views.js';
import dummy from './fixtures/dummy-view/manifest.js';

const viewsDir = path.resolve(process.cwd(), 'dashboard/src/views');
const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf-8');

/** defaultRegistry.ts の import.meta.glob('./*\/manifest.ts') と同じ規則で manifest を集める */
async function discoverManifests(): Promise<ViewManifest[]> {
  const dirs = fs
    .readdirSync(viewsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(viewsDir, d.name, 'manifest.ts')));
  return Promise.all(
    dirs.map(async (d) => (await import(pathToFileURL(path.join(viewsDir, d.name, 'manifest.ts')).href)).default)
  );
}

const ctx = (over: Partial<ViewContext> = {}): ViewContext =>
  ({ activeSource: 'live_metrics', currentData: null, currentReportData: null, ...over }) as ViewContext;

describe('View Registry', () => {
  it('既存 9 ビューの ID・ラベル・並び順・バッジ・対応データソースを変えない', async () => {
    const registry = createViewRegistry(await discoverManifests());
    const all = registry.getAll();
    // 既存 9 ビューは先頭に同じ順で並ぶ。以降は定義の追加だけで増えたビュー (audit: P4-1)
    assert.deepEqual(all.slice(0, ANALYSIS_VIEW_REGISTRY.length).map((m) => m.id), ANALYSIS_VIEW_REGISTRY.map((v) => v.id));
    assert.deepEqual(all.slice(ANALYSIS_VIEW_REGISTRY.length).map((m) => m.id), ['audit']);
    for (const def of ANALYSIS_VIEW_REGISTRY) {
      const m = registry.get(def.id)!;
      assert.equal(m.label, def.shortTitle);
      assert.equal(m.title, def.title);
      assert.equal(m.description, def.description);
      assert.equal(m.iconName, def.iconName);
      assert.equal(m.badge, def.badge);
      assert.equal(m.badgeColor, def.badgeColor);
      assert.deepEqual(m.supportedDataSources, def.supportedDataSources);
    }
  });

  it('ID 重複は例外にする', () => {
    assert.throws(() => createViewRegistry([dummy, dummy]), /Duplicate view id: dummy/);
  });

  it('ダミービュー追加は manifest + コンポーネントの 2 ファイルだけで、ナビと描画に現れる', async () => {
    // 追加物は fixtures/dummy-view の 2 ファイルのみ
    assert.deepEqual(fs.readdirSync(path.resolve(process.cwd(), 'src/tests/fixtures/dummy-view')).sort(), ['View.tsx', 'manifest.ts']);

    const registry = createViewRegistry([...(await discoverManifests()), dummy]);
    const c = ctx();
    const nav = registry.getVisible(c).map(toNavigationItem);
    assert.equal(nav.at(-1)?.id, 'dummy');
    assert.equal(nav.at(-1)?.shortTitle, 'Dummy');

    const html = renderToStaticMarkup(React.createElement(ViewHost, { registry, activeView: 'dummy', ctx: c }));
    assert.match(html, /data-testid="dummy-view"/);
    assert.match(html, /dummy:live_metrics/);
  });

  it('既存の共有ファイルはビュー ID を知らない (App.tsx / ViewNavigation / ViewHost に条件分岐がない)', () => {
    for (const f of [
      'dashboard/src/App.tsx',
      'dashboard/src/AppShell.tsx',
      'dashboard/src/components/layout/ViewNavigation.tsx',
      'dashboard/src/views/ViewHost.tsx',
      'dashboard/src/views/viewRegistry.ts',
    ]) {
      assert.doesNotMatch(read(f), /activeView\s*===\s*['"]/, `${f} must not branch on a specific view id`);
    }
    assert.match(read('dashboard/src/AppShell.tsx'), /<ViewHost /);
    assert.match(read('dashboard/src/views/defaultRegistry.ts'), /import\.meta\.glob[^)]*\.\/\*\/manifest\.ts/);
  });

  it('表示条件 (isVisible) を満たさないビューはナビにも描画にも出ない', () => {
    const hidden: ViewManifest = { ...dummy, id: 'hidden', isVisible: () => false };
    const registry = createViewRegistry([dummy, hidden]);
    assert.deepEqual(registry.getVisible(ctx()).map((m) => m.id), ['dummy']);
    assert.equal(renderToStaticMarkup(React.createElement(ViewHost, { registry, activeView: 'hidden', ctx: ctx() })), '');
  });

  it('order 昇順に並べ、同順位は登録順を保つ', () => {
    const a = { ...dummy, id: 'a', order: 5 };
    const b = { ...dummy, id: 'b', order: 1 };
    const c = { ...dummy, id: 'c', order: 5 };
    assert.deepEqual(createViewRegistry([a, b, c]).getAll().map((m) => m.id), ['b', 'a', 'c']);
  });

  it('必要データセットが 1 つも無いときだけ不足として返す', () => {
    const both: ViewManifest = { ...dummy, requiredDatasets: ['scope', 'report'] };
    assert.deepEqual(getMissingDatasets(both, ctx()), ['scope', 'report']);
    assert.deepEqual(getMissingDatasets(both, ctx({ currentReportData: {} as ViewContext['currentReportData'] })), []);
    assert.deepEqual(getMissingDatasets({ ...dummy, requiredDatasets: [] }, ctx()), []);
  });
});
