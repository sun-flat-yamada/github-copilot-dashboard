/**
 * Inefficiency Diagnostic Engine (2026.09 Specification)
 * 典型的な非効率AI利用パターンの兆候診断・確率スコアリング・ドリルダウンエンジン
 */

import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';
import {
  AnalysisMethodDefinition,
  AnalysisPeriodScopeType,
  CustomDateRange,
  DiagnosticPeriodInfo,
  UserDiagnosticDrilldown,
  UserDiagnosticResult,
} from '../types/deep-analysis.js';

import {
  MODEL_ESTIMATED_CHAT_COST,
  diagnoseTabSpamming,
  diagnoseOverkillModel,
  diagnoseContextBlindChat,
  diagnosePassiveSeat,
  diagnoseOffHoursWorkload,
  analyzeAutonomyDepth,
} from './inefficiency-rules.js';

export { MODEL_ESTIMATED_CHAT_COST };

// ==========================================
// 1. Extensible Analysis Methods Registry
// ==========================================

export const ANALYSIS_METHODS_REGISTRY: AnalysisMethodDefinition[] = [
  {
    id: 'inefficient_usage_diagnostic',
    title: 'AI活用非効率パターン診断',
    shortTitle: '非効率利用診断',
    subtitle: '個人の利用傾向から典型的な非効率アンチパターンの兆候を確率%で判定',
    category: 'behavioral',
    status: 'active',
    badge: '推奨',
    description:
      'GitHub Copilotの日常的な利用履歴（コード提案受諾率、チャット利用頻度、モデル選択バランス、稼働日分布）から、時間を浪費したり高コストモデルを過剰利用しているアンチパターン兆候を多角的にスコアリングします。',
  },
  {
    id: 'model_cost_efficiency',
    title: 'モデル選定・コスト対効果マトリクス',
    shortTitle: 'モデルROIマトリクス',
    subtitle: 'タスク難易度に対するAIモデル選定の過不足とコスト乖離を分析',
    category: 'cost',
    status: 'coming_soon',
    badge: 'Roadmap',
    description:
      'o1等の高推論モデルとGemini 2.0 Flash / GPT-4o等の高速モデルの使い分け状況を評価し、過剰投資または能力不足のギャップをマトリクスで可視化します。',
  },
  {
    id: 'prompt_churn_loop',
    title: 'プロンプト反復・手戻り検知',
    shortTitle: '手戻りループ検知',
    subtitle: 'チャットの堂々巡りやコード生成後の手動修正破棄サイクルを解析',
    category: 'quality',
    status: 'coming_soon',
    badge: 'Roadmap',
    description:
      '同一タスクに対する過剰な再プロンプトや生成コードの直後巻き戻しイベントを検出し、プロンプティング品質の課題を特定します。',
  },
  {
    id: 'peer_gap_benchmark',
    title: '組織・同僚比較ギャップベンチマーク',
    shortTitle: '同僚比較ベンチマーク',
    subtitle: '同一部署・同一職種のハイパフォーマー利用行動との乖離を特定',
    category: 'team',
    status: 'coming_soon',
    badge: 'Roadmap',
    description:
      '同じ部署や類似プロジェクト内のトップユーザーの活用指標と比較し、取り入れるべきベストプラクティスを提示します。',
  },
];



// 自律駆動時間（AEDP）の長い推論・エージェント型モデル群
export const LONG_AUTONOMY_REASONING_MODELS = [
  'o1',
  'o3-mini',
  'claude-3-7',
  'gemini-2-5-pro',
  'deepseek-r1',
];

export interface AutonomyAnalysisMetrics {
  autonomyDepthScore: number; // 0 - 100
  reasoningModelRatio: number; // 0.0 - 1.0
  yieldLinesPerChat: number; // 1チャットあたりの受諾行数
  chatsPerActiveDay: number; // 1日あたりの平均チャット数
  longAutonomyRatioPercent: number; // 0 - 100%
  shortAutonomyRatioPercent: number; // 0 - 100%
  offloadStyle: 'smart_offload' | 'firefighting_struggle' | 'balanced_standard';
}

