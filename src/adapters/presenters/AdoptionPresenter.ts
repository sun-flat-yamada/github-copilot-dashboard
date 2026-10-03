import { ScopeAggregatedData } from '../../domain/entities/copilot.js';
import { AgentAdoptionResult } from '../../domain/entities/analysis-results.js';
import { AdoptionPhase } from '../../domain/entities/agent-metrics.js';
import { ADOPTION_RULE_V2 } from '../../domain/rules/AdoptionPhaseRule.js';

/** Label of the merged row that holds every team smaller than the minimum team size (k) */
export const SMALL_TEAMS_LABEL = '少人数チーム (合算)';

export interface StageDefinition {
  phase: AdoptionPhase;
  title: string;
  subtitle: string;
  description: string;
  badgeColor: string;
  count: number;
  percentage: number;
}

export interface TeamBreakdownRow {
  teamName: string;
  /** Classified members (the real head count the distribution is built from) */
  totalUsers: number;
  /** Members who could not be classified (insufficient data) */
  unclassifiedUsers: number;
  stages: Record<AdoptionPhase, number>;
  /** True for the merged row of teams smaller than k */
  aggregated?: boolean;
  /** Number of teams merged into an aggregated row */
  teamCount?: number;
  /** True when the distribution is withheld because fewer than k members would be identifiable */
  suppressed?: boolean;
  suppressedReason?: string;
}

export interface AdoptionRuleSummary {
  version: number;
  windowDays: number;
  minTeamSize: number;
  /** Human-readable criteria applied (rule v2) */
  criteria: string[];
}

export interface AdoptionViewModel {
  hasData: boolean;
  /** Classified users (denominator of every rate on the screen) */
  totalEvaluatedUsers: number;
  /** Users not classified because the data is insufficient (not counted in any stage) */
  unclassifiedUsers: number;
  /** Distinct reasons users were not classified */
  unclassifiedReasons: string[];
  stages: StageDefinition[];
  teamBreakdown: TeamBreakdownRow[];
  rule: AdoptionRuleSummary;
}

const emptyStages = (): Record<AdoptionPhase, number> => ({ no_cohort: 0, code_first: 0, agent_first: 0, multi_agent: 0 });

export function describeAdoptionRule(): AdoptionRuleSummary {
  const r = ADOPTION_RULE_V2;
  return {
    version: r.version,
    windowDays: r.windowDays,
    minTeamSize: r.minTeamSize,
    criteria: [
      `評価窓: 収集データの最新日を終端とする直近 ${r.windowDays} 日。窓の観測日数が ${r.minObservedDays} 日未満なら判定しない`,
      `Multi-Agent: Agent 利用 ${r.multiAgentAgentDays} 日以上、かつ ${r.multiAgentSurfaces} 種類以上のサーフェス (補完・チャット・Agent・CLI) を利用`,
      `Agent First: Agent 利用 ${r.agentFirstAgentDays} 日以上、またはチャット利用 ${r.agentFirstChatDays} 日以上`,
      'Code First: 利用はあるが Agent First の基準に満たない (補完中心を含む)',
      `No Cohort: 窓内に利用なし (観測日数が足りている場合のみ)`,
      'Agent 利用フラグが無いデータでは、チャット基準を満たす場合のみ判定し、それ以外は判定不能とする',
      `チーム別: 判定済みの実人数で集計し、${r.minTeamSize} 人未満のチームは「${SMALL_TEAMS_LABEL}」に集約する`,
    ],
  };
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

    // 評価対象は判定済みユーザーのみ。シート数などで代用しない
    const totalEvaluated =
      (dist.no_cohort || 0) + (dist.code_first || 0) + (dist.agent_first || 0) + (dist.multi_agent || 0);
    const unclassifiedUsers = currentData?.adoption_distribution?.unclassified_users ?? 0;

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

    // チーム別の内訳は、判定済みの実人数をチームごとに集計する (旧: 全社比率 × チーム人数の按分)。
    // 判定済みが k (ADOPTION_RULE_V2.minTeamSize) 人未満のチームは個人が特定され得るため、1 行に合算する。
    // 合算でも k 人に満たなければ分布を出さず、理由だけを表示する。
    const k = ADOPTION_RULE_V2.minTeamSize;
    const teams = new Map<string, { stages: Record<AdoptionPhase, number>; classified: number; unclassified: number }>();
    const reasons = new Set<string>();
    for (const profile of currentData?.user_profiles ?? []) {
      const team = profile.department || '未設定';
      let t = teams.get(team);
      if (!t) {
        t = { stages: emptyStages(), classified: 0, unclassified: 0 };
        teams.set(team, t);
      }
      if (profile.ai_adoption_phase) {
        t.stages[profile.ai_adoption_phase] += 1;
        t.classified += 1;
      } else {
        t.unclassified += 1;
        if (profile.adoption_unclassified_reason) reasons.add(profile.adoption_unclassified_reason);
      }
    }

    const teamBreakdown: TeamBreakdownRow[] = [];
    const small = { stages: emptyStages(), classified: 0, unclassified: 0, teamCount: 0 };
    for (const [teamName, t] of teams) {
      if (t.classified >= k) {
        teamBreakdown.push({ teamName, totalUsers: t.classified, unclassifiedUsers: t.unclassified, stages: t.stages });
      } else {
        small.teamCount += 1;
        small.classified += t.classified;
        small.unclassified += t.unclassified;
        for (const phase of Object.keys(small.stages) as AdoptionPhase[]) small.stages[phase] += t.stages[phase];
      }
    }
    if (small.teamCount > 0 && small.classified > 0) {
      if (small.classified >= k) {
        teamBreakdown.push({
          teamName: SMALL_TEAMS_LABEL,
          totalUsers: small.classified,
          unclassifiedUsers: small.unclassified,
          stages: small.stages,
          aggregated: true,
          teamCount: small.teamCount,
        });
      } else {
        teamBreakdown.push({
          teamName: SMALL_TEAMS_LABEL,
          totalUsers: 0,
          unclassifiedUsers: 0,
          stages: emptyStages(),
          aggregated: true,
          teamCount: small.teamCount,
          suppressed: true,
          suppressedReason: `合算しても判定済みが ${k} 人未満のため、個人を特定され得る分布は表示しません (${small.teamCount} チーム)`,
        });
      }
    }

    return {
      hasData,
      totalEvaluatedUsers: totalEvaluated,
      unclassifiedUsers,
      unclassifiedReasons: Array.from(reasons),
      stages,
      teamBreakdown,
      rule: describeAdoptionRule(),
    };
  }
}
