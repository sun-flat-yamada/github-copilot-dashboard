/** Query 層の公開 API。ビュー / hook はここだけを import する */
export * from './filterEngine';
export * from './queryEngine';
export { buildFilteredModelBreakdown } from './reportModelBreakdown';
// DuckDB-WASM はここから再エクスポートしない (静的 import すると初期バンドルに入る)。
// 使うときは `import('./duckdb/duckdbLoader')` で遅延ロードする。
