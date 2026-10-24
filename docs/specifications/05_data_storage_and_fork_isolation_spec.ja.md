[English](05_data_storage_and_fork_isolation_spec.md) | [日本語](05_data_storage_and_fork_isolation_spec.ja.md)

---

# SDD-05: データ永続化 & Fork非競合ストレージ仕様書 (Data Storage & Fork Isolation)

- **文書番号**: SPEC-COPILOT-005
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. Fork競合問題の本質と解決アプローチ

### 1.1 発生する課題 (The Fork Conflict Problem)
多くのオープンソースや企業内テンプレートでは、自動化ボット（GitHub Actions）がコミットしたデータファイルが原因で以下の致命的な問題が生じる：
1. **本家更新の取り込み不能**:
   Fork先リポジトリで日々の集計データが `main` ブランチにコミットされると、本家（Upstream）のコード更新を取り込む `git merge upstream/main` やGitHub UIの「Sync Fork」ボタンで激しいマージコンフリクトが発生し、同期が失敗する。
2. **PR時のデータ混入**:
   Fork先から本家にバグ修正や機能追加のPull Requestを作成する際、蓄積されたデータファイルの差分がPRに含まれてしまい、レビューやマージを妨げる。

### 1.2 本システムの3層分離アーキテクチャ (Three-Tier Isolation)

```
[Repository Branch Architecture]
├── main (Code Only Branch)
│   ├── src/
│   ├── dashboard/
│   └── .github/workflows/
│       (※ データファイルは一切コミットしない)
│
├── copilot-data (Dedicated Orphan Data Branch — 実データ専用)
│   ├── data/
│   │   ├── raw/YYYY/MM/YYYY-MM-DD-raw.json (その日の metrics + seats + cost centers)
│   │   ├── reports/monthly/YYYY-MM/copilot_monthly_usage_YYYY-MM.csv (月次利用レポートCSV)
│   │   ├── processed/daily/YYYY-MM-DD.json
│   │   ├── processed/monthly/YYYY-MM.json
│   │   ├── processed/reports/YYYY-MM.json (月次レポート集計済みデータ)
│   │   └── index.json (利用可能な日付・月・スコープ・レポート一覧メタデータ)
│
├── copilot-data-mock (Dedicated Orphan Data Branch — モック/シミュレーションデータ専用)
│   └── data/                          (実データと同一のディレクトリ構造。ただしモック実行毎に
│                                        force-resetされる。詳細は1.3節参照。実データ運用からは
│                                        一切参照・マージされない)
│
└── GitHub Pages (Direct Artifact Deploy)
    └── actions/deploy-pages による直接配信 (gh-pages ブランチへのコミット競合なし)
        実データ運用時のみビルド・デプロイされる。モック実行はPagesへ一切公開しない (1.3節参照)
```

### 1.3 モック/実データブランチ分離

シミュレーション（モック/デモ）データと、認証情報から取得した実データは、**完全に独立した2つのオーファンブランチ**に保存され、ダミーデータが実運用履歴を汚染・混同・上書きすることを構造的に防止する。

| 観点 | `copilot-data` (実データ) | `copilot-data-mock` (シミュレーションデータ) |
|---|---|---|
| 生成元 | ライブの Copilot Metrics/Seats API + 月次利用レポートCSVインポート | `MockDataGenerator` (`MOCK_MODE=true`) |
| 書き込み方式 | 追記型 — 過去履歴を復元した上で新規パーティションをコミット | **Force-reset** — 実行毎に新しいオーファンブランチを作成しforce-push |
| 履歴の保持 | 恒久的に保持（実運用記録として価値がある） | 保持しない — 実行毎に30日分のシミュレーションバンドルが全量再生成されるため、過去のモックコミットを保持する分析上の価値がなく、ブランチ肥大化を招くのみ（この肥大化問題は過去の修復作業で実際に検出・解消済み） |
| GitHub Pagesデプロイからの参照 | あり — 本番公開ダッシュボードは常に `copilot-data` からビルドされる | **なし** — `MOCK_MODE=true` の場合、`copilot-analysis-cron.yml` はSPAビルド・GitHub Pagesデプロイの各ステップを完全にスキップするため、シミュレーションデータが本番サイトに公開されることはない |
| 選択方法 | デフォルト (`MOCK_MODE` 未設定/`false`) | `MOCK_MODE=true` Actions Variable、または `workflow_dispatch` の `mock_mode` 入力 |

この設計は、(a) 単一ブランチ内でモック/実データをサブディレクトリ分割する方式や、(b) コミットにモードタグを付与する方式などの代替案と比較検討した上で採用した。完全に独立したオーファンブランチには以下の利点がある:
- `data/` 内の既存パーティション構造を一切変更せずに済む（両ブランチとも同一構造）。
- 分離の検証が容易（`git log copilot-data -- data/` にモック実行のコミットが混入することは構造上あり得ない）。
- モックブランチを安全にforce-push/リセットでき、実データの履歴を誤って書き換えるリスクがない。
- ワークフロー内で単一の `DATA_BRANCH` 環境変数（`MOCK_MODE=='true'` なら `copilot-data-mock`、それ以外は `copilot-data`）として一元的に実装でき、ワークフローロジックの重複が不要。

