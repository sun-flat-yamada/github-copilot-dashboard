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

### 運用の前提: 社内限定 (リポジトリ / Pages の公開範囲)
本ダッシュボードは、企業の **GitHub Enterprise 環境**で、**自社の社員だけ**が参照する前提です (氏名・部署・ユーザー別の利用状況を個人が識別できる形で表示してよい)。実データの収集を有効にする前に、Enterprise のメンバーだけが結果を読めることを確認してください:
- **private または internal** のリポジトリを使い、Pages は **アクセス制御付き** (GitHub Enterprise Cloud) にします。**Enterprise と配下の Organization を併用**して収集します (`COPILOT_ENTERPRISE` と `COPILOT_ORGS`)。
- **公開 (public) リポジトリ**は **`copilot-data` ブランチ** (Raw の API レスポンス・ユーザー別の数値・解決済みの氏名と部署) も公開します。
- **GitHub Pages サイトは、リポジトリが非公開でも既定で公開**されます (アクセス制御付き Pages には GitHub Enterprise Cloud が必要です)。
- 実データの公開デプロイは**サポートしません**。任意の追加措置として、仮名化したデータを公開できます: Variable `ANONYMIZE_USERS=true` と Secret `ANONYMIZE_SECRET` (ランダムな16文字以上。例: `openssl rand -hex 32`) を設定します。`ANONYMIZE_USERS=true` で有効な鍵が無い場合、実行は何も公開せずに停止します。
- 定期ワークフローは収集前に `npm run fork:verify` を実行し、実在の・仮名化されていないユーザー単位のデータが公開されている (または公開される) 場合は**失敗**します。カスタムドメインで配信している場合は `COPILOT_PAGES_URL` を設定し、公開デプロイを承知のうえで受け入れる場合に限って `COPILOT_ALLOW_PUBLIC_DATA=true` を設定してください。詳細は [SECURITY.md](../SECURITY.md) と [SDD-04 第5章](specifications/04_user_attribute_mapping_spec.ja.md) を参照してください。

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
- 画面上部ヘッダーの「通貨: USD / USD+EA-USD / USD+EA-JPY / USD+EA-EUR」ドロップダウンセレクターから、閲覧者自身がリアルタイムに切り替えることも可能です（ブラウザの `localStorage` に保持されます）。

### 5.1 設定方法（配置場所と適用優先順位）
課金設定は以下のいずれかの方法で安全に注入できます（環境変数が最優先）：
1. **GitHub Actions Secrets / Variables**（推奨）:
   - リポジトリの **Settings** > **Secrets and variables** > **Actions** > **Variables**（または Secrets）に `COPILOT_BILLING_CONFIG` として JSON 文字列を登録します。
2. **ローカル設定ファイル**（開発・テスト用）:
   - リポジトリ内の `data/config/billing.json` に設定ファイルを配置します（サンプル: [`examples/config/billing.example.json`](../examples/config/billing.example.json) を参照）。

---

### 5.2 ユースケース別・設定パラメーター具体例

#### 【具体例 1】シンプルなEAボリュームディスカウント（15%OFF ＋ 円換算表示）
企業全体の契約ディスカウント率（15%）と、社内共通の適用為替レート（155円/ドル）を指定する最も標準的な設定です：
```json
{
  "subCurrency": {
    "code": "JPY",
    "symbol": "¥",
    "exchangeRateFromUSD": 155.0,
    "displayDecimals": 0
  },
  "discountPercent": 15
}
```

#### 【具体例 2】日本円での直接契約（シート月額固定価格 ＋ AI Credit個別単価 1.273円/AIC）
Enterprise Agreementにおいて、USD換算ではなく日本円建てでの固定月額（Enterprise: ¥5,000、Business: ¥2,500）および AI Credit 単価（1.273円/AIC）が直接定められている場合の設定です：
```json
{
  "subCurrency": {
    "code": "JPY",
    "symbol": "¥",
    "exchangeRateFromUSD": 150.0,
    "displayDecimals": 0
  },
  "customPricePerCredit": 1.273,
  "customSeatPricing": {
    "enterpriseMonthly": 5000,
    "businessMonthly": 2500,
    "currency": "JPY"
  }
}
```

