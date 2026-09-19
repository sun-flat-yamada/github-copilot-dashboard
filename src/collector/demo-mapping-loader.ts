import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { buildDemoUserMappings, DEFAULT_DEMO_MAPPING_PASSPHRASE } from '../../scripts/generate-demo-mapping-gpg.js';

export const DEMO_GPG_CANDIDATE_PATHS = [
  'fixtures/demo/copilot-user-mapping.demo.json.gpg',
  'data/demo/config/copilot-user-mapping.demo.json.gpg',
  'data/config/copilot-user-mapping.demo.json.gpg',
];

/**
 * GPG暗号化されたDEMOユーザーマッピングファイルを復号してJSON文字列を取得
 */
export function loadDemoUserMapping(projectRoot: string = process.cwd()): string | undefined {
  const passphrase = process.env.COPILOT_DEMO_MAPPING_PASSPHRASE || DEFAULT_DEMO_MAPPING_PASSPHRASE;

  for (const relPath of DEMO_GPG_CANDIDATE_PATHS) {
    const fullGpgPath = path.resolve(projectRoot, relPath);
    if (fs.existsSync(fullGpgPath)) {
      try {
        const decryptResult = spawnSync(
          'gpg',
          [
            '--batch',
            '--yes',
            '--pinentry-mode',
            'loopback',
            '--passphrase-fd',
            '0',
            '-d',
            fullGpgPath,
          ],
          {
            input: passphrase,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          }
        );

        if (decryptResult.status === 0 && decryptResult.stdout && decryptResult.stdout.trim().length > 0) {
          return decryptResult.stdout.trim();
        }
      } catch (e) {
        console.warn(`[DemoMappingLoader] GPG decryption failed on ${relPath}:`, e);
      }
    }
  }

  // 万一GPG実行不可環境でのフォールバック (ビルド定義から生成)
  try {
    return JSON.stringify(buildDemoUserMappings());
  } catch {
    return undefined;
  }
}

/**
 * GPG暗号化DEMOマッピングを復号した一時ファイルパスを作成
 * (COPILOT_USER_MAPPING_FILE としてパイプラインに渡す用)
 */
export function createDecryptedDemoMappingTempFile(projectRoot: string = process.cwd()): string | undefined {
  const content = loadDemoUserMapping(projectRoot);
  if (!content) return undefined;

  const tempFile = path.join(os.tmpdir(), `copilot-user-mapping.demo-decrypted-${Date.now()}.json`);
  fs.writeFileSync(tempFile, content, 'utf-8');
  return tempFile;
}
