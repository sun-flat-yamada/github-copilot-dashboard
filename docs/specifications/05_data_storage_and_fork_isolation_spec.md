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
├── copilot-data (Dedicated Orphan Data Branch)
│   ├── data/
│   │   ├── raw/YYYY/MM/copilot_metrics_YYYY-MM-DD.json
│   │   ├── raw/YYYY/MM/copilot_seats_YYYY-MM-DD.json
│   │   ├── processed/daily/YYYY-MM-DD.json
│   │   ├── processed/monthly/YYYY-MM.json
│   │   └── index.json (利用可能な日付・月・スコープ一覧メタデータ)
│
└── GitHub Pages (Direct Artifact Deploy)
    └── actions/deploy-pages による直接配信 (gh-pages ブランチへのコミット競合なし)
```

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
├── processed/                        # 分析スコープごとに事前計算されたデータ
│   ├── daily/
│   │   ├── 2026-09-01.json           # 日次3軸集計・費用配賦済みデータ
│   │   └── ...
│   ├── monthly/
│   │   ├── 2026-08.json              # 月次集計データ
│   │   └── 2026-09.json              # 当月累計データ
│   └── custom/
│       └── latest-30d.json           # 直近30日間の推移トレンドデータ
└── index.json                        # 利用可能な期間メタデータ一覧
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
  "default_scopes": {
    "latest_day": "2026-09-09",
    "latest_month": "2026-09",
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

---

## 4. Gitワークフローと同期プロトコル (Zero Fork Conflict Protocol)

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
