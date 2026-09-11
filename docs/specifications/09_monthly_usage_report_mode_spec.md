# SDD-09: GitHub Copilot Monthly Usage Report 分析モード仕様書 (Monthly Usage Report Mode Spec)

- **文書番号**: SPEC-COPILOT-009
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-11

---

## 1. 目的と背景

GitHub Copilot のエンタープライズ導入組織において、以下のユースケースが存在する：
1. **GitHub Enterprise Billing からダウンロードした月次詳細レポートの活用**:
   GitHub Enterprise / Organization の「Billing & licensing」または「Copilot Access」からエクスポートされる Monthly Usage Report (CSV) には、API では直接取得しづらい日別・ユーザー別の従量課金明細（SKU、消費 AI クレジット、利用モデル、適用割引額など）が含まれる。
2. **API 権限がない管理者・現場リーダーの分析支援**:
   Fine-grained PAT や Enterprise Owner 権限を持たない部門管理者でも、手元の CSV ファイルをダッシュボードに投入するだけで、社内仕訳グループごとの利用状況や費用按分を可視化したい。
3. **Fork 環境における完全無競合なファイル保持**:
   本リポジトリを社内で Fork して運用する際、蓄積する月次レポートファイルが Upstream（本家）との `Sync Fork` や PR に一切コンフリクト（競合）を起こさないようにする。

---

## 2. Fork-Safe ファイル保持アーキテクチャ

### 2.1 3層ハイブリッド保持方針
`RULE[GEMINI.md]` および `SDD-05` に完全準拠し、以下の構造でファイルを保持・運用する：

```
[Repository Branch Architecture]
├── main (Code Only Branch)
│   ├── src/
│   ├── dashboard/
│   └── (※ CSVレポートやデータファイルは一切コミットしない)
│
├── copilot-data (Dedicated Orphan Data Branch)
│   └── data/
│       ├── reports/
│       │   └── monthly/
│       │       ├── 2026-08/copilot_monthly_usage_2026-08.csv
│       │       └── 2026-09/copilot_monthly_usage_2026-09.csv
│       ├── processed/
│       │   └── reports/
│       │       ├── 2026-08.json
│       │       └── 2026-09.json
│       └── index.json (available_reports メタデータ更新)
│
└── Browser In-Memory (Zero-Commit Direct Dropzone)
    └── ダッシュボード上で手元の CSV をドラッグ＆ドロップして即時パース・可視化
```

### 2.2 永続ストレージ (`copilot-data` ブランチ)
- **配置ディレクトリ**: `data/reports/monthly/YYYY-MM/`
- **配置ファイル名**: `copilot_monthly_usage_YYYY-MM.csv` (または `YYYY-MM.csv`)
- **イミュータブル運用**: 過去月のレポートは追記型（Append-Only）で保存され、上書きや過去履歴の改変を行わない。
- **Fork 安全性**: `main` ブランチにはデータが一切含まれないため、下流 Fork リポジトリでの「Sync Fork」や本家への PR でマージコンフリクトが 0% となる。

### 2.3 ローカル登録 CLI (`scripts/import-report.ts`)
管理者・開発者が手元の月次レポート CSV を `copilot-data` ブランチに安全に格納するためのコマンドを提供：
```bash
npm run report:import -- ./path/to/copilot-report.csv 2026-08
```
このコマンドは一時ディレクトリで `copilot-data` を操作し、作業ブランチ（`main`）に一切差分を残さずにリモートへプッシュする。

### 2.4 クライアント直接解析 (Local Dropzone)
- ダッシュボード SPA 上で手元の CSV ファイルをドラッグ＆ドロップすることで、Web ブラウザの JavaScript メモリ上で即時パース・3軸集計を実施。
- リポジトリやサーバーへのデータ送信は一切発生しないため、社外秘データや PII の完全なローカル保護（Zero Leakage）を実現。

---

## 3. 入力 CSV フォーマット対応仕様 (Smart Header Detection)

パーサーは、GitHub が提供する代表的なフォーマットを自動認識（Smart Header Detection）してパースする：

