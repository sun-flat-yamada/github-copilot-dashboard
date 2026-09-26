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
}

export interface UserAttributeMappingDocumentV2 {
  schema_version: '2.0';
  generated_at: string;
  description?: string;
  mappings: UserAttributeMappingV2[];
}
