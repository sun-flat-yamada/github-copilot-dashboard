import React, { useState, useMemo } from 'react';
import { ScopeAggregatedData } from '../../../src/types/copilot';
import {
  AnalysisMethodId,
  AnalysisPeriodScopeType,
  CustomDateRange,
  InefficiencyPatternId,
} from '../../../src/types/deep-analysis';
import { InefficiencyDiagnosticEngine } from '../../../src/processor/inefficiency-diagnostic';
import { User } from 'lucide-react';
import { MethodSelector } from './deep-analysis/MethodSelector';
import { UserPeriodControls } from './deep-analysis/UserPeriodControls';
import { HealthScoreCard } from './deep-analysis/HealthScoreCard';
import { PatternAccordionItem } from './deep-analysis/PatternAccordionItem';
import { PatternDrilldownChart } from './deep-analysis/PatternDrilldownChart';
import { PrescriptionList } from './deep-analysis/PrescriptionList';

interface DeepAnalysisViewProps {
  aggregatedData: ScopeAggregatedData;
  initialSelectedLogin?: string;
}

export const DeepAnalysisView: React.FC<DeepAnalysisViewProps> = ({
  aggregatedData,
  initialSelectedLogin,
}) => {
  const profiles = useMemo(() => {
    return aggregatedData.user_profiles || [];
  }, [aggregatedData]);

  // 1. 分析方式セレクターステート
  const [selectedMethodId, setSelectedMethodId] =
    useState<AnalysisMethodId>('inefficient_usage_diagnostic');

  // 2. ユーザー選択ステート
  const [selectedLogin, setSelectedLogin] = useState<string>(() => {
    if (initialSelectedLogin && profiles.some((p) => p.login === initialSelectedLogin)) {
      return initialSelectedLogin;
    }
    // デフォルト: 兆候があるユーザーまたは最初のユーザー
    const interestingUser =
      profiles.find((p) => p.login === 'kenji-sato') ||
      profiles.find((p) => p.login === 'yuki-takahashi') ||
      profiles[0];
    return interestingUser?.login || '';
  });

  // 3. 対象区間選択ステート
  const [periodScope, setPeriodScope] = useState<AnalysisPeriodScopeType>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange>(() => {
    const end = aggregatedData.date_range?.end || '2026-09-10';
    const d = new Date(end);
    d.setDate(d.getDate() - 14);
    const start = d.toISOString().split('T')[0];
    return { start, end };
  });
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // 4. ドリルダウン展開中パターン
  const [expandedPatternId, setExpandedPatternId] = useState<InefficiencyPatternId | null>(
    'tab_spamming_roulette'
  );

  // 現在選択中のユーザープロファイル
  const currentProfile = useMemo(() => {
    return profiles.find((p) => p.login === selectedLogin) || profiles[0] || null;
  }, [profiles, selectedLogin]);

  // 非効率パターン診断の実行
  const diagnosticResult = useMemo(() => {
    if (!currentProfile) return null;
    return InefficiencyDiagnosticEngine.diagnoseUser(
      currentProfile,
      periodScope,
      periodScope === 'custom' ? customRange : undefined,
      profiles
    );
  }, [currentProfile, periodScope, customRange, profiles]);

  const handleTogglePatternExpand = (patternId: InefficiencyPatternId) => {
    setExpandedPatternId((prev) => (prev === patternId ? null : patternId));
  };

  if (!currentProfile || !diagnosticResult) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 max-w-4xl mx-auto my-10">
        <User className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">ユーザーデータが見つかりません</h3>
        <p className="text-sm">プロファイル情報を読み込めませんでした。スコープを確認してください。</p>
      </div>
    );
  }

  const { patterns, drilldown } = diagnosticResult;
  const activePattern = patterns.find((p) => p.id === expandedPatternId);

  return (
    <div className="flex flex-col space-y-6 animate-fadeIn pb-12">
      {/* 1. 専用ビュー ヘッダー & 分析方式セレクター */}
      <MethodSelector
        selectedMethodId={selectedMethodId}
        onSelectMethod={setSelectedMethodId}
      />

      {/* 2. 共通操作バー: 診断対象ユーザー & 対象区間セレクター */}
      <UserPeriodControls
        profiles={profiles}
        currentProfile={currentProfile}
        selectedLogin={selectedLogin}
        onSelectLogin={setSelectedLogin}
        periodScope={periodScope}
        onSelectPeriodScope={(scope) => {
          setPeriodScope(scope);
          if (scope !== 'custom') setIsCustomPickerOpen(false);
        }}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        isCustomPickerOpen={isCustomPickerOpen}
        onToggleCustomPicker={() => setIsCustomPickerOpen(!isCustomPickerOpen)}
      />

      {/* 3. 診断サマリー & 総合健全度スコアメーター */}
      <HealthScoreCard diagnosticResult={diagnosticResult} />

      {/* 4. 非効率パターン判定 & 兆候確率 */}
      <PatternAccordionItem
        patterns={patterns}
        expandedPatternId={expandedPatternId}
        onTogglePatternExpand={handleTogglePatternExpand}
      />

      {/* 5. ドリルダウン深掘り分析パネル */}
      {expandedPatternId && activePattern && (
        <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-2xl p-6 shadow-2xl space-y-6 animate-fadeIn">
          {/* ドリルダウン ヘッダー */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700 text-xs font-bold font-mono">
                  DRILLDOWN
                </span>
                <h3 className="text-base font-bold text-white">
                  {activePattern.name} の深掘り分析
                </h3>
                <span className="text-xs font-mono text-slate-400">({activePattern.nameEn})</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {activePattern.summary}
              </p>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">判定兆候確率</span>
                <span
                  className={`text-2xl font-black ${
                    activePattern.probabilityPercent >= 70
                      ? 'text-rose-400'
                      : activePattern.probabilityPercent >= 40
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {activePattern.probabilityPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* 判定要因 (Contributing Factors) カード一覧 */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              判定根拠・要因指標 (Contributing Factors)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activePattern.contributingFactors.map((factor, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200">
                      {factor.metricName}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        factor.severity === 'danger'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : factor.severity === 'warning'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : factor.severity === 'good'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      実測: {factor.currentValueFormatted}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {factor.description}
                  </p>
                  <span className="text-[10px] text-slate-500 mt-2 font-mono">
                    推奨閾値: {factor.recommendedThresholdFormatted}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* チャートエリア & 組織平均対比 */}
          <PatternDrilldownChart drilldown={drilldown} />

          {/* 改善アクション処方箋 */}
          <PrescriptionList recommendations={activePattern.recommendations} />
        </div>
      )}
    </div>
  );
};
