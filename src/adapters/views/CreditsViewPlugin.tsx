import React, { Suspense, lazy } from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { CreditsPresenter, CreditsViewModel } from '../presenters/CreditsPresenter.js';
import { ViewSkeleton } from '../../../dashboard/src/components/common/ViewSkeleton.js';

const CreditsView = lazy(() =>
  import('../../../dashboard/src/components/views/CreditsView.js').then((m) => ({
    default: m.CreditsView,
  }))
);

export const CreditsViewComponent: React.FC<ViewPluginProps<CreditsViewModel>> = (props) => {
  const { presenter, currentData, currentReportData, creditsAnalysis } = props;
  const viewModel = presenter ?? CreditsPresenter.present({
    currentData,
    currentReportData,
    creditsAnalysis,
  });

  return (
    <Suspense fallback={<ViewSkeleton />}>
      <CreditsView viewModel={viewModel} />
    </Suspense>
  );
};

export const CreditsViewPlugin: ViewPlugin<CreditsViewModel> = {
  id: 'credits',
  label: 'AI Credits & コスト分析',
  title: 'AI Credits & コスト分析',
  shortTitle: 'AI Credits',
  description: '組織プール消費・モデル別クレジット内訳・個人上限と超過ステータス',
  icon: 'Coins',
  iconName: 'Coins',
  order: 7,
  capabilities: ['credits_analysis'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  badge: '2026.06+',
  badgeColor: 'amber',
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['creditsAnalysis'],
  presenterFactory: (data: any) => CreditsPresenter.present(data),
  component: CreditsViewComponent,
};
