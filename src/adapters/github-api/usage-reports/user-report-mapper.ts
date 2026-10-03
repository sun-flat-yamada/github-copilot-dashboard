import {
  CopilotDailyMetrics,
  UserModelDailyUsage,
  UserUsageProfile,
} from '../../../domain/entities/copilot.js';
import type { AdoptionInputs } from '../../../domain/entities/agent-metrics.js';
import { AdoptionPhaseRule, ADOPTION_RULE_V2 } from '../../../domain/rules/AdoptionPhaseRule.js';
import { BASELINE_PRICING } from '../../../domain/pricing/pricing-catalog.js';
import { UserReportRow } from './user-report-schema.js';

/**
 * users-1-day レポートの行を、パイプラインの内部表現 (CopilotDailyMetrics / UserUsageProfile) へ写像する。
 *
 * 写像の方針:
 * - レポートが載せていない指標を 0 や定数で補わない。次の 3 つは Reports API の
 *   ユーザー単位レポートに存在しないため、「無い」ものとして表す:
 *   * copilot_dotcom_pull_requests.total_pr_summaries_created → null (PR 概要の作成数)
 *   * copilot_ide_chat の copy / insertion イベント数 → 0 (どの画面でも表示しない)
 *   * copilot_ide_agent (セッション数が無い) → 出力しない
 * - 未知の feature / model / ide / language は捨てずにそのまま集計する
 * - 補完の提案・受諾は feature = code_completion のみから集計する (チャット・CLI・エージェントを混ぜない。
 *   SDD-03 §2.2 の「サーフェス分離」)
 */

/** インライン補完の feature 値 */
export const COMPLETION_FEATURE = 'code_completion';
/** Copilot CLI の feature 値 */
export const CLI_FEATURE = 'copilot_cli';

const isChatFeature = (feature: string): boolean => feature.startsWith('chat_');
const num = (v: number | undefined): number => v ?? 0;

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

interface UserDayStats {
  suggestions: number;
  acceptances: number;
  linesSuggested: number;
  linesAccepted: number;
  chats: number;
  cli: number;
  /** チャット機能でのモデル別やり取り数 */
  models: Map<string, number>;
  credits: number | undefined;
  engaged: boolean;
}

/** 1 ユーザー・1 日の行から、機能別に切り分けた指標を取り出す */
export function userDayStats(row: UserReportRow): UserDayStats {
  let suggestions = 0;
  let acceptances = 0;
  let linesSuggested = 0;
  let linesAccepted = 0;
  let chats = 0;
  let cli = 0;

  for (const f of row.totals_by_feature ?? []) {
    if (f.feature === COMPLETION_FEATURE) {
      suggestions += num(f.code_generation_activity_count);
      acceptances += num(f.code_acceptance_activity_count);
      linesSuggested += num(f.loc_suggested_to_add_sum);
      linesAccepted += num(f.loc_added_sum);
    } else if (isChatFeature(f.feature)) {
      chats += num(f.user_initiated_interaction_count);
    } else if (f.feature === CLI_FEATURE) {
      cli += num(f.user_initiated_interaction_count);
    }
  }

  const models = new Map<string, number>();
  for (const mf of row.totals_by_model_feature ?? []) {
    if (!isChatFeature(mf.feature)) continue;
    const interactions = num(mf.user_initiated_interaction_count);
    if (interactions > 0) models.set(mf.model, (models.get(mf.model) ?? 0) + interactions);
  }

  const anyActivity =
    num(row.user_initiated_interaction_count) > 0 ||
    num(row.code_generation_activity_count) > 0 ||
    num(row.code_acceptance_activity_count) > 0 ||
    suggestions > 0 ||
    chats > 0 ||
    cli > 0;

  return {
    suggestions,
    acceptances,
    linesSuggested,
    linesAccepted,
    chats,
    cli,
    models,
    credits: row.ai_credits_used,
    engaged: anyActivity,
  };
}

