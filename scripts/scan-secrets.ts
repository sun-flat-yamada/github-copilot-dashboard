import * as fs from 'fs';
import * as path from 'path';

// secret: tokens / keys / credentials, pii: personal data (email addresses), path: machine-specific absolute paths
export type RuleCategory = 'secret' | 'pii' | 'path';
// all: every scanned file, artifacts: change-dev artifacts under .devs/changes/ only
type RuleScope = 'all' | 'artifacts';

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  description: string;
}

// Privacy rules (PII / absolute paths) are checked value by value: every match on a line is tested against the
// rule's own allowlist (never the line-wide SAFE_PLACEHOLDERS), and the output shows `redaction` instead of the value.
interface PrivacyRule {
  id: string;
  name: string;
  category: Exclude<RuleCategory, 'secret'>;
  scope: RuleScope;
  patterns: RegExp[];
  isAllowed: (value: string) => boolean;
  redaction: string;
  description: string;
}

// 業界標準 (Gitleaks / GitGuardian / OWASP) に基づくシークレット検知ルール
const SECRET_RULES: SecretRule[] = [
  {
    id: 'github-pat',
    name: 'GitHub Personal Access Token (Classic)',
    pattern: /\bghp_[a-zA-Z0-9]{36}\b/,
    description: 'Classic GitHub personal access token detected.',
  },
  {
    id: 'github-fine-grained',
    name: 'GitHub Fine-Grained Personal Access Token',
    pattern: /\bgithub_pat_[a-zA-Z0-9_]{82}\b/,
    description: 'Fine-grained GitHub personal access token detected.',
  },
  {
    id: 'github-oauth',
    name: 'GitHub OAuth / App Token',
    pattern: /\b(?:gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}\b/,
    description: 'GitHub OAuth or App access token detected.',
  },
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/,
    description: 'AWS access key identifier detected.',
  },
  {
    id: 'google-api-key',
    name: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/,
    description: 'Google Cloud or Gemini API key detected.',
  },
  {
    id: 'openai-api-key',
    name: 'OpenAI API Key',
    pattern: /\bsk-(?:proj-)?[a-zA-Z0-9_\-]{32,}\b/,
    description: 'OpenAI API token detected.',
  },
  {
    id: 'anthropic-api-key',
    name: 'Anthropic Claude API Key',
    pattern: /\bsk-ant-api03-[a-zA-Z0-9_\-]{32,}\b/,
    description: 'Anthropic Claude API key detected.',
  },
  {
    id: 'slack-webhook',
    name: 'Slack Incoming Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/,
    description: 'Slack webhook URL containing sensitive tokens detected.',
  },
  {
    id: 'private-key',
    name: 'Private Encryption Key (RSA/EC/OpenSSH)',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/,
    description: 'Unencrypted private key detected.',
  },
  {
    id: 'generic-secret-assign',
    name: 'Hardcoded Secret Assignment',
    pattern: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password)\s*[:=]\s*["'][a-zA-Z0-9_\-]{24,}["']/i,
    description: 'Generic hardcoded secret key assignment detected.',
  },
];

// Email allowlist: reserved example domains / TLDs (RFC 2606, RFC 6761), GitHub remotes and noreply senders
const ALLOWED_EMAIL_DOMAINS = new Set(['github.com', 'users.noreply.github.com']);
const ALLOWED_EMAIL_DOMAIN_SUFFIXES = ['example.com', 'example.org', 'example.net'];
const ALLOWED_EMAIL_TLDS = new Set(['example', 'test', 'invalid']);
const ALLOWED_EMAIL_LOCAL_PARTS = new Set(['noreply', 'no-reply']);

