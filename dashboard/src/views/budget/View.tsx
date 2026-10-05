import React, { useMemo } from 'react';
import { CostAllocationCharts } from '../../components/CostAllocationCharts';
import { CostCenterBudgetCards } from '../../components/CostCenterBudgetCards';
import { CostCenterBudgetTimeline } from '../../components/CostCenterBudgetTimeline';
import { MonthlyReportCharts } from '../../components/monthly-report/MonthlyReportCharts';
import { UserDetailTable } from '../../components/UserDetailTable';
import { liveCostCenterDaily, livePeriod, monthPeriod } from '../../utils/budgetForecast';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const {
    activeSource, isReportSource, currentData, currentReportData, reportBudgets,
    deepAnalysisProfiles, focusedUserLogin, selectedGroup, setSelectedGroup,
    onGroupingChange: handleGroupingChange,
    onSelectUserForTrend: handleSelectUserForTrend, onOpenDeepAnalysis: handleOpenDeepAnalysis,
  } = ctx;
  // 自動収集データ: 選択中の区間に合わせた表示期間と、シート費用の日次の積み上がり
  const live = useMemo(
    () => (currentData ? { period: livePeriod(currentData), daily: liveCostCenterDaily(currentData) } : null),
    [currentData]
  );
  return (
    <div className="flex flex-col space-y-6 w-full">
      {activeSource === 'live_metrics' && currentData && (
        <>
          <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
          {live && (
            <CostCenterBudgetTimeline
              budgets={currentData.cost_center_budgets ?? []}
              costCenterDaily={live.daily}
              start={live.period.start}
              end={live.period.end}
              forecastEnabled={live.period.monthly}
              note="自動収集データのため、費用は各シートの日割り費用 (月額課金の日次の積み上がり) です。"
            />
          )}
          <CostAllocationCharts data={currentData} grouping="cost_center" />
        </>
      )}

      {isReportSource && currentReportData && (
        <div className="flex flex-col space-y-6 w-full">
          <CostCenterBudgetCards budgets={reportBudgets} />
          <CostCenterBudgetTimeline
            budgets={reportBudgets}
            costCenterDaily={currentReportData.cost_center_daily}
            start={monthPeriod(currentReportData.report_month).start}
            end={monthPeriod(currentReportData.report_month).end}
            forecastEnabled
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