/** 1 日分のユーザー行 (重複排除済み) から、全体の日次メトリクスを組み立てる */
export function buildDailyMetrics(day: string, rows: UserReportRow[]): CopilotDailyMetrics {
  let engagedUsers = 0;
  let completionUsers = 0;
  let chatUsers = 0;
  let cliUsers = 0;
  let totalChats = 0;
  let totalCli = 0;
  let creditsTotal = 0;
  let creditsKnown = false;
  let linesAdded = 0;
  let linesDeleted = 0;

  const languages = new Map<
    string,
    { users: Set<number>; suggestions: number; acceptances: number; linesSuggested: number; linesAccepted: number }
  >();
  const editors = new Map<string, Set<number>>();
  const chatModels = new Map<string, number>();
  const byMode = new Map<string, { lines_added: number; lines_deleted: number }>();

  rows.forEach((row, index) => {
    const stats = userDayStats(row);
    if (stats.engaged) engagedUsers++;
    if (stats.suggestions > 0) completionUsers++;
    if (stats.chats > 0) chatUsers++;
    if (stats.cli > 0) cliUsers++;
    totalChats += stats.chats;
    totalCli += stats.cli;
    if (stats.credits !== undefined) {
      creditsKnown = true;
      creditsTotal += stats.credits;
    }
    linesAdded += num(row.loc_added_sum);
    linesDeleted += num(row.loc_deleted_sum);

    for (const [model, interactions] of stats.models) {
      chatModels.set(model, (chatModels.get(model) ?? 0) + interactions);
    }

    for (const lf of row.totals_by_language_feature ?? []) {
      if (lf.feature !== COMPLETION_FEATURE) continue;
      const entry = languages.get(lf.language) ?? {
        users: new Set<number>(),
        suggestions: 0,
        acceptances: 0,
        linesSuggested: 0,
        linesAccepted: 0,
      };
      entry.suggestions += num(lf.code_generation_activity_count);
      entry.acceptances += num(lf.code_acceptance_activity_count);
      entry.linesSuggested += num(lf.loc_suggested_to_add_sum);
      entry.linesAccepted += num(lf.loc_added_sum);
      if (num(lf.code_generation_activity_count) > 0 || num(lf.code_acceptance_activity_count) > 0) {
        entry.users.add(index);
      }
      languages.set(lf.language, entry);
    }

    for (const ide of row.totals_by_ide ?? []) {
      const active =
        num(ide.user_initiated_interaction_count) > 0 ||
        num(ide.code_generation_activity_count) > 0 ||
        num(ide.code_acceptance_activity_count) > 0;
      if (!active) continue;
      const set = editors.get(ide.ide) ?? new Set<number>();
      set.add(index);
      editors.set(ide.ide, set);
    }

    for (const f of row.totals_by_feature ?? []) {
      const lines = num(f.loc_added_sum) + num(f.loc_deleted_sum);
      if (lines === 0) continue;
      const mode = byMode.get(f.feature) ?? { lines_added: 0, lines_deleted: 0 };
      mode.lines_added += num(f.loc_added_sum);
      mode.lines_deleted += num(f.loc_deleted_sum);
      byMode.set(f.feature, mode);
    }
  });

  const metrics: CopilotDailyMetrics = {
    date: day,
    total_active_users: rows.length,
    total_engaged_users: engagedUsers,
    copilot_ide_code_completions: {
      total_engaged_users: completionUsers,
      languages: Array.from(languages.entries()).map(([name, v]) => ({
        name,
        total_engaged_users: v.users.size,
        total_code_suggestions: v.suggestions,
        total_code_acceptances: v.acceptances,
        total_code_lines_suggested: v.linesSuggested,
        total_code_lines_accepted: v.linesAccepted,
      })),
      editors: Array.from(editors.entries()).map(([name, users]) => ({ name, total_engaged_users: users.size })),
    },
    copilot_ide_chat: {
      total_engaged_users: chatUsers,
      total_chats: totalChats,
      // Reports API のユーザー単位レポートには無い指標 (どの画面でも表示しない)
      total_chat_copy_events: 0,
      total_chat_insertion_events: 0,
      models: Array.from(chatModels.entries()).map(([name, total_chats]) => ({ name, total_chats })),
    },
    // github.com のチャットは機能として分離されない (chat_* に含まれる)
    copilot_dotcom_chat: { total_engaged_users: 0, total_chats: 0 },
    // PR 概要の作成数はユーザー単位レポートに無い。0 ではなく「無い」(null) とする
    copilot_dotcom_pull_requests: { total_engaged_users: 0, total_pr_summaries_created: null },
    copilot_in_cli: { total_engaged_users: cliUsers, total_cli_completions: totalCli },
    code_generation: {
      total_lines_added: linesAdded,
      total_lines_deleted: linesDeleted,
      by_mode: Object.fromEntries(byMode),
    },
  };
  if (creditsKnown) metrics.ai_credits = { total_used: round(creditsTotal, 4) };
  return metrics;
}

/** 日付 (YYYY-MM-DD) の昇順に並べた日次メトリクスを作る */
export function buildAllDailyMetrics(rowsByDay: Map<string, UserReportRow[]>): CopilotDailyMetrics[] {
  return Array.from(rowsByDay.keys())
    .sort()
    .map((day) => buildDailyMetrics(day, rowsByDay.get(day) ?? []));
}

/** ユーザー行の識別キー (user_id があればそれ、無ければ小文字のログイン名) */
export function userKey(row: Pick<UserReportRow, 'user_id' | 'user_login'>): string {
  return row.user_id !== undefined ? `id:${row.user_id}` : `login:${row.user_login.toLowerCase()}`;
}

/**
 * ユーザー別の利用プロファイル (日次履歴付き) を実測から作る。
 * 表示名・部署・Cost Center・組織・プランは、シートと属性マッピングで後段 (profile-enricher) が埋める。
 */
