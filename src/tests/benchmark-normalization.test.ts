import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  buildNormalizationContext,
  computeRadarScores,
  computeOverallScore,
  percentileRank,
  normalizeModelId,
  isUnknownModelId,
  createModelProfile,
} from '../processor/benchmark-evaluator';
import { MODEL_CATALOG, resolveCatalogModelId } from '../processor/model-catalog';
import {
  computeContentHash,
  generateBenchmarkDataset,
  loadBenchmarkRecords,
} from '../../scripts/update-benchmarks';
import type { BenchmarkRawMetrics } from '../types/model-benchmark';

const records = loadBenchmarkRecords();

function raw(over: Partial<BenchmarkRawMetrics> = {}): BenchmarkRawMetrics {
  return {
    swe_bench_verified: 60,
    humaneval_plus: 90,
    aime_2024: 70,
    gpqa_diamond: 60,
    arena_coding_elo: 1350,
    output_speed_tps: 80,
    input_cost_per_m: 2,
    output_cost_per_m: 8,
    context_window_k: 200,
    ...over,
  };
}

describe('percentile normalisation (P3-7 / B-15)', () => {
  it('percentileRank uses the mid rank for ties and handles degenerate input', () => {
    assert.strictEqual(percentileRank([], 5), 0.5);
    assert.strictEqual(percentileRank([5], 5), 0.5);
    assert.strictEqual(percentileRank([1, 2, 3, 4], 4), 3.5 / 4);
    assert.strictEqual(percentileRank([1, 2, 3, 4], 1), 0.5 / 4);
    assert.strictEqual(percentileRank([1, 2, 2, 3], 2), 2 / 4);
  });

  it('keeps top models distinguishable where fixed anchors saturate', () => {
    const top = [78, 80, 82, 84, 86].map((swe) => raw({ swe_bench_verified: swe, aime_2024: 92 + swe / 100 }));
    const ctx = buildNormalizationContext(top);
    const legacy = top.map((r) => computeRadarScores(r).coding_swe);
    assert.strictEqual(new Set(legacy).size, 1, 'legacy anchor formula saturates (all equal)');
    const scores = top.map((r) => computeRadarScores(r, ctx).coding_swe);
    assert.strictEqual(new Set(scores).size, top.length, 'percentile scores differ per model');
    assert.deepStrictEqual([...scores].sort((a, b) => a - b), scores, 'order follows the raw SWE value');
  });

  it('is independent of axis/model input order and stays inside 20-99', () => {
    const list = records.map((r) => r.raw_metrics);
    const a = buildNormalizationContext(list);
    const b = buildNormalizationContext([...list].reverse());
    assert.deepStrictEqual(a, b);
    for (const r of list) {
      for (const v of Object.values(computeRadarScores(r, a))) {
        assert.ok(v >= 20 && v <= 99, `score ${v} out of range`);
      }
    }
  });

  it('rewards cheaper models on cost efficiency and larger context on architecture', () => {
    const ctx = buildNormalizationContext([raw({ input_cost_per_m: 1, output_cost_per_m: 2 }), raw({ input_cost_per_m: 10, output_cost_per_m: 40 })]);
    const cheap = computeRadarScores(raw({ input_cost_per_m: 1, output_cost_per_m: 2 }), ctx);
    const pricey = computeRadarScores(raw({ input_cost_per_m: 10, output_cost_per_m: 40 }), ctx);
    assert.ok(cheap.cost_efficiency > pricey.cost_efficiency);
  });

  it('the shipped dataset no longer ties the top GA models on coding / reasoning / Elo', () => {
    const dataset = generateBenchmarkDataset(undefined, new Date('2026-10-04T00:00:00Z'), records);
    assert.strictEqual(dataset.normalization_method, 'percentile-rank-v1');
    const ga = dataset.models.filter((m) => m.release_status === 'GA');
    for (const axis of ['coding_swe', 'reasoning_logic', 'arena_elo'] as const) {
      const sorted = ga.map((m) => ({ id: m.id, raw: m.raw_metrics, score: m.radar_scores[axis] }));
      const top = sorted.sort((a, b) => b.score - a.score).slice(0, 10);
      const distinct = new Set(top.map((t) => t.score)).size;
      assert.ok(distinct >= 9, `${axis}: top 10 GA models share ${10 - distinct + 1}+ identical scores`);
      assert.ok(Math.max(...sorted.map((s) => s.score)) < 100);
    }
    // the same raw metrics score the same; the overall ranking is not flat at the top
    const overall = dataset.models.map((m) => m.evaluation.overall_score).sort((a, b) => b - a);
    assert.ok(new Set(overall.slice(0, 10)).size >= 9);
    for (const m of dataset.models) {
      assert.strictEqual(m.evaluation.overall_score, computeOverallScore(m.radar_scores));
    }
  });

  it('createModelProfile without a context keeps the legacy behaviour', () => {
    const r = raw();
    const p = createModelProfile('x', 'X', 'Other', 'X', '#000', false, '2026-01-01', r);
    assert.deepStrictEqual(p.radar_scores, computeRadarScores(r));
  });
});

