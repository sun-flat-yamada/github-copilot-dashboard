import { CopilotSeatAssignment, EnterpriseCostCenter, UserAttributeMapping } from '../types/copilot.js';
import { Pseudonymizer } from './pseudonymizer.js';
import { MappingPeriodIssue, selectEffectiveEntry, validateMappingPeriods } from './mapping-periods.js';

export interface ResolvedUserAttribute {
  login: string;
  displayName: string;
  department: string;
  costCenterOverride?: string;
  notes?: string;
  tags?: string[];
  teams?: string[];
  projects?: string[];
  role?: string;
  aiCreditsLimitMonthly?: number;
  targetAdoptionPhase?: string;
  targetAcceptanceRate?: number;
}

/**
 * 環境変数の読み取り。ブラウザには process が無い (CSV の取り込みで ReportParser → AttributeResolver が
 * ブラウザ内でも生成されるため、process に直接触れると ReferenceError になる)。
 */
function readEnv(name: string): string | undefined {
  return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
}

export interface AttributeResolverOptions {
  /** 匿名化の秘密鍵。省略時は環境変数 ANONYMIZE_SECRET */
  anonymizeSecret?: string;
}

export class AttributeResolver {
  /** ログイン名 (小文字) → 実効期間ごとの行 (SCD Type 2)。期間なしのマッピングは無期限の 1 行 */
  private mappings: Map<string, UserAttributeMapping[]> = new Map();
  private validationIssues: MappingPeriodIssue[] = [];
  private isAnonymize: boolean = false;
  private pseudonymizer: Pseudonymizer | null = null;

  /**
   * @param anonymize 匿名化 (仮名化) モード。環境変数 ANONYMIZE_USERS=true でも有効になる。
   *                  有効なときは秘密鍵 (ANONYMIZE_SECRET) が必須で、無い場合は例外 (復元可能な匿名化を発行しない)。
   */
  constructor(rawConfig?: string, anonymize: boolean = false, options: AttributeResolverOptions = {}) {
    this.isAnonymize = anonymize || readEnv('ANONYMIZE_USERS') === 'true';
    if (this.isAnonymize) {
      this.pseudonymizer = new Pseudonymizer(options.anonymizeSecret ?? readEnv('ANONYMIZE_SECRET'));
    }
    this.loadMappings(rawConfig || readEnv('COPILOT_USER_MAPPING') || readEnv('COPILOT_USER_MAPPING_BASE64'));
    this.validatePeriods();
  }

  private addMapping(item: UserAttributeMapping): void {
    const key = item.github_user.toLowerCase();
    const list = this.mappings.get(key);
    if (list) list.push(item);
    else this.mappings.set(key, [item]);
  }

  /**
   * 実効期間の検証。不正な期間の行は解決対象から外し (未登録として扱う)、重複・隙間は検出して保持する。
   * 警告ログにはログイン名を含めない (件数のみ)。
   */
  private validatePeriods(): void {
    for (const [key, list] of this.mappings) {
      const issues = validateMappingPeriods(list);
      if (issues.length === 0) continue;
      this.validationIssues.push(...issues);
      const dropped = new Set(
        issues.filter((i) => i.code === 'invalid_date' || i.code === 'invalid_range').flatMap((i) => i.indexes)
      );
      if (dropped.size > 0) {
        const kept = list.filter((_, idx) => !dropped.has(idx));
        if (kept.length > 0) this.mappings.set(key, kept);
        else this.mappings.delete(key);
      }
    }
    if (this.validationIssues.length > 0) {
      const errors = this.validationIssues.filter((i) => i.severity === 'error').length;
      const warnings = this.validationIssues.length - errors;
      console.warn(
        `[AttributeResolver] Effective-period validation: ${errors} error(s), ${warnings} warning(s) ` +
          '(overlapping / invalid periods and gaps between periods; see getValidationIssues()).'
      );
    }
  }

  /** 実効期間の検証結果 (重複・隙間・不正な期間)。ログイン名は含まない */
  public getValidationIssues(): MappingPeriodIssue[] {
    return [...this.validationIssues];
  }

  /** 匿名化 (仮名化) モードか */
  public isAnonymizing(): boolean {
    return this.isAnonymize;
  }

