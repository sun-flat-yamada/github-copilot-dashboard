import React from 'react';
import { AgentViewModel } from '../../../../src/adapters/presenters/AgentPresenter';
import { Bot, MessageSquare, Users, GitPullRequest, Wrench, Terminal, Sparkles, CheckCircle2 } from 'lucide-react';

interface AgentActivityViewProps {
  viewModel: AgentViewModel;
}

export const AgentActivityView: React.FC<AgentActivityViewProps> = ({ viewModel }) => {
  if (!viewModel.hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <Bot className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">AI Agent 活用データが利用できません。</p>
      </div>
    );
  }

  const {
    totalSessionsFormatted,
    totalMessagesFormatted,
    engagedUsers,
    adoptionRateFormatted,
    topAgents,
    topMcps,
    topSkills,
    topSlashCommands,
    prMetrics,
    teams,
  } = viewModel;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & KPIs */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-purple-950/30 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-400 shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">AI Agent & MCP 活用動向分析</h3>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-800">
                  2026.09 Specification
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                VS Code Agent、カスタムAgent、MCPツール呼出、およびCoding Agent PRの統合分析を提供します。
              </p>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>総 Agent セッション数</span>
            </span>
            <span className="text-2xl font-black text-purple-300 font-mono">{totalSessionsFormatted}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Agent メッセージ総数</span>
            </span>
            <span className="text-2xl font-black text-indigo-300 font-mono">{totalMessagesFormatted}</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span>アクティブ Agent ユーザー</span>
            </span>
            <span className="text-2xl font-black text-cyan-300 font-mono">{engagedUsers} 名</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Agent 浸透率 (Adoption)</span>
            </span>
            <span className="text-2xl font-black text-emerald-300 font-mono">{adoptionRateFormatted}</span>
          </div>
        </div>
      </div>

      {/* 2. Middle Row: Agent Breakdown & MCP Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Agents */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>Agent 種類別セッション数</span>
          </h4>
          {topAgents.length === 0 ? (
            <p className="text-xs text-slate-500">Agent別の利用データがありません。</p>
          ) : (
            <div className="space-y-3">
              {topAgents.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-slate-200">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{a.users} ユーザー</span>
                    <span className="text-purple-300 font-mono font-bold">{a.sessions} セッション</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MCP Invocations */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-indigo-400" />
            <span>Model Context Protocol (MCP) 呼出ランキング</span>
          </h4>
          {topMcps.length === 0 ? (
            <p className="text-xs text-slate-500">MCPツールの呼出データがありません。</p>
          ) : (
            <div className="space-y-3">
              {topMcps.map((m) => (
                <div
                  key={m.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                >
                  <span className="font-semibold text-slate-200 font-mono">{m.name}</span>
                  <span className="text-indigo-400 font-mono font-bold">{m.calls.toLocaleString()} 回呼出</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Row: Coding Agent PR Metrics & Skills / Slash Commands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coding Agent PR Metrics */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-emerald-400" />
            <span>Coding Agent PR 成果指標</span>
          </h4>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[11px] text-slate-400 block mb-1">Agent 作成 PR</span>
              <span className="text-lg font-bold text-slate-100 font-mono">{prMetrics.prsCreatedByAgent} 件</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[11px] text-slate-400 block mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> マージ済 PR
              </span>
              <span className="text-lg font-bold text-emerald-300 font-mono">{prMetrics.prsMergedByAgent} 件</span>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl">
              <span className="text-[11px] text-slate-400 block mb-1">マージ中央値時間</span>
              <span className="text-lg font-bold text-cyan-300 font-mono">{prMetrics.medianMergeHours} 時間</span>
            </div>
          </div>
        </div>

        {/* Skills & Slash Commands */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>人気 スキル & スラッシュコマンド</span>
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">Agent Skills</span>
              {topSkills.map((s) => (
                <div key={s.name} className="flex justify-between text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-800/60">
                  <span className="font-mono">{s.name}</span>
                  <span className="text-slate-400 font-mono">{s.count}回</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-400 block">Slash Commands</span>
              {topSlashCommands.map((c) => (
                <div key={c.name} className="flex justify-between text-slate-300 bg-slate-950/50 p-2 rounded border border-slate-800/60">
                  <span className="font-mono text-cyan-300">{c.name}</span>
                  <span className="text-slate-400 font-mono">{c.count}回</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Team Breakdown Table */}
      {teams.length > 0 && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span>チーム別 Agent 活用状況</span>
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">チーム名</th>
                  <th className="py-2.5 px-3 text-right">総セッション数</th>
                  <th className="py-2.5 px-3 text-right">Agent 活用人数</th>
                  <th className="py-2.5 px-3 text-right">チーム内浸透率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {teams.map((t) => (
                  <tr key={t.teamName} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-200">{t.teamName}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-300">
                      {t.sessions.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">{t.engagedUsers} 名</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {t.adoptionRateFormatted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
