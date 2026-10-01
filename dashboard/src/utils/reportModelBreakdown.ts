import { ReportModelBreakdown, ReportUserDetail } from '../../../src/types/copilot';

/**
 * 絞り込み後のユーザー明細から、モデル別利用内訳 (ReportModelBreakdown[]) を再集計する純粋関数。
 *
 * ユーザー明細にモデル別のリクエスト数・費用 (model_requests / model_spend_usd) が保持されている場合は、
 * それを合算して正確に再集計する。保持されていない旧形式の月次レポートでは、各ユーザーの
 * total_requests / total_spend_usd を primary_model へ全量計上する近似値になる。
 *
 * タグ未選択時 (全ユーザー) は呼び出し元で元の model_breakdown (パース時点の正確な集計値) を
 * そのまま使用し、絞り込み時のみ本関数による再集計値へ差し替えること。
 */
export function buildFilteredModelBreakdown(users: ReportUserDetail[]): ReportModelBreakdown[] {
  const modelMap = new Map<string, { requests: number; spend: number; users: Set<string> }>();

  const add = (name: string, requests: number, spend: number, login: string) => {
    const entry = modelMap.get(name) || { requests: 0, spend: 0, users: new Set<string>() };
    entry.requests += requests;
    entry.spend += spend;
    entry.users.add(login);
    modelMap.set(name, entry);
  };

  for (const u of users) {
    const requestsByModel = u.model_requests;
    const spendByModel = u.model_spend_usd;
    if (requestsByModel || spendByModel) {
      // 正確な再集計: ユーザーが使ったモデルごとのリクエスト数・費用を合算する
      const names = new Set([...Object.keys(requestsByModel ?? {}), ...Object.keys(spendByModel ?? {})]);
      for (const name of names) {
        add(name, requestsByModel?.[name] ?? 0, spendByModel?.[name] ?? 0, u.login);
      }
    } else {
      // 旧形式 (モデル別の内訳なし): 主要モデルへの全量計上による近似
      add(u.primary_model || 'None', u.total_requests, u.total_spend_usd, u.login);
    }
  }

  const totalRequests = Array.from(modelMap.values()).reduce((sum, m) => sum + m.requests, 0);
  const totalSpend = Array.from(modelMap.values()).reduce((sum, m) => sum + m.spend, 0);

  return Array.from(modelMap.entries())
    .map(([model_name, stat]) => ({
      model_name,
      total_requests: stat.requests,
      total_spend_usd: Number(stat.spend.toFixed(2)),
      active_users: stat.users.size,
      percentage:
        totalRequests > 0
          ? Number(((stat.requests / totalRequests) * 100).toFixed(1))
          : totalSpend > 0
          ? Number(((stat.spend / totalSpend) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.total_requests - a.total_requests || b.total_spend_usd - a.total_spend_usd);
}
