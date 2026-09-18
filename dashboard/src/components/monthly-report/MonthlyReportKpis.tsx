import React from 'react';
import { DollarSign, Sparkles, Users, Cpu, Boxes } from 'lucide-react';
import { MonthlyReportAggregatedData } from '../../../../src/types/copilot';

interface MonthlyReportKpisProps {
  reportData: MonthlyReportAggregatedData;
}

export const MonthlyReportKpis: React.FC<MonthlyReportKpisProps> = ({ reportData }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* カード 1: 請求実額 */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">月間実費用 (Net Spend)</span>
          <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-800/60 text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline space-x-2">
          <span className="text-2xl font-black text-white tracking-tight">
            ${reportData.overview.total_net_spend_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="mt-1 text-[11px] text-slate-400 flex items-center space-x-1.5">
          <span>定価: ${reportData.overview.total_gross_spend_usd.toFixed(2)}</span>
          {reportData.overview.total_discount_usd > 0 && (
            <span className="text-emerald-400">
              (-${reportData.overview.total_discount_usd.toFixed(2)})
            </span>
          )}
        </div>
      </div>

      {/* カード 2: 総リクエスト数 */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">総リクエスト / クレジット</span>
          <div className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-800/60 text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-black text-white tracking-tight">
            {reportData.overview.total_requests.toLocaleString()}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">リクエスト / AIC 呼出総量</p>
      </div>

      {/* カード 3: アクティブ人数 */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">レポート内アクティブ人数</span>
          <div className="p-1.5 rounded-lg bg-blue-950 border border-blue-800/60 text-blue-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <span className="text-2xl font-black text-white tracking-tight">
            {reportData.overview.total_active_users}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">利用履歴のあるユニークアカウント</p>
      </div>

      {/* カード 4: 最多使用モデル */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">最多利用 AI モデル</span>
          <div className="p-1.5 rounded-lg bg-purple-950 border border-purple-800/60 text-purple-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 truncate">
          <span className="text-lg font-bold text-white tracking-tight">
            {reportData.overview.top_model}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {reportData.model_breakdown[0]?.percentage || 0}% のリクエストを占有
        </p>
      </div>

      {/* カード 5: 主要課金 SKU */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">主契約 / SKU</span>
          <div className="p-1.5 rounded-lg bg-amber-950 border border-amber-800/60 text-amber-400">
            <Boxes className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 truncate">
          <span className="text-sm font-bold text-white font-mono">
            {reportData.overview.top_sku}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">主要請求カテゴリ</p>
      </div>
    </div>
  );
};
