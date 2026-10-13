/**
 * Benchmark Ingestion & Evaluation Script
 * Updates dashboard/public/data/model-benchmarks.json from prominent latest benchmarks
 * Complete coverage conforming to:
 * - https://docs.github.com/ja/copilot/reference/ai-models/supported-models
 * - https://docs.github.com/ja/copilot/reference/copilot-billing/models-and-pricing
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  buildNormalizationContext,
  createModelProfile,
  NORMALIZATION_METHOD,
  DEFAULT_BENCHMARK_SOURCES,
  RADAR_AXIS_DEFINITIONS,
} from '../src/processor/benchmark-evaluator';
import { getNextRadarVersion } from '../src/processor/radar-version';
import { DEPRECATED_BENCHMARK_SOURCES_NOTE } from '../src/processor/benchmark-definitions';
import {
  BENCHMARK_SCORE_METRICS,
  BenchmarkDataset,
  BenchmarkMetricKey,
  BenchmarkRawMetrics,
  ModelBenchmarkProfile,
  ModelExtendedCapabilities,
  ModelReleaseStatus,
  ModelVendor,
} from '../src/types/model-benchmark';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RawModelEntry {
  id: string;
  name: string;
  vendor: ModelVendor;
  model_family: string;
  color: string;
  is_copilot_native: boolean;
  release_date: string;
  release_status: ModelReleaseStatus;
  /**
   * Legacy flag: true when no score metric has a verified source. Treated as "every benchmark score metric is
   * estimated" when `estimated_metrics` is absent.
   */
  is_estimated?: boolean;
  /** Raw metrics whose value is an estimate (no verified source); shown as 推測値 next to each value. */
  estimated_metrics?: BenchmarkMetricKey[];
  capabilities?: ModelExtendedCapabilities;
  raw_metrics: BenchmarkRawMetrics;
}

/**
 * Benchmark records are externalized as JSON data (P3-7 / B-15):
 * scripts/benchmark-data/benchmark-records.json (2026.10 dataset).
 * Sources: GitHub Official Docs, Terminal-Bench 4.0, Artificial Analysis Intelligence Index v4.3,
 * Arena (Code Arena | WebDev), Artificial Analysis (speed) and official pricing.
 */
export const BENCHMARK_RECORDS_PATH = path.resolve(__dirname, 'benchmark-data/benchmark-records.json');

export function loadBenchmarkRecords(file: string = BENCHMARK_RECORDS_PATH): RawModelEntry[] {
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as RawModelEntry[];
}

/**
 * Content hash of everything that determines the dataset: the records (JSON data), the axis definitions
 * and the normalisation method. Independent of dates and build counts (B-15).
 */
export function computeContentHash(records: RawModelEntry[]): string {
  const canonical = JSON.stringify({
    normalization: NORMALIZATION_METHOD,
    axes: RADAR_AXIS_DEFINITIONS,
    records,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Resolve the per-metric estimate list and the model-level flag of a record.
 * - `estimated_metrics` wins when present; a legacy `is_estimated: true` means every benchmark score metric.
 * - The model-level `is_estimated` is true when every benchmark score metric is estimated.
 */
export function resolveEstimates(rec: Pick<RawModelEntry, 'is_estimated' | 'estimated_metrics'>): {
  estimated_metrics?: BenchmarkMetricKey[];
  is_estimated: boolean;
} {
  const list = rec.estimated_metrics ?? (rec.is_estimated ? [...BENCHMARK_SCORE_METRICS] : []);
  const unique = [...new Set(list)];
  const is_estimated = BENCHMARK_SCORE_METRICS.every((k) => unique.includes(k));
  return unique.length > 0 ? { estimated_metrics: unique, is_estimated } : { is_estimated };
}

export interface ExistingDatasetInfo {
  version?: string;
  content_hash?: string;
  last_updated?: string;
}

export function generateBenchmarkDataset(
  existing?: ExistingDatasetInfo | string,
  date: Date = new Date(),
  records: RawModelEntry[] = loadBenchmarkRecords()
): BenchmarkDataset {
  const prev: ExistingDatasetInfo = typeof existing === 'string' ? { version: existing } : existing ?? {};
  const normalization = buildNormalizationContext(records.map((r) => r.raw_metrics));
  const models: ModelBenchmarkProfile[] = records.map((rec) => {
    const profile = createModelProfile(
      rec.id,
      rec.name,
      rec.vendor,
      rec.model_family,
      rec.color,
      rec.is_copilot_native,
      rec.release_date,
      rec.raw_metrics,
      rec.release_status,
      rec.capabilities,
      undefined,
      normalization
    );
    const { estimated_metrics, is_estimated } = resolveEstimates(rec);
    return {
      ...profile,
      ...(is_estimated ? { is_estimated: true } : {}),
      ...(estimated_metrics ? { estimated_metrics } : {}),
    };
  });

  const content_hash = computeContentHash(records);
  // Same content -> same version and timestamp. The version only advances when the content changes.
  const unchanged = prev.content_hash === content_hash && !!prev.version && !!prev.last_updated;
  const version = unchanged ? (prev.version as string) : getNextRadarVersion(prev.version, date);
  const last_updated = unchanged ? (prev.last_updated as string) : date.toISOString();

  return {
    version,
    content_hash,
    normalization_method: NORMALIZATION_METHOD,
    last_updated,
    sources: DEFAULT_BENCHMARK_SOURCES,
    sources_note: DEPRECATED_BENCHMARK_SOURCES_NOTE,
    axis_definitions: RADAR_AXIS_DEFINITIONS,
    models,
  };
}

export function runBenchmarkUpdate(): void {
  console.log('🔄 Starting Notable AI Model Benchmark Ingestion & Evaluation...');

  const outputPath = path.resolve(__dirname, '../dashboard/public/data/model-benchmarks.json');
  let existing: ExistingDatasetInfo | undefined;

  if (fs.existsSync(outputPath)) {
    try {
      const existingData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      existing = {
        version: existingData.version,
        content_hash: existingData.content_hash,
        last_updated: existingData.last_updated,
      };
    } catch {
      // Ignore parse failure and fall back to default
    }
  }

  const dataset = generateBenchmarkDataset(existing);

  // Ensure directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2), 'utf-8');

  console.log(`✅ Benchmark dataset generated successfully at: ${outputPath}`);
  console.log(`📊 Models evaluated (${dataset.models.length}):`);

  for (const m of dataset.models) {
    console.log(
      `  • [${m.evaluation.grade}] ${m.name.padEnd(32)} | Tier: ${(m.capabilities?.tier || 'N/A').padEnd(11)} | Status: ${(m.release_status || 'GA').padEnd(7)} | In: $${m.raw_metrics.input_cost_per_m.toFixed(2)} | Out: $${m.raw_metrics.output_cost_per_m.toFixed(2)} | Ctx: ${m.raw_metrics.context_window_display || m.raw_metrics.context_window_k + 'K'}`
    );
  }
}

// Execute if run via CLI directly
if (process.argv[1] && process.argv[1].includes('update-benchmarks')) {
  runBenchmarkUpdate();
}
