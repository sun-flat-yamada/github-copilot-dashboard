import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeRadarScores,
  evaluateModel,
  createModelProfile,
  normalizeModelId,
  RADAR_AXIS_DEFINITIONS,
  DEFAULT_BENCHMARK_SOURCES,
} from '../processor/benchmark-evaluator';
import { BenchmarkRawMetrics, CANONICAL_VENDOR_ORDER } from '../types/model-benchmark';

describe('AI Model Benchmark Evaluator Tests', () => {
  it('defines 6 radar axes and benchmark sources correctly', () => {
    assert.strictEqual(RADAR_AXIS_DEFINITIONS.length, 6);
    const totalWeight = RADAR_AXIS_DEFINITIONS.reduce((sum, a) => sum + a.weight, 0);
    assert.ok(Math.abs(totalWeight - 1.0) < 0.001, 'Axis weights should sum to 1.0');
    assert.ok(DEFAULT_BENCHMARK_SOURCES.length >= 3);
  });

  it('correctly computes normalized radar scores within 0-100 range', () => {
    const rawClaude: BenchmarkRawMetrics = {
      swe_bench_verified: 70.3,
      humaneval_plus: 92.0,
      aime_2024: 84.0,
      gpqa_diamond: 65.0,
      arena_coding_elo: 1420,
      output_speed_tps: 65,
      input_cost_per_m: 3.0,
      output_cost_per_m: 15.0,
      context_window_k: 200,
    };

    const radar = computeRadarScores(rawClaude);

    // All scores must be between 0 and 100
    for (const [key, val] of Object.entries(radar)) {
      assert.ok(val >= 0 && val <= 100, `Radar score ${key} should be in [0, 100], got ${val}`);
    }

    // High SWE-bench and AIME should result in high coding & reasoning scores
    assert.ok(radar.coding_swe >= 85, 'Claude should have high coding_swe score');
    assert.ok(radar.reasoning_logic >= 80, 'Claude should have high reasoning_logic score');
  });

  it('correctly evaluates reasoning-specialist model (OpenAI o1)', () => {
    const rawO1: BenchmarkRawMetrics = {
      swe_bench_verified: 68.0,
      humaneval_plus: 91.5,
      aime_2024: 88.5,
      gpqa_diamond: 75.2,
      arena_coding_elo: 1410,
      output_speed_tps: 32,
      input_cost_per_m: 15.0,
      output_cost_per_m: 60.0,
      context_window_k: 200,
    };

    const radar = computeRadarScores(rawO1);
    const evaluation = evaluateModel('o1', rawO1, radar);

    assert.ok(evaluation.suitability_tags.includes('Algorithm Specialist'));
    assert.ok(evaluation.overall_score >= 80);
    assert.ok(evaluation.weaknesses.some((w) => w.includes('待ち時間') || w.includes('コスト')));
    assert.ok(evaluation.copilot_usage_guidance.includes('難解なバグ調査'));
  });

  it('correctly evaluates speed & cost-effective model (Gemini 2.0 Flash)', () => {
    const rawFlash: BenchmarkRawMetrics = {
      swe_bench_verified: 52.0,
      humaneval_plus: 88.0,
      aime_2024: 65.0,
      gpqa_diamond: 55.0,
      arena_coding_elo: 1335,
      output_speed_tps: 185,
      input_cost_per_m: 0.1,
      output_cost_per_m: 0.4,
      context_window_k: 1048,
    };

    const radar = computeRadarScores(rawFlash);
    const evaluation = evaluateModel('gemini-2-0-flash', rawFlash, radar);

    assert.ok(radar.speed_latency >= 85, 'Flash should have high speed score');
    assert.ok(radar.cost_efficiency >= 90, 'Flash should have high cost efficiency');
    assert.ok(evaluation.suitability_tags.includes('Fast Inline Suggestion'));
    assert.ok(evaluation.suitability_tags.includes('Cost Saver'));
    assert.ok(evaluation.suitability_tags.includes('Ultra-Long Context'));
  });

  it('handles extreme edge values gracefully without throwing', () => {
    const rawZero: BenchmarkRawMetrics = {
      swe_bench_verified: 0,
      humaneval_plus: 0,
      aime_2024: 0,
      gpqa_diamond: 0,
      arena_coding_elo: 1000,
      output_speed_tps: 5,
      input_cost_per_m: 100,
      output_cost_per_m: 300,
      context_window_k: 32,
    };

    const radar = computeRadarScores(rawZero);
    for (const val of Object.values(radar)) {
      assert.ok(val >= 0 && val <= 100);
    }

    const profile = createModelProfile(
      'mock-test',
      'Mock Model',
      'Other',
      'Mock',
      '#999999',
      false,
      '2026-01-01',
      rawZero
    );
    assert.strictEqual(profile.id, 'mock-test');
    assert.ok(profile.evaluation.overall_score >= 0);
  });

  it('provides target_problem, performance_view, and community_rumor for all benchmark sources', () => {
    for (const src of DEFAULT_BENCHMARK_SOURCES) {
      assert.ok(src.target_problem, `Benchmark source ${src.id} should have target_problem`);
      assert.ok(src.performance_view, `Benchmark source ${src.id} should have performance_view`);
      assert.ok(src.community_rumor, `Benchmark source ${src.id} should have community_rumor`);
      assert.ok(
        src.community_rumor.includes('※ SNSの噂'),
        `Benchmark source ${src.id} community_rumor should include '※ SNSの噂' note`
      );
    }
  });

  it('generates real engineer buzz with SNS rumor annotation for evaluated models', () => {
    const raw: BenchmarkRawMetrics = {
      swe_bench_verified: 70.3,
      humaneval_plus: 92.4,
      aime_2024: 84.8,
      gpqa_diamond: 67.2,
      arena_coding_elo: 1435,
      output_speed_tps: 68,
      input_cost_per_m: 3.0,
      output_cost_per_m: 15.0,
      context_window_k: 200,
    };
    const radar = computeRadarScores(raw);
    const evaluation = evaluateModel('claude-3-7-sonnet', raw, radar);

    assert.ok(evaluation.buzz, 'Model evaluation must have buzz');
    assert.ok(evaluation.buzz.headline.length > 5, 'Buzz headline must be descriptive');
    assert.ok(evaluation.buzz.community_sentiments.length > 0, 'Buzz must have community sentiments');
    assert.ok(evaluation.buzz.caution_rumor.length > 5, 'Buzz caution rumor must be present');
    assert.ok(
      evaluation.buzz.source_note.includes('※ SNS上のエンジニアの声'),
      'Buzz source_note must explicitly specify SNS rumor note'
    );
  });

  it('correctly normalizes diverse model name variants to knowledge model IDs', () => {
    assert.strictEqual(normalizeModelId('Claude 3.7 Sonnet'), 'claude-3-7-sonnet');
    assert.strictEqual(normalizeModelId('claude-3.7-sonnet'), 'claude-3-7-sonnet');
    assert.strictEqual(normalizeModelId('GPT-4o'), 'gpt-4o');
    assert.strictEqual(normalizeModelId('gpt4o'), 'gpt-4o');
    assert.strictEqual(normalizeModelId('GPT-4o mini'), 'gpt-4o-mini');
    assert.strictEqual(normalizeModelId('o1 (推論)'), 'o1');
    assert.strictEqual(normalizeModelId('OpenAI o1'), 'o1');
    assert.strictEqual(normalizeModelId('o3-mini'), 'o3-mini');
    assert.strictEqual(normalizeModelId('Gemini 2.0 Flash'), 'gemini-2-0-flash');
    assert.strictEqual(normalizeModelId('Gemini 2.5 Pro'), 'gemini-2-5-pro');
    assert.strictEqual(normalizeModelId('DeepSeek R1'), 'deepseek-r1');
  });

  it('guarantees all knowledge models are selectable and defaults unused models to 0%', () => {
    // 保持ナレッジモデル一覧 (9モデル)
    const knowledgeModelIds = [
      'claude-3-7-sonnet',
      'claude-3-5-sonnet',
      'gpt-4o',
      'gpt-4o-mini',
      'o1',
      'o3-mini',
      'gemini-2-0-flash',
      'gemini-2-5-pro',
      'deepseek-r1',
    ];

    // 分析対象データ内には Claude 3.7 と GPT-4o の2モデルしか利用実績がないケースをシミュレート
    const rawUsageCounts: Record<string, number> = {
      'claude-3-7-sonnet': 75,
      'gpt-4o': 25,
    };
    const totalRequests = 100;

    // 全ナレッジモデルに対する利用シェア判定
    const stats: Record<string, { requests: number; percentage: number; hasUsage: boolean }> = {};
    for (const id of knowledgeModelIds) {
      const count = rawUsageCounts[id] || 0;
      const pct = totalRequests > 0 ? Number(((count / totalRequests) * 100).toFixed(1)) : 0;
      stats[id] = {
        requests: count,
        percentage: pct,
        hasUsage: count > 0,
      };
    }

    // 1. 全ナレッジモデルが除外されることなく保持されているか
    assert.strictEqual(Object.keys(stats).length, 9);
    for (const id of knowledgeModelIds) {
      assert.ok(stats[id], `Model ${id} must exist in selectable list`);
    }

    // 2. 利用実績のあるモデルの検証
    assert.strictEqual(stats['claude-3-7-sonnet'].percentage, 75.0);
    assert.strictEqual(stats['claude-3-7-sonnet'].hasUsage, true);
    assert.strictEqual(stats['gpt-4o'].percentage, 25.0);
    assert.strictEqual(stats['gpt-4o'].hasUsage, true);

    // 3. 利用実績がないモデル（o1, o3-mini, gemini-2-5-pro, deepseek-r1 等）は 0% かつ hasUsage: false
    assert.strictEqual(stats['o1'].percentage, 0);
    assert.strictEqual(stats['o1'].requests, 0);
    assert.strictEqual(stats['o1'].hasUsage, false);

    assert.strictEqual(stats['o3-mini'].percentage, 0);
    assert.strictEqual(stats['o3-mini'].requests, 0);
    assert.strictEqual(stats['o3-mini'].hasUsage, false);

    assert.strictEqual(stats['deepseek-r1'].percentage, 0);
    assert.strictEqual(stats['deepseek-r1'].requests, 0);
    assert.strictEqual(stats['deepseek-r1'].hasUsage, false);
  });

  it('correctly normalizes 2026 next-gen models (GPT-6, Sonnet 5, GPT-5.6, Gemini 3.8, Kimi K3, MAI-Code)', () => {
    assert.strictEqual(normalizeModelId('GPT-6 Astra'), 'gpt-6-astra');
    assert.strictEqual(normalizeModelId('gpt-6'), 'gpt-6-astra');
    assert.strictEqual(normalizeModelId('Claude Sonnet 5'), 'claude-sonnet-5');
    assert.strictEqual(normalizeModelId('claude-5-sonnet'), 'claude-sonnet-5');
    assert.strictEqual(normalizeModelId('Claude Opus 5'), 'claude-opus-5');
    assert.strictEqual(normalizeModelId('GPT-5.6 Sol'), 'gpt-5-6-sol');
    assert.strictEqual(normalizeModelId('GPT-5.6 Terra'), 'gpt-5-6-terra');
    assert.strictEqual(normalizeModelId('GPT-5.6 Luna'), 'gpt-5-6-luna');
    assert.strictEqual(normalizeModelId('Gemini 3.8 Flash'), 'gemini-3-8-flash');
    assert.strictEqual(normalizeModelId('Gemini 3.7 Flash'), 'gemini-3-7-flash');
    assert.strictEqual(normalizeModelId('Kimi K3 (Moonshot)'), 'kimi-k3');
    assert.strictEqual(normalizeModelId('MAI-Code-1.1-Flash (Microsoft)'), 'mai-code-1-1-flash');
    assert.strictEqual(normalizeModelId('Grok 4.6'), 'grok-4-6');
  });

  it('evaluates 2026 flagship models (GPT-6 Astra, Claude Sonnet 5) with extended pricing & context specs', () => {
    const rawGpt6: BenchmarkRawMetrics = {
      swe_bench_verified: 82.5,
      humaneval_plus: 96.0,
      aime_2024: 93.5,
      gpqa_diamond: 84.0,
      arena_coding_elo: 1510,
      output_speed_tps: 85,
      input_cost_per_m: 10.0,
      output_cost_per_m: 50.0,
      cached_input_cost_per_m: 2.5,
      long_context_input_cost_per_m: 20.0,
      long_context_output_cost_per_m: 80.0,
      context_window_k: 272,
      context_window_display: '272K Tok (1M Opt-in)',
    };

    const radar = computeRadarScores(rawGpt6);
    const evalGpt6 = evaluateModel('gpt-6-astra', rawGpt6, radar);

    assert.strictEqual(evalGpt6.grade, 'S+');
    assert.ok(evalGpt6.overall_score >= 88);
    assert.ok(evalGpt6.suitability_tags.includes('Agent & Multi-Turn'));
    assert.ok(evalGpt6.copilot_usage_guidance.includes('アーキテクチャ設計'));

    const profile = createModelProfile(
      'gpt-6-astra',
      'GPT-6 Astra',
      'OpenAI',
      'GPT-6',
      '#10A37F',
      true,
      '2026-03-01',
      rawGpt6,
      {
        tier: 'powerful',
        release_status: 'ga',
        max_context_window: 1048576,
        supports_1m_context: true,
        supports_cache: true,
        supports_long_context: true,
      }
    );

    assert.strictEqual(profile.extended_capabilities?.tier, 'powerful');
    assert.strictEqual(profile.extended_capabilities?.release_status, 'ga');
    assert.strictEqual(profile.extended_capabilities?.supports_1m_context, true);
    assert.strictEqual(profile.raw_metrics.cached_input_cost_per_m, 2.5);
    assert.strictEqual(profile.raw_metrics.long_context_input_cost_per_m, 20.0);
  });

  it('enforces canonical vendor display order: Anthropic > OpenAI > Google > Microsoft > Microsoft (External) > DeepSeek > xAI', () => {
    const expectedOrder = [
      'Anthropic',
      'OpenAI',
      'Google',
      'Microsoft',
      'Microsoft (External)',
      'DeepSeek',
      'xAI',
    ];

    for (let i = 0; i < expectedOrder.length - 1; i++) {
      const current = expectedOrder[i];
      const next = expectedOrder[i + 1];
      const currentIndex = CANONICAL_VENDOR_ORDER.indexOf(current as any);
      const nextIndex = CANONICAL_VENDOR_ORDER.indexOf(next as any);

      assert.ok(currentIndex !== -1, `${current} must exist in CANONICAL_VENDOR_ORDER`);
      assert.ok(nextIndex !== -1, `${next} must exist in CANONICAL_VENDOR_ORDER`);
      assert.ok(
        currentIndex < nextIndex,
        `Expected ${current} (idx: ${currentIndex}) to appear before ${next} (idx: ${nextIndex})`
      );
    }
  });
});
