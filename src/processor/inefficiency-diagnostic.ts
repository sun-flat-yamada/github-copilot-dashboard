/**
 * Inefficiency Diagnostic Engine (2026.09 Specification)
 * 典型的な非効率AI利用パターンの兆候診断・確率スコアリング・ドリルダウンエンジン
 */

import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';
import { getIncludedCreditsPerSeat } from '../domain/pricing/pricing-catalog.js';
import {
  AnalysisMethodDefinition,
  AnalysisPeriodScopeType,
  CustomDateRange,
  DiagnosticPeriodInfo,
  UserDiagnosticDrilldown,
  UserDiagnosticResult,
  InefficiencyPatternResult,
  TeamDiagnosticResult,
  TeamPatternSummary,
} from '../types/deep-analysis.js';

import { classifyModel, countByTier } from './model-classification.js';
import {
  CALIBRATION_PLAN,
  DEFAULT_DIAGNOSTIC_CONFIG,
  DiagnosticConfig,
  DiagnosticPatternKey,
  resolveReferenceDate,
} from './diagnostic-config.js';
import { assessDataSufficiency, withSignalFields } from './diagnostic-signals.js';
import {
  MODEL_ESTIMATED_CHAT_COST,
  insufficientDataResult,
  diagnoseTabSpamming,
  diagnoseOverkillModel,
  diagnoseContextBlindChat,
  diagnosePassiveSeat,
  diagnoseOffHoursWorkload,
  analyzeAutonomyDepth,
  diagnoseCreditBurnOverdrive,
  diagnoseAgentAbandonment,
  diagnoseModelCostMismatch,
  diagnoseReviewBypass,
} from './inefficiency-rules.js';

export {
  MODEL_ESTIMATED_CHAT_COST,
  diagnoseTabSpamming,
  diagnoseOverkillModel,
  diagnoseContextBlindChat,
  diagnosePassiveSeat,
  diagnoseOffHoursWorkload,
  analyzeAutonomyDepth,
  diagnoseCreditBurnOverdrive,
  diagnoseAgentAbandonment,
  diagnoseModelCostMismatch,
  diagnoseReviewBypass,
};

// ==========================================
// 1. Extensible Analysis Methods Registry
// ==========================================

