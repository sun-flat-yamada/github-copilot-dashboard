import React from 'react';
import { TeamDiagnosticResult } from '../../../../src/types/deep-analysis';
import { Users, Info } from 'lucide-react';

interface TeamDiagnosticPanelProps {
  result: TeamDiagnosticResult;
}

const BANDS: { key: 'none' | 'weak' | 'medium' | 'strong'; label: string; className: string }[] = [
  { key: 'none', label: 'なし', className: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  { key: 'weak', label: '弱', className: 'bg-indigo-950 text-indigo-300 border-indigo-800' },
  { key: 'medium', label: '中', className: 'bg-amber-950 text-amber-300 border-amber-800' },
  { key: 'strong', label: '強', className: 'bg-rose-950 text-rose-300 border-rose-800' },
];

/**
 * チーム単位の診断 (既定の表示)。個人名・個人別の値は出さず、パターンごとのシグナル強度の帯の人数分布だけを示す。
 * 構成員が最小人数未満のときは判定せず、理由を表示する。
 */
export const TeamDiagnosticPanel: React.FC<TeamDiagnosticPanelProps> = ({ result }) => {
  return (
    <section
      className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
      aria-labelledby="team-diagnostic-title"
      data-testid="team-diagnostic-panel"
    >
      <div className="border-b border-slate-800 pb-3">
        <h3 id="team-diagnostic-title" className="text-sm font-bold text-white flex items-center space-x-2">
          <Users className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          <span>チーム診断 (構成員 {result.memberCount} 名・{result.period.label})</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          パターンごとに、シグナル強度の帯ごとの人数を表示します。個人名・個人別の値は表示しません。
          強度は確率ではなく、{result.calibration.note}
        </p>
      </div>

      {!result.evaluable ? (
        <p
          className="text-xs text-slate-200 bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-start gap-2"
          data-testid="team-diagnostic-insufficient"
        >
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>判定不能 (データ不足): {result.insufficientReason}</span>
        </p>
      ) : (
        <>
          {result.metricsSummary && (
            <p className="text-xs text-slate-300">
              チーム合計: 提案 {result.metricsSummary.totalSuggestions.toLocaleString()} 件 / 受諾{' '}
              {result.metricsSummary.totalAcceptances.toLocaleString()} 件 (受諾率{' '}
              {result.metricsSummary.acceptanceRatePercent}%・合計比) / チャット{' '}
              {result.metricsSummary.totalChats.toLocaleString()} 回
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <caption className="sr-only">パターン別のシグナル強度の人数分布</caption>
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th scope="col" className="py-2 pr-3 font-semibold">パターン</th>
                  {BANDS.map((b) => (
                    <th key={b.key} scope="col" className="py-2 px-2 font-semibold text-center">
                      {b.label}
                    </th>
                  ))}
                  <th scope="col" className="py-2 px-2 font-semibold text-center">判定不能</th>
                  <th scope="col" className="py-2 pl-2 font-semibold text-right">中・強の割合</th>
                </tr>
              </thead>
              <tbody>
                {result.patterns.map((p) => (
                  <tr key={p.id} className="border-b border-slate-800/60" data-testid={`team-pattern-${p.id}`}>
                    <th scope="row" className="py-2 pr-3 font-medium text-slate-100">{p.name}</th>
                    {p.distribution ? (
                      BANDS.map((b) => (
                        <td key={b.key} className="py-2 px-2 text-center">
                          <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded border font-mono ${b.className}`}>
                            {p.distribution![b.key]}
                          </span>
                        </td>
                      ))
                    ) : (
                      <td colSpan={BANDS.length} className="py-2 px-2 text-slate-400">
                        {p.suppressedReason}
                      </td>
                    )}
                    <td className="py-2 px-2 text-center font-mono text-slate-300">{p.notEvaluableMembers}</td>
                    <td className="py-2 pl-2 text-right font-mono text-slate-100">
                      {p.flaggedSharePercent === null ? '—' : `${p.flaggedSharePercent}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
