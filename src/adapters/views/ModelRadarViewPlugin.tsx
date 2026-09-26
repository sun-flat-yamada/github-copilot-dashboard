import React, { Suspense, lazy } from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { ModelRadarPresenter, ModelRadarViewModel } from '../presenters/ModelRadarPresenter.js';
import { ViewSkeleton } from '../../../dashboard/src/components/common/ViewSkeleton.js';

const ModelRadarView = lazy(() =>
  import('../../../dashboard/src/components/ModelRadarView.js').then((m) => ({
    default: m.ModelRadarView,
  }))
);

export const ModelRadarViewComponent: React.FC<ViewPluginProps<ModelRadarViewModel>> = (props) => {
  const {
    currentData,
    currentReportData,
    focusedRadarModelId = '',
    setFocusedRadarModelId,
    onNavigateToView,
  } = props;

  const handleNavigateToTrend = (modelId: string) => {
    if (setFocusedRadarModelId) setFocusedRadarModelId(modelId);
    if (onNavigateToView) onNavigateToView('trend');
  };

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <div className="w-full">
        <ModelRadarView
          initialSelectedModelId={focusedRadarModelId}
          aggregatedData={currentData}
          monthlyReportData={currentReportData}
          onNavigateToTrend={handleNavigateToTrend}
        />
      </div>
    </Suspense>
  );
};

export const ModelRadarViewPlugin: ViewPlugin<ModelRadarViewModel> = {
  id: 'model_radar',
  label: 'AIモデル特性レーダー',
  title: 'AIモデル特性レーダー',
  shortTitle: 'モデル特性レーダー',
  description: '著名ベンチマーク最新実績に基づくモデル特性・適性比較',
  icon: 'Compass',
  iconName: 'Compass',
  order: 6,
  capabilities: ['model_radar'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  canRender: (_state: any) => true,
  requiredDerivedData: () => [],
  presenterFactory: (data: any) => ModelRadarPresenter.present(data),
  component: ModelRadarViewComponent,
};
