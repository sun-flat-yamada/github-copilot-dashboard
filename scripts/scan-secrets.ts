import * as fs from 'fs';
import * as path from 'path';

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
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
  rule: SecretRule;
  snippet: string;
}

function isSafePlaceholder(text: string): boolean {
  const lower = text.toLowerCase();
  return SAFE_PLACEHOLDERS.some((ph) => lower.includes(ph));
}

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
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

function walkDir(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      files.push(...walkDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (IGNORED_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (IGNORED_EXTENSIONS.has(ext)) continue;

      files.push(fullPath);
    }
  }
  return files;
}

export function runSecretScan(): boolean {
  console.log('🛡️  Running Enterprise Secret & Privacy Audit Scanner...');
  const rootDir = process.cwd();
  const allFiles = walkDir(rootDir, rootDir);

  const allFindings: Finding[] = [];
  for (const file of allFiles) {
    const findings = scanFile(file);
    if (findings.length > 0) {
      allFindings.push(...findings);
    }
  }

  if (allFindings.length === 0) {
    console.log(`✅ Scan completed cleanly. Scanned ${allFiles.length} files. Zero secrets or sensitive leaks found!`);
    return true;
  }

  console.error(`\n🚨 CRITICAL: Detected ${allFindings.length} potential secret/PII violation(s)!`);
  for (const finding of allFindings) {
    const rel = path.relative(rootDir, finding.file);
    console.error(`  - [${finding.rule.name}]`);
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
