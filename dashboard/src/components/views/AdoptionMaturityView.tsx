import React, { useState, useMemo } from 'react';
import { AdoptionViewModel } from '../../../../src/adapters/presenters/AdoptionPresenter';
import { TrendingUp, Users, Award, Shield, CheckCircle2, Layers, Zap, Bot, Code, HelpCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { AdoptionPhase } from '../../../../src/domain/entities/agent-metrics';

interface AdoptionMaturityViewProps {
  viewModel: AdoptionViewModel;
}

type TeamBreakdownSortKey = 'teamName' | 'totalUsers' | 'no_cohort' | 'code_first' | 'agent_first' | 'multi_agent';

const STAGE_ICONS: Record<AdoptionPhase, React.ReactNode> = {
  no_cohort: <HelpCircle className="w-5 h-5 text-slate-400" />,
  code_first: <Code className="w-5 h-5 text-blue-400" />,
  agent_first: <Bot className="w-5 h-5 text-purple-400" />,
  multi_agent: <Zap className="w-5 h-5 text-emerald-400" />,
};

const STAGE_COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  slate: {
    bg: 'bg-slate-800/40',
    border: 'border-slate-700',
    text: 'text-slate-300',
    bar: 'bg-slate-500',
  },
  blue: {
    bg: 'bg-blue-950/30',
    border: 'border-blue-800/50',
    text: 'text-blue-300',
    bar: 'bg-blue-500',
  },
  purple: {
    bg: 'bg-purple-950/30',
    border: 'border-purple-800/50',
    text: 'text-purple-300',
    bar: 'bg-purple-500',
  },
  emerald: {
    bg: 'bg-emerald-950/30',
    border: 'border-emerald-800/50',
    text: 'text-emerald-300',
    bar: 'bg-emerald-500',
  },
};

