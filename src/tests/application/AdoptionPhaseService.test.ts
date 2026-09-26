import test from 'node:test';
import assert from 'node:assert';
import { AdoptionPhaseService } from '../../application/services/AdoptionPhaseService.js';
import { UserUsageProfile } from '../../domain/entities/copilot.js';

test('AdoptionPhaseService: evaluateUser classifies users correctly', () => {
  // Multi-Agent user
  const multiAgentUser: Partial<UserUsageProfile> = {
    login: 'multi-dev',
    total_suggestions: 200,
    total_chats: 40,
    total_agent_sessions: 12,
  };
  assert.strictEqual(AdoptionPhaseService.evaluateUser(multiAgentUser as UserUsageProfile), 'multi_agent');

  // Agent-First user
  const agentFirstUser: Partial<UserUsageProfile> = {
    login: 'agent-dev',
    total_suggestions: 100,
    total_chats: 15,
    total_agent_sessions: 2,
  };
  assert.strictEqual(AdoptionPhaseService.evaluateUser(agentFirstUser as UserUsageProfile), 'agent_first');

  // Code-First user
  const codeFirstUser: Partial<UserUsageProfile> = {
    login: 'code-dev',
    total_suggestions: 50,
    total_chats: 2,
    total_agent_sessions: 0,
  };
  assert.strictEqual(AdoptionPhaseService.evaluateUser(codeFirstUser as UserUsageProfile), 'code_first');

  // No Cohort user
  const idleUser: Partial<UserUsageProfile> = {
    login: 'idle-dev',
    total_suggestions: 0,
    total_chats: 0,
    total_agent_sessions: 0,
  };
  assert.strictEqual(AdoptionPhaseService.evaluateUser(idleUser as UserUsageProfile), 'no_cohort');

  // Override phase priority
  assert.strictEqual(
    AdoptionPhaseService.evaluateUser(idleUser as UserUsageProfile, 'agent_first'),
    'agent_first'
  );
});

test('AdoptionPhaseService: calculateDistribution and calculateTeamDistribution', () => {
  const profiles: Partial<UserUsageProfile>[] = [
    { login: 'u1', department: 'Core', total_suggestions: 100, total_chats: 30, total_agent_sessions: 15 },
    { login: 'u2', department: 'Core', total_suggestions: 50, total_chats: 15, total_agent_sessions: 2 },
    { login: 'u3', department: 'Web', total_suggestions: 30, total_chats: 2, total_agent_sessions: 0 },
    { login: 'u4', department: 'Web', total_suggestions: 0, total_chats: 0, total_agent_sessions: 0 },
  ];

  const dist = AdoptionPhaseService.calculateDistribution(profiles as UserUsageProfile[]);
  assert.strictEqual(dist.total_evaluated_users, 4);
  assert.strictEqual(dist.users_in_phase_28d.multi_agent, 1);
  assert.strictEqual(dist.users_in_phase_28d.agent_first, 1);
  assert.strictEqual(dist.users_in_phase_28d.code_first, 1);
  assert.strictEqual(dist.users_in_phase_28d.no_cohort, 1);

  const teamDist = AdoptionPhaseService.calculateTeamDistribution(profiles as UserUsageProfile[]);
  assert.strictEqual(teamDist['Core'].total_evaluated_users, 2);
  assert.strictEqual(teamDist['Core'].users_in_phase_28d.multi_agent, 1);
  assert.strictEqual(teamDist['Core'].users_in_phase_28d.agent_first, 1);
  assert.strictEqual(teamDist['Web'].total_evaluated_users, 2);
  assert.strictEqual(teamDist['Web'].users_in_phase_28d.code_first, 1);
  assert.strictEqual(teamDist['Web'].users_in_phase_28d.no_cohort, 1);
});
