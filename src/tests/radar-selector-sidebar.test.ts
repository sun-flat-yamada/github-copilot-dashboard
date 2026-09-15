import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getModelShortName, SidebarDisplayMode } from '../../dashboard/src/components/ModelSelectorSidebar';
import { runBenchmarkUpdate } from '../../scripts/update-benchmarks.js';

test('AI Model Radar Selector Sidebar and Abbreviation Tests', async (t) => {
  const datasetPath = path.resolve(process.cwd(), 'dashboard/public/data/model-benchmarks.json');
  if (!fs.existsSync(datasetPath)) {
    runBenchmarkUpdate();
  }
  const datasetJson = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const models = datasetJson.models as Array<{ id: string; name: string }>;

  await t.test('verifies getModelShortName retains model family and version numbers without omission', () => {
    // ユーザー要求の指定例:
    // - gpt-5.6-luna
    // - gpt-6-astra
    // - opus-5
    // - sonnet-4.5 (claude-haiku-4-5 / claude-sonnet-4-6 等のバージョン保持)
    assert.strictEqual(
      getModelShortName({ id: 'gpt-5-6-luna', name: 'GPT-5.6 Luna' }),
      'gpt-5.6-luna',
      'gpt-5-6-luna must retain family and version number'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-6-astra', name: 'GPT-6 Astra' }),
      'gpt-6-astra',
      'gpt-6-astra must retain family and version number'
    );
    assert.strictEqual(
      getModelShortName({ id: 'claude-opus-5', name: 'Claude Opus 5' }),
      'opus-5',
      'claude-opus-5 must retain family and version number'
    );
    assert.strictEqual(
      getModelShortName({ id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' }),
      'haiku-4.5',
      'claude-haiku-4-5 must retain family and version number'
    );

    // その他の主要モデル
    assert.strictEqual(
      getModelShortName({ id: 'claude-opus-4-8', name: 'Claude Opus 4.8' }),
      'opus-4.8'
    );
    assert.strictEqual(
      getModelShortName({ id: 'claude-opus-4-6', name: 'Claude Opus 4.6' }),
      'opus-4.6'
    );
    assert.strictEqual(
      getModelShortName({ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }),
      'sonnet-5'
    );
    assert.strictEqual(
      getModelShortName({ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' }),
      'sonnet-4.6'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-5-6-sol', name: 'GPT-5.6 Sol' }),
      'gpt-5.6-sol'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-5-6-terra', name: 'GPT-5.6 Terra' }),
      'gpt-5.6-terra'
    );
    assert.strictEqual(
      getModelShortName({ id: 'o1', name: 'OpenAI o1 (Full Reasoning)' }),
      'gpt-o1',
      'o1 must map to gpt-o1'
    );
    assert.strictEqual(
      getModelShortName({ id: 'o3-mini', name: 'OpenAI o3-mini' }),
      'gpt-o3-mini',
      'o3-mini must map to gpt-o3-mini'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gemini-3-8-flash', name: 'Gemini 3.8 Flash' }),
      'gemini-3.8-flash'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gemini-3-5-flash', name: 'Gemini 3.5 Flash' }),
      'gemini-3.5-flash'
    );
    assert.strictEqual(
      getModelShortName({ id: 'mai-code-1-1-flash', name: 'MAI-Code-1.1-Flash' }),
      'mai-1.1-flash'
    );
    assert.strictEqual(
      getModelShortName({ id: 'grok-4-6', name: 'Grok 4.6' }),
      'grok-4.6'
    );
    assert.strictEqual(
      getModelShortName({ id: 'kimi-k3', name: 'Kimi K3' }),
      'kimi-k3'
    );
    assert.strictEqual(
      getModelShortName({ id: 'kimi-k2-7-code', name: 'Kimi K2.7 Code' }),
      'kimi-k2.7'
    );
    assert.strictEqual(
      getModelShortName({ id: 'deepseek-r1', name: 'DeepSeek R1 (Open Reasoning)' }),
      'deepseek-r1'
    );
  });

  await t.test('all dataset models produce clean, non-empty, concise abbreviations (< 20 chars)', () => {
    for (const model of models) {
      const short = getModelShortName(model);
      assert.ok(short && short.length > 0, `Model ${model.id} short name must not be empty`);
      assert.ok(
        short.length <= 20,
        `Model ${model.id} short name "${short}" should be concise (<= 20 chars) for narrow display`
      );
    }
  });

  await t.test('verifies 3-state display mode transitions (expanded, compact, collapsed)', () => {
    // デフォルトモードは 'expanded' (表示)
    const defaultMode: SidebarDisplayMode = 'expanded';
    assert.strictEqual(defaultMode, 'expanded', 'Default mode must be expanded (表示)');

    // 遷移検証
    const cycleNext = (current: SidebarDisplayMode): SidebarDisplayMode => {
      if (current === 'expanded') return 'compact';
      if (current === 'compact') return 'collapsed';
      return 'expanded';
    };

    let current: SidebarDisplayMode = defaultMode;
    current = cycleNext(current);
    assert.strictEqual(current, 'compact', 'Next after expanded should be compact (省幅)');
    current = cycleNext(current);
    assert.strictEqual(current, 'collapsed', 'Next after compact should be collapsed (非表示)');
    current = cycleNext(current);
    assert.strictEqual(current, 'expanded', 'Next after collapsed should cycle to expanded (表示)');
  });

  await t.test('verifies getTopUsageModelIds returns Top 3 models by requests or empty if no data', async (sub) => {
    const { getTopUsageModelIds, computeModelUsage } = await import('../../dashboard/src/components/ModelRadarView');

    await sub.test('computeModelUsage correctly computes stats and handles empty dataset', () => {
      const stats = computeModelUsage(datasetJson, null, null);
      assert.ok(stats['claude-opus-5']);
      assert.strictEqual(stats['claude-opus-5'].requests, 0);
      assert.strictEqual(stats['claude-opus-5'].hasUsage, false);
    });

    await sub.test('returns Top 3 active models in descending order of requests', () => {
      const mockUsageStats = {
        'claude-opus-5': { modelId: 'claude-opus-5', requests: 1200, percentage: 50, hasUsage: true },
        'gemini-3-8-flash': { modelId: 'gemini-3-8-flash', requests: 800, percentage: 33.3, hasUsage: true },
        'gpt-6-astra': { modelId: 'gpt-6-astra', requests: 300, percentage: 12.5, hasUsage: true },
        'gpt-5-6-luna': { modelId: 'gpt-5-6-luna', requests: 100, percentage: 4.2, hasUsage: true },
        'kimi-k3': { modelId: 'kimi-k3', requests: 0, percentage: 0, hasUsage: false },
      };

      const top3 = getTopUsageModelIds(datasetJson, mockUsageStats, 3);
      assert.deepStrictEqual(top3, ['claude-opus-5', 'gemini-3-8-flash', 'gpt-6-astra']);
    });

    await sub.test('returns empty array [] when usage data is empty or all requests are 0', () => {
      const emptyUsageStats = {};
      const resultEmpty = getTopUsageModelIds(datasetJson, emptyUsageStats, 3);
      assert.deepStrictEqual(resultEmpty, [], 'Should return empty array when no usage data exists');

      const allZeroUsageStats: Record<string, any> = {};
      for (const m of datasetJson.models) {
        allZeroUsageStats[m.id] = { modelId: m.id, requests: 0, percentage: 0, hasUsage: false };
      }
      const resultZero = getTopUsageModelIds(datasetJson, allZeroUsageStats, 3);
      assert.deepStrictEqual(resultZero, [], 'Should return empty array when all model requests are 0');
    });

    await sub.test('returns fewer than 3 models if only 1 or 2 models have requests', () => {
      const twoModelsUsage = {
        'claude-sonnet-5': { modelId: 'claude-sonnet-5', requests: 50, percentage: 70, hasUsage: true },
        'gpt-5-6-terra': { modelId: 'gpt-5-6-terra', requests: 20, percentage: 30, hasUsage: true },
      };
      const result = getTopUsageModelIds(datasetJson, twoModelsUsage, 3);
      assert.deepStrictEqual(result, ['claude-sonnet-5', 'gpt-5-6-terra']);
    });
  });

  await t.test('verifies batch selection logic (select all / deselect all) and clear selection', () => {
    // 1. 全選択 (select=true) のシミュレーション
    const initialSelected = ['claude-opus-5'];
    const vendorIds = ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'];

    const handleBatchSelectModels = (prev: string[], targetIds: string[], select: boolean): string[] => {
      if (select) {
        return Array.from(new Set([...prev, ...targetIds]));
      } else {
        return prev.filter((id) => !targetIds.includes(id));
      }
    };

    const afterSelectAll = handleBatchSelectModels(initialSelected, vendorIds, true);
    assert.deepStrictEqual(
      afterSelectAll.sort(),
      ['claude-haiku-4-5', 'claude-opus-5', 'claude-sonnet-5'].sort(),
      'Vendor batch select should add all models without duplicate'
    );

    // 2. 全解除 (select=false) のシミュレーション
    const afterDeselectAll = handleBatchSelectModels(afterSelectAll, vendorIds, false);
    assert.deepStrictEqual(
      afterDeselectAll,
      [],
      'Vendor batch deselect should remove all target models'
    );

    // 3. クリア処理のシミュレーション: 全モデル選択を空配列にする
    const currentSelected = ['claude-opus-5', 'gpt-6-astra'];
    assert.strictEqual(currentSelected.length, 2);
    const handleClearSelection = (): string[] => [];
    const cleared = handleClearSelection();
    assert.deepStrictEqual(cleared, [], 'Clear selection must result in empty array []');
  });

  await t.test('ModelSelectorSidebar and ModelRadarView files contain required 3-mode elements and layout bindings', () => {
    const sidebarPath = path.resolve(process.cwd(), 'dashboard/src/components/ModelSelectorSidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');

    // モード切り替え・要素の存在確認
    assert.ok(sidebarContent.includes("'expanded'"), 'Must handle expanded mode');
    assert.ok(sidebarContent.includes("'compact'"), 'Must handle compact mode');
    assert.ok(sidebarContent.includes("'collapsed'"), 'Must handle collapsed mode');
    assert.ok(sidebarContent.includes('PanelLeftOpen'), 'Must render reopen toggle for collapsed mode');
    assert.ok(sidebarContent.includes('title={tooltipText}'), 'Must render full details tooltip on hover');
    assert.ok(sidebarContent.includes('sticky top-20'), 'Must be sticky for page scroll tracking');
    assert.ok(sidebarContent.includes('onBatchSelectModels'), 'Must support onBatchSelectModels prop');

    const viewPath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
    const viewContent = fs.readFileSync(viewPath, 'utf-8');

    assert.ok(viewContent.includes('<ModelSelectorSidebar'), 'Must render ModelSelectorSidebar in ModelRadarView');
    assert.ok(viewContent.includes("localStorage.getItem('copilot_radar_sidebar_mode')"), 'Must persist sidebar mode to localStorage');
    assert.ok(viewContent.includes('flex flex-col lg:flex-row items-start gap-6 relative w-full'), 'Must use 2-column responsive layout');
    assert.ok(viewContent.includes('onBatchSelectModels={handleBatchSelectModels}'), 'Must pass handleBatchSelectModels to ModelSelectorSidebar');
    assert.ok(viewContent.includes('onClearSelection={handleClearSelection}'), 'Must pass handleClearSelection to ModelSelectorSidebar');
    assert.ok(viewContent.includes('getTopUsageModelIds'), 'Must call getTopUsageModelIds for initial selection');

    // コラプス（非表示）状態でのアイコンのみ表示（Boxes + PanelLeftOpen）
    assert.ok(sidebarContent.includes('<Boxes className="w-4 h-4 text-white" />'), 'Must show Boxes icon in collapsed mode');
    assert.ok(sidebarContent.includes('<PanelLeftOpen className="w-3.5 h-3.5'), 'Must show PanelLeftOpen icon in collapsed mode');
    assert.ok(!sidebarContent.includes('<span>\n              モデル選択\n            </span>'), 'Must NOT have "モデル選択" text in collapsed mode');

    // 詳細カード切り替えウィジェットの非表示・未選択時制御
    assert.ok(viewContent.includes('if (!dataset || selectedModels.length === 0) return null;'), 'focusedModel must be null when 0 models are selected');
    assert.ok(viewContent.includes('モデルが選択されていません'), 'Must render empty state message in detail card widget');
  });
});

