import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'audit',
  label: '監査',
  title: '監査・データ品質',
  description: '収集の実行履歴・ソース別の状態・品質チェックの履歴',
  iconName: 'ShieldCheck',
  order: 100,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  // 自身で index.json / quality/history.json を取得するため、スコープ・レポートの取得状況には依存しない
  requiredDatasets: [],
  component: React.lazy(() => import('./View')),
};

export default manifest;
