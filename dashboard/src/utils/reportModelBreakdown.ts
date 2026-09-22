import { ReportModelBreakdown, ReportUserDetail } from '../../../src/types/copilot';

/**
 * タグ絞り込み後のユーザー明細から、モデル別利用内訳 (ReportModelBreakdown[]) を再集計する純粋関数。
 *
 * Monthly Report のユーザー明細 (ReportUserDetail) にはユーザーごとの主要モデル (primary_model) の
 * みが保持されており、モデル別の詳細なリクエスト数は保持されない。そのため、各ユーザーの
 * total_requests / total_spend_usd を primary_model へ全量按分計上する近似値として算出する
 * (deepAnalysisAdapter.ts の adaptReportToProfiles と同様の近似方針)。
 *
 * タグ未選択時 (全ユーザー) は呼び出し元で元の model_breakdown (パース時点の正確な集計値) を
 * そのまま使用し、タグ選択時のみ本関数による再集計値へ差し替えること。
 */
export function buildFilteredModelBreakdown(users: ReportUserDetail[]): ReportModelBreakdown[] {
  const totalRequests = users.reduce((sum, u) => sum + u.total_requests, 0);
  const modelMap = new Map<string, { requests: number; spend: number; users: Set<string> }>();

  for (const u of users) {
    const name = u.primary_model || 'None';
    const entry = modelMap.get(name) || { requests: 0, spend: 0, users: new Set<string>() };
    entry.requests += u.total_requests;
    entry.spend += u.total_spend_usd;
    entry.users.add(u.login);
    modelMap.set(name, entry);
  }

  return Array.from(modelMap.entries())
    .map(([model_name, stat]) => ({
      model_name,
      total_requests: stat.requests,
      total_spend_usd: Number(stat.spend.toFixed(2)),
      active_users: stat.users.size,
      percentage: totalRequests > 0 ? Number(((stat.requests / totalRequests) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.total_requests - a.total_requests);
}
