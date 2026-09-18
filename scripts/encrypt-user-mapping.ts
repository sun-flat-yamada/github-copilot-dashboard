#!/usr/bin/env tsx
/**
 * GitHub Copilot User Mapping — GPG Encrypt (>48KB workaround)
 *
 * GitHub Secrets / Variables には個々の値につき 48KB のサイズ上限があるため
 * (参照: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions#storing-large-secrets)、
 * 大規模な COPILOT_USER_MAPPING を扱う場合は本スクリプトでファイルを GPG (対称鍵/AES256) 暗号化し、
 * 暗号化済みブロブのみを `copilot-data` オーファンブランチ (data/config/ 配下) にコミットする。
 * パスフレーズだけを小さな Secret (COPILOT_USER_MAPPING_PASSPHRASE) として登録すれば、
 * ワークフロー側 (.github/workflows/copilot-analysis-cron.yml) が実行時に自動復号する。
 *
 * このワークアラウンドにより、平文マッピングのサイズは実質無制限になる
 * (Secret に格納するのはパスフレーズのみのため)。
 *
 * 【対応入力ファイル形式】
 *   GPG暗号化そのものは任意のファイル/バイト列に適用できるため、入力ファイルの形式に技術的な制限はない。
 *   ただし、復号後に src/collector/attribute-resolver.ts (AttributeResolver) が内容を正しく解釈できるのは
 *   以下の2形式のみ (詳細: docs/specifications/04_user_attribute_mapping_spec.md 第3章):
 *     1. JSON: UserAttributeMapping のオブジェクト配列 (推奨)
 *              例: [{ "github_user": "...", "display_name": "...", "tags": ["Contractor"] }]
 *     2. CSV : ヘッダー行付き (github_user,display_name,department,cost_center_override,notes,tags)
 *              tags列は ";" 区切りで複数値を1セルに格納 (例: "Contractor;Remote")
 *   実行時にこの2形式のいずれかとして入力ファイルを簡易判定し、検出結果 (レコード数・列・tags有無) を
 *   標準出力に表示する。判定できない場合も暗号化自体は続行するが、警告を表示する。
 *
 * 使い方:
 *   npm run mapping:encrypt -- <input-file> [output-file] [--push]
 *
 * 例:
 *   npm run mapping:encrypt -- _sensitive-data/copilot-user-mapping.draft.json
 *   npm run mapping:encrypt -- _sensitive-data/copilot-user-mapping.draft.json --push
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import { inspectMappingContent, formatInspectionSummary } from './mapping-format-utils.js';

const DATA_BRANCH = 'copilot-data';
const DEST_SUBPATH = 'data/config';
const SIZE_LIMIT_BYTES = 48 * 1024;

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function checkGpgAvailable(): void {
  const check = spawnSync('gpg', ['--version'], { stdio: 'pipe' });
  if (check.error || check.status !== 0) {
    fail(
      'GnuPG (gpg) コマンドが見つからないか動作していません。先にインストールしてください:\n' +
        '   - Windows: https://gnupg.org/download/ (または "winget install GnuPG.GnuPG")\n' +
        '   - macOS:   brew install gnupg\n' +
        '   - Ubuntu/Debian (GitHub-hosted ubuntu-latest ランナーには標準搭載): sudo apt-get install gnupg'
    );
  }
}

function pushEncryptedFileToDataBranch(outputPath: string): void {
  console.log('');
  console.log(`🚀 Publishing encrypted mapping to '${DATA_BRANCH}' branch (Fork-Safe Protocol)...`);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mapping-gpg-push-'));

  try {
    const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();

    try {
      execSync(`git clone --branch ${DATA_BRANCH} --single-branch --depth 1 "${remoteUrl}" "${tempDir}"`, {
        stdio: 'pipe',
      });
    } catch {
      execSync(`git init "${tempDir}"`, { stdio: 'pipe' });
      execSync(`git -C "${tempDir}" checkout --orphan ${DATA_BRANCH}`, { stdio: 'pipe' });
      execSync(`git -C "${tempDir}" remote add origin "${remoteUrl}"`, { stdio: 'pipe' });
    }

    const destDir = path.join(tempDir, ...DEST_SUBPATH.split('/'));
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(outputPath, path.join(destDir, path.basename(outputPath)));

    execSync(`git -C "${tempDir}" add ${DEST_SUBPATH}/`, { stdio: 'inherit' });

    let hasChanges = true;
    try {
      execSync(`git -C "${tempDir}" diff --cached --quiet`);
      hasChanges = false;
    } catch {
      hasChanges = true;
    }

    if (!hasChanges) {
      console.log('ℹ️  変更なし (既存の暗号化ファイルと同一) — コミットをスキップします。');
    } else {
      execSync(`git -C "${tempDir}" commit -m "chore(mapping): update encrypted user mapping [skip ci]"`, {
        stdio: 'inherit',
      });
      execSync(`git -C "${tempDir}" push origin ${DATA_BRANCH}`, { stdio: 'inherit' });
      console.log(
        `🎉 Successfully pushed encrypted mapping to '${DATA_BRANCH}' branch at ${DEST_SUBPATH}/${path.basename(outputPath)}!`
      );
    }
  } catch (e: any) {
    console.warn(`⚠️  '${DATA_BRANCH}' ブランチへの自動プッシュに失敗しました:`, e.message);
    console.log('ℹ️  docs/specifications/04_user_attribute_mapping_spec.md の手順で手動コミットしてください。');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  console.log('=====================================================');
  console.log('🔐 GitHub Copilot User Mapping — GPG Encrypt (>48KB workaround)');
  console.log('=====================================================');

  const rawArgs = process.argv.slice(2);
  const pushToRemote = rawArgs.includes('--push');
  const positional = rawArgs.filter((a) => !a.startsWith('--'));

  if (positional.length === 0) {
    console.error('❌ Usage: npm run mapping:encrypt -- <input-file> [output-file] [--push]');
    console.error('   Example: npm run mapping:encrypt -- _sensitive-data/copilot-user-mapping.draft.json');
    console.error('');
    console.error(
      `   --push   暗号化後、${DEST_SUBPATH}/<basename>.gpg として '${DATA_BRANCH}' ブランチへ自動コミット&プッシュします。`
    );
    console.error('');
    console.error('   対応入力形式: JSON (UserAttributeMapping[]、推奨) または CSV (ヘッダー行付き)。');
    console.error('   詳細: docs/specifications/04_user_attribute_mapping_spec.md 第3章・第6章');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), positional[0]);
  if (!fs.existsSync(inputPath)) {
    fail(`Input file not found: ${inputPath}`);
  }

  const outputPath = positional[1] ? path.resolve(process.cwd(), positional[1]) : `${inputPath}.gpg`;

  const inputSizeBytes = fs.statSync(inputPath).size;
  console.log(`📄 Input:  ${inputPath} (${(inputSizeBytes / 1024).toFixed(1)} KB)`);
  console.log(`🔒 Output: ${outputPath}`);
  if (inputSizeBytes > SIZE_LIMIT_BYTES) {
    console.log(
      'ℹ️  入力ファイルは GitHub Secrets/Variables の 48KB 上限を超えています — まさに本ワークアラウンドが解決する対象です。'
    );
  }

  console.log('');
  const inputContent = fs.readFileSync(inputPath, 'utf-8');
  const inspection = inspectMappingContent(inputContent, inputPath);
  for (const line of formatInspectionSummary(inspection)) {
    console.log(line);
  }
  if (inspection.format === 'unknown') {
    console.log('   (暗号化は続行しますが、意図したファイルかどうかを確認してください)');
  }

  checkGpgAvailable();

  console.log('');
  console.log('🔑 GnuPG がこの後パスフレーズの入力を求めます (入力内容は表示されません)。');
  console.log('   このパスフレーズは COPILOT_USER_MAPPING_PASSPHRASE として登録する必要があるため必ず控えてください。');
  console.log('');

  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  const encrypt = spawnSync('gpg', ['--symmetric', '--cipher-algo', 'AES256', '-o', outputPath, inputPath], {
    stdio: 'inherit',
  });

  if (encrypt.error || encrypt.status !== 0 || !fs.existsSync(outputPath)) {
    fail('GPG 暗号化に失敗しました。上記の gpg 出力を確認してください。');
  }

  const outputSizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log('');
  console.log(`✅ 暗号化が完了しました: ${outputPath} (${outputSizeKb} KB)`);

  if (pushToRemote) {
    pushEncryptedFileToDataBranch(outputPath);
  }

  console.log('');
  console.log('📋 次のステップ:');
  if (!pushToRemote) {
    console.log(`   1. 暗号化済みファイルを '${DATA_BRANCH}' ブランチの ${DEST_SUBPATH}/ 配下にのみコミットしてください`);
    console.log('      (main / fork/custom などのコードブランチには絶対にコミットしないでください)。');
    console.log('      このコマンドに --push を付けて再実行すると自動化できます。');
  } else {
    console.log(`   1. 上記で '${DATA_BRANCH}' ブランチへの反映が完了しています。`);
  }
  console.log('   2. パスフレーズをリポジトリ Secret として登録してください (値は小さいため48KB制限に抵触しません):');
  console.log('      gh secret set COPILOT_USER_MAPPING_PASSPHRASE');
  console.log('   3. .github/workflows/copilot-analysis-cron.yml が実行時に自動で復号します。');
  console.log('   詳細: docs/specifications/04_user_attribute_mapping_spec.md');
}

main();