export function buildUserProfiles(rowsByDay: Map<string, UserReportRow[]>): UserUsageProfile[] {
  const byUser = new Map<string, { login: string; days: Array<{ day: string; row: UserReportRow }> }>();
  for (const [day, rows] of rowsByDay) {
    for (const row of rows) {
      const key = userKey(row);
      const entry = byUser.get(key) ?? { login: row.user_login, days: [] };
      entry.login = row.user_login; // 最新のログイン名を使う (改名に追従)
      entry.days.push({ day, row });
      byUser.set(key, entry);
    }
  }

  const creditUnitPrice = BASELINE_PRICING.creditUnitPriceUsd;

  // 採用成熟度 v2 の窓: 組織全体の最新日を終端とする直近 N 日 (ユーザーごとの履歴末尾ではない)
  const allDays = Array.from(rowsByDay.keys()).sort();
  const windowEnd = allDays[allDays.length - 1];
  const windowStart = windowEnd ? shiftDay(windowEnd, -(ADOPTION_RULE_V2.windowDays - 1)) : '';
  const observedDays = allDays.filter((d) => d >= windowStart && d <= windowEnd).length;
  // どの行にも used_agent が無ければ Agent 利用は「不明」(0 ではない)
  const agentSignalKnown = Array.from(rowsByDay.entries()).some(
    ([d, rows]) => d >= windowStart && rows.some((r) => r.used_agent !== undefined)
  );

  const profiles: UserUsageProfile[] = [];

  for (const { login, days } of byUser.values()) {
    days.sort((a, b) => a.day.localeCompare(b.day));
    const latestDay = days[days.length - 1].day;
    const cutoff28 = new Date(`${latestDay}T00:00:00Z`);
    cutoff28.setUTCDate(cutoff28.getUTCDate() - 27);
    const cutoff28Day = cutoff28.toISOString().slice(0, 10);

    const history: UserModelDailyUsage[] = [];
    const modelTotals: Record<string, number> = {};
    let totalChats = 0;
    let totalSuggestions = 0;
    let totalAcceptances = 0;
    let totalCost = 0;
    let credits28 = 0;
    let credits28Known = false;
    const win = { active: 0, completion: 0, chat: 0, agent: 0, cli: 0 };

    for (const { day, row } of days) {
      const s = userDayStats(row);
      if (day >= windowStart && day <= windowEnd) {
        if (s.engaged || row.used_agent || row.used_chat || row.used_cli) win.active++;
        if (s.suggestions > 0) win.completion++;
        if (s.chats > 0 || row.used_chat) win.chat++;
        if (row.used_agent) win.agent++;
        if (s.cli > 0 || row.used_cli) win.cli++;
      }
      const breakdown: Record<string, number> = {};
      for (const [model, interactions] of s.models) {
        breakdown[model] = interactions;
        modelTotals[model] = (modelTotals[model] ?? 0) + interactions;
      }
      const dailyCost = s.credits !== undefined ? round(s.credits * creditUnitPrice, 4) : 0;
      history.push({
        date: day,
        total_chats: s.chats,
        model_breakdown: breakdown,
        suggestions: s.suggestions,
        acceptances: s.acceptances,
        lines_suggested: s.linesSuggested,
        lines_accepted: s.linesAccepted,
        acceptance_rate: s.suggestions > 0 ? round(s.acceptances / s.suggestions) : 0,
        daily_cost_usd: dailyCost,
        ...(s.credits !== undefined ? { ai_credits_consumed: s.credits } : {}),
      });
      totalChats += s.chats;
      totalSuggestions += s.suggestions;
      totalAcceptances += s.acceptances;
      totalCost += dailyCost;
      if (s.credits !== undefined && day >= cutoff28Day) {
        credits28Known = true;
        credits28 += s.credits;
      }
    }

    const inputs: AdoptionInputs = {
      windowStart,
      windowEnd,
      windowDays: ADOPTION_RULE_V2.windowDays,
      observedDays,
      activeDays: win.active,
      completionDays: win.completion,
      chatDays: win.chat,
      agentDays: agentSignalKnown ? win.agent : null,
      cliDays: win.cli,
    };
    const adoption = AdoptionPhaseRule.evaluate(inputs);

    profiles.push({
      login,
      display_name: login,
      avatar_url: '',
      department: '',
      cost_center: '',
      organization: '',
      plan_type: 'unknown',
      total_chats: totalChats,
      total_suggestions: totalSuggestions,
      total_acceptances: totalAcceptances,
      acceptance_rate: totalSuggestions > 0 ? round(totalAcceptances / totalSuggestions) : 0,
      total_cost_usd: round(totalCost, 2),
      model_usage_totals: modelTotals,
      daily_history: history,
      ...(credits28Known ? { ai_credits_used_28d: round(credits28, 4) } : {}),
      adoption_inputs: inputs,
      ...(adoption.status === 'classified'
        ? { ai_adoption_phase: adoption.phase }
        : { adoption_unclassified_reason: adoption.reason }),
    });
  }

  return profiles.sort((a, b) => a.login.localeCompare(b.login));
}
