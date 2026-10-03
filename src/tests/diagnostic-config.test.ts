import test from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_DIAGNOSTIC_CONFIG,
  dayOfWeekOf,
  isNonWorkingDay,
  resolveDiagnosticConfig,
  resolveReferenceDate,
  todayInTimeZone,
} from '../processor/diagnostic-config.js';
import { diagnoseOffHoursWorkload } from '../processor/inefficiency-rules.js';
import { InefficiencyDiagnosticEngine } from '../processor/inefficiency-diagnostic.js';
import { UserModelDailyUsage, UserUsageProfile } from '../types/copilot.js';

function withTimeZone<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

function day(date: string, chats = 10, suggestions = 10): UserModelDailyUsage {
  return {
    date,
    total_chats: chats,
    model_breakdown: { 'gpt-4o': chats },
    suggestions,
    acceptances: Math.round(suggestions * 0.3),
    lines_suggested: 100,
    lines_accepted: 30,
    acceptance_rate: 0.3,
    daily_cost_usd: 0.1,
  };
}

test('weekday is independent of the process time zone (2026-09-05 is a Saturday)', () => {
  for (const tz of ['Asia/Tokyo', 'America/Los_Angeles', 'UTC', 'Pacific/Kiritimati']) {
    withTimeZone(tz, () => {
      assert.strictEqual(dayOfWeekOf('2026-09-05'), 6, tz);
      assert.strictEqual(dayOfWeekOf('2026-09-06'), 0, tz);
      assert.strictEqual(dayOfWeekOf('2026-09-07'), 1, tz);
    });
  }
  // The former implementation depended on the time zone (documents why it was replaced)
  const legacy = (tz: string) => withTimeZone(tz, () => new Date('2026-09-05').getDay());
  assert.notStrictEqual(legacy('Asia/Tokyo'), legacy('America/Los_Angeles'));
});

test('non-working day: weekend and holiday calendar, configurable', () => {
  assert.strictEqual(isNonWorkingDay('2026-09-05'), true); // Saturday
  assert.strictEqual(isNonWorkingDay('2026-09-04'), false); // Friday
  assert.strictEqual(isNonWorkingDay('2026-09-21'), true); // Respect for the Aged Day (Monday)
  assert.strictEqual(isNonWorkingDay('2026-09-24'), false);
  const custom = resolveDiagnosticConfig({ holidays: ['2026-09-24'], workingWeekdays: [0, 1, 2, 3, 4] });
  assert.strictEqual(isNonWorkingDay('2026-09-24', custom), true); // company holiday
  assert.strictEqual(isNonWorkingDay('2026-09-06', custom), false); // Sunday is a working day here
  assert.strictEqual(isNonWorkingDay('2026-09-04', custom), true); // Friday is not
});

test('invalid configuration values fall back to defaults', () => {
  const c = resolveDiagnosticConfig({
    timezone: 'Not/AZone',
    workingWeekdays: [9, -1],
    holidays: ['bad', '2026-12-31'],
    minTeamSize: 0,
  });
  assert.strictEqual(c.timezone, DEFAULT_DIAGNOSTIC_CONFIG.timezone);
  assert.deepStrictEqual(c.workingWeekdays, DEFAULT_DIAGNOSTIC_CONFIG.workingWeekdays);
  assert.deepStrictEqual(c.holidays, ['2026-12-31']);
  assert.strictEqual(c.minTeamSize, 5);
  const t = resolveDiagnosticConfig({ minimums: { tab_spamming_roulette: { minSuggestions: 10 } } });
  assert.strictEqual(t.minimums.tab_spamming_roulette.minSuggestions, 10);
  assert.strictEqual(t.minimums.tab_spamming_roulette.minActiveDays, 3); // merged, not replaced
});

test('today is resolved in the configured time zone', () => {
  const now = new Date('2026-09-05T20:00:00Z'); // 05:00 on 09-06 in JST, 13:00 on 09-05 in LA
  assert.strictEqual(todayInTimeZone(resolveDiagnosticConfig({ timezone: 'Asia/Tokyo' }), now), '2026-09-06');
  assert.strictEqual(todayInTimeZone(resolveDiagnosticConfig({ timezone: 'America/Los_Angeles' }), now), '2026-09-05');
});

test('off-hours workload uses the calendar: a holiday counts as non-working', () => {
  // 2026-09-21 (Mon, holiday) and 2026-09-22 (Tue, citizens holiday) carry all of the activity
  const history = [day('2026-09-21', 20, 20), day('2026-09-22', 20, 20), day('2026-09-24', 1, 1)];
  const holidayAware = diagnoseOffHoursWorkload(history);
  const weekendOnly = diagnoseOffHoursWorkload(
    history,
    resolveDiagnosticConfig({ holidays: [] })
  );
  assert.ok(holidayAware.probabilityPercent > weekendOnly.probabilityPercent);
  // result is identical in every time zone
  const a = withTimeZone('Asia/Tokyo', () => diagnoseOffHoursWorkload(history).probabilityPercent);
  const b = withTimeZone('America/Los_Angeles', () => diagnoseOffHoursWorkload(history).probabilityPercent);
  assert.strictEqual(a, b);
});

test('window end is the organization latest date, not the user last active day', () => {
  assert.strictEqual(resolveReferenceDate([[day('2026-09-01')], [day('2026-09-20')]]), '2026-09-20');
  const idle: UserUsageProfile = {
    login: 'idle-user',
    display_name: '',
    avatar_url: '',
    department: '',
    cost_center: '',
    organization: 'org-test',
    plan_type: 'enterprise',
    total_chats: 0,
    total_suggestions: 0,
    total_acceptances: 0,
    acceptance_rate: 0,
    total_cost_usd: 0,
    model_usage_totals: {},
    daily_history: [day('2026-08-01'), day('2026-08-02'), day('2026-08-03')],
  } as unknown as UserUsageProfile;
  const active = { ...idle, login: 'active-user', daily_history: [day('2026-09-20')] } as UserUsageProfile;
  const result = InefficiencyDiagnosticEngine.diagnoseUser(idle, '30d', undefined, [idle, active]);
  // The idle user's own last day is 08-03, but the window ends on 09-20 and contains none of their days
  assert.strictEqual(result.period.endDate, '2026-09-20');
  assert.strictEqual(result.period.activeDays, 0);
});
