import React, { Suspense, lazy } from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { AdoptionPresenter, AdoptionViewModel } from '../presenters/AdoptionPresenter.js';
import { ViewSkeleton } from '../../../dashboard/src/components/common/ViewSkeleton.js';

const AdoptionMaturityView = lazy(() =>
  import('../../../dashboard/src/components/views/AdoptionMaturityView.js').then((m) => ({
    default: m.AdoptionMaturityView,
  }))
);

export const AdoptionViewComponent: React.FC<ViewPluginProps<AdoptionViewModel>> = (props) => {
  const { presenter, currentData, agentAdoption } = props;
  const viewModel = presenter ?? AdoptionPresenter.present({
    currentData,
    agentAdoption,
  });

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <AdoptionMaturityView viewModel={viewModel} />
    </Suspense>
  );
};

export const AdoptionViewPlugin: ViewPlugin<AdoptionViewModel> = {
  id: 'adoption',
  label: 'AI 採用成熟度 (Impact Dashboard)',
  title: 'AI 採用成熟度 (Impact Dashboard)',
  shortTitle: '採用成熟度',
  description: 'No Cohort / Code First / Agent First / Multi-Agent の成熟度コホート推移',
  icon: 'TrendingUp',
  iconName: 'TrendingUp',
  order: 9,
  capabilities: ['adoption_maturity'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  badge: 'Impact',
  badgeColor: 'emerald',
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['agentAdoption'],
  presenterFactory: (data: any) => AdoptionPresenter.present(data),
  component: AdoptionViewComponent,
};