export class InefficiencyDiagnosticEngine {
  /**
   * 対象期間の絞り込み
   */
  public static filterDailyHistory(
    history: UserModelDailyUsage[],
    scopeType: AnalysisPeriodScopeType,
    customRange?: CustomDateRange,
    baseDateStr?: string
  ): {
    filteredHistory: UserModelDailyUsage[];
    periodInfo: DiagnosticPeriodInfo;
  } {
    if (!history || history.length === 0) {
      const todayStr = baseDateStr || new Date().toISOString().split('T')[0];
      return {
        filteredHistory: [],
        periodInfo: {
          scopeType,
          startDate: todayStr,
          endDate: todayStr,
          totalDays: 0,
          activeDays: 0,
          label: 'データなし',
        },
      };
    }

    // ソート（昇順）
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latestDate = baseDateStr || sorted[sorted.length - 1].date;

    let startDate: string;
    let endDate: string;
    let label: string;

    if (scopeType === 'today') {
      startDate = latestDate;
      endDate = latestDate;
      label = `当日 (${latestDate})`;
    } else if (scopeType === '7d') {
      const latestObj = new Date(latestDate);
      const startObj = new Date(latestObj.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDate = startObj.toISOString().split('T')[0];
      endDate = latestDate;
      label = `直近1週間 (${startDate} 〜 ${endDate})`;
    } else if (scopeType === 'custom' && customRange?.start && customRange?.end) {
      startDate = customRange.start;
      endDate = customRange.end;
      label = `期間指定 (${startDate} 〜 ${endDate})`;
    } else {
      // デフォルト: 30d (前1カ月間)
      const latestObj = new Date(latestDate);
      const startObj = new Date(latestObj.getTime() - 29 * 24 * 60 * 60 * 1000);
      startDate = startObj.toISOString().split('T')[0];
      endDate = latestDate;
      label = `前1カ月間 (${startDate} 〜 ${endDate})`;
    }

    const filtered = sorted.filter((h) => h.date >= startDate && h.date <= endDate);
    const activeDays = filtered.filter((h) => h.suggestions > 0 || h.total_chats > 0).length;

    // 日数計算
    const sObj = new Date(startDate);
    const eObj = new Date(endDate);
    const totalDays = Math.max(1, Math.round((eObj.getTime() - sObj.getTime()) / (24 * 60 * 60 * 1000)) + 1);

    return {
      filteredHistory: filtered,
      periodInfo: {
        scopeType,
        startDate,
        endDate,
        totalDays,
        activeDays,
        label,
      },
    };
  }

  /**
   * 1ユーザーに対する非効率パターン診断の実行
   */
  public static diagnoseUser(
    profile: UserUsageProfile,
    scopeType: AnalysisPeriodScopeType = '30d',
    customRange?: CustomDateRange,
    allProfiles: UserUsageProfile[] = []
  ): UserDiagnosticResult {
    const { filteredHistory, periodInfo } = this.filterDailyHistory(
      profile.daily_history || [],
      scopeType,
      customRange
    );

    // 期間内の集計
    let totalChats = 0;
    let totalSuggestions = 0;
    let totalAcceptances = 0;
    let totalCostUsd = 0;
    const modelTotals: Record<string, number> = {
      'claude-3-7-sonnet': 0,
      'gpt-4o': 0,
      'o1': 0,
      'gemini-2-0-flash': 0,
    };

    for (const h of filteredHistory) {
      totalChats += h.total_chats;
      totalSuggestions += h.suggestions;
      totalAcceptances += h.acceptances;
      totalCostUsd += h.daily_cost_usd;
      for (const [m, count] of Object.entries(h.model_breakdown || {})) {
        modelTotals[m] = (modelTotals[m] || 0) + count;
      }
    }

    const acceptanceRate =
      totalSuggestions > 0 ? Number((totalAcceptances / totalSuggestions).toFixed(4)) : 0;
    const acceptanceRatePercent = Number((acceptanceRate * 100).toFixed(1));
    const activeDays = periodInfo.activeDays;
    const dailyAvgChats = activeDays > 0 ? Number((totalChats / activeDays).toFixed(1)) : 0;
    const dailyAvgSuggestions =
      activeDays > 0 ? Number((totalSuggestions / activeDays).toFixed(1)) : 0;

    // 組織全体の平均ベンチマーク計算
    const peerMetrics = this.calculatePeerBenchmark(allProfiles, scopeType, customRange);

    // 5つの非効率パターンの判定
    const p1 = diagnoseTabSpamming(totalSuggestions, totalAcceptances, acceptanceRate, activeDays);
    const p2 = diagnoseOverkillModel(totalChats, modelTotals);
    const p3 = diagnoseContextBlindChat(totalChats, totalAcceptances, activeDays, filteredHistory);
    const p4 = diagnosePassiveSeat(periodInfo.totalDays, activeDays, totalSuggestions, totalChats);
    const p5 = diagnoseOffHoursWorkload(filteredHistory);

    const patterns = [p1, p2, p3, p4, p5];

    // 総合健全度スコアの計算 (100点満点からのペナルティ減算)
    // 高リスクパターンが多いほどスコア低下
    let penalty = 0;
    for (const p of patterns) {
      if (p.probabilityPercent >= 70) {
        penalty += (p.probabilityPercent - 60) * 0.7;
      } else if (p.probabilityPercent >= 40) {
        penalty += (p.probabilityPercent - 40) * 0.4;
      }
    }

    // 健全利用ボーナス（受諾率が28%以上でアクティブなら維持）
    if (acceptanceRatePercent >= 28 && activeDays >= 3) {
      penalty = Math.max(0, penalty - 10);
    }

    // スマート・オフロード実践ボーナス（AI自律タスク委任を高効率に行っている場合）
    if (p5.name.includes('スマート・オフロード')) {
      penalty = Math.max(0, penalty - 5);
    }

    const healthScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    let healthStatus: UserDiagnosticResult['healthStatus'] = 'healthy';
    if (healthScore < 60) healthStatus = 'critical';
    else if (healthScore < 80) healthStatus = 'warning';

    // ドリルダウン用データの構成
    const drilldown: UserDiagnosticDrilldown = {
      dailyActivity: filteredHistory.map((h) => ({
        date: h.date,
        suggestions: h.suggestions,
        acceptances: h.acceptances,
        acceptanceRatePercent: Math.round(h.acceptance_rate * 100),
        chats: h.total_chats,
        costUsd: h.daily_cost_usd,
        modelBreakdown: h.model_breakdown || {},
      })),
      modelDistribution: Object.entries(modelTotals).map(([mName, count]) => {
        const pct = totalChats > 0 ? Number(((count / totalChats) * 100).toFixed(1)) : 0;
        const ratePerChat = MODEL_ESTIMATED_CHAT_COST[mName] || 0.02;
        return {
          modelName: mName,
          chatsCount: count,
          percentage: pct,
          estimatedCostUsd: Number((count * ratePerChat).toFixed(2)),
        };
      }),
      peerBenchmarks: [
        {
          metricName: 'コード受諾率 (%)',
          userValue: acceptanceRatePercent,
          userFormatted: `${acceptanceRatePercent}%`,
          peerAverageValue: peerMetrics.avgAcceptanceRate,
          peerAverageFormatted: `${peerMetrics.avgAcceptanceRate}%`,
          differenceFormatted: `${(acceptanceRatePercent - peerMetrics.avgAcceptanceRate).toFixed(1)}pt`,
          isPositiveForEfficiency: acceptanceRatePercent >= peerMetrics.avgAcceptanceRate,
        },
        {
          metricName: '1日平均 提案受託数',
          userValue: activeDays > 0 ? Number((totalAcceptances / activeDays).toFixed(1)) : 0,
          userFormatted: `${activeDays > 0 ? (totalAcceptances / activeDays).toFixed(1) : 0} 件/日`,
          peerAverageValue: peerMetrics.avgDailyAcceptances,
          peerAverageFormatted: `${peerMetrics.avgDailyAcceptances} 件/日`,
          differenceFormatted: `${(
            (activeDays > 0 ? totalAcceptances / activeDays : 0) - peerMetrics.avgDailyAcceptances
          ).toFixed(1)} 件`,
          isPositiveForEfficiency: (activeDays > 0 ? totalAcceptances / activeDays : 0) >= peerMetrics.avgDailyAcceptances,
        },
        {
          metricName: '高コスト推論モデル比率 (o1)',
          userValue: totalChats > 0 ? Number((((modelTotals['o1'] || 0) / totalChats) * 100).toFixed(1)) : 0,
          userFormatted: `${totalChats > 0 ? (((modelTotals['o1'] || 0) / totalChats) * 100).toFixed(1) : 0}%`,
          peerAverageValue: peerMetrics.avgO1Ratio,
          peerAverageFormatted: `${peerMetrics.avgO1Ratio}%`,
          differenceFormatted: `${(
            (totalChats > 0 ? ((modelTotals['o1'] || 0) / totalChats) * 100 : 0) - peerMetrics.avgO1Ratio
          ).toFixed(1)}pt`,
          isPositiveForEfficiency:
            (totalChats > 0 ? ((modelTotals['o1'] || 0) / totalChats) * 100 : 0) <= peerMetrics.avgO1Ratio,
        },
      ],
    };

    return {
      user: profile,
      period: periodInfo,
      healthScore,
      healthStatus,
      metricsSummary: {
        totalChats,
        totalSuggestions,
        totalAcceptances,
        acceptanceRatePercent,
        totalCostUsd: Number(totalCostUsd.toFixed(2)),
        dailyAvgChats,
        dailyAvgSuggestions,
      },
      patterns,
      drilldown,
    };
  }

  // ==========================================
  // 5つのパターン診断ロジック
  // ==========================================

  /**
   * 1. 生成ガチャ・受け身垂れ流し型 (Tab-Spamming / Suggestion Roulette)
   */
  public static calculateAutonomyMetrics(history: UserModelDailyUsage[]): AutonomyAnalysisMetrics {
    return analyzeAutonomyDepth(history);
  }

  public static analyzeAutonomyDepth(history: UserModelDailyUsage[]): AutonomyAnalysisMetrics {
    return analyzeAutonomyDepth(history);
  }

  /**
   * 組織平均ベンチマーク指標の算出
   */
  private static calculatePeerBenchmark(
    allProfiles: UserUsageProfile[],
    scopeType: AnalysisPeriodScopeType,
    customRange?: CustomDateRange
  ): {
    avgAcceptanceRate: number;
    avgDailyAcceptances: number;
    avgO1Ratio: number;
  } {
    if (!allProfiles || allProfiles.length === 0) {
      return {
        avgAcceptanceRate: 34.7,
        avgDailyAcceptances: 18.5,
        avgO1Ratio: 12.0,
      };
    }

    let sumRate = 0;
    let sumAcceptances = 0;
    let sumActiveDays = 0;
    let sumO1Chats = 0;
    let sumTotalChats = 0;
    let countWithData = 0;

    for (const p of allProfiles) {
      const { filteredHistory, periodInfo } = this.filterDailyHistory(
        p.daily_history || [],
        scopeType,
        customRange
      );
      if (filteredHistory.length === 0) continue;

      let pSugg = 0;
      let pAcc = 0;
      let pChats = 0;
      let pO1 = 0;

      for (const h of filteredHistory) {
        pSugg += h.suggestions;
        pAcc += h.acceptances;
        pChats += h.total_chats;
        pO1 += h.model_breakdown?.['o1'] || 0;
      }

      if (pSugg > 0) {
        sumRate += (pAcc / pSugg) * 100;
        sumAcceptances += pAcc;
        sumActiveDays += periodInfo.activeDays || 1;
        sumO1Chats += pO1;
        sumTotalChats += pChats;
        countWithData++;
      }
    }

    if (countWithData === 0) {
      return {
        avgAcceptanceRate: 34.7,
        avgDailyAcceptances: 18.5,
        avgO1Ratio: 12.0,
      };
    }

    return {
      avgAcceptanceRate: Number((sumRate / countWithData).toFixed(1)),
      avgDailyAcceptances:
        sumActiveDays > 0 ? Number((sumAcceptances / sumActiveDays).toFixed(1)) : 18.5,
      avgO1Ratio:
        sumTotalChats > 0 ? Number(((sumO1Chats / sumTotalChats) * 100).toFixed(1)) : 12.0,
    };
  }
}
