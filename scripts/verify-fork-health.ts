import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { evaluateIdentifiedGate, isPrivacyTier } from '../src/domain/privacy-profile.js';
import { FORBIDDEN_DIST_PATHS, publicationProfileProblems } from './pages-staging.js';
import { RawLandingStore } from '../src/adapters/raw-landing/RawLandingStore.js';
import { RetentionService } from '../src/application/pipeline/retention.js';
import { parseRetentionMonths } from '../src/processor/retention.js';
import { ForkSafeStorage } from '../src/storage/fork-safe-storage.js';

const __filename = fileURLToPath(import.meta.url);

export interface HealthCheckResult {
  category: string;
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  remediation?: string;
}

export interface ForkHealthSummary {
  passed: number;
  warnings: number;
  failures: number;
  checks: HealthCheckResult[];
}

/**
 * Safely runs a git command and returns trimmed stdout, or null on error.
 */
export function runGit(cmd: string): string | null {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

/**
 * 1. Verify Git remotes (origin and upstream)
 */
export function checkGitRemotes(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const remotesRaw = runGit('remote -v') || '';
  const lines = remotesRaw.split('\n').filter(Boolean);

  const remotes: Record<string, string> = {};
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2 && !remotes[parts[0]]) {
      remotes[parts[0]] = parts[1];
    }
  }

  if (remotes['origin']) {
    results.push({
      category: 'Git Remotes',
      name: 'Origin Remote',
      status: 'pass',
      message: `origin is configured: ${remotes['origin']}`,
    });
  } else {
    results.push({
      category: 'Git Remotes',
      name: 'Origin Remote',
      status: 'fail',
      message: 'No origin remote found.',
      remediation: 'Configure origin remote with: git remote add origin <url>',
    });
  }

  if (remotes['upstream']) {
    results.push({
      category: 'Git Remotes',
      name: 'Upstream Remote',
      status: 'pass',
      message: `upstream is configured: ${remotes['upstream']}`,
    });
  } else {
    const isUpstreamOrigin = remotes['origin']?.includes('sun-flat-yamada/github-copilot-dashboard');
    if (isUpstreamOrigin) {
      results.push({
        category: 'Git Remotes',
        name: 'Upstream Remote',
        status: 'info',
        message: 'Current repository is the upstream source (sun-flat-yamada/github-copilot-dashboard).',
      });
    } else {
      results.push({
        category: 'Git Remotes',
        name: 'Upstream Remote',
        status: 'warn',
        message: 'Upstream remote is not configured in this downstream fork.',
        remediation: 'Run: git remote add upstream https://github.com/sun-flat-yamada/github-copilot-dashboard.git',
      });
    }
  }

  return results;
}

/**
 * 2. Verify Working Tree and Current Branch
 */
export function checkWorkingTree(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const branch = runGit('rev-parse --abbrev-ref HEAD') || 'unknown';

  if (branch === 'main') {
    results.push({
      category: 'Working Tree',
      name: 'Active Branch',
      status: 'pass',
      message: `Currently on primary synchronization branch '${branch}'.`,
    });
  } else {
    results.push({
      category: 'Working Tree',
      name: 'Active Branch',
      status: 'warn',
      message: `Currently on branch '${branch}'. Sync operations should typically be performed on 'main'.`,
      remediation: 'Switch to main before syncing: git checkout main',
    });
  }

  const statusOutput = runGit('status --porcelain') || '';
  if (statusOutput.length === 0) {
    results.push({
      category: 'Working Tree',
      name: 'Working Tree Cleanliness',
      status: 'pass',
      message: 'Working tree is completely clean. Safe to perform fast-forward merge.',
    });
  } else {
    const modifiedCount = statusOutput.split('\n').length;
    results.push({
      category: 'Working Tree',
      name: 'Working Tree Cleanliness',
      status: 'warn',
      message: `Working tree has ${modifiedCount} uncommitted or untracked change(s).`,
      remediation: 'Commit, stash, or clean working changes before running upstream sync.',
    });
  }

  return results;
}

/**
 * 3. Verify Fork-Safe Storage Isolation (Never commit data files to main branch)
 */
