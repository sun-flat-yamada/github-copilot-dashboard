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

  static toEnterpriseCostCenter(raw: any): EnterpriseCostCenter {
    return {
      id: raw.id,
      name: raw.name,
      cost_center_code: raw.cost_center_code,
      resources: raw.resources || [],
    };
  }
}
