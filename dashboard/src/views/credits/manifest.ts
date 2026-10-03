import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'credits',
  label: 'AI Credits',
  title: 'AI Credits & コスト分析',
  description: '組織プール消費・モデル別クレジット内訳・個人上限と超過ステータス',
  iconName: 'Coins',
  order: 70,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: [],
  badge: '2026.06+',
  badgeColor: 'amber',
  component: React.lazy(() => import('./View')),
};

export default manifest;