`scripts/verify-fork-health.ts` (`npm run fork:verify`) は `copilot-data-mock` の有無を `info` レベルのチェックとして報告するのみで、健全性判定（pass/warn/fail）には一切影響しない。モックブランチはモックモードを一度も使用していない環境では存在しなくて当然であるため。

---

## 2. ストレージディレクトリ構造 & パーティショニング

データはすべて日毎・月毎にイミュータブル（不変・追記型）に配置され、データ蓄積は保持ポリシーだけが上限になる（`raw/`・原本 CSV・`audit/` は既定 60 か月、`processed/` は失効しない。§2.11、SDD-17 §8）。

```
data/
├── raw/                              # APIから取得した未加工Rawデータ (日次追記。月次締め後、保持期間を過ぎると失効。SDD-17 §8)
│   └── 2026/
│       ├── 09/
│       │   ├── 2026-09-01-raw.json   # 1 日 1 ファイル: { collected_at, date, metrics, seats, cost_centers }
│       │   └── ...
├── reports/                          # GitHubからエクスポートされた月次利用レポートCSV (追記。保持は raw/ と同じ)
│   └── monthly/
│       ├── 2026-08/
│       │   └── copilot_monthly_usage_2026-08.csv
│       └── 2026-09/
│           └── copilot_monthly_usage_2026-09.csv
├── processed/                        # 分析スコープごとに事前計算されたデータ
│   ├── daily/                        # 直近30日間の日次3軸集計・費用配賦済みデータ
│   │   ├── 2026-09-01.json
│   │   └── ...
│   ├── monthly/                      # 無期限蓄積・月次集計データ
│   │   ├── 2026-08.json
│   │   └── 2026-09.json
│   ├── custom/
│   │   └── latest-30d.json           # 直近30日間の推移トレンドデータ
│   ├── trends/
│   │   └── rolling-1year.json        # 直近1年分の推移トレンド集約データ (SPA高速読込用)
│   ├── closes/                       # 月次締めのスナップショットと改訂履歴 (P4-2, SDD-17 §3)
│   │   ├── index.json
│   │   └── 2026-08.json
│   ├── deep-analysis/
│   │   ├── 2026-08.json              # 月次ディープ分析（高度診断）アーカイブ
│   │   └── 2026-09.json
│   └── reports/
│       ├── 2026-08.json              # 月次レポート集計済みデータ
│       └── 2026-09.json
└── audit/                            # 監査データ（利用者単位・請求由来）。Pages には配信しない (P4-3 / P4-4, SDD-17 §4, §5)
    ├── seat-events/
    │   └── 2026-09.json              # シート監査イベント（検出日の月）
    ├── billing-reconciliation/
    │   └── 2026-09.json              # 月ごとの請求突合 (P4-4, SDD-17 §5)
    ├── report-outputs/
    │   ├── index.json                # 定義駆動レポートの生成物の一覧 (P4-5, SDD-17 §6)
    │   └── monthly-cost-summary/2026-08.{md,csv}
    └── exports/                      # 権限のある閲覧者向けの CSV 出力
```

### 2.1 DEMO専用データ格納パーティション (`data/demo/`)

実エンタープライズのGitHub API認証情報を持たない環境での即時デモ表示、機能評価、およびCIテストを安定して実施可能にするため、独立データブランチ `copilot-data` 配下にDEMO専用の格納場所 `data/demo/` を配置する：

```
copilot-data (独立データ永続化ブランチ)
├── data/
│   ├── raw/                           # 実運用のAPI生レスポンス (Append-Only)
│   ├── processed/                     # 実運用の集計スコープデータ
│   ├── reports/                       # 実運用の月次利用レポートCSV
│   ├── index.json                     # 本番用メタデータインデックス
│   └── demo/                          # 🌟 DEMO専用シミュレーションデータセット
│       ├── raw/                       # DEMO用API生レスポンスフィクスチャ
│       ├── reports/                   # DEMO用月次利用レポートCSVフィクスチャ
│       ├── processed/                 # DEMO用集計スコープ (daily, monthly, custom, trends, deep-analysis, reports)
│       ├── index.json                 # DEMO用メタデータインデックス (is_mock_mode: true)
│       └── error-log.json             # DEMO用診断エラー・警告ログ
```

