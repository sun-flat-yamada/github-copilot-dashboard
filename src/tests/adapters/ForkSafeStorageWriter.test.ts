import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { ForkSafeStorageWriter } from '../../adapters/storage/ForkSafeStorageWriter.js';

describe('ForkSafeStorageWriter Tests', () => {
  const tmpDir = path.resolve(process.cwd(), `.tmp_test_storage_writer_${Date.now()}`);

  it('satisfies IStorageWriter port and saves raw and processed data safely', () => {
    const writer = new ForkSafeStorageWriter({
      baseDir: tmpDir,
      isDemo: true,
    });

    const mockDate = '2026-09-01';
    const mockMetrics: any = {
      date: mockDate,
      total_active_users: 1,
      total_engaged_users: 1,
      copilot_ide_code_completions: { total_engaged_users: 1 },
      copilot_ide_chat: { total_engaged_users: 1, total_chats: 2 },
    };
    const mockSeats: any = [];
    const mockCostCenters: any = [];

    writer.saveRawDailyData(mockDate, mockMetrics, mockSeats, mockCostCenters);

    const [year, month] = mockDate.split('-');
    const savedRawFile = path.join(tmpDir, 'raw', year, month, `${mockDate}-raw.json`);
    assert.ok(fs.existsSync(savedRawFile));

    const content = JSON.parse(fs.readFileSync(savedRawFile, 'utf-8'));
    assert.equal(content.date, mockDate);
  });

  // クリーンアップ
  it('cleans up temporary storage', () => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