export function checkDataIsolation(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const trackedDataFiles = runGit('ls-files data/ dashboard/public/data/daily/ dashboard/public/data/monthly/') || '';

  const trackedList = trackedDataFiles.split('\n').filter(f => f.trim().length > 0);

  if (trackedList.length === 0) {
    results.push({
      category: 'Data Isolation',
      name: 'Code-Data Decoupling (SDD-05)',
      status: 'pass',
      message: 'Zero runtime data files tracked on main branch. Fork-Safe Storage is preserved.',
    });
  } else {
    results.push({
      category: 'Data Isolation',
      name: 'Code-Data Decoupling (SDD-05)',
      status: 'fail',
      message: `Found ${trackedList.length} runtime data file(s) tracked in Git index!`,
      remediation: 'Untrack data files immediately: git rm -r --cached data/ dashboard/public/data/ && git commit -m "fix: untrack data files"',
    });
  }

  // Check .gitignore contains data rules
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    const hasDataIgnore = /^\/?data\/?/m.test(gitignoreContent);
    if (hasDataIgnore) {
      results.push({
        category: 'Data Isolation',
        name: '.gitignore Data Rules',
        status: 'pass',
        message: '.gitignore correctly excludes data directories.',
      });
    } else {
      results.push({
        category: 'Data Isolation',
        name: '.gitignore Data Rules',
        status: 'warn',
        message: '.gitignore is missing explicit data/ exclusion patterns.',
        remediation: 'Add data/ to .gitignore to prevent accidental commits.',
      });
    }
  }

  return results;
}

export interface PublicationProfileOptions {
  /** data/ の場所 (省略時は cwd の data) */
  dataDir?: string;
  /** dashboard/public/data/ の場所 (省略時は cwd の dashboard/public/data) */
  publicDataDir?: string;
  env?: NodeJS.ProcessEnv;
  now?: Date;
}

/**
 * 3b. Publication profile (P4-6, SDD-17 §7): the declared privacy tiers must agree with what is actually staged,
 * identified-tier outputs need their gate, and data past the retention period is reported.
 * Offline. It is an addition to the exposure check (checkPublicExposure), never a replacement for it.
 */
