import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  CostCenterBudget,
  EnterpriseCostCenter,
  UserAttributeMapping,
  UserModelDailyUsage,
  UserUsageProfile,
} from '../types/copilot.js';

export interface MockDataBundle {
  metrics: CopilotDailyMetrics[];
  seats: CopilotSeatAssignment[];
  costCenters: EnterpriseCostCenter[];
  sampleUserMappings: UserAttributeMapping[];
  costCenterBudgets: CostCenterBudget[];
  userProfiles: UserUsageProfile[];
}

export class MockDataGenerator {
  private baseDate: Date;

  constructor(baseDateStr: string = '2026-09-10') {
    this.baseDate = new Date(baseDateStr);
  }

  /**
   * 2026年最新仕様に完全準拠したモックデータセット一式を生成
   */
  public generateBundle(days: number = 30, seatCount: number = 85): MockDataBundle {
    const costCenters = this.generateCostCenters();
    const sampleUserMappings = this.generateSampleUserMappings();
    const seats = this.generateSeats(seatCount, sampleUserMappings);
    const metrics = this.generateDailyMetrics(days, seatCount);
    const costCenterBudgets = this.generateCostCenterBudgets(costCenters, seats);
    const userProfiles = this.generateUserUsageProfiles(seats, sampleUserMappings, days);

    return {
      metrics,
      seats,
      costCenters,
      sampleUserMappings,
      costCenterBudgets,
      userProfiles,
    };
  }

  private generateCostCenters(): EnterpriseCostCenter[] {
    return [
      {
        id: 'cc-fin-1001',
        name: 'FinTech-Division',
        cost_center_code: 'COST-1001',
        resources: [
          { type: 'Org', name: 'proud-fintech' },
          { type: 'User', name: 'kenji-sato' },
        ],
      },
      {
        id: 'cc-inf-2002',
        name: 'Cloud-Platform',
        cost_center_code: 'COST-2002',
        resources: [
          { type: 'Org', name: 'proud-cloud-core' },
          { type: 'User', name: 'yuki-takahashi' },
        ],
      },
      {
        id: 'cc-ai-3003',
        name: 'Research-and-AI',
        cost_center_code: 'COST-3003',
        resources: [
          { type: 'Org', name: 'proud-ai-labs' },
          { type: 'User', name: 'mika-ito' },
        ],
      },
      {
        id: 'cc-ent-9009',
        name: 'Enterprise-IT',
        cost_center_code: 'COST-9009',
        resources: [
          { type: 'Org', name: 'proud-internal-sys' },
        ],
      },
    ];
  }

  private generateSampleUserMappings(): UserAttributeMapping[] {
    return [
      {
        github_user: 'taro-tanaka',
        display_name: '田中 太郎',
        department: 'コア決済基盤チーム',
        cost_center_override: 'FinTech-Division',
        notes: 'リードエンジニア / 正社員',
      },
      {
        github_user: 'hanako-suzuki',
        display_name: '鈴木 花子',
        department: 'LLM応用プロダクトG',
        cost_center_override: 'Research-and-AI',
        notes: 'AIリサーチャー',
      },
      {
        github_user: 'kenji-sato',
        display_name: '佐藤 健二',
        department: 'SRE & クラウド基盤部',
        cost_center_override: 'Cloud-Platform',
        notes: 'インフラSRE',
      },
      {
        github_user: 'yuki-takahashi',
        display_name: '高橋 悠希',
        department: 'モバイルアプリ開発部',
        notes: 'iOS / Android Lead',
      },
      {
        github_user: 'mika-ito',
        display_name: '伊藤 美香',
        department: '業務システム改革推進室',
        cost_center_override: 'Enterprise-IT',
        notes: '社内DX担当',
      },
      {
        github_user: 'alex-partner',
        display_name: 'Alex Rivera (Partner)',
        department: 'コア決済基盤チーム',
        cost_center_override: 'FinTech-Division',
        notes: '業務委託パートナー',
      },
      {
        github_user: 'daiki-yamada',
        display_name: '山田 大樹',
        department: 'SRE & クラウド基盤部',
        cost_center_override: 'Cloud-Platform',
        notes: 'Kubernetes Platformer',
      },
    ];
  }

