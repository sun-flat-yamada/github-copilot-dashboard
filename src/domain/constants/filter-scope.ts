/**
 * フィルター (Cost Center / Org / 部署 / タグ / ユーザー) の適用対象外セクション。
 *
 * 利用状況メトリクスや日次推移は、ユーザー別の実測を持たない集計 (org / enterprise 全体) のため、
 * ユーザー条件で再集計できない。フィルター適用後も全社値のまま表示されることを、
 * 画面で明示する (絞り込み後の席数と並べて、同じ母集団の値のように読まれるのを防ぐ)。
 */

/** ライブ集計 (ScopeAggregatedData) でフィルター非対応のセクション */
export const LIVE_UNFILTERABLE_SECTIONS: readonly string[] = [
  'usage_metrics',
  'daily_trends',
  'top_languages',
  'agent_summary',
  'code_generation_summary',
  'outcome_indicators',
];

/** 月次レポート (MonthlyReportAggregatedData) でフィルター非対応のセクション */
export const REPORT_UNFILTERABLE_SECTIONS: readonly string[] = ['daily_trends', 'sku_breakdown'];

/** 注記バッジに表示する文言 */
export const UNFILTERED_SECTION_NOTICE = '全社値 (フィルター非対応)';
