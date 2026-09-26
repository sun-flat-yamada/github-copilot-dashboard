import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DemoModeService, checkIsDemoMode } from '../../application/services/DemoModeService.js';

describe('DemoModeService Tests', () => {
  it('resolves false when window is undefined', () => {
    const originalWindow = global.window;
    try {
      delete (global as any).window;
      assert.strictEqual(DemoModeService.checkIsDemoMode(), false);
      assert.strictEqual(checkIsDemoMode(), false);
    } finally {
      if (originalWindow !== undefined) {
        global.window = originalWindow;
      }
    }
  });

  it('detects demo query parameters correctly', () => {
    const originalWindow = global.window;
    try {
      // 1. ?demo=true
      (global as any).window = { location: { search: '?demo=true' } };
      assert.strictEqual(DemoModeService.checkIsDemoMode(), true);

      // 2. ?mock=true
      (global as any).window = { location: { search: '?mock=true' } };
      assert.strictEqual(DemoModeService.checkIsDemoMode(), true);

      // 3. ?mode=demo
      (global as any).window = { location: { search: '?mode=demo' } };
      assert.strictEqual(DemoModeService.checkIsDemoMode(), true);

      // 4. ?data=demo
      (global as any).window = { location: { search: '?data=demo' } };
      assert.strictEqual(DemoModeService.checkIsDemoMode(), true);

      // 5. Empty search
      (global as any).window = { location: { search: '' } };
      assert.strictEqual(DemoModeService.checkIsDemoMode(), false);

      // 6. Other search parameter
      (global as any).window = { location: { search: '?scope=monthly' } };
      assert.strictEqual(DemoModeService.checkIsDemoMode(), false);
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        global.window = originalWindow;
      }
    }
  });
});
