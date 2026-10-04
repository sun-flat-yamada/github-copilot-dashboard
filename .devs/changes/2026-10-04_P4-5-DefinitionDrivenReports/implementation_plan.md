# 定義駆動レポート（reports/*.yaml）と定期生成 (P4-5 / #201)

親 Issue: #175（Phase 4）。指摘 E-04（レポート出力が限定的で、新しい集計の追加にコードが要る）を解消する。前提 P2-2（Query 層）と P3-1（指標カタログ）はマージ済み。契約は親計画の付録 A.7.3（`ReportDefinition`）。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 5 点（Report Engine と定義スキーマ・サンプル定義 / 定義 1 件の追加だけで新レポートが生成されるテスト / 定期生成ワークフロー / SDD-17 日英同期 / 品質ゲート）に限定する。

> [!WARNING]
> 公開範囲の判断（`security-zero-leakage.md` / `storage-and-data-routing.md`、SDD-17 §5.6）
> - 生成物（Markdown / CSV）は `data/audit/report-outputs/{report_id}/{period}.{md,csv}` に置く。`audit/` は `FORBIDDEN_DIST_PATHS` 登録済みで、許可リスト `STAGED_PROCESSED_DIRS` は変更しない（Pages へは配信しない）。`copilot-data` には `raw/` と同じ可視性で保存される（`fork:verify` の露出チェックは弱めない）。
> - 本タスクで扱うプライバシー階層は `aggregate-only` だけ。`privacy_tier: identified`（利用者単位の行）は P4-6（#202）で仕様化するまで定義の検証で拒否する。利用者行・ログイン・氏名は読まない。
> - サンプル定義・テストの値はすべて架空。定義ファイルに組織名・部署名・個人名を書かせない（フィルターは列と数値の条件だけ）。
> - 依存: YAML の読み込みに `js-yaml`（既に推移依存としてインストール済みの 4.x）を devDependency として明示する。ロックファイルを整合させる。

## 設計
- 定義 `reports/{id}.yaml`（`id` はファイル名と一致）: `id` / `title` / `description?` / `schedule?`（`monthly-close` | `weekly`）/ `dataset`（`monthly` = `processed/monthly`、`reports` = `processed/reports`）/ `privacy_tier`（`aggregate-only`）/ `outputs`（`markdown` | `csv`）/ `sections[]`。
- セクション種別: `kpi`（指標 ID の並び。指標カタログの `METRIC_REGISTRY` に無い ID、そのデータセットに束縛が無い指標は拒否）と `breakdown`（`group_by`: cost_center / organization / department / team（monthly）、cost_center / organization / department / model / sku（reports）、`columns`、`sort_by`、`limit`、`filters[]` = 列 × 比較 × 数値）。
- 検証: zod の strict スキーマ + 意味検証（未知の指標・列・グループ、重複 ID、`identified`、ID とファイル名の不一致）。不正な定義はエラー一覧にし、他の定義の生成は止めない。YAML は安全なスキーマで読み、サイズに上限を設ける。
- 生成: 純関数 `renderReport(definition, document, context)` が指標カタログの `qualify()` で品質属性（実測 / 推定 / 欠損 / デモ）を付けて Markdown と CSV を作る。欠損は「—（理由）」で 0 にしない。CSV は UTF-8 BOM + CRLF、数式インジェクション対策（P4-3 の `escapeCsvCell` を再利用）。
- 定期生成: `monthly-close` = 月次締め済み（`processed/closes`）で出力が無い月、`weekly` = 今週（ISO 週）の出力が無ければ最新の月次集計から作る。`schedule` 無しは手動のみ。出力は冪等（同じ入力は同じ内容）で、`index.json` に生成時刻・入力の月・定義の版（定義の SHA-256）を記録する。
- CLI: `npm run reports:validate`（定義の検証）/ `npm run reports:generate -- [--due] [--id <id>] [--month YYYY-MM] [--demo]`。ワークフローは分析後に `--due` を実行（`continue-on-error`、モックモードでは実行しない）。

## Proposed Changes
#### [NEW] `src/domain/entities/report-definition.ts` — 型・列カタログ・指標束縛の型
#### [NEW] `src/processor/report-engine.ts` — スキーマ検証・読み込み・描画（純関数）
#### [NEW] `src/application/pipeline/report-generation.ts` — 対象判定・保存
#### [MODIFY] `src/storage/fork-safe-storage.ts` / `IStorageWriter` / `ForkSafeStorageWriter` — `audit/report-outputs/` の保存と一覧
#### [NEW] `src/cli/reports.ts`、`package.json`（scripts と devDependency）、`reports/*.yaml`（サンプル 2 件）
#### [MODIFY] `.github/workflows/copilot-analysis-cron.yml` — 定期生成ステップ
#### [MODIFY] SDD-17（EN/JA）§6 を追加し「未仕様の節」を §7 へ。SDD-05（EN/JA）に保存レイアウトを追記

## Verification Plan
- 単体（`src/tests/report-engine.test.ts`）: スキーマ（未知キー・未知の指標・束縛の無い指標・未知の列・`identified`・ID 不一致）、描画（欠損は「—」、デモ品質、CSV の BOM/CRLF/インジェクション、フィルター・ソート・limit）、定期判定（monthly-close / weekly の冪等）。
- 「定義 1 件の追加だけで新レポートが生成される」: 一時ディレクトリに YAML を 1 件置くだけで、コード変更なしに出力が作られること。リポジトリ同梱のサンプル定義が検証を通ること。
- 公開範囲: `audit/report-outputs/` が `pages:stage` に含まれず dist にあれば `pages:verify` が失敗する。
- 品質ゲート: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` + `npm run lint` + `pages:verify`。
