import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('User Detail Table Enhancements & Compact Style Tests', () => {
  const readComponent = (relPath: string) => {
    const fullPath = path.resolve(process.cwd(), relPath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('UserDetailTable (unified: Live Metrics / Monthly Usage Report / Upload)', () => {
    const content = readComponent('dashboard/src/components/UserDetailTable.tsx');

    it('separates user handle and display name into distinct sortable columns', () => {
      // Distinct sort metrics
      assert.match(content, /'user'/);
      assert.match(content, /'display_name'/);

      // Distinct headers
      assert.match(content, /<span>ユーザー<\/span>/);
      assert.match(content, /<span>表示名<\/span>/);

      // Distinct cells in tbody
      assert.match(content, /@\{u\.login\}/);
      assert.match(content, /\{u\.display_name\}/);
    });

    it('inserts tag column directly before COST CENTER column', () => {
      // Check column ordering in header: ユーザー定義Gr -> タグ -> Cost Center
      const headerDeptIndex = content.indexOf('<span>ユーザー定義Gr</span>');
      const headerTagsIndex = content.indexOf('<span>タグ</span>');
      const headerCostCenterIndex = content.indexOf('<span>Cost Center</span>');

      assert.ok(headerDeptIndex !== -1, 'ユーザー定義Gr header must exist');
      assert.ok(headerTagsIndex !== -1, 'タグ header must exist');
      assert.ok(headerCostCenterIndex !== -1, 'Cost Center header must exist');
      assert.ok(
        headerDeptIndex < headerTagsIndex,
        'タグ column must be placed after ユーザー定義Gr'
      );
      assert.ok(
        headerTagsIndex < headerCostCenterIndex,
        'タグ column must be placed directly before Cost Center'
      );

      // Check CSV headers contain '表示名', 'ユーザー定義Gr (部署)', 'タグ', 'Cost Center' in order
      const csvDisplayIndex = content.indexOf("'表示名'");
      const csvDeptIndex = content.indexOf("'ユーザー定義Gr (部署)'");
      const csvTagIndex = content.indexOf("'タグ'");
      const csvCostCenterIndex = content.indexOf("'Cost Center'");

      assert.ok(csvDisplayIndex < csvDeptIndex);
      assert.ok(csvDeptIndex < csvTagIndex);
      assert.ok(csvTagIndex < csvCostCenterIndex);
    });

    it('enforces whitespace-nowrap and horizontal scroll to prevent line wraps on narrow windows', () => {
      assert.match(content, /whitespace-nowrap\s+min-w-max/);
      assert.match(content, /overflow-auto[^>]*max-h-\[600px\]/);
      assert.match(content, /whitespace-normal/, 'Drilldown row should allow normal wrapping');
    });

    it('applies compact padding style to table cells and headers', () => {
      assert.match(content, /px-2\.5\s+py-2/);
    });

    it('freezes the first three primary columns (index, user, display name) on horizontal scroll with proper stacking context', () => {
      // thead itself must NOT be sticky to prevent nested sticky containing-block conflicts
      assert.doesNotMatch(content, /<thead[^>]*sticky/);

      // Header sticky columns have z-30 (above both general th z-20 and sticky td z-10)
      assert.match(content, /sticky\s+top-0\s+left-0\s+z-30/);
      assert.match(content, /sticky\s+top-0\s+left-12\s+z-30/);
      assert.match(content, /sticky\s+top-0\s+left-\[188px\]\s+z-30/);

      // Body sticky columns have z-10 (behind headers so headers stay visible on vertical scroll)
      assert.match(content, /sticky\s+left-0\s+z-10/);
      assert.match(content, /sticky\s+left-12\s+z-10/);
      assert.match(content, /sticky\s+left-\[188px\]\s+z-10/);

      // Shadow border separation on display_name column
      assert.match(content, /shadow-\[3px_0_6px_-2px_rgba\(0,0,0,0\.5\)\]/);
    });

    it('provides toolbar quick navigation buttons and sticky bottom horizontal scroll controller', () => {
      // Toolbar buttons
      assert.match(content, /aria-label="左にスクロール"/);
      assert.match(content, /aria-label="右にスクロール"/);

      // Sticky bottom controller with slider at z-40
      assert.match(content, /sticky\s+bottom-0\s+z-40/);
      assert.match(content, /aria-label="水平スクロール位置"/);
      assert.match(content, /aria-label="下部バー左スクロール"/);
      assert.match(content, /aria-label="下部バー右スクロール"/);
    });

    it('replaces 任意仕訳グループ and similar phrasing with ユーザー定義Gr', () => {
      assert.doesNotMatch(content, /任意仕訳グループ/);
      assert.match(content, /<span>ユーザー定義Gr<\/span>/);
      assert.match(content, /すべてのユーザー定義Gr/);
      assert.match(content, /'ユーザー定義Gr \(部署\)'/);
    });
  });

  describe('Same table for every data source and view', () => {
    it('has no separate monthly-report user table: one component renders every source', () => {
      assert.ok(
        !fs.existsSync(path.resolve(process.cwd(), 'dashboard/src/components/monthly-report/MonthlyReportUserTable.tsx')),
        'MonthlyReportUserTable.tsx must not exist (SDD-07 §2.16)'
      );
      for (const f of [
        'dashboard/src/App.tsx',
        'dashboard/src/views/users/View.tsx',
        'dashboard/src/components/MonthlyReportView.tsx',
        'src/adapters/views/UsersViewPlugin.tsx',
        'src/adapters/views/OverviewViewPlugin.tsx',
        'src/adapters/views/BudgetViewPlugin.tsx',
      ]) {
        const src = readComponent(f);
        assert.doesNotMatch(src, /MonthlyReportUserTable/, `${f} must use UserDetailTable`);
      }
      assert.match(readComponent('dashboard/src/views/users/View.tsx'), /<UserDetailTable[\s\S]*?reportData=\{currentReportData\}/);
      assert.match(readComponent('dashboard/src/components/MonthlyReportView.tsx'), /<UserDetailTable[\s\S]*?reportData=\{reportData\}/);
    });

    it('builds both sources into the same row model before rendering', () => {
      const content = readComponent('dashboard/src/components/UserDetailTable.tsx');
      assert.match(content, /buildLiveRows\(data, userProfiles\)/);
      assert.match(content, /buildReportRows\(reportData\)/);
    });
  });

  describe('3-Axis Group Phrasing Consistency', () => {
    it('verifies CostAllocationCharts uses ユーザー定義Gr', () => {
      const content = readComponent('dashboard/src/components/CostAllocationCharts.tsx');
      assert.match(content, /'ユーザー定義Gr \(部署・PJ\)'/);
      assert.doesNotMatch(content, /'仕訳グループ \(部署・PJ\)'/);
    });

    it('verifies GroupUsageRanking uses ユーザー定義Gr', () => {
      const content = readComponent('dashboard/src/components/GroupUsageRanking.tsx');
      assert.match(content, /'ユーザー定義Gr \(部署・PJ\)'/);
      assert.doesNotMatch(content, /'任意仕訳グループ \(部署・PJ\)'/);
    });
  });
});
