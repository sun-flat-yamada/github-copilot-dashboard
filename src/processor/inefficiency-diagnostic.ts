/**
 * Inefficiency Diagnostic Engine (2026.09 Specification)
 * 典型的な非効率AI利用パターンの兆候診断・確率スコアリング・ドリルダウンエンジン
 */

import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';
import {
  AnalysisMethodDefinition,
  AnalysisPeriodScopeType,
  ContributingFactor,
  CustomDateRange,
  DiagnosticPeriodInfo,
  InefficiencyPatternResult,
  PatternRiskLevel,
  UserDiagnosticDrilldown,
  UserDiagnosticResult,
} from '../types/deep-analysis.js';

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

// モデルごとの推定コスト（1チャットあたり概算USD）
const MODEL_ESTIMATED_CHAT_COST: Record<string, number> = {
  'o1': 0.08,
  'claude-3-7-sonnet': 0.04,
  'gpt-4o': 0.015,
  'gemini-2-0-flash': 0.004,
};

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
    const p1 = this.diagnoseTabSpamming(totalSuggestions, totalAcceptances, acceptanceRate, activeDays);
    const p2 = this.diagnoseOverkillModel(totalChats, modelTotals);
    const p3 = this.diagnoseContextBlindChat(totalChats, totalAcceptances, activeDays);
    const p4 = this.diagnosePassiveSeat(periodInfo.totalDays, activeDays, totalSuggestions, totalChats);
    const p5 = this.diagnoseOffHoursWorkload(filteredHistory);

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

    // 健全利用ボーナス（受諾率が25%以上でアクティブなら維持）
    if (acceptanceRatePercent >= 28 && activeDays >= 3) {
      penalty = Math.max(0, penalty - 10);
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
  private static diagnoseTabSpamming(
    suggestions: number,
    acceptances: number,
    rate: number,
    activeDays: number
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    const avgDailySugg = activeDays > 0 ? suggestions / activeDays : suggestions;

    if (suggestions >= 30) {
      // 受諾率の低さによるペナルティ
      if (rate < 0.15) {
        // 15%未満なら急激に確率上昇 (5%以下なら最大90%)
        const rateFactor = Math.min(1, (0.15 - rate) / 0.12);
        const volumeFactor = Math.min(1, avgDailySugg / 50);
        prob = Math.round(55 + rateFactor * 35 * volumeFactor);
      } else if (rate < 0.22) {
        const rateFactor = (0.22 - rate) / 0.07;
        prob = Math.round(25 + rateFactor * 30);
      } else {
        prob = Math.max(5, Math.round(15 * (1 - Math.min(1, rate / 0.35))));
      }
    } else if (suggestions > 0) {
      prob = 12; // サンプル少
    } else {
      prob = 0;
    }

    prob = Math.max(0, Math.min(98, prob));
    const riskLevel = this.getRiskLevel(prob);

    factors.push({
      metricName: 'コード受諾率',
      currentValueFormatted: `${(rate * 100).toFixed(1)}% (${acceptances}/${suggestions} 件)`,
      recommendedThresholdFormatted: '≥ 25.0%',
      description:
        rate < 0.15
          ? '受諾率が極端に低く、提示されるコードを吟味せずにスキップ・破棄を繰り返しています。'
          : rate < 0.22
          ? '受諾率がやや低めで、AIの提案意図と手元のコード方針のミスマッチが発生しています。'
          : '受諾率は健全水準を維持しており、適切なコード提案の採択が行われています。',
      severity: rate < 0.15 ? 'danger' : rate < 0.22 ? 'warning' : 'good',
    });

    factors.push({
      metricName: '1日平均 提案件数',
      currentValueFormatted: `${avgDailySugg.toFixed(1)} 件/日`,
      recommendedThresholdFormatted: '30 〜 80 件/日',
      description:
        avgDailySugg > 90
          ? '提案発生数が過密であり、AIの補完生成待ちや連打による集中途切れの懸念があります。'
          : '提案頻度は標準的なペースです。',
      severity: avgDailySugg > 90 && rate < 0.18 ? 'warning' : 'neutral',
    });

    if (prob >= 60) {
      recommendations.push(
        '【コメント駆動の徹底】Tabキーを連打する前に、直前の行に関数の目的や引数の仕様を日本語コメント（`// ...`）で1行書くことで、AIの提案精度を劇的に向上させられます。',
        '【コンテキストファイルの事前オープン】関連する型定義ファイルやインターフェースをエディタで開いておくことで、Copilotがプロジェクトの文脈を正確に把握できるようになります。',
        '【Ghost-Textの過信防止】最初の数単語で意図と異なる提案が出た場合は、すぐにEnter/Tabを押さず、手動で数文字入力して誘導してください。'
      );
    } else {
      recommendations.push(
        '現状の補完利用効率は良好です。引き続き関数シグネチャやコメントを意識したスマートな補完活用を維持してください。'
      );
    }

    return {
      id: 'tab_spamming_roulette',
      name: '生成ガチャ・受け身垂れ流し型',
      nameEn: 'Tab-Spamming / Suggestion Roulette',
      probabilityPercent: prob,
      riskLevel,
      tagline: 'AIの提案を吟味せずTabキーや再生成を連打し時間を浪費している兆候',
      summary:
        prob >= 70
          ? '強い兆候を検出しました。大量のコード提案が発生している一方で受諾率が15%未満と極めて低く、AIとの方針不一致や生成待ちに多くの時間を費やしている可能性が高いです。'
          : prob >= 40
          ? '中程度の兆候があります。特定ファイルや難解タスクにおいて受諾率が低下している可能性があります。'
          : '兆候は検出されませんでした。適切な吟味と誘導のもとでコード受諾が行われています。',
      contributingFactors: factors,
      recommendations,
      isExpandedDefault: prob >= 60,
    };
  }

  /**
   * 2. 超重量級モデル過剰依存型 (Overkill Model Addiction)
   */
  private static diagnoseOverkillModel(
    totalChats: number,
    models: Record<string, number>
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    const o1Count = models['o1'] || 0;
    const claudeCount = models['claude-3-7-sonnet'] || 0;
    const flashCount = models['gemini-2-0-flash'] || 0;
    const gpt4oCount = models['gpt-4o'] || 0;
    const standardCount = flashCount + gpt4oCount;

    const heavyCount = o1Count + claudeCount;
    const heavyRatio = totalChats > 0 ? heavyCount / totalChats : 0;
    const o1Ratio = totalChats > 0 ? o1Count / totalChats : 0;

    if (totalChats >= 15) {
      if (o1Ratio >= 0.55 || (heavyRatio >= 0.85 && flashCount <= 2)) {
        prob = Math.round(65 + Math.min(30, (heavyRatio - 0.7) * 80 + o1Ratio * 20));
      } else if (heavyRatio >= 0.7) {
        prob = Math.round(35 + (heavyRatio - 0.5) * 60);
      } else {
        prob = Math.max(5, Math.round(20 * (heavyRatio / 0.5)));
      }
    } else if (totalChats > 0) {
      prob = o1Ratio >= 0.6 ? 45 : 10;
    } else {
      prob = 0;
    }

    prob = Math.max(0, Math.min(96, prob));
    const riskLevel = this.getRiskLevel(prob);

    factors.push({
      metricName: '推論特化・大型モデル比率 (o1 / Sonnet)',
      currentValueFormatted: `${(heavyRatio * 100).toFixed(1)}% (o1: ${(o1Ratio * 100).toFixed(1)}%)`,
      recommendedThresholdFormatted: '< 60.0% (o1: < 25%)',
      description:
        o1Ratio >= 0.4
          ? '超高コストな推論モデル(o1)が利用チャットの大半を占めており、単純な定型作業にも投入されている疑いがあります。'
          : heavyRatio >= 0.75
          ? '軽量・高速モデルの利用が少なく、全体的に重量級モデルに依存しています。'
          : 'タスクの性質に応じたモデルの使い分けが行われています。',
      severity: o1Ratio >= 0.4 ? 'danger' : heavyRatio >= 0.75 ? 'warning' : 'good',
    });

    factors.push({
      metricName: '高速・標準モデル活用数 (Flash / GPT-4o)',
      currentValueFormatted: `${standardCount} 回 (Flash: ${flashCount}, 4o: ${gpt4oCount})`,
      recommendedThresholdFormatted: '≥ 25.0%',
      description:
        flashCount <= 2 && totalChats >= 20
          ? '定型作業やリファクタリング、構文チェック等で高速・安価なGemini FlashやGPT-4oが十分に活用されていません。'
          : '高速・標準モデルが適宜活用されています。',
      severity: flashCount <= 2 && totalChats >= 20 ? 'warning' : 'good',
    });

    if (prob >= 60) {
      recommendations.push(
        '【モデルの適材適所ルール】定型コード生成、テストデータのモック作成、正規表現作成などには「Gemini 2.0 Flash」または「GPT-4o」を選択してください。レイテンシが1/5に短縮されます。',
        '【o1の投入基準の明確化】o1は「超難関アルゴリズムの導出」「複雑な競合状態のデバッグ」などの深い推論が必要な局面のみに絞り込み、日々の対話ではClaude 3.7 SonnetまたはGPT-4oをメインに据えましょう。'
      );
    } else {
      recommendations.push('モデルの使い分けは良好です。状況に応じて最新モデルの長所を引き出せています。');
    }

    return {
      id: 'overkill_model_addiction',
      name: '超重量級モデル過剰依存型',
      nameEn: 'Overkill Model Addiction',
      probabilityPercent: prob,
      riskLevel,
      tagline: '定型作業にも常に最高コストモデルを投入しコストと応答時間を浪費している兆候',
      summary:
        prob >= 70
          ? '強い兆候を検出しました。o1やClaude 3.7 Sonnet等の最上位モデルばかりが使用され、軽量モデルの併用がほぼありません。予算消費の加速と応答待ち時間の増加を招いています。'
          : prob >= 40
          ? '中程度の傾向があります。定型的な質問やリファクタリングに軽量モデルを併用することで、コストと速度の最適化が可能です。'
          : '兆候は検出されませんでした。バランスの良いモデル選定が行われています。',
      contributingFactors: factors,
      recommendations,
      isExpandedDefault: prob >= 60,
    };
  }

  /**
   * 3. 文脈希薄・対話空回り型 (Context-Blind Prompting / Chat Churn)
   */
  private static diagnoseContextBlindChat(
    totalChats: number,
    acceptances: number,
    activeDays: number
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    const dailyChats = activeDays > 0 ? totalChats / activeDays : totalChats;
    const chatToAcceptanceRatio = acceptances > 0 ? totalChats / acceptances : totalChats;

    if (totalChats >= 15) {
      if (dailyChats >= 20 && chatToAcceptanceRatio >= 1.5) {
        prob = Math.min(95, Math.round(60 + (dailyChats - 20) * 1.5 + chatToAcceptanceRatio * 10));
      } else if (dailyChats >= 12 && chatToAcceptanceRatio >= 1.0) {
        prob = Math.min(65, Math.round(35 + (dailyChats - 12) * 2));
      } else {
        prob = Math.max(5, Math.round(20 * (dailyChats / 12)));
      }
    } else {
      prob = 8;
    }

    prob = Math.max(0, Math.min(95, prob));
    const riskLevel = this.getRiskLevel(prob);

    factors.push({
      metricName: '1日平均 チャット回数',
      currentValueFormatted: `${dailyChats.toFixed(1)} 回/日`,
      recommendedThresholdFormatted: '5 〜 15 回/日',
      description:
        dailyChats >= 20
          ? 'チャット頻度が極めて高く、AIとの対話に多くの時間を費やしています。'
          : 'チャット頻度は適正範囲内です。',
      severity: dailyChats >= 20 ? 'warning' : 'neutral',
    });

    factors.push({
      metricName: 'チャット対コード受託比率',
      currentValueFormatted: `${chatToAcceptanceRatio.toFixed(2)}`,
      recommendedThresholdFormatted: '< 0.80',
      description:
        chatToAcceptanceRatio >= 1.2
          ? 'チャット回数に対して実際のコード受諾・反映件数が少なく、対話が空回りしている兆候があります。'
          : 'チャットで得た知見やコードが順調に採用されています。',
      severity: chatToAcceptanceRatio >= 1.2 ? 'danger' : 'good',
    });

    if (prob >= 60) {
      recommendations.push(
        '【プロンプトの具体化】「エラーが出ました」のような曖昧な質問ではなく、「スタックトレース」「期待する出力」「引数の型」を明示して1問1答で的確な解を引き出してください。',
        '【チャットよりもインライン編集の活用】コードの直接修正には、チャットで相談するよりもエディタ上のインライン補完やコードアクション（Cmd+I / Ctrl+I）を使う方が手戻りが少なくなります。'
      );
    } else {
      recommendations.push('チャットの対話効率は良好です。適切な問題切り分けとコード反映が行われています。');
    }

    return {
      id: 'context_blind_chat_churn',
      name: '文脈希薄・対話空回り型',
      nameEn: 'Context-Blind Prompting / Chat Churn',
      probabilityPercent: prob,
      riskLevel,
      tagline: 'チャット回数は多いがエディタへのコード反映が進まず堂々巡りになっている兆候',
      summary:
        prob >= 70
          ? '強い兆候を検出しました。チャットでAIと頻繁に対話しているにもかかわらずコードの採用が進んでおらず、プロンプトの文脈不足や対話の空回りが発生している疑いがあります。'
          : prob >= 40
          ? '中程度の傾向があります。質問の前提条件を整理してからプロンプトすることで対話往復を削減できます。'
          : '兆候は検出されませんでした。対話成果がスムーズにコード採用に結びついています。',
      contributingFactors: factors,
      recommendations,
      isExpandedDefault: prob >= 60,
    };
  }

  /**
   * 4. 低関与・放置シート予備軍型 (Passive Seat / Disengaged Usage)
   */
  private static diagnosePassiveSeat(
    totalDays: number,
    activeDays: number,
    suggestions: number,
    chats: number
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    const activeRatio = totalDays > 0 ? activeDays / totalDays : 0;
    const totalActions = suggestions + chats;

    if (totalDays >= 7) {
      if (activeRatio < 0.15 || (activeRatio < 0.25 && totalActions < 15)) {
        prob = Math.min(95, Math.round(70 + (0.25 - activeRatio) * 100));
      } else if (activeRatio < 0.4) {
        prob = Math.round(35 + (0.4 - activeRatio) * 80);
      } else {
        prob = Math.max(3, Math.round(15 * (1 - Math.min(1, activeRatio / 0.6))));
      }
    } else {
      prob = activeDays === 0 ? 60 : 10;
    }

    prob = Math.max(0, Math.min(95, prob));
    const riskLevel = this.getRiskLevel(prob);

    factors.push({
      metricName: '期間内 実稼働日率',
      currentValueFormatted: `${(activeRatio * 100).toFixed(1)}% (${activeDays}日 / ${totalDays}日)`,
      recommendedThresholdFormatted: '≥ 45.0%',
      description:
        activeRatio < 0.25
          ? 'ライセンスが付与されているにもかかわらず、稼働日が極めて少なく定着していません。'
          : activeRatio < 0.4
          ? '稼働日がやや少なめです。'
          : '日常的な開発業務にCopilotが定着しています。',
      severity: activeRatio < 0.25 ? 'danger' : activeRatio < 0.4 ? 'warning' : 'good',
    });

    factors.push({
      metricName: '期間内 総AIアクション数',
      currentValueFormatted: `${totalActions} 回 (提案: ${suggestions}, チャット: ${chats})`,
      recommendedThresholdFormatted: '≥ 150 回',
      description:
        totalActions < 30
          ? '全体のアクション数がごくわずかで、ライセンス費用の投資対効果が得られていません。'
          : '十分な活用ボリュームがあります。',
      severity: totalActions < 30 ? 'warning' : 'good',
    });

    if (prob >= 60) {
      recommendations.push(
        '【ハンズオン・メンター支援の実施】利用方法に不安や障壁がある可能性があります。社内の推進メンバーによるペアプログラミング勉強会への参加を推奨します。',
        '【シート再配分の検討】業務特性上Copilotの利用機会が少ない場合は、ウェイティングリストの別エンジニアへのシート移譲を検討してください。'
      );
    } else {
      recommendations.push('継続的・日常的にCopilotが活用されています。');
    }

    return {
      id: 'passive_seat_disengaged',
      name: '低関与・放置シート予備軍型',
      nameEn: 'Passive / Disengaged Seat',
      probabilityPercent: prob,
      riskLevel,
      tagline: 'ライセンスを保有しているが稼働日が極端に少なく投資が無駄になっている兆候',
      summary:
        prob >= 70
          ? '強い兆候を検出しました。期間中の利用日数が極めて少なく、ライセンスが遊休化しています。サポートまたはシート再配分が必要です。'
          : prob >= 40
          ? '中程度の傾向があります。利用頻度を高めるためのTips共有が有効です。'
          : '兆候は検出されませんでした。日常的に活発に利用されています。',
      contributingFactors: factors,
      recommendations,
      isExpandedDefault: prob >= 60,
    };
  }

  /**
   * 5. 時間外・集中負荷過多型 (Off-Hours / Weekend Workload Spike)
   */
  private static diagnoseOffHoursWorkload(
    history: UserModelDailyUsage[]
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    let weekendActions = 0;
    let totalActions = 0;

    for (const h of history) {
      const dayOfWeek = new Date(h.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const acts = h.total_chats + h.suggestions;
      totalActions += acts;
      if (isWeekend) {
        weekendActions += acts;
      }
    }

    const weekendRatio = totalActions > 0 ? weekendActions / totalActions : 0;

    if (totalActions >= 50) {
      if (weekendRatio >= 0.35) {
        prob = Math.min(90, Math.round(55 + (weekendRatio - 0.35) * 120));
      } else if (weekendRatio >= 0.2) {
        prob = Math.round(25 + (weekendRatio - 0.2) * 100);
      } else {
        prob = Math.max(2, Math.round(10 * (weekendRatio / 0.2)));
      }
    } else {
      prob = 5;
    }

    prob = Math.max(0, Math.min(95, prob));
    const riskLevel = this.getRiskLevel(prob);

    factors.push({
      metricName: '週末・休日アクティビティ比率',
      currentValueFormatted: `${(weekendRatio * 100).toFixed(1)}% (${weekendActions} / ${totalActions} 件)`,
      recommendedThresholdFormatted: '< 20.0%',
      description:
        weekendRatio >= 0.35
          ? '休日の利用割合が非常に高く、業務外での過負荷や特定個人への属人化が疑われます。'
          : weekendRatio >= 0.2
          ? '休日の利用が散見されます。'
          : '平日の通常業務時間内に集中して健全に利用されています。',
      severity: weekendRatio >= 0.35 ? 'warning' : 'good',
    });

    if (prob >= 60) {
      recommendations.push(
        '【タスク負荷分散のレビュー】特定プロジェクトの納期逼迫やタスクの属人化がないか、1on1での状況確認を推奨します。',
        '【平日業務内でのAI自動化推進】平日の定常開発フローにCopilot PR SummaryやCLI活用を組み込み、時間外の作業負担を軽減してください。'
      );
    } else {
      recommendations.push('稼働時間帯のバランスは良好です。');
    }

    return {
      id: 'off_hours_workload_spike',
      name: '時間外・集中負荷過多型',
      nameEn: 'Off-Hours / Weekend Workload Spike',
      probabilityPercent: prob,
      riskLevel,
      tagline: '週末や休日にAI利用が集中し特定個人への負荷偏重が発生している兆候',
      summary:
        prob >= 70
          ? '強い兆候を検出しました。休日の利用比率が35%を超えており、過重労働やデバッグの難航による時間外対応の疑いがあります。'
          : prob >= 40
          ? '軽度の休日利用が確認されています。'
          : '兆候は検出されませんでした。平日に安定して利用されています。',
      contributingFactors: factors,
      recommendations,
      isExpandedDefault: prob >= 60,
    };
  }

  private static getRiskLevel(prob: number): PatternRiskLevel {
    if (prob >= 70) return 'high';
    if (prob >= 40) return 'medium';
    if (prob >= 15) return 'low';
    return 'healthy';
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
