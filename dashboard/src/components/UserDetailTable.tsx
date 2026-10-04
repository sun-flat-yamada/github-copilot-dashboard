import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  GroupingDimension,
  MonthlyReportAggregatedData,
  ScopeAggregatedData,
  UserSeatStatus,
  UserUsageProfile,
} from '../../../src/types/copilot';
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
  Hourglass,
  User,
} from 'lucide-react';
import { ActionColumnHeader } from './common/ActionColumnHeader';
import { SEAT_IDLE_DAYS, SEAT_LOW_ACTIVE_DAYS, SEAT_ONBOARDING_DAYS } from '../../../src/domain/rules/SeatClassificationRule';
import { UserDrilldownPanel } from './UserDrilldownPanel';
import { UsageInsightPanel } from './UsageInsightPanel';
import { UsageSignalBadge } from './common/UsageSignalBadge';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatElapsedActivity } from '../utils/dateFormatters';
import {
  buildLiveRows,
  buildReportRows,
  UserDetailRow,
  UserDetailRowSet,
} from '../../../src/adapters/presenters/UserDetailRows';
import { PERSONAL_METRICS_NOTICE } from '../../../src/domain/metrics/metric-registry';
import { describeInsightTooltip } from '../../../src/processor/usage-insight-definitions';

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
  | 'primary_model'
  | 'requests'
  | 'suggestions'
  | 'acceptances'
  | 'acceptance_rate'
  | 'chats'
  | 'tokens'
  | 'token_cost'
  | 'signal'
  | 'cost'
  | 'excess'
  | 'last_activity';

/** 表のデータ列の数。ドリルダウン行や空行の colSpan に使う (列を足したら更新する) */
export const USER_DETAIL_COLUMN_COUNT = 22;

const SIGNAL_RANK = { insufficient: -1, none: 0, watch: 1, review: 2 } as const;

/** ソースに値が無いセルの理由 (「—」のツールチップ)。0 と区別して欠損を示す */
const UNAVAILABLE_REASON = {
  seat: 'シート情報は月次レポートに含まれません',
  usage: 'このデータソースには含まれない項目です',
  noProfile: '利用実績 (メトリクス) を取得できていないユーザーです',
  noTokens: 'トークン列のないデータです (AI usage report が必要です)',
  noInsight: 'このデータソースには使用量の内訳がありません',
} as const;

interface UserDetailTableProps {
  /** ライブ (シート + Reports API) */
  data?: ScopeAggregatedData | null;
  /** 月次レポート (CSV)。data と reportData のどちらか一方を渡す */
  reportData?: MonthlyReportAggregatedData | null;
  userProfiles?: UserUsageProfile[];
  initialSelectedLogin?: string;
  filterStatus?: UserSeatStatus | 'all';
  /** 絞り込みに使うグループの軸 (既定は部署=ユーザー定義Gr) */
  grouping?: GroupingDimension;
  /** 外部から制御するグループ選択 (未指定なら内部状態) */
  selectedGroup?: string;
  onGroupChange?: (group: string) => void;
  onSelectUserForTrend?: (login: string) => void;
  onSelectUserForDeepAnalysis?: (login: string) => void;
}

const EMPTY_SET: UserDetailRowSet = { source: 'live', rows: [], costUnitLabel: '', scopeKey: 'none' };

/** null を常に末尾にして比較する (昇順・降順どちらでも欠損が先頭に来ない) */
const compareNullable = (a: number | null, b: number | null, order: 'asc' | 'desc'): number => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return order === 'asc' ? a - b : b - a;
};

const compareText = (a: string | null | undefined, b: string | null | undefined, order: 'asc' | 'desc'): number => {
  const cmp = (a || '').localeCompare(b || '');
  return order === 'asc' ? cmp : -cmp;
};

