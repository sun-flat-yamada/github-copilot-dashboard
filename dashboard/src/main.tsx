import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
import { createDashboardApp } from '../../src/frameworks/composition-root.js';
import { DashboardProvider } from '../../src/frameworks/react/DashboardProvider.js';

const useNewStore = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_NEW_STORE === 'true');

const RootComponent: React.FC = () => {
  const dashboardApp = React.useMemo(() => (useNewStore ? createDashboardApp() : null), []);

  if (dashboardApp) {
    return (
      <DashboardProvider store={dashboardApp.store}>
        <App />
      </DashboardProvider>
    );
  }
  return <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
