import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CalendarRange,
  ChevronsDown,
  ChevronsUp,
  Coins,
  Landmark,
  LayoutGrid,
  PieChart as PieIcon,
  Plus,
  RotateCcw,
  ShieldCheck,
  TrendingUp,
  Users2,
} from 'lucide-react';
import { GroupingDimension } from '../../../../src/types/copilot';
import { monthlyIdleSavingsUsd } from '../../../../src/domain/rules/ScopeCostRule';
import { SEAT_IDLE_CRITERIA_TEXT } from '../../../../src/domain/rules/SeatClassificationRule';
import { AdoptionPresenter } from '../../../../src/adapters/presenters/AdoptionPresenter';
import { AgentPresenter } from '../../../../src/adapters/presenters/AgentPresenter';
import { CreditsPresenter } from '../../../../src/adapters/presenters/CreditsPresenter';
import { CollapsibleSection } from '../../components/common/CollapsibleSection';
import { WidgetCardFrame } from '../../components/common/WidgetCardFrame';
import {
  ALL_KPI_CARD_WIDGET_IDS,
  SingleKpiSummaryCard,
  type KpiCardWidgetId,
} from '../../components/KpiSummaryCards';
import { IdleSeatAdvisor } from '../../components/IdleSeatAdvisor';
import { CostAllocationCharts } from '../../components/CostAllocationCharts';
import { UsageMetricsCharts } from '../../components/UsageMetricsCharts';
import { UserDetailTable } from '../../components/UserDetailTable';
import { YearlyTrendSection } from '../../components/YearlyTrendPanel';
import { CostCenterBudgetCards } from '../../components/CostCenterBudgetCards';
import { CostCenterBudgetTimeline } from '../../components/CostCenterBudgetTimeline';
import {
  ALL_REPORT_KPI_CARD_WIDGET_IDS,
  SingleMonthlyReportKpiCard,
  type ReportKpiCardWidgetId,
} from '../../components/monthly-report/MonthlyReportKpis';
import { MonthlyReportCharts } from '../../components/monthly-report/MonthlyReportCharts';
import { CreditsView } from '../../components/views/CreditsView';
import { AgentActivityView } from '../../components/views/AgentActivityView';
import { AdoptionMaturityView } from '../../components/views/AdoptionMaturityView';
import { AuditDataQualitySection } from '../../components/AuditDataQualityPanel';
import { liveCostCenterDaily, livePeriod, monthPeriod } from '../../utils/budgetForecast';
import { useOverviewWidgets } from '../../hooks/useOverviewWidgets';

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

function isLiveKpiWidgetId(widgetId: string): widgetId is KpiCardWidgetId {
  return (ALL_KPI_CARD_WIDGET_IDS as readonly string[]).includes(widgetId);
}

