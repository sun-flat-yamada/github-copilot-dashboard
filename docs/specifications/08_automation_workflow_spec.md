# SDD-08: 自動化ワークフロー仕様書 (Automation & CI/CD)

- **文書番号**: SPEC-COPILOT-008
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. ワークフロー一覧

| ワークフロー名 | トリガー | 主な責務 |
|---|---|---|
| `copilot-analysis-cron.yml` | 定期実行 (毎日 UTC 00:00) / 手動実行 (`workflow_dispatch`) | 1. APIから最新データ収集<br>2. 属性リゾルバでマッピング注入<br>3. 多次元集計・費用配賦<br>4. `copilot-data` ブランチへ追記コミット<br>5. ダッシュボードビルド & GitHub Pagesデプロイ |
| `test-and-preview.yml` | Pull Request / `main` へのPush | TypeScript型検査、単体テスト、モックデータによるビルド動作検証 |

---

## 2. 必要な GitHub Actions Secrets / Variables

### 2.1 Secrets
- `COPILOT_READ_TOKEN`:
  - GitHub Enterprise または対象Orgの管理者権限を持つPersonal Access Token (PAT) または GitHub App Private Key。
  - 必要権限:
    - Enterprise / Org: `Manage Copilot` (読み取り)
    - Enterprise: `Billing` (読み取り)
    - Org: `Members` (読み取り)
  - ※ モックモード (`MOCK_MODE=true`) 実行時は未設定でも動作可能。

### 2.2 Variables
- `COPILOT_USER_MAPPING`:
  - ユーザー名、表示名、仕訳グループ、Cost Center上書き情報のJSON配列文字列。
  - 公開コミットには一切含めず、GitHubのリポジトリ設定（Settings > Secrets and variables > Actions > Variables）で登録。
- `COPILOT_ENTERPRISE`: 対象のEnterpriseスラッグ（Enterprise一括集計時）。
- `COPILOT_ORGS`: 対象のOrganizationスラッグ（カンマ区切り、複数Org対応）。
- `MOCK_MODE`: 実APIトークンなしでデモ・テスト運用する場合は `true` を指定。

---

## 3. 自動デプロイと権限設定 (GitHub Pages)

リポジトリ設定において、GitHub Pagesの Source を **「GitHub Actions」** に設定する。

```yaml
permissions:
  contents: write      # copilot-data ブランチへのデータコミット用
  pages: write         # GitHub Pages へのデプロイ用
  id-token: write      # GitHub Pages OIDCトークン用
```

### ステップフロー:
1. チェックアウト (`main`)
2. Node.js 20 セットアップ & 依存関係インストール (`npm ci`)
3. `copilot-data` ブランチの履歴取得
4. データ収集・集計スクリプト実行 (`npm run pipeline:run`)
5. 新規データファイルを `copilot-data` ブランチへPush
6. SPAダッシュボードのビルド (`npm run build`)
7. `actions/upload-pages-artifact@v3` で静的アーティファクトをアップロード
8. `actions/deploy-pages@v4` でGitHub Pagesへ公開
