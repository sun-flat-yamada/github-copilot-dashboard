import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { formatElapsedActivity } from '../../dashboard/src/utils/dateFormatters.js';
import { ANALYSIS_VIEW_REGISTRY } from '../types/views.js';

describe('User Table Redesign & Ranking Phasing-out Tests', () => {
  const monthlyTablePath = path.resolve(
    process.cwd(),
    'dashboard/src/components/monthly-report/MonthlyReportUserTable.tsx'
  );
  const userDetailTablePath = path.resolve(
    process.cwd(),
    'dashboard/src/components/UserDetailTable.tsx'
  );
  const actionColumnHeaderPath = path.resolve(
    process.cwd(),
    'dashboard/src/components/common/ActionColumnHeader.tsx'
  );

  describe('formatElapsedActivity utility tests', () => {
    const baseDate = new Date('2026-09-20T12:00:00Z');

    it('returns empty string for null, undefined, empty, or placeholder values', () => {
      assert.strictEqual(formatElapsedActivity(null, baseDate), '');
      assert.strictEqual(formatElapsedActivity(undefined, baseDate), '');
      assert.strictEqual(formatElapsedActivity('', baseDate), '');
      assert.strictEqual(formatElapsedActivity('   ', baseDate), '');
      assert.strictEqual(formatElapsedActivity('-', baseDate), '');
    });

    it('returns empty string for invalid date formats', () => {
      assert.strictEqual(formatElapsedActivity('invalid-date', baseDate), '');
    });

    it('handles ISO timestamps with hours and minutes elapsed', () => {
      // 30 seconds ago
      const justNow = new Date(baseDate.getTime() - 30 * 1000).toISOString();
      assert.strictEqual(formatElapsedActivity(justNow, baseDate), 'たった今');

      // 25 minutes ago
      const minsAgo = new Date(baseDate.getTime() - 25 * 60 * 1000).toISOString();
      assert.strictEqual(formatElapsedActivity(minsAgo, baseDate), '25分前');

      // 4 hours ago
      const hoursAgo = new Date(baseDate.getTime() - 4 * 3600 * 1000).toISOString();
      assert.strictEqual(formatElapsedActivity(hoursAgo, baseDate), '4時間前');

      // 2 days ago
      const daysAgo = new Date(baseDate.getTime() - 48 * 3600 * 1000).toISOString();
      assert.strictEqual(formatElapsedActivity(daysAgo, baseDate), '2日前');
    });

    it('handles date-only strings (YYYY-MM-DD)', () => {
      // 2026-09-20 on baseDate 2026-09-20
      assert.strictEqual(formatElapsedActivity('2026-09-20', baseDate), '本日');

      // 5 days ago: 2026-09-15
      assert.strictEqual(formatElapsedActivity('2026-09-15', baseDate), '5日前');

      // 46 days ago: 2026-08-05
      assert.strictEqual(formatElapsedActivity('2026-08-05', baseDate), '46日前');
    });

    it('gracefully handles future dates (returns 本日)', () => {
      const future = new Date(baseDate.getTime() + 3600 * 1000).toISOString();
      assert.strictEqual(formatElapsedActivity(future, baseDate), '本日');
    });
  });

  describe('MonthlyReportUserTable component structure', () => {
    it('verifies MonthlyReportUserTable has removed ranking terminology and podium medals', () => {
      assert.ok(fs.existsSync(monthlyTablePath), 'MonthlyReportUserTable.tsx must exist');
      const content = fs.readFileSync(monthlyTablePath, 'utf-8');

      // Title must NOT contain "ランキング"
      assert.match(content, /ユーザー別 利用・費用明細 \(\{filteredUsers\.length\}名\)/);
      assert.doesNotMatch(content, /ユーザー別 利用・費用明細 & ランキング/);

      // Table header must use '#' instead of '順位'
      assert.match(content, /<th[^>]*text-center[^>]*>#<\/th>/);
      assert.doesNotMatch(content, /<th[^>]*text-center[^>]*>順位<\/th>/);

      // CSV export header must use '#'
      assert.match(content, /const headers = \[\s*'#'/);

      // Must NOT contain medal emojis
      assert.doesNotMatch(content, /🥇/);
      assert.doesNotMatch(content, /🥈/);
      assert.doesNotMatch(content, /🥉/);

      // Must render record ID {index + 1}
      assert.match(content, /\{index \+ 1\}/);

      // Must format and display elapsed activity time
      assert.match(content, /formatElapsedActivity\(u\.last_activity_date\)/);

      // Action column header must use ActionColumnHeader
      assert.match(content, /<ActionColumnHeader \/>/);

      // Action column row must use icon-only buttons (no inline text labels)
      assert.doesNotMatch(content, /<span>詳細分析<\/span>/);
      assert.doesNotMatch(content, /<span>トレンド<\/span>/);
      assert.doesNotMatch(content, /<span>診断<\/span>/);
    });
  });

  describe('UserDetailTable component structure', () => {
    it('verifies UserDetailTable has removed ranking terminology and uses record ID #', () => {
      assert.ok(fs.existsSync(userDetailTablePath), 'UserDetailTable.tsx must exist');
      const content = fs.readFileSync(userDetailTablePath, 'utf-8');

      // Title must NOT contain "ランキング"
      assert.match(content, /ユーザー別 利用・活用明細/);
      assert.doesNotMatch(content, /ユーザー別 利用 & 活用ランキング明細/);

      // Sort criteria must not say "(採用ランキング)"
      assert.match(content, /<option value="acceptances"[^>]*>受諾数 降順<\/option>/);
      assert.doesNotMatch(content, /受諾数 降順 \(採用ランキング\)/);

      // Table header must use '#' instead of '順位'
      assert.match(content, /<th[^>]*text-center[^>]*>#<\/th>/);
      assert.doesNotMatch(content, /<th[^>]*text-center[^>]*>順位<\/th>/);

      // CSV export header must use '#'
      assert.match(content, /const headers = \[\s*'#'/);

      // Must NOT contain medal emojis
      assert.doesNotMatch(content, /🥇/);
      assert.doesNotMatch(content, /🥈/);
      assert.doesNotMatch(content, /🥉/);

      // Must render record ID {index + 1}
      assert.match(content, /\{index \+ 1\}/);

      // Action column header must use ActionColumnHeader
      assert.match(content, /<ActionColumnHeader \/>/);

      // Action column row must use icon-only buttons (no inline text labels)
      assert.doesNotMatch(content, /<span>詳細分析<\/span>/);
      assert.doesNotMatch(content, /<span>トレンド<\/span>/);
      assert.doesNotMatch(content, /<span>診断<\/span>/);
    });
  });

  describe('ActionColumnHeader component structure', () => {
    it('verifies ActionColumnHeader provides Info button and popover explaining all 3 actions', () => {
      assert.ok(fs.existsSync(actionColumnHeaderPath), 'ActionColumnHeader.tsx must exist');
      const content = fs.readFileSync(actionColumnHeaderPath, 'utf-8');

      // Must render label and Info icon button
      assert.match(content, /<span>アクション<\/span>/);
      assert.match(content, /<Info/);

      // Must explain the 3 actions in popover
      assert.match(content, /詳細分析/);
      assert.match(content, /トレンド/);
      assert.match(content, /診断/);

      // Must handle outside click and escape key
      assert.match(content, /handleClickOutside/);
      assert.match(content, /handleKeyDown/);
    });
  });

  describe('ANALYSIS_VIEW_REGISTRY view definitions', () => {
    it('verifies users view title and description have removed ranking phrasing', () => {
      const usersView = ANALYSIS_VIEW_REGISTRY.find((v) => v.id === 'users');
      assert.ok(usersView, 'users view must exist in registry');
      assert.strictEqual(usersView.title, 'ユーザー別利用明細');
      assert.strictEqual(usersView.description, '全ユーザーの稼働状況・推計費用・AI活用度の一覧');
      assert.doesNotMatch(usersView.title, /ランキング/);
      assert.doesNotMatch(usersView.description, /ランキング/);
    });
  });
});
