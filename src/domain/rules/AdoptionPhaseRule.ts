import { AdoptionPhase } from '../entities/agent-metrics.js';

export interface UserAdoptionActivity {
  totalSuggestions: number;
  totalChats: number;
  totalAgentSessions: number;
  distinctAgentsUsed?: number;
  mcpInvocations?: number;
  overridePhase?: AdoptionPhase;
}

/**
 * GitHub Impact Dashboard Standard & Customizable Adoption Phase Rule.
 * Classifies users into: 'no_cohort' | 'code_first' | 'agent_first' | 'multi_agent'
 */
export class AdoptionPhaseRule {
  static classify(activity: UserAdoptionActivity): AdoptionPhase {
    // 1. User/Org custom override priority
    if (activity.overridePhase) {
      return activity.overridePhase;
    }

    const {
      totalSuggestions,
      totalChats,
      totalAgentSessions,
      distinctAgentsUsed = 0,
      mcpInvocations = 0,
    } = activity;

    // 2. Multi-Agent: Advanced workflow with multiple agents or MCP tools
    if (
      (totalAgentSessions >= 5 && distinctAgentsUsed >= 2) ||
      mcpInvocations > 0 ||
      (totalAgentSessions >= 10 && totalChats >= 20)
    ) {
      return 'multi_agent';
    }

    // 3. Agent-First: Primary workflow centered around Coding Agent or intensive Chat
    if (totalAgentSessions > 0 || totalChats >= 10) {
      return 'agent_first';
    }

    // 4. Code-First: Traditional code completion user
    if (totalSuggestions > 0) {
      return 'code_first';
    }

    // 5. No Cohort: No activity in evaluating window
    return 'no_cohort';
  }
}
