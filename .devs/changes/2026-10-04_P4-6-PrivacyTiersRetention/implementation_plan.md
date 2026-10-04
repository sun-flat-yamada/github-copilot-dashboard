# プライバシー階層と保持期間ポリシー (P4-6 / #202)

親 Issue: #175（Phase 4）。指摘 E-05。前提 P1-2（Raw Landing / Run Manifest）と P4-2（月次締め）はマージ済み。オーナー決定: Raw の保持は 5 年（60 か月、`data_retention` 既定 60 か月）。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 4 点（発行プロファイルと階層の宣言・検査 / 保持期間ポリシー / SDD 日英同期 / 品質ゲート）に限定する。

> [!WARNING]
> 公開範囲と破壊的操作の判断（`security-zero-leakage.md` §2.3）
> - `fork:verify` の公開範囲チェック（`COPILOT_ALLOW_PUBLIC_DATA` を含む）は弱めない・迂回しない。階層の検査は追加の検査であり、既存の検査を置き換えない。
> - `privacy_tier: identified` の拒否は、「宣言できる」ところまで緩める。生成には明示のゲート（仮名化モード、または `COPILOT_ALLOW_IDENTIFIED_REPORTS=true` の明示許可）が要り、満たさなければ生成を拒否して理由を出す。`identified` の出力も Pages へは配信しない（`audit/` は `FORBIDDEN_DIST_PATHS`）。
> - 保持期間の削除は破壊的。**ドライランが既定**、実行は `--execute --confirm <カットオフ月>` の明示操作、`processed/`（確定済み月次 `closes/` と改訂履歴を含む）は削除対象に入れない、確定していない月の Raw・CSV 原本は削除しない、削除は `audit/retention/log.json` に記録する（意図を先に記録してから削除）。`main` ブランチ汚染（`data/` が追跡されている）の checkout では実行を拒否する。デモデータは対象外。

## 設計
### 1. 発行プロファイル（`src/domain/privacy-profile.ts`, 純データ + 純関数）
- 階層: `aggregate-only`（個人・利用者単位の行を含まない）/ `identified`（ログイン・氏名・部署などの利用者単位の行を含み得る）。
- 発行物ごとの宣言表 `PUBLICATION_PROFILE`: パス（`data/` 相対）・階層・Pages への配信可否・保持の扱い（`raw` / `audit` / `retained`）。`STAGED_PROCESSED_DIRS` と `FORBIDDEN_DIST_PATHS` はこの表と矛盾してはならない（検査 = 宣言と実際の配信設定の食い違いで失敗）。
- ゲート `evaluateIdentifiedGate(env)`: 仮名化モード（`ANONYMIZE_USERS=true` かつ `ANONYMIZE_SECRET` 16 文字以上）か `COPILOT_ALLOW_IDENTIFIED_REPORTS=true`。

### 2. 検査
- `pages:verify`: `FORBIDDEN_DIST_PATHS` を発行プロファイルから導く（`audit` / `raw` / `config` / CSV 原本）。ステージ許可リストの各ディレクトリが「Pages 配信可」と宣言されていることを検査。
- `fork:verify`（オフライン）: 「発行プロファイル」検査を追加（宣言とステージ設定の一致、`audit/report-outputs/index.json` の `identified` 出力がゲートを満たすか、`dashboard/public/data/` に `audit` 等が無いか、保持期限超過の件数を警告）。ネットワークの公開範囲検査はそのまま。
- レポート出力の `index.json` に `privacy_tier` を記録する。

### 3. 保持期間（`src/processor/retention.ts` 純関数 + `src/application/pipeline/retention.ts` + `src/cli/retention.ts`）
- 設定: `COPILOT_DATA_RETENTION_MONTHS`（整数、12〜600、既定 60）。不正値は既定に戻し理由を表示。
- 期限: 現在の月を含む直近 N か月を保持。`now の月 − 対象月 >= N` が期限切れ。
- 対象（月単位）: `raw/YYYY/MM/`（日次 Raw）、`raw/landing/manifests/{run_id}.json` と、残る manifest から参照されなくなった `raw/landing/objects/`、`reports/monthly/YYYY-MM/`（CSV 原本）、`audit/seat-events/`、`audit/billing-reconciliation/`、`audit/report-outputs/{id}/{period}.{md,csv}`（`YYYY-Www` は週の木曜日の月）と `index.json` の該当行。
- 常に保持: `processed/**`（`closes/` の確定スナップショット・改訂履歴を含む）、`index.json`、`error-log.json`、`catalog/`、`config/`、`audit/retention/`。
- 保護: Raw と CSV 原本は月次締め済みの月だけ削除（未締めは `skipped: not_closed` として報告）。シンボリックリンクと `data/` 外は触らない。
- CLI: `npm run retention:plan`（ドライラン。何も変更しない。Actions 上では期限超過を `::warning::` で通知）/ `npm run retention:apply -- --execute --confirm <カットオフ月>`。記録 `audit/retention/log.json`（run_id・時刻・保持月数・カットオフ・カテゴリ別の件数とバイト数・削除した月/ID・スキップ・エラー）。
- ワークフロー: 日次に `retention:plan`（`continue-on-error`、ドライランのみ）を追加。実行は運用者が `copilot-data` のチェックアウトで手動。

### 4. 定義検証
- `identified` を受け付ける（`aggregate-only` が既定）。未知の階層は引き続き拒否。生成はゲート必須（満たさなければ `refused`）。

## Proposed Changes
#### [NEW] `src/domain/privacy-profile.ts`、`src/processor/retention.ts`、`src/application/pipeline/retention.ts`、`src/cli/retention.ts`
#### [MODIFY] `src/processor/report-engine.ts`、`src/domain/entities/report-definition.ts`、`src/application/pipeline/report-generation.ts`、`src/cli/reports.ts`（階層とゲート）
#### [MODIFY] `scripts/pages-staging.ts`、`scripts/verify-fork-health.ts`、`package.json`、`.github/workflows/copilot-analysis-cron.yml`
#### [MODIFY] SDD-17 §6.6 / §7（階層・保持）、SDD-04 §5、SDD-05 §2、SECURITY.md（EN/JA）

## Verification Plan
- 単体: 保持期間の期限判定（境界）、対象の列挙、未締め月の保護、`processed/closes` が計画に出ない、ドライランが何も変更しない、`--confirm` 不一致で拒否、記録の内容、週次出力の月判定、orphan object の判定。階層: 宣言表と staging の整合、ゲート、`identified` 定義の検証と生成拒否 / 許可、`fork:verify` 検査の失敗ケース。
- 品質ゲート: `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` + `npm run lint` + `pages:verify`（リベース後にも）。
