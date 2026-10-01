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
│   │   ├── raw/YYYY/MM/copilot_metrics_YYYY-MM-DD.json
│   │   ├── raw/YYYY/MM/copilot_seats_YYYY-MM-DD.json
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

データはすべて日毎・月毎にイミュータブル（不変・追記型）に配置され、**データ蓄積は上限なく無期限に継続**される。

```
data/
├── raw/                              # APIから取得した未加工Rawデータ (無期限・日次追記)
│   └── 2026/
│       ├── 09/
│       │   ├── 2026-09-01-metrics.json
│       │   ├── 2026-09-01-seats.json
│       │   ├── 2026-09-01-cost-centers.json
│       │   └── ...
├── reports/                          # GitHubからエクスポートされた月次利用レポートCSV (無期限追記)
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
│   ├── deep-analysis/
│   │   ├── 2026-08.json              # 月次ディープ分析（高度診断）アーカイブ
│   │   └── 2026-09.json
│   └── reports/
│       ├── 2026-08.json              # 月次レポート集計済みデータ
│       └── 2026-09.json
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
  - `npm run demo:generate`: 2026年最新仕様の完全なLive Metrics DEMOデータセットを `data/demo/` および `dashboard/public/data/demo/` に生成。
  - `npm run demo:sync [-- --push]`: 隔離された一時ワークツリーを経由して `data/demo/` を `copilot-data` ブランチへ安全にコミット・反映（`main` ブランチは一切無変更）。

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
  "data_retention_days": 365,
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
