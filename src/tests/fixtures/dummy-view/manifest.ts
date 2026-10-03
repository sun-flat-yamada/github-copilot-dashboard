import { View } from './View.js';
import type { ViewManifest } from '../../../../dashboard/src/views/types.js';

/** 新ビュー追加の見本: manifest + コンポーネントの 2 ファイルだけで完結する */
const manifest: ViewManifest = {
  id: 'dummy',
  label: 'Dummy',
  title: 'Dummy view',
  description: 'registry extension fixture',
  iconName: 'PieChart',
  order: 1000,
  supportedDataSources: ['live_metrics'],
  requiredDatasets: ['scope'],
  component: View,
};

export default manifest;
