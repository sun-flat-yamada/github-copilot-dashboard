import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { formatRetention } from '../../dashboard/src/utils/retentionLabel.js';

describe('About modal retention display (Issue #257)', () => {
  it('shows years and months for whole years', () => {
    assert.equal(formatRetention(60), '5 年 (60 か月)');
  });
  it('shows months only when not a whole number of years', () => {
    assert.equal(formatRetention(18), '18 か月');
  });
  it('falls back to the 60-month default for old indexes without the field', () => {
    assert.equal(formatRetention(undefined), '5 年 (60 か月)');
  });
  it('AboutModal no longer renders the legacy data_retention_days', () => {
    const src = fs.readFileSync(path.resolve('dashboard/src/components/AboutModal.tsx'), 'utf-8');
    assert.ok(!src.includes('data_retention_days'));
    assert.ok(src.includes('data_retention_months'));
  });
  it('PipelineOrchestrator writes data_retention_months from the retention setting, not a fixed 365', () => {
    const src = fs.readFileSync(path.resolve('src/application/pipeline/PipelineOrchestrator.ts'), 'utf-8');
    assert.ok(src.includes('data_retention_months: parseRetentionMonths('));
    assert.doesNotMatch(src, /data_retention_days:\s*365/);
  });
});
