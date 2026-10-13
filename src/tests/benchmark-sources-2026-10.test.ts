import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  DEFAULT_BENCHMARK_SOURCES,
  DEPRECATED_BENCHMARK_SOURCES_NOTE,
  RADAR_AXIS_DEFINITIONS,
  getModelBuzz,
} from '../processor/benchmark-definitions.js';
import { generateBenchmarkDataset, loadBenchmarkRecords, resolveEstimates } from '../../scripts/update-benchmarks.js';
import { BENCHMARK_SCORE_METRICS } from '../types/model-benchmark.js';
import { isEstimatedMetric } from '../../dashboard/src/components/radar/radar-utils.js';

// Verification record of Issue #321 (values read 2026-10-12 / 2026-10-13; null = not verifiable).
const VERIFIED_PATH = path.resolve(
  process.cwd(),
  '.devs/changes/2026-10-13_RadarBenchmarkSourcesRefresh/verified-benchmarks-2026-10.json'
);
const verified = JSON.parse(fs.readFileSync(VERIFIED_PATH, 'utf-8')).models as Record<
  string,
  Record<'terminal_bench_4' | 'aa_intelligence_index' | 'arena_webdev_elo', number | null>
>;

test('radar benchmark sources (2026-10, Issue #321)', async (t) => {
  const records = loadBenchmarkRecords();
  const dataset = generateBenchmarkDataset(undefined, new Date('2026-10-13T00:00:00Z'), records);

  await t.test('the stale sources are gone and the new ones carry concrete URLs and dates', () => {
    const ids = DEFAULT_BENCHMARK_SOURCES.map((s) => s.id);
    for (const old of ['swe-bench', 'lmsys-arena', 'frontier-papers']) {
      assert.ok(!ids.includes(old), `${old} must no longer be a radar source`);
    }
    const urls = DEFAULT_BENCHMARK_SOURCES.map((s) => s.url);
    assert.ok(!urls.some((u) => u.includes('arxiv.org') || u.includes('swebench.com') || u.includes('lmarena.ai')));
    const expected: Record<string, [string, string]> = {
      'terminal-bench-4': ['https://www.tbench.ai/leaderboard/terminal-bench/4.0', '2026-10-12'],
      'aa-intelligence-index': ['https://artificialanalysis.ai/leaderboards/models', '2026-10-13'],
      'arena-webdev': ['https://arena.ai/leaderboard/webdev', '2026-10-08'],
    };
    for (const [id, [url, date]] of Object.entries(expected)) {
      const src = DEFAULT_BENCHMARK_SOURCES.find((s) => s.id === id);
      assert.ok(src, `${id} must be a radar source`);
      assert.strictEqual(src.url, url);
      assert.ok(src.last_fetched_at.startsWith(date), `${id} last_fetched_at must be ${date}`);
    }
    // speed source is kept
    assert.ok(ids.includes('artificial-analysis'));
    assert.ok(DEPRECATED_BENCHMARK_SOURCES_NOTE.includes('https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/'));
    assert.strictEqual(dataset.sources_note, DEPRECATED_BENCHMARK_SOURCES_NOTE);
  });

  await t.test('axis definitions name the new sources', () => {
    const primary = Object.fromEntries(RADAR_AXIS_DEFINITIONS.map((a) => [a.key, a.primaryMetric]));
    assert.strictEqual(primary.coding_swe, 'Terminal-Bench 4.0');
    assert.strictEqual(primary.reasoning_logic, 'AA Intelligence Index v4.3');
    assert.strictEqual(primary.arena_elo, 'Arena WebDev Elo');
    const text = JSON.stringify(RADAR_AXIS_DEFINITIONS);
    assert.ok(!/SWE-bench|AIME|GPQA|HumanEval/.test(text), 'axis definitions must not cite the dropped benchmarks');
  });

  await t.test('records hold the verified values exactly and mark every other value as estimated', () => {
    assert.strictEqual(records.length, Object.keys(verified).length);
    for (const rec of records) {
      const v = verified[rec.id];
      assert.ok(v, `${rec.id} must be in the verification record`);
      for (const metric of BENCHMARK_SCORE_METRICS) {
        const value = v[metric as keyof typeof v];
        const estimated = (rec.estimated_metrics ?? []).includes(metric);
        if (value === null) {
          assert.ok(estimated, `${rec.id}.${metric} has no verified value and must be marked estimated`);
          assert.strictEqual(typeof rec.raw_metrics[metric as 'terminal_bench_4'], 'number');
        } else {
          assert.ok(!estimated, `${rec.id}.${metric} is verified and must not be marked estimated`);
          assert.strictEqual(rec.raw_metrics[metric as 'terminal_bench_4'], value, `${rec.id}.${metric}`);
        }
      }
      for (const old of ['swe_bench_verified', 'humaneval_plus', 'aime_2024', 'gpqa_diamond', 'arena_coding_elo']) {
        assert.ok(!(old in rec.raw_metrics), `${rec.id} must not keep ${old}`);
      }
    }
  });

  await t.test('the model-level flag is set exactly when every benchmark metric is estimated', () => {
    for (const m of dataset.models) {
      const all = BENCHMARK_SCORE_METRICS.every((k) => (m.estimated_metrics ?? []).includes(k));
      assert.strictEqual(!!m.is_estimated, all, m.id);
    }
    assert.ok(dataset.models.find((m) => m.id === 'gpt-4o')?.is_estimated);
    assert.ok(!dataset.models.find((m) => m.id === 'claude-opus-5-5')?.is_estimated);
  });

  await t.test('resolveEstimates keeps the legacy is_estimated flag meaning "all benchmark metrics"', () => {
    assert.deepStrictEqual(resolveEstimates({ is_estimated: true }), {
      estimated_metrics: [...BENCHMARK_SCORE_METRICS],
      is_estimated: true,
    });
    assert.deepStrictEqual(resolveEstimates({}), { is_estimated: false });
    assert.deepStrictEqual(resolveEstimates({ estimated_metrics: ['terminal_bench_4'] }), {
      estimated_metrics: ['terminal_bench_4'],
      is_estimated: false,
    });
  });

  await t.test('isEstimatedMetric reads per-metric lists and falls back to the model flag', () => {
    assert.ok(isEstimatedMetric({ estimated_metrics: ['arena_webdev_elo'] }, 'arena_webdev_elo'));
    assert.ok(!isEstimatedMetric({ estimated_metrics: ['arena_webdev_elo'] }, 'terminal_bench_4'));
    assert.ok(isEstimatedMetric({ is_estimated: true }, 'terminal_bench_4'));
    assert.ok(!isEstimatedMetric({ is_estimated: true }, 'output_speed_tps'));
    assert.ok(!isEstimatedMetric({}, 'terminal_bench_4'));
  });

  await t.test('buzz texts no longer cite SWE-bench percentages as fact', () => {
    for (const rec of records) {
      const buzz = getModelBuzz(rec.id, rec.vendor);
      const text = [buzz.headline, ...buzz.community_sentiments, buzz.caution_rumor].join(' ');
      assert.ok(!/SWE-bench\s*\d/.test(text), `${rec.id} buzz must not cite a SWE-bench score`);
    }
    for (const m of dataset.models) {
      const text = [...m.evaluation.recommended_for, ...m.evaluation.strengths, m.evaluation.summary_verdict].join(' ');
      assert.ok(!/SWE-bench/.test(text), `${m.id} evaluation must not cite SWE-bench`);
    }
  });
});