export function checkPublicationProfile(options: PublicationProfileOptions = {}): HealthCheckResult[] {
  const category = 'Publication Profile';
  const results: HealthCheckResult[] = [];
  const env = options.env ?? process.env;
  const dataDir = options.dataDir ?? path.resolve(process.cwd(), 'data');
  const publicDataDir = options.publicDataDir ?? path.resolve(process.cwd(), 'dashboard/public/data');

  const mismatches = publicationProfileProblems();
  results.push(
    mismatches.length === 0
      ? { category, name: 'Declaration vs Pages staging', status: 'pass', message: 'The declared privacy tiers match the pages:stage allow-list and the pages:verify deny-list.' }
      : {
          category,
          name: 'Declaration vs Pages staging',
          status: 'fail',
          message: mismatches.join(' '),
          remediation: 'Align src/domain/privacy-profile.ts with scripts/pages-staging.ts (SDD-17 §7). Never publish an artifact the profile declares as not published.',
        }
  );

  // The staging directory must not hold anything the profile keeps off Pages
  const stagedForbidden = FORBIDDEN_DIST_PATHS.filter((rel) => fs.existsSync(path.join(publicDataDir, rel)));
  if (stagedForbidden.length > 0) {
    results.push({
      category,
      name: 'Staged files',
      status: 'fail',
      message: `dashboard/public/data/ contains path(s) that must never be published: ${stagedForbidden.join(', ')}.`,
      remediation: 'Remove them; pages:stage copies an allow-list only (never a recursive copy of data/).',
    });
  }

  // identified-tier report outputs need the gate (pseudonymization or an explicit allowance)
  try {
    const indexFile = path.join(dataDir, 'audit', 'report-outputs', 'index.json');
    if (fs.existsSync(indexFile)) {
      const index = JSON.parse(fs.readFileSync(indexFile, 'utf-8')) as { outputs?: Array<{ report_id?: string; privacy_tier?: unknown; demo?: boolean }> };
      const outputs = index.outputs ?? [];
      const unknownTier = outputs.filter((o) => o.privacy_tier !== undefined && !isPrivacyTier(o.privacy_tier));
      const identified = outputs.filter((o) => o.privacy_tier === 'identified' && o.demo !== true);
      const gate = evaluateIdentifiedGate(env);
      if (unknownTier.length > 0) {
        results.push({ category, name: 'Report output tiers', status: 'fail', message: `${unknownTier.length} report output(s) record an unknown privacy tier.`, remediation: 'Regenerate them with npm run reports:generate.' });
      } else if (identified.length > 0 && !gate.allowed) {
        results.push({
          category,
          name: 'Report output tiers',
          status: 'fail',
          message: `${identified.length} identified-tier report output(s) exist but the identified gate is closed: ${gate.reason}.`,
          remediation: 'Delete those outputs (they live under audit/, never on Pages) or enable pseudonymization / the explicit allowance (SDD-17 §7.3).',
        });
      } else {
        results.push({ category, name: 'Report output tiers', status: 'pass', message: `${outputs.length} report output(s); identified-tier outputs: ${identified.length}.` });
      }
    }
  } catch (e) {
    results.push({ category, name: 'Report output tiers', status: 'warn', message: `Could not read audit/report-outputs/index.json: ${e instanceof Error ? e.message : String(e)}` });
  }

  // retention: only a report (the deletion is an explicit operator action)
  if (fs.existsSync(dataDir)) {
    try {
      const { months } = parseRetentionMonths(env.COPILOT_DATA_RETENTION_MONTHS);
      const retentionStorage = new ForkSafeStorage({ baseDir: dataDir, publicDir: undefined });
      const plan = new RetentionService(retentionStorage, new RawLandingStore(retentionStorage.getBaseDir())).plan(options.now ?? new Date(), months);
      results.push(
        plan.items.length === 0
          ? { category, name: 'Data retention', status: 'pass', message: `Nothing is past the ${months}-month retention period.` }
          : {
              category,
              name: 'Data retention',
              status: 'warn',
              message: `${plan.items.length} item(s) are past the ${months}-month retention period (before ${plan.keep_from}).`,
              remediation: 'Review with npm run retention:plan, then apply explicitly: npm run retention:apply -- --execute --confirm <cutoff>.',
            }
      );
    } catch (e) {
      results.push({ category, name: 'Data retention', status: 'warn', message: `Could not evaluate the retention plan: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  return results;
}

/**
 * 4. Verify copilot-data Dedicated Branch (real data) and copilot-data-mock
 * (simulated/demo data) are properly separated.
 */
export function checkCopilotDataBranch(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];
  const localBranch = runGit('branch --list copilot-data') || '';
  const remoteBranch = runGit('branch -r --list origin/copilot-data') || '';

  if (localBranch.length > 0 || remoteBranch.length > 0) {
    results.push({
      category: 'Storage Branch',
      name: 'copilot-data Orphan Branch',
      status: 'pass',
      message: `Dedicated data branch 'copilot-data' exists (${localBranch ? 'local' : ''}${localBranch && remoteBranch ? ', ' : ''}${remoteBranch ? 'remote' : ''}).`,
    });
  } else {
    results.push({
      category: 'Storage Branch',
      name: 'copilot-data Orphan Branch',
      status: 'info',
      message: "'copilot-data' branch not yet created on remote. It will be initialized upon the first pipeline run.",
    });
  }

  // copilot-data-mock はモック/デモ用データ専用のブランチ。存在有無に関わらず
  // 'info' に留め、実データブランチ(copilot-data)の健全性判定には一切影響させない。
  const localMockBranch = runGit('branch --list copilot-data-mock') || '';
  const remoteMockBranch = runGit('branch -r --list origin/copilot-data-mock') || '';

  if (localMockBranch.length > 0 || remoteMockBranch.length > 0) {
    results.push({
      category: 'Storage Branch',
      name: 'copilot-data-mock Orphan Branch (Mock/Demo Data Isolation)',
      status: 'info',
      message: `Mock/demo data branch 'copilot-data-mock' exists (${localMockBranch ? 'local' : ''}${localMockBranch && remoteMockBranch ? ', ' : ''}${remoteMockBranch ? 'remote' : ''}) and is fully isolated from real data on 'copilot-data'.`,
    });
  } else {
    results.push({
      category: 'Storage Branch',
      name: 'copilot-data-mock Orphan Branch (Mock/Demo Data Isolation)',
      status: 'info',
      message: "'copilot-data-mock' branch not yet created. It is initialized only when the workflow is manually dispatched with mock_mode enabled, and never affects 'copilot-data'.",
    });
  }

  // 3. DEMO 専用データパーティション (data/demo/) の準備状況
  const localDemoExists = fs.existsSync(path.resolve(process.cwd(), 'data/demo/index.json'));
  if (localDemoExists) {
    results.push({
      category: 'Storage Branch',
      name: 'DEMO Dataset Partition (data/demo/)',
      status: 'pass',
      message: "Dedicated Auto-collected DEMO dataset is initialized and ready for simulation/testing.",
    });
  } else {
    results.push({
      category: 'Storage Branch',
      name: 'DEMO Dataset Partition (data/demo/)',
      status: 'info',
      message: "DEMO dataset is not yet initialized locally. To import or synthesize DEMO data in this fork, run 'npm run demo:setup'.",
    });
  }

  return results;
}

/**
 * 5. Environment & Configuration Check (Safe, zero-leakage)
 */
export function checkEnvironmentConfig(): HealthCheckResult[] {
  const results: HealthCheckResult[] = [];

  const hasToken = Boolean(process.env.COPILOT_READ_TOKEN);
  const isMock = process.env.MOCK_MODE === 'true';

  if (hasToken) {
    results.push({
      category: 'Environment & Config',
      name: 'Authentication Token',
      status: 'pass',
      message: 'COPILOT_READ_TOKEN is configured in local environment.',
    });
  } else if (isMock) {
    results.push({
      category: 'Environment & Config',
      name: 'Authentication Token',
      status: 'info',
      message: 'MOCK_MODE=true is enabled. Running in simulation mode without API token.',
    });
  } else {
    results.push({
      category: 'Environment & Config',
      name: 'Authentication Token',
      status: 'info',
      message: 'COPILOT_READ_TOKEN is not set locally (expected in GitHub Actions CI/CD Secrets).',
    });
  }

  const userMappingRaw = process.env.COPILOT_USER_MAPPING;
  if (userMappingRaw) {
    try {
      const parsed = JSON.parse(userMappingRaw);
      if (Array.isArray(parsed)) {
        results.push({
          category: 'Environment & Config',
          name: 'User Mapping (COPILOT_USER_MAPPING)',
          status: 'pass',
          message: `COPILOT_USER_MAPPING is valid JSON with ${parsed.length} entry/entries. (Values hidden for PII protection)`,
        });
      } else {
        results.push({
          category: 'Environment & Config',
          name: 'User Mapping (COPILOT_USER_MAPPING)',
          status: 'warn',
          message: 'COPILOT_USER_MAPPING is not a valid JSON array.',
          remediation: 'Ensure COPILOT_USER_MAPPING is a JSON array of objects: [{"github_user": "...", ...}]',
        });
      }
    } catch {
      results.push({
        category: 'Environment & Config',
        name: 'User Mapping (COPILOT_USER_MAPPING)',
        status: 'fail',
        message: 'COPILOT_USER_MAPPING is malformed JSON.',
        remediation: 'Validate JSON syntax before setting COPILOT_USER_MAPPING in Secrets/Variables.',
      });
    }
  }

  return results;
}

/**
 * 6. Public Exposure (Repository / copilot-data branch / GitHub Pages)
 *
 * SDD-04 の Zero Leakage は `main` ブランチ (ソース) の保護だけを扱う。しかし実データ運用では、
 * `copilot-data` ブランチ (processed / raw / 取り込み CSV) と GitHub Pages の配信物に、解決済みの
 * 氏名・部署・タグ・個人別利用が含まれる。リポジトリが公開なら `copilot-data` も公開され、
 * Pages は (Enterprise Cloud のアクセス制御を使わない限り) リポジトリが非公開でも公開される。
 *
 * この検査は「匿名のクライアントから実データが読めるか」を直接確かめる (認証ヘッダーは送らない)。
 *   1. GET api.github.com/repos/{owner}/{repo}                         → 200 ならリポジトリは公開
 *   2. GET raw.githubusercontent.com/{owner}/{repo}/copilot-data/data/index.json → 200 ならデータブランチが公開
 *   3. GET {Pages}/data/index.json                                      → 200 なら配信物がデータを公開している
 * そのうえで、仮名化されていない実データ (index.json の privacy 属性) を公開しようとしている場合に失敗とする。
 * デモデータのみ・仮名化済みの運用は通る。ネットワークに到達できない場合は検証不能 (warn) とし、失敗にはしない。
 */
export interface ExposureProbeResponse {
  status: number;
  body?: unknown;
}

/** 匿名の GET。ネットワーク到達不能・タイムアウトは null */
export type ExposureProbe = (url: string) => Promise<ExposureProbeResponse | null>;

export const EXPOSURE_PROBE_TIMEOUT_MS = 8000;

export const defaultExposureProbe: ExposureProbe = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPOSURE_PROBE_TIMEOUT_MS);
  try {
    // 認証情報は送らない (「誰でも読めるか」を確かめるため)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'github-copilot-dashboard-fork-verify' },
    });
    let body: unknown;
    if (res.ok) {
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
    }
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/** git remote の URL から `owner/repo` を取り出す (github.com のみ。資格情報付き URL でも資格情報は返さない) */
export function parseGitHubRepoSlug(remoteUrl: string | null | undefined): string | null {
  if (!remoteUrl) return null;
  const match = remoteUrl
    .trim()
    .match(/^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/(?:[^@/]+@)?|git@)github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

interface PrivacyIndexLike {
  is_mock_mode?: boolean;
  privacy?: { anonymized?: boolean; contains_user_level_data?: boolean; contains_imported_reports?: boolean };
  summary?: { total_seats?: number };
  available_days?: unknown[];
  available_reports?: unknown[];
}

function asIndex(body: unknown): PrivacyIndexLike | null {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as PrivacyIndexLike) : null;
}

/** index.json が、ユーザー単位 (氏名・部署・個人別利用) のデータを含む実データか。デモデータは含まない */
export function indexHasUserLevelData(index: PrivacyIndexLike | null | undefined): boolean {
  if (!index) return false;
  if (index.is_mock_mode === true) return false;
  // 個人単位のデータの証拠: ライブ収集したシート または 日次実績
  const evidence = (index.summary?.total_seats ?? 0) > 0 || (index.available_days?.length ?? 0) > 0;
  if (typeof index.privacy?.contains_user_level_data === 'boolean') {
    // 旧版は、取り込んだレポート (CSV) の有無だけで true にしていた。シートも日次実績も無い true は、
    // ライブ収集の実データではないため、レポートの警告 (indexHasImportedReports) の側で扱う
    return index.privacy.contains_user_level_data && evidence;
  }
  // privacy 属性のない旧形式
  return evidence;
}

/** 取り込んだ月次レポート (CSV) の集計を含む実データ用の index か (見本か実データかは判別できない) */
export function indexHasImportedReports(index: PrivacyIndexLike | null | undefined): boolean {
  if (!index || index.is_mock_mode === true) return false;
  return index.privacy?.contains_imported_reports === true || (index.available_reports?.length ?? 0) > 0;
}

export function indexIsAnonymized(index: PrivacyIndexLike | null | undefined): boolean {
  return index?.privacy?.anonymized === true;
}

export interface PublicExposureOptions {
  env?: NodeJS.ProcessEnv;
  /** `owner/repo`。省略時は GITHUB_REPOSITORY、無ければ origin remote から求める */
  repository?: string | null;
  probe?: ExposureProbe;
  /** ローカルの data/index.json (省略時は読み込みを試みる)。null は「無い」 */
  localIndex?: PrivacyIndexLike | null;
}

function readLocalIndex(): PrivacyIndexLike | null {
  try {
    const file = path.resolve(process.cwd(), 'data/index.json');
    return fs.existsSync(file) ? asIndex(JSON.parse(fs.readFileSync(file, 'utf-8'))) : null;
  } catch {
    return null;
  }
}

function normalizePagesBase(raw: string | undefined, owner: string, name: string): string {
  const base = raw?.trim() || `https://${owner.toLowerCase()}.github.io/${name}/`;
  return base.endsWith('/') ? base : `${base}/`;
}

export async function checkPublicExposure(options: PublicExposureOptions = {}): Promise<HealthCheckResult[]> {
  const env = options.env ?? process.env;
  const probe = options.probe ?? defaultExposureProbe;
  const category = 'Public Exposure';
  const name = 'Repository / Pages Visibility (E-05)';

  const slug =
    options.repository !== undefined
      ? options.repository
      : env.GITHUB_REPOSITORY || parseGitHubRepoSlug(runGit('remote get-url origin'));

  if (!slug || !slug.includes('/')) {
    return [
      {
        category,
        name,
        status: 'warn',
        message: 'Could not determine the GitHub repository (GITHUB_REPOSITORY / origin remote). Public exposure was not verified.',
        remediation:
          "Verify manually that the repository and GitHub Pages are private (or that ANONYMIZE_USERS is enabled) before publishing real data. See SECURITY.md 'Public Repositories & Pages'.",
      },
    ];
  }

  const [owner, repo] = slug.split('/');
  const pagesBase = normalizePagesBase(env.COPILOT_PAGES_URL, owner, repo);
  const [repoRes, branchRes, pagesRes] = await Promise.all([
    probe(`https://api.github.com/repos/${slug}`),
    probe(`https://raw.githubusercontent.com/${slug}/copilot-data/data/index.json`),
    probe(`${pagesBase}data/index.json`),
  ]);

  const repoPublic = repoRes ? (repoRes.status === 200 ? true : repoRes.status === 404 ? false : null) : null;
  const branchIndex = branchRes?.status === 200 ? asIndex(branchRes.body) : null;
  const pagesIndex = pagesRes?.status === 200 ? asIndex(pagesRes.body) : null;
  const branchReadable = branchRes?.status === 200;
  const pagesReadable = pagesRes?.status === 200;
  const anyUnknown = [repoRes, branchRes, pagesRes].some((r) => r === null || (r.status !== 200 && r.status !== 404));

  const exposures: string[] = [];
  if (repoPublic === true) exposures.push('the repository is public');
  if (branchReadable) exposures.push("the 'copilot-data' branch is readable without authentication");
  if (pagesReadable) exposures.push(`GitHub Pages serves ${pagesBase}data/index.json`);
  const exposed = exposures.length > 0;

  // 実データ (ユーザー単位) を、仮名化せずに公開 / 公開しようとしているか
  const publishedUnanonymized = [branchIndex, pagesIndex].some((i) => indexHasUserLevelData(i) && !indexIsAnonymized(i));
  const localIndex = options.localIndex !== undefined ? options.localIndex : readLocalIndex();
  const localUnanonymized = indexHasUserLevelData(localIndex) && !indexIsAnonymized(localIndex);
  const liveCollectionConfigured = Boolean(env.COPILOT_READ_TOKEN) && Boolean(env.COPILOT_ENTERPRISE || env.COPILOT_ORGS);
  const anonymizeConfigured = env.ANONYMIZE_USERS === 'true' && (env.ANONYMIZE_SECRET ?? '').trim().length >= 16;
  const atRisk = publishedUnanonymized || ((liveCollectionConfigured || localUnanonymized) && !anonymizeConfigured);
  const acknowledged = env.COPILOT_ALLOW_PUBLIC_DATA === 'true';

  const remediation =
    'Make the repository private (or use a separate private repository for data) and disable public Pages / use Enterprise Cloud access-controlled Pages; ' +
    'or enable pseudonymization (ANONYMIZE_USERS=true + ANONYMIZE_SECRET). ' +
    "To accept the risk explicitly, set COPILOT_ALLOW_PUBLIC_DATA=true (not recommended). See SECURITY.md 'Public Repositories & Pages'.";

  if (exposed && atRisk && !acknowledged) {
    return [
      {
        category,
        name,
        status: 'fail',
        message:
          `Real, non-anonymized Copilot usage data would be publicly readable: ${exposures.join('; ')}. ` +
          'The data branch and Pages contain resolved names, departments and per-user usage.',
        remediation,
      },
    ];
  }
  if (exposed && atRisk) {
    return [
      {
        category,
        name,
        status: 'warn',
        message: `Public exposure of real, non-anonymized data was explicitly acknowledged (COPILOT_ALLOW_PUBLIC_DATA=true): ${exposures.join('; ')}.`,
        remediation,
      },
    ];
  }
  if (exposed) {
    // 取り込んだレポート (CSV) の集計が公開されている。実データか見本かは判別できないため、失敗にはせず警告する
    const publishedReports = [branchIndex, pagesIndex].some((i) => indexHasImportedReports(i) && !indexIsAnonymized(i));
    if (publishedReports) {
      return [
        {
          category,
          name,
          status: 'warn',
          message:
            `Publicly readable (${exposures.join('; ')}), and imported monthly usage reports (available_reports) are published. ` +
            'They contain per-user names and usage; make sure they are fictional samples, not real data.',
          remediation:
            'This dashboard is meant for private / internal repositories (SDD-01 §1.1). If the reports are real, make the repository private and remove them from the copilot-data branch history.',
        },
      ];
    }
    return [
      {
        category,
        name,
        status: 'pass',
        message: `Publicly readable (${exposures.join('; ')}), but no real non-anonymized user-level data is involved (demo or pseudonymized data only).`,
      },
    ];
  }
  if (anyUnknown) {
    return [
      {
        category,
        name,
        status: 'warn',
        message: atRisk
          ? 'Could not verify public exposure (network unreachable or rate limited) while real non-anonymized data is configured.'
          : 'Could not verify public exposure (network unreachable or rate limited).',
        remediation: 'Re-run with network access, or verify the repository / Pages visibility manually in Settings.',
      },
    ];
  }
  return [
    {
      category,
      name,
      status: 'pass',
      message: 'The repository, the copilot-data branch and the Pages data are not readable without authentication.',
    },
  ];
}

/** 同期の健全性 (git / 作業ツリー / データ分離 ...) に加え、公開範囲の検査 (ネットワークを使う) まで実行する */
export async function runAllHealthChecksWithExposure(options: PublicExposureOptions = {}): Promise<ForkHealthSummary> {
  const base = runAllHealthChecks();
  const checks = [...base.checks, ...(await checkPublicExposure(options))];
  return summarizeChecks(checks);
}

function summarizeChecks(checks: HealthCheckResult[]): ForkHealthSummary {
  return {
    passed: checks.filter((c) => c.status === 'pass').length,
    warnings: checks.filter((c) => c.status === 'warn').length,
    failures: checks.filter((c) => c.status === 'fail').length,
    checks,
  };
}

/**
 * Execute all (offline) health checks and aggregate results.
 * 公開範囲の検査はネットワークを使うため、非同期の runAllHealthChecksWithExposure() に分けている。
 */
export function runAllHealthChecks(): ForkHealthSummary {
  const allChecks: HealthCheckResult[] = [
    ...checkGitRemotes(),
    ...checkWorkingTree(),
    ...checkDataIsolation(),
    ...checkPublicationProfile(),
    ...checkCopilotDataBranch(),
    ...checkEnvironmentConfig(),
  ];

  return summarizeChecks(allChecks);
}

/**
 * Formatted CLI Reporter
 */
export function printHealthReport(summary: ForkHealthSummary): void {
  console.log('\n======================================================');
  console.log('🩺 GitHub Copilot Dashboard: Fork Health & Sync Audit');
  console.log('======================================================\n');

  let currentCategory = '';
  for (const check of summary.checks) {
    if (check.category !== currentCategory) {
      currentCategory = check.category;
      console.log(`\n📁 [${currentCategory}]`);
    }

    const icon = {
      pass: '✅',
      warn: '⚠️ ',
      fail: '❌',
      info: 'ℹ️ ',
    }[check.status];

    console.log(`  ${icon} ${check.name}: ${check.message}`);
    if (check.remediation) {
      console.log(`     👉 Recommendation: ${check.remediation}`);
    }
  }

  console.log('\n------------------------------------------------------');
  console.log(`Summary: ${summary.passed} Passed, ${summary.warnings} Warning(s), ${summary.failures} Failure(s)`);
  console.log('------------------------------------------------------\n');

  if (summary.failures > 0) {
    console.error('❌ Critical health check failures detected. Remediate issues above before syncing.\n');
  } else if (summary.warnings > 0) {
    console.log('⚠️  Checks completed with warnings. Proceed with caution.\n');
  } else {
    console.log('✅ Fork environment is healthy and ready for seamless Upstream synchronization!\n');
  }
}

// CLI entry point
async function main(): Promise<number> {
  const isQuick = process.argv.includes('--quick');
  // --quick はネットワークを使わない (公開範囲の検査を行わない)
  const summary = isQuick ? runAllHealthChecks() : await runAllHealthChecksWithExposure();
  printHealthReport(summary);

  if (!isQuick && summary.failures === 0) {
    console.log('💡 Quick Sync Checklist:');
    console.log('   1. git fetch upstream main');
    console.log('   2. git merge upstream/main --ff-only');
    console.log('   3. npm ci && npm run typecheck && npm test && npm run secret-scan && npm run build');
    console.log('   4. git push origin main\n');
  }

  return summary.failures > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  main().then((code) => {
    process.exitCode = code;
  });
}