  private generateSeats(count: number, mappings: UserAttributeMapping[]): CopilotSeatAssignment[] {
    const orgs = [
      { login: 'proud-fintech', id: 101 },
      { login: 'proud-cloud-core', id: 102 },
      { login: 'proud-ai-labs', id: 103 },
    ];

    const editors = [
      'vscode/1.112.0/copilot/1.255.0',
      'jetbrains/2026.2/copilot/1.95.0',
      'visualstudio/2026/copilot/1.30.0',
      'neovim/0.11.0/copilot.lua',
    ];

    const seats: CopilotSeatAssignment[] = [];

    for (let i = 0; i < count; i++) {
      let login: string;
      if (i < mappings.length) {
        login = mappings[i].github_user;
      } else {
        login = `developer-${i + 1}`;
      }

      const org = orgs[i % orgs.length];
      const planType = i % 5 === 0 ? 'business' : 'enterprise'; // 80% Enterprise, 20% Business

      // アクティビティ状態の分布:
      // 70%: 直近14日以内 (Active)
      // 15%: 15〜30日以内 (Low Active)
      // 10%: 31〜60日以内 (Idle: 遊休)
      // 5%: 未利用 (Never Used)
      const rand = Math.random();
      let lastActivityDate: Date | null = null;
      let lastEditor: string | null = editors[i % editors.length];

      if (rand < 0.7) {
        // 0〜13日前
        const daysAgo = Math.floor(Math.random() * 14);
        lastActivityDate = new Date(this.baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      } else if (rand < 0.85) {
        // 15〜29日前
        const daysAgo = 15 + Math.floor(Math.random() * 15);
        lastActivityDate = new Date(this.baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      } else if (rand < 0.95) {
        // 31〜60日前 (遊休)
        const daysAgo = 31 + Math.floor(Math.random() * 30);
        lastActivityDate = new Date(this.baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      } else {
        // 未利用
        lastActivityDate = null;
        lastEditor = null;
      }

      // シート作成日 (過去3ヶ月〜半年前)
      const createdDaysAgo = 60 + Math.floor(Math.random() * 120);
      const createdAt = new Date(this.baseDate.getTime() - createdDaysAgo * 24 * 60 * 60 * 1000);

      seats.push({
        assignee: {
          login,
          id: 20000 + i,
          avatar_url: `https://avatars.githubusercontent.com/u/${20000 + i}?v=4`,
          html_url: `https://github.com/${login}`,
          type: 'User',
        },
        plan_type: planType,
        created_at: createdAt.toISOString(),
        updated_at: createdAt.toISOString(),
        pending_cancellation_date: null,
        last_activity_at: lastActivityDate ? lastActivityDate.toISOString() : null,
        last_activity_editor: lastEditor,
        organization: org,
        assigning_team: {
          id: 300 + (i % 6),
          name: `Team-${(i % 6) + 1}`,
          slug: `team-${(i % 6) + 1}`,
        },
      });
    }

    return seats;
  }

  private generateDailyMetrics(days: number, seatCount: number): CopilotDailyMetrics[] {
    const metrics: CopilotDailyMetrics[] = [];

    for (let d = days - 1; d >= 0; d--) {
      const dateObj = new Date(this.baseDate.getTime() - d * 24 * 60 * 60 * 1000);
      const dateStr = dateObj.toISOString().split('T')[0];

      // 土日は利用量が低下する傾向
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const activityFactor = isWeekend ? 0.25 : 1.0;

      const activeUsers = Math.floor((seatCount * (0.65 + Math.random() * 0.15)) * activityFactor);
      const engagedUsers = Math.floor(activeUsers * 0.88);

      const tsSuggestions = Math.floor((8000 + Math.random() * 4000) * activityFactor);
      const tsAcceptances = Math.floor(tsSuggestions * (0.28 + Math.random() * 0.08));

      const pySuggestions = Math.floor((6000 + Math.random() * 3000) * activityFactor);
      const pyAcceptances = Math.floor(pySuggestions * (0.32 + Math.random() * 0.08));

      const goSuggestions = Math.floor((3500 + Math.random() * 2000) * activityFactor);
      const goAcceptances = Math.floor(goSuggestions * (0.35 + Math.random() * 0.06));

      const rustSuggestions = Math.floor((2000 + Math.random() * 1200) * activityFactor);
      const rustAcceptances = Math.floor(rustSuggestions * (0.30 + Math.random() * 0.07));

      const totalChats = Math.floor((1200 + Math.random() * 600) * activityFactor);

      metrics.push({
        date: dateStr,
        total_active_users: activeUsers,
        total_engaged_users: engagedUsers,
        copilot_ide_code_completions: {
          total_engaged_users: Math.floor(engagedUsers * 0.95),
          languages: [
            {
              name: 'typescript',
              total_engaged_users: Math.floor(engagedUsers * 0.65),
              total_code_suggestions: tsSuggestions,
              total_code_acceptances: tsAcceptances,
              total_code_lines_suggested: tsSuggestions * 7,
              total_code_lines_accepted: tsAcceptances * 6,
            },
            {
              name: 'python',
              total_engaged_users: Math.floor(engagedUsers * 0.5),
              total_code_suggestions: pySuggestions,
              total_code_acceptances: pyAcceptances,
              total_code_lines_suggested: pySuggestions * 6,
              total_code_lines_accepted: pyAcceptances * 5,
            },
            {
              name: 'go',
              total_engaged_users: Math.floor(engagedUsers * 0.3),
              total_code_suggestions: goSuggestions,
              total_code_acceptances: goAcceptances,
              total_code_lines_suggested: goSuggestions * 8,
              total_code_lines_accepted: goAcceptances * 7,
            },
            {
              name: 'rust',
              total_engaged_users: Math.floor(engagedUsers * 0.2),
              total_code_suggestions: rustSuggestions,
              total_code_acceptances: rustAcceptances,
              total_code_lines_suggested: rustSuggestions * 9,
              total_code_lines_accepted: rustAcceptances * 8,
            },
          ],
          editors: [
            { name: 'vscode', total_engaged_users: Math.floor(engagedUsers * 0.72) },
            { name: 'jetbrains', total_engaged_users: Math.floor(engagedUsers * 0.20) },
            { name: 'neovim', total_engaged_users: Math.floor(engagedUsers * 0.08) },
          ],
        },
        copilot_ide_chat: {
          total_engaged_users: Math.floor(engagedUsers * 0.78),
          total_chats: totalChats,
          total_chat_copy_events: Math.floor(totalChats * 0.25),
          total_chat_insertion_events: Math.floor(totalChats * 0.38),
          models: [
            { name: 'claude-3-7-sonnet', total_chats: Math.floor(totalChats * 0.58) },
            { name: 'gpt-4o', total_chats: Math.floor(totalChats * 0.28) },
            { name: 'o1', total_chats: Math.floor(totalChats * 0.14) },
          ],
        },
        copilot_dotcom_chat: {
          total_engaged_users: Math.floor(engagedUsers * 0.3),
          total_chats: Math.floor(totalChats * 0.18),
        },
        copilot_dotcom_pull_requests: {
          total_engaged_users: Math.floor(engagedUsers * 0.45),
          total_pr_summaries_created: Math.floor((40 + Math.random() * 30) * activityFactor),
        },
        copilot_in_cli: {
          total_engaged_users: Math.floor(engagedUsers * 0.22),
          total_cli_completions: Math.floor((150 + Math.random() * 100) * activityFactor),
        },
      });
    }

    return metrics;
  }

  /**
   * Cost CenterごとのBudget（上限額・無料額・現在使用額・残余額）を生成
   */
  private generateCostCenterBudgets(
    costCenters: EnterpriseCostCenter[],
    seats: CopilotSeatAssignment[]
  ): CostCenterBudget[] {
    const budgetConfigs: Record<string, { limit: number; free: number }> = {
      'cc-fin-1001': { limit: 2500, free: 300 },
      'cc-inf-2002': { limit: 3000, free: 400 },
      'cc-ai-3003': { limit: 2000, free: 200 },
      'cc-ent-9009': { limit: 1200, free: 150 },
    };

    return costCenters.map((cc) => {
      const cfg = budgetConfigs[cc.id] || { limit: 1500, free: 200 };
      // 該当Cost Centerのシート数を概算
      const seatCount = seats.filter((s) => s.organization.login === cc.resources[0]?.name).length || 15;
      const currentSpend = seatCount * 39 + Math.floor(Math.random() * 300);
      const netBillable = Math.max(0, currentSpend - cfg.free);
      const remaining = Math.max(0, cfg.limit - netBillable);
      const utilPercent = Number(((netBillable / cfg.limit) * 100).toFixed(1));

      let status: CostCenterBudget['status'] = 'normal';
      if (utilPercent >= 100) {
        status = 'exceeded';
      } else if (utilPercent >= 80) {
        status = 'warning';
      }

      return {
        cost_center_id: cc.id,
        cost_center_name: cc.name,
        cost_center_code: cc.cost_center_code,
        spending_limit_usd: cfg.limit,
        free_tier_budget_usd: cfg.free,
        current_spend_usd: currentSpend,
        net_billable_spend_usd: netBillable,
        remaining_budget_usd: remaining,
        budget_utilization_percent: utilPercent,
        status,
      };
    });
  }

  /**
   * 各ユーザーの過去N日間の日次利用履歴（モデル種類別内訳含む）を生成
   */
  private generateUserUsageProfiles(
    seats: CopilotSeatAssignment[],
    mappings: UserAttributeMapping[],
    days: number
  ): UserUsageProfile[] {
    const mappingMap = new Map(mappings.map((m) => [m.github_user.toLowerCase(), m]));
    const profiles: UserUsageProfile[] = [];

    for (const seat of seats) {
      const login = seat.assignee.login;
      const mapped = mappingMap.get(login.toLowerCase());
      const displayName = mapped?.display_name || login;
      const department = mapped?.department || '未分類 (Unassigned)';
      const costCenter = mapped?.cost_center_override || 'Default-CostCenter';

      const dailyHistory: UserModelDailyUsage[] = [];
      let totalChats = 0;
      let totalSuggestions = 0;
      let totalAcceptances = 0;
      const modelTotals: Record<string, number> = {
        'claude-3-7-sonnet': 0,
        'gpt-4o': 0,
        'o1': 0,
        'gemini-2-0-flash': 0,
      };

      const hasActivity = seat.last_activity_at !== null;
      const userActivityFactor = hasActivity ? (0.4 + Math.random() * 0.6) : 0;

      for (let d = days - 1; d >= 0; d--) {
        const dateObj = new Date(this.baseDate.getTime() - d * 24 * 60 * 60 * 1000);
        const dateStr = dateObj.toISOString().split('T')[0];
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

        if (userActivityFactor === 0 || (isWeekend && Math.random() > 0.15)) {
          dailyHistory.push({
            date: dateStr,
            total_chats: 0,
            model_breakdown: { 'claude-3-7-sonnet': 0, 'gpt-4o': 0, 'o1': 0, 'gemini-2-0-flash': 0 },
            suggestions: 0,
            acceptances: 0,
            lines_suggested: 0,
            lines_accepted: 0,
            acceptance_rate: 0,
            daily_cost_usd: Number((seat.plan_type === 'enterprise' ? 1.3 : 0.63).toFixed(2)),
          });
          continue;
        }

        const dayChats = Math.floor((5 + Math.random() * 25) * userActivityFactor);
        const claudeChats = Math.floor(dayChats * (0.45 + Math.random() * 0.2));
        const gpt4oChats = Math.floor((dayChats - claudeChats) * 0.5);
        const o1Chats = Math.floor((dayChats - claudeChats - gpt4oChats) * 0.6);
        const geminiChats = Math.max(0, dayChats - claudeChats - gpt4oChats - o1Chats);

        const modelBreakdown: Record<string, number> = {
          'claude-3-7-sonnet': claudeChats,
          'gpt-4o': gpt4oChats,
          'o1': o1Chats,
          'gemini-2-0-flash': geminiChats,
        };

        modelTotals['claude-3-7-sonnet'] += claudeChats;
        modelTotals['gpt-4o'] += gpt4oChats;
        modelTotals['o1'] += o1Chats;
        modelTotals['gemini-2-0-flash'] += geminiChats;
        totalChats += dayChats;

        const daySuggestions = Math.floor((40 + Math.random() * 120) * userActivityFactor);
        const dayAcceptances = Math.floor(daySuggestions * (0.28 + Math.random() * 0.12));
        const dayRate = daySuggestions > 0 ? Number((dayAcceptances / daySuggestions).toFixed(4)) : 0;

        totalSuggestions += daySuggestions;
        totalAcceptances += dayAcceptances;

        dailyHistory.push({
          date: dateStr,
          total_chats: dayChats,
          model_breakdown: modelBreakdown,
          suggestions: daySuggestions,
          acceptances: dayAcceptances,
          lines_suggested: daySuggestions * 7,
          lines_accepted: dayAcceptances * 6,
          acceptance_rate: dayRate,
          daily_cost_usd: Number((seat.plan_type === 'enterprise' ? 1.3 : 0.63).toFixed(2)),
        });
      }

      const overallRate = totalSuggestions > 0 ? Number((totalAcceptances / totalSuggestions).toFixed(4)) : 0;
      const totalCost = seat.plan_type === 'enterprise' ? 39 : 19;

      profiles.push({
        login,
        display_name: displayName,
        avatar_url: seat.assignee.avatar_url,
        department,
        cost_center: costCenter,
        organization: seat.organization.login,
        plan_type: seat.plan_type,
        total_chats: totalChats,
        total_suggestions: totalSuggestions,
        total_acceptances: totalAcceptances,
        acceptance_rate: overallRate,
        total_cost_usd: totalCost,
        model_usage_totals: modelTotals,
        daily_history: dailyHistory,
      });
    }

    return profiles;
  }
}
