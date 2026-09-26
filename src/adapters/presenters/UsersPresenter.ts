import {
  DataSourceType,
  EnrichedUserSeat,
  GroupingDimension,
  MonthlyReportAggregatedData,
  ReportUserDetail,
  ScopeAggregatedData,
  UserSeatStatus,
} from '../../domain/entities/copilot.js';

export interface FormattedUserSummaryRow {
  id: string;
  login: string;
  name: string;
  department: string;
  costCenter: string;
  status: string;
  costFormatted: string;
  costRaw: number;
  lastActivityText: string;
  tags: string[];
}

export interface UsersStatusCounts {
  all: number;
  active: number;
  low_active: number;
  idle: number;
  never_used: number;
}

export interface UsersViewModel {
  hasData: boolean;
  activeSource: DataSourceType;
  isReportSource: boolean;
  totalCount: number;
  filteredCount: number;
  statusCounts: UsersStatusCounts;
  users: FormattedUserSummaryRow[];
}

export interface UsersPresenterInput {
  currentData?: ScopeAggregatedData | null;
  currentReportData?: MonthlyReportAggregatedData | null;
  activeSource: DataSourceType;
  filterStatus?: UserSeatStatus | 'all';
  selectedGroup?: string;
  grouping?: GroupingDimension;
}

export class UsersPresenter {
  public static present(input: UsersPresenterInput): UsersViewModel {
    const {
      currentData,
      currentReportData,
      activeSource,
      filterStatus = 'all',
      selectedGroup = 'all',
      grouping = 'department',
    } = input;

    const isReportSource = activeSource === 'monthly_report' || activeSource === 'user_upload';

    if (!isReportSource && currentData && currentData.users) {
      const allUsers: EnrichedUserSeat[] = currentData.users;
      const statusCounts: UsersStatusCounts = {
        all: allUsers.length,
        active: allUsers.filter((u: EnrichedUserSeat) => u.status === 'active').length,
        low_active: allUsers.filter((u: EnrichedUserSeat) => u.status === 'low_active').length,
        idle: allUsers.filter((u: EnrichedUserSeat) => u.status === 'idle').length,
        never_used: allUsers.filter((u: EnrichedUserSeat) => u.status === 'never_used').length,
      };

      let filtered = allUsers;
      if (filterStatus !== 'all') {
        filtered = filtered.filter((u: EnrichedUserSeat) => u.status === filterStatus);
      }

      if (selectedGroup !== 'all') {
        filtered = filtered.filter((u: EnrichedUserSeat) => {
          if (grouping === 'cost_center') return u.cost_center === selectedGroup;
          if (grouping === 'organization') return u.organization === selectedGroup;
          return u.department === selectedGroup;
        });
      }

      const formattedRows: FormattedUserSummaryRow[] = filtered.map((u: EnrichedUserSeat, index: number) => ({
        id: `user-${index + 1}`,
        login: u.login,
        name: u.display_name || u.login,
        department: u.department || '未設定',
        costCenter: u.cost_center || '未設定',
        status: u.status,
        costFormatted: `$${(u.monthly_cost_usd || 0).toFixed(2)}`,
        costRaw: u.monthly_cost_usd || 0,
        lastActivityText: u.last_activity_at || '未利用',
        tags: u.tags || [],
      }));

      return {
        hasData: true,
        activeSource,
        isReportSource: false,
        totalCount: allUsers.length,
        filteredCount: filtered.length,
        statusCounts,
        users: formattedRows,
      };
    }

    if (isReportSource && currentReportData && currentReportData.user_details) {
      const allDetails: ReportUserDetail[] = currentReportData.user_details;
      let filtered = allDetails;

      if (selectedGroup !== 'all') {
        filtered = filtered.filter((u: ReportUserDetail) => {
          if (grouping === 'cost_center') return u.cost_center === selectedGroup;
          if (grouping === 'organization') return u.organization === selectedGroup;
          return u.department === selectedGroup;
        });
      }

      const formattedRows: FormattedUserSummaryRow[] = filtered.map((u: ReportUserDetail, index: number) => ({
        id: `report-user-${index + 1}`,
        login: u.login,
        name: u.display_name || u.login,
        department: u.department || '未設定',
        costCenter: u.cost_center || '未設定',
        status: (u.total_requests || 0) > 0 ? 'active' : 'idle',
        costFormatted: `$${(u.total_spend_usd || 0).toFixed(2)}`,
        costRaw: u.total_spend_usd || 0,
        lastActivityText: u.primary_model ? `主要: ${u.primary_model}` : '活動あり',
        tags: u.tags || [],
      }));

      return {
        hasData: true,
        activeSource,
        isReportSource: true,
        totalCount: allDetails.length,
        filteredCount: filtered.length,
        statusCounts: {
          all: allDetails.length,
          active: allDetails.filter((u: ReportUserDetail) => (u.total_requests || 0) > 0).length,
          low_active: 0,
          idle: allDetails.filter((u: ReportUserDetail) => (u.total_requests || 0) === 0).length,
          never_used: 0,
        },
        users: formattedRows,
      };
    }

    return {
      hasData: false,
      activeSource,
      isReportSource,
      totalCount: 0,
      filteredCount: 0,
      statusCounts: { all: 0, active: 0, low_active: 0, idle: 0, never_used: 0 },
      users: [],
    };
  }
}
