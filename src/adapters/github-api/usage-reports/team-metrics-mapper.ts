import type { CopilotSeatAssignment, AssigningTeam } from '../../../domain/entities/copilot.js';
import type { TeamDailyMetrics } from '../../../domain/entities/agent-metrics.js';
import { UserReportRow } from './user-report-schema.js';
import { userDayStats } from './user-report-mapper.js';

/**
 * チーム別の日次メトリクスを、Reports API のユーザー単位レポート (users-1-day) と
 * シートの割り当てチーム (assigning_teams / assigning_team) の結合で組み立てる (SDD-03 §2.4)。
 *
 * - 廃止済みの `GET /orgs/{org}/teams/{team}/copilot/metrics` (2026-04 Sunset) は呼ばない。
 * - 入力はどちらも SDD-03 に記録済みの公式フィールドだけ (users-1-day: §2.1 / seats: §3.2)。
 *   `user-teams-1-day` の行スキーマは未検証のため使わない (フィールド名を推測しない)。
 * - チームの所属は「そのチーム経由でシートが割り当てられたユーザー」であり、チームの全メンバーではない
 *   (Enterprise / Organization 直接割り当てのシートはどのチームにも属さない)。
 * - 指標の切り出しは全体の日次メトリクスと同じ userDayStats を使う (提案・受諾は code_completion のみ。§2.2)。
 * - レポートに無い指標は補わない: total_agent_sessions は出力しない。ai_credits_used はどの行にも無ければ出力しない。
 */

/** シートが属するチーム (assigning_teams を優先し、無ければ assigning_team) */
export function seatTeams(seat: CopilotSeatAssignment): AssigningTeam[] {
  if (seat.assigning_teams && seat.assigning_teams.length > 0) return seat.assigning_teams;
  return seat.assigning_team ? [seat.assigning_team] : [];
}

/** チーム slug の比較は大文字小文字を区別しない (GitHub の slug は小文字だが、入力を正規化しておく) */
const norm = (value: string): string => value.trim().toLowerCase();

/** 指定チームに割り当てられたシートのログイン (小文字) とチーム名 */
export function resolveTeamMembers(
  teamSlug: string,
  seats: CopilotSeatAssignment[]
): { logins: Set<string>; teamName: string | null } {
  const target = norm(teamSlug);
  const logins = new Set<string>();
  let teamName: string | null = null;
  for (const seat of seats) {
    const team = seatTeams(seat).find((t) => norm(t.slug) === target);
    if (!team) continue;
    if (seat.assignee?.login) logins.add(norm(seat.assignee.login));
    teamName ??= team.name;
  }
  return { logins, teamName };
}

/**
 * 1 チームの日次メトリクス (日付昇順)。メンバーの行が 1 件も無い日は出力しない (0 で埋めない)。
 * rowsByDay は fetchMetrics が重複排除した日付 → ユーザー行。
 */
export function buildTeamDailyMetrics(
  teamSlug: string,
  rowsByDay: Map<string, UserReportRow[]>,
  seats: CopilotSeatAssignment[]
): TeamDailyMetrics[] {
  const { logins, teamName } = resolveTeamMembers(teamSlug, seats);
  if (logins.size === 0) return [];

  const result: TeamDailyMetrics[] = [];
  for (const day of [...rowsByDay.keys()].sort()) {
    const rows = (rowsByDay.get(day) ?? []).filter((row) => logins.has(norm(row.user_login)));
    if (rows.length === 0) continue;

    let engaged = 0;
    let suggestions = 0;
    let acceptances = 0;
    let chats = 0;
    let credits = 0;
    let creditsKnown = false;
    for (const row of rows) {
      const stats = userDayStats(row);
      if (stats.engaged) engaged++;
      suggestions += stats.suggestions;
      acceptances += stats.acceptances;
      chats += stats.chats;
      if (stats.credits !== undefined) {
        creditsKnown = true;
        credits += stats.credits;
      }
    }

    result.push({
      team_slug: teamSlug,
      team_name: teamName ?? teamSlug,
      date: day,
      total_active_users: rows.length,
      total_engaged_users: engaged,
      total_code_suggestions: suggestions,
      total_code_acceptances: acceptances,
      total_chat_turns: chats,
      ...(creditsKnown ? { ai_credits_used: Number(credits.toFixed(4)) } : {}),
    });
  }
  return result;
}
