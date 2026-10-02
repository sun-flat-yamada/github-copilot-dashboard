/**
 * ユーザー別の使用量・トークン・単価・長大化の兆候を算出する純関数群 (SDD-06 §5)。
 *
 * - 取得できない値は null (0 や定数で埋めない)。
 * - 単価は分母と同じ種類の明細の費用だけで割る (シート料金などを混ぜない)。
 * - 兆候は 1 日単位の集計からの推定。会話の内容は扱わない。
 * - 組織の基準値は全ユーザーから作る (表示のフィルターで基準が動かない)。
 */
import type {
  SignalLevel,
  UsageInsight,
  UsageInsightDaily,
  UsageInsightModel,
  UsageSignal,
} from '../domain/entities/copilot.js';
import { USAGE_INSIGHT_THRESHOLDS as T } from './usage-insight-definitions.js';

/** 1 明細行から取り出した、算出に必要な値 */
export interface UsageRow {
  /** 日付なしの行は日別には載せない (合計には含む) */
  date: string;
  model?: string;
  /** requests 系の単位の数量 (それ以外は 0) */
  requests: number;
  /** 行が requests 系かどうか (単価の分母・分子の対応づけに使う) */
  isRequestRow: boolean;
  /** クレジット量。無ければ undefined */
  credits?: number;
  isCreditRow: boolean;
  /** 利用額 (gross, USD) */
  gross: number;
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  /** 内訳なしのトークン合計 */
  tokenTotal?: number;
}

interface DayAcc {
  requests: number;
  credits: number;
  tokens: number;
  hasTokens: boolean;
  models: Set<string>;
}

interface ModelAcc {
  tokens: number;
  gross: number;
}

export interface UserUsageAccumulator {
  rows: number;
  tokenRows: number;
  requests: number;
  requestGross: number;
  credits: number;
  hasCredits: boolean;
  creditGross: number;
  tokenGross: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** 内訳なしで合計だけを持つトークン */
  tokenTotalOnly: number;
  hasBreakdown: boolean;
  days: Map<string, DayAcc>;
  models: Map<string, ModelAcc>;
}

export function createUserUsageAccumulator(): UserUsageAccumulator {
  return {
    rows: 0,
    tokenRows: 0,
    requests: 0,
    requestGross: 0,
    credits: 0,
    hasCredits: false,
    creditGross: 0,
    tokenGross: 0,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    tokenTotalOnly: 0,
    hasBreakdown: false,
    days: new Map(),
    models: new Map(),
  };
}

const rowTokens = (r: UsageRow): number | undefined => {
  const parts = [r.input, r.output, r.cacheRead, r.cacheWrite];
  if (parts.some((p) => p !== undefined)) return parts.reduce<number>((s, p) => s + (p ?? 0), 0);
  return r.tokenTotal;
};

