# Walkthrough: プライバシー階層と保持期間ポリシー (P4-6 / #202)

## 変更の要約
- **発行プロファイル** `src/domain/privacy-profile.ts`: 発行物ごとに階層（`aggregate-only` / `identified`）・Pages 配信可否・保持の扱いを宣言。`checkProfileConsistency` が `STAGED_PROCESSED_DIRS` / `FORBIDDEN_DIST_PATHS` との食い違いを返す。`evaluateIdentifiedGate`（仮名化、または `COPILOT_ALLOW_IDENTIFIED_REPORTS=true`）。
- **レポート定義**: `privacy_tier: identified` を受け付け（未知の階層は拒否）、生成はゲート必須（閉じていれば `refused`・exit 1・何も書かない）。出力 `index.json` に `privacy_tier` を記録。ワークフローは仮名化の変数・明示許可を渡す。
- **保持期間** `src/processor/retention.ts`（純関数）/ `src/application/pipeline/retention.ts` / `src/cli/retention.ts`: 既定 60 か月（`COPILOT_DATA_RETENTION_MONTHS`、12〜600）。`retention:plan` はドライラン、`retention:apply -- --execute --confirm <カットオフ月>` のみ削除。`processed/**` は列挙しない。Raw / CSV 原本は締め済みの月のみ。シンボリックリンクは追跡しない。意図を `audit/retention/log.json` に先に記録。
- **検査**: `pages:verify` にプロファイル整合、`fork:verify` に「Publication Profile」（整合・`dashboard/public/data` の混入・`identified` 出力のゲート・保持超過の警告）。公開範囲の検査と `COPILOT_ALLOW_PUBLIC_DATA` は変更なし。
- **ドキュメント**: SDD-17 §6.3 / §6.5 / §6.6 と新 §7（階層・プロファイル・ゲート・検査）/ §8（保持）、SDD-04 §5.4、SDD-05 §2.11、SECURITY.md（EN/JA）。ワークフローに保持のドライラン。

## 受け入れ基準
- [x] 発行プロファイルと階層の宣言・検査（`privacy-retention.test.ts`）
- [x] 保持期間ポリシー（ドライラン既定、削除記録、確定月次は保持）
- [x] SDD-04 / SDD-05 / SDD-17 / SECURITY を日英で同期（SECURITY.md は英語のみの既存運用）
- [x] 品質ゲート

## 品質ゲート
`npm run typecheck`、`npm test`（1076 件）、`npm run secret-scan`、`npm run lint` は成功。`fork:verify` / `build` / `pages:verify` の結果は PR の本文に記載。

## 判断と制約
- `identified` に新しいセクション種別は足していない（現状のセクションはすべて集計）。階層は宣言の上限とゲートの仕組み。
- 削除したファイルは `copilot-data` の Git 履歴に残る（履歴の書き換えは本ツールの範囲外。SDD-17 §8.3 に明記）。
- 保持の実行は CI では行わない（運用者の明示操作）。日次ワークフローはドライランと警告のみ。
