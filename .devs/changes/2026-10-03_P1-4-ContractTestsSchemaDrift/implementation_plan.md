# Plan: 契約テストとスキーマドリフト検知 (P1-4)

Issue: #178（親 #172）。A-09 / A-13。

## Proposed Changes
- [NEW] `fixtures/api-contract/*.sample.json`: 匿名化した録画フィクスチャ（users-1-day / seats / cost-centers）と基準 `fingerprints.json`
- [NEW] `src/adapters/github-api/schema-fingerprint.ts`: 指紋の抽出（キーパスと型のみ）、比較、重複防止の署名
- [NEW] `src/adapters/github-api/api-contract-fixtures.ts`: フィクスチャと基準の読み込み
- [NEW] `scripts/schema-drift.ts`（`npm run schema:drift`、`--dry-run` / `--update-baseline` / `--out`）
- [NEW] `.github/workflows/schema-drift.yml`: 週次。差分時に `schema-drift` ラベルの Issue を起票（署名マーカーで重複なし）
- [NEW] `src/tests/adapters/ApiContract.test.ts`
- [MODIFY] SDD-08（日英）

## 未検証（作業環境に Enterprise の PAT が無い）
- 実 API での初回実行（ワークフロー全体）は #210（V-2）に分離。本 Issue の範囲は `--dry-run` と単体テストまで。