export const UserDetailTable: React.FC<UserDetailTableProps> = ({
  data,
  reportData,
  userProfiles,
  initialSelectedLogin,
  filterStatus: initialStatus = 'all',
  grouping = 'department',
  selectedGroup,
  onGroupChange,
  onSelectUserForTrend,
  onSelectUserForDeepAnalysis,
}) => {
  // 表示経路 (ライブ / 月次) ごとの違いは行モデルへの変換で吸収し、以降は同じ列・同じ意味で描画する
  const rowSet = useMemo<UserDetailRowSet>(() => {
    if (data) return buildLiveRows(data, userProfiles);
    if (reportData) return buildReportRows(reportData);
    return EMPTY_SET;
  }, [data, reportData, userProfiles]);
  const users = rowSet.rows;
  const { costUnitLabel } = rowSet;
  const hasSeatInfo = users.some((u) => u.status !== null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserSeatStatus | 'all'>(initialStatus);
  const [localGroup, setLocalGroup] = useState<string>('all');
  const [onlyReview, setOnlyReview] = useState<boolean>(false);
  const defaultSortFor = (source: UserDetailRowSet['source']): UserSortMetric => (source === 'report' ? 'cost' : 'default');
  const [sortBy, setSortBy] = useState<UserSortMetric>(defaultSortFor(rowSet.source));
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { formatMoney } = useCurrency();
  const [selectedUserLogin, setSelectedUserLogin] = useState<string | null>(initialSelectedLogin || null);

  // データソースが切り替わったら、そのソースの既定の並びに戻す
  useEffect(() => {
    setSortBy(defaultSortFor(rowSet.source));
    setSortOrder('desc');
    setStatusFilter('all');
  }, [rowSet.source]);

  const activeGroup = selectedGroup !== undefined ? selectedGroup : localGroup;

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

  const groupOf = useCallback(
    (u: UserDetailRow): string => (grouping === 'cost_center' ? u.cost_center : grouping === 'organization' ? u.organization : u.department),
    [grouping]
  );

  // 絞り込み用のグループ一覧
  const groups = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      const g = groupOf(u);
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [users, groupOf]);

  const handleGroupFilterChange = (val: string) => {
    setLocalGroup(val);
    if (onGroupChange) onGroupChange(val);
  };

  // ドリルダウン用のプロファイル (実測のあるものだけ。月次レポートの集計から合成しない)
  const effectiveProfiles = useMemo<UserUsageProfile[]>(() => {
    if (userProfiles && userProfiles.length > 0) return userProfiles;
    return data?.user_profiles || [];
  }, [userProfiles, data?.user_profiles]);

  const profileMap = useMemo(() => {
    const map = new Map<string, UserUsageProfile>();
    for (const p of effectiveProfiles) {
      map.set(p.login.toLowerCase(), p);
    }
    return map;
  }, [effectiveProfiles]);

  const handleToggleUserDrilldown = (login: string) => {
    setSelectedUserLogin((prev) => (prev === login ? null : login));
  };

  const handleSort = (metric: UserSortMetric) => {
    if (sortBy === metric) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(metric);
      const isDescDefault =
        metric === 'requests' ||
        metric === 'acceptances' ||
        metric === 'suggestions' ||
        metric === 'acceptance_rate' ||
        metric === 'chats' ||
        metric === 'tokens' ||
        metric === 'token_cost' ||
        metric === 'signal' ||
        metric === 'cost' ||
        metric === 'excess' ||
        metric === 'last_activity';
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
    const q = searchTerm.toLowerCase();
    const list = users.filter((u) => {
      const matchesSearch =
        u.login.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.cost_center.toLowerCase().includes(q) ||
        u.organization.toLowerCase().includes(q) ||
        u.tags.some((t) => t.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      const matchesGroup = !activeGroup || activeGroup === 'all' || groupOf(u) === activeGroup;
      const matchesReview = !onlyReview || u.usage_insight?.level === 'review';
      return matchesSearch && matchesStatus && matchesGroup && matchesReview;
    });

    if (sortBy === 'default') {
      return list;
    }

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'user':
          return compareText(a.login, b.login, sortOrder);
        case 'display_name':
          return compareText(a.display_name, b.display_name, sortOrder);
        case 'department':
          return compareText(a.department, b.department, sortOrder);
        case 'tags':
          return compareText(a.tags.join(', '), b.tags.join(', '), sortOrder);
        case 'cost_center':
          return compareText(a.cost_center, b.cost_center, sortOrder);
        case 'organization':
          return compareText(a.organization, b.organization, sortOrder);
        case 'plan':
          return compareText(a.plan, b.plan, sortOrder);
        case 'status':
          return compareNullable(a.days_inactive, b.days_inactive, sortOrder);
        case 'primary_model':
          return compareText(a.primary_model, b.primary_model, sortOrder);
        case 'requests':
          return compareNullable(a.requests, b.requests, sortOrder);
        case 'suggestions':
          return compareNullable(a.suggestions, b.suggestions, sortOrder);
        case 'acceptances':
          return compareNullable(a.acceptances, b.acceptances, sortOrder);
        case 'acceptance_rate':
          return compareNullable(a.acceptance_rate, b.acceptance_rate, sortOrder);
        case 'chats':
          return compareNullable(a.chats, b.chats, sortOrder);
        case 'tokens':
          return compareNullable(a.usage_insight?.tokens?.total ?? null, b.usage_insight?.tokens?.total ?? null, sortOrder);
        case 'token_cost':
          return compareNullable(
            a.usage_insight?.unit_cost.per_million_tokens_usd ?? null,
            b.usage_insight?.unit_cost.per_million_tokens_usd ?? null,
            sortOrder
          );
        case 'signal':
          return compareNullable(
            a.usage_insight ? SIGNAL_RANK[a.usage_insight.level] : null,
            b.usage_insight ? SIGNAL_RANK[b.usage_insight.level] : null,
            sortOrder
          );
        case 'cost':
          return compareNullable(a.usage_cost_usd, b.usage_cost_usd, sortOrder);
        case 'excess':
          return compareNullable(a.excess_usd, b.excess_usd, sortOrder);
        case 'last_activity':
          return compareText(a.last_activity, b.last_activity, sortOrder);
        default:
          return 0;
      }
    });
  }, [users, searchTerm, statusFilter, activeGroup, onlyReview, groupOf, sortBy, sortOrder]);

  // CSVエクスポート (表示経路によらず同じ列。そのソースに無い値は空欄)
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
      '非アクティブ日数',
      '主利用モデル',
      'リクエスト数',
      '提案数',
      '受諾採用数',
      'Inline補完受諾率(%)',
      'AIチャット数',
      'トークン合計',
      'トークン 入力',
      'トークン 出力',
      'トークン キャッシュ読取',
      'トークン キャッシュ書込',
      'コスト/100万トークン (USD)',
      'コスト/リクエスト (USD)',
      '兆候',
      `利用費用 (${costUnitLabel})`,
      '超過請求 (USD)',
      '最終利用日',
      'エディタ/サーフェス',
      '備考',
    ];
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const n = (v: number | null | undefined, d?: number) => (v === null || v === undefined ? '' : d === undefined ? v : v.toFixed(d));

    const rows = filteredUsers.map((u, idx) => {
      const ins = u.usage_insight;
      return [
        idx + 1,
        u.login,
        q(u.display_name),
        q(u.department),
        q(u.tags.join(';')),
        q(u.cost_center),
        u.organization,
        u.plan ?? '',
        u.status ?? '',
        u.days_inactive === null ? '' : u.days_inactive === 999 ? 'N/A' : u.days_inactive,
        q(u.primary_model ?? ''),
        n(u.requests),
        n(u.suggestions),
        n(u.acceptances),
        u.acceptance_rate === null ? '' : (u.acceptance_rate * 100).toFixed(1),
        n(u.chats),
        n(ins?.tokens?.total),
        n(ins?.tokens?.input),
        n(ins?.tokens?.output),
        n(ins?.tokens?.cache_read),
        n(ins?.tokens?.cache_write),
        n(ins?.unit_cost.per_million_tokens_usd),
        n(ins?.unit_cost.per_request_usd),
        ins?.level ?? '',
        // プラン未確定のシートは費用を算定していない。0 と区別するため空欄にする
        n(u.usage_cost_usd, 2),
        n(u.excess_usd, 2),
        u.last_activity ?? '',
        q(u.surface ?? ''),
        q(u.notes ?? ''),
      ];
    });

    const csvContent = '﻿' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `copilot_users_${rowSet.scopeKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: UserSeatStatus, daysInactive: number | null) => {
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
      case 'onboarding':
        return (
          <span
            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-800"
            title={`付与から${SEAT_ONBOARDING_DAYS}日未満で、まだ利用がないシートです。遊休 (削減可能) には含めません`}
          >
            <Hourglass className="w-3 h-3" />
            <span>導入期間</span>
          </span>
        );
    }
  };

  /** そのソースに無い値のセル。0 ではなく「—」と理由を示す */
  const unavailable = (reason: string, align: 'left' | 'right' = 'right') => (
    <td className={`px-2.5 py-2 ${align === 'right' ? 'text-right' : ''} font-mono text-slate-500`} title={reason}>
      —
    </td>
  );

  const money = (usd: number) => formatMoney(usd);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <UsersIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-200">ユーザー別 利用・活用明細</h3>
            {sortBy !== 'default' && sortBy !== defaultSortFor(rowSet.source) && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span>並び替え適用中</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            該当ユーザー数: <strong className="text-slate-200">{filteredUsers.length}</strong> / {users.length} 名
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5" data-testid="personal-metrics-notice">{PERSONAL_METRICS_NOTICE}</p>
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

          {/* ステータス絞り込み (シート情報があるデータのみ) */}
          {hasSeatInfo && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserSeatStatus | 'all')}
              className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">全ステータス</option>
              <option value="active">Active ({SEAT_LOW_ACTIVE_DAYS}日以内)</option>
              <option value="low_active">Low Active ({SEAT_LOW_ACTIVE_DAYS + 1}-{SEAT_IDLE_DAYS}日)</option>
              <option value="idle">Idle ({SEAT_IDLE_DAYS}日超 未利用 / AIクレジット消費0は{SEAT_LOW_ACTIVE_DAYS}日超)</option>
              <option value="never_used">Never Used (付与から{SEAT_ONBOARDING_DAYS}日以上 未利用)</option>
              <option value="onboarding">導入期間 (付与から{SEAT_ONBOARDING_DAYS}日未満・未利用)</option>
            </select>
          )}

          {/* グループ絞り込み (軸は grouping で決まる) */}
          <select
            value={activeGroup}
            onChange={(e) => handleGroupFilterChange(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
          >
            <option value="all">
              {grouping === 'cost_center' ? 'すべてのCost Center' : grouping === 'organization' ? 'すべてのOrganization' : 'すべてのユーザー定義Gr'}
            </option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>

          {/* 兆候の絞り込み */}
          <label
            className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer select-none"
            title="利用方法の確認を推奨する兆候のあるユーザーだけを表示します"
          >
            <input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} className="accent-amber-500" />
            <span>確認を推奨のみ</span>
          </label>

          {/* 並び替え基準 */}
          <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1">
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">並び順:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as UserSortMetric);
                setSortOrder('desc');
              }}
              className="bg-transparent text-xs text-slate-200 focus:outline-none"
            >
              <option value="default" className="bg-slate-900">標準 (データ順)</option>
              <option value="cost" className="bg-slate-900">利用費用 降順</option>
              <option value="requests" className="bg-slate-900">リクエスト数 降順</option>
              <option value="tokens" className="bg-slate-900">トークン 降順</option>
              <option value="signal" className="bg-slate-900">兆候 (確認を推奨が先)</option>
              <option value="acceptances" className="bg-slate-900">受諾数 降順</option>
              <option value="suggestions" className="bg-slate-900">提案数 降順</option>
              <option value="acceptance_rate" className="bg-slate-900">Inline補完受諾率 降順</option>
              <option value="chats" className="bg-slate-900">AIチャット数 降順</option>
              <option value="status" className="bg-slate-900">非アクティブ日数</option>
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
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold shadow-md">
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
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('primary_model')}
              >
                <div className="flex items-center space-x-1">
                  <span>主利用モデル</span>
                  {renderSortIcon('primary_model')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('requests')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>総リクエスト</span>
                  {renderSortIcon('requests')}
                </div>
              </th>
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
                  <span>Inline補完受諾率</span>
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
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('tokens')}
                title="入力・出力・キャッシュのトークン合計 (AI usage report のトークン列がある場合)"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>トークン</span>
                  {renderSortIcon('tokens')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('token_cost')}
                title="利用額 ÷ トークン合計 × 100 万 (キャッシュを含む混合単価)"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>コスト/100万トークン</span>
                  {renderSortIcon('token_cost')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('signal')}
                title="長大化・混在の兆候 (1 日単位の集計からの推定。会話の内容は見ていません)"
              >
                <div className="flex items-center space-x-1">
                  <span>兆候</span>
                  {renderSortIcon('signal')}
                </div>
              </th>
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('cost')}
                title="利用費用 (GitHubのカタログ価格(USD)基準)"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>利用費用 ({costUnitLabel})</span>
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
              <th
                className="sticky top-0 z-20 bg-slate-950 border-b border-slate-800 px-2.5 py-2 text-right cursor-pointer select-none hover:text-slate-200 transition-colors group"
                onClick={() => handleSort('last_activity')}
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>最終利用日</span>
                  {renderSortIcon('last_activity')}
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
                <td colSpan={USER_DETAIL_COLUMN_COUNT} className="px-4 py-8 text-center text-slate-500">
                  一致するユーザーが見つかりませんでした。
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, index) => {
                const prof = profileMap.get(u.login.toLowerCase());
                const isSelected = selectedUserLogin === u.login;
                const ins = u.usage_insight;
                const elapsed = u.last_activity ? formatElapsedActivity(u.last_activity) : '';
                const na = (reason: string) => unavailable(reason);

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
                      <td className={`sticky left-0 z-10 px-2.5 py-2 text-center text-slate-500 font-mono text-xs w-12 min-w-[48px] max-w-[48px] transition-colors ${
                        isSelected ? 'bg-indigo-950' : 'bg-slate-900 group-hover:bg-slate-800/90'
                      }`}>
                        {index + 1}
                      </td>

                      <td className={`sticky left-12 z-10 px-2.5 py-2 min-w-[140px] w-36 transition-colors ${
                        isSelected ? 'bg-indigo-950' : 'bg-slate-900 group-hover:bg-slate-800/90'
                      }`}>
                        <div className="flex items-center space-x-2">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt={u.login}
                              className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800 shrink-0"
                            />
                          ) : (
                            // アバター URL が無い (匿名化時・月次レポートなど) ときは外部画像を取得せず、アイコンで代替する
                            <span
                              className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800 shrink-0 flex items-center justify-center"
                              aria-hidden="true"
                            >
                              <User className="w-3 h-3 text-slate-500" />
                            </span>
                          )}
                          <span className="text-slate-200 font-mono text-xs font-medium truncate">@{u.login}</span>
                        </div>
                      </td>

                      <td className={`sticky left-[188px] z-10 px-2.5 py-2 min-w-[140px] w-36 border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)] transition-colors ${
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
                        {u.tags.length > 0 ? (
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

                      {u.plan === null ? (
                        unavailable(UNAVAILABLE_REASON.seat, 'left')
                      ) : (
                        <td className="px-2.5 py-2">
                          {u.plan === 'unknown' ? (
                            <span
                              className="text-[11px] font-bold text-amber-400"
                              title="API が plan_type を返さない / 未知の値のため、料金を推測せず費用を算定していません"
                            >
                              未確定
                            </span>
                          ) : (
                            <span
                              className={`text-[11px] font-bold uppercase ${
                                u.plan === 'enterprise' ? 'text-indigo-400' : 'text-slate-400'
                              }`}
                            >
                              {u.plan}
                            </span>
                          )}
                        </td>
                      )}

                      {u.status === null ? (
                        unavailable(UNAVAILABLE_REASON.seat, 'left')
                      ) : (
                        <td className="px-2.5 py-2">{getStatusBadge(u.status, u.days_inactive)}</td>
                      )}

                      {u.primary_model === null ? (
                        unavailable(UNAVAILABLE_REASON.noProfile, 'left')
                      ) : (
                        <td className="px-2.5 py-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-950/60 text-purple-300 border border-purple-800/50">
                            {u.primary_model}
                          </span>
                        </td>
                      )}

                      {u.requests === null ? (
                        na(UNAVAILABLE_REASON.usage)
                      ) : (
                        <td className="px-2.5 py-2 text-right font-medium text-slate-200">{u.requests.toLocaleString()}</td>
                      )}

                      {u.suggestions === null ? (
                        na(u.source === 'live' ? UNAVAILABLE_REASON.noProfile : UNAVAILABLE_REASON.usage)
                      ) : (
                        <td className="px-2.5 py-2 text-right font-mono text-slate-300">{u.suggestions.toLocaleString()}</td>
                      )}
                      {u.acceptances === null ? (
                        na(u.source === 'live' ? UNAVAILABLE_REASON.noProfile : UNAVAILABLE_REASON.usage)
                      ) : (
                        <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-400">{u.acceptances.toLocaleString()}</td>
                      )}
                      {u.acceptance_rate === null ? (
                        na(u.source === 'live' ? '提案が無いため算出できません' : UNAVAILABLE_REASON.usage)
                      ) : (
                        <td className="px-2.5 py-2 text-right font-mono font-semibold text-purple-300">
                          {`${(u.acceptance_rate * 100).toFixed(1)}%`}
                        </td>
                      )}
                      {u.chats === null ? (
                        na(u.source === 'live' ? UNAVAILABLE_REASON.noProfile : UNAVAILABLE_REASON.usage)
                      ) : (
                        <td className="px-2.5 py-2 text-right font-mono text-indigo-300">{u.chats.toLocaleString()}</td>
                      )}

                      {ins?.tokens ? (
                        <td className="px-2.5 py-2 text-right font-mono text-slate-200">{ins.tokens.total.toLocaleString()}</td>
                      ) : (
                        na(ins ? UNAVAILABLE_REASON.noTokens : UNAVAILABLE_REASON.noInsight)
                      )}
                      {ins?.unit_cost.per_million_tokens_usd !== null && ins?.unit_cost.per_million_tokens_usd !== undefined ? (
                        <td className="px-2.5 py-2 text-right font-mono text-slate-200">
                          {money(ins.unit_cost.per_million_tokens_usd).usd}
                        </td>
                      ) : (
                        na(ins ? UNAVAILABLE_REASON.noTokens : UNAVAILABLE_REASON.noInsight)
                      )}
                      <td className="px-2.5 py-2">
                        {ins ? (
                          <UsageSignalBadge level={ins.level} title={describeInsightTooltip(ins.signals)} />
                        ) : (
                          <span className="text-slate-500" title={UNAVAILABLE_REASON.noInsight}>—</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2 text-right">
                        {u.cost_unconfirmed || u.usage_cost_usd === null ? (
                          <div
                            className="font-mono text-slate-500"
                            title="料金プランが未確定のため費用を算定していません (集計にも含まれません)"
                            data-testid="user-cost-unconfirmed"
                          >
                            —
                          </div>
                        ) : (
                          (() => {
                            const costDual = money(u.usage_cost_usd);
                            return (
                              <div className="font-mono font-semibold text-slate-200">
                                {costDual.usd} {costDual.sub && <span className="text-[11px] text-slate-400">({costDual.sub})</span>}
                              </div>
                            );
                          })()
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right font-mono">
                        {u.cost_unconfirmed || u.excess_usd === null ? (
                          <div className="text-[11px] text-slate-500">—</div>
                        ) : (
                          (() => {
                            const costDual = money(u.excess_usd);
                            return (
                              <div className="text-[11px] font-semibold text-amber-400">
                                {costDual.usd} {costDual.sub && <span className="text-[10px] text-amber-300/80">({costDual.sub})</span>}
                              </div>
                            );
                          })()
                        )}
                      </td>

                      <td className="px-2.5 py-2 text-right font-mono text-[11px]" title={u.surface ?? undefined}>
                        {u.last_activity ? (
                          <div className="flex items-center justify-end space-x-1.5 whitespace-nowrap">
                            <span className="text-slate-200">{u.last_activity.substring(0, 10)}</span>
                            {elapsed && <span className="text-[10px] text-slate-400 font-sans">({elapsed})</span>}
                          </div>
                        ) : (
                          <span className="text-slate-500">未利用</span>
                        )}
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
                        <td colSpan={USER_DETAIL_COLUMN_COUNT} className="p-0 border-b-2 border-indigo-500/60 whitespace-normal">
                          <div className="sticky left-0 max-w-[calc(100vw-3.5rem)]">
                            <UserDrilldownPanel
                              login={u.login}
                              displayName={u.display_name}
                              avatarUrl={u.avatar_url ?? undefined}
                              department={u.department}
                              costCenter={u.cost_center}
                              organization={u.organization}
                              planType={u.plan ?? undefined}
                              statusBadge={u.status ? getStatusBadge(u.status, u.days_inactive) : undefined}
                              lastActivity={u.last_activity}
                              editor={u.source === 'live' ? u.surface : undefined}
                              daysInactive={u.days_inactive ?? undefined}
                              monthlyCostUsd={u.source === 'live' ? (u.monthly_cost_usd ?? undefined) : (u.usage_cost_usd ?? undefined)}
                              proratedCostUsd={u.prorated_daily_cost_usd ?? undefined}
                              excessBillingUsd={u.excess_usd ?? undefined}
                              costUnconfirmed={u.cost_unconfirmed}
                              profile={prof}
                              allProfiles={effectiveProfiles}
                              primaryModel={u.primary_model ?? undefined}
                              totalRequests={u.requests ?? undefined}
                              surface={u.source === 'report' ? (u.surface ?? undefined) : undefined}
                              onSelectUserForTrend={onSelectUserForTrend}
                              onSelectUserForDeepAnalysis={onSelectUserForDeepAnalysis}
                              onClose={() => setSelectedUserLogin(null)}
                              insightSlot={u.usage_insight ? <UsageInsightPanel insight={u.usage_insight} /> : undefined}
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
        <div className="sticky bottom-0 z-40 -mx-5 -mb-5 px-4 py-2 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 rounded-b-xl flex items-center justify-between gap-3 text-xs text-slate-300 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]">
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
