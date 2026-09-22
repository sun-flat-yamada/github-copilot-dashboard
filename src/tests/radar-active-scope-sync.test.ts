import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// 回帰防止テスト:
// 1. モデル特性レーダーのデフォルト選択は、アクティブ選択されている分析対象データの Top3 利用モデルであること。
// 2. タグANDフィルター/スコープ変更など、分析対象データ (aggregatedData / monthlyReportData) が変化した際に
//    その Top3 デフォルト選択が追従・再反映されること (ユーザーが手動選択した場合を除く)。
test('AI Model Radar Active Scope Sync (Top3 default & filter reactivity) Tests', async (t) => {
  const appPath = path.resolve(process.cwd(), 'dashboard/src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf-8');

  const viewPath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
  const viewContent = fs.readFileSync(viewPath, 'utf-8');

  await t.test('App.tsx no longer hardcodes a fixed default model (which made the Top3 default unreachable)', () => {
    assert.ok(
      !appContent.includes("useState<string>('claude-3-7-sonnet')"),
      'focusedRadarModelId must not hardcode a specific model ID as its default value, otherwise ' +
        'ModelRadarView always takes the explicit-model branch and never falls back to the Top3 usage default'
    );
    assert.ok(
      appContent.includes("const [focusedRadarModelId, setFocusedRadarModelId] = useState<string>('');"),
      'focusedRadarModelId must default to an empty string so ModelRadarView computes the Top3 usage default on first visit'
    );
  });

  await t.test('App.tsx resets focusedRadarModelId on direct tab navigation to model_radar', () => {
    assert.ok(
      appContent.includes('onSelectView={handleSelectView}'),
      'ViewNavigation must be wired through handleSelectView (not a raw setActiveView) so direct tab clicks can reset focus state'
    );
    const handlerStart = appContent.indexOf('const handleSelectView = ');
    assert.ok(handlerStart >= 0, 'handleSelectView must be defined');
    const handlerSnippet = appContent.slice(handlerStart, handlerStart + 250);
    assert.ok(
      handlerSnippet.includes("view === 'model_radar'") && handlerSnippet.includes("setFocusedRadarModelId('')"),
      'Direct navigation to model_radar via the nav tabs must reset focusedRadarModelId so Top3-default mode applies ' +
        '(explicit single-model focus should only occur via handleOpenRadar)'
    );
  });

  await t.test('ModelRadarView no longer permanently locks selection after the first computation', () => {
    assert.ok(
      !viewContent.includes('hasInitializedRef'),
      'Must not reintroduce a one-shot "hasInitializedRef" latch: once set, it previously blocked the Top3 default ' +
        'from ever recomputing again, even when aggregatedData/monthlyReportData legitimately changed later ' +
        '(e.g. tag filter or scope changes while the view stays mounted)'
    );
    assert.ok(
      viewContent.includes('isManualSelectionRef'),
      'Must track whether the user manually took control of the selection, distinct from the auto Top3 default'
    );
  });

  await t.test('Manual selection actions mark isManualSelectionRef so they are not silently overridden later', () => {
    for (const handler of [
      'handleToggleModel',
      'handleBatchSelectModels',
      'handleSelectAllCopilot',
      'handleClearSelection',
      'handleApplyPreset',
    ]) {
      const idx = viewContent.indexOf(`const ${handler} =`);
      assert.ok(idx >= 0, `${handler} must be defined in ModelRadarView.tsx`);
      const snippet = viewContent.slice(idx, idx + 250);
      assert.ok(
        snippet.includes('isManualSelectionRef.current = true'),
        `${handler} must set isManualSelectionRef.current = true so a subsequent data change does not reset the user's explicit choice`
      );
    }
  });

  await t.test('Selection effect recomputes Top3 from aggregatedData/monthlyReportData while not in manual mode', () => {
    assert.ok(
      viewContent.includes('if (isManualSelectionRef.current) return;'),
      'Must skip auto Top3 recomputation only when the user has manually taken control'
    );
    assert.ok(
      viewContent.includes('const stats = computeModelUsage(dataset, aggregatedData, monthlyReportData);') &&
        viewContent.includes('const top3Ids = getTopUsageModelIds(dataset, stats, 3);'),
      'Must recompute Top3 usage models from the current (possibly tag/scope-filtered) aggregatedData/monthlyReportData'
    );

    // 選択決定 useEffect の依存配列に aggregatedData / monthlyReportData / dataset / initialSelectedModelId が
    // すべて含まれていること (いずれかが変化する都度、追従・再計算されるべきため)
    const effectDeclIdx = viewContent.indexOf('// 2. モデル選択の決定:');
    assert.ok(effectDeclIdx >= 0, 'Selection-decision effect block must exist with its explanatory comment');
    const effectSnippet = viewContent.slice(effectDeclIdx, effectDeclIdx + 1500);
    assert.ok(
      effectSnippet.includes(
        '}, [dataset, aggregatedData, monthlyReportData, initialSelectedModelId]);'
      ),
      'The selection-decision effect must depend on dataset, aggregatedData, monthlyReportData, and initialSelectedModelId ' +
        'so that scope/tag-filter driven data changes are reflected in the active model selection'
    );
  });

  await t.test('Explicit initialSelectedModelId re-application is guarded so it does not repeatedly clobber manual edits', () => {
    assert.ok(
      viewContent.includes('appliedInitialModelIdRef'),
      'Must remember the last-applied initialSelectedModelId so unrelated re-renders (e.g. tag filter changes) ' +
        'do not repeatedly force-reset the selection back to the single explicitly-navigated model'
    );
  });
});
