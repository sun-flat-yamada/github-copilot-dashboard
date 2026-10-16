import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  DEFAULT_FILTER_CRITERIA,
  type IndexMetadata,
  type MonthlyReportAggregatedData,
} from '../types/copilot.js';
import {
  DATA_SELECTION_STORAGE_KEY,
  UPLOADED_DATA_STORAGE_KEY,
  sanitizeFilterCriteria,
  loadPersistedDataSelection,
  savePersistedDataSelection,
  loadPersistedUploadedData,
  savePersistedUploadedData,
  resolveInitialScopeSelection,
  resolveInitialReportMonth,
} from '../../dashboard/src/utils/dataSelectionStorage.js';
import { DemoModeService } from '../application/services/DemoModeService.js';

/**
 * Node テスト環境向けの軽量インメモリ localStorage / window モック
 */
function createMockWindow(search = '') {
  const store = new Map<string, string>();
  let quotaError = false;

  const localStorage = {
    getItem(key: string): string | null {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string): void {
      if (quotaError) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      store.set(key, String(value));
    },
    removeItem(key: string): void {
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    get length(): number {
      return store.size;
    },
    key(index: number): string | null {
      return Array.from(store.keys())[index] ?? null;
    },
    setQuotaExceeded(exceeded: boolean): void {
      quotaError = exceeded;
    },
  };

  return {
    location: {
      search,
      hostname: 'localhost',
      pathname: '/',
    },
    localStorage,
  };
}

const SAMPLE_INDEX_META: IndexMetadata = {
  repository: {
    owner: 'sun-flat-yamada',
    name: 'github-copilot-dashboard',
    is_fork: false,
  },
  generated_at: '2026-09-30T00:00:00Z',
  default_scopes: {
    latest_month: '2026-09',
    latest_day: '2026-09-30',
    latest_report: '2026-09',
  },
  available_months: ['2026-09', '2026-08', '2026-07'],
  all_recorded_months: ['2026-09', '2026-08', '2026-07', '2026-06'],
  available_days: ['2026-09-30', '2026-09-29', '2026-09-28'],
  available_reports: ['2026-09', '2026-08'],
  summary: {
    total_seats: 10,
    active_seats_30d: 8,
    idle_seats_30d: 2,
    total_monthly_spend_usd: 190,
    idle_waste_spend_usd: 38,
  },
};

const SAMPLE_UPLOADED_DATA: MonthlyReportAggregatedData = {
  report_month: '2026-08 (CSV)',
  source_type: 'local_drop',
  file_name: 'usage-2026-08.csv',
  parsed_at: '2026-09-01T00:00:00Z',
  overview: {
    total_gross_spend_usd: 120,
    total_discount_usd: 20,
    total_net_spend_usd: 100,
    total_requests: 500,
    total_active_users: 4,
    top_model: 'Claude 3.7 Sonnet',
    top_sku: 'Copilot Business',
  },
  by_department: {},
  by_cost_center: {},
  by_organization: {},
  model_breakdown: [
    {
      model_name: 'Claude 3.7 Sonnet',
      total_requests: 500,
      total_spend_usd: 100,
      percentage: 100,
      active_users: 4,
    },
  ],
  sku_breakdown: [
    {
      sku_name: 'Copilot Business',
      total_quantity: 500,
      unit_type: 'requests',
      total_spend_usd: 100,
      percentage: 100,
    },
  ],
  daily_trends: [
    {
      date: '2026-08-15',
      requests: 500,
      spend_usd: 100,
      active_users: 4,
    },
  ],
  user_details: [
    {
      login: 'alice-dev',
      display_name: 'Alice Dev',
      department: 'Engineering',
      cost_center: 'CC-100',
      organization: 'org-main',
      total_requests: 500,
      total_spend_usd: 100,
      primary_model: 'Claude 3.7 Sonnet',
      tags: ['Frontend'],
    },
  ],
};

describe('Data Selection Persistence (dataSelectionStorage & DemoModeService)', () => {
  let originalWindow: unknown;

  beforeEach(() => {
    originalWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = createMockWindow();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = originalWindow;
    }
  });

  describe('sanitizeFilterCriteria', () => {
    it('normalizes valid filter fields and deduplicates tags', () => {
      const result = sanitizeFilterCriteria({
        costCenter: 'FinTech-Division',
        organization: 'org-alpha',
        group: 'Core-Platform',
        tags: ['Frontend', 'Frontend', '  ', 123, 'SRE'],
        userPattern: 'alice|bob',
        userPatternIsRegex: true,
      });

      assert.deepEqual(result, {
        costCenter: 'FinTech-Division',
        organization: 'org-alpha',
        group: 'Core-Platform',
        tags: ['Frontend', 'SRE'],
        userPattern: 'alice|bob',
        userPatternIsRegex: true,
      });
    });

    it('resets invalid regex patterns to empty string while keeping other valid filter fields', () => {
      const result = sanitizeFilterCriteria({
        costCenter: 'FinTech-Division',
        organization: null,
        group: 'Core-Platform',
        tags: ['Frontend'],
        userPattern: '[unclosed-group',
        userPatternIsRegex: true,
      });

      assert.equal(result.costCenter, 'FinTech-Division');
      assert.equal(result.group, 'Core-Platform');
      assert.deepEqual(result.tags, ['Frontend']);
      assert.equal(result.userPattern, '');
      assert.equal(result.userPatternIsRegex, false);
    });

    it('returns default criteria when given null or non-object', () => {
      assert.deepEqual(sanitizeFilterCriteria(null), DEFAULT_FILTER_CRITERIA);
      assert.deepEqual(sanitizeFilterCriteria('invalid'), DEFAULT_FILTER_CRITERIA);
    });
  });

  describe('savePersistedDataSelection & loadPersistedDataSelection', () => {
    it('round-trips selection state through localStorage', () => {
      savePersistedDataSelection({
        activeSource: 'monthly_report',
        scopeType: 'daily',
        selectedKey: '2026-09-29',
        selectedReportMonth: '2026-08',
        filterCriteria: {
          costCenter: 'FinTech-Division',
          organization: 'org-alpha',
          group: 'all',
          tags: ['Frontend'],
          userPattern: 'alice',
          userPatternIsRegex: false,
        },
        isDemoMode: true,
      });

      const loaded = loadPersistedDataSelection();
      assert.ok(loaded);
      assert.equal(loaded.version, 1);
      assert.equal(loaded.activeSource, 'monthly_report');
      assert.equal(loaded.scopeType, 'daily');
      assert.equal(loaded.selectedKey, '2026-09-29');
      assert.equal(loaded.selectedReportMonth, '2026-08');
      assert.equal(loaded.filterCriteria.costCenter, 'FinTech-Division');
      assert.equal(loaded.filterCriteria.organization, 'org-alpha');
      assert.deepEqual(loaded.filterCriteria.tags, ['Frontend']);
      assert.equal(loaded.filterCriteria.userPattern, 'alice');
      assert.equal(loaded.isDemoMode, true);
    });

    it('handles corrupted JSON or invalid enum values gracefully without throwing', () => {
      const win = (globalThis as unknown as { window: ReturnType<typeof createMockWindow> }).window;
      win.localStorage.setItem(DATA_SELECTION_STORAGE_KEY, '{corrupted json');
      assert.equal(loadPersistedDataSelection(), null);

      win.localStorage.setItem(
        DATA_SELECTION_STORAGE_KEY,
        JSON.stringify({
          activeSource: 'unknown_source',
          scopeType: 'unknown_scope',
          selectedKey: 999,
          selectedReportMonth: null,
          filterCriteria: 'bad',
          isDemoMode: 'not_a_boolean',
        })
      );
      const sanitized = loadPersistedDataSelection();
      assert.ok(sanitized);
      assert.equal(sanitized.activeSource, 'live_metrics');
      assert.equal(sanitized.scopeType, 'monthly');
      assert.equal(sanitized.selectedKey, '');
      assert.equal(sanitized.selectedReportMonth, '');
      assert.deepEqual(sanitized.filterCriteria, DEFAULT_FILTER_CRITERIA);
      assert.equal(sanitized.isDemoMode, false);
    });
  });

  describe('savePersistedUploadedData & loadPersistedUploadedData', () => {
    it('saves, loads, and clears aggregated CSV data in localStorage', () => {
      assert.equal(savePersistedUploadedData(SAMPLE_UPLOADED_DATA), true);
      const loaded = loadPersistedUploadedData();
      assert.deepEqual(loaded, SAMPLE_UPLOADED_DATA);

      assert.equal(savePersistedUploadedData(null), true);
      assert.equal(loadPersistedUploadedData(), null);
    });

    it('returns false and clears stale entry when QuotaExceededError occurs', () => {
      const win = (globalThis as unknown as { window: ReturnType<typeof createMockWindow> }).window;
      assert.equal(savePersistedUploadedData(SAMPLE_UPLOADED_DATA), true);
      assert.ok(win.localStorage.getItem(UPLOADED_DATA_STORAGE_KEY));

      win.localStorage.setQuotaExceeded(true);
      assert.equal(savePersistedUploadedData(SAMPLE_UPLOADED_DATA), false);
      assert.equal(win.localStorage.getItem(UPLOADED_DATA_STORAGE_KEY), null);
      assert.equal(loadPersistedUploadedData(), null);
    });
  });

  describe('resolveInitialScopeSelection & resolveInitialReportMonth', () => {
    it('restores persisted monthly, daily, and custom scopes when present in index.json', () => {
      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'monthly',
          selectedKey: '2026-06', // in all_recorded_months
        }),
        { scopeType: 'monthly', selectedKey: '2026-06', hasLiveData: true }
      );

      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'daily',
          selectedKey: '2026-09-28',
        }),
        { scopeType: 'daily', selectedKey: '2026-09-28', hasLiveData: true }
      );

      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'custom',
          selectedKey: 'latest-30d',
        }),
        { scopeType: 'custom', selectedKey: 'latest-30d', hasLiveData: true }
      );

      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'custom',
          selectedKey: 'custom:2026-09-01_2026-09-15',
        }),
        { scopeType: 'custom', selectedKey: 'custom:2026-09-01_2026-09-15', hasLiveData: true }
      );
    });

    it('falls back to latest_month when persisted key no longer exists in index.json', () => {
      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'daily',
          selectedKey: '2025-01-01',
        }),
        { scopeType: 'monthly', selectedKey: '2026-09', hasLiveData: true }
      );

      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'monthly',
          selectedKey: '2024-12',
        }),
        { scopeType: 'monthly', selectedKey: '2026-09', hasLiveData: true }
      );

      assert.deepEqual(
        resolveInitialScopeSelection(SAMPLE_INDEX_META, {
          scopeType: 'custom',
          selectedKey: 'custom:2026-09-20_2026-09-01', // inverted range
        }),
        { scopeType: 'monthly', selectedKey: '2026-09', hasLiveData: true }
      );
    });

    it('resolves persisted report month or falls back to latest_report', () => {
      assert.equal(resolveInitialReportMonth(SAMPLE_INDEX_META, '2026-08'), '2026-08');
      assert.equal(resolveInitialReportMonth(SAMPLE_INDEX_META, '2025-01'), '2026-09');
      assert.equal(resolveInitialReportMonth(SAMPLE_INDEX_META, ''), '2026-09');
    });
  });

  describe('DemoModeService localStorage fallback & URL parameter precedence', () => {
    it('reads persisted isDemoMode when URL query params are absent', () => {
      assert.equal(DemoModeService.checkIsDemoMode(), false);

      savePersistedDataSelection({
        activeSource: 'live_metrics',
        scopeType: 'monthly',
        selectedKey: '2026-09',
        selectedReportMonth: '2026-09',
        filterCriteria: DEFAULT_FILTER_CRITERIA,
        isDemoMode: true,
      });

      assert.equal(DemoModeService.checkIsDemoMode(), true);
    });

    it('prioritizes explicit URL query parameters (?demo=false / ?demo=true) over localStorage', () => {
      savePersistedDataSelection({
        activeSource: 'live_metrics',
        scopeType: 'monthly',
        selectedKey: '2026-09',
        selectedReportMonth: '2026-09',
        filterCriteria: DEFAULT_FILTER_CRITERIA,
        isDemoMode: true,
      });

      const win = (globalThis as unknown as { window: ReturnType<typeof createMockWindow> }).window;
      win.location.search = '?demo=false';
      assert.equal(DemoModeService.checkIsDemoMode(), false);

      savePersistedDataSelection({
        activeSource: 'live_metrics',
        scopeType: 'monthly',
        selectedKey: '2026-09',
        selectedReportMonth: '2026-09',
        filterCriteria: DEFAULT_FILTER_CRITERIA,
        isDemoMode: false,
      });
      win.location.search = '?demo=true';
      assert.equal(DemoModeService.checkIsDemoMode(), true);
    });
  });
});
