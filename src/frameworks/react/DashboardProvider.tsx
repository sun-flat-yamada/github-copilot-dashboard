import React, { createContext, useContext, ReactNode } from 'react';
import { DataStore } from '../../application/store/DataStore.js';

export const DashboardStoreContext = createContext<DataStore | null>(null);

export interface DashboardProviderProps {
  store: DataStore;
  children: ReactNode;
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ store, children }) => {
  return (
    <DashboardStoreContext.Provider value={store}>
      {children}
    </DashboardStoreContext.Provider>
  );
};

export function useStoreInstance(): DataStore {
  const store = useContext(DashboardStoreContext);
  if (!store) {
    throw new Error('useStoreInstance must be used within a DashboardProvider');
  }
  return store;
}
