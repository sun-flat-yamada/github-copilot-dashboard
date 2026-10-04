#!/usr/bin/env tsx
/**
 * GitHub Pages 配信物へのデータのステージングと検証 (P0-7)。
 *
 * 永続ストレージ (`data/`、copilot-data ブランチ) は `processed/` 階層を持ち、SPA の配信ルート
 * (`dashboard/public/data/`) は同じ中身をフラットに展開する (AGENTS.md rule 7)。
 * 以前は CI が DEMO パーティション (`data/demo`) しかステージしておらず、実データの過去月
 * (processed/monthly・reports・deep-analysis) がデプロイ物に含まれなかった。SPA は 404 の後に
 * `/demo/` パスへ暗黙にフォールバックし、デモデータが「確定テレメトリ」として表示されていた。
 *
 * - stage:  data/ の公開してよいものだけを dashboard/public/data/ へコピーする (許可リスト方式)
 * - verify: ビルド成果物 dist/data/ に、ステージ対象が揃っていること・公開してはならないものが
 *           含まれていないことを検査する (CI で失敗させる)
 *
 * 公開してよいもの: index.json / error-log.json / processed/{monthly,reports,deep-analysis,trends,custom,quality,closes}/*.json、
 *                   processed/daily/ は index.json の available_days に載っている日のみ (UI が参照する範囲)。
 * 公開しないもの:   raw/ (未加工の API 応答)、reports/ (取り込んだ CSV の原本)、config/ (暗号化済みユーザーマッピング) など。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProfileConsistency } from '../src/domain/privacy-profile.js';

export interface StagingEntry {
  /** data/ からの相対パス (ソース) */
  from: string;
  /** dashboard/public/data/ (= dist/data/) からの相対パス (配信先) */
  to: string;
}

/** processed/ 直下で配信ルートへ展開するディレクトリ (daily は別扱い) */
export const STAGED_PROCESSED_DIRS = ['monthly', 'reports', 'deep-analysis', 'trends', 'custom', 'quality', 'closes'] as const;

/** 配信物に含めてはならないトップレベルのパス (dist/data/ からの相対) */
/** audit/: シート監査イベント (利用者単位の個人データ。P4-3)。許可リストに無いので通常はステージされないが、混入したら失敗させる */
export const FORBIDDEN_DIST_PATHS = ['raw', 'config', 'audit', path.join('reports', 'monthly')] as const;

/**
 * 発行プロファイル (src/domain/privacy-profile.ts) の宣言と、この許可リスト・禁止リストの食い違い (P4-6)。
 * 空なら一致。pages:verify と fork:verify が失敗にする。
 */
export function publicationProfileProblems(): string[] {
  return checkProfileConsistency({
    stagedProcessedDirs: STAGED_PROCESSED_DIRS,
    forbiddenDistPaths: FORBIDDEN_DIST_PATHS.map((p) => p.split(path.sep).join('/')),
  });
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();
}

function readAvailableDays(dataDir: string): string[] {
  try {
    const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'index.json'), 'utf-8'));
    return Array.isArray(index?.available_days)
      ? index.available_days.filter((d: unknown): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [];
  } catch {
    return [];
  }
}

/** data/ から配信ルートへ展開するファイルの一覧 (許可リスト) */
export function planStaging(dataDir: string): StagingEntry[] {
  const plan: StagingEntry[] = [];

  for (const file of ['index.json', 'error-log.json']) {
    if (fs.existsSync(path.join(dataDir, file))) {
      plan.push({ from: file, to: file });
    }
  }

  // 参照カタログ (為替)。個人情報を含まない
  if (fs.existsSync(path.join(dataDir, 'catalog', 'exchange-rates.json'))) {
    const rel = path.join('catalog', 'exchange-rates.json');
    plan.push({ from: rel, to: rel });
  }

  for (const dir of STAGED_PROCESSED_DIRS) {
    for (const file of listJsonFiles(path.join(dataDir, 'processed', dir))) {
      plan.push({ from: path.join('processed', dir, file), to: path.join(dir, file) });
    }
  }

  for (const day of readAvailableDays(dataDir)) {
    const rel = path.join('processed', 'daily', `${day}.json`);
    if (fs.existsSync(path.join(dataDir, rel))) {
      plan.push({ from: rel, to: path.join('daily', `${day}.json`) });
    }
  }

  return plan;
}