function isReportKpiWidgetId(widgetId: string): widgetId is ReportKpiCardWidgetId {
  return (ALL_REPORT_KPI_CARD_WIDGET_IDS as readonly string[]).includes(widgetId);
}

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const {
    activeSource,
    dataBaseDir,
    isReportSource,
    isDemoData,
    currentData,
    previousData,
    currentReportData,
    reportBudgets,
    deepAnalysisProfiles,
    focusedUserLogin,
    userTableFilterStatus,
    currentGrouping,
    selectedGroup,
    setSelectedGroup,
    accordion: { isExpanded, toggle, expandAll, collapseAll },
    onGroupingChange: handleGroupingChange,
    onFilterIdle: handleFilterIdle,
    onSelectUserForTrend: handleSelectUserForTrend,
    onOpenDeepAnalysis: handleOpenDeepAnalysis,
  } = ctx;

  const widgetMode = isReportSource ? 'report' : 'live';
  const {
    activeWidgetIds,
    catalog,
    availableToAdd,
    isCustomized,
    addWidget,
    removeWidget,
    moveWidget,
    reorderWidgets,
    resetWidgets,
  } = useOverviewWidgets(widgetMode);

  const [isAddPanelOpen, setIsAddPanelOpen] = useState<boolean>(false);
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'kpi' | 'section'>('all');
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  const liveBudgetForecast = useMemo(
    () => (currentData ? { period: livePeriod(currentData), daily: liveCostCenterDaily(currentData) } : null),
    [currentData]
  );

  const catalogById = useMemo(
    () => new Map(catalog.map((item) => [item.id, item])),
    [catalog]
  );

  const kpiCatalogItems = useMemo(
    () => catalog.filter((item) => item.size === 'kpi'),
    [catalog]
  );

  const sectionCatalogItems = useMemo(
    () => catalog.filter((item) => item.size === 'full'),
    [catalog]
  );

  const placedKpiCount = useMemo(
    () => kpiCatalogItems.filter((item) => activeWidgetIds.includes(item.id)).length,
    [kpiCatalogItems, activeWidgetIds]
  );

  const placedSectionCount = useMemo(
    () => sectionCatalogItems.filter((item) => activeWidgetIds.includes(item.id)).length,
    [sectionCatalogItems, activeWidgetIds]
  );

  const WIDGET_DRAG_MIME = 'application/x-copilot-widget-id';

  const handleDragStart = (widgetId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    setDraggedWidgetId(widgetId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData(WIDGET_DRAG_MIME, widgetId);
        e.dataTransfer.setData('text/plain', widgetId);
      } catch {
        // Ignore dataTransfer restrictions in synthetic environments
      }
    }
  };

  const handleDragOver = (widgetId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    const hasWidgetMime = (() => {
      try {
        return Array.from(e.dataTransfer?.types ?? []).includes(WIDGET_DRAG_MIME);
      } catch {
        return false;
      }
    })();
    if (!draggedWidgetId && !hasWidgetMime) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (draggedWidgetId && draggedWidgetId !== widgetId) {
      setDragOverWidgetId(widgetId);
    }
  };

  const handleDragLeave = (widgetId: string) => () => {
    if (dragOverWidgetId === widgetId) {
      setDragOverWidgetId(null);
    }
  };

  const handleDrop = (targetWidgetId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    const fromId =
      draggedWidgetId ||
      (() => {
        try {
          return e.dataTransfer?.getData(WIDGET_DRAG_MIME) || '';
        } catch {
          return '';
        }
      })();
    if (!fromId) return;
    e.preventDefault();
    if (fromId && fromId !== targetWidgetId) {
      reorderWidgets(fromId, targetWidgetId);
    }
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  const renderLiveWidget = (widgetId: string, index: number, total: number) => {
    if (!currentData) return null;

    const dragAndMoveProps = {
      id: widgetId,
      canMoveUp: index > 0,
      canMoveDown: index < total - 1,
      onMoveUp: () => moveWidget(widgetId, 'up'),
      onMoveDown: () => moveWidget(widgetId, 'down'),
      onRemove: () => removeWidget(widgetId),
      draggable: true,
      isDragging: draggedWidgetId === widgetId,
      isDragOver: dragOverWidgetId === widgetId,
      onDragStart: handleDragStart(widgetId),
      onDragOver: handleDragOver(widgetId),
      onDragLeave: handleDragLeave(widgetId),
      onDrop: handleDrop(widgetId),
      onDragEnd: handleDragEnd,
    };

    if (isLiveKpiWidgetId(widgetId)) {
      const title = catalogById.get(widgetId)?.title ?? widgetId;
      return (
        <WidgetCardFrame key={widgetId} {...dragAndMoveProps} title={title}>
          <SingleKpiSummaryCard
            cardId={widgetId}
            data={currentData}
            isDemo={isDemoData}
            previousData={previousData}
          />
        </WidgetCardFrame>
      );
    }

    const commonProps = {
      ...dragAndMoveProps,
      isExpanded: isExpanded(widgetId),
      onToggle: () => toggle(widgetId),
      className: 'col-span-full',
    };

    switch (widgetId) {
      case 'advisor':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="遊休シート・コスト削減アドバイザー"
            subtitle={`遊休アカウント検出と削減可能額 (判定基準: ${SEAT_IDLE_CRITERIA_TEXT})`}
            icon={<AlertTriangle className="w-4 h-4 text-amber-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                削減可能: ${monthlyIdleSavingsUsd(currentData.users).toFixed(2)}/月
              </span>
            }
          >
            <IdleSeatAdvisor data={currentData} onFilterIdleUsers={handleFilterIdle} />
          </CollapsibleSection>
        );

      case 'allocation':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="グループ別 コスト内訳 & ライセンス稼働状況"
            subtitle="選択仕訳軸（ユーザー定義Gr / Cost Center / Org）に基づく費用シェアと稼働率"
            icon={<PieIcon className="w-4 h-4 text-purple-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {countGroups(currentData, currentGrouping)} {GROUPING_UNIT_LABEL[currentGrouping]}
              </span>
            }
          >
            <CostAllocationCharts
              data={currentData}
              grouping={currentGrouping}
              onGroupingChange={handleGroupingChange}
            />
          </CollapsibleSection>
        );

      case 'yearly-trend':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="1 年推移 (月次・前年同月比)"
            subtitle="保存済みの月次集計から構成。確定 / 暫定 / 欠損を区別し、欠損月は 0 で補完しない"
            icon={<CalendarRange className="w-4 h-4 text-sky-400" />}
          >
            <YearlyTrendSection baseDir={dataBaseDir} isDemo={isDemoData} />
          </CollapsibleSection>
        );

      case 'budget':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="Cost Center 予算進捗管理"
            subtitle="上限Budget枠・無料枠・請求対象額とアラート"
            icon={<Landmark className="w-4 h-4 text-emerald-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentData.cost_center_budgets?.length || 0} Cost Centers
              </span>
            }
          >
            <CostCenterBudgetCards budgets={currentData.cost_center_budgets} />
          </CollapsibleSection>
        );

      case 'usage':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
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
          >
            <UsageMetricsCharts data={currentData} />
          </CollapsibleSection>
        );

      case 'users':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="ユーザー別利用明細テーブル"
            subtitle="全アカウントの利用ステータス、推計費用、最終アクティビティ"
            icon={<Users2 className="w-4 h-4 text-blue-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentData.users.length} 名
              </span>
            }
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
        );

      case 'budget-timeline':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="Cost Center 予算推移と上限到達予測"
            subtitle="シート費用の日次積み上がりと月次予算上限ラインの推移対比"
            icon={<Landmark className="w-4 h-4 text-teal-400" />}
          >
            {liveBudgetForecast && (
              <CostCenterBudgetTimeline
                budgets={currentData.cost_center_budgets ?? []}
                costCenterDaily={liveBudgetForecast.daily}
                start={liveBudgetForecast.period.start}
                end={liveBudgetForecast.period.end}
                forecastEnabled={liveBudgetForecast.period.monthly}
                note="自動収集データのため、利用額は各シートの日割り費用 (月額課金の日次の積み上がり) です。"
              />
            )}
          </CollapsibleSection>
        );

      case 'credits':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="AI Credits & コスト内訳"
            subtitle="組織プール・モデル別クレジット消費量と超過ステータス"
            icon={<Coins className="w-4 h-4 text-amber-400" />}
          >
            <CreditsView
              viewModel={CreditsPresenter.present({ currentData, currentReportData })}
              currentReportData={currentReportData}
              baseDir={dataBaseDir}
              isDemo={isDemoData}
            />
          </CollapsibleSection>
        );

      case 'agent':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="AI Agent & MCP 活用動向"
            subtitle="VS Code Agent・カスタムAgent・MCPツール呼出・Coding Agent PRの動向"
            icon={<Bot className="w-4 h-4 text-purple-400" />}
          >
            <AgentActivityView viewModel={AgentPresenter.present({ currentData })} />
          </CollapsibleSection>
        );

      case 'adoption':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="AI 採用成熟度 (Impact Dashboard)"
            subtitle="No Cohort / Code First / Agent First / Multi-Agent の成熟度コホート分布"
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          >
            <AdoptionMaturityView viewModel={AdoptionPresenter.present({ currentData })} />
          </CollapsibleSection>
        );

      case 'audit':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="監査・データ品質サマリー"
            subtitle="自動収集の実行履歴・ソース別状態・品質チェック結果"
            icon={<ShieldCheck className="w-4 h-4 text-indigo-400" />}
          >
            <AuditDataQualitySection baseDir={dataBaseDir} isDemo={isDemoData} />
          </CollapsibleSection>
        );

      default:
        return null;
    }
  };

  const renderReportWidget = (widgetId: string, index: number, total: number) => {
    if (!currentReportData) return null;

    const dragAndMoveProps = {
      id: widgetId,
      canMoveUp: index > 0,
      canMoveDown: index < total - 1,
      onMoveUp: () => moveWidget(widgetId, 'up'),
      onMoveDown: () => moveWidget(widgetId, 'down'),
      onRemove: () => removeWidget(widgetId),
      draggable: true,
      isDragging: draggedWidgetId === widgetId,
      isDragOver: dragOverWidgetId === widgetId,
      onDragStart: handleDragStart(widgetId),
      onDragOver: handleDragOver(widgetId),
      onDragLeave: handleDragLeave(widgetId),
      onDrop: handleDrop(widgetId),
      onDragEnd: handleDragEnd,
    };

    if (isReportKpiWidgetId(widgetId)) {
      const title = catalogById.get(widgetId)?.title ?? widgetId;
      return (
        <WidgetCardFrame key={widgetId} {...dragAndMoveProps} title={title}>
          <SingleMonthlyReportKpiCard cardId={widgetId} reportData={currentReportData} />
        </WidgetCardFrame>
      );
    }

    const commonProps = {
      ...dragAndMoveProps,
      isExpanded: isExpanded(widgetId),
      onToggle: () => toggle(widgetId),
      className: 'col-span-full',
    };

    switch (widgetId) {
      case 'report_charts':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="3軸集計・費用配賦 & AIモデル別・日別推移"
            subtitle="部署/Cost Center別シェアとモデル別消費額"
            icon={<PieIcon className="w-4 h-4 text-teal-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800 font-mono">
                {currentReportData.model_breakdown.length} モデル
              </span>
            }
          >
            <MonthlyReportCharts
              reportData={currentReportData}
              grouping={currentGrouping}
              onGroupingChange={handleGroupingChange}
              selectedGroup={selectedGroup}
              baseDir={dataBaseDir}
              isDemo={isDemoData}
            />
          </CollapsibleSection>
        );

      case 'report_users':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="ユーザー別月次明細テーブル"
            subtitle="月次利用リクエスト数、消費額、主要モデル一覧"
            icon={<Users2 className="w-4 h-4 text-blue-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {currentReportData.user_details.length} 名
              </span>
            }
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
        );

      case 'report_budget':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="Cost Center 予算進捗管理"
            subtitle="月次レポート実績と上限Budget枠・無料枠の突合カード"
            icon={<Landmark className="w-4 h-4 text-emerald-400" />}
            summaryChips={
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {reportBudgets.length} Cost Centers
              </span>
            }
          >
            <CostCenterBudgetCards budgets={reportBudgets} />
          </CollapsibleSection>
        );

      case 'report_budget_timeline':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="Cost Center 予算推移と上限到達予測"
            subtitle="日次累積利用額と80%予測区間による上限到達日予測"
            icon={<Landmark className="w-4 h-4 text-teal-400" />}
          >
            <CostCenterBudgetTimeline
              budgets={reportBudgets}
              costCenterDaily={currentReportData.cost_center_daily}
              start={monthPeriod(currentReportData.report_month).start}
              end={monthPeriod(currentReportData.report_month).end}
              forecastEnabled
            />
          </CollapsibleSection>
        );

      case 'report_credits':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="AI Credits & コスト内訳"
            subtitle="月次レポートに基づくAIクレジット消費とモデル別内訳"
            icon={<Coins className="w-4 h-4 text-amber-400" />}
          >
            <CreditsView
              viewModel={CreditsPresenter.present({ currentData, currentReportData })}
              currentReportData={currentReportData}
              baseDir={dataBaseDir}
              isDemo={isDemoData}
            />
          </CollapsibleSection>
        );

      case 'report_audit':
        return (
          <CollapsibleSection
            key={widgetId}
            {...commonProps}
            title="監査・データ品質サマリー"
            subtitle="収集実行履歴・データ品質ステータス確認"
            icon={<ShieldCheck className="w-4 h-4 text-indigo-400" />}
          >
            <AuditDataQualitySection baseDir={dataBaseDir} isDemo={isDemoData} />
          </CollapsibleSection>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col space-y-6 w-full" data-testid="dashboard-view">
      {/* Dashboard ウィジェット管理ヘッダー ＆ 追加/リセット/一括開閉コントロール (Issue #331, #334) */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/50 text-indigo-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <h2 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
              Dashboard ウィジェット
            </h2>
            <span
              data-testid="overview-widget-count"
              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-400 font-mono border border-slate-700/50"
            >
              {activeWidgetIds.length} ウィジェット
            </span>
            {isCustomized && (
              <span
                data-testid="overview-widget-customized-badge"
                className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/70 font-semibold"
              >
                カスタム配置
              </span>
            )}
          </div>
        </div>

        {/* Widget 追加・プリセットリセット・一括開閉ボタン群 */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={() => setIsAddPanelOpen((prev) => !prev)}
            aria-expanded={isAddPanelOpen}
            data-testid="widget-add-button"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-200 hover:text-white bg-indigo-950/70 hover:bg-indigo-900/80 border border-indigo-800/70 transition-all cursor-pointer shadow-sm flex items-center space-x-1"
            title="ウィジェットを追加"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>ウィジェット追加</span>
            {availableToAdd.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-800/80 text-[10px] font-mono">
                {availableToAdd.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              resetWidgets();
              setIsAddPanelOpen(false);
            }}
            disabled={!isCustomized}
            data-testid="widget-reset-button"
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/80 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer shadow-sm flex items-center space-x-1"
            title="デフォルトプリセットへリセット"
            aria-label="デフォルトプリセットへリセット"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">リセット</span>
          </button>

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

      {/* Widget カタログ追加パネル */}
      {isAddPanelOpen && (
        <div
          data-testid="widget-catalog-panel"
          role="region"
          aria-label="ウィジェット追加カタログ"
          className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-indigo-800/60 shadow-lg space-y-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white">
                ウィジェットカタログ
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                ダッシュボードに追加する KPI サマリーカード（3列×2行グリッド）または詳細分析セクション（全幅）を選択してください（設定はブラウザに自動保存されます）
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* カテゴリフィルタータブ (#344) */}
              <div
                className="inline-flex items-center p-1 rounded-xl bg-slate-950/90 border border-slate-800"
                role="group"
                aria-label="ウィジェット種別フィルター"
              >
                <button
                  type="button"
                  onClick={() => setCatalogFilter('all')}
                  data-testid="widget-catalog-filter-all"
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    catalogFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  すべて ({catalog.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogFilter('kpi')}
                  data-testid="widget-catalog-filter-kpi"
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    catalogFilter === 'kpi'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60 shadow-sm'
                      : 'text-slate-400 hover:text-emerald-300'
                  }`}
                >
                  KPI カード ({kpiCatalogItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogFilter('section')}
                  data-testid="widget-catalog-filter-section"
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    catalogFilter === 'section'
                      ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/60 shadow-sm'
                      : 'text-slate-400 hover:text-indigo-300'
                  }`}
                >
                  分析セクション ({sectionCatalogItems.length})
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsAddPanelOpen(false)}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>

          {/* グループ 1: KPI サマリーウィジェット (3列×2行グリッド配置) */}
          {(catalogFilter === 'all' || catalogFilter === 'kpi') && (
            <div
              data-testid="widget-catalog-group-kpi"
              className="space-y-2.5 p-3.5 rounded-xl bg-emerald-950/15 border border-emerald-900/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/70">
                    KPI サマリーウィジェット
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    単一指標カード（3列×2行グリッド・1/3幅配置）
                  </span>
                </div>
                <span
                  data-testid="widget-catalog-kpi-status"
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                >
                  {placedKpiCount} / {kpiCatalogItems.length} 配置中
                </span>
              </div>

              <div
                data-testid="widget-catalog-kpi-grid"
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {kpiCatalogItems.map((item) => {
                  const isPlaced = activeWidgetIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      data-testid={`widget-catalog-item-${item.id}`}
                      data-widget-category="kpi"
                      className="w-full min-w-[min(100%,21rem)] flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/80 border border-emerald-900/50 border-l-4 border-l-emerald-500/80"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 bg-emerald-950/90 text-emerald-300 border border-emerald-800/70">
                            KPI カード (1/3幅)
                          </span>
                          {item.defaultPreset && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                              標準プリセット
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isPlaced}
                        onClick={() => addWidget(item.id)}
                        data-testid={`widget-add-item-${item.id}`}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                          isPlaced
                            ? 'bg-slate-800 text-slate-400 opacity-60 pointer-events-none'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        }`}
                      >
                        {isPlaced ? '配置済み' : '＋ 追加'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* グループ 2: 詳細分析セクションウィジェット (大型パネル・全幅展開) */}
          {(catalogFilter === 'all' || catalogFilter === 'section') && (
            <div
              data-testid="widget-catalog-group-section"
              className="space-y-2.5 p-3.5 rounded-xl bg-indigo-950/15 border border-indigo-900/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-700/70">
                    詳細分析セクションウィジェット
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    グラフ・明細テーブル・診断パネル（全幅アコーディオン配置）
                  </span>
                </div>
                <span
                  data-testid="widget-catalog-section-status"
                  className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60"
                >
                  {placedSectionCount} / {sectionCatalogItems.length} 配置中
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {sectionCatalogItems.map((item) => {
                  const isPlaced = activeWidgetIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      data-testid={`widget-catalog-item-${item.id}`}
                      data-widget-category="section"
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/80 border border-indigo-900/50 border-l-4 border-l-indigo-500/80"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                            {item.title}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 bg-indigo-950/90 text-indigo-300 border border-indigo-800/70">
                            分析セクション (全幅)
                          </span>
                          {item.defaultPreset && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                              標準プリセット
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.subtitle}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={isPlaced}
                        onClick={() => addWidget(item.id)}
                        data-testid={`widget-add-item-${item.id}`}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                          isPlaced
                            ? 'bg-slate-800 text-slate-400 opacity-60 pointer-events-none'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        {isPlaced ? '配置済み' : '＋ 追加'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Widget 空状態 (すべての Widget が削除された場合) */}
      {activeWidgetIds.length === 0 && (
        <div
          data-testid="overview-widget-empty"
          className="p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-3"
        >
          <p className="text-sm font-semibold text-slate-300">
            表示中のウィジェットがありません
          </p>
          <p className="text-xs text-slate-400">
            「ウィジェット追加」から必要な KPI や分析セクションを追加するか、「リセット」でデフォルトプリセットへ戻せます。
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddPanelOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            >
              ウィジェットを追加
            </button>
            <button
              type="button"
              onClick={resetWidgets}
              data-testid="widget-empty-reset-button"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
            >
              デフォルトプリセットに戻す
            </button>
          </div>
        </div>
      )}

      {/* 個別 Widget グリッド (KPI は 3列×2行 (3x2) グリッド・スマホ縦1列幅以上、セクションは col-span-full で統一順序配置 #334, #364) */}
      {activeSource === 'live_metrics' && currentData && activeWidgetIds.length > 0 && (
        <div
          data-testid="overview-widget-list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full"
        >
          {activeWidgetIds.map((widgetId, idx) =>
            renderLiveWidget(widgetId, idx, activeWidgetIds.length)
          )}
        </div>
      )}

      {isReportSource && currentReportData && activeWidgetIds.length > 0 && (
        <div
          data-testid="overview-widget-list"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 w-full"
        >
          {activeWidgetIds.map((widgetId, idx) =>
            renderReportWidget(widgetId, idx, activeWidgetIds.length)
          )}
        </div>
      )}
    </div>
  );
};

export default View;
