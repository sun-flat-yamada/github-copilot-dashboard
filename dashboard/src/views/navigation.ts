import type { DataSourceType } from '../../../src/types/copilot';
import type { ViewManifest } from './types';

export interface ViewNavigationItem {
  id: string;
  shortTitle: string;
  description: string;
  iconName: string;
  supportedDataSources: DataSourceType[];
  badge?: string;
  badgeColor?: string;
}

/** View Registry の manifest をナビゲーション項目へ変換する */
export const toNavigationItem = (m: ViewManifest): ViewNavigationItem => ({
  id: m.id,
  shortTitle: m.label,
  description: m.description,
  iconName: m.iconName,
  supportedDataSources: m.supportedDataSources,
  badge: m.badge,
  badgeColor: m.badgeColor,
});

