/**
 * DuckDB-WASM の遅延ローダー (判断結果 #4 / ADR-0001)
 *
 * このモジュールだけが `@duckdb/duckdb-wasm` を import する。呼び出し側は必ず
 * `await import('./duckdb/duckdbLoader')` で読み込むこと (静的 import すると、DuckDB 本体と
 * wasm が初期バンドルに入る。src/tests/query-layer.test.ts が検査する)。
 *
 * 用途: 画面で SQL 集計が必要になったとき (ユーザー × 日のファクトに対するグループ集計など)。
 * 通常のフィルター・KPI は ../queryEngine の純粋関数で足りるため、ここは呼ばれない。
 */

import * as duckdb from '@duckdb/duckdb-wasm';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// 配信サイズ (wasm は約 34 MB) を抑えるため、例外処理 (EH) 対応ビルドだけを同梱する。
// EH は現行の主要ブラウザ (Chrome / Edge / Firefox / Safari) がすべて対応している。
// 型は mvp を必須とするが、EH 非対応ブラウザでは selectBundle が mvp を選ぶ。その場合は mvp が無く
// 初期化に失敗する (getDuckDb は reject し、呼び出し側が SQL なしの表示に落とす)。
const BUNDLES = {
  eh: { mainModule: ehWasm, mainWorker: ehWorker },
} as unknown as duckdb.DuckDBBundles;

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

/** DuckDB-WASM を初期化する。2 回目以降は同じインスタンスを返す。失敗時は次回やり直せる */
export function getDuckDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundle = await duckdb.selectBundle(BUNDLES);
      const worker = new Worker(bundle.mainWorker!);
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

/** JSON のレコード配列をテーブルとして登録する (既存の同名テーブルは置き換える) */
export async function registerRows(table: string, rows: Array<Record<string, unknown>>): Promise<void> {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  const db = await getDuckDb();
  const fileName = `${table}.json`;
  await db.registerFileText(fileName, JSON.stringify(rows));
  const conn = await db.connect();
  try {
    await conn.query(`DROP TABLE IF EXISTS ${table}`);
    await conn.insertJSONFromPath(fileName, { name: table });
  } finally {
    await conn.close();
  }
}

/** SQL を実行し、行の配列で返す */
export async function runSql<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const db = await getDuckDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    return result.toArray().map((r) => r.toJSON() as T);
  } finally {
    await conn.close();
  }
}
