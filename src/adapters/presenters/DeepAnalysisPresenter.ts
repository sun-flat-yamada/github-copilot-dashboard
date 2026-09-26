import { UserUsageProfile } from '../../domain/entities/copilot.js';
import { HealthScore } from '../../domain/value-objects/HealthScore.js';

export interface DeepAnalysisUserSummary {
  login: string;
  displayName: string;
  department: string;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical';
  statusColor: string;
  acceptanceRateFormatted: string;
  totalChats: number;
  totalSuggestions: number;
  detectedIssue?: string;
}

export interface DeepAnalysisSummaryViewModel {
  totalAnalyzed: number;
  healthyCount: number;
  warningCount: number;
  criticalCount: number;
  averageHealthScore: number;
  healthScoreFormatted: string;
  topRiskPattern?: string;
}

export interface DeepAnalysisViewModel {
  hasProfiles: boolean;
  sourceInfo: string;
  summary: DeepAnalysisSummaryViewModel;
  users: DeepAnalysisUserSummary[];
  selectedUser: DeepAnalysisUserSummary | null;
}

export interface DeepAnalysisPresenterInput {
  profiles: UserUsageProfile[];
  sourceInfo?: string;
  selectedLogin?: string;
}

export class DeepAnalysisPresenter {
  public static present(input: DeepAnalysisPresenterInput): DeepAnalysisViewModel {
    const { profiles, sourceInfo = 'Deep Analysis Profiles', selectedLogin } = input;

    if (!profiles || profiles.length === 0) {
      return {
        hasProfiles: false,
        sourceInfo,
        summary: {
          totalAnalyzed: 0,
          healthyCount: 0,
          warningCount: 0,
          criticalCount: 0,
          averageHealthScore: 100,
          healthScoreFormatted: '100点 (healthy)',
        },
        users: [],
        selectedUser: null,
      };
    }

    let healthyCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    let totalScore = 0;

    const users: DeepAnalysisUserSummary[] = profiles.map((p) => {
      const acceptanceRate = p.acceptance_rate || 0;
      let rawScore = 100;
      let detectedIssue: string | undefined;

      if (p.total_suggestions > 0 && acceptanceRate < 0.15) {
        rawScore -= 35;
        detectedIssue = 'コード提案受諾率が低迷しています (Tab Roulette兆候)';
      } else if (p.total_suggestions > 0 && acceptanceRate < 0.25) {
        rawScore -= 15;
        detectedIssue = '受諾率が平均水準を下回っています';
      }

      if (p.total_chats > 50 && acceptanceRate < 0.1) {
        rawScore -= 20;
        detectedIssue = 'チャットの反復試行が多い傾向があります (Chat Churn)';
      }

      if (p.total_suggestions === 0 && p.total_chats === 0) {
        rawScore = 40;
        detectedIssue = 'ライセンス付与後の活動がありません (Passive Seat)';
      }

      const clamped = Math.max(0, Math.min(100, rawScore));
      const scoreVO = new HealthScore(clamped);
      const score = scoreVO.value;
      totalScore += score;

      const status = scoreVO.status;
      let statusColor = 'text-emerald-400';

      if (status === 'critical') {
        statusColor = 'text-rose-400';
        criticalCount++;
      } else if (status === 'warning') {
        statusColor = 'text-amber-400';
        warningCount++;
      } else {
        healthyCount++;
      }

      return {
        login: p.login,
        displayName: p.display_name || p.login,
        department: p.department || '未設定',
        healthScore: score,
        status,
        statusColor,
        acceptanceRateFormatted: `${Math.round(acceptanceRate * 100)}%`,
        totalChats: p.total_chats || 0,
        totalSuggestions: p.total_suggestions || 0,
        detectedIssue,
      };
    });

    const averageHealthScore = Math.round(totalScore / profiles.length);
    const avgScoreVO = new HealthScore(Math.max(0, Math.min(100, averageHealthScore)));

    const activeSelectedUser =
      (selectedLogin ? users.find((u) => u.login === selectedLogin) : null) || users[0];

    return {
      hasProfiles: true,
      sourceInfo,
      summary: {
        totalAnalyzed: profiles.length,
        healthyCount,
        warningCount,
        criticalCount,
        averageHealthScore,
        healthScoreFormatted: `${averageHealthScore}点 (${avgScoreVO.status})`,
      },
      users,
      selectedUser: activeSelectedUser,
    };
  }
}
