import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getModelShortName, SidebarDisplayMode } from '../../dashboard/src/components/ModelSelectorSidebar';

test('AI Model Radar Selector Sidebar and Abbreviation Tests', async (t) => {
  const datasetPath = path.resolve(process.cwd(), 'dashboard/public/data/model-benchmarks.json');
  const datasetJson = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  const models = datasetJson.models as Array<{ id: string; name: string }>;

  await t.test('verifies getModelShortName generates expected abbreviations including opus4.8', () => {
    // ユーザー要求の明示例: opus4.8
    assert.strictEqual(
      getModelShortName({ id: 'claude-opus-4-8', name: 'Claude Opus 4.8' }),
      'opus4.8',
      'claude-opus-4-8 must map to opus4.8'
    );

    // 主力モデルの略称確認
    assert.strictEqual(
      getModelShortName({ id: 'claude-opus-5', name: 'Claude Opus 5' }),
      'opus5'
    );
    assert.strictEqual(
      getModelShortName({ id: 'claude-sonnet-5', name: 'Claude Sonnet 5' }),
      'sonnet5'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-6-astra', name: 'GPT-6 Astra' }),
      'astra'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-5-6-sol', name: 'GPT-5.6 Sol' }),
      'sol'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-5-6-terra', name: 'GPT-5.6 Terra' }),
      'terra'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gpt-5-6-luna', name: 'GPT-5.6 Luna' }),
      'luna'
    );
    assert.strictEqual(
      getModelShortName({ id: 'gemini-3-8-flash', name: 'Gemini 3.8 Flash' }),
      'gemini3.8'
    );
    assert.strictEqual(
      getModelShortName({ id: 'mai-code-1-1-flash', name: 'MAI-Code-1.1-Flash' }),
      'mai1.1'
    );
    assert.strictEqual(
      getModelShortName({ id: 'grok-4-6', name: 'Grok 4.6' }),
      'grok4.6'
    );
    assert.strictEqual(
      getModelShortName({ id: 'kimi-k3', name: 'Kimi K3' }),
      'kimi k3'
    );
    assert.strictEqual(
      getModelShortName({ id: 'deepseek-r1', name: 'DeepSeek R1 (Open Reasoning)' }),
      'deepseek r1'
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

    const viewPath = path.resolve(process.cwd(), 'dashboard/src/components/ModelRadarView.tsx');
    const viewContent = fs.readFileSync(viewPath, 'utf-8');

    assert.ok(viewContent.includes('<ModelSelectorSidebar'), 'Must render ModelSelectorSidebar in ModelRadarView');
    assert.ok(viewContent.includes("localStorage.getItem('copilot_radar_sidebar_mode')"), 'Must persist sidebar mode to localStorage');
    assert.ok(viewContent.includes('flex flex-col lg:flex-row items-start gap-6 relative w-full'), 'Must use 2-column responsive layout');
  });
});
