import React from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { TrendPresenter, TrendViewModel } from '../presenters/TrendPresenter.js';
import { UserTrendViewer } from '../../../dashboard/src/components/UserTrendViewer.js';
import { DeepAnalysisDataSourceInfo } from '../../domain/entities/deep-analysis.js';

export const TrendViewComponent: React.FC<ViewPluginProps<TrendViewModel>> = (props) => {
  const {
    currentData,
    deepAnalysisProfiles = [],
    focusedUserLogin = '',
    deepAnalysisSourceInfo,
    onNavigateToView,
    setFocusedRadarModelId,
    setFocusedUserLogin,
  } = props;

  const profiles = deepAnalysisProfiles.length > 0 ? deepAnalysisProfiles : (currentData?.user_profiles || []);

  const handleOpenRadar = (modelId?: string) => {
    if (modelId && setFocusedRadarModelId) setFocusedRadarModelId(modelId);
    if (onNavigateToView) onNavigateToView('model_radar');
  };

  const handleOpenDeepAnalysis = (login: string) => {
    if (setFocusedUserLogin) setFocusedUserLogin(login);
    if (onNavigateToView) onNavigateToView('deep_analysis');
  };

  return (
    <div className="flex flex-col space-y-6 w-full">
      <UserTrendViewer
        profiles={profiles}
        initialSelectedLogin={focusedUserLogin}
        sourceInfo={deepAnalysisSourceInfo as DeepAnalysisDataSourceInfo | undefined}
        onOpenRadar={handleOpenRadar}
        onOpenDeepAnalysis={handleOpenDeepAnalysis}
      />
    </div>
  );
};

export const TrendViewPlugin: ViewPlugin<TrendViewModel> = {
  id: 'trend',
  label: 'ユーザー別モデル推移 & 開発指標',
  title: 'ユーザー別モデル推移 & 開発指標',
  shortTitle: 'モデル推移',
  description: '個人別の日次AIモデル利用割合および提案・受諾推移',
  icon: 'Bot',
  iconName: 'Bot',
  order: 3,
  capabilities: ['user_trend'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['filteredScopeData', 'filteredReportData'],
  presenterFactory: (data: any) => TrendPresenter.present(data),
  component: TrendViewComponent,
};
