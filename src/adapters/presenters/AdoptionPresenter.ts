import { ScopeAggregatedData } from '../../domain/entities/copilot.js';
import { AgentAdoptionResult } from '../../domain/entities/analysis-results.js';
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
    // 採用成熟度は、ユーザー別の実測 (チャット・エージェント利用) から導出した分布が無ければ判定できない。
    // シート数だけがある状態 (旧: 全員が 0 件のステージ表示) では「データなし」とする。
    const hasData = Boolean(agentAdoption || currentData?.adoption_distribution);

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

    // チーム別の内訳は、実際のユーザー別プロファイル (採用フェーズ) をチームごとに集計する。
    // 旧実装は「全社の比率 × チーム人数」で按分しており、全チームが同じ分布になっていた。
    const teamBreakdown: AdoptionViewModel['teamBreakdown'] = [];
    const teamStages = new Map<string, Record<AdoptionPhase, number>>();
    for (const profile of currentData?.user_profiles ?? []) {
      const team = profile.department || '未設定';
      let stagesForTeam = teamStages.get(team);
      if (!stagesForTeam) {
        stagesForTeam = { no_cohort: 0, code_first: 0, agent_first: 0, multi_agent: 0 };
        teamStages.set(team, stagesForTeam);
      }
      const phase: AdoptionPhase = profile.ai_adoption_phase ?? 'no_cohort';
      stagesForTeam[phase] += 1;
    }
    for (const [teamName, stagesForTeam] of teamStages) {
      teamBreakdown.push({
        teamName,
        totalUsers: Object.values(stagesForTeam).reduce((sum, n) => sum + n, 0),
        stages: stagesForTeam,
      });
    }

    return {
      hasData,
      totalEvaluatedUsers: totalEvaluated,
      stages,
      teamBreakdown,
    };
  }
}
