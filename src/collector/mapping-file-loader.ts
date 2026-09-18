import * as fs from 'fs';

/**
 * COPILOT_USER_MAPPING_FILE で指定されたローカルファイル(平文JSON/CSV)を読み込む。
 * GitHub Secrets/Variables の 48KB サイズ上限を超えるマッピングを扱うための
 * GPG暗号化ワークアラウンド (CI上でデコード後のファイルパスを渡す想定) で使用する。
 *
 * Node.js の `fs` に依存するため、意図的に `attribute-resolver.ts` から分離している。
 * `attribute-resolver.ts` はダッシュボードSPA (ブラウザバンドル、例: ReportDropzoneModal.tsx
 * 経由の `new AttributeResolver()`) からも読み込まれるため、`fs` への依存を持ち込むと
 * ブラウザ向けビルドで不要なモジュール外部化が発生してしまう。本モジュールは
 * Node.js専用のCLIエントリポイント (src/cli/run-pipeline.ts) からのみ使用すること。
 *
 * ファイル未指定・不存在・読込エラー時は undefined を返し、呼び出し側で
 * COPILOT_USER_MAPPING / COPILOT_USER_MAPPING_BASE64 へのフォールバックを行うことを想定する。
 */
export function loadUserMappingFromFile(filePath?: string): string | undefined {
  if (!filePath || filePath.trim() === '') {
    return undefined;
  }
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(
        `[AttributeResolver] COPILOT_USER_MAPPING_FILE="${filePath}" was specified but the file does not exist. Falling back to COPILOT_USER_MAPPING / COPILOT_USER_MAPPING_BASE64 if configured.`
      );
      return undefined;
    }
    return fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.warn(`[AttributeResolver] Failed to read COPILOT_USER_MAPPING_FILE="${filePath}":`, e);
    return undefined;
  }
}