#### DEMO動作時の参照切り替え仕様
- **SPAフロントエンド動的解決**: 読み込むディレクトリは **明示的に** 選ぶ: (a) URLクエリパラメータ（`?demo=true` / `?mock=true` / `?mode=demo` / `?data=demo`）、(b) 環境変数 `VITE_MOCK_MODE=true`、(c) ヘッダーのバッジ、または実データを読み込めないときに表示される「デモデータを表示」ボタン。DEMO を選んだ場合、データ参照ベースパスを `./data/` から `./data/demo/` へ切り替える。
- **暗黙のデモフォールバックの禁止 (C-06)**: 実データの該当ファイルが無い（デプロイされなかった過去月、index.json の取得失敗、収集結果が空）場合に、黙ってデモデータへ切り替えては **ならない**。SPA はエラー / 「ライブ利用データなし」の状態を表示し、デモを見るための明示的なボタンを添える。
- **DEMO とみなす条件**: データが `data/demo/` のパスから読み込まれた、**または** その `index.json` が `is_mock_mode: true`（`MOCK_MODE` で生成されたデータ）を宣言している場合に限る。リポジトリの所有者名、シート数 0、データ日数 0 などからは DEMO と推測しない。取得に失敗した・未設定の実運用データはデモデータではない。DEMO データの表示中は、画面最上部のバナーでその旨を示す。
- **ヘッダーバッジ対話切替**: ヘッダー上のバッジは、反対のモードへ明示的に切り替える（`DEMO (Mock)` をクリックすると実データへ、`LIVE` をクリックするとデモデータへ）。
- **データ生成・同期コマンド**:
  - `npm run demo:generate`: 2026年最新仕様の完全な自動収集DEMOデータセット（Auto-collected DEMO Dataset）を `data/demo/` および `dashboard/public/data/demo/` に生成。
  - `npm run demo:sync [-- --push]`: 隔離された一時ワークツリーを経由して `data/demo/` を `copilot-data` ブランチへ安全にコミット・反映（`main` ブランチは一切無変更）。

