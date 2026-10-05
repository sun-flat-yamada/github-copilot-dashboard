import React from 'react';
import { CostAllocationCharts } from '../../components/CostAllocationCharts';
import { CostCenterBudgetCards } from '../../components/CostCenterBudgetCards';
import { CostCenterSpendTimeline } from '../../components/CostCenterSpendTimeline';
import { MonthlyReportCharts } from '../../components/monthly-report/MonthlyReportCharts';
import { UserDetailTable } from '../../components/UserDetailTable';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const {
    activeSource, isReportSource, currentData, currentReportData, reportBudgets,
    deepAnalysisProfiles, focusedUserLogin, selectedGroup, setSelectedGroup,
    onGroupingChange: handleGroupingChange,
    onSelectUserForTrend: handleSelectUserForTrend, onOpenDeepAnalysis: handleOpenDeepAnalysis,
  } = ctx;
  return (
    <div className="flex flex-col space-y-6 w-full">
      {activeSource === 'live_metrics' && currentData && (
        <>
          <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
          <CostCenterSpendTimeline budgets={currentData.cost_center_budgets ?? []} />
          <CostAllocationCharts data={currentData} grouping="cost_center" />
        </>
      )}

      {isReportSource && currentReportData && (
        <div className="flex flex-col space-y-6 w-full">
          <CostCenterBudgetCards budgets={reportBudgets} />
          <CostCenterSpendTimeline
            budgets={reportBudgets}
            costCenterDaily={currentReportData.cost_center_daily}
            month={currentReportData.report_month}
          />
          <MonthlyReportCharts
            reportData={currentReportData}
            grouping="cost_center"
            onGroupingChange={handleGroupingChange}
            selectedGroup={selectedGroup}
          />
          <UserDetailTable
            reportData={currentReportData}
            userProfiles={deepAnalysisProfiles}
            initialSelectedLogin={focusedUserLogin}
            grouping="cost_center"
            selectedGroup={selectedGroup}
            onGroupChange={setSelectedGroup}
            onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
            onSelectUserForTrend={handleSelectUserForTrend}
          />
        </div>
      )}
    </div>
  );
};

export default View;