### 3.1 GitHub Enterprise Detailed Usage Report (Metered Usage)
- `date`: 利用日付 (YYYY-MM-DD)
- `username` / `login`: GitHub ユーザー名
- `product`: 製品名 (`copilot`)
- `sku`: 課金 SKU (`copilot_business`, `copilot_enterprise`, `copilot_premium_request`, `copilot_ai_credit`)
- `model`: 利用モデル名 (`Claude 3.7 Sonnet`, `GPT-4o`, `o1`, `Gemini 2.0 Flash` 等)
- `quantity`: 数量（リクエスト数、トークン数等）
- `unit_type`: 単位 (`requests`, `ai_credits`)
- `applied_cost_per_quantity`: 単価 (USD)
- `gross_amount`: 割引前総額 (USD)
- `discount_amount`: 割引額 (USD)
- `net_amount`: 請求実額 (USD)
- `organization`: 所属 Organization 名
- `cost_center_name`: 紐付く Cost Center 名

### 3.2 Copilot Activity Report
- `report_time`: レポート生成日時
- `login`: GitHub ユーザー名
- `last_authenticated_at`: 最終認証日時
- `last_activity_at`: 最終アクティビティ日時
- `last_surface_used`: 最終利用エディタ / サーフェス名

### 3.3 フォールバック & エラーハンドリング
- 未知の列が存在してもスキップして処理を継続。
- 必須列（ユーザー名、日付または数量/金額）が欠損している行は警告ログを記録し、可能な限り復旧。

---

## 4. 集計データ構造 (`MonthlyReportAggregatedData`)

集計エンジンは、パースされたレコードを以下の構造に集約する：

```typescript
export interface MonthlyReportAggregatedData {
  report_month: string; // e.g. "2026-08"
  source_type: 'persisted' | 'local_drop';
  file_name: string;
  parsed_at: string;
  overview: {
    total_net_spend_usd: number;
    total_gross_spend_usd: number;
    total_discount_usd: number;
    total_requests: number;
    total_active_users: number;
    top_model: string;
    top_sku: string;
  };
  by_department: Record<string, GroupSummary>;
  by_cost_center: Record<string, GroupSummary>;
  by_organization: Record<string, GroupSummary>;
  model_breakdown: {
    model_name: string;
    total_requests: number;
    total_spend_usd: number;
    active_users: number;
  }[];
  sku_breakdown: {
    sku_name: string;
    total_quantity: number;
    unit_type: string;
    total_spend_usd: number;
  }[];
  daily_trends: {
    date: string;
    requests: number;
    spend_usd: number;
    active_users: number;
  }[];
  user_details: {
    login: string;
    display_name: string;
    department: string;
    cost_center: string;
    organization: string;
    total_requests: number;
    total_spend_usd: number;
    primary_model: string;
    last_activity_date?: string;
    surface?: string;
  }[];
}
```

---

## 5. ダッシュボード UI/UX 仕様

1. **ヘッダーモード切り替え (`ModeSwitcher`)**:
   - `API連携モード (Live Metrics)`: 既存のリアルタイム日次/月次/30日ダッシュボード
   - `Monthly Usage Report モード (Report Analytics)`: 月次レポート専用ダッシュボード
2. **レポート選択 & インポートバー**:
   - 過去の利用可能月（`2026-08`, `2026-09` 等）を即座に切り替え。
   - 「ローカル CSV インポート」ボタンにより、ドラッグ＆ドロップモーダルを表示。
3. **5つの分析セクション**:
   - ① **KPI カード**: 総費用、総リクエスト、アクティブ人数、トップモデル
   - ② **3軸費用・リクエスト配賦**: 部署 / Cost Center / 組織別の円グラフ・バーグラフ
   - ③ **モデル別 & SKU別分析**: モデルごとのリクエストシェア・費用比率
   - ④ **日別推移チャート**: 月内の消費ペースとピーク日
   - ⑤ **ユーザー別利用明細テーブル**: 検索、フィルタ、並び替え、CSVエクスポート