describe('model catalog (P3-7 / A-13)', () => {
  it('every dataset record id and name resolves to itself', () => {
    for (const r of records) {
      assert.strictEqual(resolveCatalogModelId(r.id), r.id, r.id);
      assert.strictEqual(resolveCatalogModelId(r.name), r.id, r.name);
    }
    assert.deepStrictEqual(
      MODEL_CATALOG.map((e) => e.id).sort(),
      records.map((r) => r.id).sort(),
      'catalog and benchmark records must list the same models'
    );
  });

  it('matches aliases exactly and never by substring', () => {
    assert.strictEqual(normalizeModelId('GPT-4o mini'), 'gpt-4o-mini');
    assert.strictEqual(normalizeModelId('claude-opus-4-8 (Fast Mode)'), 'claude-opus-4-8-fast');
    assert.strictEqual(normalizeModelId('claude-3-5-sonnet-20241022'), 'claude-3-5-sonnet');
    // unknown newer / different models must not fall into an existing id
    for (const unknown of ['GPT-6 Nova', 'gpt-6-mini', 'claude-opus-9', 'gemini-9-ultra', 'grok-9', 'o1-preview-x', 'o3-pro']) {
      const id = normalizeModelId(unknown);
      assert.ok(isUnknownModelId(id), `${unknown} -> ${id}`);
      assert.strictEqual(id, `unknown:${unknown.toLowerCase()}`);
    }
  });
});

describe('content-hash dataset version (P3-7 / B-15)', () => {
  const d1 = new Date('2026-10-04T01:00:00Z');
  const d2 = new Date('2026-10-04T09:00:00Z');

  it('the hash depends on content only and is stable', () => {
    assert.strictEqual(computeContentHash(records), computeContentHash(JSON.parse(JSON.stringify(records))));
    assert.match(computeContentHash(records), /^[0-9a-f]{16}$/);
    const changed = JSON.parse(JSON.stringify(records));
    changed[0].raw_metrics.swe_bench_verified += 0.1;
    assert.notStrictEqual(computeContentHash(changed), computeContentHash(records));
  });

  it('keeps the version and timestamp when the content is unchanged', () => {
    const first = generateBenchmarkDataset(undefined, d1, records);
    const again = generateBenchmarkDataset(
      { version: first.version, content_hash: first.content_hash, last_updated: first.last_updated },
      d2,
      records
    );
    assert.strictEqual(again.version, first.version);
    assert.strictEqual(again.last_updated, first.last_updated);
  });

  it('advances the version only when the content changes', () => {
    const first = generateBenchmarkDataset(undefined, d1, records);
    const changed = JSON.parse(JSON.stringify(records));
    changed[0].raw_metrics.swe_bench_verified += 0.1;
    const next = generateBenchmarkDataset(
      { version: first.version, content_hash: first.content_hash, last_updated: first.last_updated },
      d2,
      changed
    );
    assert.notStrictEqual(next.version, first.version);
    assert.strictEqual(next.version, '2026-10-04-0002');
    assert.notStrictEqual(next.content_hash, first.content_hash);
  });

  it('a legacy file without content_hash gets a version bump once (migration)', () => {
    const next = generateBenchmarkDataset({ version: '2026-10-04-0003', last_updated: d1.toISOString() }, d2, records);
    assert.strictEqual(next.version, '2026-10-04-0004');
  });
});
