import React from 'react';
import { UserDiagnosticResult } from '../../../../src/types/deep-analysis';
import { Activity } from 'lucide-react';

interface HealthScoreCardProps {
  diagnosticResult: UserDiagnosticResult;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ diagnosticResult }) => {
  const { healthScore, healthStatus, metricsSummary, period } = diagnosticResult;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* 総合健全度スコアメーター */}
      <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>AI利用 総合健全度スコア</span>
          </span>
          <span
            className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${
              healthStatus === 'healthy'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : healthStatus === 'warning'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}
          >
            {healthStatus === 'healthy' ? '健全' : healthStatus === 'warning' ? '注意' : '要改善'}
          </span>
        </div>

        <div className="my-4 flex items-baseline justify-center space-x-2">
          <span
            className={`text-6xl font-black tracking-tight ${
              healthScore >= 80
                ? 'text-emerald-400'
                : healthScore >= 60
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {healthScore}
          </span>
          <span className="text-slate-500 font-bold text-lg">/ 100</span>
        </div>

        {/* プログレスバー */}
        <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800 mb-2">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              healthScore >= 80
                ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                : healthScore >= 60
                ? 'bg-gradient-to-r from-amber-600 to-yellow-400'
                : 'bg-gradient-to-r from-rose-600 to-red-400'
            }`}
            style={{ width: `${healthScore}%` }}
          />
        </div>

        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          {period.label} の利用実績からAIアンチパターン兆候の有無を総合評価
        </p>
      </div>

      {/* 対象期間中の実績サマリー 6分割グリッド */}
      <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div className="border-b border-slate-800 pb-2 mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {period.label} の利用サマリー (稼働日数: {period.activeDays} / {period.totalDays} 日)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">チャット回数</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {metricsSummary.totalChats.toLocaleString()} 回
            </div>
            <span className="text-[10px] text-slate-500">1日平均 {metricsSummary.dailyAvgChats} 回</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">インライン提案数</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {metricsSummary.totalSuggestions.toLocaleString()} 件
            </div>
            <span className="text-[10px] text-slate-500">
              1日平均 {metricsSummary.dailyAvgSuggestions} 件
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">提案受諾率</span>
            <div
              className={`text-lg font-bold mt-0.5 ${
                metricsSummary.acceptanceRatePercent >= 30
                  ? 'text-emerald-400'
                  : metricsSummary.acceptanceRatePercent >= 15
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {metricsSummary.acceptanceRatePercent}%
            </div>
            <span className="text-[10px] text-slate-500">受諾: {metricsSummary.totalAcceptances} 件</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">推定APIコスト</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              ${metricsSummary.totalCostUsd.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-500">モデル従量概算</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">稼働率 (Active Days)</span>
            <div className="text-lg font-bold text-white mt-0.5">
              {period.totalDays > 0 ? Math.round((period.activeDays / period.totalDays) * 100) : 0}%
            </div>
            <span className="text-[10px] text-slate-500">
              {period.activeDays} / {period.totalDays} 日
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <span className="text-[11px] text-slate-400 font-medium">検出兆候パターン</span>
            <div className="text-lg font-bold text-indigo-400 mt-0.5">
              {diagnosticResult.patterns.filter((p) => p.probabilityPercent >= 40).length} 件
            </div>
            <span className="text-[10px] text-slate-500">中・高リスク判定数</span>
          </div>
        </div>
      </div>
    </div>
  );
};
