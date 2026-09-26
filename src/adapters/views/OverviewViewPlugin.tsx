import React from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { OverviewPresenter, OverviewViewModel } from '../presenters/OverviewPresenter.js';
import { KpiSummaryCards } from '../../../dashboard/src/components/KpiSummaryCards.js';
import { MonthlyReportKpis } from '../../../dashboard/src/components/monthly-report/MonthlyReportKpis.js';
import { IdleSeatAdvisor } from '../../../dashboard/src/components/IdleSeatAdvisor.js';
import { CostAllocationCharts } from '../../../dashboard/src/components/CostAllocationCharts.js';
import { CostCenterBudgetCards } from '../../../dashboard/src/components/CostCenterBudgetCards.js';
import { UsageMetricsCharts } from '../../../dashboard/src/components/UsageMetricsCharts.js';
import { UserDetailTable } from '../../../dashboard/src/components/UserDetailTable.js';
import { MonthlyReportCharts } from '../../../dashboard/src/components/monthly-report/MonthlyReportCharts.js';
import { MonthlyReportUserTable } from '../../../dashboard/src/components/monthly-report/MonthlyReportUserTable.js';
import { CollapsibleSection } from '../../../dashboard/src/components/common/CollapsibleSection.js';
import {
  AlertTriangle,
  PieChart as PieIcon,
  Landmark,
  BarChart3,
  Users2,
} from 'lucide-react';

export const OverviewViewComponent: React.FC<ViewPluginProps<OverviewViewModel>> = (props) => {
  const {
    activeSource = 'live_metrics',
    currentData,
    currentReportData,
    deepAnalysisProfiles = [],
    focusedUserLogin = '',
    onSelectUserForTrend,
    onSelectUserForDeepAnalysis,
    onFilterIdleUsers,
    currentGrouping = 'department',
    selectedGroup = 'all',
    onGroupingChange,
    userTableFilterStatus = 'all',
    isExpanded = (_id: string) => true,
    toggleSection = (_id: string) => {},
  } = props;

  const isLive = activeSource === 'live_metrics';
  const isReport = activeSource === 'monthly_report' || activeSource === 'user_upload';

  return (
    <div className="flex flex-col space-y-6 w-full">
      {/* KPI Cards */}
      {isLive && currentData && <KpiSummaryCards data={currentData} />}
      {isReport && currentReportData && <MonthlyReportKpis reportData={currentReportData} />}

      {/* Live Sections */}
      {isLive && currentData && (
        <>
          <CollapsibleSection
            id="advisor"
            title="遊休シート・コスト削減アドバイザー"
            subtitle="30日以上未利用の遊休アカウント検出と削減可能額"
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                削減可能: ${(currentData.overview?.idle_waste_usd || 0).toFixed(2)}/月
              </span>
            }
            isExpanded={isExpanded('advisor')}
            onToggle={() => toggleSection('advisor')}
          >
            <IdleSeatAdvisor data={currentData} onFilterIdleUsers={onFilterIdleUsers || (() => {})} />
          </CollapsibleSection>

          <CollapsibleSection
            id="allocation"
            title="グループ別 コスト配賦 & ライセンス稼働状況"
            subtitle="選択仕訳軸（部署 / Cost Center / Org）に基づく費用シェアと稼働率"
            icon={<PieIcon className="w-4 h-4 text-purple-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {Object.keys(currentData.by_department || {}).length} 部署
              </span>
            }
            isExpanded={isExpanded('allocation')}
            onToggle={() => toggleSection('allocation')}
          >
            <CostAllocationCharts data={currentData} grouping={currentGrouping as any} />
          </CollapsibleSection>

          <CollapsibleSection
            id="budget"
            title="Cost Center 予算進捗管理"
            subtitle="上限Budget枠・無料枠・請求対象額とアラート"
            icon={<Landmark className="w-4 h-4 text-emerald-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentData.cost_center_budgets?.length || 0} Cost Centers
              </span>
            }
            isExpanded={isExpanded('budget')}
            onToggle={() => toggleSection('budget')}
          >
            <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
          </CollapsibleSection>

          <CollapsibleSection
            id="usage"
            title="日次アクティビティ & 言語別受諾率推移"
            subtitle="日次アクティブ推移、コード受諾率、主要プログラミング言語シェア"
            icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                受諾率 {Math.round((currentData.overview?.overall_acceptance_rate || 0) * 100)}%
              </span>
            }
            isExpanded={isExpanded('usage')}
            onToggle={() => toggleSection('usage')}
          >
            <UsageMetricsCharts data={currentData} />
          </CollapsibleSection>

          <CollapsibleSection
            id="users"
            title="ユーザー別利用明細テーブル"
            subtitle="全アカウントの利用ステータス、推計費用、最終アクティビティ"
            icon={<Users2 className="w-4 h-4 text-blue-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentData.users?.length || 0} 名
              </span>
            }
            isExpanded={isExpanded('users')}
            onToggle={() => toggleSection('users')}
          >
            <UserDetailTable
              data={currentData}
              userProfiles={deepAnalysisProfiles}
              initialSelectedLogin={focusedUserLogin}
              filterStatus={userTableFilterStatus}
              onSelectUserForTrend={onSelectUserForTrend || (() => {})}
              onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis || (() => {})}
            />
          </CollapsibleSection>
        </>
      )}

      {/* Monthly Report Sections */}
      {isReport && currentReportData && (
        <>
          <CollapsibleSection
            id="report_charts"
            title="3軸集計・費用配賦 & AIモデル別・日別推移"
            subtitle="部署/Cost Center別シェアとモデル別消費額"
            icon={<PieIcon className="w-4 h-4 text-teal-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                {currentReportData.model_breakdown?.length || 0} モデル
              </span>
            }
            isExpanded={isExpanded('report_charts')}
            onToggle={() => toggleSection('report_charts')}
          >
            <MonthlyReportCharts
              reportData={currentReportData}
              grouping={currentGrouping as any}
              onGroupingChange={onGroupingChange || (() => {})}
              selectedGroup={selectedGroup}
            />
          </CollapsibleSection>

          <CollapsibleSection
            id="report_users"
            title="ユーザー別月次明細テーブル"
            subtitle="月次利用リクエスト数、消費額、主要モデル一覧"
            icon={<Users2 className="w-4 h-4 text-blue-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentReportData.user_details?.length || 0} 名
              </span>
            }
            isExpanded={isExpanded('report_users')}
            onToggle={() => toggleSection('report_users')}
          >
            <MonthlyReportUserTable
              reportData={currentReportData}
              userProfiles={deepAnalysisProfiles}
              initialSelectedLogin={focusedUserLogin}
              grouping={currentGrouping as any}
              selectedGroup={selectedGroup}
              onGroupChange={() => {}}
              onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis || (() => {})}
              onSelectUserForTrend={onSelectUserForTrend || (() => {})}
            />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
};

export const OverviewViewPlugin: ViewPlugin<OverviewViewModel> = {
  id: 'overview',
  label: 'コスト配賦 & 総合サマリー',
  title: 'コスト配賦 & 総合サマリー',
  shortTitle: 'コスト配賦',
  description: '3軸（部署・Cost Center・Organization）費用配賦とKPI概況',
  icon: 'PieChart',
  iconName: 'PieChart',
  order: 1,
  capabilities: ['kpi_summary', 'cost_allocation'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['filteredScopeData', 'filteredReportData'],
  presenterFactory: (data: any) => OverviewPresenter.present(data),
  component: OverviewViewComponent,
};
