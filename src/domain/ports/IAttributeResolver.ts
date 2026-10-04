import { UserAttributeMapping } from '../entities/copilot.js';
import { UserAttributeMappingV2 } from '../entities/user-mapping.js';

/**
 * Port interface for resolving internal organizational attributes for GitHub logins.
 * Implemented by: AttributeResolverAdapter, DemoAttributeResolver
 */
export interface IAttributeResolver {
  /** asOf: 属性を決める時点 (YYYY-MM-DD または YYYY-MM)。実効期間付きマッピングで使う。省略時は現行 */
  resolve(login: string, asOf?: string): UserAttributeMapping | UserAttributeMappingV2 | undefined;
  resolveAll(logins: string[], asOf?: string): Map<string, UserAttributeMapping | UserAttributeMappingV2>;
  getMappingCount(): number;
}
