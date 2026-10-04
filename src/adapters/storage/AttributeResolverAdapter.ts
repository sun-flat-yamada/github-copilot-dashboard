import { IAttributeResolver } from '../../domain/ports/IAttributeResolver.js';
import { UserAttributeMapping } from '../../domain/entities/copilot.js';
import { UserAttributeMappingV2 } from '../../domain/entities/user-mapping.js';
import { AttributeResolver, AttributeResolverOptions } from '../../collector/attribute-resolver.js';
import { Pseudonymizer } from '../../collector/pseudonymizer.js';
import { selectEffectiveEntry } from '../../collector/mapping-periods.js';

export class AttributeResolverAdapter implements IAttributeResolver {
  private resolver: AttributeResolver;
  private mappings = new Map<string, (UserAttributeMapping | UserAttributeMappingV2)[]>();
  private isAnonymize: boolean = false;
  private pseudonymizer: Pseudonymizer | null = null;

  /**
   * @param anonymize 匿名化 (仮名化) モード。環境変数 ANONYMIZE_USERS=true でも有効になる。
   *                  有効なときは秘密鍵 (ANONYMIZE_SECRET) が必須 (無い場合は例外)。
   *                  匿名化の方式は AttributeResolver と同じ (Pseudonymizer: HMAC-SHA256)。
   */
  constructor(rawConfig?: string, anonymize: boolean = false, options: AttributeResolverOptions = {}) {
    this.isAnonymize = anonymize || process.env.ANONYMIZE_USERS === 'true';
    if (this.isAnonymize) {
      this.pseudonymizer = new Pseudonymizer(options.anonymizeSecret ?? process.env.ANONYMIZE_SECRET);
    }
    this.resolver = new AttributeResolver(rawConfig, this.isAnonymize, options);
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
            const key = item.github_user.toLowerCase();
            const entries = this.mappings.get(key);
            if (entries) entries.push(item);
            else this.mappings.set(key, [item]);
          }
        }
      } catch {
        // handled by fallback
      }
    }
  }

  resolve(login: string, asOf?: string): UserAttributeMapping | UserAttributeMappingV2 | undefined {
    const key = login.toLowerCase();
    const v2 = selectEffectiveEntry(this.mappings.get(key) ?? [], asOf);
    if (v2) {
      if (this.pseudonymizer) {
        const pz = this.pseudonymizer;
        const dept = v2.department && v2.department !== '未分類 (Unassigned)'
          ? pz.department(v2.department)
          : v2.department;

        const v2Obj = v2 as UserAttributeMappingV2;
        const teams = v2Obj.teams?.map((t) => pz.team(t));
        const projects = v2Obj.projects?.map((p) => pz.project(p));

        return {
          ...v2,
          github_user: pz.login(login),
          display_name: pz.displayName(login),
          department: dept,
          teams,
          projects,
          // 自由記述の備考には氏名などが含まれうるため、匿名化モードでは出力しない
          notes: undefined,
        };
      }
      return v2;
    }

    const resolved = this.resolver.resolve(login, asOf);
    return {
      github_user: resolved.login,
      display_name: resolved.displayName,
      department: resolved.department,
      cost_center_override: resolved.costCenterOverride,
      notes: resolved.notes,
      tags: resolved.tags,
    };
  }

  resolveAll(logins: string[], asOf?: string): Map<string, UserAttributeMapping | UserAttributeMappingV2> {
    const map = new Map<string, UserAttributeMapping | UserAttributeMappingV2>();
    for (const login of logins) {
      const attr = this.resolve(login, asOf);
      if (attr) {
        map.set(login.toLowerCase(), attr);
      }
    }
    return map;
  }

  getMappingCount(): number {
    return Math.max(this.mappings.size, this.resolver.getMappingCount());
  }
}
