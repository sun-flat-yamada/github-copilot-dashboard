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

      let aiCreditsUsed = 0;
      if (rand < 0.7) {
        aiCreditsUsed = Math.floor(30 + Math.random() * 150);
      } else if (rand < 0.85) {
        aiCreditsUsed = Math.floor(Math.random() * 15);
      } else {
        aiCreditsUsed = 0;
      }

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
        ai_credits_used: aiCreditsUsed,
        prepaid: i % 10 === 0,
        billing_effective_date: createdAt.toISOString().slice(0, 10),
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
        copilot_ide_agent: {
          total_engaged_users: Math.floor(engagedUsers * 0.45),
          total_sessions: Math.floor((300 + Math.random() * 150) * activityFactor),
          total_user_messages: Math.floor((900 + Math.random() * 400) * activityFactor),
          totals_by_vscode_agent: [
            { agent_name: 'workspace', total_sessions: Math.floor(180 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.35), total_user_messages: Math.floor(500 * activityFactor) },
            { agent_name: 'terminal', total_sessions: Math.floor(80 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.2), total_user_messages: Math.floor(250 * activityFactor) },
          ],
          totals_by_custom_agent: [
            { agent_name: 'fintech-reviewer', total_sessions: Math.floor(40 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.15), total_user_messages: Math.floor(150 * activityFactor) },
          ],
          totals_by_mcp: [
            { server_name: 'postgres-context', total_invocations: Math.floor(50 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.12), success_rate: 0.98 },
            { server_name: 'github-ops', total_invocations: Math.floor(65 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.18), success_rate: 0.96 },
            { server_name: 'jira-tracker', total_invocations: Math.floor(30 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.08), success_rate: 0.94 },
          ],
          totals_by_skill: [
            { skill_name: 'test-generator', total_invocations: Math.floor(45 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.15) },
            { skill_name: 'sql-optimizer', total_invocations: Math.floor(30 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.1) },
            { skill_name: 'architecture-reviewer', total_invocations: Math.floor(20 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.08) },
          ],
          totals_by_slash_cmd: [
            { command: '/explain', total_invocations: Math.floor(120 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.25) },
            { command: '/fix', total_invocations: Math.floor(85 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.2) },
            { command: '/tests', total_invocations: Math.floor(60 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.16) },
          ],
          totals_by_plugin: [
            { plugin_id: 'plugin-gh-actions', plugin_name: 'github-actions-assistant', total_invocations: Math.floor(35 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.1) },
            { plugin_id: 'plugin-dockerfile', plugin_name: 'dockerfile-generator', total_invocations: Math.floor(25 * activityFactor), total_engaged_users: Math.floor(engagedUsers * 0.08) },
          ],
        },
        ai_credits: {
          total_used: Math.floor((350 + Math.random() * 200) * activityFactor),
          by_model: {
            'claude-3-7-sonnet': Math.floor((180 + Math.random() * 90) * activityFactor),
            'gpt-4o': Math.floor((90 + Math.random() * 40) * activityFactor),
            'o1': Math.floor((50 + Math.random() * 30) * activityFactor),
            'gemini-2-0-flash': Math.floor((30 + Math.random() * 20) * activityFactor),
          },
        },
        prs_created_by_agent: {
          total_prs_created_by_agent: Math.floor((12 + Math.random() * 8) * activityFactor),
          total_prs_merged_by_agent: Math.floor((9 + Math.random() * 6) * activityFactor),
          median_time_to_merge_hours: 4.5,
        },
        code_generation: {
          total_lines_added: Math.floor((4000 + Math.random() * 2000) * activityFactor),
          total_lines_deleted: Math.floor((1200 + Math.random() * 600) * activityFactor),
          by_mode: {
            agent_session: { lines_added: Math.floor(2500 * activityFactor), lines_deleted: Math.floor(700 * activityFactor) },
            inline_completion: { lines_added: Math.floor(1500 * activityFactor), lines_deleted: Math.floor(500 * activityFactor) },
          },
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

        let dayChats = Math.floor((5 + Math.random() * 25) * userActivityFactor);
        let claudeChats = Math.floor(dayChats * (0.45 + Math.random() * 0.2));
        let gpt4oChats = Math.floor((dayChats - claudeChats) * 0.5);
        let o1Chats = Math.floor((dayChats - claudeChats - gpt4oChats) * 0.6);
        let geminiChats = Math.max(0, dayChats - claudeChats - gpt4oChats - o1Chats);

        let daySuggestions = Math.floor((40 + Math.random() * 120) * userActivityFactor);
        let dayAcceptances = Math.floor(daySuggestions * (0.28 + Math.random() * 0.12));

        // ペルソナ別の特徴付け (非効率AI利用診断のリアルな兆候シミュレーション)
        if (login === 'kenji-sato') {
          // ペルソナ1: 生成ガチャ・受け身垂れ流し型 (大量提案だが受諾率8〜12%と極低)
          daySuggestions = Math.floor((90 + Math.random() * 60) * userActivityFactor);
          dayAcceptances = Math.floor(daySuggestions * (0.07 + Math.random() * 0.05));
        } else if (login === 'yuki-takahashi') {
          // ペルソナ2: 超重量級モデル過剰依存型 (o1が70%〜85%を占め、Gemini Flashが0)
          dayChats = Math.floor((12 + Math.random() * 15) * userActivityFactor);
          o1Chats = Math.floor(dayChats * (0.7 + Math.random() * 0.15));
          claudeChats = Math.floor((dayChats - o1Chats) * 0.8);
          gpt4oChats = Math.max(0, dayChats - o1Chats - claudeChats);
          geminiChats = 0;
        } else if (login === 'mika-ito') {
          // ペルソナ3: 文脈希薄・対話空回り型 (チャットが25〜35回と多いがコード受諾が僅少)
          dayChats = Math.floor((24 + Math.random() * 12) * userActivityFactor);
          claudeChats = Math.floor(dayChats * 0.5);
          gpt4oChats = Math.floor(dayChats * 0.3);
          o1Chats = Math.floor(dayChats * 0.1);
          geminiChats = Math.max(0, dayChats - claudeChats - gpt4oChats - o1Chats);
          daySuggestions = Math.floor((15 + Math.random() * 15) * userActivityFactor);
          dayAcceptances = Math.floor(daySuggestions * 0.2);
        } else if (login === 'taro-tanaka') {
          // ペルソナ4: 模範的・健全型 (受諾率38%、Gemini Flashも積極活用)
          daySuggestions = Math.floor((60 + Math.random() * 40) * userActivityFactor);
          dayAcceptances = Math.floor(daySuggestions * (0.35 + Math.random() * 0.08));
          geminiChats = Math.floor(dayChats * 0.35);
          gpt4oChats = Math.floor(dayChats * 0.3);
          claudeChats = Math.floor(dayChats * 0.25);
          o1Chats = Math.max(0, dayChats - geminiChats - gpt4oChats - claudeChats);
        }

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
      const aiCreditsUsed = seat.ai_credits_used ?? Math.floor(Math.random() * 80);

      // コホート比率: 40% Code First, 30% Agent First, 20% Multi-Agent, 10% 未設定
      const cohortRand = (profiles.length * 17) % 100;
      let adoptionPhase: 'no_cohort' | 'code_first' | 'agent_first' | 'multi_agent';
      if (cohortRand < 40) {
        adoptionPhase = 'code_first';
      } else if (cohortRand < 70) {
        adoptionPhase = 'agent_first';
      } else if (cohortRand < 90) {
        adoptionPhase = 'multi_agent';
      } else {
        adoptionPhase = 'no_cohort';
      }

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
        ai_credits_used_28d: aiCreditsUsed,
        ai_adoption_phase: adoptionPhase,
        total_agent_sessions: Math.floor(totalChats * 0.35),
        completed_agent_sessions: Math.floor(totalChats * 0.35 * 0.8),
        ai_credits_limit_monthly: 3900,
        agent_prs_created: Math.floor(totalChats * 0.05),
        agent_prs_unreviewed: 0,
        agent_pr_median_merge_mins: 45,
      });
    }

    return profiles;
  }

  /**
   * 2026年仕様に準拠したリアルな月次利用レポート CSV (Detailed Usage Report) を生成
   */
  public generateMonthlyUsageReportCSV(monthStr: string = '2026-08'): string {
    const lines: string[] = [
      'date,username,product,sku,model,quantity,unit_type,applied_cost_per_quantity,gross_amount,discount_amount,net_amount,organization,cost_center_name,ai_credits_consumed,token_count',
    ];

    const models = [
      { name: 'Claude 3.7 Sonnet', rate: 0.04 },
      { name: 'GPT-4o', rate: 0.03 },
      { name: 'o1', rate: 0.05 },
      { name: 'Gemini 2.0 Flash', rate: 0.02 },
    ];

    const users = [
      { login: 'taro-tanaka', org: 'proud-fintech', cc: 'FinTech-Division' },
      { login: 'hanako-suzuki', org: 'proud-ai-labs', cc: 'Research-and-AI' },
      { login: 'kenji-sato', org: 'proud-cloud-core', cc: 'Cloud-Platform' },
      { login: 'yuki-takahashi', org: 'proud-fintech', cc: 'FinTech-Division' },
      { login: 'mika-ito', org: 'proud-internal-sys', cc: 'Enterprise-IT' },
      { login: 'alex-partner', org: 'proud-fintech', cc: 'FinTech-Division' },
      { login: 'daiki-yamada', org: 'proud-cloud-core', cc: 'Cloud-Platform' },
      { login: 'yuki-tanaka', org: 'proud-fintech', cc: 'FinTech-Division' },
      { login: 'daiki-suzuki', org: 'proud-internal-sys', cc: 'IT-Infrastructure' },
      { login: 'sakura-watanabe', org: 'proud-internal-sys', cc: 'IT-Infrastructure' },
      { login: 'ren-takahashi', org: 'proud-marketing', cc: 'Data-AI-Lab' },
      { login: 'mei-ito', org: 'proud-marketing', cc: 'Data-AI-Lab' },
      { login: 'kaito-nakamura', org: 'proud-core-api', cc: 'IT-Infrastructure' },
      { login: 'aoi-kobayashi', org: 'proud-core-api', cc: 'IT-Infrastructure' },
      { login: 'external-contractor-01', org: 'proud-fintech', cc: 'FinTech-Division' },
      { login: 'external-contractor-02', org: 'proud-cloud-core', cc: 'Cloud-Platform' },
    ];

    // 月の日数 (例: 2026-08 は 31日)
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // 1. 各ユーザーの月額シート基本料金
    for (const u of users) {
      const isEnterprise = u.login.includes('sato') || u.login.includes('suzuki') || u.login.includes('takahashi');
      const sku = isEnterprise ? 'copilot_enterprise' : 'copilot_business';
      const cost = isEnterprise ? 39.0 : 19.0;
      lines.push(
        `${monthStr}-01,${u.login},copilot,${sku},,1,seats,${cost.toFixed(2)},${cost.toFixed(2)},0.00,${cost.toFixed(2)},${u.org},${u.cc},0,0`
      );
    }

    // 2. 日別のマルチモデル従量リクエスト
    for (let day = 1; day <= Math.min(daysInMonth, 28); day++) {
      const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`;
      // 土日スキップ判定
      const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (const u of users) {
        // ユーザーごとにランダムにモデル利用レコードを追加
        const rand = (day * 7 + u.login.length) % 10;
        if (rand < 2) continue; // たまに使わない日

        const modelChoice = models[(day + u.login.length) % models.length];
        const reqCount = 5 + ((day * 3 + u.login.length * 2) % 25);
        const gross = Number((reqCount * modelChoice.rate).toFixed(4));
        const discount = day % 5 === 0 ? Number((gross * 0.1).toFixed(4)) : 0;
        const net = Number((gross - discount).toFixed(4));
        const credits = Math.floor(reqCount * 0.5);
        const tokens = reqCount * 320;

        lines.push(
          `${dateStr},${u.login},copilot,copilot_premium_request,"${modelChoice.name}",${reqCount},requests,${modelChoice.rate.toFixed(4)},${gross.toFixed(4)},${discount.toFixed(4)},${net.toFixed(4)},${u.org},${u.cc},${credits},${tokens}`
        );
      }
    }

    return lines.join('\n');
  }
}

