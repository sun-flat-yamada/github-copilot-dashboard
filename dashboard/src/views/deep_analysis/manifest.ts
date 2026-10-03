import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'deep_analysis',
  label: 'ディープ分析',
  title: 'ディープ分析 (高度行動診断)',
  description: '5つのアンチパターンとAI自律駆動深度による利用効率診断',
  iconName: 'BrainCircuit',
  order: 50,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: ['scope', 'report'],
  badge: 'Pro',
  badgeColor: 'cyan',
  component: React.lazy(() => import('./View')),
};

export default manifest;
