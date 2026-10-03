import React from 'react';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'agent',
  label: 'Agent活用',
  title: 'AI Agent & MCP 活用動向',
  description: 'VS Code Agent・カスタムAgent・MCPツール呼出・Coding Agent PRの統合分析',
  iconName: 'Bot',
  order: 80,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: [],
  badge: 'New',
  badgeColor: 'purple',
  component: React.lazy(() => import('./View')),
};

export default manifest;