#### 【具体例 3】期間別（年度別・契約改定サイクル別）パラメータ設定
契約年度ごとにディスカウント率や単価、為替レートが改定される企業向けの本格的な設定です。
`periods` 配列に期間（`startMonth` 〜 `endMonth`）を定義します。**設定期間外の月は、自動的にデフォルト値（GitHubカタログ価格および基本設定）へフォールバックします**：
```json
{
  "currency": { "code": "USD", "symbol": "$", "exchangeRateFromUSD": 1.0, "displayDecimals": 2 },
  "subCurrency": { "code": "JPY", "symbol": "¥", "exchangeRateFromUSD": 150.0, "displayDecimals": 0 },
  "discountPercent": 10,
  "periods": [
    {
      "startMonth": "2025-04",
      "endMonth": "2026-03",
      "discountPercent": 20,
      "seatPricing": {
        "enterprise": 4800,
        "business": 2400,
        "currency": "JPY"
      },
      "creditPricing": {
        "pricePerCredit": 1.25,
        "currency": "JPY"
      },
      "exchangeRates": {
        "JPY": 155.0,
        "EUR": 0.92
      }
    },
    {
      "startMonth": "2026-04",
      "endMonth": "2027-03",
      "discountPercent": 15,
      "seatPricing": {
        "enterprise": 5000,
        "business": 2500,
        "currency": "JPY"
      },
      "creditPricing": {
        "pricePerCredit": 1.273,
        "currency": "JPY"
      },
      "exchangeRateFromUSD": 148.0
    }
  ]
}
```

---

### 5.3 パラメータ仕様詳細 & エイリアス正規化
設定ローダー（`BillingConfigLoader`）は、直感的なキー名の差異を自動的に吸収・正規化します：

| パラメータ | 型 | デフォルト | 許容エイリアス / 説明 |
|---|---|---|---|
| `subCurrency` | `object` | `null` | サブ表示通貨設定（`code`: 'JPY', `symbol`: '¥', `exchangeRateFromUSD`: 155.0, `displayDecimals`: 0） |
| `discountPercent` | `number` | `0` | Enterprise Agreement (EA) ボリュームディスカウント率（0〜100%） |
| `seatPricing` | `object` | 19 / 39 USD | シート価格。`{ enterprise, business, currency }`、`{ enterpriseMonthly, businessMonthly }`、`{ enterpriseMonthlyUSD, businessMonthlyUSD }` のいずれの形式でも指定可能。USD以外の通貨を指定した場合は自動的にカスタム契約単価として扱われます。 |
| `creditPricing` | `object` / `number` | 0.01 USD | AI Credit 単価。`{ pricePerCredit: 1.273, currency: "JPY" }` や `customPricePerCredit: 1.273` で指定可能。 |
| `exchangeRates` | `object` | 自動算出 | USDから各通貨への変換レートマップ（例: `{ "JPY": 155.0, "EUR": 0.92 }`）。単一指定の `exchangeRateFromUSD` も可。 |
| `periods` | `array` | `[]` | 期間別パラメータ設定リスト（`startMonth`, `endMonth`, 各プランの月額・単価・ディスカウント率・為替レート）。 |

> [!NOTE]
> - **USDは「GitHubのカタログ価格(USD)」**: ダッシュボードの主たるUSD表示はGitHub公式カタログ価格（Enterprise: \$39/月、Business: \$19/月、Credits: \$0.01/AIC）を表します。サブ表示通貨としてユーザーが設定したEA契約レートに基づく **「EA-USD ($)」「EA-JPY (¥)」「EA-EUR (€)」** を選択することで、社内契約レートによる実効金額（例: `$39.00 ($33.15 EA)`、`$39.00 (¥4,973)`、`$39.00 (€30.50)`）を並列比較できます。
> - **期間外のフォールバック**: `periods` で指定された期間（`startMonth` 〜 `endMonth`）に該当しない月は、自動的にデフォルト設定値へフォールバックします。
> - **公的オープンデータによる為替レート自動算出**: 設定値が存在しない区間の為替レート（USD/JPY, USD/EUR等）は、欧州中央銀行 (ECB) および日本銀行 (BOJ) 公表の信頼できる公的データから自動算出されます。

