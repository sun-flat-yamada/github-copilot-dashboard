import { useState, useCallback, useMemo } from 'react';

export const OVERVIEW_WIDGETS_STORAGE_KEY = 'copilot_dashboard_overview_widgets_v1';

export type OverviewWidgetMode = 'live' | 'report';
export type OverviewWidgetSize = 'kpi' | 'full';

export interface OverviewWidgetCatalogItem {
  id: string;
  title: string;
  subtitle: string;
  defaultPreset: boolean;
  mode: OverviewWidgetMode;
  size: OverviewWidgetSize;
}

export const LIVE_WIDGET_CATALOG: readonly OverviewWidgetCatalogItem[] = [
  {
    id: 'kpi_total_spend',
    title: '当月 月額費用 (シート費)',
    subtitle: '契約シート数・利用費用・超過請求費用・月末着地予測',
    defaultPreset: true,
    mode: 'live',
    size: 'kpi',
  },
  {
    id: 'kpi_active_rate',
    title: 'シート稼働率',
    subtitle: '契約シートに対するアクティブユーザー比率と前期比',
    defaultPreset: true,
    mode: 'live',
    size: 'kpi',
  },
  {
    id: 'kpi_idle_waste',
    title: '遊休シート推定無駄コスト',
    subtitle: '遊休基準に基づく削減見込み額と遊休席数',
    defaultPreset: true,
    mode: 'live',
    size: 'kpi',
  },
  {
    id: 'kpi_budget_utilization',
    title: '予算消化率',
    subtitle: '支出上限に対する超過請求費用の消化率',
    defaultPreset: true,
    mode: 'live',
    size: 'kpi',
  },
  {
    id: 'kpi_acceptance_rate',
    title: 'Inline補完受諾率',
    subtitle: 'IDEコード補完受諾率・チャット数・PR要約数',
    defaultPreset: true,
    mode: 'live',
    size: 'kpi',
  },
  {
    id: 'advisor',
    title: '遊休シート・コスト削減アドバイザー',
    subtitle: '遊休アカウント検出と削減可能額',
    defaultPreset: true,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'allocation',
    title: 'グループ別 コスト内訳 & ライセンス稼働状況',
    subtitle: '選択仕訳軸（ユーザー定義Gr / Cost Center / Org）に基づく費用シェアと稼働率',
    defaultPreset: true,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'yearly-trend',
    title: '1 年推移 (月次・前年同月比)',
    subtitle: '保存済みの月次集計から構成。確定 / 暫定 / 欠損を区別し、欠損月は 0 で補完しない',
    defaultPreset: true,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'budget',
    title: 'Cost Center 予算進捗管理',
    subtitle: '上限Budget枠・無料枠・請求対象額とアラート',
    defaultPreset: true,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'usage',
    title: '日次アクティビティ & 言語別Inline補完受諾率推移',
    subtitle: '日次アクティブ推移、Inline補完受諾率、主要プログラミング言語シェア',
    defaultPreset: true,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'users',
    title: 'ユーザー別利用明細テーブル',
    subtitle: '全アカウントの利用ステータス、推計費用、最終アクティビティ',
    defaultPreset: true,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'budget-timeline',
    title: 'Cost Center 予算推移と上限到達予測',
    subtitle: 'シート費用の日次積み上がりと月次予算上限ラインの推移対比',
    defaultPreset: false,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'credits',
    title: 'AI Credits & コスト内訳',
    subtitle: '組織プール・モデル別クレジット消費量と超過ステータス',
    defaultPreset: false,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'agent',
    title: 'AI Agent & MCP 活用動向',
    subtitle: 'VS Code Agent・カスタムAgent・MCPツール呼出・Coding Agent PRの動向',
    defaultPreset: false,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'adoption',
    title: 'AI 採用成熟度 (Impact Dashboard)',
    subtitle: 'No Cohort / Code First / Agent First / Multi-Agent の成熟度コホート分布',
    defaultPreset: false,
    mode: 'live',
    size: 'full',
  },
  {
    id: 'audit',
    title: '監査・データ品質サマリー',
    subtitle: '自動収集の実行履歴・ソース別状態・品質チェック結果',
    defaultPreset: false,
    mode: 'live',
    size: 'full',
  },
] as const;

