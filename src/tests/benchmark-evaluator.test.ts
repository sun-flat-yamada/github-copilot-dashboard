import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeRadarScores,
  evaluateModel,
  createModelProfile,
  RADAR_AXIS_DEFINITIONS,
  DEFAULT_BENCHMARK_SOURCES,
} from '../processor/benchmark-evaluator';
import { BenchmarkRawMetrics } from '../types/model-benchmark';

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
});
