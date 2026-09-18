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

データはすべて日毎・月毎にイミュータブル（不変・追記型）に配置される。

```
data/
├── raw/                              # APIから取得した未加工Rawデータ
│   └── 2026/
│       ├── 09/
│       │   ├── 2026-09-01-metrics.json
│       │   ├── 2026-09-01-seats.json
│       │   ├── 2026-09-01-cost-centers.json
│       │   └── ...
├── reports/                          # GitHubからエクスポートされた月次利用レポートCSV
│   └── monthly/
│       ├── 2026-08/
│       │   └── copilot_monthly_usage_2026-08.csv
│       └── 2026-09/
│           └── copilot_monthly_usage_2026-09.csv
├── processed/                        # 分析スコープごとに事前計算されたデータ
│   ├── daily/
│   │   ├── 2026-09-01.json           # 日次3軸集計・費用配賦済みデータ
│   │   └── ...
│   ├── monthly/
│   │   ├── 2026-08.json              # 月次集計データ
│   │   └── 2026-09.json              # 当月累計データ
│   ├── custom/
│   │   └── latest-30d.json           # 直近30日間の推移トレンドデータ
│   └── reports/
│       ├── 2026-08.json              # 月次レポート集計済みデータ
│       └── 2026-09.json              # 月次レポート集計済みデータ
└── index.json                        # 利用可能な期間・レポートメタデータ一覧
```

---

## 3. インデックスメタデータ (`index.json`) 仕様

ダッシュボードSPAが起動時に最初に読み込み、利用可能な「日」「月」「期間」の選択肢を提供するメタデータ。

```json
{
  "repository": {
    "owner": "proud-corp",
    "name": "github-copilot-dashboard",
    "is_fork": false
  },
  "last_updated_at": "2026-09-10T00:30:00Z",
  "data_retention_days": 365,
  "available_months": ["2026-09", "2026-08", "2026-07"],
  "available_days": [
    "2026-09-09",
    "2026-09-08",
    "2026-09-07"
  ],
  "available_reports": ["2026-09", "2026-08"],
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
- ダッシュボードSPA (`dashboard/src/App.tsx`) はこの状態 (`noLiveData`) を検知し、固定のフォールバック月表示やクラッシュではなく、認証情報に依存しない機能（CSVレポート、AIモデルベンチマーク）が引き続き利用可能であることを説明する案内バナーを表示する。

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
