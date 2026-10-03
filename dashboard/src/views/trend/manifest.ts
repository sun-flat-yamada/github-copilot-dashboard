import { View } from './View';
import type { ViewManifest } from '../types';

const manifest: ViewManifest = {
  id: 'trend',
  label: 'モデル推移',
  title: 'ユーザー別モデル推移 & 開発指標',
  description: '個人別の日次AIモデル利用割合および提案・受諾推移',
  iconName: 'Bot',
  order: 30,
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  requiredDatasets: ['scope', 'report'],
  component: View,
};

export default manifest;
