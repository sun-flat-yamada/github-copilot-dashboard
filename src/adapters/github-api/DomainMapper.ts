import {
  CopilotDailyMetrics,
  CopilotSeatAssignment,
  EnterpriseCostCenter,
} from '../../domain/entities/copilot.js';

export class DomainMapper {
  static toDailyMetrics(normalized: CopilotDailyMetrics): CopilotDailyMetrics {
    return normalized;
  }

  static toSeatAssignment(normalized: CopilotSeatAssignment): CopilotSeatAssignment {
    return normalized;
  }

  /**
   * 正規化済み (normalizers/cost-centers-*.ts) の Cost Center をドメイン型へ写像する。
   * API の表記ゆれ (costCenters / cost_centers, Repo / Repository 等) は正規化層で吸収済み。
   */
  static toEnterpriseCostCenter(normalized: EnterpriseCostCenter): EnterpriseCostCenter {
    return {
      id: normalized.id,
      name: normalized.name,
      cost_center_code: normalized.cost_center_code,
      resources: normalized.resources ?? [],
    };
  }
}
