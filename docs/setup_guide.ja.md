# 🚀 完全セットアップ & 環境構築ガイド

[English](setup_guide.md) | [日本語](setup_guide.ja.md)

本ドキュメントは、**github-copilot-dashboard** を企業・組織の環境へ導入・構成し、安全に運用するための完全セットアップ手順書です。機密ユーザー情報の保護（PII秘匿）、暗号化運用、認証モード、および本家リポジトリとの同期保守について詳述します。

---

## 📑 目次

1. [事前準備 & リポジトリの配置](#1-事前準備--リポジトリの配置)
2. [GitHub Pages 完全無料ホスティング設定](#2-github-pages-完全無料ホスティング設定)
3. [GitHub Actions 権限の付与](#3-github-actions-権限の付与)
4. [ユーザー属性マッピング（仕訳テーブル）の設定](#4-ユーザー属性マッピング仕訳テーブルの設定)
   - [標準 JSON 形式](#標準-json-形式)
   - [CSV 形式](#csv-形式)
   - [GPG暗号化運用 & 48KB制限の回避](#gpg暗号化運用--48kb制限の回避)
5. [通貨表示 & 契約課金（EA契約 / AI Credits）の設定](#5-通貨表示--契約課金ea契約--ai-creditsの設定)
   - [USD 常時基本表示 & サブ表示通貨の併記](#usd-常時基本表示--サブ表示通貨の併記)
   - [COPILOT_BILLING_CONFIG の設定](#copilot_billing_config-の設定)
   - [パラメータ仕様 & EA契約ボリュームディスカウント](#パラメータ仕様--ea契約ボリュームディスカウント)
6. [認証トークン & データ取得スコープ](#6-認証トークン--データ取得スコープ)
   - [Fine-grained PAT の発行](#fine-grained-pat-の発行)
   - [Enterprise 単位 vs Organization 単位](#enterprise-単位-vs-organization-単位)
   - [モックモード & 認証フォールバック](#モックモード--認証フォールバック)
7. [本家（Upstream）更新の同期 & 運用保守](#7-本家upstream更新の同期--運用保守)
8. [トラブルシューティング](#8-トラブルシューティング)

---

## 1. 事前準備 & リポジトリの配置

### オプション A: 標準 GitHub Fork (推奨)
1. 本リポジトリのページ右上にある **「Fork」** ボタンをクリックします。
2. 対象となる社内 Organization または Enterprise アカウントを選択してリポジトリを作成します。

### オプション B: Fork制限組織 / EMU向けミラー複製
企業内のポリシー制限や Enterprise Managed Users (EMU) アカウントにより、外部アカウントからの Fork が禁止されている環境では：
- [SDD-13: Fork制限環境向けセットアップ手順書](specifications/13_fork_restricted_environment_setup_guide.ja.md) に記載のミラー複製方式を採用してください。

---

## 2. GitHub Pages 完全無料ホスティング設定

1. リポジトリの **Settings** > **Pages** を開きます。
2. **Build and deployment** > **Source** で **「GitHub Actions」** を選択します。
3. 外部のホスティングサーバーやクラウド費用は一切不要です（`.github/workflows/copilot-analysis-cron.yml` により自動配信されます）。

---

## 3. GitHub Actions 権限の付与

1. **Settings** > **Actions** > **General** を開きます。
2. **Workflow permissions** で **「Read and write permissions」** を選択します。
3. **「Allow GitHub Actions to create and approve pull requests」** にチェックを入れて保存します。

---

## 4. ユーザー属性マッピング（仕訳テーブル）の設定

GitHub上のログインID（`taro-tanaka`）を社内の実名・所属部署・仕訳グループに対応付けます。この情報はGitコミット履歴には一切記録されず、GitHub Actions の環境変数経由でのみ安全に注入されます。

### 標準 JSON 形式
**Settings** > **Secrets and variables** > **Actions** > **Variables**（または Secrets）に `COPILOT_USER_MAPPING` を作成し、以下を入力します：

```json
[
  {
    "github_user": "octocat-lead",
    "display_name": "田中 太郎",
    "department": "プラットフォーム基盤部",
    "cost_center_override": "FinTech-Division",
    "notes": "正社員 / リード"
  },
  {
    "github_user": "alice-dev",
    "display_name": "鈴木 花子",
    "department": "LLM応用開発チーム",
    "cost_center_override": "Research-and-AI",
    "notes": "業務委託"
  }
]
```

### CSV 形式
カンマ区切りのテキスト形式でも登録可能です：

```csv
github_user,display_name,department,cost_center_override,notes
octocat-lead,田中 太郎,プラットフォーム基盤部,FinTech-Division,正社員 / リード
alice-dev,鈴木 花子,LLM応用開発チーム,Research-and-AI,業務委託
```

### GPG暗号化運用 & 48KB制限の回避
GitHub Actions の Variables/Secrets は最大 48KB に制限されています。数千名規模の組織でマッピングファイルが48KBを超える場合：
1. 付属の暗号化ツールでファイルをローカル暗号化します：
   ```bash
   # パスフレーズ対話入力:
   npm run mapping:encrypt -- --in local_mapping.json --out mapping.enc.json

   # または環境変数を用いたCI自動化:
   MAPPING_PASSPHRASE="your-secure-passphrase" npm run mapping:encrypt -- --in local_mapping.json --passphrase-env MAPPING_PASSPHRASE
   ```
2. 暗号化済みファイルを `copilot-data` 独立データブランチにコミットするか、安全に受け渡します。
3. パスフレーズを GitHub Actions Secret `MAPPING_PASSPHRASE` に登録すると、集計実行時にメモリ上で透過的に復号されます。
4. 詳細は [SDD-04: ユーザー属性情報仕様書](specifications/04_user_attribute_mapping_spec.ja.md) を参照してください。

---

## 5. 通貨表示 & 契約課金（EA契約 / AI Credits）の設定

本ダッシュボードは、グローバル標準の **USD（米ドル）常時基本表示** と、組織に応じた **サブ表示通貨（JPY 円、EUR ユーロ等）の併記** に完全対応しています。

### USD 常時基本表示 & サブ表示通貨の併記
- **全9分析画面・KPI・チャート・テーブルにおいて、USD（`$`）が常時基本通貨として表示**されます。
- サブ通貨を設定した場合、USDの横にカッコ書きでサブ通貨額が併記されます（例: `$2,975.00 (¥461,125)` や `$0.010 / AIC (¥1.273 / AIC)`）。
- 画面上部ヘッダーの「通貨: USD / USD+JPY / USD+EUR」ドロップダウンセレクターから、閲覧者自身がリアルタイムに切り替えることも可能です（ブラウザの `localStorage` に保持されます）。

### COPILOT_BILLING_CONFIG の設定
**Settings** > **Secrets and variables** > **Actions** > **Variables**（または Secrets）に `COPILOT_BILLING_CONFIG` を登録するか、リポジトリの `data/config/billing.json` に設定を配置します。

```json
{
  "subCurrency": {
    "code": "JPY",
    "symbol": "¥",
    "exchangeRateFromUSD": 155.0,
    "displayDecimals": 0
  },
  "discountPercent": 15,
  "customPricePerCredit": 1.273,
  "customSeatPricing": {
    "enterpriseMonthly": 5000
  }
}
```

### パラメータ仕様 & EA契約ボリュームディスカウント
| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `subCurrency` | `object` | `null` | サブ表示通貨設定（`code`: 'JPY', `symbol`: '¥', `exchangeRateFromUSD`: 155.0, `displayDecimals`: 0） |
| `discountPercent` | `number` | `0` | Enterprise Agreement (EA) ボリュームディスカウント率（0〜100%） |
| `customPricePerCredit` | `number` | 未設定 | 企業個別の直接契約AI Credits単価（サブ通貨指定時はサブ通貨での単価、例: 1.273 JPY/AIC。指定時はディスカウント計算より優先） |
| `customSeatPricing` | `object` | 未設定 | 個別契約シート単価（`businessMonthly`, `enterpriseMonthly`） |
| `seatPricing` | `object` | 19 / 39 USD | 標準シート定価（USD） |
| `creditsPricing` | `object` | 0.01 USD | 標準クレジット定価（USD/AIC） |

---

## 6. 認証トークン & データ取得スコープ

### Fine-grained PAT の発行
以下の権限を持つ個人アクセストークン（PAT）を発行し、GitHub Actions Secret `COPILOT_READ_TOKEN` に登録します：
- `manage_billing:copilot` (または Copilot Business/Enterprise の読み取り権限)
- `read:org`

### Enterprise 単位 vs Organization 単位
**Settings** > **Secrets and variables** > **Actions** > **Variables** でいずれかを設定します：
- `COPILOT_ENTERPRISE`: Enterprise スラッグ（例: `my-enterprise-slug`）
- または `COPILOT_ORGS`: カンマ区切りの Organization 名一覧（例: `org-core,org-ai-labs`）

### モックモード & DEMO データセットのセットアップ
- **Fork 先での DEMO データ即時導入**: GitHub で Fork した直後（デフォルトで `main` のみ複製され `copilot-data` が存在しない場合等）でも、以下のコマンド 1 発で本家から DEMO データセット（30日分の日次・月次・トレンド・レポートデータ）を取り込めます：
  ```bash
  # 本家 copilot-data から DEMO データを自動取得・配置
  npm run demo:setup

  # Fork 先の GitHub Pages / Actions にも反映したい場合 (--push)
  npm run demo:setup -- --push
  ```
- **モックシミュレーション**: Variable に `MOCK_MODE=true` を指定すると、実際のPATがなくても2026年仕様の全機能シミュレーションデータで即座にダッシュボードを起動・検証できます。
- **グレースフル・デグラデーション**: 万一 Metrics API のトークン権限が未付与または一時停止された場合でも、パイプラインは停止せず、Seat情報や月次CSVレポート（Monthly Usage Report）を用いて集計を自動継続します。

---

## 7. 本家（Upstream）更新の同期 & 運用保守

本家リポジトリで新しいAIモデルや集計機能がリリースされた場合、以下の手順で安全に同期できます：

```bash
# 1. Fork環境の健全性診断 & データ漏洩事前監査
npm run fork:verify

# 2. 本家更新の取得と Fast-Forward マージ
git fetch upstream main
git merge upstream/main --ff-only

# 3. 依存ライブラリ更新と品質ゲート検証
npm ci
npm run typecheck && npm test && npm run secret-scan && npm run build

# 4. Fork先リポジトリへのプッシュ
git push origin main
```

> [!TIP]
> 社内独自のUIカスタマイズや追加ロジックを保持したい場合は、[SDD-12](specifications/12_fork_sync_and_customization_ops_spec.ja.md) に定義されている2層ブランチ運用（`main` + `fork/custom`）を推奨します。

---

## 8. トラブルシューティング

- **API 403 / レート制限 / 権限エラー**: ヘッダー右上の異常検知アイコン（80%×80%モーダル）を開くか、`error-log.json` をダウンロードして発生エンドポイントを確認してください。
- **シークレットスキャン検知**: コミット前に `npm run secret-scan` を実行し、誤ってトークンや内部パスが含まれていないか特定してください。
- **本家へのPR作成時データ監査**: `npm run upstream:audit` を実行することで、社内実データや個人情報を含むCSV・ログファイルが混入していないことを事前に保証できます。
