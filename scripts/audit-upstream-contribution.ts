import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { runSecretScan } from './scan-secrets.js';

const __filename = fileURLToPath(import.meta.url);

// .gitignore の実データ保護パターン (AIUsageReport*.csv / *<yyyymm>.csv 等) と
// 完全に同期させたブロックリスト。upstream への貢献ブランチに、組織固有の
// Copilot 利用実績・請求データ・ユーザーマッピング等が一切含まれないことを保証する。
export interface DataLeakRule {
  id: string;
  pattern: RegExp;
  description: string;
}

export const DATA_LEAK_RULES: DataLeakRule[] = [
  {
    id: 'ai-usage-report-csv',
    pattern: /AIUsageReport.*\.csv$/i,
    description: 'Monthly Usage Report CSV export (real Copilot billing/usage data).',
  },
  {
    id: 'usage-report-csv',
    pattern: /usage[_-]report.*\.csv$/i,
    description: 'Usage report CSV export (real Copilot billing/usage data).',
  },
  {
    id: 'yyyymm-csv',
    pattern: /\d{6}\.csv$/,
    description: 'Filename ending in a 6-digit YYYYMM before .csv (dated usage export).',
  },
  {
    id: 'yyyy-mm-csv',
    pattern: /\d{4}-\d{2}\.csv$/,
    description: 'Filename ending in a hyphenated YYYY-MM before .csv (dated usage export).',
  },
  {
    id: 'data-directory',
    pattern: /^(?:data|dashboard\/public\/data)\//,
    description: 'File under the data/ or dashboard/public/data/ runtime data directory (SDD-05 Fork-Safe Storage).',
  },
  {
    id: 'user-mapping',
    pattern: /(^|\/)(user_mapping|copilot_user_mapping)[^/]*\.(json|csv)$/i,
    description: 'Org-specific user/department mapping file (PII).',
  },
  {
    id: 'org-chart',
    pattern: /(^|\/)internal_org_chart\./i,
    description: 'Internal organization chart dump (PII).',
  },
  {
    id: 'secrets-file',
    pattern: /(^|\/)(secrets\.(json|ya?ml)|credentials\.json|service-account.*\.json|client_secret.*\.json)$/i,
    description: 'Hardcoded secrets/credentials file.',
  },
];

export interface AuditFinding {
  file: string;
  rule: DataLeakRule;
}

function runGit(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

/**
 * candidateRef が baseRef (通常は upstream/main) から分岐して以降に
 * 追加・変更したファイルパスの一覧を返す (3-dot diff: PRに乗る差分と同義)。
 */
export function getChangedFiles(baseRef: string, candidateRef: string): string[] {
  const raw = runGit(`diff ${baseRef}...${candidateRef} --name-only --diff-filter=ACMR`);
  return raw.split('\n').map((f) => f.trim()).filter(Boolean);
}

export function checkDataLeaks(files: string[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const file of files) {
    for (const rule of DATA_LEAK_RULES) {
      if (rule.pattern.test(file)) {
        findings.push({ file, rule });
      }
    }
  }
  return findings;
}

export interface UpstreamAuditResult {
  baseRef: string;
  candidateRef: string;
  changedFiles: string[];
  dataLeakFindings: AuditFinding[];
  secretScanClean: boolean;
}

export function runUpstreamContributionAudit(baseRef: string, candidateRef: string): UpstreamAuditResult {
  const changedFiles = getChangedFiles(baseRef, candidateRef);
  const dataLeakFindings = checkDataLeaks(changedFiles);
  const secretScanClean = runSecretScan();
  return { baseRef, candidateRef, changedFiles, dataLeakFindings, secretScanClean };
}

function printReport(result: UpstreamAuditResult): void {
  console.log('\n======================================================');
  console.log('🚧 Upstream Contribution Data-Leak Audit');
  console.log('======================================================');
  console.log(`Base (upstream):   ${result.baseRef}`);
  console.log(`Candidate branch:  ${result.candidateRef}`);
  console.log(`Files in diff:     ${result.changedFiles.length}\n`);

  if (result.dataLeakFindings.length === 0) {
    console.log('✅ Zero data-file / PII-pattern matches in the candidate diff.');
  } else {
    console.error(`🚨 CRITICAL: Detected ${result.dataLeakFindings.length} file(s) matching real-data/PII protection patterns!`);
    for (const finding of result.dataLeakFindings) {
      console.error(`  - [${finding.rule.id}] ${finding.file}`);
      console.error(`    ${finding.rule.description}`);
    }
    console.error('\n⛔ Remove these files from the candidate branch before contributing upstream.');
  }

  console.log(result.secretScanClean ? '\n✅ Secret/PII content scan (scan-secrets.ts): clean.' : '\n⛔ Secret/PII content scan (scan-secrets.ts): violations found (see above).');

  const passed = result.dataLeakFindings.length === 0 && result.secretScanClean;
  console.log(passed
    ? '\n✅ Safe to contribute: no organization-specific data or secrets detected in this diff.\n'
    : '\n⛔ NOT safe to contribute upstream. Fix the violations above first.\n');
}

// CLI 直接実行時: npm run upstream:audit -- [baseRef] [candidateRef]
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const baseRef = args[0] || 'upstream/main';
  const candidateRef = args[1] || 'HEAD';

  const result = runUpstreamContributionAudit(baseRef, candidateRef);
  printReport(result);

  const passed = result.dataLeakFindings.length === 0 && result.secretScanClean;
  process.exit(passed ? 0 : 1);
}
