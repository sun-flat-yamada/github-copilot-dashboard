import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('User Detail Table Enhancements & Compact Style Tests', () => {
  const readComponent = (relPath: string) => {
    const fullPath = path.resolve(process.cwd(), relPath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('UserDetailTable (Live Metrics / General)', () => {
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

    it('replaces 任意仕訳グループ and similar phrasing with ユーザー定義Gr', () => {
      assert.doesNotMatch(content, /任意仕訳グループ/);
      assert.match(content, /<span>ユーザー定義Gr<\/span>/);
      assert.match(content, /<option value="all">すべてのユーザー定義Gr<\/option>/);
      assert.match(content, /'ユーザー定義Gr \(部署\)'/);
    });
  });

  describe('MonthlyReportUserTable (Monthly Usage Report / Upload)', () => {
    const content = readComponent('dashboard/src/components/monthly-report/MonthlyReportUserTable.tsx');

    it('separates user handle and display name into distinct sortable columns', () => {
      assert.match(content, /'user'/);
      assert.match(content, /'display_name'/);

      assert.match(content, /<span>ユーザー<\/span>/);
      assert.match(content, /<span>表示名<\/span>/);

      assert.match(content, /@\{u\.login\}/);
      assert.match(content, /\{u\.display_name\}/);
    });

    it('inserts tag column directly before Cost Center column', () => {
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

      const csvDeptIndex = content.indexOf("'ユーザー定義Gr (部署)'");
      const csvTagIndex = content.indexOf("'Tags'");
      const csvCostCenterIndex = content.indexOf("'Cost Center'");

      assert.ok(csvDeptIndex < csvTagIndex);
      assert.ok(csvTagIndex < csvCostCenterIndex);
    });

    it('enforces whitespace-nowrap and horizontal scroll to prevent line wraps on narrow windows', () => {
      assert.match(content, /whitespace-nowrap\s+min-w-max/);
      assert.match(content, /overflow-auto[^>]*max-h-\[600px\]/);
      assert.match(content, /whitespace-normal/, 'Drilldown row should allow normal wrapping');
    });

    it('applies compact padding style to table cells and headers', () => {
      assert.match(content, /py-2\s+px-2\.5/);
    });

    it('replaces 任意仕訳グループ and similar phrasing with ユーザー定義Gr', () => {
      assert.doesNotMatch(content, /任意仕訳グループ/);
      assert.doesNotMatch(content, /<span>部署 \/ 仕訳グループ<\/span>/);
      assert.match(content, /<span>ユーザー定義Gr<\/span>/);
      assert.match(content, /'全 ユーザー定義Gr'/);
      assert.match(content, /'ユーザー定義Gr \(部署\)'/);
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
