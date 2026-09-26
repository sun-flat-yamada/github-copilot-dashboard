import { DataStore } from '../application/store/DataStore.js';
import { DerivedDataGraph } from '../application/store/derived/DerivedDataGraph.js';
import { registerCoreDerivedNodes } from '../application/store/derived/nodes/index.js';
import { StaticJsonMetricsRepository } from '../adapters/storage/StaticJsonMetricsRepository.js';
import { IMetricsRepository } from '../domain/ports/IMetricsRepository.js';
import { ScopeManager } from '../application/services/ScopeManager.js';

export interface DashboardAppInstance {
  store: DataStore;
  repository: IMetricsRepository;
  init(): Promise<void>;
  loadScope(scopeType: 'daily' | 'monthly' | 'custom', key: string): Promise<void>;
  loadReport(month: string): Promise<void>;
}

export function createDashboardApp(initialDemoMode: boolean = false): DashboardAppInstance {
  const graph = new DerivedDataGraph();
  registerCoreDerivedNodes(graph);

  const store = new DataStore(graph, {
    isDemoMode: initialDemoMode,
    isLoading: true,
  });

  const repository: IMetricsRepository = new StaticJsonMetricsRepository();

  const loadScope = async (scopeType: 'daily' | 'monthly' | 'custom', key: string) => {
    store.dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const isDemo = store.getState().isDemoMode;
      const data = await repository.fetchScopeData(scopeType, key, isDemo);
      store.dispatch({ type: 'SET_RAW_SCOPE_DATA', data });
      store.dispatch({ type: 'SET_SCOPE', scopeType, key });
    } catch (err: any) {
      console.warn(`[createDashboardApp] Failed to load scope ${scopeType}/${key}:`, err);
      store.dispatch({ type: 'SET_RAW_SCOPE_DATA', data: null });
    } finally {
      store.dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  };

  const loadReport = async (month: string) => {
    store.dispatch({ type: 'SET_LOADING', isLoading: true });
    try {
      const isDemo = store.getState().isDemoMode;
      const data = await repository.fetchReportData(month, isDemo);
      store.dispatch({ type: 'SET_RAW_REPORT_DATA', data });
    } catch (err: any) {
      console.warn(`[createDashboardApp] Failed to load report ${month}:`, err);
      store.dispatch({ type: 'SET_RAW_REPORT_DATA', data: null });
    } finally {
      store.dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  };

  const init = async () => {
    store.dispatch({ type: 'SET_LOADING', isLoading: true });
    const isDemo = store.getState().isDemoMode;

    try {
      // 1. Index & Benchmarks を並行ロード
      const [indexMeta, benchmarkData] = await Promise.all([
        repository.fetchIndex(isDemo).catch(() => null),
        repository.fetchBenchmarkData().catch(() => null),
      ]);

      if (indexMeta) {
        store.dispatch({ type: 'SET_INDEX_META', meta: indexMeta });
        if (indexMeta.issues) {
          store.dispatch({ type: 'SET_ISSUES', issues: indexMeta.issues });
        }

        // デフォルトスコープを決定して初期データロード
        const defaultScope = ScopeManager.resolveDefaultScope(indexMeta);
        if (defaultScope.key) {
          await loadScope(defaultScope.scopeType, defaultScope.key);
        }
      }

      if (benchmarkData) {
        store.dispatch({ type: 'SET_BENCHMARK_DATA', data: benchmarkData });
      }
    } finally {
      store.dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  };

  return {
    store,
    repository,
    init,
    loadScope,
    loadReport,
  };
}
