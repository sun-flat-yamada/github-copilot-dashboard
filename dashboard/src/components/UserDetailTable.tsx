import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ScopeAggregatedData, UserSeatStatus, UserUsageProfile } from '../../../src/types/copilot';
import {
  Search,
  Download,
  UserCheck,
  AlertCircle,
  AlertTriangle,
  Clock,
  XCircle,
  LineChart,
  BrainCircuit,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users as UsersIcon,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ActionColumnHeader } from './common/ActionColumnHeader';
import { UserDrilldownPanel } from './UserDrilldownPanel';
import { useCurrency } from '../contexts/CurrencyContext';

export type UserSortMetric =
  | 'default'
  | 'user'
  | 'display_name'
  | 'department'
  | 'tags'
  | 'cost_center'
  | 'organization'
  | 'plan'
  | 'status'
  | 'acceptances'
  | 'suggestions'
  | 'acceptance_rate'
  | 'chats'
  | 'cost'
  | 'excess'
  | 'days_inactive';

interface UserDetailTableProps {
  data: ScopeAggregatedData;
  userProfiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
  filterStatus?: UserSeatStatus | 'all';
  onSelectUserForTrend?: (login: string) => void;
  onSelectUserForDeepAnalysis?: (login: string) => void;
}

export const UserDetailTable: React.FC<UserDetailTableProps> = ({
  data,
  userProfiles,
  initialSelectedLogin,
  filterStatus: initialStatus = 'all',
  onSelectUserForTrend,
  onSelectUserForDeepAnalysis,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserSeatStatus | 'all'>(initialStatus);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [sortBy, setSortBy] = useState<UserSortMetric>('default');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { users, scope_type } = data;
  const { formatMoney } = useCurrency();
  const [selectedUserLogin, setSelectedUserLogin] = useState<string | null>(initialSelectedLogin || null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollLeft: false,
    canScrollRight: false,
    scrollLeft: 0,
    scrollWidth: 0,
    clientWidth: 0,
    progress: 0,
  });

  const updateScrollState = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    setScrollState({
      canScrollLeft: scrollLeft > 2,
      canScrollRight: maxScroll > 2 && scrollLeft < maxScroll - 2,
      scrollLeft,
      scrollWidth,
      clientWidth,
      progress: maxScroll > 0 ? (scrollLeft / maxScroll) * 100 : 0,
    });
  }, []);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, users.length]);

  const scrollTable = (direction: 'left' | 'right') => {
    const el = tableContainerRef.current;
    if (!el) return;
    const delta = direction === 'left' ? -280 : 280;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = tableContainerRef.current;
    if (!el) return;
    const pct = parseFloat(e.target.value);
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    el.scrollLeft = (pct / 100) * maxScroll;
  };

  // 部署一覧の抽出
  const departments = useMemo(() => {
    const set = new Set(users.map((u) => u.department));
    return Array.from(set).sort();
  }, [users]);

  // 利用可能なプロファイル一覧 (明示指定またはデータ内包)
  const effectiveProfiles = useMemo(() => {
    if (userProfiles && userProfiles.length > 0) return userProfiles;
    return data.user_profiles || [];
  }, [userProfiles, data.user_profiles]);

  // 利用実績プロファイルのマップ作成
  const profileMap = useMemo(() => {
    const map = new Map<string, UserUsageProfile>();
    for (const p of effectiveProfiles) {
      map.set(p.login.toLowerCase(), p);
    }
    return map;
  }, [effectiveProfiles]);

  const hasUsageMetrics = effectiveProfiles.length > 0;

  const handleToggleUserDrilldown = (login: string) => {
    setSelectedUserLogin((prev) => (prev === login ? null : login));
  };

  const handleSort = (metric: UserSortMetric) => {
    if (sortBy === metric) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(metric);
      const isDescDefault =
        metric === 'acceptances' ||
        metric === 'suggestions' ||
        metric === 'acceptance_rate' ||
        metric === 'chats' ||
        metric === 'cost' ||
        metric === 'excess' ||
        metric === 'days_inactive';
      setSortOrder(isDescDefault ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (metric: UserSortMetric) => {
    if (sortBy !== metric) {
      return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-400 ml-1 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400 ml-1 shrink-0" />
    );
  };

  const handleDefaultSort = () => handleSort('default');

  // フィルタリング & ソート
  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      // 検索一致
      const matchesSearch =
        u.login.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.cost_center.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.tags && u.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase())));

      // ステータス一致
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

      // 部署一致
      const matchesDept = selectedDept === 'all' || u.department === selectedDept;

      return matchesSearch && matchesStatus && matchesDept;
    });

    if (sortBy === 'default') {
      return list;
    }

    return list.sort((a, b) => {
      const profA = profileMap.get(a.login.toLowerCase());
      const profB = profileMap.get(b.login.toLowerCase());

      let cmp = 0;
      switch (sortBy) {
        case 'user':
          cmp = a.login.localeCompare(b.login);
          break;
        case 'display_name':
          cmp = (a.display_name || '').localeCompare(b.display_name || '');
          break;
        case 'department':
          cmp = (a.department || '').localeCompare(b.department || '');
          break;
        case 'tags':
          cmp = (a.tags?.join(', ') || '').localeCompare(b.tags?.join(', ') || '');
          break;
        case 'cost_center':
          cmp = (a.cost_center || '').localeCompare(b.cost_center || '');
          break;
        case 'organization':
          cmp = (a.organization || '').localeCompare(b.organization || '');
          break;
        case 'plan':
          cmp = (a.plan_type || '').localeCompare(b.plan_type || '');
          break;
        case 'status':
          cmp = a.days_inactive - b.days_inactive;
          break;
        case 'acceptances':
          cmp = (profA?.total_acceptances ?? 0) - (profB?.total_acceptances ?? 0);
          break;
        case 'suggestions':
          cmp = (profA?.total_suggestions ?? 0) - (profB?.total_suggestions ?? 0);
          break;
        case 'acceptance_rate':
          cmp = (profA?.acceptance_rate ?? 0) - (profB?.acceptance_rate ?? 0);
          break;
        case 'chats':
          cmp = (profA?.total_chats ?? 0) - (profB?.total_chats ?? 0);
          break;
        case 'cost':
        case 'excess': {
          const costA = scope_type === 'daily' ? a.prorated_daily_cost_usd : a.monthly_cost_usd;
          const costB = scope_type === 'daily' ? b.prorated_daily_cost_usd : b.monthly_cost_usd;
          cmp = costA - costB;
          break;
        }
        case 'days_inactive':
          cmp = a.days_inactive - b.days_inactive;
          break;
        default:
          return 0;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [users, searchTerm, statusFilter, selectedDept, sortBy, sortOrder, profileMap, scope_type]);

  // CSVエクスポート
  const handleExportCsv = () => {
    const headers = [
      '#',
      'GitHub User',
      '表示名',
      'ユーザー定義Gr (部署)',
      'タグ',
      'Cost Center',
      'Organization',
      'プラン',
      'ステータス',
      '最終アクティビティ日',
      'エディタ',
      '非アクティブ日数',
      '月額費用 (USD)',
      '日割り費用 (USD)',
      ...(hasUsageMetrics ? ['提案数', '受諾採用数', '受諾率(%)', 'AIチャット数'] : []),
      '備考',
    ];

    const rows = filteredUsers.map((u, idx) => {
      const prof = profileMap.get(u.login.toLowerCase());
      return [
        idx + 1,
        u.login,
        `"${u.display_name.replace(/"/g, '""')}"`,
        `"${u.department.replace(/"/g, '""')}"`,
        `"${(u.tags || []).join(';').replace(/"/g, '""')}"`,
        `"${u.cost_center.replace(/"/g, '""')}"`,
        u.organization,
        u.plan_type,
        u.status,
        u.last_activity_at || '未利用',
        u.last_activity_editor || '-',
        u.days_inactive === 999 ? 'N/A' : u.days_inactive,
        u.monthly_cost_usd.toFixed(2),
        u.prorated_daily_cost_usd.toFixed(4),
        ...(hasUsageMetrics
          ? [
              prof?.total_suggestions ?? 0,
              prof?.total_acceptances ?? 0,
              ((prof?.acceptance_rate ?? 0) * 100).toFixed(1),
              prof?.total_chats ?? 0,
            ]
          : []),
        `"${(u.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `copilot_users_${data.scope_key}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: UserSeatStatus, daysInactive: number) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
            <UserCheck className="w-3 h-3" />
            <span>Active ({daysInactive}日前)</span>
          </span>
        );
      case 'low_active':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-yellow-950 text-yellow-300 border border-yellow-800">
            <Clock className="w-3 h-3" />
            <span>Low Active ({daysInactive}日前)</span>
          </span>
        );
      case 'idle':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-800 animate-pulse">
            <AlertCircle className="w-3 h-3" />
            <span>Idle ({daysInactive}日前)</span>
          </span>
        );
      case 'never_used':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <XCircle className="w-3 h-3" />
            <span>未利用 (Never)</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <UsersIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">ユーザー別 利用・活用明細</h3>
            {sortBy !== 'default' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span>並び替え適用中</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            該当ユーザー数: <strong className="text-slate-200">{filteredUsers.length}</strong> / {users.length} 名
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 検索入力 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ユーザー / 表示名 / 部署 検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            />
          </div>

          {/* ステータス絞り込み */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">全ステータス</option>
            <option value="active">Active (14日以内)</option>
            <option value="low_active">Low Active (15-30日)</option>
            <option value="idle">Idle (30日以上未利用)</option>
            <option value="never_used">Never Used (未利用)</option>
          </select>

          {/* 部署絞り込み */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
          >
            <option value="all">すべてのユーザー定義Gr</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          {/* 並び替え基準 */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">並び順:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as UserSortMetric)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
            >
              <option value="default" className="bg-slate-900">標準 (シート順)</option>
              <option value="acceptances" className="bg-slate-900">受諾数 降順</option>
              <option value="suggestions" className="bg-slate-900">提案数 降順</option>
              <option value="acceptance_rate" className="bg-slate-900">受諾率 降順</option>
              <option value="chats" className="bg-slate-900">AIチャット数 降順</option>
              <option value="cost" className="bg-slate-900">費用 降順</option>
              <option value="days_inactive" className="bg-slate-900">非アクティブ日数 降順</option>
            </select>
          </div>

          {/* 左右スクロールナビゲーションボタン */}
          <div className="flex items-center space-x-1 border border-slate-700 rounded-lg p-0.5 bg-slate-950" title="テーブルを左右にスクロール">
            <button
              onClick={() => scrollTable('left')}
              disabled={!scrollState.canScrollLeft}
              aria-label="左にスクロール"
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => scrollTable('right')}
              disabled={!scrollState.canScrollRight}
              aria-label="右にスクロール"
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CSVエクスポートボタン */}
          <button
            onClick={handleExportCsv}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>CSV出力</span>
          </button>
        </div>
      </div>

      {/* テーブル本体: ヘッダー固定・データ行垂直スクロール & 横スクロール対応 */}
      <div
        ref={tableContainerRef}
        className="overflow-auto max-h-[600px] rounded-lg border border-slate-800 relative scrollbar-thin scrollbar-thumb-slate-700"
      >
        <table className="w-full text-left text-xs text-slate-300 border-collapse whitespace-nowrap min-w-max">
          <thead className="sticky top-0 z-20 bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold shadow-md">
            <tr className="border-b border-slate-800">
              <th className="sticky top-0 left-0 z-30 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-center w-12 min-w-[48px] max-w-[48px] cursor-pointer select-none hover:text-slate-200" onClick={handleDefaultSort} title="標準順">#</th>
              <th
                className="sticky top-0 left-12 z-30 bg-slate-950 border-b border-slate-800 px-2.5 py-2 min-w-[140px] w-36 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('user')}
              >
                <div className="flex items-center space-x-1">
                  <span>ユーザー</span>
                  {renderSortIcon('user')}
                </div>
              </th>
              <th
                className="sticky top-0 left-[188px] z-30 bg-slate-950 border-b border-slate-800 px-2.5 py-2 min-w-[140px] w-36 border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)] cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('display_name')}
              >
                <div className="flex items-center space-x-1">
                  <span>表示名</span>
                  {renderSortIcon('display_name')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('department')}
              >
                <div className="flex items-center space-x-1">
                  <span>ユーザー定義Gr</span>
                  {renderSortIcon('department')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('tags')}
              >
                <div className="flex items-center space-x-1">
                  <span>タグ</span>
                  {renderSortIcon('tags')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('cost_center')}
              >
                <div className="flex items-center space-x-1">
                  <span>Cost Center</span>
                  {renderSortIcon('cost_center')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('organization')}
              >
                <div className="flex items-center space-x-1">
                  <span>Organization</span>
                  {renderSortIcon('organization')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('plan')}
              >
                <div className="flex items-center space-x-1">
                  <span>プラン</span>
                  {renderSortIcon('plan')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center space-x-1">
                  <span>稼働状況</span>
                  {renderSortIcon('status')}
                </div>
              </th>
              {hasUsageMetrics && (
                <>
                  <th
                    className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleSort('suggestions')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>提案数</span>
                      {renderSortIcon('suggestions')}
                    </div>
                  </th>
                  <th
                    className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleSort('acceptances')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>受諾採用数</span>
                      {renderSortIcon('acceptances')}
                    </div>
                  </th>
                  <th
                    className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleSort('acceptance_rate')}
                    title="IDEコード補完（Ghost Text）の受諾率です。Copilot CLIやAutopilot等の自律エージェント作業は含まれないため、CLI活用度の高いユーザーでは低く表示されることがあります。"
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>受諾率</span>
                      {renderSortIcon('acceptance_rate')}
                    </div>
                  </th>
                  <th
                    className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                    onClick={() => handleSort('chats')}
                  >
                    <div className="flex items-center justify-end space-x-1">
                      <span>AIチャット</span>
                      {renderSortIcon('chats')}
                    </div>
                  </th>
                </>
              )}
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('cost')}
                title="利用費用 (GitHubのカタログ価格(USD)基準)"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>利用費用 ({scope_type === 'daily' ? '日割り' : '月額'})</span>
                  {renderSortIcon('cost')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('excess')}
                title="超過請求 (GitHubのカタログ価格(USD))"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>超過請求 (USD)</span>
                  {renderSortIcon('excess')}
                </div>
              </th>
              <th className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-center w-24">
                <ActionColumnHeader />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={hasUsageMetrics ? 16 : 12} className="px-4 py-8 text-center text-slate-500">
                  一致するユーザーが見つかりませんでした。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, index) => {
                const prof = profileMap.get(u.login.toLowerCase());
                const isSelected = selectedUserLogin === u.login;

                return (
                  <React.Fragment key={u.login}>
                    <tr
                      onClick={() => handleToggleUserDrilldown(u.login)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-indigo-950/60 border-l-4 border-indigo-500'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <td className={`sticky left-0 z-20 px-2.5 py-2 text-center text-slate-500 font-mono text-xs w-12 min-w-[48px] max-w-[48px] transition-colors ${
                        isSelected ? 'bg-indigo-950' : 'bg-slate-900 group-hover:bg-slate-800/90'
                      }`}>
                        {index + 1}
                      </td>

                      <td className={`sticky left-12 z-20 px-2.5 py-2 min-w-[140px] w-36 transition-colors ${
                        isSelected ? 'bg-indigo-950' : 'bg-slate-900 group-hover:bg-slate-800/90'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <img
                            src={u.avatar_url || 'https://github.com/ghost.png'}
                            alt={u.login}
                            className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800 shrink-0"
                          />
                          <span className="text-slate-200 font-mono text-xs font-medium truncate">@{u.login}</span>
                        </div>
                      </td>

                      <td className={`sticky left-[188px] z-20 px-2.5 py-2 min-w-[140px] w-36 border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)] transition-colors ${
                        isSelected ? 'bg-indigo-950' : 'bg-slate-900 group-hover:bg-slate-800/90'
                      }`}>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-200 truncate">{u.display_name}</span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500 text-white shrink-0">
                              分析中
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-2.5 py-2">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/60">
                          {u.department}
                        </span>
                      </td>

                      <td className="px-2.5 py-2">
                        {u.tags && u.tags.length > 0 ? (
                          <div className="flex items-center space-x-1">
                            {u.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">-</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2">
                        {u.cost_center_error ? (
                          <span
                            className="inline-flex items-center space-x-1 text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded text-[11px] font-semibold"
                            title="Cost Center APIの取得失敗または未紐付けのためデータ不明"
                          >
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>不明 (API制限/エラー)</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">{u.cost_center}</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2">
                        {u.is_data_unavailable ? (
                          <span
                            className="inline-flex items-center space-x-1 text-rose-400 bg-rose-950/70 border border-rose-800/60 px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
                            title="Org権限不足(HTTP 403)のため詳細メトリクス取得不能"
                          >
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>{u.organization} (権限不足)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-[11px]">{u.organization}</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2">
                        <span
                          className={`text-[11px] font-bold uppercase ${
                            u.plan_type === 'enterprise' ? 'text-indigo-400' : 'text-slate-400'
                          }`}
                        >
                          {u.plan_type}
                        </span>
                      </td>

                      <td className="px-2.5 py-2">{getStatusBadge(u.status, u.days_inactive)}</td>

                      {hasUsageMetrics && (
                        <>
                          <td className="px-2.5 py-2 text-right font-mono text-slate-300">
                            {prof ? prof.total_suggestions.toLocaleString() : '-'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-400">
                            {prof ? prof.total_acceptances.toLocaleString() : '-'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono font-semibold text-purple-300">
                            {prof ? `${(prof.acceptance_rate * 100).toFixed(1)}%` : '-'}
                          </td>
                          <td className="px-2.5 py-2 text-right font-mono text-indigo-300">
                            {prof ? prof.total_chats.toLocaleString() : '-'}
                          </td>
                        </>
                      )}

                      <td className="px-2.5 py-2 text-right">
                        {(() => {
                          const cost = scope_type === 'daily' ? u.prorated_daily_cost_usd : u.monthly_cost_usd;
                          const costDual = formatMoney(cost);
                          return (
                            <div className="font-mono font-semibold text-slate-200">
                              {costDual.usd} {costDual.sub && <span className="text-[11px] text-slate-400">({costDual.sub})</span>}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono">
                        {(() => {
                          const cost = scope_type === 'daily' ? u.prorated_daily_cost_usd : u.monthly_cost_usd;
                          const costDual = formatMoney(cost);
                          return (
                            <div className="text-[11px] font-semibold text-amber-400">
                              {costDual.usd} {costDual.sub && <span className="text-[10px] text-amber-300/80">({costDual.sub})</span>}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="px-2.5 py-2 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleUserDrilldown(u.login);
                            }}
                            className={`p-1.5 rounded transition-all shadow-sm cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white border border-indigo-400'
                                : 'bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60'
                            }`}
                            title={isSelected ? 'ドリルダウンを閉じる' : '詳細分析 (利用実態・AI健全度をドリルダウン分析)'}
                            aria-label={isSelected ? '閉じる' : '詳細分析'}
                          >
                            {isSelected ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {onSelectUserForTrend && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserForTrend(u.login);
                              }}
                              className="p-1.5 rounded bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer inline-flex items-center justify-center"
                              title="トレンド (日次利用トレンド・モデル内訳を確認)"
                              aria-label="トレンド"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {onSelectUserForDeepAnalysis && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectUserForDeepAnalysis(u.login);
                              }}
                              className="p-1.5 rounded bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 transition-all shadow-sm cursor-pointer inline-flex items-center justify-center"
                              title="診断 (非効率パターン診断・高度分析を実行)"
                              aria-label="診断"
                            >
                              <BrainCircuit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`${u.login}-drilldown`} className="bg-slate-950">
                        <td colSpan={hasUsageMetrics ? 16 : 12} className="p-0 border-b-2 border-indigo-500/60 whitespace-normal">
                          <div className="sticky left-0 max-w-[calc(100vw-3.5rem)]">
                            <UserDrilldownPanel
                              login={u.login}
                              displayName={u.display_name}
                              avatarUrl={u.avatar_url}
                              department={u.department}
                              costCenter={u.cost_center}
                              organization={u.organization}
                              planType={u.plan_type}
                              statusBadge={getStatusBadge(u.status, u.days_inactive)}
                              lastActivity={u.last_activity_at}
                              editor={u.last_activity_editor}
                              daysInactive={u.days_inactive}
                              monthlyCostUsd={u.monthly_cost_usd}
                              proratedCostUsd={u.prorated_daily_cost_usd}
                              excessBillingUsd={scope_type === 'daily' ? u.prorated_daily_cost_usd : u.monthly_cost_usd}
                              profile={prof}
                              allProfiles={effectiveProfiles}
                              onSelectUserForTrend={onSelectUserForTrend}
                              onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis}
                              onClose={() => setSelectedUserLogin(null)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 画面下部追従型 水平スクロールコントローラー (Sticky Bottom Bar) */}
      {scrollState.scrollWidth > scrollState.clientWidth && (
        <div className="sticky bottom-0 z-30 -mx-5 -mb-5 px-4 py-2 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 rounded-b-xl flex items-center justify-between gap-3 text-xs text-slate-300 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-[11px] font-semibold text-slate-400">横スクロール</span>
            <span className="text-[10px] text-indigo-400 font-mono font-bold">
              {Math.round(scrollState.progress)}%
            </span>
          </div>

          <div className="flex-1 max-w-md mx-2 flex items-center">
            <input
              type="range"
              min="0"
              max="100"
              value={scrollState.progress}
              onChange={handleSliderChange}
              aria-label="水平スクロール位置"
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:bg-slate-700 transition"
            />
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => scrollTable('left')}
              disabled={!scrollState.canScrollLeft}
              aria-label="下部バー左スクロール"
              title="左にスクロール (280px)"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition border border-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollTable('right')}
              disabled={!scrollState.canScrollRight}
              aria-label="下部バー右スクロール"
              title="右にスクロール (280px)"
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition border border-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
