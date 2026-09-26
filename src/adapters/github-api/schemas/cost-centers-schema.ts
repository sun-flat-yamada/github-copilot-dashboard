import { z } from 'zod';

export const CostCenterResourceSchema = z.object({
  type: z.enum(['Org', 'User', 'Repository']),
  name: z.string(),
}).passthrough();

export const EnterpriseCostCenterRawSchema = z.object({
  id: z.string(),
  name: z.string(),
  cost_center_code: z.string(),
  resources: z.array(CostCenterResourceSchema).optional().default([]),
}).passthrough();

export type EnterpriseCostCenterRaw = z.infer<typeof EnterpriseCostCenterRawSchema>;
