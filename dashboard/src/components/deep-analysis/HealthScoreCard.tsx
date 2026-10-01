import React from 'react';
import { UserDiagnosticResult } from '../../../../src/types/deep-analysis';
import { Activity } from 'lucide-react';

interface HealthScoreCardProps {
  diagnosticResult: UserDiagnosticResult;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ diagnosticResult }) => {
  const { healthScore, healthStatus, metricsSummary, period, evaluatedPatternCount, patternCount } = diagnosticResult;
  // 判定に必要な実測値が揃ったパターンが 1 つも無いときは、スコアを出さない
  // (全パターンが判定不能なのに「健全 100 点」と見せかけない)
  const isScoreAvailable = evaluatedPatternCount > 0;
  const isPartiallyEvaluated = isScoreAvailable && evaluatedPatternCount < patternCount;
  const hasSuggestions = metricsSummary.totalSuggestions > 0;

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
              !isScoreAvailable
                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                : healthStatus === 'healthy'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : healthStatus === 'warning'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}
          >
            {!isScoreAvailable
              ? '判定不能'
              : healthStatus === 'healthy'
              ? '健全'
              : healthStatus === 'warning'
              ? '注意'
              : '要改善'}
          </span>
        </div>

        {isScoreAvailable ? (
          <>
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
          </>
        ) : (
          <div className="my-4 text-center" data-testid="health-score-unavailable">
            <span className="text-6xl font-black tracking-tight text-slate-600">—</span>
            <p className="text-xs text-slate-400 mt-2">判定に必要な実測値が揃っていないため、スコアを算出できません</p>
          </div>
        )}

        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          {period.label} の利用実績からAIアンチパターン兆候の有無を総合評価
        </p>
        <p
          className={`text-[11px] text-center mt-1 ${isPartiallyEvaluated ? 'text-amber-400' : 'text-slate-500'}`}
          data-testid="health-score-coverage"
          title="判定に必要な実測値が揃ったパターンだけから算出しています。判定不能のパターンはスコアに含まれません"
        >
          評価できたパターン: {evaluatedPatternCount} / {patternCount}
          {isPartiallyEvaluated && ' (判定不能のパターンはスコアに含まれません)'}
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
            <span className="text-[11px] text-slate-400 font-medium">Inline補完受諾率</span>
            <div
              className={`text-lg font-bold mt-0.5 ${
                !hasSuggestions
                  ? 'text-slate-500'
                  : metricsSummary.acceptanceRatePercent >= 30
                  ? 'text-emerald-400'
                  : metricsSummary.acceptanceRatePercent >= 15
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {hasSuggestions ? `${metricsSummary.acceptanceRatePercent}%` : '—'}
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
              {diagnosticResult.patterns.filter((p) => p.evaluable !== false && p.probabilityPercent >= 40).length} 件
            </div>
            <span className="text-[10px] text-slate-500">中・高リスク判定数 (判定不能を除く)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
