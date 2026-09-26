import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ModelRadarPresenter } from '../../../adapters/presenters/ModelRadarPresenter.js';
import { BenchmarkDataset } from '../../../domain/entities/model-benchmark.js';
import { ScopeAggregatedData } from '../../../domain/entities/copilot.js';

describe('ModelRadarPresenter Tests', () => {
  it('handles empty benchmark data', () => {
    const vm = ModelRadarPresenter.present({ benchmarkData: null });
    assert.strictEqual(vm.hasData, false);
    assert.strictEqual(vm.availableModels.length, 0);
    assert.strictEqual(vm.radarChartData.length, 0);
  });

  it('selects top used models from scope data and builds radar chart rows', () => {
    const mockDataset: BenchmarkDataset = {
      version: '2026-09-01',
      last_updated: '2026-09-01',
      sources: [],
      axis_definitions: [
        {
          key: 'coding_swe',
          label: 'SWE Bench Coding',
          shortLabel: 'Coding',
          description: 'SWE bench benchmark',
          primaryMetric: 'swe_bench',
          weight: 1,
        },
        {
          key: 'speed_latency',
          label: 'Speed & Latency',
          shortLabel: 'Speed',
          description: 'Tokens per second',
          primaryMetric: 'speed',
          weight: 1,
        },
      ],
      models: [
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet',
          vendor: 'Anthropic',
          model_family: 'Claude',
          color: '#d97706',
          is_copilot_native: true,
          release_date: '2025-02',
          raw_metrics: {} as any,
          radar_scores: {
            coding_swe: 92,
            reasoning_logic: 90,
            arena_elo: 88,
            speed_latency: 75,
            cost_efficiency: 70,
            architecture_design: 90,
          },
          evaluation: {
            overall_score: 90,
            grade: 'S',
            suitability_tags: ['High-Precision Coding'],
            recommended_for: ['Complex backend'],
            strengths: ['Architecture reasoning'],
            weaknesses: [],
            summary_verdict: 'Top Tier',
            copilot_usage_guidance: 'Default choice',
          },
        },
        {
          id: 'gpt-4o',
          name: 'GPT-4o',
          vendor: 'OpenAI',
          model_family: 'GPT',
          color: '#10b981',
          is_copilot_native: true,
          release_date: '2024-05',
          raw_metrics: {} as any,
          radar_scores: {
            coding_swe: 85,
            reasoning_logic: 84,
            arena_elo: 86,
            speed_latency: 90,
            cost_efficiency: 80,
            architecture_design: 82,
          },
          evaluation: {
            overall_score: 85,
            grade: 'A+',
            suitability_tags: ['Fast Inline Suggestion'],
            recommended_for: ['Daily scripting'],
            strengths: ['High speed'],
            weaknesses: [],
            summary_verdict: 'Fast and versatile',
            copilot_usage_guidance: 'Secondary choice',
          },
        },
      ],
    };

    const mockScopeData: Partial<ScopeAggregatedData> = {
      user_profiles: [
        {
          login: 'dev1',
          model_usage_totals: {
            'claude-3-7-sonnet': 50,
            'gpt-4o': 10,
          },
        } as any,
      ],
    };

    const vm = ModelRadarPresenter.present({
      benchmarkData: mockDataset,
      currentData: mockScopeData as ScopeAggregatedData,
    });

    assert.strictEqual(vm.hasData, true);
    assert.strictEqual(vm.availableModels.length, 2);
    assert.strictEqual(vm.topUsedModels[0], 'claude-3-7-sonnet');
    assert.strictEqual(vm.axes.length, 2);

    // Radar chart data should have 2 rows (one for each axis)
    assert.strictEqual(vm.radarChartData.length, 2);
    assert.strictEqual(vm.radarChartData[0].axis, 'Coding');
    assert.strictEqual(vm.radarChartData[0]['claude-3-7-sonnet'], 92);
    assert.strictEqual(vm.radarChartData[0]['gpt-4o'], 85);

    assert.strictEqual(vm.radarChartData[1].axis, 'Speed');
    assert.strictEqual(vm.radarChartData[1]['claude-3-7-sonnet'], 75);
    assert.strictEqual(vm.radarChartData[1]['gpt-4o'], 90);

    // Model summaries
    assert.strictEqual(vm.modelSummaries.length, 2);
    assert.strictEqual(vm.modelSummaries[0].id, 'claude-3-7-sonnet');
    assert.strictEqual(vm.modelSummaries[0].overallScore, 90);
  });
});