export const ANALYSIS_METHODS_REGISTRY: AnalysisMethodDefinition[] = [
  {
    id: 'inefficient_usage_diagnostic',
    title: 'AI活用非効率パターン診断',
    shortTitle: '非効率利用診断',
    subtitle: '利用傾向から典型的な非効率アンチパターンの兆候を、入力値・しきい値・根拠つきのシグナル強度で提示 (既定はチーム単位)',
    category: 'behavioral',
    status: 'active',
    badge: '推奨',
    description:
      'GitHub Copilotの日常的な利用履歴（Inline補完受諾率、チャット利用頻度、モデル選択バランス、稼働日分布）から、時間を浪費したり高コストモデルを過剰利用しているアンチパターン兆候を多角的にスコアリングします。強度は確率ではなく未較正のルール成立度の目安で、データが不足する場合は判定しません。',
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

export interface DiagnoseOptions {
  /** Diagnostic configuration (thresholds, calendar, time zone). Defaults to DEFAULT_DIAGNOSTIC_CONFIG */
  config?: DiagnosticConfig;
  /** End of the analysis window (YYYY-MM-DD). Defaults to the latest date in the organization's data */
  referenceDate?: string;
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
    allProfiles: UserUsageProfile[] = [],
    options: DiagnoseOptions = {}
  ): UserDiagnosticResult {
    const config = options.config ?? DEFAULT_DIAGNOSTIC_CONFIG;
    // 分析窓の終端は組織全体の最新日。ユーザー自身の履歴末尾にすると、直近不在のユーザーも「活動的」に見える
    const referenceDate =
      options.referenceDate ??
      resolveReferenceDate(
        [profile.daily_history || [], ...allProfiles.map((p) => p.daily_history || [])],
        config
      );
    const { filteredHistory, periodInfo } = this.filterDailyHistory(
      profile.daily_history || [],
      scopeType,
      customRange,
      referenceDate
    );

    // 期間内の集計
    let totalChats = 0;
    let totalSuggestions = 0;
    let totalAcceptances = 0;
    let totalCostUsd = 0;
    // 観測されたモデルだけを集計する (特定年のモデル ID を固定で並べない)
    const modelTotals: Record<string, number> = {};

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
    const peerMetrics = this.calculatePeerBenchmark(allProfiles, scopeType, customRange, referenceDate);

    // Agent 関連の指標は、プロファイルに実測値があるときだけ使う。無い値を固定の比率
    // (旧: 短時間 25%・完了 70%・PR 10%・マージ 60 分) で補わず、判定不能 (データ不足) とする。
    const totalAgentSessions: number | null = profile.total_agent_sessions ?? null;
    // 相対評価 (受諾率パラドックスによる緩和) には「実測のセッション数」だけを使う。不明なら緩和しない
    const knownAgentSessions = totalAgentSessions ?? 0;

    // 9つの非効率パターンの判定
    const p1 = diagnoseTabSpamming(totalSuggestions, totalAcceptances, acceptanceRate, activeDays, knownAgentSessions, totalChats);
    const p2 = diagnoseOverkillModel(totalChats, modelTotals);
    const p3 = diagnoseContextBlindChat(totalChats, totalAcceptances, activeDays, filteredHistory);
    const p4 = diagnosePassiveSeat(periodInfo.totalDays, activeDays, totalSuggestions, totalChats);
    const p5 = diagnoseOffHoursWorkload(filteredHistory, config);

    // Phase 6-B: 4つの新パターン
    let totalCreditsConsumed = 0;
    for (const h of filteredHistory) {
      totalCreditsConsumed += h.ai_credits_consumed || 0;
    }
    if (totalCreditsConsumed === 0 && profile.ai_credits_used_28d) {
      totalCreditsConsumed = profile.ai_credits_used_28d;
    }
    // 月間クレジットの基準: 個人上限 (マッピング設定) が優先。無ければ価格カタログのプラン別の包含量。
    // プランも不明なら特定できないため、固定値を仮定せず判定不能とする。
    const creditsLimit =
      profile.ai_credits_limit_monthly ?? getIncludedCreditsPerSeat(profile.plan_type, periodInfo.endDate.slice(0, 7));
    const tierCounts = countByTier(modelTotals);
    const heavyModelRequests = tierCounts.reasoning_heavy + tierCounts.heavy;
    const reasoningHeavyCount = tierCounts.reasoning_heavy;

    const p6 = diagnoseCreditBurnOverdrive(totalCreditsConsumed, creditsLimit, totalAcceptances, knownAgentSessions);
    // 短時間中断セッション数は収集していないため null (実測が得られるまで評価に使わない)
    const p7 = diagnoseAgentAbandonment(totalAgentSessions, null, profile.completed_agent_sessions ?? null);
    const p8 = diagnoseModelCostMismatch(heavyModelRequests, totalChats, acceptanceRate, knownAgentSessions);
    const p9 = diagnoseReviewBypass(
      profile.agent_prs_created ?? null,
      profile.agent_prs_unreviewed ?? null,
      profile.agent_pr_median_merge_mins ?? null
    );

    // データ充足度による判定制御: パターンごとの最小サンプルを満たさないときは判定せず、理由を表示する
    const sampleInput = {
      activeDays,
      windowDays: periodInfo.totalDays,
      suggestions: totalSuggestions,
      chats: totalChats,
    };
    const gate = (
      key: DiagnosticPatternKey,
      pattern: InefficiencyPatternResult
    ): InefficiencyPatternResult => {
      const sufficiency = assessDataSufficiency(key, sampleInput, config);
      if (!sufficiency.sufficient) {
        const blocked = insufficientDataResult(
          pattern.id,
          pattern.name,
          pattern.nameEn,
          pattern.tagline,
          sufficiency.reason as string
        );
        return withSignalFields({ ...blocked, insufficientDataReason: sufficiency.reason }, sufficiency, config);
      }
      return withSignalFields(pattern, sufficiency, config);
    };

    const patterns = [
      gate('tab_spamming_roulette', p1),
      gate('overkill_model_addiction', p2),
      gate('context_blind_chat_churn', p3),
      gate('passive_seat_disengaged', p4),
      gate('off_hours_workload_spike', p5),
      withSignalFields(p6, undefined, config),
      withSignalFields(p7, undefined, config),
      gate('model_cost_mismatch', p8),
      withSignalFields(p9, undefined, config),
    ];

    // 総合健全度スコアの計算 (100点満点からのペナルティ減算)
    // 高リスクパターンが多いほどスコア低下。判定不能 (evaluable = false) のパターンは確率 0 でペナルティなし。
    // 全パターンが判定不能のときのスコアは意味を持たないため、表示側は evaluatedPatternCount を見て判断する
    let penalty = 0;
    for (const p of patterns) {
      if (p.probabilityPercent >= 70) {
        penalty += (p.probabilityPercent - 60) * 0.7;
      } else if (p.probabilityPercent >= 40) {
        penalty += (p.probabilityPercent - 40) * 0.4;
      }
    }

    // 旧「受諾率 28% 以上の健全ボーナス」は廃止した (受諾率パラドックス方針 SDD-06 §4.2 と矛盾するため)

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
        const ratePerChat = classifyModel(mName).estimatedChatCostUsd;
        return {
          modelName: mName,
          chatsCount: count,
          percentage: pct,
          estimatedCostUsd: Number((count * ratePerChat).toFixed(2)),
        };
      }),
      // 組織平均が算出できない (比較対象のデータが無い) 場合は、固定の平均値で埋めず比較行自体を出さない
      peerBenchmarks: peerMetrics
        ? [
            {
              metricName: 'Inline補完受諾率 (%)',
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
              metricName: '推論特化モデル比率',
              userValue: totalChats > 0 ? Number(((reasoningHeavyCount / totalChats) * 100).toFixed(1)) : 0,
              userFormatted: `${totalChats > 0 ? ((reasoningHeavyCount / totalChats) * 100).toFixed(1) : 0}%`,
              peerAverageValue: peerMetrics.avgO1Ratio,
              peerAverageFormatted: `${peerMetrics.avgO1Ratio}%`,
              differenceFormatted: `${(
                (totalChats > 0 ? (reasoningHeavyCount / totalChats) * 100 : 0) - peerMetrics.avgO1Ratio
              ).toFixed(1)}pt`,
              isPositiveForEfficiency:
                (totalChats > 0 ? (reasoningHeavyCount / totalChats) * 100 : 0) <= peerMetrics.avgO1Ratio,
            },
          ]
        : [],
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
      calibration: { status: CALIBRATION_PLAN.status, note: CALIBRATION_PLAN.note },
      evaluatedPatternCount: patterns.filter((p) => p.evaluable !== false).length,
      patternCount: patterns.length,
      drilldown,
    };
  }

  /**
   * チーム単位の診断 (既定の表示単位)。
   * 構成員が最小人数 (config.minTeamSize, 既定 5) 未満のチームは判定せず理由を返す。パターンごとにも、
   * 評価できた人数が最小人数未満ならセルを伏せる (少人数の分布から個人が特定されるのを防ぐ)。
   * 結果にはログイン名・氏名・個人別の値を含めない (強度の帯ごとの人数のみ)。
   */
  public static diagnoseTeam(
    profiles: UserUsageProfile[],
    scopeType: AnalysisPeriodScopeType = '30d',
    customRange?: CustomDateRange,
    options: DiagnoseOptions = {}
  ): TeamDiagnosticResult {
    const config = options.config ?? DEFAULT_DIAGNOSTIC_CONFIG;
    const referenceDate =
      options.referenceDate ?? resolveReferenceDate(profiles.map((p) => p.daily_history || []), config);
    const calibration = { status: CALIBRATION_PLAN.status, note: CALIBRATION_PLAN.note };
    const merged = this.filterDailyHistory(
      profiles.flatMap((p) => p.daily_history || []),
      scopeType,
      customRange,
      referenceDate
    );
    // 稼働日数は「いずれかの構成員が利用した日」の数 (行数ではなく暦日の重複を除く)
    const periodInfo = {
      ...merged.periodInfo,
      activeDays: new Set(
        merged.filteredHistory.filter((h) => h.suggestions > 0 || h.total_chats > 0).map((h) => h.date)
      ).size,
    };

    if (profiles.length < config.minTeamSize) {
      return {
        period: periodInfo,
        memberCount: profiles.length,
        minTeamSize: config.minTeamSize,
        evaluable: false,
        insufficientReason: `構成員が ${config.minTeamSize} 人未満 (${profiles.length} 人) のため、チーム診断は表示しません。個人表示は閲覧権限のある社員のみが利用できます。`,
        metricsSummary: null,
        patterns: [],
        calibration,
      };
    }

    const results = profiles.map((p) =>
      this.diagnoseUser(p, scopeType, customRange, profiles, { ...options, config, referenceDate })
    );
    const summaries: TeamPatternSummary[] = [];
    for (const proto of results[0].patterns) {
      const perMember = results.map((r) => r.patterns.find((p) => p.id === proto.id)!);
      const evaluated = perMember.filter((p) => p.evaluable !== false);
      const base = {
        id: proto.id,
        name: proto.name,
        nameEn: proto.nameEn,
        evaluatedMembers: evaluated.length,
        notEvaluableMembers: perMember.length - evaluated.length,
      };
      if (evaluated.length < config.minTeamSize) {
        summaries.push({
          ...base,
          distribution: null,
          flaggedSharePercent: null,
          suppressedReason: `判定できた人数が ${config.minTeamSize} 人未満 (${evaluated.length} 人) のため分布を表示しません`,
        });
        continue;
      }
      const distribution = { none: 0, weak: 0, medium: 0, strong: 0 };
      for (const p of evaluated) {
        const band = p.signalBand;
        if (band && band !== 'unknown') distribution[band]++;
      }
      summaries.push({
        ...base,
        distribution,
        flaggedSharePercent: Number((((distribution.medium + distribution.strong) / evaluated.length) * 100).toFixed(1)),
      });
    }

    const totals = results.reduce(
      (acc, r) => {
        acc.chats += r.metricsSummary.totalChats;
        acc.suggestions += r.metricsSummary.totalSuggestions;
        acc.acceptances += r.metricsSummary.totalAcceptances;
        return acc;
      },
      { chats: 0, suggestions: 0, acceptances: 0 }
    );
    return {
      period: periodInfo,
      memberCount: profiles.length,
      minTeamSize: config.minTeamSize,
      evaluable: true,
      metricsSummary: {
        totalChats: totals.chats,
        totalSuggestions: totals.suggestions,
        totalAcceptances: totals.acceptances,
        acceptanceRatePercent:
          totals.suggestions > 0 ? Number(((totals.acceptances / totals.suggestions) * 100).toFixed(1)) : 0,
      },
      patterns: summaries,
      calibration,
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
   * 組織平均ベンチマーク指標の算出。
   * 比較対象のデータが無い場合は null を返す (旧: 受諾率 34.7% / 18.5 件/日 / o1 比率 12.0% の固定値を返していた)。
   */
  private static calculatePeerBenchmark(
    allProfiles: UserUsageProfile[],
    scopeType: AnalysisPeriodScopeType,
    customRange?: CustomDateRange,
    referenceDate?: string
  ): {
    avgAcceptanceRate: number;
    avgDailyAcceptances: number;
    avgO1Ratio: number;
  } | null {
    if (!allProfiles || allProfiles.length === 0) {
      return null;
    }

    let sumSuggestions = 0;
    let sumAcceptances = 0;
    let sumActiveDays = 0;
    let sumO1Chats = 0;
    let sumTotalChats = 0;
    let countWithData = 0;

    for (const p of allProfiles) {
      const { filteredHistory, periodInfo } = this.filterDailyHistory(
        p.daily_history || [],
        scopeType,
        customRange,
        referenceDate
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
        pO1 += countByTier(h.model_breakdown || {}).reasoning_heavy;
      }

      if (pSugg > 0) {
        sumSuggestions += pSugg;
        sumAcceptances += pAcc;
        sumActiveDays += periodInfo.activeDays || 1;
        sumO1Chats += pO1;
        sumTotalChats += pChats;
        countWithData++;
      }
    }

    if (countWithData === 0 || sumActiveDays === 0 || sumTotalChats === 0) {
      return null;
    }

    return {
      // 全体 KPI と同じ定義 (提案合計に対する受諾合計の比)。個人率の単純平均にしない
      avgAcceptanceRate: Number(((sumAcceptances / sumSuggestions) * 100).toFixed(1)),
      avgDailyAcceptances: Number((sumAcceptances / sumActiveDays).toFixed(1)),
      avgO1Ratio: Number(((sumO1Chats / sumTotalChats) * 100).toFixed(1)),
    };
  }
}
