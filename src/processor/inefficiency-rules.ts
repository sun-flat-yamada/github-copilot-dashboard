import { UserModelDailyUsage } from '../types/copilot.js';
import {
  ContributingFactor,
  InefficiencyPatternResult,
  PatternRiskLevel,
} from '../types/deep-analysis.js';
import {
  AutonomyAnalysisMetrics,
  LONG_AUTONOMY_REASONING_MODELS,
} from './inefficiency-diagnostic.js';

export const MODEL_ESTIMATED_CHAT_COST: Record<string, number> = {
  'o1': 0.08,
  'claude-3-7-sonnet': 0.04,
  'gpt-4o': 0.015,
  'gemini-2-0-flash': 0.004,
};

export function getRiskLevel(prob: number): PatternRiskLevel {
  if (prob >= 70) return 'high';
  if (prob >= 40) return 'medium';
  if (prob >= 15) return 'low';
  return 'healthy';
}

export function diagnoseTabSpamming(
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
    const riskLevel = getRiskLevel(prob);

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
export function diagnoseOverkillModel(
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
    const riskLevel = getRiskLevel(prob);

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
   * 自律駆動深度（指示あたりの受諾行数・成果）を加味し、コマ切れでも正当なペアプロであれば緩和
   */
export function diagnoseContextBlindChat(
    totalChats: number,
    acceptances: number,
    activeDays: number,
    history?: UserModelDailyUsage[]
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    const dailyChats = activeDays > 0 ? totalChats / activeDays : totalChats;
    const chatToAcceptanceRatio = acceptances > 0 ? totalChats / acceptances : totalChats;

    // 自律性・成果行数の算出
    const autonomy = history ? calculateAutonomyMetrics(history) : null;
    const yieldLines = autonomy ? autonomy.yieldLinesPerChat : 0;

    if (totalChats >= 15) {
      if (dailyChats >= 20 && chatToAcceptanceRatio >= 1.5) {
        prob = Math.min(95, Math.round(60 + (dailyChats - 20) * 1.5 + chatToAcceptanceRatio * 10));
      } else if (dailyChats >= 12 && chatToAcceptanceRatio >= 1.0) {
        prob = Math.min(65, Math.round(35 + (dailyChats - 12) * 2));
      } else {
        prob = Math.max(5, Math.round(20 * (dailyChats / 12)));
      }

      // 【高精度化補正】コマ切れ利用であっても、1チャットあたりの受諾行数（成果規模）が大きければ
      // 「インライン・フローペアプロ型（正当なマイクロタスク支援）」として確率を大幅軽減
      if (yieldLines >= 25 && acceptances >= 10) {
        prob = Math.max(5, Math.round(prob * 0.4)); // 最大60%軽減
      } else if (yieldLines >= 15 && acceptances >= 5) {
        prob = Math.max(8, Math.round(prob * 0.65));
      }
    } else {
      prob = 8;
    }

    prob = Math.max(0, Math.min(95, prob));
    const riskLevel = getRiskLevel(prob);

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

    if (autonomy) {
      factors.push({
        metricName: '指示あたり受諾コード規模 (Yield)',
        currentValueFormatted: `${yieldLines.toFixed(1)} 行 / チャット`,
        recommendedThresholdFormatted: '≥ 15.0 行 (成果コード)',
        description:
          yieldLines >= 20
            ? 'コマ切れ対話であっても十分なコード行数が受諾されており、実効的なペアプログラミングが行われています。'
            : yieldLines < 8 && totalChats >= 15
            ? '1指示あたりのコード受諾規模が極端に小さく、対話の手戻りやAI介護が発生している疑いがあります。'
            : '標準的な対話成果規模です。',
        severity: yieldLines >= 20 ? 'good' : yieldLines < 8 && totalChats >= 15 ? 'warning' : 'neutral',
      });
    }

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
export function diagnosePassiveSeat(
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
    const riskLevel = getRiskLevel(prob);

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
   * 5. 時間外・集中負荷過多型 (Off-Hours Workload Spike vs Smart Offload)
   * 自律駆動深度（AEDP）と週末利用率の2軸マトリクス評価
   * 適切にタスクをオフロードしている場合は「🌟 スマート・オフロード型 (Healthy)」として正当評価
   */
export function diagnoseOffHoursWorkload(
    history: UserModelDailyUsage[]
  ): InefficiencyPatternResult {
    let prob = 0;
    const factors: ContributingFactor[] = [];
    const recommendations: string[] = [];

    let weekendActions = 0;
    let totalActions = 0;
    const weekendHistory: UserModelDailyUsage[] = [];

    for (const h of history) {
      const dayOfWeek = new Date(h.date).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const acts = h.total_chats + h.suggestions;
      totalActions += acts;
      if (isWeekend) {
        weekendActions += acts;
        if (acts > 0) {
          weekendHistory.push(h);
        }
      }
    }

    const weekendRatio = totalActions > 0 ? weekendActions / totalActions : 0;
    const weekendAutonomy = calculateAutonomyMetrics(weekendHistory);

    let isSmartOffload = false;
    let isFirefightingStruggle = false;

    if (totalActions >= 30 && weekendRatio >= 0.20) {
      // 週末の利用割合が高い場合の2軸分岐:
      // 「自律駆動深度 (Autonomy Depth)」が高いか、短時間連打・低受諾か
      if (
        weekendAutonomy.offloadStyle === 'smart_offload' ||
        weekendAutonomy.autonomyDepthScore >= 50
      ) {
        // 【第1象限: スマート・オフロード型】
        // 週末に推論モデルへタスクを委任し、自律実行させている高効率利用
        isSmartOffload = true;
        prob = Math.max(3, Math.min(10, Math.round(weekendRatio * 15))); // Healthy (<= 10%)
      } else if (
        weekendAutonomy.offloadStyle === 'firefighting_struggle' ||
        (weekendRatio >= 0.35 && weekendAutonomy.autonomyDepthScore < 40)
      ) {
        // 【第2象限: 緊急火消し・泥沼デバッグ型】
        // 短時間指示を連打して手戻り格闘している真の過負荷
        isFirefightingStruggle = true;
        prob = Math.min(
          95,
          Math.round(65 + (weekendRatio - 0.35) * 80 + (40 - weekendAutonomy.autonomyDepthScore) * 0.5)
        );
      } else {
        // 中程度
        prob = Math.round(20 + (weekendRatio - 0.2) * 80);
      }
    } else if (totalActions >= 50 && weekendRatio >= 0.35) {
      prob = Math.min(85, Math.round(55 + (weekendRatio - 0.35) * 100));
    } else {
      prob = Math.max(2, Math.round(15 * (weekendRatio / 0.2)));
    }

    prob = Math.max(0, Math.min(95, prob));
    const riskLevel = getRiskLevel(prob);

    // 要因 1: 週末アクティビティ比率
    factors.push({
      metricName: '週末・休日アクティビティ比率',
      currentValueFormatted: `${(weekendRatio * 100).toFixed(1)}% (${weekendActions} / ${totalActions} 件)`,
      recommendedThresholdFormatted: '< 20.0%',
      description: isSmartOffload
        ? '休日利用比率は高めですが、AIへの自律タスク委任（スマート・オフロード）が確認されています。'
        : weekendRatio >= 0.35
        ? '休日の利用割合が非常に高く、特定個人への業務過負荷や緊急対応が疑われます。'
        : weekendRatio >= 0.2
        ? '休日の利用が散見されます。'
        : '平日の通常業務時間内に集中して健全に利用されています。',
      severity: isSmartOffload ? 'good' : weekendRatio >= 0.35 ? 'warning' : 'good',
    });

    // 要因 2: AI自律駆動深度 (Autonomy Depth)
    factors.push({
      metricName: '時間外 AI自律駆動深度 (Autonomy Depth)',
      currentValueFormatted: `${weekendAutonomy.autonomyDepthScore} pt / 100 pt (推論モデル率: ${(weekendAutonomy.reasoningModelRatio * 100).toFixed(0)}%)`,
      recommendedThresholdFormatted: '≥ 50 pt (自律委任型)',
      description: isSmartOffload
        ? '推論モデル（o1/Claude 3.7等）による長時間の自律推論が活用されており、人間の拘束時間は極小です。'
        : weekendAutonomy.autonomyDepthScore < 40
        ? '1指示あたりの自律駆動時間が短く、人間がプロンプトを連打して小刻みに修正を繰り返している兆候があります。'
        : '標準的な自律稼働バランスです。',
      severity: isSmartOffload ? 'good' : weekendAutonomy.autonomyDepthScore < 40 ? 'danger' : 'neutral',
    });

    // 要因 3: 1指示あたり受諾コード規模
    factors.push({
      metricName: '指示あたり受諾コード規模 (Yield)',
      currentValueFormatted: `${weekendAutonomy.yieldLinesPerChat.toFixed(1)} 行 / チャット`,
      recommendedThresholdFormatted: '≥ 20.0 行 (ファイル単位の差分)',
      description:
        weekendAutonomy.yieldLinesPerChat >= 20
          ? '1回のプロンプトでまとまった規模の実装が自律生成・採用されています。'
          : '1指示あたりの受諾行数が少なく、細かい手戻り修正が多発している可能性があります。',
      severity: weekendAutonomy.yieldLinesPerChat >= 20 ? 'good' : 'warning',
    });

    // レコメンデーション & サマリーの分岐
    let tagline: string;
    let summary: string;

    if (isSmartOffload) {
      tagline = '🌟 スマート・オフロード型（AIへの高度なタスク委任・自律駆動）';
      summary =
        '休日にAIを利用していますが、推論・自律型モデルへ的確にタスクをオフロードしており、人間の拘束時間を最小化しながら高い成果を得ています。先進的で極めて効率的なAI活用です。';
      recommendations.push(
        '【模範的なオフロード活用】人間の手を動かし続けるのではなく、AIに長時間の自律推論・実装を任せる理想的な運用ができています。',
        '【チームへの知見共有】タスクの切り出し方やプロンプト設計のベストプラクティスを、ぜひチーム内に展開してください。'
      );
    } else if (isFirefightingStruggle || prob >= 70) {
      tagline = '⚠️ 緊急火消し・泥沼デバッグ型（休日の短時間指示連打・過負荷）';
      summary =
        '休日に短いプロンプトを頻繁に連打してAIと格闘している兆候があります。特定障害の火消しやデバッグの難航による時間外労働・属人化の強いリスクが疑われます。';
      recommendations.push(
        '【タスク負荷分散と障害振り返り】休日に急ぎで対応せざるを得なかった背景や、デバッグ難航の原因について1on1で確認してください。',
        '【自律型推論モデルの活用】小刻みな修正を人間が繰り返すのではなく、Claude 3.7やo1等の推論モデルにエラーログ全体を渡して自己修正させるプロンプト設計への見直しを推奨します。'
      );
    } else if (prob >= 40) {
      tagline = '週末や休日にAI利用が集中し特定個人への負荷偏重が発生している兆候';
      summary = '休日の利用が散見されます。定常タスクの平日化と平準化を推奨します。';
      recommendations.push(
        '【平日業務内でのAI自動化推進】平日の定常開発フローにCopilot PR SummaryやCLI活用を組み込み、時間外の作業負担を軽減してください。'
      );
    } else {
      tagline = '平日の通常業務時間内に安定してAIを活用中';
      summary = '稼働時間帯のバランスは良好です。平日に安定して利用されています。';
      recommendations.push('稼働時間帯のバランスは良好です。');
    }

    return {
      id: 'off_hours_workload_spike',
      name: isSmartOffload ? 'スマート・オフロード型 (高効率)' : '時間外・集中負荷過多型',
      nameEn: isSmartOffload ? 'Smart Offload / Autonomous Delegation' : 'Off-Hours / Weekend Workload Spike',
      probabilityPercent: prob,
      riskLevel,
      tagline,
      summary,
      contributingFactors: factors,
      recommendations,
      isExpandedDefault: prob >= 60 || isSmartOffload,
    };
  }

  /**
   * 指示1回あたりのAI自律駆動深度とオフロード効率の算出 (AEDP Proxy)
   * 人間の指示1回あたりでAIがどれだけ自律駆動（推論・コード生成・探索）できたかを評価
   */
export function calculateAutonomyMetrics(
  history: UserModelDailyUsage[]
): AutonomyAnalysisMetrics {
    let totalChats = 0;
    let reasoningChats = 0;
    let totalLinesAccepted = 0;
    let activeDays = 0;

    for (const h of history) {
      if (h.total_chats > 0 || h.suggestions > 0) {
        activeDays++;
      }
      totalChats += h.total_chats;
      totalLinesAccepted += h.lines_accepted;

      if (h.model_breakdown) {
        for (const [modelName, count] of Object.entries(h.model_breakdown)) {
          const isReasoning = LONG_AUTONOMY_REASONING_MODELS.some((m) =>
            modelName.toLowerCase().includes(m)
          );
          if (isReasoning) {
            reasoningChats += count;
          }
        }
      }
    }

    const reasoningModelRatio = totalChats > 0 ? reasoningChats / totalChats : 0;
    const yieldLinesPerChat = totalChats > 0 ? totalLinesAccepted / totalChats : 0;
    const chatsPerActiveDay = activeDays > 0 ? totalChats / activeDays : 0;

    // 長時間自律駆動（Long Autonomy）と短時間（Short Micro-burst）の比率推定
    // 推論モデル利用、または1指示あたり30行以上の大きな差分生成を長時間自律と推計
    const longRatio = Math.min(
      1.0,
      reasoningModelRatio * 0.7 + Math.min(0.5, yieldLinesPerChat / 60) * 0.6
    );
    const longAutonomyRatioPercent = Math.round(longRatio * 100);
    const shortAutonomyRatioPercent = 100 - longAutonomyRatioPercent;

    // 自律駆動深度スコア (0 - 100)
    // 推論モデル比率(40%) + 1指示受諾行数(40%) + プロンプト連打の抑制度/スパース性(20%)
    const reasoningPart = reasoningModelRatio * 40;
    const linesPart = Math.min(40, (yieldLinesPerChat / 40) * 40);
    const sparsityPart =
      chatsPerActiveDay <= 10 ? 20 : Math.max(0, 20 - (chatsPerActiveDay - 10) * 0.8);
    const autonomyDepthScore = Math.min(
      100,
      Math.round(reasoningPart + linesPart + sparsityPart)
    );

    // オフロードスタイルの判定
    let offloadStyle: 'smart_offload' | 'firefighting_struggle' | 'balanced_standard';
    if (autonomyDepthScore >= 50 || (reasoningModelRatio >= 0.4 && yieldLinesPerChat >= 20)) {
      offloadStyle = 'smart_offload';
    } else if (autonomyDepthScore < 35 && chatsPerActiveDay >= 15 && yieldLinesPerChat < 12) {
      offloadStyle = 'firefighting_struggle';
    } else {
      offloadStyle = 'balanced_standard';
    }

    return {
      autonomyDepthScore,
      reasoningModelRatio,
      yieldLinesPerChat,
      chatsPerActiveDay,
      longAutonomyRatioPercent,
      shortAutonomyRatioPercent,
      offloadStyle,
    };
  }

export { calculateAutonomyMetrics as analyzeAutonomyDepth };

/**
 * 6. クレジット過剰消費型 (Credit Burn Overdrive)
 */
export function diagnoseCreditBurnOverdrive(
  creditsConsumed: number,
  creditsLimit: number = 3900,
  acceptances: number = 0,
  agentSessions: number = 0
): InefficiencyPatternResult {
  let prob = 0;
  const factors: ContributingFactor[] = [];
  const recommendations: string[] = [];

  const limit = creditsLimit > 0 ? creditsLimit : 3900;
  const ratio = creditsConsumed / limit;
  const totalOutcomes = acceptances + agentSessions;

  if (creditsConsumed > 0) {
    if (ratio >= 1.5 || (creditsConsumed >= 3500 && totalOutcomes < 10)) {
      prob = Math.min(96, Math.round(75 + (ratio - 1.5) * 30));
    } else if (ratio >= 1.0 || (creditsConsumed >= 2000 && totalOutcomes < 5)) {
      prob = Math.round(45 + (ratio - 1.0) * 40);
    } else if (ratio >= 0.7) {
      prob = Math.round(20 + (ratio - 0.7) * 50);
    } else {
      prob = Math.max(3, Math.round(15 * ratio));
    }
  } else {
    prob = 0;
  }

  prob = Math.max(0, Math.min(96, prob));
  const riskLevel = getRiskLevel(prob);

  factors.push({
    metricName: 'AIクレジット消費ペース',
    currentValueFormatted: `${creditsConsumed} Credits / 月間上限 ${limit} Credits (${(ratio * 100).toFixed(1)}%)`,
    recommendedThresholdFormatted: '≤ 100.0% (月次予算内)',
    description:
      ratio >= 1.5
        ? '月間割当クレジットを50%以上超過しており、予算の枯渇リスクが極めて高い状態です。'
        : ratio >= 1.0
        ? '月間上限を超過しており、組織プール枠を圧迫しています。'
        : 'クレジット消費ペースは許容範囲内です。',
    severity: ratio >= 1.5 ? 'danger' : ratio >= 1.0 ? 'warning' : 'good',
  });

  factors.push({
    metricName: '成果あたりのクレジット消費',
    currentValueFormatted: `${(creditsConsumed / Math.max(1, totalOutcomes)).toFixed(1)} Credits / 成果`,
    recommendedThresholdFormatted: '< 30.0 Credits / 成果',
    description:
      totalOutcomes === 0 && creditsConsumed > 500
        ? 'クレジットを消費しているにもかかわらずコード受諾やAgent完了がゼロで、成果が伴っていません。'
        : totalOutcomes > 0 && creditsConsumed / totalOutcomes > 80
        ? '1成果あたりのクレジット消費量が過大で、費用対効果が著しく低下しています。'
        : '成果に対するクレジット消費効率は良好です。',
    severity: (totalOutcomes === 0 && creditsConsumed > 500) || (totalOutcomes > 0 && creditsConsumed / totalOutcomes > 80) ? 'danger' : 'good',
  });

  if (prob >= 60) {
    recommendations.push(
      '【定型タスクの軽量モデル化】要約やボイラープレート生成には Gemini 2.0 Flash または GPT-4o を指定し、クレジット消費を抑えてください。',
      '【Agent自律ループの制限】Agentタスクを実行する際はステップ数やタイムアウトを設定し、無限反復や不要なファイル走査を防いでください。',
      '【月間クレジット上限の設定】個人別・プロジェクト別のアラート閾値（80%）を設定し、計画的な利用を推進してください。'
    );
  } else {
    recommendations.push('AIクレジットの消費バランスは健全です。');
  }

  return {
    id: 'credit_burn_overdrive',
    name: 'クレジット過剰消費型',
    nameEn: 'Credit Burn Overdrive',
    probabilityPercent: prob,
    riskLevel,
    tagline: 'AI Creditsの消費ペースが突出し費用対効果に見合わない過大消費が発生している兆候',
    summary:
      prob >= 70
        ? '強い兆候を検出しました。月間クレジット上限を大幅に超過、または成果創出に対してクレジット消費が過大です。'
        : prob >= 40
        ? '中程度の傾向があります。高コストタスクの切り分けとモデル選択の最適化を検討してください。'
        : '兆候は検出されませんでした。適切なクレジット配分のもとで運用されています。',
    contributingFactors: factors,
    recommendations,
    isExpandedDefault: prob >= 60,
  };
}

/**
 * 7. Agent セッション途中放棄型 (Agent Session Abandonment)
 */
export function diagnoseAgentAbandonment(
  totalSessions: number,
  shortSessions: number = 0,
  completedSessions: number = 0
): InefficiencyPatternResult {
  let prob = 0;
  const factors: ContributingFactor[] = [];
  const recommendations: string[] = [];

  const abandonedSessions = Math.max(0, totalSessions - completedSessions);
  const abandonmentRate = totalSessions > 0 ? abandonedSessions / totalSessions : 0;
  const shortRate = totalSessions > 0 ? shortSessions / totalSessions : 0;

  if (totalSessions >= 5) {
    if (abandonmentRate >= 0.6 || shortRate >= 0.5) {
      prob = Math.min(95, Math.round(70 + (abandonmentRate - 0.6) * 60));
    } else if (abandonmentRate >= 0.35 || shortRate >= 0.3) {
      prob = Math.round(40 + (abandonmentRate - 0.35) * 80);
    } else {
      prob = Math.max(5, Math.round(25 * abandonmentRate));
    }
  } else {
    prob = totalSessions > 0 ? 10 : 0;
  }

  prob = Math.max(0, Math.min(95, prob));
  const riskLevel = getRiskLevel(prob);

  factors.push({
    metricName: 'Agentセッション放棄率',
    currentValueFormatted: `${(abandonmentRate * 100).toFixed(1)}% (${abandonedSessions}/${totalSessions} 件放棄)`,
    recommendedThresholdFormatted: '< 30.0%',
    description:
      abandonmentRate >= 0.5
        ? 'Agentセッションの半数以上がタスク完了に至らず途中で放棄されています。'
        : abandonmentRate >= 0.3
        ? 'Agentへの指示が途中で途切れる傾向があります。'
        : 'Agentセッションは順調に成果完了まで継続されています。',
    severity: abandonmentRate >= 0.5 ? 'danger' : abandonmentRate >= 0.3 ? 'warning' : 'good',
  });

  factors.push({
    metricName: '短時間中断セッション率',
    currentValueFormatted: `${(shortRate * 100).toFixed(1)}% (${shortSessions} 件)`,
    recommendedThresholdFormatted: '< 20.0%',
    description:
      shortRate >= 0.4
        ? '開始後わずか1〜2ターンで中断されたセッションが多く、プロンプトの前提不足やツールのエラーが疑われます。'
        : 'セッション継続期間は安定しています。',
    severity: shortRate >= 0.4 ? 'warning' : 'neutral',
  });

  if (prob >= 60) {
    recommendations.push(
      '【指示タスクの小粒度化】Agentに1度に大きな課題を任せず、ステップごとに分割してゴールを明確にしてください。',
      '【受け入れ条件（Acceptance Criteria）の明記】期待する出力・テストコマンド・成功条件をプロンプトで明示することで、Agentの迷走を防止できます。',
      '【ルールファイル（AGENTS.md）の整備】プロジェクト規約やディレクトリ構造をあらかじめ定義しておくと、セッション立ち上がり時の手戻りを劇的に削減できます。'
    );
  } else {
    recommendations.push('Agentセッションは高い完了率で有効に活用されています。');
  }

  return {
    id: 'agent_abandonment',
    name: 'Agent セッション途中放棄型',
    nameEn: 'Agent Session Abandonment',
    probabilityPercent: prob,
    riskLevel,
    tagline: 'Agentセッションを開始するものの途中で諦めて破棄または手動修正に切り替えている兆候',
    summary:
      prob >= 70
        ? '強い兆候を検出しました。Agentセッションの過半数が完了せずに放棄されており、プロンプト設計やコンテキスト不足に起因する空回りの疑いがあります。'
        : prob >= 40
        ? '中程度の傾向があります。Agentへのタスクの切り出し方を見直すことで完了率を高められます。'
        : '兆候は検出されませんでした。Agentがタスクを完遂するワークフローが定着しています。',
    contributingFactors: factors,
    recommendations,
    isExpandedDefault: prob >= 60,
  };
}

/**
 * 8. モデルコスト不整合型 (Model Cost Mismatch)
 */
export function diagnoseModelCostMismatch(
  heavyModelRequests: number,
  totalRequests: number,
  acceptanceRate: number
): InefficiencyPatternResult {
  let prob = 0;
  const factors: ContributingFactor[] = [];
  const recommendations: string[] = [];

  const heavyRatio = totalRequests > 0 ? heavyModelRequests / totalRequests : 0;

  if (totalRequests >= 10) {
    if (heavyRatio >= 0.70 && acceptanceRate < 0.20) {
      prob = Math.min(95, Math.round(70 + (heavyRatio - 0.70) * 50 + (0.20 - acceptanceRate) * 50));
    } else if (heavyRatio >= 0.55 && acceptanceRate < 0.25) {
      prob = Math.round(45 + (heavyRatio - 0.55) * 50);
    } else {
      prob = Math.max(4, Math.round(20 * heavyRatio));
    }
  } else {
    prob = totalRequests > 0 ? 8 : 0;
  }

  prob = Math.max(0, Math.min(95, prob));
  const riskLevel = getRiskLevel(prob);

  factors.push({
    metricName: '高コスト推論モデル利用比率',
    currentValueFormatted: `${(heavyRatio * 100).toFixed(1)}% (${heavyModelRequests}/${totalRequests} 件)`,
    recommendedThresholdFormatted: '< 50.0%',
    description:
      heavyRatio >= 0.7
        ? '高コストな最上位モデル（o1 / Claude 3.7 Sonnet等）に極端に偏っており、コスト対効果の不整合が懸念されます。'
        : 'モデルの利用比率はバランスの取れた範囲内です。',
    severity: heavyRatio >= 0.7 ? 'danger' : heavyRatio >= 0.5 ? 'warning' : 'good',
  });

  factors.push({
    metricName: 'コード受諾率',
    currentValueFormatted: `${(acceptanceRate * 100).toFixed(1)}%`,
    recommendedThresholdFormatted: '≥ 25.0%',
    description:
      acceptanceRate < 0.20
        ? '最上位モデルを投入しているにもかかわらずコード受諾率が低く、タスクとモデルの選定ミスマッチが発生しています。'
        : 'コード受諾率は良好な水準です。',
    severity: acceptanceRate < 0.20 ? 'danger' : acceptanceRate < 0.25 ? 'warning' : 'good',
  });

  if (prob >= 60) {
    recommendations.push(
      '【タスク難度に応じたモデル選定】定型コード生成、ユニットテスト生成、構文チェックには高速・低コストなモデル（Gemini 2.0 Flash / GPT-4o）を第一選択にしてください。',
      '【最上位モデルの投入基準の策定】複雑な並行処理設計や難関アルゴリズム検証など、明確に推論能力が必要なタスクに限定して最上位モデルを活用してください。'
    );
  } else {
    recommendations.push('タスク特性に合わせた適切なモデル選定が行われています。');
  }

  return {
    id: 'model_cost_mismatch',
    name: 'モデルコスト不整合型',
    nameEn: 'Model Cost Mismatch',
    probabilityPercent: prob,
    riskLevel,
    tagline: '軽量・定型タスクに対して最上位推論モデルを過剰投入しコスト不整合が発生している兆候',
    summary:
      prob >= 70
        ? '強い兆候を検出しました。高コストモデルを多用している一方で受諾率が低く、費用対効果の大きな不整合が生じています。'
        : prob >= 40
        ? '中程度の傾向があります。用途に応じたモデルの使い分けルールを設けることでコストを削減できます。'
        : '兆候は検出されませんでした。モデルコストと成果のバランスが保たれています。',
    contributingFactors: factors,
    recommendations,
    isExpandedDefault: prob >= 60,
  };
}

/**
 * 9. レビュー迂回・ノーチェックマージ型 (Review Bypass / Unchecked Agent PR)
 */
export function diagnoseReviewBypass(
  agentPrs: number,
  unreviewedPrs: number,
  medianMergeMinutes: number = 60
): InefficiencyPatternResult {
  let prob = 0;
  const factors: ContributingFactor[] = [];
  const recommendations: string[] = [];

  const unreviewedRatio = agentPrs > 0 ? unreviewedPrs / agentPrs : 0;

  if (agentPrs >= 3) {
    if (unreviewedRatio >= 0.60 || medianMergeMinutes < 15) {
      prob = Math.min(95, Math.round(70 + unreviewedRatio * 20 + Math.max(0, 15 - medianMergeMinutes)));
    } else if (unreviewedRatio >= 0.35 || medianMergeMinutes < 30) {
      prob = Math.round(40 + unreviewedRatio * 30);
    } else {
      prob = Math.max(3, Math.round(15 * unreviewedRatio));
    }
  } else {
    prob = agentPrs > 0 ? 5 : 0;
  }

  prob = Math.max(0, Math.min(95, prob));
  const riskLevel = getRiskLevel(prob);

  factors.push({
    metricName: 'レビュー未実施マージ率',
    currentValueFormatted: `${(unreviewedRatio * 100).toFixed(1)}% (${unreviewedPrs}/${agentPrs} 件)`,
    recommendedThresholdFormatted: '< 20.0%',
    description:
      unreviewedRatio >= 0.60
        ? 'Agent生成PRの過半数が人間のレビューを経ずにマージされており、品質・セキュリティ上の重大なリスクがあります。'
        : unreviewedRatio >= 0.35
        ? 'レビュー未実施のAgent PRが散見されます。'
        : 'Agent生成PRに対して適切なレビューが実施されています。',
    severity: unreviewedRatio >= 0.60 ? 'danger' : unreviewedRatio >= 0.35 ? 'warning' : 'good',
  });

  factors.push({
    metricName: 'PRマージ時間の中央値',
    currentValueFormatted: `${medianMergeMinutes.toFixed(0)} 分`,
    recommendedThresholdFormatted: '≥ 30 分 (十分な検証時間)',
    description:
      medianMergeMinutes < 15
        ? 'PR作成からマージまでの時間が極めて短く、コード差分やテスト結果の十分な精査が行われていない恐れがあります。'
        : '十分な検証・レビュー時間を経てマージされています。',
    severity: medianMergeMinutes < 15 ? 'warning' : 'good',
  });

  if (prob >= 60) {
    recommendations.push(
      '【ブランチ保護ルールの徹底】Agent作成PRであっても、最低1名の承認（Required Reviewers）をマージ必須条件に設定してください。',
      '【自動テストCIの義務化】AI生成コードの品質担保のため、ユニットテストおよび統合テストのパスをブランチプロテクションで強制してください。',
      '【AIアノテーションの確認】PR概要にAgentが生成したコード範囲を明示し、レビュー担当者が重点的に確認できるようにしてください。'
    );
  } else {
    recommendations.push('Agent作成PRに対する適切なレビューと品質管理が行われています。');
  }

  return {
    id: 'review_bypass',
    name: 'レビュー迂回・ノーチェックマージ型',
    nameEn: 'Review Bypass / Unchecked Agent PR',
    probabilityPercent: prob,
    riskLevel,
    tagline: 'AI/Agentが生成したPRを十分な人間レビューなしに即時マージしている品質リスクの兆候',
    summary:
      prob >= 70
        ? '強い兆候を検出しました。Agentが作成したPRがレビューなし、または極めて短時間でマージされており、バグ混入やセキュリティ低下のリスクが高い状態です。'
        : prob >= 40
        ? '中程度の傾向があります。Agent PRに対するレビュー体制の標準化を推奨します。'
        : '兆候は検出されませんでした。安全で品質の高いマージフローが維持されています。',
    contributingFactors: factors,
    recommendations,
    isExpandedDefault: prob >= 60,
  };
}