export const REPORT_WIDGET_CATALOG: readonly OverviewWidgetCatalogItem[] = [
  {
    id: 'report_kpi_cost',
    title: '費用サマリー (Cost Overview)',
    subtitle: '利用費用 (総額)・超過請求費用・無料枠控除',
    defaultPreset: true,
    mode: 'report',
    size: 'kpi',
  },
  {
    id: 'report_kpi_requests',
    title: '総リクエスト数',
    subtitle: 'リクエスト / AIC 呼出総量',
    defaultPreset: true,
    mode: 'report',
    size: 'kpi',
  },
  {
    id: 'report_kpi_active_users',
    title: 'アクティブ人数',
    subtitle: '利用履歴のあるユニークアカウント数',
    defaultPreset: true,
    mode: 'report',
    size: 'kpi',
  },
  {
    id: 'report_kpi_top_model',
    title: '最多使用モデル',
    subtitle: '最多リクエスト占有AIモデルとシェア',
    defaultPreset: true,
    mode: 'report',
    size: 'kpi',
  },
  {
    id: 'report_kpi_top_sku',
    title: '主要課金 SKU',
    subtitle: '主要請求カテゴリ',
    defaultPreset: true,
    mode: 'report',
    size: 'kpi',
  },
  {
    id: 'report_charts',
    title: '3軸集計・費用配賦 & AIモデル別・日別推移',
    subtitle: '部署/Cost Center別シェアとモデル別消費額',
    defaultPreset: true,
    mode: 'report',
    size: 'full',
  },
  {
    id: 'report_users',
    title: 'ユーザー別月次明細テーブル',
    subtitle: '月次利用リクエスト数、消費額、主要モデル一覧',
    defaultPreset: true,
    mode: 'report',
    size: 'full',
  },
  {
    id: 'report_budget',
    title: 'Cost Center 予算進捗管理',
    subtitle: '月次レポート実績と上限Budget枠・無料枠の突合カード',
    defaultPreset: false,
    mode: 'report',
    size: 'full',
  },
  {
    id: 'report_budget_timeline',
    title: 'Cost Center 予算推移と上限到達予測',
    subtitle: '日次累積利用額と80%予測区間による上限到達日予測',
    defaultPreset: false,
    mode: 'report',
    size: 'full',
  },
  {
    id: 'report_credits',
    title: 'AI Credits & コスト内訳',
    subtitle: '月次レポートに基づくAIクレジット消費とモデル別内訳',
    defaultPreset: false,
    mode: 'report',
    size: 'full',
  },
  {
    id: 'report_audit',
    title: '監査・データ品質サマリー',
    subtitle: '収集実行履歴・データ品質ステータス確認',
    defaultPreset: false,
    mode: 'report',
    size: 'full',
  },
] as const;

export const DEFAULT_LIVE_WIDGET_IDS: string[] = LIVE_WIDGET_CATALOG.filter((w) => w.defaultPreset).map((w) => w.id);
export const DEFAULT_REPORT_WIDGET_IDS: string[] = REPORT_WIDGET_CATALOG.filter((w) => w.defaultPreset).map((w) => w.id);

const VALID_LIVE_IDS = new Set<string>(LIVE_WIDGET_CATALOG.map((w) => w.id));
const VALID_REPORT_IDS = new Set<string>(REPORT_WIDGET_CATALOG.map((w) => w.id));

export interface PersistedOverviewWidgetsState {
  version: 1;
  liveWidgets: string[];
  reportWidgets: string[];
}

function sanitizeIdList(raw: unknown, validSet: Set<string>, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && validSet.has(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function loadPersistedOverviewWidgets(): PersistedOverviewWidgetsState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(OVERVIEW_WIDGETS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedOverviewWidgetsState>;
        if (parsed && typeof parsed === 'object') {
          return {
            version: 1,
            liveWidgets: sanitizeIdList(parsed.liveWidgets, VALID_LIVE_IDS, DEFAULT_LIVE_WIDGET_IDS),
            reportWidgets: sanitizeIdList(parsed.reportWidgets, VALID_REPORT_IDS, DEFAULT_REPORT_WIDGET_IDS),
          };
        }
      }
    }
  } catch {
    // Ignore storage read errors and fall back to default preset
  }
  return {
    version: 1,
    liveWidgets: [...DEFAULT_LIVE_WIDGET_IDS],
    reportWidgets: [...DEFAULT_REPORT_WIDGET_IDS],
  };
}

