import { View } from './View';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'users',
  label: 'ユーザー明細',
  title: 'ユーザー別利用明細',
  description: '全ユーザーの稼働状況・推計費用・AI活用度の一覧',
  iconName: 'Users2',
  order: 20,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: ['scope', 'report'],
  component: View,
};

export default manifest;
