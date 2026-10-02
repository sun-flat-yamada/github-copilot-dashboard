/**
 * 使用量・長大化の兆候の定義 (SDD-06 §5)。閾値と文言はここに一元化する。
 *
 * 兆候は 1 日単位の集計値からの推定であり、会話の内容は見ていない。
 * 利用方法を見直すきっかけを示すもので、個人の評価指標ではない。
 */
import type { SignalLevel, UsageSignal, UsageSignalId } from '../domain/entities/copilot.js';

export const USAGE_INSIGHT_THRESHOLDS = {
  /** この日数・件数に満たないユーザーは判定しない (「データ不足」) */
  minActiveDays: 5,
  /** S1 持ち越しの比率: 組織中央値に対する倍率 */
  s1: { watch: 2, review: 3 },
  /** S2 高トークン日: 組織のユーザー日あたりトークン中央値に対する倍率と、該当日数・割合 */
  s2: { dayRatio: 3, watchDays: 2, reviewDays: 3, reviewShare: 0.3 },
  /** S3 1 利用日あたりの量: 組織中央値に対する倍率 */
  s3: { watch: 2, review: 3 },
  /** S4 1 日に使ったモデル数の平均 (単独では「参考」止まり) */
  s4: { watch: 2.5 },
  /** S5 高単価モデルとみなす倍率 (全モデルの単価中央値に対して) と、そのモデルのトークン割合 */
  s5: { modelCostRatio: 2, tokenShare: 0.5 },
} as const;

export interface SignalDefinition {
  id: UsageSignalId;
  name: string;
  /** 何を見ているか */
  what: string;
  /** 必要なデータ */
  requires: string;
}

export const SIGNAL_DEFINITIONS: Record<UsageSignalId, SignalDefinition> = {
  S1: {
    id: 'S1',
    name: '文脈の持ち越し',
    what: '出力に対する、入力とキャッシュ読取の量の比。同じ会話を長く続けるほど大きくなりやすい',
    requires: '入力・出力・キャッシュ読取のトークン (AI usage report)',
  },
  S2: {
    id: 'S2',
    name: '高トークン日の集中',
    what: '1 日のトークン量が組織の中央値の数倍を超えた日の数と割合',
    requires: '日別のトークン',
  },
  S3: {
    id: 'S3',
    name: '1 利用日あたりの量',
    what: '利用した日 1 日あたりのリクエスト数 (無ければクレジット)。組織の中央値との比較',
    requires: '日付付きのリクエストまたはクレジット',
  },
  S4: {
    id: 'S4',
    name: '日内のモデル切替',
    what: '1 日に使った異なるモデル数の平均。話題や目的の切替が多い場合の弱い手がかり (複数モデルの併用自体は一般的)',
    requires: '日付とモデルのある明細',
  },
  S5: {
    id: 'S5',
    name: '高単価モデルでの持ち越し',
    what: '単価の高いモデルにトークンが集中し、かつ文脈の持ち越しが大きいか',
    requires: 'S1 と費用・トークン',
  },
};

export const SIGNAL_LEVEL_LABELS: Record<SignalLevel, string> = {
  none: '特記なし',
  watch: '参考',
  review: '確認を推奨',
  insufficient: 'データ不足',
};

/** 画面に常に添える注記 */
export const USAGE_INSIGHT_DISCLAIMER =
  '会話の内容は見ておらず、1 日単位の集計値からの推定です。利用方法を見直すきっかけとしてご覧ください。個人の評価を目的としたものではありません。';

/** 「確認を推奨」の場合に添える助言 (断定しない) */
export const USAGE_INSIGHT_ADVICE =
  '話題ごとに新しいセッションを始めると、毎回送られる文脈が小さくなり、コストを抑えられる場合があります。';

const T = USAGE_INSIGHT_THRESHOLDS;
const fmt = (n: number, d = 1): string => n.toLocaleString('en-US', { maximumFractionDigits: d });

/** シグナルの根拠を 1 文で説明する (断定せず、確認を勧める温度感) */
export function describeSignal(s: UsageSignal): string {
  if (s.level === 'insufficient') {
    return `判定に必要なデータが足りません (利用 ${s.samples} 日。${T.minActiveDays} 日以上、または対象の列が必要です)。`;
  }
  const ratio = s.ratio !== null ? `組織の中央値の ${fmt(s.ratio)} 倍` : '';
  switch (s.id) {
    case 'S1':
      return `出力に対する入力・キャッシュ読取の比が ${fmt(s.value ?? 0)} で、${ratio}です。`;
    case 'S2':
      return `1 日のトークン量が組織の中央値の ${T.s2.dayRatio} 倍を超えた日が ${s.detail?.high_days ?? 0} 日 (利用日の ${fmt((s.value ?? 0) * 100, 0)}%) あります。`;
    case 'S3':
      return `1 利用日あたり ${fmt(s.value ?? 0)} ${s.detail?.unit === 'credits' ? 'クレジット' : 'リクエスト'}で、${ratio}です。`;
    case 'S4':
      return `1 日に平均 ${fmt(s.value ?? 0)} 種類のモデルを使っています (最大 ${s.detail?.max_models_in_day ?? '-'} 種類)。`;
    case 'S5':
      return `単価の高いモデルにトークンの ${fmt((s.value ?? 0) * 100, 0)}% が集まっており、文脈の持ち越しも大きめです。`;
  }
}
