import {
  ScopeAggregatedData,
  EnrichedUserSeat,
  UserUsageProfile,
  IndexMetadata,
  EnterpriseCostCenter,
  CostCenterBudget,
} from '../../types/copilot.js';

/**
 * 自動収集データの全選択パターンを検証するための確定的なユーザー属性マトリクス
 * 13名の最小完備集合（全CostCenter, 全Org, 全Group, 各種タグ, 未割当, 特殊プレフィックス）
 */
export interface TestUserSpec {
  login: string;
  display_name: string;
  cost_center?: string;
  organization?: string;
  department?: string;
  tags: string[];
  status: 'active' | 'low_active' | 'idle' | 'never_used';
  monthly_cost_usd: number;
  total_chats: number;
  total_suggestions: number;
  total_acceptances: number;
}

export const TEST_USERS_MATRIX: TestUserSpec[] = [
  {
    login: 'dev-lead-taro',
    display_name: '田中 太郎',
    cost_center: 'FinTech-Division',
    organization: 'proud-fintech',
    department: 'コア決済基盤チーム',
    tags: ['backend', 'lead', 'typescript'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 150,
    total_suggestions: 1200,
    total_acceptances: 450,
  },
  {
    login: 'dev-hanako',
    display_name: '鈴木 花子',
    cost_center: 'Research-and-AI',
    organization: 'proud-ai-labs',
    department: 'LLM応用プロダクトG',
    tags: ['ai-ml', 'python', 'research'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 220,
    total_suggestions: 1800,
    total_acceptances: 720,
  },
  {
    login: 'sre-kenji-sato',
    display_name: '佐藤 健二',
    cost_center: 'Cloud-Platform',
    organization: 'proud-cloud-core',
    department: 'SRE & クラウド基盤部',
    tags: ['infra', 'sre', 'go'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 90,
    total_suggestions: 950,
    total_acceptances: 360,
  },
  {
    login: 'mobile-yuki',
    display_name: '高橋 悠希',
    cost_center: 'FinTech-Division',
    organization: 'proud-fintech',
    department: 'モバイルアプリ開発部',
    tags: ['mobile', 'frontend', 'ios'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 110,
    total_suggestions: 800,
    total_acceptances: 290,
  },
  {
    login: 'dx-mika-ito',
    display_name: '伊藤 美香',
    cost_center: 'Enterprise-IT',
    organization: 'proud-internal-sys',
    department: '業務システム改革推進室',
    tags: ['dx', 'manager', 'lead'],
    status: 'low_active',
    monthly_cost_usd: 39,
    total_chats: 35,
    total_suggestions: 240,
    total_acceptances: 75,
  },
  {
    login: 'contractor-alex',
    display_name: 'Alex Rivera',
    cost_center: 'FinTech-Division',
    organization: 'proud-fintech',
    department: 'コア決済基盤チーム',
    tags: ['contractor', 'backend'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 130,
    total_suggestions: 1100,
    total_acceptances: 410,
  },
  {
    login: 'infra-daiki',
    display_name: '山田 大樹',
    cost_center: 'Cloud-Platform',
    organization: 'proud-cloud-core',
    department: 'SRE & クラウド基盤部',
    tags: ['infra', 'k8s', 'go'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 85,
    total_suggestions: 700,
    total_acceptances: 260,
  },
  {
    // CostCenter 未割当
    login: 'guest-intern-bob',
    display_name: 'Bob Intern',
    cost_center: undefined,
    organization: 'proud-fintech',
    department: 'コア決済基盤チーム',
    tags: ['intern'],
    status: 'low_active',
    monthly_cost_usd: 39,
    total_chats: 20,
    total_suggestions: 150,
    total_acceptances: 45,
  },
  {
    // Organization 未割当
    login: 'contractor-carol',
    display_name: 'Carol White',
    cost_center: 'FinTech-Division',
    organization: undefined,
    department: 'コア決済基盤チーム',
    tags: ['contractor'],
    status: 'idle',
    monthly_cost_usd: 39,
    total_chats: 0,
    total_suggestions: 0,
    total_acceptances: 0,
  },
  {
    // Department / Group 未設定 (Unassigned)
    login: 'shadow-dave',
    display_name: 'Dave Shadow',
    cost_center: 'Enterprise-IT',
    organization: 'proud-internal-sys',
    department: 'Unassigned',
    tags: ['legacy'],
    status: 'idle',
    monthly_cost_usd: 39,
    total_chats: 5,
    total_suggestions: 40,
    total_acceptances: 10,
  },
  {
    // タグ未設定
    login: 'notag-frank',
    display_name: 'Frank NoTag',
    cost_center: 'Research-and-AI',
    organization: 'proud-ai-labs',
    department: 'LLM応用プロダクトG',
    tags: [],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 60,
    total_suggestions: 500,
    total_acceptances: 180,
  },
  {
    // 完全未割当ユーザー（すべての軸で未割当）
    login: 'ghost-anonymous',
    display_name: '',
    cost_center: undefined,
    organization: undefined,
    department: '未設定',
    tags: [],
    status: 'never_used',
    monthly_cost_usd: 39,
    total_chats: 0,
    total_suggestions: 0,
    total_acceptances: 0,
  },
  {
    // 全タグ保有ユーザー
    login: 'super-fullstack',
    display_name: '佐々木 一郎',
    cost_center: 'FinTech-Division',
    organization: 'proud-fintech',
    department: 'コア決済基盤チーム',
    tags: ['backend', 'frontend', 'ai-ml', 'sre', 'lead', 'dx'],
    status: 'active',
    monthly_cost_usd: 39,
    total_chats: 300,
    total_suggestions: 2500,
    total_acceptances: 1000,
  },
];

/**
 * 確定的な EnrichedUserSeat 配列を生成
 */
export function buildEnrichedUserSeats(specs: TestUserSpec[] = TEST_USERS_MATRIX): EnrichedUserSeat[] {
  return specs.map((spec, index) => {
    return {
      login: spec.login,
      display_name: spec.display_name,
      avatar_url: `https://avatars.githubusercontent.com/u/${30000 + index}?v=4`,
      cost_center: spec.cost_center || '',
      organization: spec.organization || '',
      department: spec.department || '未設定',
      tags: spec.tags,
      status: spec.status,
      last_activity_at:
        spec.status === 'active'
          ? '2026-09-10T12:00:00Z'
          : spec.status === 'low_active'
          ? '2026-08-25T08:00:00Z'
          : spec.status === 'idle'
          ? '2026-07-20T10:00:00Z'
          : null,
      last_activity_editor: spec.status !== 'never_used' ? 'vscode/1.112.0' : null,
      monthly_cost_usd: spec.monthly_cost_usd,
      prorated_daily_cost_usd: Number((spec.monthly_cost_usd / 30).toFixed(2)),
      created_at: '2026-01-01T00:00:00Z',
      plan_type: 'enterprise',
      days_inactive: spec.status === 'active' ? 1 : spec.status === 'low_active' ? 16 : spec.status === 'idle' ? 45 : 999,
      ai_credits_used_28d: spec.status === 'active' ? 50 : 0,
    };
  });
}

/**
 * 確定的な UserUsageProfile 配列を生成
 */
export function buildUserUsageProfiles(specs: TestUserSpec[] = TEST_USERS_MATRIX): UserUsageProfile[] {
  return specs.map((spec, index) => {
    const totalLinesSuggested = spec.total_suggestions * 7;
    const totalLinesAccepted = spec.total_acceptances * 6;
    return {
      login: spec.login,
      display_name: spec.display_name,
      avatar_url: `https://avatars.githubusercontent.com/u/${30000 + index}?v=4`,
      department: spec.department || '未設定',
      organization: spec.organization || '',
      cost_center: spec.cost_center || '',
      plan_type: 'enterprise',
      total_chats: spec.total_chats,
      total_suggestions: spec.total_suggestions,
      total_acceptances: spec.total_acceptances,
      acceptance_rate: spec.total_suggestions > 0 ? Number((spec.total_acceptances / spec.total_suggestions).toFixed(2)) : 0,
      total_cost_usd: spec.monthly_cost_usd,
      model_usage_totals: {
        'claude-3-7-sonnet': Math.floor(spec.total_chats * 0.4),
        'gpt-4o': Math.floor(spec.total_chats * 0.3),
        'gemini-2-0-flash': Math.floor(spec.total_chats * 0.3),
      },
      daily_history: [
        {
          date: '2026-09-10',
          total_chats: Math.floor(spec.total_chats / 20),
          model_breakdown: { 'claude-3-7-sonnet': 5, 'gpt-4o': 5 },
          suggestions: Math.floor(spec.total_suggestions / 20),
          acceptances: Math.floor(spec.total_acceptances / 20),
          lines_suggested: Math.floor(totalLinesSuggested / 20),
          lines_accepted: Math.floor(totalLinesAccepted / 20),
          acceptance_rate: spec.total_suggestions > 0 ? Number((spec.total_acceptances / spec.total_suggestions).toFixed(2)) : 0,
          daily_cost_usd: Number((spec.monthly_cost_usd / 30).toFixed(2)),
        },
      ],
      tags: spec.tags,
    };
  });
}

/**
 * 確定的な ScopeAggregatedData を生成
 */
export function buildScopeAggregatedData(
  scopeKey: string,
  specs: TestUserSpec[] = TEST_USERS_MATRIX
): ScopeAggregatedData {
  const users = buildEnrichedUserSeats(specs);
  const profiles = buildUserUsageProfiles(specs);

  const activeSeats = users.filter((u) => u.status === 'active' || u.status === 'low_active').length;
  const idleSeats = users.filter((u) => u.status === 'idle' || u.status === 'never_used').length;
  const totalCost = users.reduce((sum, u) => sum + u.monthly_cost_usd, 0);
  const idleWaste = users.filter((u) => u.status === 'idle' || u.status === 'never_used').reduce((sum, u) => sum + u.monthly_cost_usd, 0);

  // Group rollups
  const byDept: Record<string, any> = {};
  const byCC: Record<string, any> = {};
  const byOrg: Record<string, any> = {};

  for (const u of users) {
    const deptKey = (u.department || '').trim() || 'Unassigned';
    const ccKey = (u.cost_center || '').trim() || 'Unassigned';
    const orgKey = (u.organization || '').trim() || 'Unassigned';

    [
      { map: byDept, key: deptKey },
      { map: byCC, key: ccKey },
      { map: byOrg, key: orgKey },
    ].forEach(({ map, key }) => {
      if (!map[key]) {
        map[key] = {
          group_name: key,
          total_seats: 0,
          active_seats: 0,
          idle_seats: 0,
          total_cost_usd: 0,
          potential_savings_usd: 0,
          active_ratio: 0,
          acceptance_rate: 0.35,
          total_suggestions: 0,
          total_acceptances: 0,
          total_chats: 0,
          total_pr_summaries: 0,
        };
      }
      map[key].total_seats += 1;
      if (u.status === 'active' || u.status === 'low_active') {
        map[key].active_seats += 1;
      } else {
        map[key].idle_seats += 1;
        map[key].potential_savings_usd += u.monthly_cost_usd;
      }
      map[key].total_cost_usd += u.monthly_cost_usd;
    });
  }

  // CostCenterBudgets
  const costCenterBudgets: CostCenterBudget[] = [
    {
      cost_center_id: 'FinTech-Division',
      cost_center_name: 'FinTech-Division',
      cost_center_code: 'CC-FIN-001',
      spending_limit_usd: 500,
      free_tier_budget_usd: 50,
      current_spend_usd: 195,
      net_billable_spend_usd: 145,
      remaining_budget_usd: 355,
      budget_utilization_percent: 39,
      status: 'normal',
    },
    {
      cost_center_id: 'Cloud-Platform',
      cost_center_name: 'Cloud-Platform',
      cost_center_code: 'CC-CLD-002',
      spending_limit_usd: 300,
      free_tier_budget_usd: 30,
      current_spend_usd: 78,
      net_billable_spend_usd: 48,
      remaining_budget_usd: 252,
      budget_utilization_percent: 26,
      status: 'normal',
    },
    {
      cost_center_id: 'Research-and-AI',
      cost_center_name: 'Research-and-AI',
      cost_center_code: 'CC-AI-003',
      spending_limit_usd: 400,
      free_tier_budget_usd: 50,
      current_spend_usd: 78,
      net_billable_spend_usd: 28,
      remaining_budget_usd: 372,
      budget_utilization_percent: 20,
      status: 'normal',
    },
    {
      cost_center_id: 'Enterprise-IT',
      cost_center_name: 'Enterprise-IT',
      cost_center_code: 'CC-IT-004',
      spending_limit_usd: 250,
      free_tier_budget_usd: 25,
      current_spend_usd: 78,
      net_billable_spend_usd: 53,
      remaining_budget_usd: 197,
      budget_utilization_percent: 31,
      status: 'normal',
    },
  ];

  return {
    scope_type: scopeKey.length === 7 ? 'monthly' : 'daily',
    scope_key: scopeKey,
    date_range: {
      start: scopeKey.length === 7 ? `${scopeKey}-01` : scopeKey,
      end: scopeKey.length === 7 ? `${scopeKey}-30` : scopeKey,
      days_count: scopeKey.length === 7 ? 30 : 1,
    },
    overview: {
      total_seats: users.length,
      active_users: activeSeats,
      idle_seats: idleSeats,
      active_ratio: users.length > 0 ? Number((activeSeats / users.length).toFixed(2)) : 0,
      total_spend_usd: totalCost,
      idle_waste_usd: idleWaste,
      overall_acceptance_rate: 0.35,
      total_suggestions: 10000,
      total_acceptances: 3500,
      total_chats: 1500,
      total_pr_summaries: 150,
      total_cli_commands: 50,
    },
    users,
    by_department: byDept,
    by_cost_center: byCC,
    by_organization: byOrg,
    cost_center_budgets: costCenterBudgets,
    user_profiles: profiles,
    daily_trends: [],
    top_languages: [],
  };
}

/**
 * 自動収集データの全選択パターンを網羅したテストデータセット一式を生成する
 */
export function createAutoCollectedTestDataset(): {
  indexMeta: IndexMetadata;
  monthlyScopes: Record<string, ScopeAggregatedData>;
  dailyScopes: Record<string, ScopeAggregatedData>;
  usersMatrix: TestUserSpec[];
  costCenters: EnterpriseCostCenter[];
  budgets: CostCenterBudget[];
} {
  // 複数月データ
  // 2026-09: フル13名
  const scope202609 = buildScopeAggregatedData('2026-09', TEST_USERS_MATRIX);
  // 2026-08: 11名 (U12, U13 参加前)
  const scope202608 = buildScopeAggregatedData('2026-08', TEST_USERS_MATRIX.slice(0, 11));
  // 2026-07: 8名 (初期コアメンバー)
  const scope202607 = buildScopeAggregatedData('2026-07', TEST_USERS_MATRIX.slice(0, 8));

  // 複数日データ
  // 2026-09-10: 最新日・平日通常
  const daily20260910 = buildScopeAggregatedData('2026-09-10', TEST_USERS_MATRIX);
  // 2026-09-09: 平日通常
  const daily20260909 = buildScopeAggregatedData('2026-09-09', TEST_USERS_MATRIX);
  // 2026-09-06: 週末・アクティブ数低減
  const weekendSpecs = TEST_USERS_MATRIX.map((s, idx) => ({
    ...s,
    status: idx % 3 === 0 ? ('active' as const) : ('low_active' as const),
  }));
  const daily20260906 = buildScopeAggregatedData('2026-09-06', weekendSpecs);

  const costCenters: EnterpriseCostCenter[] = [
    {
      id: 'cc-fin-1001',
      name: 'FinTech-Division',
      cost_center_code: 'COST-1001',
      resources: [{ type: 'Org', name: 'proud-fintech' }],
    },
    {
      id: 'cc-inf-2002',
      name: 'Cloud-Platform',
      cost_center_code: 'COST-2002',
      resources: [{ type: 'Org', name: 'proud-cloud-core' }],
    },
    {
      id: 'cc-ai-3003',
      name: 'Research-and-AI',
      cost_center_code: 'COST-3003',
      resources: [{ type: 'Org', name: 'proud-ai-labs' }],
    },
    {
      id: 'cc-ent-9009',
      name: 'Enterprise-IT',
      cost_center_code: 'COST-9009',
      resources: [{ type: 'Org', name: 'proud-internal-sys' }],
    },
  ];

  const indexMeta: IndexMetadata = {
    repository: {
      owner: 'proud-corp',
      name: 'github-copilot-dashboard',
      is_fork: false,
    },
    generated_at: '2026-09-10T12:00:00.000Z',
    data_retention_days: 365,
    is_mock_mode: true,
    available_months: ['2026-09', '2026-08', '2026-07'],
    all_recorded_months: ['2026-09', '2026-08', '2026-07'],
    available_days: ['2026-09-10', '2026-09-09', '2026-09-06'],
    available_reports: ['2026-09', '2026-08'],
    default_scopes: {
      latest_day: '2026-09-10',
      latest_month: '2026-09',
      latest_report: '2026-09',
      latest_range: {
        start: '2026-08-11',
        end: '2026-09-10',
      },
    },
    summary: {
      total_seats: 13,
      active_seats_30d: 9,
      idle_seats_30d: 4,
      total_monthly_spend_usd: 507,
      idle_waste_spend_usd: 156,
      total_ai_credits_used: 1250,
      total_ai_credits_cost_usd: 12.5,
      total_combined_cost_usd: 519.5,
    },
    issues: [],
  };

  return {
    indexMeta,
    monthlyScopes: {
      '2026-09': scope202609,
      '2026-08': scope202608,
      '2026-07': scope202607,
    },
    dailyScopes: {
      '2026-09-10': daily20260910,
      '2026-09-09': daily20260909,
      '2026-09-06': daily20260906,
    },
    usersMatrix: TEST_USERS_MATRIX,
    costCenters,
    budgets: scope202609.cost_center_budgets || [],
  };
}
