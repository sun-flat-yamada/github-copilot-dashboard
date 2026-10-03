import { View } from './View';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'overview',
  label: 'コスト内訳',
  title: 'コスト内訳 & 総合サマリー',
  description: '3軸（部署・Cost Center・Organization）費用内訳とKPI概況',
  iconName: 'PieChart',
  order: 10,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: ['scope', 'report'],
  component: View,
};

export default manifest;
