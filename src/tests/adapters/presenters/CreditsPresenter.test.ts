import test from 'node:test';
import assert from 'node:assert';
import { CreditsPresenter } from '../../../adapters/presenters/CreditsPresenter.js';
import { CreditsAnalysisResult } from '../../../application/store/derived/nodes/creditsAnalysis.js';

test('CreditsPresenter: transforms analysis result into view model', () => {
  const analysis: CreditsAnalysisResult = {
    totalCreditsConsumed: 12500,
    totalCreditsCostUsd: 125.0,
    effectiveCreditRate: 0.01,
    currencySymbol: '$',
    currencyCode: 'USD',
    discountPercent: 0,
    byModel: {
      'claude-3-7-sonnet': { credits: 6000, costUsd: 60.0 },
      'o1': { credits: 4000, costUsd: 40.0 },
      'gpt-4o': { credits: 2500, costUsd: 25.0 },
    },
    byCostCenter: {
      'FinTech-Division': { credits: 8000, costUsd: 80.0, budgetStatus: 'normal' },
      'Cloud-Platform': { credits: 4500, costUsd: 45.0, budgetStatus: 'warning' },
    },
    topConsumers: [
      { login: 'kenji-sato', credits: 2500, costUsd: 25.0, department: 'SRE' },
      { login: 'taro-tanaka', credits: 1800, costUsd: 18.0, department: 'Payment' },
    ],
  };

  const vm = CreditsPresenter.present({
    creditsAnalysis: analysis,
    currentData: {
      overview: { total_spend_usd: 2500, total_seats: 50 },
    } as any,
  });

  assert.strictEqual(vm.hasData, true);
  assert.strictEqual(vm.currencySymbol, '$');
  assert.strictEqual(vm.effectiveRateFormatted, '$0.01 / AIC');
  assert.strictEqual(vm.totalCreditsUsed, 12500);
  assert.strictEqual(vm.totalCreditsCostUsd, 125.0);
  assert.strictEqual(vm.totalCombinedCostUsd, 2625.0);
  assert.strictEqual(vm.byModel.length, 3);
  assert.strictEqual(vm.byCostCenter.length, 2);
  assert.strictEqual(vm.topConsumers.length, 2);
  assert.strictEqual(vm.byModel[0].modelName, 'claude-3-7-sonnet');
  assert.strictEqual(vm.byModel[0].percentage, 48.0);
});

test('CreditsPresenter: handles empty input gracefully', () => {
  const vm = CreditsPresenter.present({});
  assert.strictEqual(vm.hasData, false);
  assert.strictEqual(vm.totalCreditsUsed, 0);
  assert.strictEqual(vm.totalCreditsCostUsd, 0);
  assert.strictEqual(vm.byModel.length, 0);
});
