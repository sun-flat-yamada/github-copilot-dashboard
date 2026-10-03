import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'adoption',
  label: '採用成熟度',
  title: 'AI 採用成熟度 (Impact Dashboard)',
  description: 'No Cohort / Code First / Agent First / Multi-Agent の成熟度コホート推移',
  iconName: 'TrendingUp',
  order: 90,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: [],
  badge: 'Impact',
  badgeColor: 'emerald',
  component: React.lazy(() => import('./View')),
};

export default manifest;
