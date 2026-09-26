import React, { Suspense, lazy } from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { DeepAnalysisPresenter, DeepAnalysisViewModel } from '../presenters/DeepAnalysisPresenter.js';
import { ViewSkeleton } from '../../../dashboard/src/components/common/ViewSkeleton.js';
import { DeepAnalysisDataSourceInfo } from '../../domain/entities/deep-analysis.js';

const DeepAnalysisView = lazy(() =>
  import('../../../dashboard/src/components/DeepAnalysisView.js').then((m) => ({
    default: m.DeepAnalysisView,
  }))
);

export const DeepAnalysisViewComponent: React.FC<ViewPluginProps<DeepAnalysisViewModel>> = (props) => {
  const {
    currentData,
    deepAnalysisProfiles = [],
    deepAnalysisSourceInfo,
    focusedUserLogin = '',
    setFocusedUserLogin,
  } = props;

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <div className="flex flex-col space-y-6 w-full">
        <DeepAnalysisView
          aggregatedData={currentData}
          userProfiles={deepAnalysisProfiles}
          sourceInfo={deepAnalysisSourceInfo as DeepAnalysisDataSourceInfo | undefined}
          initialSelectedLogin={focusedUserLogin}
          onSelectLogin={setFocusedUserLogin || (() => {})}
        />
      </div>
    </Suspense>
  );
};

export const DeepAnalysisViewPlugin: ViewPlugin<DeepAnalysisViewModel> = {
  id: 'deep_analysis',
  label: 'ディープ分析 (高度行動診断)',
  title: 'ディープ分析 (高度行動診断)',
  shortTitle: 'ディープ分析',
  description: '5つのアンチパターンとAI自律駆動深度による利用効率診断',
  icon: 'BrainCircuit',
  iconName: 'BrainCircuit',
  order: 5,
  capabilities: ['deep_diagnostics'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  badge: 'Pro',
  badgeColor: 'cyan',
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['diagnosticResults'],
  presenterFactory: (data: any) => DeepAnalysisPresenter.present(data),
  component: DeepAnalysisViewComponent,
};
