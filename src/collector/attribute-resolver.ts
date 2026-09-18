import { UserAttributeMapping } from '../types/copilot.js';

export interface ResolvedUserAttribute {
  login: string;
  displayName: string;
  department: string;
  costCenterOverride?: string;
  notes?: string;
  tags?: string[];
}

export class AttributeResolver {
  private mappings: Map<string, UserAttributeMapping> = new Map();
  private isAnonymize: boolean = false;

  constructor(rawConfig?: string, anonymize: boolean = false) {
    this.isAnonymize = anonymize || process.env.ANONYMIZE_USERS === 'true';
    this.loadMappings(rawConfig || process.env.COPILOT_USER_MAPPING || process.env.COPILOT_USER_MAPPING_BASE64);
  }

  /**
   * JSON文字列またはCSV文字列、Base64文字列からユーザーマッピングをロード
   */
  private loadMappings(configStr?: string): void {
    if (!configStr || configStr.trim() === '') {
      return;
    }

    let raw = configStr.trim();

    // Base64判定 & デコード
    if (!raw.startsWith('[') && !raw.startsWith('{') && !raw.includes(',') && !raw.includes('\n') && raw.length > 20) {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
        if (decoded.includes('[') || decoded.includes(',')) {
          raw = decoded.trim();
        }
      } catch {
        // 通常文字列として継続
      }
    }

    // 1. JSON形式のパース試行
    if (raw.startsWith('[') || raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        const list: UserAttributeMapping[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of list) {
          if (item && item.github_user) {
            this.mappings.set(item.github_user.toLowerCase(), item);
          }
        }
        return;
      } catch (e) {
        console.warn('[AttributeResolver] Failed to parse JSON, falling back to CSV parser:', e);
      }
    }

    // 2. CSV形式のパース試行 (ヘッダー: github_user,display_name,department,cost_center_override,notes,tags)
    //    tags列は ";" 区切りで複数値を1セルに格納する (例: "契約社員;リモート")
    try {
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const userIdx = headers.indexOf('github_user');
        const nameIdx = headers.indexOf('display_name');
        const deptIdx = headers.indexOf('department');
        const ccIdx = headers.indexOf('cost_center_override');
        const notesIdx = headers.indexOf('notes');
        const tagsIdx = headers.indexOf('tags');

        const startIndex = userIdx >= 0 ? 1 : 0;
        for (let i = startIndex; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.trim());
          const githubUser = cols[userIdx >= 0 ? userIdx : 0];
          if (!githubUser) continue;

          const tagsRaw = tagsIdx >= 0 ? cols[tagsIdx] : cols[5];
          const tags = tagsRaw
            ? tagsRaw
                .split(';')
                .map((t) => t.trim())
                .filter((t) => t.length > 0)
            : undefined;

          this.mappings.set(githubUser.toLowerCase(), {
            github_user: githubUser,
            display_name: nameIdx >= 0 ? cols[nameIdx] : cols[1] || githubUser,
            department: deptIdx >= 0 ? cols[deptIdx] : cols[2] || '未分類 (Unassigned)',
            cost_center_override: ccIdx >= 0 ? cols[ccIdx] : cols[3],
            notes: notesIdx >= 0 ? cols[notesIdx] : cols[4],
            tags: tags && tags.length > 0 ? tags : undefined,
          });
        }
      }
    } catch (e) {
      console.error('[AttributeResolver] Error parsing user mapping config:', e);
    }
  }

  /**
   * ユーザーのログインIDから属性情報を解決。未登録の場合は安全にフォールバック。
   */
  public resolve(login: string): ResolvedUserAttribute {
    const key = login.toLowerCase();
    const mapped = this.mappings.get(key);

    let displayName = mapped?.display_name || login;
    let department = mapped?.department || '未分類 (Unassigned)';
    let costCenterOverride = mapped?.cost_center_override;
    const notes = mapped?.notes;
    // tagsはPII(個人特定情報)ではないためアノニマイズ対象外 (notesと同様の扱い)
    const tags = mapped?.tags;

    // アノニマイズ（匿名化）モードの処理
    if (this.isAnonymize) {
      const hash = this.simpleHash(login);
      displayName = `User-${hash.substring(0, 6)}`;
      login = `dev_${hash.substring(0, 8)}`;
      if (department !== '未分類 (Unassigned)') {
        department = `Group-${this.simpleHash(department).substring(0, 4)}`;
      }
    }

    return {
      login,
      displayName,
      department,
      costCenterOverride,
      notes,
      tags,
    };
  }

  public getMappingCount(): number {
    return this.mappings.size;
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
