/**
 * 発行プロファイルとプライバシー階層 (P4-6 / E-05)。SDD-17 §7。
 *
 * 発行物 (data/ 配下のパス) ごとに「どの階層か」「Pages へ配信するか」「保持期間の扱い」を宣言する。
 * `pages:verify` / `fork:verify` はこの宣言と実際の配信設定 (STAGED_PROCESSED_DIRS / FORBIDDEN_DIST_PATHS) を突き合わせ、
 * 食い違いを失敗にする。純データと純関数だけで、I/O を持たない。
 */

/** aggregate-only = 利用者単位の行 (ログイン・氏名・部署など) を含まない。identified = 含み得る */
export const PRIVACY_TIERS = ['aggregate-only', 'identified'] as const;
export type PrivacyTier = (typeof PRIVACY_TIERS)[number];

export function isPrivacyTier(value: unknown): value is PrivacyTier {
  return typeof value === 'string' && (PRIVACY_TIERS as readonly string[]).includes(value);
}

/**
 * 保持期間の扱い
 * - `raw`: 保持期間 (既定 60 か月) を超えたら削除できる (月次締め済みの月だけ。SDD-17 §8)
 * - `audit`: 同上 (監査・レポートの派生物。締めの有無は問わない)
 * - `retained`: 保持期間の削除対象にしない (確定済みの月次集計・改訂履歴・メタデータ・設定)
 */
export type RetentionClass = 'raw' | 'audit' | 'retained';

export interface PublicationEntry {
  /** data/ からの相対パス (ディレクトリまたはファイル) */
  path: string;
  tier: PrivacyTier;
  /** GitHub Pages (dist/data/) へ配信するか。true のものだけが pages:stage の許可リストに入る */
  pages: boolean;
  retention: RetentionClass;
  note: string;
}

/**
 * 発行プロファイル。`processed/*` の monthly / reports / deep-analysis / custom / daily は利用者単位の行を含み得る
 * (運用前提は社内限定、SDD-01 §1.1 / SDD-04 §5)。それ以外の集計は aggregate-only。
 */
export const PUBLICATION_PROFILE: readonly PublicationEntry[] = [
  { path: 'index.json', tier: 'aggregate-only', pages: true, retention: 'retained', note: 'metadata (privacy flags, source status)' },
  { path: 'error-log.json', tier: 'aggregate-only', pages: true, retention: 'retained', note: 'issues (no per-user rows)' },
  { path: 'catalog', tier: 'aggregate-only', pages: true, retention: 'retained', note: 'exchange-rate catalog' },
  { path: 'processed/monthly', tier: 'identified', pages: true, retention: 'retained', note: 'monthly scopes (per-user rows)' },
  { path: 'processed/reports', tier: 'identified', pages: true, retention: 'retained', note: 'imported usage reports (per-user rows)' },
  { path: 'processed/deep-analysis', tier: 'identified', pages: true, retention: 'retained', note: 'deep analysis archive' },
  { path: 'processed/custom', tier: 'identified', pages: true, retention: 'retained', note: 'custom-range scopes' },
  { path: 'processed/daily', tier: 'identified', pages: true, retention: 'retained', note: 'daily scopes (only days listed in index.json)' },
  { path: 'processed/trends', tier: 'aggregate-only', pages: true, retention: 'retained', note: '1-year trend (company-wide values)' },
  { path: 'processed/quality', tier: 'aggregate-only', pages: true, retention: 'retained', note: 'data quality history' },
  { path: 'processed/closes', tier: 'aggregate-only', pages: true, retention: 'retained', note: 'closed-month snapshots and revisions: never deleted by retention' },
  { path: 'raw', tier: 'identified', pages: false, retention: 'raw', note: 'raw API responses and Run Manifests' },
  { path: 'reports/monthly', tier: 'identified', pages: false, retention: 'raw', note: 'original imported CSVs' },
  { path: 'config', tier: 'identified', pages: false, retention: 'retained', note: 'encrypted user mapping' },
  { path: 'audit/seat-events', tier: 'identified', pages: false, retention: 'audit', note: 'seat audit events per login' },
  { path: 'audit/billing-reconciliation', tier: 'aggregate-only', pages: false, retention: 'audit', note: 'billing amounts' },
  { path: 'audit/report-outputs', tier: 'identified', pages: false, retention: 'audit', note: 'generated reports (tier is declared per definition and recorded in index.json)' },
  { path: 'audit/retention', tier: 'aggregate-only', pages: false, retention: 'retained', note: 'retention log (names of months and ids only)' },
];