/** 許可リストのファイルを配信ルートへコピーする */
export function stageData(dataDir: string, publicDataDir: string): { copied: number; plan: StagingEntry[] } {
  const plan = planStaging(dataDir);
  for (const entry of plan) {
    const target = path.join(publicDataDir, entry.to);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(dataDir, entry.from), target);
  }
  return { copied: plan.length, plan };
}

function findCsvFiles(dir: string, relBase = ''): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(relBase, entry.name);
    // demo/ は架空データ (公開前提) のため検査対象外
    if (entry.isDirectory()) {
      if (relBase === '' && entry.name === 'demo') continue;
      found.push(...findCsvFiles(path.join(dir, entry.name), rel));
    } else if (entry.name.toLowerCase().endsWith('.csv')) {
      found.push(rel);
    }
  }
  return found;
}

export interface StagingProblems {
  /** ステージ対象なのにビルド成果物に無いファイル (過去月が配信されない原因になる) */
  missing: string[];
  /** ビルド成果物に含まれてはならないパス (未加工データ・CSV 原本・暗号化済みマッピングなど) */
  forbidden: string[];
  /** 検査したステージ対象の数 */
  checked: number;
}

/** ビルド成果物 (dist/data) がステージ計画を満たし、公開してはならないものを含まないか検査する */
export function findStagingProblems(plan: StagingEntry[], distDataDir: string): StagingProblems {
  const missing = plan.filter((e) => !fs.existsSync(path.join(distDataDir, e.to))).map((e) => e.to);

  const forbidden: string[] = [];
  for (const rel of FORBIDDEN_DIST_PATHS) {
    if (fs.existsSync(path.join(distDataDir, rel))) forbidden.push(rel);
  }
  forbidden.push(...findCsvFiles(distDataDir));

  return { missing, forbidden, checked: plan.length };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): number {
  const command = process.argv[2];
  const root = process.cwd();
  const dataDir = path.resolve(root, 'data');
  const publicDataDir = path.resolve(root, 'dashboard/public/data');
  const distDataDir = path.resolve(root, 'dist/data');

  if (command === 'stage') {
    if (!fs.existsSync(dataDir)) {
      console.log('ℹ️ No data/ directory found. Nothing to stage.');
      return 0;
    }
    const { copied } = stageData(dataDir, publicDataDir);
    console.log(`✅ Staged ${copied} file(s) from data/ into dashboard/public/data/ (allow-list: index, error-log, processed/*).`);
    return 0;
  }

  if (command === 'verify') {
    const profileProblems = publicationProfileProblems();
    if (profileProblems.length > 0) {
      console.error('❌ The publication profile (SDD-17 §7) disagrees with the Pages staging configuration:');
      for (const p of profileProblems) console.error(`   - ${p}`);
      return 1;
    }
    const plan = planStaging(dataDir);
    if (plan.length === 0) {
      console.log('ℹ️ No staged data to verify (data/ has no publishable files yet).');
      return 0;
    }
    if (!fs.existsSync(distDataDir)) {
      console.error('❌ dist/data/ does not exist. Run the build before verifying the Pages artifact.');
      return 1;
    }
    const problems = findStagingProblems(plan, distDataDir);
    if (problems.missing.length > 0) {
      console.error(`❌ ${problems.missing.length} staged file(s) are missing from the build output (they would 404 on Pages):`);
      for (const m of problems.missing.slice(0, 20)) console.error(`   - ${m}`);
    }
    if (problems.forbidden.length > 0) {
      console.error('❌ The build output contains files that must never be published:');
      for (const f of problems.forbidden.slice(0, 20)) console.error(`   - ${f}`);
    }
    if (problems.missing.length > 0 || problems.forbidden.length > 0) return 1;
    console.log(`✅ Pages artifact verified: all ${problems.checked} staged file(s) are present and nothing private is published.`);
    return 0;
  }

  console.error('Usage: tsx scripts/pages-staging.ts <stage|verify>');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
