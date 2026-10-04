/**
 * User Attribute Mapping Entities (v2.0 Schema)
 * Multi-dimensional team/project assignment, AI credits quota, and adoption targeting.
 */

import { AdoptionPhase } from './agent-metrics.js';

export interface UserAttributeMappingV2 {
  github_user: string;
  display_name: string;
  department: string;
  cost_center_override?: string;
  teams?: string[];
  projects?: string[];
  role?: string;
  notes?: string;
  tags?: string[];
  ai_credits_limit_monthly?: number;
  ai_credits_alert_threshold?: number;
  target_adoption_phase?: AdoptionPhase;
  target_acceptance_rate?: number;
  /** 実効期間の開始日 (YYYY-MM-DD, 当日を含む)。省略時は開始の制限なし (SCD Type 2) */
  valid_from?: string;
  /** 実効期間の終了日 (YYYY-MM-DD, 当日を含む)。省略時は無期限 */
  valid_to?: string;
}

export interface UserAttributeMappingDocumentV2 {
  schema_version: '2.0';
  generated_at: string;
  description?: string;
  mappings: UserAttributeMappingV2[];
}
