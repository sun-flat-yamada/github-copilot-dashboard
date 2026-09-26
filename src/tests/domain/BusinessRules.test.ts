import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { SeatClassificationRule } from '../../domain/rules/SeatClassificationRule.js';
import { BudgetUtilizationRule } from '../../domain/rules/BudgetUtilizationRule.js';
import { AdoptionPhaseRule } from '../../domain/rules/AdoptionPhaseRule.js';
import { Money } from '../../domain/value-objects/Money.js';

describe('Domain Business Rules Tests', () => {
  describe('SeatClassificationRule', () => {
    it('classifies never_used when daysInactive >= daysSinceCreation >= 7', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 10,
        daysSinceCreation: 10,
      });
      assert.equal(status, 'never_used');
    });

    it('classifies idle when daysInactive > 30', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 35,
        daysSinceCreation: 100,
      });
      assert.equal(status, 'idle');
    });

    it('classifies idle when daysInactive > 14 and zero AI credits consumed', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 20,
        daysSinceCreation: 100,
        aiCreditsUsed28d: 0,
      });
      assert.equal(status, 'idle');
    });

    it('classifies low_active when 14 < daysInactive <= 30 with active credits', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 20,
        daysSinceCreation: 100,
        aiCreditsUsed28d: 50,
      });
      assert.equal(status, 'low_active');
    });

    it('classifies active when daysInactive <= 14', () => {
      const status = SeatClassificationRule.classify({
        daysInactive: 5,
        daysSinceCreation: 100,
      });
      assert.equal(status, 'active');
    });
  });

  describe('BudgetUtilizationRule', () => {
    it('evaluates normal utilization when under 80%', () => {
      const limit = new Money(1000);
      const free = new Money(100);
      const spend = new Money(500);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.netBillable.amount, 400);
      assert.equal(result.remaining.amount, 600);
      assert.equal(result.utilizationPercent, 40);
      assert.equal(result.status, 'normal');
    });

    it('evaluates warning utilization when between 80% and 99.9%', () => {
      const limit = new Money(1000);
      const free = new Money(0);
      const spend = new Money(850);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.netBillable.amount, 850);
      assert.equal(result.remaining.amount, 150);
      assert.equal(result.utilizationPercent, 85);
      assert.equal(result.status, 'warning');
    });

    it('evaluates exceeded utilization when 100% or greater', () => {
      const limit = new Money(1000);
      const free = new Money(0);
      const spend = new Money(1200);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.netBillable.amount, 1200);
      assert.equal(result.remaining.amount, 0);
      assert.equal(result.utilizationPercent, 120);
      assert.equal(result.status, 'exceeded');
    });

    it('handles zero limit safely without division by zero', () => {
      const limit = new Money(0);
      const free = new Money(0);
      const spend = new Money(100);

      const result = BudgetUtilizationRule.evaluate(limit, free, spend);
      assert.equal(result.utilizationPercent, 0);
      assert.equal(result.status, 'normal');
    });
  });

  describe('AdoptionPhaseRule', () => {
    it('respects explicit override phase unconditionally', () => {
      const phase = AdoptionPhaseRule.classify({
        totalSuggestions: 50,
        totalChats: 0,
        totalAgentSessions: 0,
        overridePhase: 'multi_agent',
      });
      assert.equal(phase, 'multi_agent');
    });

    it('identifies multi_agent for multi-agent workflows or MCP usage', () => {
      const phaseWithMcp = AdoptionPhaseRule.classify({
        totalSuggestions: 10,
        totalChats: 5,
        totalAgentSessions: 1,
        mcpInvocations: 2,
      });
      assert.equal(phaseWithMcp, 'multi_agent');

      const phaseWithMultipleAgents = AdoptionPhaseRule.classify({
        totalSuggestions: 20,
        totalChats: 10,
        totalAgentSessions: 6,
        distinctAgentsUsed: 2,
      });
      assert.equal(phaseWithMultipleAgents, 'multi_agent');
    });

    it('identifies agent_first when agent sessions or chat threshold met', () => {
      const phaseWithAgent = AdoptionPhaseRule.classify({
        totalSuggestions: 5,
        totalChats: 2,
        totalAgentSessions: 1,
      });
      assert.equal(phaseWithAgent, 'agent_first');

      const phaseWithChat = AdoptionPhaseRule.classify({
        totalSuggestions: 0,
        totalChats: 12,
        totalAgentSessions: 0,
      });
      assert.equal(phaseWithChat, 'agent_first');
    });

    it('identifies code_first for completions-only users', () => {
      const phase = AdoptionPhaseRule.classify({
        totalSuggestions: 30,
        totalChats: 2,
        totalAgentSessions: 0,
      });
      assert.equal(phase, 'code_first');
    });

    it('identifies no_cohort when zero activity', () => {
      const phase = AdoptionPhaseRule.classify({
        totalSuggestions: 0,
        totalChats: 0,
        totalAgentSessions: 0,
      });
      assert.equal(phase, 'no_cohort');
    });
  });
});
