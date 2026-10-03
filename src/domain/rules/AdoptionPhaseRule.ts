import { AdoptionInputs, AdoptionPhase } from '../entities/agent-metrics.js';

/**
 * Adoption maturity rule v2 (SDD-11 §8).
 *
 * The phase of a user is derived from measured usage days inside a fixed window (the last 28 days ending at the
 * organization's latest data day), never from proxy values. The thresholds are uncalibrated heuristics and are
 * declared in one place (`ADOPTION_RULE_V2`) so that the screen and the specification show exactly what was applied.
 */
export const ADOPTION_RULE_V2 = {
  version: 2,
  /** Length of the evaluation window in days (ends at the latest day of the collected data) */
  windowDays: 28,
  /** Minimum number of window days covered by the collected data. Below it nobody is classified */
  minObservedDays: 7,
  /** Agent First: days with agent usage */
  agentFirstAgentDays: 3,
  /** Agent First: days with chat usage (chat-centered workflow) */
  agentFirstChatDays: 8,
  /** Multi-Agent: days with agent usage (sustained) */
  multiAgentAgentDays: 8,
  /** Multi-Agent: minimum number of distinct surfaces used in the window (completion / chat / agent / cli) */
  multiAgentSurfaces: 3,
  /** Minimum number of classified members before a team distribution is shown (k-anonymity) */
  minTeamSize: 5,
} as const;

export interface UserAdoptionActivity extends AdoptionInputs {
  overridePhase?: AdoptionPhase;
}

export type AdoptionEvaluation =
  | { status: 'classified'; phase: AdoptionPhase; basis: string }
  | { status: 'insufficient'; reason: string };

export class AdoptionPhaseRule {
  static evaluate(activity: UserAdoptionActivity): AdoptionEvaluation {
    const rule = ADOPTION_RULE_V2;

    // 1. Explicit override (administrator-defined mapping)
    if (activity.overridePhase) {
      return { status: 'classified', phase: activity.overridePhase, basis: '管理者が指定した値' };
    }

    // 2. Data sufficiency: the window must be covered well enough to call "no activity" a measurement
    if (activity.observedDays < rule.minObservedDays) {
      return {
        status: 'insufficient',
        reason: `観測日数が ${rule.minObservedDays} 日未満 (${activity.observedDays} 日) のため判定しません`,
      };
    }

    if (activity.activeDays <= 0) {
      return { status: 'classified', phase: 'no_cohort', basis: `直近 ${activity.windowDays} 日に利用なし` };
    }

    const { agentDays, chatDays } = activity;
    const chatCentered = chatDays >= rule.agentFirstChatDays;

    // 3. The agent flag is not in the data: only a positive chat-based result is valid; anything lower could
    //    hide agent usage, so it is not classified
    if (agentDays === null) {
      if (chatCentered) {
        return { status: 'classified', phase: 'agent_first', basis: `チャット利用 ${chatDays} 日 (Agent 利用フラグなし)` };
      }
      return { status: 'insufficient', reason: 'Agent 利用フラグが取得できず、Agent 利用の有無を判別できないため判定しません' };
    }

    const surfaces =
      (activity.completionDays > 0 ? 1 : 0) + (chatDays > 0 ? 1 : 0) + (agentDays > 0 ? 1 : 0) + (activity.cliDays > 0 ? 1 : 0);

    // 4. Multi-Agent: sustained agent usage across several surfaces
    if (agentDays >= rule.multiAgentAgentDays && surfaces >= rule.multiAgentSurfaces) {
      return { status: 'classified', phase: 'multi_agent', basis: `Agent ${agentDays} 日・${surfaces} サーフェス` };
    }

    // 5. Agent-First: recurring agent usage or a chat-centered workflow
    if (agentDays >= rule.agentFirstAgentDays || chatCentered) {
      return { status: 'classified', phase: 'agent_first', basis: `Agent ${agentDays} 日・チャット ${chatDays} 日` };
    }

    // 6. Code-First: some usage that does not reach the Agent First criteria (includes completion-centered use)
    return { status: 'classified', phase: 'code_first', basis: `利用 ${activity.activeDays} 日 (Agent / チャット基準未満)` };
  }
}
