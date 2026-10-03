import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'model_radar',
  label: 'モデル特性レーダー',
  title: 'AIモデル特性レーダー',
  description: '著名ベンチマーク最新実績に基づくモデル特性・適性比較',
  iconName: 'Compass',
  order: 60,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: [],
  component: React.lazy(() => import('./View')),
};

export default manifest;
