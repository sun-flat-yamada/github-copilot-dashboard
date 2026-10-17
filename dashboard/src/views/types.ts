import type React from 'react';
import type {
  CostCenterBudget,
  DataSourceType,
  GroupingDimension,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  UserSeatStatus,
  UserUsageProfile,
} from '../../../src/types/copilot';
import type { DeepAnalysisDataSourceInfo } from '../../../src/types/deep-analysis';

/** ビューが必要とするデータセット (Dataset 層の論理名)。 */
export type ViewDatasetId = 'scope' | 'report';

/**
 * View Registry が各ビューへ渡す描画コンテキスト。
 * App.tsx が組み立てる唯一の入口で、ビューは props を個別に受け取らずこれだけに依存する。
 */
export interface ViewContext {
  activeSource: DataSourceType;
  /** データの取得元ディレクトリ (LIVE: ./data / DEMO: ./data/demo)。ビューが追加データセットを取得するときに使う */
  dataBaseDir: string;
  isReportSource: boolean;
  /** デモ由来データか (Metric Registry の品質属性判定に使う) */
  isDemoData: boolean;
  currentData: ScopeAggregatedData | null;
  /** 前期 (月次=前月 / 日次=前日) の Live スコープ。同じフィルター適用済み。無ければ null (前期比は「—（理由）」) */
  previousData?: ScopeAggregatedData | null;
  currentReportData: MonthlyReportAggregatedData | null;
  /** 月次レポート表示用に合成した Cost Center 予算 */
  reportBudgets: CostCenterBudget[];
  deepAnalysisProfiles: UserUsageProfile[];
  deepAnalysisSourceInfo: DeepAnalysisDataSourceInfo;
  focusedUserLogin: string;
  setFocusedUserLogin: (login: string) => void;
  focusedRadarModelId: string;
  userTableFilterStatus: UserSeatStatus | 'all';
  currentGrouping: GroupingDimension;
  selectedGroup: string;
  setSelectedGroup: (group: string) => void;
  onGroupingChange: (grouping: GroupingDimension) => void;
  accordion: {
    isExpanded: (id: string) => boolean;
    toggle: (id: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
  };
  onFilterIdle: () => void;
  onSelectUserForTrend: (login: string) => void;
  onOpenRadar: (modelId?: string) => void;
  onOpenDeepAnalysis: (login?: string) => void;
  /** レーダーで選んだモデルを指定してトレンドビューへ遷移する */
  onOpenTrendForModel: (modelId: string) => void;
}

/**
 * ビュー 1 つ分の宣言 (manifest)。
 * 新ビューは `views/<id>/manifest.ts` + `views/<id>/View.tsx` の 2 ファイルを置くだけで
 * ナビゲーションと描画に現れる (App.tsx / ViewNavigation は変更しない)。
 */
export interface ViewManifest {
  /** ビュー ID (一意)。既存ビューは AnalysisViewId と同値 */
  id: string;
  /** ナビゲーションのラベル */
  label: string;
  title: string;
  description: string;
  iconName: string;
  /** ナビゲーションの並び順 (昇順) */
  order: number;
  supportedDataSources: DataSourceType[];
  /** このビューの入力となるデータセット。いずれか 1 つでも取得済みなら描画可能 (空配列はデータ非依存) */
  requiredDatasets: ViewDatasetId[];
  badge?: string;
  badgeColor?: string;
  /** 表示条件。false のビューはナビゲーションにも描画にも出ない (権限制御などに使う) */
  isVisible?: (ctx: ViewContext) => boolean;
  component: React.ComponentType<{ ctx: ViewContext }>;
}
