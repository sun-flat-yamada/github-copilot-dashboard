# Walkthrough: ダッシュボード改善 Phase 0（止血）

- **Issue**: [sun-flat-yamada/github-copilot-dashboard#160](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/160)
- **親計画**: [../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md](../2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md)（Phase 0: P0-1〜P0-11）
- **ブランチ**: `claude/exciting-goldberg-5xudi9`（ベース: `main` `bee5e8b`）
- **範囲**: Phase 0 のみ。Phase 1〜4 は親計画の「User Review Required」の判断待ちで、本変更には含めない。

## 1. 何が変わったか（一言で）

「数字が誤っていても気づけない」状態を止めた。取得に失敗した値が「0」や「デモ」に見えること、固定値・合成値が実測のように表示されること、金額・フィルターが経路ごとに食い違うこと、個人情報が公開面に載ることを、コードと文書の両面で解消した。

**この変更でも解決しないこと（誤解防止）**: 旧 Copilot Metrics API の呼び出し（A-01）は Phase 1（P1-1: Usage Metrics Reports API アダプタ）の範囲である。親計画は、旧 API が 2026-04-02 に廃止済みであるという公開情報（一次情報での再確認を推奨）に基づいて、実データ運用の利用状況メトリクス（受諾率・チャット・PR 等）が Phase 1 まで取得できないと見ている。これまでは取得できない値を固定値や按分推定で埋めて「ある」ように見せていたが、本変更後は「—（取得できていません）」と理由を表示し、取得失敗はデータ状態バナーに出す。見かけ上の機能後退であり、親計画の警告事項に記載した過渡状態である。

## 2. 項目別の変更内容と検証

| # | 変更内容 | 主なファイル | 検証（テスト） |
| :--- | :--- | :--- | :--- |
| P0-1 | `test` の glob をクォートし、全テストを実行 | `package.json` | `npm test` が 91 ファイル・652 件を実行（親計画の計測では、従来は 118 件） |
| P0-2 | トークン解決（明示 → `COPILOT_READ_TOKEN` → `GITHUB_TOKEN` → `GH_TOKEN`）、`per_page=100` + `Link` ヘッダーのページング（別オリジンへの追従を拒否）、レコード単位の検証と隔離（値を出力に含めない）、未知の `plan_type` / `organization: null` の保持と警告、Cost Centers の `costCenters` 形式、403 / 429 の分類 | `src/adapters/github-api/**`（`RawApiFetcher`、`GitHubApiCopilotDataSource`、`DomainMapper`、`normalizers/*`、`schemas/*`） | `adapters/GitHubApiCopilotDataSource.test.ts`: 120 席 → 120 件、`unknown` / `null` の保持と警告、隔離、トークン無しは無認証呼び出しをしない |
| P0-3 | ソース別の `SourceStatus`（`ok` / `partial` / `failed` / `skipped`）、失敗ソースが前回成功値を空で上書きしない（Last-known-good を「前回値」として引き継ぎ）、`is_mock_mode` は `MOCK_MODE` のときだけ true | `src/application/pipeline/{PipelineOrchestrator,source-status}.ts`、`src/processor/scope-merge.ts`、`src/storage/fork-safe-storage.ts` | `pipeline-degradation.test.ts`: 全正常 / metrics 失敗・seats 成功 / 前回成功後の失敗 / seats 失敗 / 全失敗 / 初回で何も取れない、`processor/RollingTrendAndCarryOver.test.ts` |
| P0-4 | 固定定数の撤去（受諾率 0.35、CSV 由来のグループ別利用指標、既定のクレジット基準 3,900、セッション・PR・マージ時間の仮定）。1 年トレンドを保存済み月次から月ごとに構成。CSV からの個人プロファイル合成（`deepAnalysisAdapter`）を廃止。評価できない診断パターンは「判定不能」とし、評価済みパターン数が 0 のときはスコアを出さない。ピア平均・採用成熟度のチーム内訳の捏造を廃止。欠損は「—（理由）」で表示 | `src/processor/{rolling-trend,metrics-aggregator,billing-calculator,report-parser,inefficiency-*}.ts`、`src/domain/entities/{copilot,deep-analysis}.ts`、`dashboard/src/hooks/useDeepAnalysisData.ts`、`dashboard/src/components/**`（KPI / 診断 / ビュー） | `processor/RollingTrendAndCarryOver.test.ts`、`domain/Phase0Rules.test.ts`、`report-multi-file-merge.test.ts`、`user-trend-active-source.test.ts`、`deep-analysis-active-source.test.ts` |
| P0-5 | 価格を `src/domain/pricing/pricing-catalog.ts` に集約（シート 19 / 39、クレジット $0.01、プラン別・期間別の包含量）。`0.05` を撤去。予算を `BudgetUtilizationRule.evaluateUsd` に統一。費用をスコープ別 `seatCostForScope` に統一（フィルター適用で日次が月額に変わる不具合の解消）。`plan_type: unknown` は Enterprise と推測せず「未確定」（合計から除外） | `src/domain/{pricing,rules}/**`、`src/domain/value-objects/Money.ts`、`src/application/services/CreditsBillingService.ts`、`dashboard/src/{App.tsx,utils/filterEngine.ts}` | `money-and-filter-consistency.test.ts`（同一入力で全経路の金額が一致）、`domain/Phase0Rules.test.ts` |
| P0-6 | フィルター: 月次レポート再集計の依存配列、未割当センチネルの単一定義（パイプラインの出力ラベルとフィルターを一致）、再集計できないセクションの「全社値（フィルター非対応）」表示。ESLint（`react-hooks/rules-of-hooks` / `exhaustive-deps`）導入。早期 `return` の後ろの Hook 呼び出し（5 コンポーネント）を修正 | `dashboard/src/{hooks/useDashboardData.ts,utils/filterEngine.ts}`、`src/domain/constants/{unassigned,filter-scope}.ts`、`eslint.config.js` | `money-and-filter-consistency.test.ts`（CC 条件だけの変更が KPI に反映される・「未割当」回帰）、`lint-react-hooks.test.ts` |
| P0-7 | `pages:stage`（許可リスト方式で `processed/*` 全量をステージ）と `pages:verify`（過去月の存在・非公開物の不在をビルド成果物で検査）。パス解決の候補から反対モードを除外（暗黙のデモフォールバック廃止）。データ状態バナーと明示的なデモ導線。取得失敗時に読み込み表示が終わらない不具合を修正 | `scripts/pages-staging.ts`、`.github/workflows/copilot-analysis-cron.yml`、`dashboard/src/{utils/{pathResolver,dataStatus}.ts,components/common/DataStatusBanner.tsx,App.tsx,hooks/useDashboardData.ts}` | `pages-staging.test.ts`、`data-status-banner.test.ts` |
| P0-8 | `COPILOT_BILLING_CONFIG` / `ANONYMIZE_USERS` / `ANONYMIZE_SECRET` / `GITHUB_API_VERSION` をワークフローからパイプラインへ結線。不正な設定は issue 化（ヘッダーの警告件数に反映） | `.github/workflows/copilot-analysis-cron.yml`、`src/adapters/{composition-root.ts,storage/BillingConfigLoader.ts}` | `pipeline-degradation.test.ts`（不正な `COPILOT_BILLING_CONFIG` / `COPILOT_COST_CENTER_BUDGETS` が issue になる）、`pages-staging.test.ts`（ワークフローの結線） |
| P0-9 | `SeatClassificationRule` に `onboarding`（付与から 7 日未満の未使用）を新設。遊休の表示基準を判定ロジックと同じ定数（`SEAT_IDLE_CRITERIA_TEXT`）から生成。削減可能額は月額・遊休のみ | `src/domain/rules/{SeatClassificationRule,ScopeCostRule}.ts`、`dashboard/src/components/{KpiSummaryCards,IdleSeatAdvisor,UserDetailTable,CostAllocationCharts}.tsx` | `domain/Phase0Rules.test.ts`、`pipeline-degradation.test.ts`（付与 2 日の未使用席が遊休に含まれない） |
| P0-10 | 同月の複数 CSV を結合して 1 回だけ集計（別ファイル間の重複行を 1 件に集約、同一ファイル内は保持）、`import_summary`、単位の系統（requests / credits / seats …）を分けた集計、日付なし行を「今日」にしない、`tokens` 列の別名衝突を解消 | `src/processor/report-parser.ts`、`src/application/pipeline/PipelineOrchestrator.ts`、`scripts/import-report.ts` | `report-multi-file-merge.test.ts`、`report-parser.test.ts` |
| P0-11 | `ANONYMIZE_USERS` を秘密鍵付き HMAC-SHA256（`ANONYMIZE_SECRET`、16 文字以上、無ければ fail closed）に変更。アバター URL・数値 ID・Raw のシート / Cost Center メンバー・元 CSV を匿名化モードで公開しない。`fork:verify` に公開範囲チェック（リポジトリ API・生の `copilot-data` index・Pages index を匿名で検査。オフラインは警告のみ）。ワークフローで収集前に実行。`index.json` に `privacy` を追加。README / SECURITY に公開リポジトリの注意を明記 | `src/collector/{pseudonymizer,attribute-resolver}.ts`、`src/adapters/storage/AttributeResolverAdapter.ts`、`src/application/pipeline/PipelineOrchestrator.ts`、`scripts/{verify-fork-health,import-report}.ts`、`SECURITY.md`、`README*.md` | `privacy-pseudonymization.test.ts`（鍵なし辞書攻撃で復元できない・出力全体に実 ID が残らない・fail closed）、`fork-health-exposure.test.ts` |

SDD の同期（日英）: SDD-01 / 02 / 03 / 04 / 05 / 06 / 07 / 08 / 09 / 11 / 15、README（日英）、SECURITY、`docs/setup_guide`（日英）、`.agents/rules/{storage-and-data-routing,security-zero-leakage}.md`。SDD-10（正規化方式・データセット版）と SDD-16 / 17 の新設は Phase 3 / 4 の範囲。

## 3. 品質ゲートの結果

| コマンド | 結果 |
| :--- | :--- |
| `npm run fork:verify` | 7 Passed / 0 Failure / 1 Warning（作業ブランチが `main` でない。想定内）。新設の「Public Exposure」検査は匿名のネットワーク検査を実行して合格（このリポジトリは公開だが、公開されているのはデモデータのみ） |
| `npm run typecheck` | 成功 |
| `npm run lint` | 成功（違反 0。意図的な `eslint-disable` は `useDashboardData.ts` の 2 か所で、理由コメント付き） |
| `npm test` | 652 件成功 / 失敗 0（146 スイート、91 ファイル。本変更の新規テストファイルは 11。最新の `main` へ rebase した後の値） |
| `npm run secret-scan` | 385 ファイルをスキャンし、検出 0（最新の `main` で `.devs/changes/` もスキャン対象になった後の値） |
| `npm run build` | 成功。`BillingConfigLoader.ts` の `fs` / `path` externalize 警告は変更前から存在（親計画 C-05 / Phase 2）。メインチャンクは 332.06 kB → 348.81 kB（gzip 83.45 → 89.39 kB）。NFR-5 の目標（300 kB / gzip 80 kB）は変更前から未達で、本変更で 16.75 kB 増えた。バンドル予算は親計画 P2-7 で扱う |
| `npm run pipeline:mock` | 成功（`data/` は .gitignore 対象で、追跡対象ファイルに差分なし） |

## 4. 利用者・運用者への影響（挙動の変更点）

1. **デモは明示操作のときだけ表示される**。取得失敗やデータ未収集のときに、黙ってデモデータへ切り替わらない（エラー表示と「デモデータを表示」ボタン）。ローカルの `pipeline:mock` 運用は、`index.json` の `is_mock_mode: true` を宣言するため従来どおり表示できる。
2. **CSV（月次レポート・アップロード）由来の個人別診断は表示されない**。CSV には個人の日次実績がないため、「月次集計のみ・日次診断不可」と表示する。保存済みの月次ディープ分析アーカイブがある月は従来どおり診断できる。
3. **`ANONYMIZE_USERS=true` には `ANONYMIZE_SECRET` が必須になった**。未設定・16 文字未満ではパイプラインが何も公開せずに停止する（fail closed）。鍵を変えると仮名がすべて変わる。
4. **`npm run fork:verify` が匿名のネットワーク検査を行う**。公開リポジトリ / 公開 Pages で、仮名化されていない実データが公開される場合は失敗する（ワークフローも収集前に停止）。オフライン・レート制限は警告のみ。既知の公開デプロイを受け入れる場合は `COPILOT_ALLOW_PUBLIC_DATA=true`。
5. **`npm test` が全テストを実行する**ため、実行時間が増える（約 14 秒）。さらに ESLint（react-hooks）が `npm test` と CI に加わる。devDependencies に `eslint` / `eslint-plugin-react-hooks` / Babel パーサーを追加したため、`package-lock.json` の差分が大きい。
6. 遊休の定義が、表示と判定で一致した。付与から 7 日未満の未使用席は「導入期間」で、遊休・削減可能額に含まれない。`plan_type` 不明の席は費用が未確定で、合計から除外される。
7. 実データ運用の利用状況メトリクスは、旧 API が廃止済みであれば Phase 1 まで「—」になる（1 章の注記）。取得に失敗した場合は、前回成功した値があれば「前回値」として表示し、なければ「—」と理由を表示する。

## 5. 未検証・暫定の事項（レビューで確認してほしい点）

- **価格カタログの値は暫定**（`PRICING_CATALOG_VERSION = '2026-10-01-provisional'`）。シート $19 / $39、1 クレジット $0.01、包含量（Business 1,900 / Enterprise 3,900、2026-06〜08 の移行プロモーションは 3,000 / 7,000）は、ネットワーク制限により GitHub の公開ドキュメントの本文を直接確認できず、検索結果の要約に基づく。Phase 1 の価格カタログ v1（P1-6）で一次情報と照合して確定する。実データの契約価格は `COPILOT_BILLING_CONFIG` が上書きする。
- `GITHUB_API_VERSION` の既定値 `2026-03-10` と Cost Centers の応答形状（`costCenters` キー）も、公開情報の要約に基づく。契約テスト（P1-4）で固定する。

## 6. 意図的に後続フェーズへ残したもの

- 旧 Metrics API 呼び出しの置換、`metrics-schema.ts` の欠損値の 0 埋め既定、複数 Org の重複排除、レート制限（`Retry-After`）への対応（Phase 1）。
- ユーザー明細の「超過請求 (USD)」列の意味づけ（`table-sorting-and-cost-columns.test.ts` が現状の意味を固定している。KPI・表の再設計と合わせて Phase 3 で扱う）。
- 未マウントの `AppV2` / `DiagnosticService` / `DeepAnalysisPresenter` 経路にある「空のとき 100 点」の既定値（Phase 2 の収束で削除対象）。
- 型情報を使う lint ルール（TypeScript 7 では typescript-eslint が使えない。パーサー選定を ADR で決める。Phase 2 / P2-6）。

## 7. 作業環境

プライマリ作業ツリーで直接作業した。`AGENTS.md` rule 6 は複数エージェント並行時の兄弟 worktree を求めるが、本変更は単一エージェントが使い捨てのクラウドコンテナ（指定ブランチ 1 本）で実施し、並行編集の衝突が起こり得ないためである。Issue → 品質ゲート → PR → Rebase Merge の流れには従った。`main` への直接 push はしていない。