export function isAllowedEmail(value: string): boolean {
  const at = value.lastIndexOf('@');
  const local = value.slice(0, at).toLowerCase();
  const domain = value.slice(at + 1).toLowerCase();
  if (ALLOWED_EMAIL_LOCAL_PARTS.has(local)) return true;
  if (ALLOWED_EMAIL_DOMAINS.has(domain)) return true;
  if (ALLOWED_EMAIL_DOMAIN_SUFFIXES.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`))) return true;
  return ALLOWED_EMAIL_TLDS.has(domain.slice(domain.lastIndexOf('.') + 1));
}

const EMAIL_PATTERN = /(?<![\w.%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w-])/g;

// One path segment: stops at separators, whitespace, quotes, Markdown / code delimiters and `>`
// (so a placeholder segment such as `<user>` is captured as `<user`).
const SEGMENT = String.raw`[^\\/\s'"${'`'}()\[\]{}|,;>]+`;
// Not preceded by a word or path character, so relative paths such as `views/users/x` never match
const PATH_START = String.raw`(?<![\w.\-/\\~])`;

const ABS_PATH_PATTERNS: RegExp[] = [
  // <drive>:\Users\<name> and <drive>:/Users/<name>
  new RegExp(String.raw`(?<![A-Za-z0-9])[A-Za-z]:[\\/]+Users[\\/]+${SEGMENT}`, 'g'),
  // /home/<name>, /Users/<name> (case-sensitive: lowercase `users/` is a common relative directory)
  new RegExp(String.raw`${PATH_START}/(?:home|Users)/${SEGMENT}`, 'g'),
  // /root/<entry>, /tmp/<entry> (a bare `/tmp/` naming the directory is not a finding)
  new RegExp(String.raw`${PATH_START}/(?:root|tmp)/${SEGMENT}`, 'g'),
  // file:/// URIs with a path (a bare mention of the scheme is not a finding)
  new RegExp(String.raw`file:///${SEGMENT}`, 'g'),
];

export function isAllowedAbsolutePath(value: string): boolean {
  // The segment after the root (user name, temp entry, first file:/// segment) is an <angle-bracket> placeholder
  const segment = value.split(/[\\/]/).pop() ?? '';
  if (segment.startsWith('<')) return true;
  // Quotes of CI logs (home directory of GitHub-hosted runners)
  return value === '/home/runner';
}

const PRIVACY_RULES: PrivacyRule[] = [
  {
    id: 'email-address',
    name: 'Email Address',
    category: 'pii',
    scope: 'all',
    patterns: [EMAIL_PATTERN],
    isAllowed: isAllowedEmail,
    redaction: '<email>',
    description: 'Email address outside the allowlist (reserved example domains, GitHub, noreply) detected.',
  },
  {
    id: 'absolute-path',
    name: 'Machine-Specific Absolute Path',
    category: 'path',
    scope: 'artifacts',
    patterns: ABS_PATH_PATTERNS,
    isAllowed: isAllowedAbsolutePath,
    redaction: '<abs-path>',
    description:
      'Home directory, /tmp/ or file:/// path detected in a change-dev artifact. Use repository-relative links or <placeholder> segments.',
  },
];

// 無視対象ディレクトリ・拡張子
const IGNORED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.gemini',
  '.cursor',
  'data',
  'public/data',
]);

const IGNORED_FILES = new Set([
  // A sibling worktree's .git file holds `gitdir: <absolute path>`
  '.git',
  'package-lock.json',
  '.env.example',
  'scan-secrets.ts',
]);

const IGNORED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.pdf',
  '.woff',
  '.woff2',
]);

// ドットディレクトリ (.git, .agents, .github など) は走査しないが、以下のリポジトリルート相対パスは例外として走査する。
// change-dev の成果物 (.devs/changes/) は PR で共有されるため対象とし、.devs/ のそれ以外は対象外のままとする。
const ARTIFACTS_DIR = '.devs/changes';
const SCANNED_DOT_PATHS = [ARTIFACTS_DIR];

// プレースホルダー／モックとして安全とみなす単語
const SAFE_PLACEHOLDERS = [
  'mock',
  'dummy',
  'example',
  'sample',
  'placeholder',
  'xxxx',
  '0000',
  'test',
  'fake',
  'ghp_xxxx',
  'your-enterprise-slug',
];

interface Finding {
  file: string;
  line: number;
  category: RuleCategory;
  rule: { name: string; description: string };
  snippet: string;
}

const CATEGORY_LABELS: Record<RuleCategory, string> = { secret: 'secret', pii: 'PII', path: 'path' };

function isSafePlaceholder(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFE_PLACEHOLDERS.some((ph) => lower.includes(ph));
}

function privacyMatches(line: string, rule: PrivacyRule): string[] {
  const values: string[] = [];
  for (const pattern of rule.patterns) {
    for (const match of line.matchAll(pattern)) {
      if (!rule.isAllowed(match[0])) values.push(match[0]);
    }
  }
  return values;
}

// Replaces every disallowed privacy value on the line with its category name, so that no part of an email
// local part or a user name reaches the output (CI logs of a public repository are public).
function redactLine(line: string, rules: PrivacyRule[]): string {
  let redacted = line;
  for (const rule of rules) {
    for (const value of privacyMatches(line, rule)) {
      redacted = redacted.split(value).join(rule.redaction);
    }
  }
  return redacted;
}

