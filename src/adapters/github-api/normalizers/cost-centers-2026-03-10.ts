import { EnterpriseCostCenterRawSchema } from '../schemas/cost-centers-schema.js';
import { CostCenterResource, EnterpriseCostCenter } from '../../../domain/entities/copilot.js';

/**
 * API の resources[].type 表記ゆれ (Repo / Repository, Org / Organization など) を
 * ドメインの種別 ('Org' | 'User' | 'Repository') へ寄せる。未知の種別はそのまま保持する。
 */
export function normalizeCostCenterResourceType(type: string): CostCenterResource['type'] {
  switch (type.trim().toLowerCase()) {
    case 'org':
    case 'organization':
      return 'Org';
    case 'user':
      return 'User';
    case 'repo':
    case 'repository':
      return 'Repository';
    default:
      return type;
  }
}

/**
 * 1 レコードを正規化する。検証に失敗した場合は ZodError を投げる (呼び出し側がレコード単位で隔離する)。
 * 削除済み (state = deleted) の Cost Center は null を返し、配賦の対象から外す。
 */
export function normalizeCostCenter20260310(raw: unknown): EnterpriseCostCenter | null {
  const parsed = EnterpriseCostCenterRawSchema.parse(raw);
  if (parsed.state?.trim().toLowerCase() === 'deleted') {
    return null;
  }
  return {
    id: parsed.id,
    name: parsed.name,
    cost_center_code: parsed.cost_center_code ?? '',
    resources: parsed.resources.map((r) => ({
      type: normalizeCostCenterResourceType(r.type),
      name: r.name,
    })),
  };
}
