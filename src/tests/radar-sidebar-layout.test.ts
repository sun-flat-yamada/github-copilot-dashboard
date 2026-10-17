import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('AI Model Radar Sidebar Exclusive Layout and Table Stacking Context Separation Tests (#361)', async (t) => {
  const radarViewPath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
  const sidebarPath = path.resolve(process.cwd(), 'dashboard/src/components/ModelSelectorSidebar.tsx');

  assert.ok(fs.existsSync(radarViewPath), 'ModelRadarView.tsx must exist');
  assert.ok(fs.existsSync(sidebarPath), 'ModelSelectorSidebar.tsx must exist');

  const radarViewContent = fs.readFileSync(radarViewPath, 'utf-8');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

  await t.test('verifies two-column container uses horizontal flex without vertical stacking fallback to prevent overlap', () => {
    // 画面幅に関わらず flex flex-row items-start gap-6 relative w-full を適用し、排他幅を維持
    assert.ok(
      radarViewContent.includes('flex flex-row items-start gap-6 relative w-full'),
      'ModelRadarView must maintain horizontal flex row to ensure exclusive sidebar space allocation'
    );
    assert.ok(
      !radarViewContent.includes('flex flex-col lg:flex-row items-start gap-6 relative w-full'),
      'Must NOT fall back to flex-col on medium/small viewports to prevent sticky sidebar overlap'
    );
  });

  await t.test('verifies right main area has CSS isolation: isolate for stacking context boundary', () => {
    // 右側のメインコンテンツ領域に isolate を適用して内部 sticky 要素の外部漏出を防止
    assert.ok(
      radarViewContent.includes('className="flex-1 min-w-0 flex flex-col space-y-6 w-full isolate"'),
      'Right main content area must have CSS isolate to constrain table sticky stacking context'
    );
  });

  await t.test('verifies benchmark table card container establishes an isolated stacking context', () => {
    // 詳細テーブルカードに relative isolate を適用
    assert.ok(
      radarViewContent.includes('id="radar-table" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl scroll-mt-20 relative isolate"'),
      'Benchmark table card container must be relative isolate'
    );
  });

  await t.test('verifies benchmark table sticky z-index values conform to bounded stacking layers', () => {
    // モデル名固定列ヘッダー: z-30
    assert.ok(
      radarViewContent.includes('sticky top-0 left-0 z-30 bg-slate-950'),
      'Model column header must be sticky top and left with z-30'
    );
    // スクロール列ヘッダー: z-20
    assert.ok(
      radarViewContent.includes('sticky top-0 z-20 bg-slate-950'),
      'Metric column headers must be sticky top with z-20'
    );
    // モデル名固定列セル: z-10
    assert.ok(
      radarViewContent.includes('sticky left-0 z-10'),
      'Model column data cells must be sticky left with z-10'
    );
    // 下部水平スクロールコントローラー: z-20 (以前の z-40 から適正化)
    assert.ok(
      radarViewContent.includes('sticky bottom-0 z-20 -mx-6 -mb-6 mt-3 px-4 py-2 bg-slate-950/95'),
      'Bottom scroll controller must use z-20 (not z-40) to stay within proper stacking context'
    );
  });

  await t.test('verifies ModelSelectorSidebar sticky offset and max height follow navigation bar', () => {
    // ナビゲーションバー直下に追従: top-28, max-h-[calc(100vh-7.5rem)]
    assert.ok(
      sidebarContent.includes('sticky top-28'),
      'ModelSelectorSidebar must be sticky top-28 for proper navigation offset'
    );
    assert.ok(
      sidebarContent.includes('max-h-[calc(100vh-7.5rem)]'),
      'ModelSelectorSidebar must constrain max height to calc(100vh-7.5rem) to prevent bottom overflow'
    );
  });
});
