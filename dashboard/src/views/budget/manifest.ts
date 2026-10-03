import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'budget',
  label: 'CostCenter予算',
  title: 'Cost Center 予算管理 (FinOps)',
  description: '各Cost Centerの上限枠・無料枠・実請求額と超過警告',
  iconName: 'Landmark',
  order: 40,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: ['scope', 'report'],
  component: React.lazy(() => import('./View')),
};

export default manifest;
