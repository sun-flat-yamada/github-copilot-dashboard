import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamDiagnosticPanel } from '../../dashboard/src/components/deep-analysis/TeamDiagnosticPanel.js';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';
import { UserUsageProfile } from '../types/copilot.js';

const member = (login: string): UserUsageProfile =>
  ({
    login,
    display_name: `Name ${login}`,
    cost_center: 'CC',
    plan_type: 'enterprise',
    daily_history: ['2026-09-08', '2026-09-09', '2026-09-10'].map((date) => ({
      date,
      total_chats: 4,
      model_breakdown: { 'gpt-4o': 4 },
      suggestions: 100,
      acceptances: 5,
      lines_suggested: 1,
      lines_accepted: 1,
      acceptance_rate: 0.05,
      daily_cost_usd: 0.1,
    })),
  }) as unknown as UserUsageProfile;

describe('TeamDiagnosticPanel (P3-4)', () => {
  it('shows the distribution table without any personal identifier', () => {
    const team = ['u1', 'u2', 'u3', 'u4', 'u5'].map(member);
    const html = renderToStaticMarkup(
      React.createElement(TeamDiagnosticPanel, { result: InefficiencyDiagnosticEngine.diagnoseTeam(team, '7d') })
    );
    assert.match(html, /data-testid="team-diagnostic-panel"/);
    assert.match(html, /<caption class="sr-only">/);
    assert.match(html, /team-pattern-tab_spamming_roulette/);
    assert.match(html, /確率ではなく/);
    assert.doesNotMatch(html, /u[1-5]\b|Name u/);
  });

  it('states why a small team is not diagnosed', () => {
    const team = ['u1', 'u2'].map(member);
    const html = renderToStaticMarkup(
      React.createElement(TeamDiagnosticPanel, { result: InefficiencyDiagnosticEngine.diagnoseTeam(team, '7d') })
    );
    assert.match(html, /team-diagnostic-insufficient/);
    assert.match(html, /5 人未満/);
    assert.doesNotMatch(html, /<table/);
  });
});
