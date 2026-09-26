import { ScopeAggregatedData } from '../../domain/entities/copilot.js';
import { AgentAdoptionResult } from '../../application/store/derived/nodes/agentAdoption.js';
import { AdoptionPhase } from '../../domain/entities/agent-metrics.js';

export interface StageDefinition {
  phase: AdoptionPhase;
  title: string;
  subtitle: string;
  description: string;
  badgeColor: string;
  count: number;
  percentage: number;
}

export interface AdoptionViewModel {
  hasData: boolean;
  totalEvaluatedUsers: number;
  stages: StageDefinition[];
  teamBreakdown: Array<{
    teamName: string;
    totalUsers: number;
    stages: Record<AdoptionPhase, number>;
  }>;
}

export interface AdoptionPresenterInput {
  currentData?: ScopeAggregatedData | null;
  agentAdoption?: AgentAdoptionResult | null;
}

export class AdoptionPresenter {
  public static present(input: AdoptionPresenterInput): AdoptionViewModel {
    const { currentData, agentAdoption } = input;
    const hasData = Boolean(agentAdoption || currentData?.adoption_distribution || (currentData?.users && currentData.users.length > 0));

    const dist = agentAdoption?.adoptionDistribution ?? currentData?.adoption_distribution?.users_in_phase_28d ?? {
      no_cohort: 0,
      code_first: 0,
      agent_first: 0,
      multi_agent: 0,
    };

    const totalEvaluated =
      (dist.no_cohort || 0) +
      (dist.code_first || 0) +
      (dist.agent_first || 0) +
      (dist.multi_agent || 0) || (currentData?.users?.length ?? 1);

    const safeTotal = Math.max(1, totalEvaluated);

    const stages: StageDefinition[] = [
      {
        phase: 'no_cohort',
        title: 'No Cohort (未活用)',
        subtitle: '評価期間中の活用実績なし',
        description: 'Copilotの利用が開始されていないか、過去28日間にアクティビティが検出されていないユーザー',
        badgeColor: 'slate',
        count: dist.no_cohort,
        percentage: Number(((dist.no_cohort / safeTotal) * 100).toFixed(1)),
      },
      {
        phase: 'code_first',
        title: 'Code First (コード補完中心)',
        subtitle: 'インライン補完の活用定着',
        description: 'Ghost text によるインライン補完を主体として活用し、日々のコーディング速度を向上させているステージ',
        badgeColor: 'blue',
        count: dist.code_first,
        percentage: Number(((dist.code_first / safeTotal) * 100).toFixed(1)),
      },
      {
        phase: 'agent_first',
        title: 'Agent First (対話・エージェント中心)',
        subtitle: 'Chat & Agent による課題解決',
        description: 'Copilot Chat や VS Code Agent を積極的に投入し、対話駆動でリファクタリングやデバッグを行うステージ',
        badgeColor: 'purple',
        count: dist.agent_first,
        percentage: Number(((dist.agent_first / safeTotal) * 100).toFixed(1)),
      },
      {
        phase: 'multi_agent',
        title: 'Multi-Agent (自律協調・マルチエージェント)',
        subtitle: 'MCP連携・カスタムエージェント自律委任',
        description: 'MCPツール連携や複数エージェントを組み合わせ、長時間の自律推論・タスク委任を実践している最高位ステージ',
        badgeColor: 'emerald',
        count: dist.multi_agent,
        percentage: Number(((dist.multi_agent / safeTotal) * 100).toFixed(1)),
      },
    ];

    const teamBreakdown: AdoptionViewModel['teamBreakdown'] = [];
    if (currentData?.by_department) {
      for (const [dept, summary] of Object.entries(currentData.by_department)) {
        const teamUsers = summary.total_seats || 1;
        teamBreakdown.push({
          teamName: dept,
          totalUsers: teamUsers,
          stages: {
            no_cohort: Math.round(teamUsers * (dist.no_cohort / safeTotal)),
            code_first: Math.round(teamUsers * (dist.code_first / safeTotal)),
            agent_first: Math.round(teamUsers * (dist.agent_first / safeTotal)),
            multi_agent: Math.round(teamUsers * (dist.multi_agent / safeTotal)),
          },
        });
      }
    }

    return {
      hasData,
      totalEvaluatedUsers: totalEvaluated,
      stages,
      teamBreakdown,
    };
  }
}
