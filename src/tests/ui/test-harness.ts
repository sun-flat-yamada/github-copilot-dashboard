import './dom-setup.js';
import { createAutoCollectedTestDataset } from '../fixtures/auto-collected-data-fixtures.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IndexMetadata } from '../../types/copilot.js';
import { createViewRegistry, type ViewRegistry } from '../../../dashboard/src/views/viewRegistry.js';

/**
 * UI 挙動テスト用の fetch スタブ。`/data/...` への GET を、メモリ上のデータセットから返す。
 * 登録の無い URL は 404 (本物の静的配信と同じ。別モードのデータへ黙って切り替わらないことの検証にも使う)。
 */
export interface FakeDataServer {
  requested: string[];
  restore: () => void;
}

export function installFakeDataServer(files: Record<string, unknown>): FakeDataServer {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(url, 'http://localhost/').pathname;
    requested.push(pathname);
    if (pathname in files) {
      return new Response(JSON.stringify(files[pathname]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return {
    requested,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** 固定データセット (13 ユーザー) を `baseDir` 配下に配置するファイルマップへ変換する */
export function buildFileMap(baseDir: '/data' | '/data/demo', overrides: Partial<IndexMetadata> = {}): Record<string, unknown> {
  const ds = createAutoCollectedTestDataset();
  const files: Record<string, unknown> = {
    [`${baseDir}/index.json`]: { ...ds.indexMeta, ...overrides },
  };
  for (const [key, scope] of Object.entries(ds.monthlyScopes)) files[`${baseDir}/monthly/${key}.json`] = scope;
  for (const [key, scope] of Object.entries(ds.dailyScopes)) files[`${baseDir}/daily/${key}.json`] = scope;
  return files;
}

/** import.meta.glob (Vite 専用) を使わずに、views/<id>/manifest.ts を集めた Registry を作る */
export async function discoverViewRegistry(): Promise<ViewRegistry> {
  const viewsDir = path.resolve(process.cwd(), 'dashboard/src/views');
  const dirs = fs
    .readdirSync(viewsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(viewsDir, d.name, 'manifest.ts')));
  const manifests = await Promise.all(dirs.map(async (d) => (await import(path.join(viewsDir, d.name, 'manifest.ts'))).default));
  return createViewRegistry(manifests);
}
