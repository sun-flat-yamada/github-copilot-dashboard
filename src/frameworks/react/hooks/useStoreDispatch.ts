import { useCallback } from 'react';
import { useStoreInstance } from '../DashboardProvider.js';
import { DataStoreAction } from '../../../application/store/DataStoreReducer.js';

export function useStoreDispatch(): (action: DataStoreAction) => void {
  const store = useStoreInstance();

  return useCallback(
    (action: DataStoreAction) => {
      store.dispatch(action);
    },
    [store]
  );
}