#### DEMO の表示パターン網羅
DEMO データは決定的 (seed 固定) に生成し、全ての表示パターンを画面で確認できるようにする。`src/application/pipeline/demo-history.ts` は `MOCK_MODE` のときだけ動き、実データでは動かない。
- **履歴**: 過去 23 か月 (+当月) の月次スコープ、11 か月の月次利用レポート、5 か月の Deep Analysis。`2026-01` (1 年の窓の中) と `2025-03` (前年同月) を意図的に欠かし、トレンドで `closed` / `provisional` / `missing` の各月と、前年あり・なし両方の前年同月比を確認できる。
- **月次締め**: 1 か月 (`2026-04`) を確定後に改訂した履歴 (理由・担当・差分)。確定済みの月は再実行しても書き換えない。DEMO の月次締めは実行日ではなく DEMO の基準日 (`2026-09-10T00:00:00Z`、`demoMonthCloseAt()`) で判定し、いつ生成しても DEMO の当月 `2026-09` は `provisional` になる。DEMO の確定・改訂の時刻は基準日から決め、表示用の時刻 (`generated_at`・ソース状態・品質履歴) は実行時刻のままとする (#305、SDD-17 §3)。
- **データ品質**: `quality/history.json` に `ok` / `warning` / `error` の実行、欠損日、隔離を含む。最新の実行は `warning` で、傾向は `recovered`。
- **ソースと issue**: `index.json` の `source_status` は `ok` / `partial` / `failed`、issue は重大度・分類の異なる見本 (実際の障害ではない)。
- **シートと予算**: シートは `active` / `low_active` / `idle` / `never_used` / `onboarding` とプラン未確定を含み、Cost Center 予算は `normal` / `warning` / `exceeded` を網羅する。モデル名は現行のモデルカタログ (`src/processor/model-catalog.ts`) に従い、最新の構成 (`gpt-6-astra` / `claude-fable-5-1` / `claude-opus-5-5` / `claude-sonnet-5` / `gpt-5-4-mini` / `gemini-3-8-flash`) を使う。トークン単価表は `scripts/benchmark-data/benchmark-records.json` と一致させる。ユーザー別プロファイル (月次スコープと Deep Analysis アーカイブ) には属性マッピングのタグ・部署・Cost Center を付与し、どの画面でもタグ絞り込みが効く。
- `npm run demo:generate` は再生成の前に前回の DEMO 生成物 (`processed/` / `quality/` / `audit/` / `raw/`) を削除する。網羅性は `src/tests/demo-data.test.ts` で検査する。

### 2.2 永続ストレージ階層 (`processed/`) と SPA公開パスの二重構造および同期規約 (ナレッジ・再発防止)

永続化ストレージ（`copilot-data` ブランチ）と、Web配信用の静的ホスティング領域（`dashboard/public/data/` およびビルド成果物 `dist/data/`）では、ディレクトリ構造の設計目的が異なるため、以下の不整合防止規約を遵守する：

#### 1. ディレクトリ構造の役割分担
- **永続ストレージ (`copilot-data`)**: 生データ (`raw/`) と集計済みデータ (`processed/`) を明確に分離する目的で、スコープ別集計データは `data/processed/{monthly,daily,custom,reports,trends,deep-analysis}/` 配下に格納される（DEMOデータも同様に `data/demo/processed/` 配下に格納）。
- **SPA公開領域 (`dashboard/public/data/` および `dist/data/`)**: Webブラウザからのフェッチ高速化とクリーンな相対URL設計のため、集計データは `monthly/`, `reports/` など公開ルート直下にフラット展開される。

#### 2. CI/CD ステージング規約 (`copilot-analysis-cron.yml`)
GitHub Actions による GitHub Pages ビルド直前のステージング処理では、`data/demo/` をそのままコピーするだけでなく、必ず **`processed/` 配下のファイル群を公開ディレクトリ直下へもフラット展開** しなければならない：
```bash
mkdir -p dashboard/public/data/demo
# 1. ルート直下のメタデータ (index.json, error-log.json 等) をコピー
cp -r data/demo/* dashboard/public/data/demo/
# 2. 永続ストレージの processed/* を公開ルート直下にフラット展開 (二重配置)
if [ -d "data/demo/processed" ]; then
  cp -r data/demo/processed/* dashboard/public/data/demo/
fi
```

#### 2a. 実データのステージングと配信物の検証 (`scripts/pages-staging.ts`)
ワークフローは DEMO パーティションに加えて、**実データ** の `data/` もステージする。以前は `data/demo` しかステージされず、過去月（`processed/monthly`・`reports`・`deep-analysis`）が Pages に配信されず、SPA がデモデータへフォールバックしていた（C-06）。

- `npm run pages:stage`: `data/` から **許可リスト** のものだけを `dashboard/public/data/` へコピーする（`processed/*` は上記の規約どおりフラットに展開）。対象は `index.json`、`error-log.json`、`processed/{monthly,reports,deep-analysis,trends,custom}/*.json`、および `processed/daily/<日付>.json`（`index.json` の `available_days` に載っている日だけ。UI から到達できる範囲）。
- **公開しないもの**: `raw/`（未加工の API 応答）、`reports/`（取り込んだ CSV の原本）、`config/`（暗号化済みユーザーマッピング）、その他すべて。
- `npm run pages:verify`: ビルドの **後** に実行し、(1) ステージ対象のファイルが `dist/data/` に無い（Pages で 404 になる）、または (2) `dist/data/` に `raw/`・`config/`・`reports/monthly/`・`.csv`（架空データの `demo/` を除く）が含まれる場合にジョブを失敗させる。
- DEMO のステージング工程は従来どおり維持する（`cp -r data/demo/* ...` と `processed/*` のフラット展開）。デモは `/data/demo/` 配下で配信できる。

#### 3. フロントエンドの候補パス解決 (`pathResolver.ts`)
フロントエンドは、**選択中のモード** について単一のURLに依存しない。`getCandidateDataUrls` は以下を返す：
1. **公開ルート直下パス** (例: `/github-copilot-dashboard/data/monthly/2026-09.json`。DEMO モードでは `.../data/demo/...`)
2. **永続ストレージ互換パス** (例: `/github-copilot-dashboard/data/processed/monthly/2026-09.json`。`copilot-data` の配置との後方互換)

反対のモード (LIVE <=> DEMO) のパスは、既定では候補に **含めない**。明示的なオプトイン (`includeAlternateMode: true`) でのみ追加でき、SPA はこれを使わない。

#### 4. サブディレクトリホスティング & 末尾スラッシュ非依存のURL解決
GitHub Pages 等のサブディレクトリ環境において、末尾スラッシュの有無（例: `/repo` vs `/repo/`）に関わらず、ブラウザがドメインルートへ誤解決しないよう、`window.location.pathname` からベースパスを算出して解決する。

---

### 2.3 Raw Landing と Run Manifest (P1-2)

ライブ収集の実行 (run) ごとに、受け取った HTTP 応答を**不変**で保存する。ロジックの変更や不具合の修正のあと、API を呼び直さずに同じ入力から成果物を作り直せる (`npm run pipeline:reprocess`)。

```
data/raw/landing/
├── manifests/<run_id>.json            # run ごとに 1 つの Run Manifest (1 回だけ書き、上書きしない)
└── objects/<aa>/<sha256>.json|ndjson  # 応答本文。内容ハッシュ名 (同じ内容は 1 回だけ保存)
```

- **Run Manifest** (`RunManifest`、`src/domain/entities/run-manifest.ts`): `run_id` (時刻順。例 `20261003T041500Z-ab12`)、`api_version`、収集設定 `config` (Enterprise / Org のスラッグと取得したレポート日。個人情報は含まない)、リクエストごとの `entries[]`。各 entry は正準化した `request`、`kind` (`json` / `paginated` / `download`)、`outcome` (`ok` / `empty` / `error`)、`status`、`fetched_at`、`ok` のときは `object` のパス・`sha256`・`bytes`。エラーは要約 (名前・ステータス・切り詰めたメッセージ) だけで、本文は残さない。
- **署名は保存しない**: 署名付きのレポート URL (`download_links`) はクエリ文字列を除いて保存し、ダウンロードはホスト + パスをキーにする。署名は短命の資格情報であり、永続化しない。
- **重複排除**: 30 日の窓は確定済みの同じ日を毎回取り直す。内容ハッシュ名なので、変化のないレポートは追加の保存量が増えない。
- **匿名化モードでは保存しない。** Raw 本文には実名のログイン名・氏名が含まれ、仮名化できない。`ANONYMIZE_USERS=true` (およびモックモード) では Raw Landing を書かず、`index.json` にも `run` を付けない。
- **`index.json` の `run`**: `{ run_id, reprocessed? }`。成果物の元になった run を示す (`pipeline:reprocess` では `reprocessed: true`)。run を保存しなかった場合 (または manifest を書けなかった場合。その run は再処理できない) は付けない。
- **再処理** (`npm run pipeline:reprocess [-- --run <run_id>]`、省略時は最新の run) は、再生用クライアント (`ReplayFetcher`) 経由で、収集と同じ「取得 → 正規化 → 集計」のコードに 1 つの run を流す。**通信はしない**。run が行わなかったリクエストを要求した場合は `ReplayMissError` で明示的に失敗し、記録された失敗は同じ失敗として再生される。既存の `raw/YYYY/MM/*-raw.json` は書き換えない。
- **未対応**: 複数 run を結合した長期の履歴 (1 回の窓を超えるバックフィル)、保持期間・削除 (§2.11 と SDD-17 §8 で仕様化、P4-6)、正準ファクト (`schema_version`) の再生成 (P1-3)。
- `raw/` は公開しない: `pages:stage` は許可リスト方式で、`pages:verify` は `dist/` に含まれていれば失敗とする。

### 2.4 正準ファクト契約 v1 (P1-3)

ソースごとの形 (Reports の `users-1-day`、シート、CSV、AI Credits) を、版管理された**正準ファクト** (`src/domain/facts/`) へ写す。API 変更の影響は取込層に閉じ込め、集計・ビューはこの契約だけに依存する (Phase 2 の Dataset 層の入力)。

| ファクト | 粒度 |
| :--- | :--- |
| `fact.usage_user_daily` | 日 × ユーザー (合計、`used_*` フラグ、`ai_credits_used`) |
| `fact.usage_user_feature_daily` | 日 × ユーザー × 機能 × モデル (内訳。ソースに無い軸は `null`) |
| `fact.usage_org_daily` | 日 × スコープ (Enterprise / Org): サーフェス別の利用者数 |
| `fact.seat_snapshot` | スナップショット日 × ユーザー (`plan_type` は `unknown` を許容) |
| `fact.cost_line` | 日 × ユーザー(任意) × SKU × モデル (P1-5 で取り込む) |

規約:

- 全ファクトに `schema_version` (リテラル、現在 `1`)、`source` (`api` / `csv` / `derived`)、`quality` (`measured` / `estimated` / `missing` / `demo`) を持たせる。互換を壊す変更は版を上げる。
- **欠損は `0` ではなく `null`。** 全指標が `null` の行は `quality: "missing"`。
- 合計と内訳は別ファクトとし、合算しても二重計上にならない。内訳行はソースが返す最も細かい粒度 (モデル × 機能、無ければ機能) だけを採る。
- `user_key` は呼び出し側が解決する (匿名化モードでは仮名 ID)。実名・メールはファクトに書かない。
- スキーマは zod で定義し (`schemas.ts`)、JSON Schema は `npm run schema:facts` で `docs/schemas/facts/` に生成する。コミット済みファイルと生成結果が異なると `npm test` が失敗する。
### 2.5 データ品質レポートの履歴 (P1-7)

ライブ収集の実行ごとに**データ品質レポート** (`DataQualityReport`、`src/domain/entities/data-quality.ts`) も作り、`data/processed/quality/history.json` に追記する (配信時は `quality/history.json`。新しいものが末尾、最大 90 件。再処理した run は同じ `run_id` のエントリを置き換える)。

- 内容 (件数・日付・ソース名のみ。ログイン名や値は含めない): `window`、`missing_days` (要求したレポート日のうち 1 件も取得できなかった日)、`duplicates_collapsed` (Enterprise と Org の重複。情報のみ)、`out_of_range` (要求した日と異なる日付の行)、`quarantined` (検証に失敗した行。範囲外を除く)、`malformed_lines`、ソース別 `status`、`level`。
- `level`: ソースが失敗なら `error`。一部取得のソース・欠損日・隔離 / 範囲外の行・破損行があれば `warning`。それ以外は `ok`。
- `index.json` の `data_quality` に、最新の level・件数・`trend` (`first` / `unchanged` / `degraded` / `recovered`)・`previous_level`・`last_change_at`・`history_file` を持つ。`run_id` でエントリを Run Manifest (§2.3) に結び付ける。
- モックと、ライブ収集をしなかった実行 (未設定・失敗) では記録せず、前回の履歴と要約を維持する。
- このファイルは `pages:stage` の許可リストに入る (`STAGED_PROCESSED_DIRS` に `quality` を含む)。

### 2.6 1 年推移ファイル (`trends/rolling-1year.json`, P3-6)

実行のたびに、保存済みの `processed/monthly/{YYYY-MM}.json` から構成する（当月のスナップショットを全月へ複写しない: B-01）。既存フィールドは残し、スキーマ版 2 で次を追加する。

| フィールド | 意味 |
|:--|:--|
| `schema_version` | `2`。無いファイルは旧形式で、SPA はグラフを出さず「新形式で出力されていません」と表示する |
| `window` | `points` の対象暦月 `{ start, end }`。`end` は保存済みの最新月 |
| `close_rule` | 宣言された締めのルール（SDD-06 §4.6） |
| `points` | **暦月で連続した 12 か月（古い順）。** 保存済み集計が無い月は `status: "missing"`・`entry: null`・前年比も null の点として残し、0 で補完せず、黙って落とさない。各点に `status`（`closed` / `provisional` / `missing`）、`closes_on`、`entry`、`prior_month`、`yoy` を持つ |

`months` / `trends`（保存済みの直近 12 か月。連続とは限らない）は互換のため残す。前年同月を比較に使えるよう、24 か月前までの月次集計を読む。ファイルは全社値のみ（個人別データなし）で、`pages:stage` の許可リスト（`trends`）に載る。締め済み月のスナップショット凍結・チェックサム・改訂版は月次締め（§2.7）の責務で、このファイルには含めない。`points[].status` は確定スナップショットがあるときだけ `closed` になる。

### 2.7 月次締めファイル (`closes/`, P4-2)

`processed/closes/{YYYY-MM}.json` は締め済みの月の確定した数値（SHA-256 チェックサム・元の版・差分つきの改訂履歴）、`processed/closes/index.json` は月ごとの要約を持つ。数値・日付・チェックサムのみで（個人別データなし）、`ForkSafeStorage.saveMonthClose` が書き、`pages:stage` の許可リスト（`STAGED_PROCESSED_DIRS` に `closes`）に載る。規則（SDD-17 §3）:

- 確定月の `processed/monthly` / `processed/reports` は、数値が違うパイプライン実行・再処理では**上書きしない**。明示的に改訂する（`npm run pipeline:reprocess -- --revise <月> --reason "..."`）場合だけ更新し、保留した変更は `month-close:{月}` の issue になる。
- 元の `closed` 版は書き換えない。改訂は理由・実行 ID・時刻・差分つきで追記する。
- `npm run month:verify` は、保存済みの数値が改訂の記録なしに現在の版と違うと失敗する。
- ファイルは `data/processed/` の他のファイルと同じく `copilot-data` に置く（`main` には置かない）。

### 2.8 シート監査ファイル (`audit/seat-events/`, P4-3)

`audit/seat-events/{YYYY-MM}.json` は、`raw/` の日次シートスナップショットから生成したシート監査イベントを持つ（SDD-17 §4）。`processed/` と違い**利用者単位のデータ**なので、`processed/` の外に置き、`pages:stage` の許可リストには**載せず**、`dashboard/public/data/` へも複製せず、`dist/data/` に `audit` があれば `pages:verify` が失敗する。`ForkSafeStorage.saveSeatAuditMonth` が書き、`copilot-data` の `raw/` と同じ場所に置く（リポジトリと同じ公開範囲。`fork:verify` の公開範囲検査が守る。`main` には置かない）。

### 2.9 請求突合ファイル (`audit/billing-reconciliation/`, P4-4)

`audit/billing-reconciliation/{YYYY-MM}.json` は、Billing API から収集した日別の AI Credits の数量・金額と、突合に使った版・許容差を持つ（SDD-17 §5）。実際の請求額に由来するため `audit/` の規則に従う: `processed/` の外に置き、`pages:stage` の許可リストには**載せず**、`dashboard/public/data/` へも複製せず、`dist/data/` に `audit` があれば `pages:verify` が失敗する。利用者・組織・Cost Center の識別子は持たない。`ForkSafeStorage.saveBillingReconciliationMonth` が書き、`copilot-data` に置く（`main` には置かない）。

### 2.10 定義駆動レポートの出力 (`audit/report-outputs/`, P4-5)

`audit/report-outputs/{report_id}/{period}.{md,csv}` と `audit/report-outputs/index.json` は、`reports/*.yaml` から生成したレポートを持つ（SDD-17 §6）。定義は Cost Center・組織・部署でグループ化できるため、出力は `audit/` の規則に従う: `processed/` の外に置き、`pages:stage` の許可リストには**載せず**、`dashboard/public/data/` へも複製せず、`dist/data/` に `audit` があれば `pages:verify` が失敗する。集計のみ（利用者単位の行なし）で、`ForkSafeStorage.saveReportOutput` / `saveReportOutputIndex` が書き、`copilot-data` に置く（`main` に置くのは `reports/` の定義だけ）。

### 2.11 保持期間ポリシーのファイル (`audit/retention/`, P4-6)

`audit/retention/log.json` は保持期間の実行ごとの記録（SDD-17 §8）: run_id・時刻・保持月数・カットオフ・カテゴリ別の削除した件数 / 月 / ID / バイト数・スキップ・エラー（個人情報なし）。`audit/` の規則に従い（`processed/` の外、`pages:stage` の許可リストに**無く**、`dist/data/` にも `main` にも置かない）、保持期間によって自身が削除されることもない。保持期間（既定 60 か月、`COPILOT_DATA_RETENTION_MONTHS`）は、期限切れの月の `raw/`（日次パーティション・Run Manifest・参照されなくなった landing の object）、`reports/monthly/`（CSV 原本）、`audit/seat-events/`、`audit/billing-reconciliation/`、`audit/report-outputs/` を削除する。**`processed/**` は削除せず**、特に `processed/closes/` の確定スナップショットと改訂履歴（§2.7）は残す。Raw・CSV 原本は、その月が締め済みになってから削除する。全パスの階層と Pages への配信可否を宣言する発行プロファイルは SDD-17 §7.2。

## 3. インデックスメタデータ (`index.json`) 仕様

ダッシュボードSPAが起動時に最初に読み込み、利用可能な「日」「月」「期間」「アーカイブ」の選択肢を提供するメタデータ。
`available_months` は過去1年間（最大12カ月）をローリング提供し、`all_recorded_months` は無期限蓄積された全記録月を保持する。

```json
{
  "repository": {
    "owner": "proud-corp",
    "name": "github-copilot-dashboard",
    "is_fork": false
  },
  "generated_at": "2026-09-10T00:30:00Z",
  "data_retention_months": 60,
  "is_mock_mode": false,
  "source_status": [
    { "source": "metrics", "status": "failed", "records": 0,
      "last_attempt_at": "2026-09-10T00:30:00Z", "last_success_at": "2026-09-09T00:30:00Z",
      "error": "HTTP 503 from /enterprises/…/copilot/metrics" },
    { "source": "seats", "status": "ok", "records": 160,
      "last_attempt_at": "2026-09-10T00:30:00Z", "last_success_at": "2026-09-10T00:30:00Z" },
    { "source": "cost_centers", "status": "skipped", "records": 0,
      "last_attempt_at": "2026-09-10T00:30:00Z", "last_success_at": null }
  ],
  "privacy": { "anonymized": false, "contains_user_level_data": true },
  "available_months": ["2026-09", "2026-08", "2026-07"],
  "all_recorded_months": ["2026-09", "2026-08", "2026-07", "2025-12", "2025-11"],
  "available_days": [
    "2026-09-09",
    "2026-09-08",
    "2026-09-07"
  ],
  "available_reports": ["2026-09", "2026-08"],
  "rolling_1year_trend_file": "processed/trends/rolling-1year.json",
  "deep_analysis_months": ["2026-09", "2026-08"],
  "default_scopes": {
    "latest_day": "2026-09-09",
    "latest_month": "2026-09",
    "latest_report": "2026-08",
    "latest_range": {
      "start": "2026-08-11",
      "end": "2026-09-09"
    }
  },
  "summary": {
    "total_seats": 160,
    "active_seats_30d": 138,
    "idle_seats_30d": 22,
    "total_monthly_spend_usd": 6240.00,
    "idle_waste_spend_usd": 858.00
  }
}
```

`data_retention_months` は保持ポリシーの月数（`COPILOT_DATA_RETENTION_MONTHS`、既定 60、SDD-17 §8.1）で、About モーダルが表示する。表示用であり、削除は `retention:apply` が行う。旧項目 `data_retention_days`（固定の 365）は非推奨で、もう出力しない。旧項目しかない `index.json` は既定の 60 か月として表示する。

### 3.0 ソース別ステータス・Last-known-good・`is_mock_mode` の意味

パイプラインは独立した 3 つのソースを収集する: `metrics`（利用状況）、`seats`（シート割り当て）、`cost_centers`。実行ごとに、ソース別の状態を `source_status` に記録する。

| `status` | 意味 |
|---|---|
| `ok` | 取得成功 |
| `partial` | 取得できたが、一部のレコードを隔離（検証失敗）した、または件数が一致しなかった |
| `failed` | 取得に失敗した（API エラー、トークン未設定、複数 Org のうち一部が失敗 など） |
| `skipped` | 設定が無い・対象外（認証情報なし、Org 単体運用での Cost Center など）。**障害ではない** |

`last_success_at` はそのソースが最後に成功した時刻。`failed` / `skipped` のソースでは、**前回の `index.json` から引き継ぐ**（一度も成功していなければ null）。SPA はステータスバナーで、失敗とこの時刻を表示する。

**Last-known-good の規則** — 失敗を「空」に変えない：
- `seats` が失敗 → 前回の月次スコープと前回の `summary` を維持する。空のシート一覧で上書きしない。
- `metrics` が失敗 → シート・費用の分析は利用状況メトリクスに依存しないため、そのまま実行する。当月スコープは最新のシートから作り、利用状況のセクション（受諾率・チャット・日次推移・言語別・エージェント集計）は **前回成功時のスコープから引き継ぎ**、`usage_metrics: { availability: "carried_over", as_of }` を付ける。前回値が無い場合は `null` と `usage_metrics.availability: "unavailable"`（UI は 0% ではなく「—（取得不可）」と表示）。日次・期間スコープはメトリクスが無い回は再生成せず、前回のファイルを維持する。
- すべてのソースが失敗 → 前回の成果物をすべて維持し、`source_status` に各失敗を記録する。

**`is_mock_mode`** が `true` になるのは、パイプライン自身が `MOCK_MODE`（`--mock` / `--demo`）で実行されたときに **限る**。取得失敗、未設定のデプロイ、シート数 0 では反転しない。

**`privacy`**（`anonymized`, `contains_user_level_data`）は、`npm run fork:verify` の公開範囲の検査（SDD-04 §5.3）が参照する。`contains_user_level_data` は、シート・個人別利用・取り込んだレポートを含む実データで `true`（前回までの成果物は維持されるため、後の実行が失敗しても `true` のまま）。デモデータでは `false`。

### 3.1 空データ状態の表現（ライブ認証情報が未設定の場合）

`COPILOT_ENTERPRISE`/`COPILOT_ORGS` が未設定、または設定された認証情報に Enterprise Owner/Org Admin 権限が無い場合でも、パイプラインは中断・捏造データの生成を行わず、有効な `index.json` を生成し続ける:

```json
{
  "available_months": [],
  "available_days": [],
  "available_reports": [],
  "default_scopes": {},
  "summary": {
    "total_seats": 0,
    "active_seats_30d": 0,
    "idle_seats_30d": 0,
    "total_monthly_spend_usd": 0,
    "idle_waste_spend_usd": 0
  },
  "issues": [
    {
      "severity": "warning",
      "category": "api_auth",
      "target": "config:copilot-metrics",
      "message": "COPILOT_ENTERPRISE and COPILOT_ORGS are both unset — skipping live Copilot Metrics collection."
    }
  ]
}
```

- `default_scopes.latest_day`/`latest_month`/`latest_range` は、ライブメトリクスが存在しない場合は捏造したプレースホルダ日付ではなく単純に省略される。
- `available_months`/`available_days` が空であっても、独立してインポートされた月次利用レポートCSV (`npm run import:report`) があれば `available_reports` に反映される — CSVベースのレポート機能は Copilot Metrics/Seats の認証情報に一切依存しないため。
- ダッシュボードSPA (`dashboard/src/App.tsx`) はこの状態 (`noLiveData`) を検知し、固定のフォールバック月表示やクラッシュではなく、認証情報に依存しない機能（CSVレポート、AIモデルベンチマーク）が引き続き利用可能であることを説明する案内バナーを表示する。バナーには明示的な **「デモデータを表示」** ボタンを添える。SPA が自動でデモデータへ切り替えることはない。
- このとき各ソースの `source_status` は `skipped`（未設定）または `failed`（トークン未設定など）になり、「収集できたが該当データが無い」状態と区別できる。

---

## 4. Gitワークフローと同期プロトコル (Zero Fork Conflict Protocol)

> 以下の手順は簡潔さのため `copilot-data` と表記しているが、実際のワークフローでは対象ブランチは `$DATA_BRANCH`（`MOCK_MODE=='true'` の場合は `copilot-data-mock`、それ以外は `copilot-data`）として一度だけ計算される。1.3節を参照。

1. **データ復元フェーズ (`git archive` 抽出)**:
   - ワークフロー内で `git fetch origin copilot-data` を実行。
   - 作業ブランチ（`main` 等）のインデックスや HEAD を一切変更しないよう、`git archive origin/copilot-data data | tar -x` によりデータファイルのみを安全に展開。
   - `main` ブランチの Git ステージング領域へのデータ混入を物理的に 0% に抑制。
2. **データ保存フェーズ (完全隔離一時リポジトリ方式)**:
   - メイン作業ツリー（`$GITHUB_WORKSPACE`）のブランチ切り替え（`git checkout`）は一切行わない。
   - `mktemp -d` で生成した完全独立の一時ディレクトリ（`DATA_WORK_DIR`）にのみ `copilot-data` をクローン/初期化。
   - 一時ディレクトリ内でコミット & プッシュを完結させた後、一時ディレクトリを破棄。
   - これにより、ブランチ名のハードコード（`main` / `master` の差異）に起因する障害や、エラー中断時に HEAD が取り残される事故を根絶。
3. **Fork運用時の無競合保証**:
   - **Sync Fork 時**: Fork 先の `main` ブランチにはデータファイルが一切存在しないため、Upstream（本家）のコード更新を「Sync Fork」ボタンで 100% Fast-Forward / クリーンマージ可能。
   - **Pull Request 時**: Fork 先から本家 `main` への PR にデータ差分が 1 行たりとも混入せず、純粋なコード変更のみを提出可能。
   - **GitHub Pages デプロイ時**: `gh-pages` ブランチへのコミットを行わず `actions/deploy-pages`（Direct Artifact Deployment）を採用しているため、Pages デプロイに伴うブランチ競合も一切生じない。
4. **Fork運用保守・同期詳細仕様**:
   - Fork先における詳細な本家同期手順、Zero-Code Customization、2層ブランチモデル、および健全性診断（`npm run fork:verify`）については、[SDD-12 (Fork先変更反映 & 運用保守仕様書)](12_fork_sync_and_customization_ops_spec.ja.md) および専用スキル（`skills/fork-sync-ops/`）を参照のこと。
