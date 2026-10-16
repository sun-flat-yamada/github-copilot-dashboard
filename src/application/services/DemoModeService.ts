export const DATA_SELECTION_STORAGE_KEY = 'copilot_dashboard_data_selection';

/**
 * DemoModeService manages demo/mock mode detection for the dashboard.
 * Extracted from legacy hooks into an Application Service.
 */
export class DemoModeService {
  /**
   * Determine whether DEMO (mock/simulation) mode should be activated based on
   * URL search parameters, environment variables, or persisted user selection.
   */
  public static checkIsDemoMode(): boolean {
    if (typeof window !== 'undefined' && window.location?.search !== undefined) {
      const params = new URLSearchParams(window.location.search);
      const demoParam = params.get('demo');
      const mockParam = params.get('mock');
      const modeParam = params.get('mode');
      const dataParam = params.get('data');

      if (
        demoParam === 'true' ||
        mockParam === 'true' ||
        modeParam === 'demo' ||
        dataParam === 'demo'
      ) {
        return true;
      }
      if (
        demoParam === 'false' ||
        mockParam === 'false' ||
        modeParam === 'live' ||
        dataParam === 'live'
      ) {
        return false;
      }
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MOCK_MODE === 'true') {
      return true;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(DATA_SELECTION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.isDemoMode === 'boolean') {
            return parsed.isDemoMode;
          }
        }
      } catch {
        // Ignore storage / JSON parse errors
      }
    }
    return false;
  }
}

export const checkIsDemoMode = DemoModeService.checkIsDemoMode;