function scanFile(filePath: string, isArtifact: boolean): Finding[] {
  const findings: Finding[] = [];
  const privacyRules = PRIVACY_RULES.filter((rule) => rule.scope === 'all' || isArtifact);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = redactLine(rawLine, privacyRules);
      // 個人情報・絶対パス: 一致した値ごとに許可リストで判定する (1 行 1 ルールにつき 1 件)
      for (const rule of privacyRules) {
        if (privacyMatches(rawLine, rule).length === 0) continue;
        findings.push({ file: filePath, line: i + 1, category: rule.category, rule, snippet: line.trim() });
      }
      // コメントやコード中の行をルールで走査
      for (const rule of SECRET_RULES) {
        const match = line.match(rule.pattern);
        if (match) {
          const matchedText = match[0];
          // 偽装モックやプレースホルダーは誤検知防止
          if (isSafePlaceholder(matchedText) || isSafePlaceholder(line)) {
            continue;
          }

          // シークレット文字列をマスク (最初の4文字と最後の2文字のみ残す)
          const masked =
            matchedText.length > 8
              ? `${matchedText.slice(0, 4)}****${matchedText.slice(-2)}`
              : '********';

          findings.push({
            file: filePath,
            line: i + 1,
            category: 'secret',
            rule,
            snippet: line.replace(matchedText, masked).trim(),
          });
        }
      }
    }
  } catch {
    // バイナリファイルや読み込み不能ファイルはスキップ
  }
  return findings;
}

// ルート相対パスを OS によらず '/' 区切りで返す (SCANNED_DOT_PATHS との照合用)
function toRepoPath(rootDir: string, fullPath: string): string {
  return path.relative(rootDir, fullPath).split(path.sep).join('/');
}

// passThrough: SCANNED_DOT_PATHS へ至る途中のドットディレクトリ (.devs/ など) の中であることを示す。
// その中では対象パスへ向かうディレクトリだけを辿り、ファイルは収集しない。
function walkDir(dir: string, baseDir: string, passThrough = false): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (passThrough || entry.name.startsWith('.')) {
        const repoPath = toRepoPath(baseDir, fullPath);
        if (SCANNED_DOT_PATHS.includes(repoPath)) {
          files.push(...walkDir(fullPath, baseDir));
        } else if (SCANNED_DOT_PATHS.some((dotPath) => dotPath.startsWith(`${repoPath}/`))) {
          files.push(...walkDir(fullPath, baseDir, true));
        }
        continue;
      }
      files.push(...walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (passThrough) continue;
      if (IGNORED_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) continue;

      files.push(fullPath);
    }
  }
  return files;
}

export function collectScanTargets(rootDir: string): string[] {
  return walkDir(rootDir, rootDir);
}

export function runSecretScan(rootDir: string = process.cwd()): boolean {
  console.log('🛡️  Running Enterprise Secret & Privacy Audit Scanner...');
  const allFiles = collectScanTargets(rootDir);
  const dotPathCoverage = SCANNED_DOT_PATHS.map((dotPath) => {
    const count = allFiles.filter((file) => toRepoPath(rootDir, file).startsWith(`${dotPath}/`)).length;
    return `${dotPath}/ (${count} files)`;
  });
  console.log(`📂 Dot-paths scanned: ${dotPathCoverage.join(', ')}. Other dot-directories are skipped.`);
  console.log(
    `🔎 Rules: secret patterns and email addresses (PII) in every file; absolute paths in ${ARTIFACTS_DIR}/ only.`,
  );

  const allFindings: Finding[] = [];
  for (const file of allFiles) {
    const findings = scanFile(file, toRepoPath(rootDir, file).startsWith(`${ARTIFACTS_DIR}/`));
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  if (allFindings.length === 0) {
    console.log(
      `✅ Scan completed cleanly. Scanned ${allFiles.length} files. Zero secrets, PII or absolute paths found!`,
    );
    return true;
  }

  const counts = (Object.keys(CATEGORY_LABELS) as RuleCategory[])
    .map((category) => `${CATEGORY_LABELS[category]}: ${allFindings.filter((f) => f.category === category).length}`)
    .join(', ');
  console.error(`\n🚨 CRITICAL: Detected ${allFindings.length} potential violation(s) (${counts})!`);
  for (const finding of allFindings) {
    const rel = path.relative(rootDir, finding.file);
    console.error(`  - [${CATEGORY_LABELS[finding.category]}] ${finding.rule.name}`);
    console.error(`    File: ${rel}:${finding.line}`);
    console.error(`    Description: ${finding.rule.description}`);
    console.error(`    Line: ${finding.snippet}`);
    console.error('');
  }

  console.error('⛔ Please remediate all violations before committing or pushing code.');
  return false;
}

// CLI 直接実行時
if (process.argv[1] && process.argv[1].endsWith('scan-secrets.ts')) {
  const clean = runSecretScan();
  process.exit(clean ? 0 : 1);
}
