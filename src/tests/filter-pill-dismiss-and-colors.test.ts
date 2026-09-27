import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { getFilterSummaryBadges } from '../../dashboard/src/utils/filterEngine';
import { FilterCriteria } from '../types/copilot';

describe('Filter Pill Click-to-Dismiss & Category Color Coordination Tests', () => {
  const rootDir = process.cwd();
  const selectorPath = path.resolve(
    rootDir,
    'dashboard/src/components/layout/ActiveDataSelector.tsx'
  );
  const modalPath = path.resolve(
    rootDir,
    'dashboard/src/components/layout/DataSelectionModal.tsx'
  );
  const specJaPath = path.resolve(
    rootDir,
    'docs/specifications/07_dashboard_ui_ux_spec.ja.md'
  );
  const specEnPath = path.resolve(
    rootDir,
    'docs/specifications/07_dashboard_ui_ux_spec.md'
  );

  describe('1. Filter Engine Category Type Differentiation', () => {
    it('returns specific category types for each filter criterion', () => {
      const criteria: FilterCriteria = {
        costCenter: 'CC-AI-Lab',
        organization: 'MyOrg',
        group: 'Platform',
        tags: ['Frontend', 'React'],
        userPattern: 'octocat',
        userPatternIsRegex: false,
      };

      const badges = getFilterSummaryBadges(criteria);
      assert.strictEqual(badges.length, 6);

      const ccBadge = badges.find((b) => b.key === 'costCenter');
      assert.ok(ccBadge, 'costCenter badge must exist');
      assert.strictEqual(ccBadge?.type, 'costCenter', 'costCenter badge type must be "costCenter"');

      const orgBadge = badges.find((b) => b.key === 'organization');
      assert.ok(orgBadge, 'organization badge must exist');
      assert.strictEqual(orgBadge?.type, 'organization', 'organization badge type must be "organization"');

      const groupBadge = badges.find((b) => b.key === 'group');
      assert.ok(groupBadge, 'group badge must exist');
      assert.strictEqual(groupBadge?.type, 'group', 'group badge type must be "group"');

      const tagBadges = badges.filter((b) => b.key.startsWith('tag:'));
      assert.strictEqual(tagBadges.length, 2);
      tagBadges.forEach((tb) => {
        assert.strictEqual(tb.type, 'tag', 'tag badge type must be "tag"');
      });

      const userBadge = badges.find((b) => b.key === 'userPattern');
      assert.ok(userBadge, 'userPattern badge must exist');
      assert.strictEqual(userBadge?.type, 'user', 'userPattern badge type must be "user"');
    });
  });

  describe('2. ActiveDataSelector Click-to-Dismiss & Badge Styling', () => {
    it('verifies ActiveDataSelector implements individual filter removal with stopPropagation', () => {
      const content = fs.readFileSync(selectorPath, 'utf-8');

      // handleRemoveBadge definition
      assert.match(
        content,
        /handleRemoveBadge/,
        'ActiveDataSelector must implement handleRemoveBadge handler'
      );
      assert.match(
        content,
        /e\.stopPropagation\(\)/,
        'handleRemoveBadge must invoke e.stopPropagation() to prevent modal launch'
      );

      // Criteria resets per key
      assert.match(
        content,
        /costCenter:\s*['"]all['"]/,
        'Must support resetting costCenter to "all"'
      );
      assert.match(
        content,
        /organization:\s*['"]all['"]/,
        'Must support resetting organization to "all"'
      );
      assert.match(
        content,
        /group:\s*['"]all['"]/,
        'Must support resetting group to "all"'
      );
      assert.match(
        content,
        /userPattern:\s*['"]['"]/,
        'Must support resetting userPattern to empty string'
      );
      assert.match(
        content,
        /tags:\s*\(filterCriteria\.tags\s*\|\|\s*\[\]\)\.filter/,
        'Must support filtering out removed tag from tags array'
      );
    });

    it('verifies ActiveDataSelector implements accessible clickable pill elements with distinct color classes', () => {
      const content = fs.readFileSync(selectorPath, 'utf-8');

      // Category color mapping
      assert.match(content, /getBadgeColorClass/, 'Must implement getBadgeColorClass helper');
      assert.match(content, /amber-950/, 'CostCenter badges must use amber theme');
      assert.match(content, /blue-950/, 'Organization badges must use blue theme');
      assert.match(content, /purple-950/, 'Group badges must use purple theme');
      assert.match(content, /rose-950/, 'Tag badges must use rose theme');
      assert.match(content, /cyan-950/, 'UserPattern badges must use cyan theme');

      // Clickable badge accessibility
      assert.match(content, /role=["']button["']/, 'Filter badges must have role="button"');
      assert.match(content, /tabIndex=\{0\}/, 'Filter badges must have tabIndex={0} for keyboard navigation');
      assert.match(content, /onKeyDown=\{/, 'Filter badges must support keyboard interaction');
      assert.match(content, /title=\{`クリックして「\$\{b\.label\}」フィルタを解除`\}/, 'Must provide dismiss tooltip');
    });
  });

  describe('3. DataSelectionModal Category Color Coordination', () => {
    it('verifies DataSelectionModal matches category colors with header badges', () => {
      const content = fs.readFileSync(modalPath, 'utf-8');

      // Category A: CostCenter (Amber) & Organization (Blue)
      assert.match(content, /text-amber-400/, 'CostCenter header/icon must use amber text color');
      assert.match(content, /focus:ring-amber-500/, 'CostCenter input must focus with amber ring');
      assert.match(content, /text-blue-400/, 'Organization header/icon must use blue text color');
      assert.match(content, /focus:ring-blue-500/, 'Organization input must focus with blue ring');

      // Category B: Group (Purple) & Tag (Rose)
      assert.match(content, /text-purple-400/, 'Group header/icon must use purple text color');
      assert.match(content, /focus:ring-purple-500/, 'Group input must focus with purple ring');
      assert.match(content, /text-rose-400/, 'Tag header/icon must use rose text color');
      assert.match(content, /bg-rose-600/, 'Tag active button must use bg-rose-600');

      // Category C: User (Cyan)
      assert.match(content, /text-cyan-400/, 'UserPattern header/icon must use cyan text color');
      assert.match(content, /focus:ring-cyan-500/, 'UserPattern input must focus with cyan ring');
    });
  });

  describe('4. Specification Documentation Synchrony', () => {
    it('verifies SDD documents reflect click-to-dismiss and unified category colors', () => {
      const jaSpec = fs.readFileSync(specJaPath, 'utf-8');
      const enSpec = fs.readFileSync(specEnPath, 'utf-8');

      assert.match(
        jaSpec,
        /バッジクリックによる該当フィルタの個別即時解除/,
        'ja spec must document pill click dismissal'
      );
      assert.match(
        jaSpec,
        /カテゴリ別カラー識別.*モーダル配色調和/,
        'ja spec must document category color coordination'
      );
      assert.match(
        jaSpec,
        /CostCenter.*Amber.*Organization.*Blue.*ユーザー定義Gr.*Purple.*Tag.*Rose/s,
        'ja spec must list all category colors'
      );

      assert.match(
        enSpec,
        /Click-to-Dismiss Filter Pills/,
        'en spec must document pill click dismissal'
      );
      assert.match(
        enSpec,
        /Category-Specific Color Coordination/,
        'en spec must document category color coordination'
      );
      assert.match(
        enSpec,
        /CostCenter.*Amber.*Organization.*Blue.*UserDefinedGroup.*Purple.*Tag.*Rose/s,
        'en spec must list all category colors'
      );
    });
  });
});
