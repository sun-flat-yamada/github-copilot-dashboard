import { IAttributeResolver } from '../../domain/ports/IAttributeResolver.js';
import { UserAttributeMapping } from '../../domain/entities/copilot.js';
import { UserAttributeMappingV2 } from '../../domain/entities/user-mapping.js';
import { AttributeResolver } from '../../collector/attribute-resolver.js';

export class AttributeResolverAdapter implements IAttributeResolver {
  private resolver: AttributeResolver;
  private mappings = new Map<string, UserAttributeMapping | UserAttributeMappingV2>();
  private isAnonymize: boolean = false;

  constructor(rawConfig?: string, anonymize: boolean = false) {
    this.isAnonymize = anonymize || process.env.ANONYMIZE_USERS === 'true';
    this.resolver = new AttributeResolver(rawConfig, this.isAnonymize);
    this.initCustomMappings(rawConfig);
  }

  private initCustomMappings(rawConfig?: string): void {
    const configStr = rawConfig || process.env.COPILOT_USER_MAPPING || process.env.COPILOT_USER_MAPPING_BASE64;
    if (!configStr) return;

    let raw = configStr.trim();
    if (raw.startsWith('[') || raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed.mappings || [parsed];
        for (const item of list) {
          if (item && item.github_user) {
            this.mappings.set(item.github_user.toLowerCase(), item);
          }
        }
      } catch {
        // handled by fallback
      }
    }
  }

  resolve(login: string): UserAttributeMapping | UserAttributeMappingV2 | undefined {
    const key = login.toLowerCase();
    const v2 = this.mappings.get(key);
    if (v2) {
      if (this.isAnonymize) {
        const hash = this.simpleHash(login);
        const anonymizedLogin = `dev_${hash.substring(0, 8)}`;
        const anonymizedDisplayName = `User-${hash.substring(0, 6)}`;
        const dept = v2.department && v2.department !== '未分類 (Unassigned)'
          ? `Group-${this.simpleHash(v2.department).substring(0, 4)}`
          : v2.department;

        const v2Obj = v2 as UserAttributeMappingV2;
        const teams = v2Obj.teams?.map((t) => `Team-${this.simpleHash(t).substring(0, 4)}`);
        const projects = v2Obj.projects?.map((p) => `Project-${this.simpleHash(p).substring(0, 4)}`);

        return {
          ...v2,
          github_user: anonymizedLogin,
          display_name: anonymizedDisplayName,
          department: dept,
          teams,
          projects,
        };
      }
      return v2;
    }

    const resolved = this.resolver.resolve(login);
    return {
      github_user: resolved.login,
      display_name: resolved.displayName,
      department: resolved.department,
      cost_center_override: resolved.costCenterOverride,
      notes: resolved.notes,
      tags: resolved.tags,
    };
  }

  resolveAll(logins: string[]): Map<string, UserAttributeMapping | UserAttributeMappingV2> {
    const map = new Map<string, UserAttributeMapping | UserAttributeMappingV2>();
    for (const login of logins) {
      const attr = this.resolve(login);
      if (attr) {
        map.set(login.toLowerCase(), attr);
      }
    }
    return map;
  }

  getMappingCount(): number {
    return Math.max(this.mappings.size, this.resolver.getMappingCount());
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
