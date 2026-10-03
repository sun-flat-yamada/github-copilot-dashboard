import React from 'react';
import { UserDetailTable } from '../../components/UserDetailTable';
import type { ViewContext } from '../types';

export const View: React.FC<{ ctx: ViewContext }> = ({ ctx }) => {
  const {
    activeSource, isReportSource, currentData, currentReportData, deepAnalysisProfiles,
    focusedUserLogin, userTableFilterStatus, currentGrouping, selectedGroup,
    setSelectedGroup: onGroupChange,
    onSelectUserForTrend, onOpenDeepAnalysis: handleOpenDeepAnalysis,
  } = ctx;
  return (
    <div className="flex flex-col space-y-6 w-full">
      {activeSource === 'live_metrics' && currentData && (
        <UserDetailTable
          data={currentData}
          userProfiles={deepAnalysisProfiles}
          initialSelectedLogin={focusedUserLogin}
          filterStatus={userTableFilterStatus}
          onSelectUserForTrend={onSelectUserForTrend}
          onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
        />
      )}

      {isReportSource && currentReportData && (
        <UserDetailTable
          reportData={currentReportData}
          userProfiles={deepAnalysisProfiles}
          initialSelectedLogin={focusedUserLogin}
          grouping={currentGrouping}
          selectedGroup={selectedGroup}
          onGroupChange={onGroupChange}
          onSelectUserForDeepAnalysis={handleOpenDeepAnalysis}
          onSelectUserForTrend={onSelectUserForTrend}
        />
      )}
    </div>
  );
};

export default View;
