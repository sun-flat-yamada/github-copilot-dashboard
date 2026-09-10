import React from 'react';
import { GroupingDimension } from '../../../src/types/copilot';
import { Briefcase, Building2, Landmark } from 'lucide-react';

interface GroupingSelectorProps {
  currentGrouping: GroupingDimension;
  onGroupingChange: (grouping: GroupingDimension) => void;
}

export const GroupingSelector: React.FC<GroupingSelectorProps> = ({
  currentGrouping,
  onGroupingChange,
}) => {
  return (
    <div className="flex items-center space-x-3">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">集計・仕訳軸:</span>
      <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
        <button
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
  );
};
