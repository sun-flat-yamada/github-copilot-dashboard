#!/usr/bin/env tsx
/**
 * GitHub Copilot User Mapping — GPG Decrypt (>48KB workaround)
 *
 * `scripts/encrypt-user-mapping.ts` で作成した GPG (対称鍵/AES256) 暗号化ブロブを復号する。
 * CI (.github/workflows/copilot-analysis-cron.yml) からは --passphrase-env で
 * COPILOT_USER_MAPPING_PASSPHRASE Secret を渡し、非対話的に実行される。
 * ローカルでの動作確認時は --passphrase-env を省略すれば GnuPG が対話的にパスフレーズを求める。
 *
 * 【復号後に期待される出力ファイル形式】
 *   復号処理自体はバイト列をそのまま復元するため形式には依存しないが、この出力ファイルは
 *   最終的に COPILOT_USER_MAPPING_FILE として src/collector/attribute-resolver.ts (AttributeResolver) に
 *   渡される。AttributeResolver が解釈できるのは以下の2形式のみ
 *   (詳細: docs/specifications/04_user_attribute_mapping_spec.md 第3章):
 *     1. JSON: UserAttributeMapping のオブジェクト配列 (推奨)
 *     2. CSV : ヘッダー行付き (github_user,display_name,department,cost_center_override,notes,tags)
 *   復号完了後、検出したフォーマット (レコード数・列・tags有無) を標準出力に表示する。
 *
 * 使い方:
 *   npm run mapping:decrypt -- <input.gpg> <output-file> [--passphrase-env <ENV_VAR_NAME>]
 *
 * 例:
 *   npm run mapping:decrypt -- data/config/copilot-user-mapping.json.gpg ./mapping.json
 *   npm run mapping:decrypt -- data/config/copilot-user-mapping.json.gpg /tmp/mapping.json --passphrase-env COPILOT_USER_MAPPING_PASSPHRASE
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { inspectMappingContent, formatInspectionSummary } from './mapping-format-utils.js';

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function checkGpgAvailable(): void {
  const check = spawnSync('gpg', ['--version'], { stdio: 'pipe' });
  if (check.error || check.status !== 0) {
    fail(
      'GnuPG (gpg) コマンドが見つからないか動作していません。GitHub-hosted ubuntu-latest ランナーには標準搭載されています。' +
        'ローカルで使う場合は https://gnupg.org/download/ などからインストールしてください。'
    );
  }
}

function parseArgs(argv: string[]): { positional: string[]; passphraseEnvName?: string } {
  const positional: string[] = [];
  let passphraseEnvName: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--passphrase-env') {
      passphraseEnvName = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith('--')) {
      positional.push(argv[i]);
    }
  }
  return { positional, passphraseEnvName };
}

function main() {
  console.log('=====================================================');
  console.log('🔓 GitHub Copilot User Mapping — GPG Decrypt (>48KB workaround)');
  console.log('=====================================================');

  const { positional, passphraseEnvName } = parseArgs(process.argv.slice(2));

  if (positional.length < 2) {
    console.error('❌ Usage: npm run mapping:decrypt -- <input.gpg> <output-file> [--passphrase-env <ENV_VAR_NAME>]');
    console.error(
      '   Example (CI, non-interactive): npm run mapping:decrypt -- data/config/copilot-user-mapping.json.gpg ' +
        '/tmp/mapping.json --passphrase-env COPILOT_USER_MAPPING_PASSPHRASE'
    );
    console.error(
      '   Example (local, interactive):  npm run mapping:decrypt -- data/config/copilot-user-mapping.json.gpg ./mapping.json'
    );
    console.error('');
    console.error('   復号後のファイルはJSON (UserAttributeMapping[]) またはCSVである必要があります。');
    console.error('   詳細: docs/specifications/04_user_attribute_mapping_spec.md 第3章・第6章');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), positional[0]);
  const outputPath = path.resolve(process.cwd(), positional[1]);

  if (!fs.existsSync(inputPath)) {
    fail(`Encrypted input file not found: ${inputPath}`);
  }

  checkGpgAvailable();

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  console.log(`📄 Input:  ${inputPath}`);
  console.log(`🔓 Output: ${outputPath}`);

  let result;
  if (passphraseEnvName) {
    const passphrase = process.env[passphraseEnvName];
    if (!passphrase) {
      fail(`環境変数 "${passphraseEnvName}" が未設定、または空です。`);
    }
    console.log(`🔑 環境変数 "${passphraseEnvName}" のパスフレーズを使用します (非対話/CIモード)。`);
    result = spawnSync(
      'gpg',
      ['--batch', '--yes', '--pinentry-mode', 'loopback', '--passphrase-fd', '0', '-o', outputPath, '-d', inputPath],
      { input: passphrase, stdio: ['pipe', 'inherit', 'inherit'] }
    );
  } else {
    console.log('🔑 --passphrase-env が指定されていないため、GnuPG が対話的にパスフレーズを求めます。');
    result = spawnSync('gpg', ['-o', outputPath, '-d', inputPath], { stdio: 'inherit' });
  }

  if (result.error || result.status !== 0 || !fs.existsSync(outputPath)) {
    fail('復号に失敗しました。パスフレーズと暗号化ファイルの内容を確認してください。');
  }

  // 復号済み平文ファイルの権限を可能な範囲で絞る (POSIX環境のみ有効。Windowsでは無視される)
  try {
    fs.chmodSync(outputPath, 0o600);
  } catch {
    // ignore — best effort only
  }

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`✅ 復号が完了しました: ${outputPath} (${sizeKb} KB)`);

  console.log('');
  const decryptedContent = fs.readFileSync(outputPath, 'utf-8');
  const inspection = inspectMappingContent(decryptedContent, outputPath);
  for (const line of formatInspectionSummary(inspection)) {
    console.log(line);
  }
  if (inspection.format === 'unknown') {
    console.log('   (AttributeResolver は JSON/CSV 以外の形式を解釈できません。COPILOT_USER_MAPPING_FILE として使う場合は内容を確認してください)');
  }
}

main();
