import React from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import { DollarSign, Users, AlertTriangle, AlertCircle, CheckCircle2, MessageSquare, FileCode } from 'lucide-react';

interface KpiSummaryCardsProps {
  data: ScopeAggregatedData;
}

export const KpiSummaryCards: React.FC<KpiSummaryCardsProps> = ({ data }) => {
  const { overview, scope_type } = data;

  const costLabel =
    scope_type === 'daily'
      ? '当日 日割り費用'
      : scope_type === 'monthly'
      ? '当月 累計費用'
      : '期間 累計費用';

  const isChatMissing = overview.missing_metrics?.includes('copilot_ide_chat');
  const isLanguageMissing = overview.missing_metrics?.includes('copilot_ide_code_completions');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. 総費用 (利用費用 & 超過請求費用) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">{costLabel}</span>
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-800/60 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-100">
              ${overview.total_spend_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">利用費用</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            契約シート数: <span className="text-slate-300 font-medium">{overview.total_seats} 席</span>
          </p>

          {/* 超過請求費用 & 上限Limit設定値の併記 */}
          {overview.total_net_billable_usd !== undefined && (
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">超過請求費用:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-semibold text-emerald-400">
                  ${overview.total_net_billable_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                {overview.total_spending_limit_usd !== undefined && overview.total_spending_limit_usd > 0 && (
                  <span className="text-slate-500 font-mono text-[10px]">
                    (上限: ${overview.total_spending_limit_usd.toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. アクティブ率 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">アクティブ利用率</span>
          <div className="p-2 rounded-lg bg-blue-950/80 border border-blue-800/60 text-blue-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-slate-100">
            {(overview.active_ratio * 100).toFixed(1)}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            稼働ユーザー: <span className="text-blue-400 font-medium">{overview.active_users}</span> / {overview.total_seats} 名
          </p>
        </div>
      </div>

      {/* 3. 遊休コスト / 削減可能額 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-800/80 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-400">遊休コスト (削減可能)</span>
          <div className="p-2 rounded-lg bg-amber-950/80 border border-amber-800/60 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-amber-300">
            ${overview.idle_waste_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            30日以上未利用: <span className="text-amber-400 font-semibold">{overview.idle_seats} 席</span>
          </p>
        </div>
      </div>

      {/* 4. 受諾率 & コード貢献 (欠損時はエラーアイコン表示) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-purple-400">AIコード受諾率</span>
          <div className="flex items-center space-x-1">
            {(isChatMissing || isLanguageMissing) && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1"
                title="一部のメトリクスがAPIエラーにより取得不能でした"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>データ一部不明</span>
              </span>
            )}
            <div className="p-2 rounded-lg bg-purple-950/80 border border-purple-800/60 text-purple-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="text-2xl font-bold text-purple-300 flex items-center space-x-2">
            <span>{(overview.overall_acceptance_rate * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
            <span className="flex items-center space-x-1">
              {isChatMissing ? (
                <span className="text-rose-400 flex items-center space-x-1 font-semibold" title="チャットAPI取得異常">
                  <AlertCircle className="w-3 h-3 text-rose-400" />
                  <span>不明 (API制限)</span>
                </span>
              ) : (
                <>
                  <MessageSquare className="w-3 h-3 text-slate-400" />
                  <span>{overview.total_chats.toLocaleString()} chats</span>
                </>
              )}
            </span>
            <span className="flex items-center space-x-1">
              <FileCode className="w-3 h-3 text-slate-400" />
              <span>{overview.total_pr_summaries.toLocaleString()} PRs</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
