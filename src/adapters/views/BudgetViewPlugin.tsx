import React from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { BudgetPresenter, BudgetViewModel } from '../presenters/BudgetPresenter.js';
import { CostCenterBudgetCards } from '../../../dashboard/src/components/CostCenterBudgetCards.js';
import { CostAllocationCharts } from '../../../dashboard/src/components/CostAllocationCharts.js';
import { MonthlyReportCharts } from '../../../dashboard/src/components/monthly-report/MonthlyReportCharts.js';
import { MonthlyReportUserTable } from '../../../dashboard/src/components/monthly-report/MonthlyReportUserTable.js';

export const BudgetViewComponent: React.FC<ViewPluginProps<BudgetViewModel>> = (props) => {
  const {
    activeSource = 'live_metrics',
    currentData,
    currentReportData,
    reportBudgets = [],
    deepAnalysisProfiles = [],
    focusedUserLogin = '',
    selectedGroup = 'all',
    onGroupChange,
    onGroupingChange,
    onSelectUserForTrend,
    onSelectUserForDeepAnalysis,
  } = props;

  const isLive = activeSource === 'live_metrics';
  const isReport = activeSource === 'monthly_report' || activeSource === 'user_upload';

  return (
    <div className="flex flex-col space-y-6 w-full">
      {isLive && currentData && (
        <>
          <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
          <CostAllocationCharts data={currentData} grouping="cost_center" />
        </>
      )}

      {isReport && currentReportData && (
        <div className="flex flex-col space-y-6 w-full">
          <CostCenterBudgetCards budgets={reportBudgets} />
          <MonthlyReportCharts
            reportData={currentReportData}
            grouping="cost_center"
            onGroupingChange={onGroupingChange || (() => {})}
            selectedGroup={selectedGroup}
          />
          <MonthlyReportUserTable
            reportData={currentReportData}
            userProfiles={deepAnalysisProfiles}
            initialSelectedLogin={focusedUserLogin}
            grouping="cost_center"
            selectedGroup={selectedGroup}
            onGroupChange={onGroupChange || (() => {})}
            onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis || (() => {})}
            onSelectUserForTrend={onSelectUserForTrend || (() => {})}
          />
        </div>
      )}
    </div>
  );
};

export const BudgetViewPlugin: ViewPlugin<BudgetViewModel> = {
  id: 'budget',
  label: 'Cost Center 予算管理 (FinOps)',
  title: 'Cost Center 予算管理 (FinOps)',
  shortTitle: 'CostCenter予算',
  description: '各Cost Centerの上限枠・無料枠・実請求額と超過警告',
  icon: 'Landmark',
  iconName: 'Landmark',
  order: 4,
  capabilities: ['budget_cards'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['filteredScopeData', 'filteredReportData'],
  presenterFactory: (data: any) => BudgetPresenter.present(data),
  component: BudgetViewComponent,
};
