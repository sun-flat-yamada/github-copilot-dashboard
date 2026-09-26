import { useSyncExternalStore, useCallback } from 'react';
import { useStoreInstance } from '../DashboardProvider.js';
import { DataStoreState } from '../../../application/store/DataStoreState.js';

export function useStoreSelector<T>(selector: (state: DataStoreState) => T): T {
  const store = useStoreInstance();

  const getSnapshot = useCallback(() => {
    return selector(store.getState());
  }, [store, selector]);

  return useSyncExternalStore(
    useCallback((onStoreChange) => store.subscribe(onStoreChange), [store]),
    getSnapshot,
    getSnapshot
  );
}

export function useDerivedData<T>(nodeId: string): T | undefined {
  const store = useStoreInstance();

  const getSnapshot = useCallback(() => {
    return store.getDerived<T>(nodeId);
  }, [store, nodeId]);

  return useSyncExternalStore(
    useCallback((onStoreChange) => store.subscribe(onStoreChange), [store]),
    getSnapshot,
    getSnapshot
  );
}
