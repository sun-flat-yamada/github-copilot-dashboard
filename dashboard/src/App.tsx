import React from 'react';
import { AppShell } from './AppShell';
import { defaultViewRegistry } from './views/defaultRegistry';

/** アプリのエントリ。ビュー集合 (Vite の import.meta.glob で自動収集) を AppShell へ渡すだけ */
export const App: React.FC = () => <AppShell registry={defaultViewRegistry} />;

export default App;