export function addUsageRow(acc: UserUsageAccumulator, r: UsageRow): void {
  acc.rows++;
  acc.requests += r.requests;
  if (r.isRequestRow) acc.requestGross += r.gross;
  if (r.credits !== undefined) {
    acc.credits += r.credits;
    acc.hasCredits = true;
  }
  if (r.isCreditRow) acc.creditGross += r.gross;

  const tokens = rowTokens(r);
  if (tokens !== undefined) {
    acc.tokenRows++;
    acc.tokenGross += r.gross;
    if ([r.input, r.output, r.cacheRead, r.cacheWrite].some((p) => p !== undefined)) {
      acc.hasBreakdown = true;
      acc.input += r.input ?? 0;
      acc.output += r.output ?? 0;
      acc.cacheRead += r.cacheRead ?? 0;
      acc.cacheWrite += r.cacheWrite ?? 0;
    } else {
      acc.tokenTotalOnly += tokens;
    }
  }

  const model = r.model?.trim();
  if (model && tokens !== undefined) {
    const m = acc.models.get(model) ?? { tokens: 0, gross: 0 };
    m.tokens += tokens;
    m.gross += r.gross;
    acc.models.set(model, m);
  }

  if (r.date) {
    const d = acc.days.get(r.date) ?? { requests: 0, credits: 0, tokens: 0, hasTokens: false, models: new Set<string>() };
    d.requests += r.requests;
    d.credits += r.credits ?? 0;
    if (tokens !== undefined) {
      d.tokens += tokens;
      d.hasTokens = true;
    }
    if (model) d.models.add(model);
    acc.days.set(r.date, d);
  }
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export interface OrgBaseline {
  /** 持ち越し比 (入力+キャッシュ読取)/出力 の中央値。判定に足るユーザーのみ */
  contextRatio: number | null;
  /** 1 日のトークン量の中央値 (全ユーザー日) */
  dayTokens: number | null;
  perDayRequests: number | null;
  perDayCredits: number | null;
  /** モデル別の 100 万トークンあたり利用額 */
  modelCostPerMillion: Record<string, number>;
  /** モデル別単価の中央値 */
  medianModelCostPerMillion: number | null;
}

const contextRatioOf = (a: UserUsageAccumulator): number | null =>
  a.hasBreakdown && a.output > 0 ? (a.input + a.cacheRead) / a.output : null;

const perDayOf = (a: UserUsageAccumulator, key: 'requests' | 'credits'): number | null => {
  if (a.days.size === 0) return null;
  const total = [...a.days.values()].reduce((s, d) => s + d[key], 0);
  return total > 0 ? total / a.days.size : null;
};

export function computeOrgBaseline(accs: Iterable<UserUsageAccumulator>): OrgBaseline {
  const ratios: number[] = [];
  const dayTokens: number[] = [];
  const perDayReq: number[] = [];
  const perDayCred: number[] = [];
  const modelAgg = new Map<string, ModelAcc>();

  for (const a of accs) {
    for (const d of a.days.values()) if (d.hasTokens) dayTokens.push(d.tokens);
    for (const [name, m] of a.models) {
      const x = modelAgg.get(name) ?? { tokens: 0, gross: 0 };
      x.tokens += m.tokens;
      x.gross += m.gross;
      modelAgg.set(name, x);
    }
    if (a.days.size < T.minActiveDays) continue;
    const r = contextRatioOf(a);
    if (r !== null) ratios.push(r);
    const pr = perDayOf(a, 'requests');
    if (pr !== null) perDayReq.push(pr);
    const pc = perDayOf(a, 'credits');
    if (pc !== null) perDayCred.push(pc);
  }

  const modelCostPerMillion: Record<string, number> = {};
  for (const [name, m] of modelAgg) {
    if (m.tokens > 0) modelCostPerMillion[name] = (m.gross / m.tokens) * 1e6;
  }
  return {
    contextRatio: median(ratios),
    dayTokens: median(dayTokens),
    perDayRequests: median(perDayReq),
    perDayCredits: median(perDayCred),
    modelCostPerMillion,
    medianModelCostPerMillion: median(Object.values(modelCostPerMillion)),
  };
}

const round = (n: number, d = 4): number => Number(n.toFixed(d));

const levelByRatio = (ratio: number, t: { watch: number; review: number }): SignalLevel =>
  ratio >= t.review ? 'review' : ratio >= t.watch ? 'watch' : 'none';

const signal = (
  id: UsageSignal['id'],
  level: SignalLevel,
  value: number | null,
  baseline: number | null,
  samples: number,
  detail?: UsageSignal['detail']
): UsageSignal => ({
  id,
  level,
  value: value === null ? null : round(value),
  baseline: baseline === null ? null : round(baseline),
  ratio: value !== null && baseline !== null && baseline > 0 ? round(value / baseline, 2) : null,
  samples,
  ...(detail ? { detail } : {}),
});

const RANK: Record<SignalLevel, number> = { insufficient: -1, none: 0, watch: 1, review: 2 };

export function computeUsageInsight(a: UserUsageAccumulator, base: OrgBaseline): UsageInsight {
  const activeDays = a.days.size;
  const enough = activeDays >= T.minActiveDays;

  const perDayReq = perDayOf(a, 'requests');
  const perDayCred = perDayOf(a, 'credits');
  const unit: 'requests' | 'credits' | null = perDayReq !== null ? 'requests' : perDayCred !== null ? 'credits' : null;
  const perActiveDay = unit === 'requests' ? perDayReq : unit === 'credits' ? perDayCred : null;

  let peak: UsageInsight['usage']['peak_day'] = null;
  if (unit) {
    for (const [date, d] of a.days) {
      const value = unit === 'requests' ? d.requests : d.credits;
      if (!peak || value > peak.value) peak = { date, value: round(value, 2), unit };
    }
  }

  const tokenTotal = a.input + a.output + a.cacheRead + a.cacheWrite + a.tokenTotalOnly;
  const hasTokens = a.tokenRows > 0;

  // ---- 兆候 ----
  const signals: UsageSignal[] = [];

  // S1 文脈の持ち越し
  const ratio = contextRatioOf(a);
  if (!enough || ratio === null || base.contextRatio === null) {
    signals.push(signal('S1', 'insufficient', ratio, base.contextRatio, activeDays));
  } else {
    signals.push(signal('S1', levelByRatio(ratio / base.contextRatio, T.s1), ratio, base.contextRatio, activeDays));
  }

  // S2 高トークン日の集中
  const tokenDays = [...a.days.values()].filter((d) => d.hasTokens);
  if (!enough || tokenDays.length < T.minActiveDays || base.dayTokens === null || base.dayTokens <= 0) {
    signals.push(signal('S2', 'insufficient', null, base.dayTokens, tokenDays.length));
  } else {
    const limit = base.dayTokens * T.s2.dayRatio;
    const high = tokenDays.filter((d) => d.tokens >= limit).length;
    const share = high / tokenDays.length;
    const level: SignalLevel =
      high >= T.s2.reviewDays && share >= T.s2.reviewShare ? 'review' : high >= T.s2.watchDays ? 'watch' : 'none';
    signals.push(signal('S2', level, share, null, tokenDays.length, { high_days: high, threshold_tokens: Math.round(limit) }));
  }

  // S3 1 利用日あたりの量
  const baseDay = unit === 'requests' ? base.perDayRequests : unit === 'credits' ? base.perDayCredits : null;
  if (!enough || unit === null || perActiveDay === null || baseDay === null) {
    signals.push(signal('S3', 'insufficient', perActiveDay, baseDay, activeDays, unit ? { unit } : undefined));
  } else {
    signals.push(signal('S3', levelByRatio(perActiveDay / baseDay, T.s3), perActiveDay, baseDay, activeDays, { unit }));
  }

  // S4 日内のモデル切替 (単独では「参考」止まり)
  const modelDays = [...a.days.values()].filter((d) => d.models.size > 0);
  if (!enough || modelDays.length < T.minActiveDays) {
    signals.push(signal('S4', 'insufficient', null, null, modelDays.length));
  } else {
    const avg = modelDays.reduce((s, d) => s + d.models.size, 0) / modelDays.length;
    const max = Math.max(...modelDays.map((d) => d.models.size));
    signals.push(signal('S4', avg >= T.s4.watch ? 'watch' : 'none', avg, T.s4.watch, modelDays.length, { max_models_in_day: max }));
  }

  // S5 高単価モデルでの持ち越し
  const s1 = signals[0];
  const medianCost = base.medianModelCostPerMillion;
  let highCostTokens = 0;
  let allModelTokens = 0;
  for (const [name, m] of a.models) {
    allModelTokens += m.tokens;
    const c = base.modelCostPerMillion[name];
    if (medianCost !== null && c !== undefined && c >= medianCost * T.s5.modelCostRatio) highCostTokens += m.tokens;
  }
  if (s1.level === 'insufficient' || allModelTokens === 0 || medianCost === null) {
    signals.push(signal('S5', 'insufficient', null, T.s5.tokenShare, activeDays));
  } else {
    const share = highCostTokens / allModelTokens;
    const level: SignalLevel = share >= T.s5.tokenShare && RANK[s1.level] >= 1 ? s1.level : 'none';
    signals.push(signal('S5', level, share, T.s5.tokenShare, activeDays));
  }

  // 総合: 有効なシグナルのうち「確認を推奨」が 1 つ以上なら推奨、「参考」が 2 つ以上なら参考
  // (S4 は弱い手がかりのため、単独では総合を上げない)
  const valid = signals.filter((s) => s.level !== 'insufficient');
  let level: SignalLevel;
  if (valid.length === 0) level = 'insufficient';
  else if (valid.some((s) => s.level === 'review')) level = 'review';
  else if (valid.filter((s) => s.level === 'watch').length >= 2) level = 'watch';
  else if (valid.some((s) => s.level === 'watch' && s.id !== 'S4')) level = 'watch';
  else level = 'none';

  const byModel: UsageInsightModel[] = [...a.models.entries()]
    .map(([model, m]) => ({
      model,
      tokens: m.tokens,
      gross_usd: round(m.gross),
      per_million_tokens_usd: m.tokens > 0 ? round((m.gross / m.tokens) * 1e6) : null,
    }))
    .sort((x, y) => y.gross_usd - x.gross_usd);

  const daily: UsageInsightDaily[] = [...a.days.entries()]
    .map(([date, d]) => ({
      date,
      requests: round(d.requests, 2),
      credits: round(d.credits, 2),
      tokens: d.hasTokens ? d.tokens : null,
      models: d.models.size,
    }))
    .sort((x, y) => x.date.localeCompare(y.date));

  return {
    usage: {
      requests: round(a.requests, 2),
      credits: a.hasCredits ? round(a.credits, 2) : null,
      active_days: activeDays,
      per_active_day: perActiveDay === null ? null : round(perActiveDay, 2),
      per_active_day_unit: unit,
      peak_day: peak,
    },
    tokens: hasTokens
      ? {
          input: a.hasBreakdown ? a.input : null,
          output: a.hasBreakdown ? a.output : null,
          cache_read: a.hasBreakdown ? a.cacheRead : null,
          cache_write: a.hasBreakdown ? a.cacheWrite : null,
          total: tokenTotal,
          coverage: round(a.tokenRows / a.rows, 3),
        }
      : null,
    unit_cost: {
      per_million_tokens_usd: hasTokens && tokenTotal > 0 ? round((a.tokenGross / tokenTotal) * 1e6) : null,
      per_request_usd: a.requests > 0 ? round(a.requestGross / a.requests) : null,
      per_credit_usd: a.hasCredits && a.credits > 0 ? round(a.creditGross / a.credits) : null,
    },
    by_model: byModel,
    signals,
    level,
    daily,
  };
}