/** 配信物 (dist/data/) に出てはならないトップレベルのパス。Pages へ配信しないと宣言した発行物から導く */
export function forbiddenDistTopLevel(profile: readonly PublicationEntry[] = PUBLICATION_PROFILE): string[] {
  const out = new Set<string>();
  for (const e of profile) {
    if (!e.pages) out.add(e.path.split('/')[0]);
  }
  return [...out];
}

export interface ProfileConsistencyInput {
  /** pages:stage が processed/ から展開するディレクトリ (STAGED_PROCESSED_DIRS) */
  stagedProcessedDirs: readonly string[];
  /** 配信物に出てはならないパス (FORBIDDEN_DIST_PATHS。区切りは / に正規化して渡す) */
  forbiddenDistPaths: readonly string[];
}

/** 宣言 (PUBLICATION_PROFILE) と実際の配信設定の食い違いを返す。空なら一致 */
export function checkProfileConsistency(input: ProfileConsistencyInput, profile: readonly PublicationEntry[] = PUBLICATION_PROFILE): string[] {
  const problems: string[] = [];
  const byPath = new Map(profile.map((e) => [e.path, e]));

  for (const dir of input.stagedProcessedDirs) {
    const entry = byPath.get(`processed/${dir}`);
    if (!entry) problems.push(`processed/${dir} is staged for Pages but is not declared in the publication profile`);
    else if (!entry.pages) problems.push(`processed/${dir} is staged for Pages but the profile declares it as not published`);
  }
  for (const e of profile) {
    if (e.pages && e.path.startsWith('processed/') && !input.stagedProcessedDirs.includes(e.path.slice('processed/'.length))) {
      // daily は index.json の available_days に載る日だけを別扱いでステージする
      if (e.path !== 'processed/daily') problems.push(`${e.path} is declared as published but is not on the pages:stage allow-list`);
    }
  }
  const forbidden = new Set(input.forbiddenDistPaths.map((p) => p.replace(/\\/g, '/')));
  for (const top of forbiddenDistTopLevel(profile)) {
    const covered = forbidden.has(top) || [...forbidden].some((f) => f.startsWith(`${top}/`));
    if (!covered) problems.push(`${top} is declared as never published but pages:verify does not forbid it in dist/data/`);
  }
  for (const f of forbidden) {
    const entry = byPath.get(f) ?? profile.find((e) => e.path.startsWith(`${f}/`) || f.startsWith(`${e.path}/`));
    if (!entry) problems.push(`${f} is forbidden in dist/data/ but is not declared in the publication profile`);
    else if (entry.pages) problems.push(`${f} is forbidden in dist/data/ but the profile declares it as published`);
  }
  // identified の発行物が配信されるのは、運用前提 (社内限定) の下の processed/* だけ。それ以外の identified は配信しない
  for (const e of profile) {
    if (e.tier === 'identified' && e.pages && !e.path.startsWith('processed/')) {
      problems.push(`${e.path} is identified-tier and must not be published on Pages`);
    }
  }
  return problems;
}

export interface IdentifiedGate {
  allowed: boolean;
  reason: string;
}

/** ANONYMIZE_USERS=true かつ ANONYMIZE_SECRET が十分に長い (security-zero-leakage.md §2.3、SDD-04 §5.2) */
export function isPseudonymizationConfigured(env: Record<string, string | undefined>): boolean {
  return env.ANONYMIZE_USERS === 'true' && (env.ANONYMIZE_SECRET ?? '').trim().length >= 16;
}

/**
 * identified の発行物 (利用者単位の行を含み得るレポートなど) を生成してよいか。
 * 仮名化モード (キー付き HMAC) か、運用者の明示許可 `COPILOT_ALLOW_IDENTIFIED_REPORTS=true` (リポジトリと Pages が
 * 社内限定である前提の宣言。実際の公開範囲は fork:verify が別に検査する) のいずれかが必要。
 */
export function evaluateIdentifiedGate(env: Record<string, string | undefined>): IdentifiedGate {
  if (isPseudonymizationConfigured(env)) return { allowed: true, reason: 'pseudonymization is configured (ANONYMIZE_USERS=true with a strong ANONYMIZE_SECRET)' };
  if (env.COPILOT_ALLOW_IDENTIFIED_REPORTS === 'true') {
    return { allowed: true, reason: 'explicitly allowed by COPILOT_ALLOW_IDENTIFIED_REPORTS=true (repository and Pages are assumed to be restricted to the enterprise)' };
  }
  return {
    allowed: false,
    reason: 'identified-tier output needs ANONYMIZE_USERS=true with a strong ANONYMIZE_SECRET, or an explicit COPILOT_ALLOW_IDENTIFIED_REPORTS=true',
  };
}
