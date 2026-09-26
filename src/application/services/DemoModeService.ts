/**
 * DemoModeService manages demo/mock mode detection for the dashboard.
 * Extracted from legacy hooks into an Application Service.
 */
export class DemoModeService {
  /**
   * Determine whether DEMO (mock/simulation) mode should be activated based on
   * URL search parameters or environment variables.
   */
  public static checkIsDemoMode(): boolean {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('demo') === 'true' ||
        params.get('mock') === 'true' ||
        params.get('mode') === 'demo' ||
        params.get('data') === 'demo'
      ) {
        return true;
      }
    }
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_MOCK_MODE === 'true') {
      return true;
    }
    return false;
  }
}

export const checkIsDemoMode = DemoModeService.checkIsDemoMode;
