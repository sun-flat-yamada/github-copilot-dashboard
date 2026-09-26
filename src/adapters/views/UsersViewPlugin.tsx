import React from 'react';
import { ViewPlugin, ViewPluginProps } from './ViewPlugin.js';
import { UsersPresenter, UsersViewModel } from '../presenters/UsersPresenter.js';
import { UserDetailTable } from '../../../dashboard/src/components/UserDetailTable.js';
import { MonthlyReportUserTable } from '../../../dashboard/src/components/monthly-report/MonthlyReportUserTable.js';

export const UsersViewComponent: React.FC<ViewPluginProps<UsersViewModel>> = (props) => {
  const {
    activeSource = 'live_metrics',
    currentData,
    currentReportData,
    deepAnalysisProfiles = [],
    focusedUserLogin = '',
    userTableFilterStatus = 'all',
    currentGrouping = 'department',
    selectedGroup = 'all',
    onGroupChange,
    onSelectUserForTrend,
    onSelectUserForDeepAnalysis,
  } = props;

  const isLive = activeSource === 'live_metrics';
  const isReport = activeSource === 'monthly_report' || activeSource === 'user_upload';

  return (
    <div className="flex flex-col space-y-6 w-full">
      {isLive && currentData && (
        <UserDetailTable
          data={currentData}
          userProfiles={deepAnalysisProfiles}
          initialSelectedLogin={focusedUserLogin}
          filterStatus={userTableFilterStatus}
          onSelectUserForTrend={onSelectUserForTrend || (() => {})}
          onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis || (() => {})}
        />
      )}

      {isReport && currentReportData && (
        <MonthlyReportUserTable
          reportData={currentReportData}
          userProfiles={deepAnalysisProfiles}
          initialSelectedLogin={focusedUserLogin}
          grouping={currentGrouping as any}
          selectedGroup={selectedGroup}
          onGroupChange={onGroupChange || (() => {})}
          onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis || (() => {})}
          onSelectUserForTrend={onSelectUserForTrend || (() => {})}
        />
      )}
    </div>
  );
};

export const UsersViewPlugin: ViewPlugin<UsersViewModel> = {
  id: 'users',
  label: 'ユーザー別利用明細',
  title: 'ユーザー別利用明細',
  shortTitle: 'ユーザー明細',
  description: '全ユーザーの稼働状況・推計費用・AI活用度の一覧',
  icon: 'Users2',
  iconName: 'Users2',
  order: 2,
  capabilities: ['user_table', 'group_ranking'],
  supportedDataSources: ['live_metrics', 'monthly_report', 'user_upload'],
  canRender: (_state: any) => true,
  requiredDerivedData: () => ['filteredScopeData', 'filteredReportData'],
  presenterFactory: (data: any) => UsersPresenter.present(data),
  component: UsersViewComponent,
};
