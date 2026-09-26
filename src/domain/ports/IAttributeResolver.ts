import { UserAttributeMapping } from '../entities/copilot.js';
import { UserAttributeMappingV2 } from '../entities/user-mapping.js';

/**
 * Port interface for resolving internal organizational attributes for GitHub logins.
 * Implemented by: AttributeResolverAdapter, DemoAttributeResolver
 */
export interface IAttributeResolver {
  resolve(login: string): UserAttributeMapping | UserAttributeMappingV2 | undefined;
  resolveAll(logins: string[]): Map<string, UserAttributeMapping | UserAttributeMappingV2>;
  getMappingCount(): number;
}
