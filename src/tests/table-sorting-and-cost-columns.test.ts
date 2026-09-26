import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';

describe('Table Sorting & Separate Cost/Overage Columns Contract Tests', () => {
  const readComponent = (relPath: string) => {
    const fullPath = path.resolve(process.cwd(), relPath);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  describe('MonthlyReportUserTable', () => {
    const content = readComponent('dashboard/src/components/monthly-report/MonthlyReportUserTable.tsx');

    it('separates usage cost and excess billing into two distinct columns', () => {
      assert.match(content, /利用費用\s*\(USD\)/);
      assert.match(content, /超過請求\s*\(USD\)/);
      // Ensure they are not in the same th
      assert.doesNotMatch(content, /<th[^>]*>[^<]*利用費用[^<]*超過請求[^<]*<\/th>/);
    });

    it('implements interactive sorting for all user metrics', () => {
      assert.match(content, /type MonthlyUserSortKey\s*=/);
      assert.match(content, /'spend'/);
      assert.match(content, /'excess'/);
      assert.match(content, /handleSort\('spend'\)/);
      assert.match(content, /handleSort\('excess'\)/);
      assert.match(content, /filteredUsers\s*=\s*useMemo/);
    });
  });

  describe('MonthlyReportCharts (3-Axis Allocation Table)', () => {
    const content = readComponent('dashboard/src/components/monthly-report/MonthlyReportCharts.tsx');

    it('separates usage cost and excess billing into two distinct columns', () => {
      assert.match(content, /利用費用\s*\(USD\)/);
      assert.match(content, /超過請求\s*\(USD\)/);
    });

    it('implements interactive sorting across all allocation columns', () => {
      assert.match(content, /type GroupSortKey\s*=/);
      assert.match(content, /'cost'/);
      assert.match(content, /'excess'/);
      assert.match(content, /handleGroupSort\('cost'\)/);
      assert.match(content, /handleGroupSort\('excess'\)/);
      assert.match(content, /sortedTableSummaries\s*=\s*useMemo/);
    });
  });

  describe('UserDetailTable', () => {
    const content = readComponent('dashboard/src/components/UserDetailTable.tsx');

    it('separates usage cost and excess billing into two distinct columns', () => {
      assert.match(content, /利用費用/);
      assert.match(content, /超過請求\s*\(USD\)/);
    });

    it('supports sorting by both cost and excess', () => {
      assert.match(content, /'excess'/);
      assert.match(content, /handleSort\('cost'\)/);
      assert.match(content, /handleSort\('excess'\)/);
      assert.match(content, /colSpan=\{hasUsageMetrics \? 14 : 10\}/);
    });
  });

  describe('GroupUsageRanking', () => {
    const content = readComponent('dashboard/src/components/GroupUsageRanking.tsx');

    it('separates usage cost and excess billing into two distinct columns', () => {
      assert.match(content, /利用料金\s*\(USD\)/);
      assert.match(content, /超過請求\s*\(USD\)/);
    });

    it('implements interactive sorting for both cost and excess', () => {
      assert.match(content, /type SortMetric\s*=/);
      assert.match(content, /'cost'/);
      assert.match(content, /'excess'/);
      assert.match(content, /handleSort\('cost'\)/);
      assert.match(content, /handleSort\('excess'\)/);
      assert.match(content, /colSpan=\{10\}/);
    });
  });

  describe('AdoptionMaturityView', () => {
    const content = readComponent('dashboard/src/components/views/AdoptionMaturityView.tsx');

    it('implements interactive column sorting for the team breakdown table', () => {
      assert.match(content, /type TeamBreakdownSortKey\s*=/);
      assert.match(content, /handleSort\('teamName'\)/);
      assert.match(content, /handleSort\('totalUsers'\)/);
      assert.match(content, /handleSort\('no_cohort'\)/);
      assert.match(content, /handleSort\('code_first'\)/);
      assert.match(content, /handleSort\('agent_first'\)/);
      assert.match(content, /handleSort\('multi_agent'\)/);
      assert.match(content, /sortedTeamBreakdown/);
    });
  });

  describe('AgentActivityView', () => {
    const content = readComponent('dashboard/src/components/views/AgentActivityView.tsx');

    it('implements interactive column sorting for the team activity table', () => {
      assert.match(content, /type AgentTeamSortKey\s*=/);
      assert.match(content, /handleSort\('teamName'\)/);
      assert.match(content, /handleSort\('sessions'\)/);
      assert.match(content, /handleSort\('engagedUsers'\)/);
      assert.match(content, /handleSort\('adoptionRate'\)/);
      assert.match(content, /sortedTeams/);
    });
  });

  describe('CreditsView', () => {
    const content = readComponent('dashboard/src/components/views/CreditsView.tsx');

    it('implements interactive column sorting for top consumers table', () => {
      assert.match(content, /type CreditsConsumerSortKey\s*=/);
      assert.match(content, /handleSort\('login'\)/);
      assert.match(content, /handleSort\('department'\)/);
      assert.match(content, /handleSort\('costCenter'\)/);
      assert.match(content, /handleSort\('credits'\)/);
      assert.match(content, /handleSort\('costUsd'\)/);
      assert.match(content, /sortedConsumers/);
    });
  });

  describe('ModelRadarView', () => {
    const content = readComponent('dashboard/src/components/ModelRadarView.tsx');

    it('provides multi-column sort headers and quick sort bar', () => {
      assert.match(content, /handleSort\('overall'\)/);
      assert.match(content, /handleSort\('swe'\)/);
      assert.match(content, /handleSort\('speed'\)/);
      assert.match(content, /handleSort\('cost'\)/);
      assert.match(content, /handleSort\('usage'\)/);
      assert.match(content, /handleSort\('context'\)/);
    });
  });
});