export const AdoptionMaturityView: React.FC<AdoptionMaturityViewProps> = ({ viewModel }) => {
  const [sortKey, setSortKey] = useState<TeamBreakdownSortKey>('totalUsers');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  if (!viewModel.hasData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <TrendingUp className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">採用成熟度データが利用できません。</p>
      </div>
    );
  }

  const { totalEvaluatedUsers, stages, teamBreakdown } = viewModel;

  const handleSort = (key: TeamBreakdownSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'teamName' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (key: TeamBreakdownSortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400" />
    );
  };

  const sortedTeamBreakdown = useMemo(() => {
    return [...teamBreakdown].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case 'teamName':
          diff = a.teamName.localeCompare(b.teamName, 'ja');
          break;
        case 'totalUsers':
          diff = a.totalUsers - b.totalUsers;
          break;
        case 'no_cohort':
          diff = a.stages.no_cohort - b.stages.no_cohort;
          break;
        case 'code_first':
          diff = a.stages.code_first - b.stages.code_first;
          break;
        case 'agent_first':
          diff = a.stages.agent_first - b.stages.agent_first;
          break;
        case 'multi_agent':
          diff = a.stages.multi_agent - b.stages.multi_agent;
          break;
      }
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [teamBreakdown, sortKey, sortDir]);

  // Active adoption rate: code_first + agent_first + multi_agent
  const activeUsers = stages
    .filter((s) => s.phase !== 'no_cohort')
    .reduce((sum, s) => sum + s.count, 0);
  const activeAdoptionRate = totalEvaluatedUsers > 0
    ? ((activeUsers / totalEvaluatedUsers) * 100).toFixed(1)
    : '0.0';

  // Advanced adoption rate: agent_first + multi_agent
  const advancedUsers = stages
    .filter((s) => s.phase === 'agent_first' || s.phase === 'multi_agent')
    .reduce((sum, s) => sum + s.count, 0);
  const advancedAdoptionRate = totalEvaluatedUsers > 0
    ? ((advancedUsers / totalEvaluatedUsers) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & KPIs */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/30 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 shrink-0">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">AI 活用・採用成熟度分析 (Adoption Maturity)</h3>
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-800">
                  GitHub Impact Cohort
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                GitHub Impact Dashboard のコホート定義に基づき、全ユーザーのAI活用ステージを多面的に評価・トラッキングします。
              </p>
            </div>
          </div>
        </div>

        {/* 4 KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span>評価対象ユーザー総数</span>
            </span>
            <span className="text-2xl font-black text-slate-100 font-mono">
              {totalEvaluatedUsers.toLocaleString()} 名
            </span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span>全体活用定着率 (Active Rate)</span>
            </span>
            <span className="text-2xl font-black text-blue-300 font-mono">{activeAdoptionRate}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-purple-400" />
              <span>高度活用率 (Agent+ 定着)</span>
            </span>
            <span className="text-2xl font-black text-purple-300 font-mono">{advancedAdoptionRate}%</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/90 p-4 rounded-xl">
            <span className="text-xs text-slate-400 block mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>自律協調層 (Multi-Agent)</span>
            </span>
            <span className="text-2xl font-black text-emerald-300 font-mono">
              {stages.find((s) => s.phase === 'multi_agent')?.count || 0} 名
            </span>
          </div>
        </div>
      </div>

      {/* 2. Cumulative Maturity Progress Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>組織全体 成熟度分布ポートフォリオ</span>
        </h4>
        <div className="w-full bg-slate-950 rounded-xl h-6 flex overflow-hidden p-0.5 border border-slate-800">
          {stages.map((stage) => {
            const colors = STAGE_COLOR_CLASSES[stage.badgeColor] || STAGE_COLOR_CLASSES.slate;
            if (stage.percentage <= 0) return null;
            return (
              <div
                key={stage.phase}
                style={{ width: `${stage.percentage}%` }}
                className={`h-full ${colors.bar} flex items-center justify-center transition-all duration-500 first:rounded-l-lg last:rounded-r-lg group relative`}
                title={`${stage.title}: ${stage.count}名 (${stage.percentage}%)`}
              >
                {stage.percentage >= 8 && (
                  <span className="text-[10px] font-bold text-white tracking-wider truncate px-1 drop-shadow">
                    {stage.percentage}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-slate-800/50">
          {stages.map((stage) => {
            const colors = STAGE_COLOR_CLASSES[stage.badgeColor] || STAGE_COLOR_CLASSES.slate;
            return (
              <div key={stage.phase} className="flex items-center space-x-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full ${colors.bar}`} />
                <span className="text-slate-400 truncate">{stage.title}</span>
                <span className="text-slate-200 font-mono font-semibold ml-auto">{stage.percentage}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Four Cohort Detail Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stages.map((stage) => {
          const colors = STAGE_COLOR_CLASSES[stage.badgeColor] || STAGE_COLOR_CLASSES.slate;
          return (
            <div
              key={stage.phase}
              className={`p-5 rounded-xl border ${colors.border} ${colors.bg} flex flex-col justify-between transition-all hover:border-slate-600`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                      {STAGE_ICONS[stage.phase]}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{stage.title}</h4>
                      <p className="text-xs text-slate-400">{stage.subtitle}</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {stage.count} 名 ({stage.percentage}%)
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {stage.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/50">
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(100, stage.percentage)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Team Breakdown Table */}
      {teamBreakdown.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>チーム / 部署別 成熟度ステージ分布</span>
            </h4>
            <span className="text-xs text-slate-400">
              全 {teamBreakdown.length} チーム
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th
                    className="py-3 px-4 cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('teamName')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>チーム / 部門</span>
                      {renderSortIcon('teamName')}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-right cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('totalUsers')}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>対象人数</span>
                      {renderSortIcon('totalUsers')}
                    </div>
                  </th>
                  <th className="py-3 px-4">ステージ構成比</th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('no_cohort')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>No Cohort</span>
                      {renderSortIcon('no_cohort')}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('code_first')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Code First</span>
                      {renderSortIcon('code_first')}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('agent_first')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Agent First</span>
                      {renderSortIcon('agent_first')}
                    </div>
                  </th>
                  <th
                    className="py-3 px-4 text-center cursor-pointer select-none hover:text-slate-200 transition-colors"
                    onClick={() => handleSort('multi_agent')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Multi-Agent</span>
                      {renderSortIcon('multi_agent')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {sortedTeamBreakdown.map((team) => {
                  const safeUsers = Math.max(1, team.totalUsers);
                  const pNo = ((team.stages.no_cohort / safeUsers) * 100);
                  const pCode = ((team.stages.code_first / safeUsers) * 100);
                  const pAgent = ((team.stages.agent_first / safeUsers) * 100);
                  const pMulti = ((team.stages.multi_agent / safeUsers) * 100);

                  return (
                    <tr key={team.teamName} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">{team.teamName}</td>
                      <td className="py-3 px-4 text-right font-mono">{team.totalUsers} 名</td>
                      <td className="py-3 px-4 w-44">
                        <div className="w-full bg-slate-950 rounded-full h-2 flex overflow-hidden border border-slate-800">
                          <div style={{ width: `${pNo}%` }} className="h-full bg-slate-500" title={`No Cohort: ${team.stages.no_cohort}名`} />
                          <div style={{ width: `${pCode}%` }} className="h-full bg-blue-500" title={`Code First: ${team.stages.code_first}名`} />
                          <div style={{ width: `${pAgent}%` }} className="h-full bg-purple-500" title={`Agent First: ${team.stages.agent_first}名`} />
                          <div style={{ width: `${pMulti}%` }} className="h-full bg-emerald-500" title={`Multi-Agent: ${team.stages.multi_agent}名`} />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-slate-400">{team.stages.no_cohort}</td>
                      <td className="py-3 px-4 text-center font-mono text-blue-300">{team.stages.code_first}</td>
                      <td className="py-3 px-4 text-center font-mono text-purple-300">{team.stages.agent_first}</td>
                      <td className="py-3 px-4 text-center font-mono text-emerald-300 font-semibold">{team.stages.multi_agent}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
