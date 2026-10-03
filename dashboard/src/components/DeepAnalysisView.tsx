import React, { useState, useMemo, useEffect } from 'react';
import { ScopeAggregatedData, UserUsageProfile } from '../../../src/types/copilot';
import {
  AnalysisMethodId,
  AnalysisPeriodScopeType,
  CustomDateRange,
  DeepAnalysisDataSourceInfo,
  InefficiencyPatternId,
} from '../../../src/types/deep-analysis';
import { InefficiencyDiagnosticEngine } from '../../../src/processor/inefficiency-diagnostic';
import { SIGNAL_BAND_LABELS } from '../../../src/processor/diagnostic-signals';
import { User, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { MethodSelector } from './deep-analysis/MethodSelector';
import { UserPeriodControls } from './deep-analysis/UserPeriodControls';
import { HealthScoreCard } from './deep-analysis/HealthScoreCard';
import { PatternAccordionItem } from './deep-analysis/PatternAccordionItem';
import { PatternDrilldownChart } from './deep-analysis/PatternDrilldownChart';
import { PrescriptionList } from './deep-analysis/PrescriptionList';
import { TeamDiagnosticPanel } from './deep-analysis/TeamDiagnosticPanel';

interface DeepAnalysisViewProps {
  aggregatedData?: ScopeAggregatedData | null;
  userProfiles?: UserUsageProfile[];
  sourceInfo?: DeepAnalysisDataSourceInfo;
  initialSelectedLogin?: string;
  onSelectLogin?: (login: string) => void;
}

export const DeepAnalysisView: React.FC<DeepAnalysisViewProps> = ({
  aggregatedData,
  userProfiles,
  sourceInfo,
  initialSelectedLogin,
  onSelectLogin,
}) => {
  const profiles = useMemo(() => {
    if (userProfiles && userProfiles.length > 0) {
      return userProfiles;
    }
    return aggregatedData?.user_profiles || [];
  }, [userProfiles, aggregatedData]);

  // 1. 分析方式セレクターステート
  const [selectedMethodId, setSelectedMethodId] =
    useState<AnalysisMethodId>('inefficient_usage_diagnostic');

  // 2. ユーザー選択ステート
  const [selectedLogin, setSelectedLogin] = useState<string>(() => {
    if (initialSelectedLogin && profiles.some((p) => p.login === initialSelectedLogin)) {
      return initialSelectedLogin;
    }
    // デフォルト: 最初のユーザー (特定のユーザー ID を決め打ちしない)
    return profiles[0]?.login || '';
  });

  const prevInitialSelectedLoginRef = React.useRef<string | undefined>(initialSelectedLogin);

  // 外部からの初期選択・切替追従 (親からの initialSelectedLogin プロパティが新しく変化した時のみ追従)
  useEffect(() => {
    if (
      initialSelectedLogin &&
      initialSelectedLogin !== prevInitialSelectedLoginRef.current &&
      profiles.some((p) => p.login === initialSelectedLogin)
    ) {
      prevInitialSelectedLoginRef.current = initialSelectedLogin;
      setSelectedLogin(initialSelectedLogin);
    }
  }, [initialSelectedLogin, profiles]);

  // プロファイル群（フィルター等）が更新され、現在選択中のユーザーが存在しなくなった場合のフォールバック
  useEffect(() => {
    if (profiles.length > 0 && !profiles.some((p) => p.login === selectedLogin)) {
      setSelectedLogin(profiles[0]?.login || '');
    }
  }, [profiles, selectedLogin]);

  const handleSelectLogin = (login: string) => {
    setSelectedLogin(login);
    prevInitialSelectedLoginRef.current = login;
    if (onSelectLogin) {
      onSelectLogin(login);
    }
  };

  // 3. 対象区間選択ステート
  const [periodScope, setPeriodScope] = useState<AnalysisPeriodScopeType>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange>(() => {
    let end = aggregatedData?.date_range?.end;
    if (!end && profiles.length > 0) {
      const allDates = profiles.flatMap((p) => (p.daily_history || []).map((d) => d.date));
      if (allDates.length > 0) {
        allDates.sort();
        end = allDates[allDates.length - 1];
      }
    }
    // データから期間の終端を特定できないときは今日 (固定の日付を決め打ちしない)
    if (!end) end = new Date().toISOString().split('T')[0];
    const d = new Date(end);
    d.setDate(d.getDate() - 14);
    const start = d.toISOString().split('T')[0];
    return { start, end };
  });
  const [isCustomPickerOpen, setIsCustomPickerOpen] = useState(false);

  // 3.5 表示単位: 既定はチーム単位。個人表示は閲覧権限のある社員向け (SDD-11 §4.5)
  const [viewMode, setViewMode] = useState<'team' | 'individual'>('team');

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

  const teamResult = useMemo(() => {
    if (profiles.length === 0) return null;
    return InefficiencyDiagnosticEngine.diagnoseTeam(
      profiles,
      periodScope,
      periodScope === 'custom' ? customRange : undefined
    );
  }, [profiles, periodScope, customRange]);

  const handleTogglePatternExpand = (patternId: InefficiencyPatternId) => {
    setExpandedPatternId((prev) => (prev === patternId ? null : patternId));
  };

  if (!currentProfile || !diagnosticResult) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 max-w-4xl mx-auto my-10">
        <User className="w-12 h-12 mx-auto text-slate-600 mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">ユーザーデータが見つかりません</h3>
        <p className="text-sm">プロファイル情報を読み込めませんでした。スコープを確認してください。</p>
        {sourceInfo?.details && (
          <p className="text-xs text-slate-300 mt-3 leading-relaxed" data-testid="deep-analysis-no-profile-reason">
            {sourceInfo.details}
          </p>
        )}
      </div>
    );
  }

  const { patterns, drilldown } = diagnosticResult;
  const activePattern = patterns.find((p) => p.id === expandedPatternId);

  return (
    <div className="flex flex-col space-y-6 animate-fadeIn pb-12">
      {/* 0. アクティブデータソース情報バッジ */}
      {sourceInfo && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/90 border border-slate-800/80 rounded-2xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-400">分析データソース:</span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-700/60 flex items-center space-x-1.5 shadow-sm">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>{sourceInfo.label}</span>
            </span>
            {sourceInfo.isEstimated ? (
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/60 flex items-center space-x-1"
                title="月次利用レポートから日次アクティビティを按分推定して診断しています"
              >
                <AlertCircle className="w-3 h-3 text-amber-400" />
                <span>月次按分推定モード</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/70 text-emerald-300 border border-emerald-800/60 flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>確定テレメトリ</span>
              </span>
            )}
            {sourceInfo.details && (
              <span className="text-[11px] text-slate-400" data-testid="deep-analysis-source-details">
                {sourceInfo.details}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 font-mono">
            診断対象: <strong className="text-slate-100">{profiles.length}</strong> 名
            {sourceInfo.totalUsers > profiles.length && (
              <span className="text-slate-500 ml-1.5">
                (全体 {sourceInfo.totalUsers} 名中・フィルター適用)
              </span>
            )}
          </div>
        </div>
      )}

      {/* 1. 専用ビュー ヘッダー & 分析方式セレクター */}
      <MethodSelector
        selectedMethodId={selectedMethodId}
        onSelectMethod={setSelectedMethodId}
      />

      {/* 2. 表示単位の切り替え (既定: チーム単位) */}
      <div
        role="group"
        aria-label="診断の表示単位"
        className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-900/90 border border-slate-800 rounded-xl"
      >
        <span className="text-xs font-semibold text-slate-300">表示単位:</span>
        {(['team', 'individual'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={viewMode === mode}
            data-testid={`diagnostic-view-${mode}`}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
              viewMode === mode
                ? 'bg-indigo-600 text-white border-indigo-400'
                : 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {mode === 'team' ? 'チーム単位 (既定)' : '個人単位'}
          </button>
        ))}
        <span className="text-[11px] text-slate-400">
          しきい値は未較正のヒューリスティックです。シグナル強度は確率ではありません。
        </span>
      </div>

      {viewMode === 'team' ? (
        <>
          <UserPeriodControls
            profiles={profiles}
            currentProfile={currentProfile}
            hideUserSelect
            selectedLogin={selectedLogin}
            onSelectLogin={handleSelectLogin}
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
          {teamResult && <TeamDiagnosticPanel result={teamResult} />}
        </>
      ) : (
        <>
          <p
            className="text-xs text-amber-200 bg-amber-950/50 border border-amber-800/70 rounded-xl px-4 py-3 leading-relaxed"
            role="note"
            data-testid="individual-view-notice"
          >
            個人単位の診断は社内限定で、閲覧権限のある社員向けです。本人へのコーチング・支援を目的とし、人事評価や順位付けには使用しないでください。
          </p>

          {/* 共通操作バー: 診断対象ユーザー & 対象区間セレクター */}
          <UserPeriodControls
            profiles={profiles}
            currentProfile={currentProfile}
            selectedLogin={selectedLogin}
            onSelectLogin={handleSelectLogin}
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

          {/* 診断サマリー & 総合健全度スコアメーター */}
          <HealthScoreCard diagnosticResult={diagnosticResult} />

          {/* 非効率パターン判定 & シグナル強度 */}
          <PatternAccordionItem
            patterns={patterns}
            expandedPatternId={expandedPatternId}
            onTogglePatternExpand={handleTogglePatternExpand}
          />
        </>
      )}

      {/* 5. ドリルダウン深掘り分析パネル */}
      {viewMode === 'individual' && expandedPatternId && activePattern && (
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
                <span className="text-[10px] text-slate-400 block">シグナル強度 (確率ではありません)</span>
                {activePattern.evaluable === false ? (
                  <span className="text-2xl font-black text-slate-500">—</span>
                ) : (
                  <span
                    className={`text-2xl font-black ${
                      activePattern.probabilityPercent >= 70
                        ? 'text-rose-400'
                        : activePattern.probabilityPercent >= 40
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {SIGNAL_BAND_LABELS[activePattern.signalBand ?? 'none']}
                    <span className="text-xs font-mono font-semibold text-slate-400 ml-1.5">
                      {activePattern.probabilityPercent}/100
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 判定要因 (Contributing Factors) カード一覧 */}
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2.5">
              シグナルのルール (入力値・しきい値・根拠)
            </h4>
            {activePattern.evaluable === false && (
              <p className="text-xs text-slate-300 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5" data-testid="pattern-insufficient-data">
                判定不能 (データ不足): {activePattern.insufficientDataReason ?? '判定に必要な実測値が収集されていません'}
              </p>
            )}
            {activePattern.dataSufficiency && activePattern.dataSufficiency.checks.length > 0 && (
              <ul
                className="flex flex-wrap gap-2 mb-3 text-[11px] text-slate-300"
                aria-label="データ充足度"
                data-testid="pattern-sufficiency"
              >
                {activePattern.dataSufficiency.checks.map((c) => (
                  <li
                    key={c.name}
                    className={`px-2 py-1 rounded border font-mono ${
                      c.met ? 'border-emerald-800 bg-emerald-950/60' : 'border-rose-800 bg-rose-950/60'
                    }`}
                  >
                    {c.met ? '充足' : '不足'} · {c.name}: {c.observed} / 必要 {c.required} 以上
                  </li>
                ))}
              </ul>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="pattern-evidence">
              {(activePattern.evidence ?? []).map((rule, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span className="text-xs font-bold text-slate-200">{rule.input}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${
                        rule.status === 'met'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : rule.status === 'not_met'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {rule.status === 'met' ? 'ルール成立' : rule.status === 'not_met' ? '不成立' : '参考'}
                    </span>
                  </div>
                  <dl className="text-[11px] text-slate-300 mt-1 space-y-0.5 font-mono">
                    <div>
                      <dt className="inline text-slate-500">入力値: </dt>
                      <dd className="inline">{rule.value}</dd>
                    </div>
                    <div>
                      <dt className="inline text-slate-500">しきい値: </dt>
                      <dd className="inline">{rule.threshold}</dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    根拠: {rule.rationale}
                  </p>
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
