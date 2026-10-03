import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  ChevronsDown,
  ChevronsUp,
  LayoutGrid,
  Landmark,
  PieChart as PieIcon,
  Users2,
} from 'lucide-react';
import { GroupingDimension } from '../../../../src/types/copilot';
import { monthlyIdleSavingsUsd } from '../../../../src/domain/rules/ScopeCostRule';
import { SEAT_IDLE_CRITERIA_TEXT } from '../../../../src/domain/rules/SeatClassificationRule';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { KpiSummaryCards } from '../../components/KpiSummaryCards';
import { IdleSeatAdvisor } from '../../components/IdleSeatAdvisor';
import { CostAllocationCharts } from '../../components/CostAllocationCharts';
import { UsageMetricsCharts } from '../../components/UsageMetricsCharts';
import { UserDetailTable } from '../../components/UserDetailTable';
import { CostCenterBudgetCards } from '../../components/CostCenterBudgetCards';
import { MonthlyReportKpis } from '../../components/monthly-report/MonthlyReportKpis';
import { MonthlyReportCharts } from '../../components/monthly-report/MonthlyReportCharts';

import type { ViewContext } from '../types';

/** 集計軸ごとの単位ラベル (サマリーチップの件数表示用) */
const GROUPING_UNIT_LABEL: Record<GroupingDimension, string> = {
  department: '部署',
  cost_center: 'Cost Center',
  organization: 'Org',
};

/** 選択中の集計軸に対応するグループ数 (集計軸に関係なく部署数を出さない) */
function countGroups(
  data: { by_department?: object; by_cost_center?: object; by_organization?: object },
  grouping: GroupingDimension
): number {
  const groups =
    grouping === 'department'
      ? data.by_department
      : grouping === 'cost_center'
      ? data.by_cost_center
      : data.by_organization;
  return Object.keys(groups || {}).length;
}


export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const {
    activeSource, isReportSource, isDemoData, currentData, previousData, currentReportData,
    deepAnalysisProfiles, focusedUserLogin, userTableFilterStatus, currentGrouping, selectedGroup,
    setSelectedGroup, accordion: { isExpanded, toggle, expandAll, collapseAll },
    onGroupingChange: handleGroupingChange, onFilterIdle: handleFilterIdle,
    onSelectUserForTrend: handleSelectUserForTrend, onOpenDeepAnalysis: handleOpenDeepAnalysis,
  } = ctx;
  return (
    <div className="flex flex-col space-y-6 w-full">
      {/* サマリーブロック (常時展開 ★要件6) */}
      {activeSource === 'live_metrics' && currentData && (
        <KpiSummaryCards data={currentData} isDemo={isDemoData} previousData={previousData} />
      )}
      {isReportSource && currentReportData && (
        <MonthlyReportKpis reportData={currentReportData} />
      )}

      {/* 詳細分析セクションヘッダー ＆ 一括開閉アイコンコントロール (★要件6, Issue #118) */}
      <div className="flex items-center justify-between pt-2 pb-1 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-bold text-slate-200 tracking-tight">
              詳細分析セクション
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 font-mono border border-slate-700/50">
              {activeSource === 'live_metrics' ? '5 セクション' : '2 セクション'}
            </span>
          </div>
        </div>

        {/* スマートなアイコン化開閉ボタン群 (ツールチップ付き) */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => expandAll()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all cursor-pointer shadow-sm"
            title="すべての個別要素を展開"
            aria-label="すべての個別要素を展開"
          >
            <ChevronsDown className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 transition-all cursor-pointer shadow-sm"
            title="すべての個別要素を収納"
            aria-label="すべての個別要素を収納"
          >
            <ChevronsUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 個別要素ブロック (初期折りたたみ ★要件6, 1カラム垂直スタック ★要件5) */}
      {activeSource === 'live_metrics' && currentData && (
        <>
          <CollapsibleSection
            id="advisor"
            title="遊休シート・コスト削減アドバイザー"
            subtitle={`遊休アカウント検出と削減可能額 (判定基準: ${SEAT_IDLE_CRITERIA_TEXT})`}
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                削減可能: ${monthlyIdleSavingsUsd(currentData.users).toFixed(2)}/月
              </span>
            }
            isExpanded={isExpanded('advisor')}
            onToggle={() => toggle('advisor')}
          >
            <IdleSeatAdvisor data={currentData} onFilterIdleUsers={handleFilterIdle} />
          </CollapsibleSection>

          <CollapsibleSection
            id="allocation"
            title="グループ別 コスト内訳 & ライセンス稼働状況"
            subtitle="選択仕訳軸（ユーザー定義Gr / Cost Center / Org）に基づく費用シェアと稼働率"
            icon={<PieIcon className="w-4 h-4 text-purple-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {countGroups(currentData, currentGrouping)} {GROUPING_UNIT_LABEL[currentGrouping]}
              </span>
            }
            isExpanded={isExpanded('allocation')}
            onToggle={() => toggle('allocation')}
          >
            <CostAllocationCharts
              data={currentData}
              grouping={currentGrouping}
              onGroupingChange={handleGroupingChange}
            />
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
            onToggle={() => toggle('budget')}
          >
            <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
          </CollapsibleSection>

          <CollapsibleSection
            id="usage"
            title="日次アクティビティ & 言語別Inline補完受諾率推移"
            subtitle="日次アクティブ推移、Inline補完受諾率、主要プログラミング言語シェア"
            icon={<BarChart3 className="w-4 h-4 text-cyan-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                Inline補完受諾率{' '}
                {currentData.overview.overall_acceptance_rate === null
                  ? '—'
                  : `${Math.round(currentData.overview.overall_acceptance_rate * 100)}%`}
              </span>
            }
            isExpanded={isExpanded('usage')}
            onToggle={() => toggle('usage')}
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
                {currentData.users.length} 名
              </span>
            }
            isExpanded={isExpanded('users')}
            onToggle={() => toggle('users')}
          >
            <UserDetailTable
              data={currentData}
              userProfiles={deepAnalysisProfiles}
              initialSelectedLogin={focusedUserLogin}
              filterStatus={userTableFilterStatus}
              onSelectUserForTrend={handleSelectUserForTrend}
              onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
            />
          </CollapsibleSection>
        </>
      )}

      {isReportSource && currentReportData && (
        <>
          <CollapsibleSection
            id="report_charts"
            title="3軸集計・費用配賦 & AIモデル別・日別推移"
            subtitle="部署/Cost Center別シェアとモデル別消費額"
            icon={<PieIcon className="w-4 h-4 text-teal-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                {currentReportData.model_breakdown.length} モデル
              </span>
            }
            isExpanded={isExpanded('report_charts')}
            onToggle={() => toggle('report_charts')}
          >
            <MonthlyReportCharts
            reportData={currentReportData}
            grouping={currentGrouping}
            onGroupingChange={handleGroupingChange}
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
                {currentReportData.user_details.length} 名
              </span>
            }
            isExpanded={isExpanded('report_users')}
            onToggle={() => toggle('report_users')}
          >
            <UserDetailTable
              reportData={currentReportData}
              userProfiles={deepAnalysisProfiles}
              initialSelectedLogin={focusedUserLogin}
              grouping={currentGrouping}
              selectedGroup={selectedGroup}
              onGroupChange={setSelectedGroup}
              onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
              onSelectUserForTrend={handleSelectUserForTrend}
            />
          </CollapsibleSection>
        </>
      )}
    </div>
  );
};

export default View;
