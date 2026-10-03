/**
 * Diagnostic v2 configuration (SDD-11 §4).
 *
 * Every threshold that decides whether a diagnosis may be shown (data sufficiency), how a signal strength is
 * banded, which days count as non-working, and how many people a team needs lives here, so it can be overridden
 * (`resolveDiagnosticConfig`) instead of being buried in the rule functions.
 * The signal rules themselves are still uncalibrated heuristics; see `CALIBRATION_PLAN`.
 */

export type DiagnosticPatternKey =
  | 'tab_spamming_roulette'
  | 'overkill_model_addiction'
  | 'context_blind_chat_churn'
  | 'passive_seat_disengaged'
  | 'off_hours_workload_spike'
  | 'model_cost_mismatch';

export interface PatternMinimums {
  /** Minimum number of active days in the window (omitted: not required) */
  minActiveDays?: number;
  /** Minimum calendar length of the window in days */
  minWindowDays?: number;
  minSuggestions?: number;
  minChats?: number;
  /** Minimum of (suggestions + chats) */
  minActions?: number;
}

export interface DiagnosticConfig {
  /** IANA time zone of the organization. Used only to resolve "today" when no data decides the window end */
  timezone: string;
  /** Working weekdays, 0 = Sunday ... 6 = Saturday (default Monday to Friday) */
  workingWeekdays: number[];
  /** Non-working dates (YYYY-MM-DD), e.g. national holidays and company holidays */
  holidays: string[];
  /** Minimum members before a team (or a team cell) is diagnosed. Smaller groups are never shown */
  minTeamSize: number;
  /** Minimum sample per pattern. Below it the pattern is "not evaluable" with a reason */
  minimums: Record<DiagnosticPatternKey, PatternMinimums>;
  /** Lower bounds (percent) of the signal strength bands */
  bandThresholds: { weak: number; medium: number; strong: number };
}

/** Japanese national holidays of 2026 (default calendar; override with `holidays` for other years/regions). */
export const DEFAULT_HOLIDAYS_JP_2026: readonly string[] = [
  '2026-01-01',
  '2026-01-12',
  '2026-02-11',
  '2026-02-23',
  '2026-03-20',
  '2026-04-29',
  '2026-05-03',
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
  '2026-07-20',
  '2026-08-11',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-10-12',
  '2026-11-03',
  '2026-11-23',
];

export const DEFAULT_DIAGNOSTIC_CONFIG: DiagnosticConfig = {
  timezone: 'Asia/Tokyo',
  workingWeekdays: [1, 2, 3, 4, 5],
  holidays: [...DEFAULT_HOLIDAYS_JP_2026],
  minTeamSize: 5,
  minimums: {
    tab_spamming_roulette: { minSuggestions: 30, minActiveDays: 3 },
    overkill_model_addiction: { minChats: 15, minActiveDays: 3 },
    context_blind_chat_churn: { minChats: 15, minActiveDays: 3 },
    passive_seat_disengaged: { minWindowDays: 7 },
    off_hours_workload_spike: { minActions: 30, minActiveDays: 3 },
    model_cost_mismatch: { minChats: 10, minActiveDays: 3 },
  },
  bandThresholds: { weak: 15, medium: 40, strong: 70 },
};

export interface DiagnosticConfigOverrides {
  timezone?: string;
  workingWeekdays?: number[];
  holidays?: string[];
  minTeamSize?: number;
  minimums?: Partial<Record<DiagnosticPatternKey, PatternMinimums>>;
  bandThresholds?: Partial<DiagnosticConfig['bandThresholds']>;
}

/** Merge overrides over the defaults. Invalid values fall back to the default (never throw). */
export function resolveDiagnosticConfig(overrides: DiagnosticConfigOverrides = {}): DiagnosticConfig {
  const base = DEFAULT_DIAGNOSTIC_CONFIG;
  const minimums = { ...base.minimums } as DiagnosticConfig['minimums'];
  for (const key of Object.keys(overrides.minimums || {}) as DiagnosticPatternKey[]) {
    if (key in minimums) minimums[key] = { ...minimums[key], ...overrides.minimums![key] };
  }
  const weekdays = (overrides.workingWeekdays || base.workingWeekdays).filter(
    (d) => Number.isInteger(d) && d >= 0 && d <= 6
  );
  const validHolidays = (overrides.holidays || base.holidays).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const minTeam = overrides.minTeamSize;
  return {
    timezone: isValidTimeZone(overrides.timezone) ? overrides.timezone! : base.timezone,
    workingWeekdays: weekdays.length > 0 ? weekdays : base.workingWeekdays,
    holidays: validHolidays,
    minTeamSize: typeof minTeam === 'number' && Number.isFinite(minTeam) && minTeam >= 1 ? Math.floor(minTeam) : base.minTeamSize,
    minimums,
    bandThresholds: { ...base.bandThresholds, ...(overrides.bandThresholds || {}) },
  };
}

function isValidTimeZone(tz: string | undefined): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Day of week (0 = Sunday) of a calendar date `YYYY-MM-DD`.
 * The date string is already a calendar date, so it is read as UTC: the result never depends on the TZ of the
 * machine running the code (`new Date('2026-09-05').getDay()` is Saturday in JST but Friday in America/Los_Angeles).
 */
export function dayOfWeekOf(date: string): number {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).getUTCDay();
}

/** A non-working day is a non-working weekday (default: weekend) or a listed holiday. */
export function isNonWorkingDay(date: string, config: DiagnosticConfig = DEFAULT_DIAGNOSTIC_CONFIG): boolean {
  const day = date.slice(0, 10);
  if (config.holidays.includes(day)) return true;
  return !config.workingWeekdays.includes(dayOfWeekOf(day));
}

/** Today's calendar date (YYYY-MM-DD) in the configured time zone. */
export function todayInTimeZone(config: DiagnosticConfig = DEFAULT_DIAGNOSTIC_CONFIG, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * The end of the analysis window. It is the latest date any member has data for (the organization's window end),
 * NOT each user's own last day: otherwise a user who stopped working weeks ago would get a window ending on
 * their last active day and look "active". With no data at all it is today in the configured time zone.
 */
export function resolveReferenceDate(
  histories: ReadonlyArray<ReadonlyArray<{ date: string }>>,
  config: DiagnosticConfig = DEFAULT_DIAGNOSTIC_CONFIG,
  now: Date = new Date()
): string {
  let latest = '';
  for (const h of histories) {
    for (const d of h) {
      if (d.date > latest) latest = d.date;
    }
  }
  return latest ? latest.slice(0, 10) : todayInTimeZone(config, now);
}

/** Calibration status of the signal rules, shown next to every result (SDD-11 §4.6). */
export const CALIBRATION_PLAN = {
  status: 'uncalibrated' as const,
  note: 'しきい値は未較正のヒューリスティックです。シグナル強度は確率ではなく、ルール成立度の目安です。',
  steps: [
    '1. 6 か月分以上の実測を溜め、各ルールの指標分布（パーセンタイル）を職種・チーム別に確認する',
    '2. 現場レビューで「妥当 / 過検知 / 見逃し」を付けた教師ラベルを 50 件以上集める',
    '3. しきい値を動かしたときの適合率・再現率を比較し、診断設定 (DiagnosticConfig) の値を更新する',
    '4. 較正後は強度の帯ごとの実績（的中率）を併記し、較正済みに表示を切り替える',
  ],
};