  /**
   * 匿名化モードのとき Raw 保存用にシート割り当てから個人を特定できる識別子 (ログイン名・ユーザー ID・
   * アバター URL 等) を除去する。匿名化でなければそのまま返す。
   */
  public redactSeatForStorage(seat: CopilotSeatAssignment): CopilotSeatAssignment {
    return this.pseudonymizer ? this.pseudonymizer.redactSeat(seat) : seat;
  }

  /** 匿名化モードのとき Raw 保存用に Cost Center のユーザーリソース名を仮名にする */
  public redactCostCenterForStorage(costCenter: EnterpriseCostCenter): EnterpriseCostCenter {
    return this.pseudonymizer ? this.pseudonymizer.redactCostCenter(costCenter) : costCenter;
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
        const list: UserAttributeMapping[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed.mappings)
            ? parsed.mappings
            : [parsed];
        for (const item of list) {
          if (item && item.github_user) {
            this.addMapping(item);
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
        const fromIdx = headers.indexOf('valid_from');
        const toIdx = headers.indexOf('valid_to');

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

          const validFrom = fromIdx >= 0 ? cols[fromIdx] : undefined;
          const validTo = toIdx >= 0 ? cols[toIdx] : undefined;

          this.addMapping({
            github_user: githubUser,
            display_name: nameIdx >= 0 ? cols[nameIdx] : cols[1] || githubUser,
            department: deptIdx >= 0 ? cols[deptIdx] : cols[2] || '未分類 (Unassigned)',
            cost_center_override: ccIdx >= 0 ? cols[ccIdx] : cols[3],
            notes: notesIdx >= 0 ? cols[notesIdx] : cols[4],
            tags: tags && tags.length > 0 ? tags : undefined,
            ...(validFrom ? { valid_from: validFrom } : {}),
            ...(validTo ? { valid_to: validTo } : {}),
          });
        }
      }
    } catch (e) {
      console.error('[AttributeResolver] Error parsing user mapping config:', e);
    }
  }

  /**
   * ユーザーのログインIDから属性情報を解決。未登録の場合は安全にフォールバック。
   *
   * @param asOf 属性を決める時点 (YYYY-MM-DD、または YYYY-MM = その月の月末時点)。実効期間 (valid_from / valid_to) を
   *             持つマッピングは、この時点で有効な行が使われる。省略時は現行 (最新) の行。
   */
  public resolve(login: string, asOf?: string): ResolvedUserAttribute {
    const key = login.toLowerCase();
    const mapped = selectEffectiveEntry(this.mappings.get(key) ?? [], asOf);

    let displayName = mapped?.display_name || login;
    let department = mapped?.department || '未分類 (Unassigned)';
    let costCenterOverride = mapped?.cost_center_override;
    let notes = mapped?.notes;
    // tagsはPII(個人特定情報)ではないためアノニマイズ対象外 (notesと同様の扱い)
    const tags = mapped?.tags;
    let teams = (mapped as any)?.teams;
    let projects = (mapped as any)?.projects;
    const role = (mapped as any)?.role;
    const aiCreditsLimitMonthly = (mapped as any)?.ai_credits_limit_monthly;
    const targetAdoptionPhase = (mapped as any)?.target_adoption_phase;
    const targetAcceptanceRate = (mapped as any)?.target_acceptance_rate;

    // アノニマイズ（匿名化）モードの処理: 秘密鍵付きの HMAC で仮名化する (辞書照合で復元できない)
    if (this.pseudonymizer) {
      const pz = this.pseudonymizer;
      displayName = pz.displayName(login);
      login = pz.login(login);
      if (department !== '未分類 (Unassigned)') {
        department = pz.department(department);
      }
      if (teams && Array.isArray(teams)) {
        teams = teams.map((t: string) => pz.team(t));
      }
      if (projects && Array.isArray(projects)) {
        projects = projects.map((p: string) => pz.project(p));
      }
      // 自由記述の備考には氏名などが含まれうるため、匿名化モードでは出力しない
      notes = undefined;
    }

    return {
      login,
      displayName,
      department,
      costCenterOverride,
      notes,
      tags,
      teams,
      projects,
      role,
      aiCreditsLimitMonthly,
      targetAdoptionPhase,
      targetAcceptanceRate,
    };
  }

  public getMappingCount(): number {
    return this.mappings.size;
  }
}
