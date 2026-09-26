import { DataSourceType } from './copilot.js';

export type AnalysisViewId =
  | 'overview'
  | 'users'
  | 'trend'
  | 'budget'
  | 'deep_analysis'
  | 'model_radar'
  | 'credits'
  | 'agent'
  | 'adoption';

export type ViewCapability =
  | 'kpi_summary'
  | 'cost_allocation'
  | 'group_ranking'
  | 'user_table'
  | 'user_trend'
  | 'budget_cards'
  | 'deep_diagnostics'
  | 'model_radar'
  | 'credits_analysis'
  | 'agent_activity'
  | 'adoption_maturity';

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
  {
    id: 'credits',
    title: 'AI Credits & コスト分析',
    shortTitle: 'AI Credits',
    description: '組織プール消費・モデル別クレジット内訳・個人上限と超過ステータス',
    iconName: 'Coins',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['credits_analysis'],
    badge: '2026.06+',
    badgeColor: 'amber',
  },
  {
    id: 'agent',
    title: 'AI Agent & MCP 活用動向',
    shortTitle: 'Agent活用',
    description: 'VS Code Agent・カスタムAgent・MCPツール呼出・Coding Agent PRの統合分析',
    iconName: 'Bot',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['agent_activity'],
    badge: 'New',
    badgeColor: 'purple',
  },
  {
    id: 'adoption',
    title: 'AI 採用成熟度 (Impact Dashboard)',
    shortTitle: '採用成熟度',
    description: 'No Cohort / Code First / Agent First / Multi-Agent の成熟度コホート推移',
    iconName: 'TrendingUp',
    supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
    requiredCapabilities: ['adoption_maturity'],
    badge: 'Impact',
    badgeColor: 'emerald',
  },
];
