import { DataSourceType } from './copilot.js';

export type AnalysisViewId =
  | 'overview'
  | 'users'
  | 'trend'
  | 'budget'
  | 'deep_analysis'
  | 'model_radar';

export type ViewCapability =
  | 'kpi_summary'
  | 'cost_allocation'
  | 'group_ranking'
  | 'user_table'
  | 'user_trend'
  | 'budget_cards'
  | 'deep_diagnostics'
  | 'model_radar';

export interface AnalysisViewDefinition {
  id: AnalysisViewId;
  title: string;
  shortTitle: string;
  description: string;
  iconName: string;
  supportedDataSources: DataSourceType[];
  requiredCapabilities: ViewCapability[];
  badge?: string;
  badgeColor?: string;
}

export const ANALYSIS_VIEW_REGISTRY: AnalysisViewDefinition[] = [
  {
    id: 'overview',
    title: 'コスト配賦 & 総合サマリー',
    shortTitle: 'コスト配賦',
    description: '3軸（部署・Cost Center・Organization）費用配賦とKPI概況',
    iconName: 'PieChart',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['kpi_summary', 'cost_allocation'],
  },
  {
    id: 'users',
    title: 'ユーザー別利用明細',
    shortTitle: 'ユーザー明細',
    description: '全ユーザーの稼働状況・推計費用・AI活用度の一覧',
    iconName: 'Users2',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['user_table', 'group_ranking'],
  },
  {
    id: 'trend',
    title: 'ユーザー別モデル推移 & 開発指標',
    shortTitle: 'モデル推移',
    description: '個人別の日次AIモデル利用割合および提案・受諾推移',
    iconName: 'Bot',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['user_trend'],
  },
  {
    id: 'budget',
    title: 'Cost Center 予算管理 (FinOps)',
    shortTitle: 'CostCenter予算',
    description: '各Cost Centerの上限枠・無料枠・実請求額と超過警告',
    iconName: 'Landmark',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['budget_cards'],
  },
  {
    id: 'deep_analysis',
    title: 'ディープ分析 (高度行動診断)',
    shortTitle: 'ディープ分析',
    description: '5つのアンチパターンとAI自律駆動深度による利用効率診断',
    iconName: 'BrainCircuit',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['deep_diagnostics'],
    badge: 'Pro',
    badgeColor: 'cyan',
  },
  {
    id: 'model_radar',
    title: 'AIモデル特性レーダー',
    shortTitle: 'モデル特性レーダー',
    description: '著名ベンチマーク最新実績に基づくモデル特性・適性比較',
    iconName: 'Compass',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['model_radar'],
  },
];
