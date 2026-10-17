import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'dashboard',
  label: 'Dashboard',
  title: 'Dashboard (カスタムウィジェット)',
  description: 'KPIカードおよび分析セクションをWidget方式で自由配置・順序変更・保存できる初期表示ダッシュボード',
  iconName: 'LayoutDashboard',
  order: 5,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: ['scope', 'report'],
  component: React.lazy(() => import('./View')),
};

export default manifest;
