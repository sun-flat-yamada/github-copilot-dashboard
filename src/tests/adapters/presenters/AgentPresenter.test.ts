import test from 'node:test';
import assert from 'node:assert';
import { AgentPresenter } from '../../../adapters/presenters/AgentPresenter.js';
import { AgentAdoptionResult } from '../../../application/store/derived/nodes/agentAdoption.js';

test('AgentPresenter: transforms agent adoption result into view model', () => {
  const result: AgentAdoptionResult = {
    totalSessions: 450,
    totalMessages: 1350,
    engagedUsers: 38,
    adoptionRate: 0.55,
    adoptionDistribution: {
      no_cohort: 5,
      code_first: 20,
      agent_first: 15,
      multi_agent: 10,
    },
    topAgents: [
      { name: 'workspace', sessions: 250, users: 30 },
      { name: 'terminal', sessions: 120, users: 20 },
      { name: 'fintech-reviewer', sessions: 80, users: 15 },
    ],
    topMcps: [
      { name: 'postgres-context', calls: 95 },
      { name: 'github-ops', calls: 80 },
    ],
    topSkills: [
      { name: 'test-generator', count: 60 },
    ],
    topSlashCommands: [
      { name: '/explain', count: 180 },
    ],
    prMetrics: {
      prsCreatedByAgent: 25,
      prsMergedByAgent: 20,
      medianMergeHours: 3.8,
    },
    byTeam: {
      'Payment': { sessions: 200, engagedUsers: 18, adoptionRate: 0.60 },
      'Core': { sessions: 150, engagedUsers: 12, adoptionRate: 0.50 },
    },
  };

  const vm = AgentPresenter.present({
    agentAdoption: result,
  });

  assert.strictEqual(vm.hasData, true);
  assert.strictEqual(vm.totalSessions, 450);
  assert.strictEqual(vm.totalMessages, 1350);
  assert.strictEqual(vm.engagedUsers, 38);
  assert.strictEqual(vm.adoptionRateFormatted, '55.0%');
  assert.strictEqual(vm.topAgents.length, 3);
  assert.strictEqual(vm.topMcps.length, 2);
  assert.strictEqual(vm.teams.length, 2);
  assert.strictEqual(vm.prMetrics.prsCreatedByAgent, 25);
});

test('AgentPresenter: handles empty input gracefully', () => {
  const vm = AgentPresenter.present({});
  assert.strictEqual(vm.hasData, false);
  assert.strictEqual(vm.totalSessions, 0);
  assert.strictEqual(vm.totalMessages, 0);
  assert.strictEqual(vm.topAgents.length, 0);
});
