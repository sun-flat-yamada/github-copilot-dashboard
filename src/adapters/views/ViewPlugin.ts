import React from 'react';
import { IViewPluginManifest } from '../../domain/ports/IViewPluginManifest.js';
import { AnalysisViewId } from '../../domain/entities/views.js';
import { DataSourceType } from '../../domain/entities/copilot.js';

export interface ViewPluginProps<P = any> {
  presenter?: P;
  activeSource?: DataSourceType;
  currentData?: any;
  currentReportData?: any;
  deepAnalysisProfiles?: any[];
  deepAnalysisSourceInfo?: string;
  focusedUserLogin?: string;
  setFocusedUserLogin?: (login: string) => void;
  focusedRadarModelId?: string;
  setFocusedRadarModelId?: (modelId: string) => void;
  onNavigateToView?: (viewId: AnalysisViewId, params?: any) => void;
  currentGrouping?: string;
  selectedGroup?: string;
  onGroupingChange?: (grouping: any) => void;
  onGroupChange?: (group: string) => void;
  availableGroups?: string[];
  userTableFilterStatus?: any;
  onFilterIdleUsers?: () => void;
  isExpanded?: (id: string) => boolean;
  toggleSection?: (id: string) => void;
  [key: string]: any;
}

/**
 * ViewPlugin represents a self-contained analysis view plugin in the dashboard.
 * Extends IViewPluginManifest with React rendering capabilities and presenter factories.
 */
export interface ViewPlugin<P = any> extends IViewPluginManifest {
  readonly id: AnalysisViewId;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly iconName: string;
  readonly supportedDataSources: DataSourceType[];
  readonly badge?: string;
  readonly badgeColor?: string;
  readonly component: React.ComponentType<ViewPluginProps<P>>;
  readonly presenterFactory?: (data: any, state?: any) => P;
}
