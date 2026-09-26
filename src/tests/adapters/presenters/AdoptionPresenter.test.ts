import test from 'node:test';
import assert from 'node:assert';
import { AdoptionPresenter } from '../../../adapters/presenters/AdoptionPresenter.js';
import { AgentAdoptionResult } from '../../../application/store/derived/nodes/agentAdoption.js';

test('AdoptionPresenter: transforms adoption distribution into view model', () => {
  const result: AgentAdoptionResult = {
    totalSessions: 500,
    totalMessages: 1500,
    engagedUsers: 50,
    adoptionRate: 0.65,
    adoptionDistribution: {
      no_cohort: 8,
      code_first: 32,
      agent_first: 24,
      multi_agent: 16,
    },
    topAgents: [],
    topMcps: [],
    topSkills: [],
    topSlashCommands: [],
    prMetrics: { prsCreatedByAgent: 0, prsMergedByAgent: 0, medianMergeHours: 4.5 },
    byTeam: {},
  };

  const vm = AdoptionPresenter.present({
    agentAdoption: result,
  });

  assert.strictEqual(vm.hasData, true);
  assert.strictEqual(vm.totalEvaluatedUsers, 80);
  assert.strictEqual(vm.stages.length, 4);

  const codeFirst = vm.stages.find((s) => s.phase === 'code_first');
  assert.ok(codeFirst);
  assert.strictEqual(codeFirst?.count, 32);
  assert.strictEqual(codeFirst?.percentage, 40.0);

  const multiAgent = vm.stages.find((s) => s.phase === 'multi_agent');
  assert.ok(multiAgent);
  assert.strictEqual(multiAgent?.count, 16);
  assert.strictEqual(multiAgent?.percentage, 20.0);
});

test('AdoptionPresenter: handles empty input gracefully', () => {
  const vm = AdoptionPresenter.present({});
  assert.strictEqual(vm.hasData, false);
  assert.strictEqual(vm.stages.length, 4);
});
