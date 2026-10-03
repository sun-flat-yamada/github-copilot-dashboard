// Result shapes consumed by the Agent / Adoption / Credits presenters.

export interface AgentAdoptionResult {
  totalSessions: number;
  totalMessages: number;
  engagedUsers: number;
  adoptionRate: number; // 0.0 - 1.0
  adoptionDistribution: {
    no_cohort: number;
    code_first: number;
    agent_first: number;
    multi_agent: number;
  };
  topAgents: Array<{ name: string; sessions: number; users: number }>;
  topMcps: Array<{ name: string; calls: number }>;
  topSkills: Array<{ name: string; count: number }>;
  topSlashCommands: Array<{ name: string; count: number }>;
  prMetrics: {
    prsCreatedByAgent: number;
    prsMergedByAgent: number;
    medianMergeHours: number;
  };
  byTeam: Record<string, { sessions: number; engagedUsers: number; adoptionRate: number }>;
}

export interface CreditsAnalysisResult {
  totalCreditsConsumed: number;
  totalCreditsCostUsd: number;
  effectiveCreditRate: number;
  currencySymbol: string;
  currencyCode: string;
  discountPercent: number;
  byModel: Record<string, { credits: number; costUsd: number }>;
  byCostCenter: Record<string, { credits: number; costUsd: number; budgetStatus?: string }>;
  topConsumers: Array<{ login: string; credits: number; costUsd: number; department?: string; costCenter?: string }>;
}