---

## 6. 認証トークン & データ取得スコープ

### Fine-grained PAT の発行
以下の権限を持つ個人アクセストークン（PAT）を発行し、GitHub Actions Secret `COPILOT_READ_TOKEN` に登録します：
- `manage_billing:copilot` (または Copilot Business/Enterprise の読み取り権限)
- `read:org`
- `read:enterprise` (Enterprise 単位のメトリクスレポートとシート。`manage_billing:copilot` でも可)

収集は **Enterprise と配下の Organization を併用**します: `COPILOT_ENTERPRISE` と `COPILOT_ORGS` の両方を設定してください。複数のスコープに現れるユーザーは 1 件として数えます。トークンの所有者は、Enterprise レポートでは Enterprise owner / billing manager、Organization レポートでは Organization owner である必要があります。エンドポイント別のスコープは [SDD-08 §2.1.1](specifications/08_automation_workflow_spec.ja.md) を参照してください。

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
- **グレースフル・デグラデーション**: 万一 Metrics API のトークン権限が未付与または一時停止された場合でも、パイプラインは停止せず、Seat情報や月次CSVレポート（Monthly Usage Report）を用いて集計を自動継続します。各ソース (利用状況メトリクス / シート / Cost Center) は独立に収集され、その状態 (`ok` / `partial` / `failed` / `skipped`) はダッシュボードのデータ状態バナーに表示されます。失敗したソースが過去の正常なデータを「ゼロ」で置き換えることはなく、直近の成功値を引き継いで明示し、デモデータで代替することもありません。
- **パイプラインの任意設定** (特記なければ Variables): `ANONYMIZE_USERS` (+ Secret `ANONYMIZE_SECRET`)、`GITHUB_API_VERSION` (既定 `2026-03-10`)、`COPILOT_BILLING_CONFIG` (第5章)、`COPILOT_COST_CENTER_BUDGETS`、`COPILOT_ALLOW_PUBLIC_DATA`、`COPILOT_PAGES_URL`。

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
- **`fork:verify` が公開範囲のエラーで失敗する**: リポジトリまたは Pages サイトが公開されている状態で、実在の・仮名化されていないユーザーデータが公開されている (または公開される) 状態です。リポジトリと Pages を非公開にするか、仮名化 (`ANONYMIZE_USERS=true` + `ANONYMIZE_SECRET`) を有効にしてください。GitHub に到達できない場合は警告のみになります。
- **「ANONYMIZE_USERS is enabled but ANONYMIZE_SECRET is not set / too short」で実行が停止する**: ランダムな16文字以上の値を Actions Secret `ANONYMIZE_SECRET` として登録してください (fail closed は仕様です)。
- **ダッシュボードに赤/黄のバナーや、数値のかわりに「—」が表示される**: ソースの取得失敗・一部取得 (バナー)、または実測できていない値 (理由付きの「—」) です。原因は異常検知モーダル / `error-log.json` で確認できます。「前回値」バッジは、そのソースの直近の収集が失敗し、前回成功時の値を表示していることを示します。
- **ダッシュボードに琥珀色の「デモ」バナーが表示される**: デモ (架空) データを、明示的に選択した、またはデータ自身が `is_mock_mode` を宣言しているために表示しています。「実データを表示」を押すか、`?demo=true` なしで開いてください。
- **シークレットスキャン検知**: コミット前に `npm run secret-scan` を実行し、誤ってトークンや内部パスが含まれていないか特定してください。
- **本家へのPR作成時データ監査**: `npm run upstream:audit` を実行することで、社内実データや個人情報を含むCSV・ログファイルが混入していないことを事前に保証できます。

> **為替レート**: `exchangeRateFromUSD` を指定していない月は、為替カタログ (`data/catalog/exchange-rates.json`) を使います。カタログは `npm run catalog:fx` が ECB の月次平均で更新します (終了した月のみ・書き換えなし)。レートが無い場合は EA-JPY / EA-EUR を選択肢に出さず、仮のレートは使いません。
