import { DataStoreState, DEFAULT_DATA_STORE_STATE } from './DataStoreState.js';
import { DataStoreAction, dataStoreReducer, detectChangedKeys } from './DataStoreReducer.js';
import { DerivedDataGraph } from './derived/DerivedDataGraph.js';

export type StoreListener = () => void;

export class DataStore {
  private state: DataStoreState;
  private graph: DerivedDataGraph;
  private listeners = new Set<StoreListener>();

  constructor(graph?: DerivedDataGraph, initialState?: Partial<DataStoreState>) {
    this.graph = graph || new DerivedDataGraph();
    this.state = {
      ...DEFAULT_DATA_STORE_STATE,
      ...initialState,
    };

    // 初期状態の Derived データを計算
    const initialKeys = Array.from(this.graph.getRegisteredNodeIds());
    if (initialKeys.length > 0) {
      const derived = this.graph.invalidate(initialKeys, this.state);
      this.state = { ...this.state, derived };
    }
  }

  getState(): DataStoreState {
    return this.state;
  }

  getDerived<T>(nodeId: string): T | undefined {
    return this.state.derived.get(nodeId) as T | undefined;
  }

  dispatch(action: DataStoreAction): void {
    const nextBaseState = dataStoreReducer(this.state, action);
    const changedKeys = detectChangedKeys(this.state, nextBaseState);

    if (changedKeys.length === 0 && nextBaseState === this.state) {
      return;
    }

    const updatedDerived = this.graph.invalidate(changedKeys, nextBaseState);
    this.state = {
      ...nextBaseState,
      derived: updatedDerived,
    };

    this.notify();
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
