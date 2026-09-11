import React from 'react';
import { GroupingDimension } from '../../../src/types/copilot';
import { Briefcase, Building2, Landmark, Filter } from 'lucide-react';

interface GroupingSelectorProps {
  currentGrouping: GroupingDimension;
  onGroupingChange: (grouping: GroupingDimension) => void;
  selectedGroup: string;
  onGroupChange: (group: string) => void;
  availableGroups: string[];
}

export const GroupingSelector: React.FC<GroupingSelectorProps> = ({
  currentGrouping,
  onGroupingChange,
  selectedGroup,
  onGroupChange,
  availableGroups,
}) => {
  const getDimensionLabel = () => {
    switch (currentGrouping) {
      case 'department':
        return '任意仕訳グループ';
      case 'cost_center':
        return 'Cost Center';
      case 'organization':
        return 'Organization';
      default:
        return 'グループ';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center space-x-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">集計・仕訳軸:</span>
        <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
          <button
            type="button"
            onClick={() => onGroupingChange('department')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentGrouping === 'department'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>任意仕訳グループ (部署・PJ)</span>
          </button>

          <button
            type="button"
            onClick={() => onGroupingChange('cost_center')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentGrouping === 'cost_center'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>GitHub Cost Center</span>
          </button>

          <button
            type="button"
            onClick={() => onGroupingChange('organization')}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              currentGrouping === 'organization'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>GitHub Organization</span>
          </button>
        </div>
      </div>

      {/* 選択ボタンのすぐ近くでセットで表示・操作できるグループ詳細セレクタ */}
      <div className="flex items-center space-x-2 bg-slate-900 border border-purple-800/60 rounded-xl px-3 py-1 shadow-sm">
        <Filter className="w-3.5 h-3.5 text-purple-400 shrink-0" />
        <span className="text-xs font-semibold text-purple-300 whitespace-nowrap">
          選択{getDimensionLabel()}:
        </span>
        <select
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
          className="bg-slate-950 border border-slate-700 hover:border-purple-500 text-slate-100 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium cursor-pointer transition-all max-w-[220px] truncate"
          title={`表示・集計対象の個別${getDimensionLabel()}を選択`}
        >
          <option value="all">
            すべての{getDimensionLabel()} (全体)
          </option>
          {availableGroups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {selectedGroup !== 'all' && (
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950 text-purple-300 border border-purple-700 font-bold shrink-0 truncate max-w-[120px]">
            {selectedGroup}
          </span>
        )}
      </div>
    </div>
  );
};