function savePersistedOverviewWidgets(state: PersistedOverviewWidgetsState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(OVERVIEW_WIDGETS_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore quota or storage write errors
  }
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useOverviewWidgets(mode: OverviewWidgetMode) {
  const [state, setState] = useState<PersistedOverviewWidgetsState>(() => loadPersistedOverviewWidgets());

  const updateState = useCallback(
    (updater: (prev: PersistedOverviewWidgetsState) => PersistedOverviewWidgetsState) => {
      setState((prev) => {
        const next = updater(prev);
        savePersistedOverviewWidgets(next);
        return next;
      });
    },
    []
  );

  const activeWidgetIds = mode === 'live' ? state.liveWidgets : state.reportWidgets;
  const catalog = mode === 'live' ? LIVE_WIDGET_CATALOG : REPORT_WIDGET_CATALOG;
  const defaultIds = mode === 'live' ? DEFAULT_LIVE_WIDGET_IDS : DEFAULT_REPORT_WIDGET_IDS;
  const validSet = mode === 'live' ? VALID_LIVE_IDS : VALID_REPORT_IDS;

  const availableToAdd = useMemo(
    () => catalog.filter((item) => !activeWidgetIds.includes(item.id)),
    [catalog, activeWidgetIds]
  );

  const isCustomized = useMemo(
    () => !arraysEqual(activeWidgetIds, defaultIds),
    [activeWidgetIds, defaultIds]
  );

  const addWidget = useCallback(
    (widgetId: string) => {
      if (!validSet.has(widgetId)) return;
      updateState((prev) => {
        const key = mode === 'live' ? 'liveWidgets' : 'reportWidgets';
        const list = prev[key];
        if (list.includes(widgetId)) return prev;
        return {
          ...prev,
          [key]: [...list, widgetId],
        };
      });
    },
    [mode, updateState, validSet]
  );

  const removeWidget = useCallback(
    (widgetId: string) => {
      updateState((prev) => {
        const key = mode === 'live' ? 'liveWidgets' : 'reportWidgets';
        const list = prev[key];
        if (!list.includes(widgetId)) return prev;
        return {
          ...prev,
          [key]: list.filter((id) => id !== widgetId),
        };
      });
    },
    [mode, updateState]
  );

  const moveWidget = useCallback(
    (widgetId: string, direction: 'up' | 'down') => {
      updateState((prev) => {
        const key = mode === 'live' ? 'liveWidgets' : 'reportWidgets';
        const list = [...prev[key]];
        const index = list.indexOf(widgetId);
        if (index === -1) return prev;
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= list.length) return prev;
        const [moved] = list.splice(index, 1);
        list.splice(targetIndex, 0, moved);
        return {
          ...prev,
          [key]: list,
        };
      });
    },
    [mode, updateState]
  );

  const reorderWidgets = useCallback(
    (fromWidgetId: string, toWidgetId: string) => {
      if (fromWidgetId === toWidgetId) return;
      updateState((prev) => {
        const key = mode === 'live' ? 'liveWidgets' : 'reportWidgets';
        const list = [...prev[key]];
        const fromIndex = list.indexOf(fromWidgetId);
        const toIndex = list.indexOf(toWidgetId);
        if (fromIndex === -1 || toIndex === -1) return prev;
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        return {
          ...prev,
          [key]: list,
        };
      });
    },
    [mode, updateState]
  );

  const resetWidgets = useCallback(() => {
    updateState((prev) => {
      const key = mode === 'live' ? 'liveWidgets' : 'reportWidgets';
      const fallback = mode === 'live' ? DEFAULT_LIVE_WIDGET_IDS : DEFAULT_REPORT_WIDGET_IDS;
      return {
        ...prev,
        [key]: [...fallback],
      };
    });
  }, [mode, updateState]);

  return {
    activeWidgetIds,
    catalog,
    availableToAdd,
    isCustomized,
    addWidget,
    removeWidget,
    moveWidget,
    reorderWidgets,
    resetWidgets,
  };
}
