[English](09_monthly_usage_report_mode_spec.md) | [日本語](09_monthly_usage_report_mode_spec.ja.md)

---

# SDD-09: GitHub Copilot Monthly Usage Report 分析モード仕様書 (Monthly Usage Report Mode Spec)

- **文書番号**: SPEC-COPILOT-009
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-11 (2026-10-01 改訂: 複数ファイルの結合、単位の系統、日付なし行、合成プロファイルの廃止)

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
- **同じ月の複数ファイル (P0-10)**: GitHub のエクスポートは、組織別・期間別に分割されたり、再ダウンロードされたりすることが多い。パイプラインは `data/reports/monthly/YYYY-MM/` 配下の **すべての** CSV を読み、レコードを結合して、その月を**1 回だけ**集計する (`ReportParser.mergeRecordSets` → `aggregate`)。従来は 1 ファイルだけを使い、残りを黙って無視していた。
  - **重複検知**: 識別に関わる全フィールド (日付・ユーザー (大文字小文字を区別しない)・製品・SKU・モデル・数量・単位・単価・総額/割引/純額・組織・Cost Center・最終アクティビティ・サーフェス・クレジット・トークン) が同一の行が*別のファイル*にも現れた場合は 1 件として数える (行ごとに「いずれか 1 ファイルでの出現回数の最大値」を残す)。同一ファイル内の同一行は正当な別明細の可能性があるため、すべて残す。
  - **追跡可能性**: 結果には `import_summary` (`source_files`・`records_total`・`duplicates_skipped`、該当時は `undated_records`) が付き、パイプラインのログにも同じ数値が出力される。

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
- `quantity`: `unit_type` が示す単位での消費量。(`tokens` は `token_count` 専用のヘッダー別名で、`quantity` には割り当てない。)
- `unit_type`: 単位 (`requests`, `ai_credits`, シート/ライセンス単位 等)。**異なる単位の数量は合算しない** — §3.4 参照。
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
- **日付の正規化**: 日付値はソートキーとして使用される前に、ゼロ埋めした `YYYY-MM-DD` 形式に正規化される。これにより、表記ゆれのある元データ（例: スプレッドシートで再編集された結果の未ゼロ埋め `2026-9-5` など）が、単純な文字列比較によって `daily_trends` の暦日順を崩すことを防ぐ。日付として解釈できない値は（値を捏造せず）先頭10文字へのフォールバックとし、警告ログを出力する。
- **レポート月スコープの絞り込み**: `aggregate()` は、対象の `reportMonth` に属さない日付のレコードを除外する（例: 月境界をまたぐ期間でエクスポートされたCSV）。これにより、特定の月の `daily_trends`/`overview`/`user_details` がその暦月内に限定される。除外されたレコードは件数がカウントされ警告ログに出力され、黙って混入することはない。
- **欠損値を作り出さない**: `quantity` の無い行を「1 リクエスト」とは数えない (数量には寄与せず、金額は集計に含まれる)。日付の無い行を「今日」に割り当てない — 日付なしのまま保持し、合計には含め、`daily_trends` には載せず、`import_summary.undated_records` で件数を示す。
- **レポートに含まれない指標**: 課金 CSV には提案数・受諾数・チャット数・PR 要約数が存在しない。そこから導くグループ別の指標は 35% のような固定率ではなく `null` とする (SDD-06 §4.4)。


### 3.4 単位の系統 (`unit_type`)
レポートにはリクエスト・AI クレジット・シート (ユーザー月) の行が混在する。これらの `quantity` を足し合わせると意味のない「リクエスト数」になるため、`ReportParser.classifyUnit` が各行を系統に分類し、各集計は意味の合う系統だけを使う:

| 系統 | 一致する `unit_type` | 用途 |
|:--|:--|:--|
| `requests` | `request`・`prompt`・`interaction`・`completion`・`message`・`chat` を含む。**`unit_type` が無い場合も含む** (従来 CSV との互換) | `overview.total_requests`、ユーザー別・モデル別・日別のリクエスト数 |
| `credits` | `credit` を含む | `quantity_by_unit` (クレジット消費) |
| `seats` | `seat`・`licen[sc]e`・`user`・`member`・`month` を含む | `quantity_by_unit` (ライセンス行はリクエストではない) |
| `tokens` | `token` を含む | `quantity_by_unit` |
| `other` | 上記以外 | `quantity_by_unit` |

`overview.quantity_by_unit` に単位別の合計 (例: `{ "requests": 120, "ai-credits": 3400, "seats": 85 }`) を残して情報を失わない。`sku_breakdown` は SKU **と単位** ごとに 1 行とする (単位の異なる数量を 1 行に合算しない)。

### 3.5 AI usage report（token 列）と `usage_insight`
公式のフィールド仕様: GitHub Docs「Billing reports reference」（`billing/reference/billing-reports`）。**AI usage report** は、最長 31 日分の、ユーザー別の AI クレジットの内訳で、`date × model × username` ごとに合算する。モデルごとに token の項目 `input`、`output`、`cache_read`、`cache_write` が加わる。

| ヘッダー（正規化後） | レコードの項目 |
|:--|:--|
| `input` / `input_tokens` | `input_tokens` |
| `output` / `output_tokens` | `output_tokens` |
| `cache_read` / `cache_read_tokens` | `cache_read_tokens` |
| `cache_write` / `cache_write_tokens` | `cache_write_tokens` |
| `token_count` / `tokens` / `total_tokens` | `token_count`（合計のみ） |

- token 列があり、かつ **`unit_type` が無い**行は `other` 系に分類し、その `quantity` はリクエスト数に足さない（「`unit_type` が無ければ requests」という従来の規則は、token 列の無い行にだけ適用する）。クレジットは `ai_credits_consumed`、または `unit_type` に credit を含む行から得る。
- token の値だけが違う行は、重複検知では別の行として扱う。
- `aggregate()` は全ユーザー行に `usage_insight`（SDD-06 §5）を付与する。表示フィルターの適用前に算出し、フィルターエンジンはそのまま保持する。
- **実際のエクスポートでの確認が必要**: 公式ドキュメントはフィールドを説明しているが、AI usage report の `quantity` の単位は記載していない。本実装は「クレジット」と仮定し、`unit_type` と `ai_credits_consumed` を根拠にしている。

---

## 4. 集計データ構造 (`MonthlyReportAggregatedData`)

集計エンジンは、パースされたレコードを以下の構造に集約する：

```typescript
export interface MonthlyReportAggregatedData {
  report_month: string; // e.g. "2026-08"
  source_type: 'persisted' | 'local_drop';
  file_name: string;
  parsed_at: string;
  import_summary?: {                // 結合した月次レポートに付く (§2.2)
    source_files: string[];
    records_total: number;          // 重複を除いて集計に使ったレコード数
    duplicates_skipped: number;     // 別ファイルに同一行があり 1 件に集約した行数
    undated_records?: number;       // 日付のない行: 合計には含み、daily_trends には載せない
  };
  overview: {
    total_net_spend_usd: number;
    total_gross_spend_usd: number;
    total_discount_usd: number;
    total_requests: number;         // requests 系の明細のみ (§3.4)
    quantity_by_unit?: Record<string, number>; // 単位別の合計 (例: { requests: 120, 'ai-credits': 3400 })
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
    surface?: string;               // CSV にサーフェス列が無ければ無し (「VS Code」等の既定値は使わない)
  }[];
  filter_notice?: { unfiltered_sections: string[] }; // フィルター適用中、全社値のまま表示するセクション (SDD-15 §3.6)
}
```

---

## 5. ダッシュボード UI/UX 仕様

1. **ヘッダーアクティブデータセレクター (`ActiveDataSelector`)**:
   - `Live Metrics (API連携自動収集)`: リアルタイム日次/月次/30日ダッシュボード
   - `Monthly Usage Report (確定月次レポート)`: 永続化された確定月次レポート、およびドラッグ＆ドロップによる即時オンデマンド解析
2. **レポート選択 & オンデマンドインポート**:
   - 過去の利用可能月（`2026-08`, `2026-09` 等）を即座に切り替え。
   - 手元の CSV ファイルをドラッグ＆ドロップで即時投入・ブラウザ内メモリ解析（Zero-Leakage）。
3. **分析セクション & ビュー連動**:
   - 各分析ビュー（Overview, Users, Trend, Model Radar, Budget）に完全連動。
   - ① **KPI カード**: 総費用、総リクエスト、アクティブ人数、トップモデル
   - ② **3軸費用・リクエスト配賦 (`MonthlyReportCharts`)**:
     - 部署 (`department`) / Cost Center (`cost_center`) / 組織 (`organization`) の3軸切り替えセレクターを配備。
     - 選択された軸および個別グループ（例: 特定のCostCenterやOrganization）と親画面コントロールバーが双方向連動。
   - ③ **モデル別 & SKU別分析**: モデルごとのリクエストシェア・費用比率
   - ④ **日別推移チャート**: 月内の消費ペースとピーク日
   - ⑤ **ユーザー別利用明細テーブル (`MonthlyReportUserTable`)**:
     - `Organization` 列を明示表示し、所属組織と Cost Center を一目で確認可能。
     - フィルタードロップダウンがアクティブな集計軸（部署 / Cost Center / 組織）に連動して候補を切り替え。
     - 行クリックによるインライン・ディープ分析ドリルダウン (`UserDrilldownPanel`) に対応。
   - ⑥ **Cost Center 予算管理 (View 5: Budget & Cost Center)**:
     - 月次レポート選択時にも `by_cost_center` から実績費用を集計し、Cost Center 予算カード (`CostCenterBudgetCards`) を動的生成・表示。
   - ⑦ **ユーザー別モデル推移 (View 3: Trend & Model Usage)**:
     - 保存済みの月次アーカイブ (`deep-analysis/{YYYY-MM}.json`、実測のテレメトリ) がある月はそれを使う。月次 CSV とアップロード CSV は、ユーザー別の日次実績を持たない集計であるため、**そこから個人別プロファイルを合成しない**: 推定のトレンドを出す代わりに、データソース情報バッジ「月次集計のみ・日次診断不可」と理由を表示する (SDD-11 §6.4)。
     - プロファイルがある場合は、全AIモデルを動的に検出して積上グラフを描画し、分析データソース情報バッジをヘッダーに明示。
     - 月次明細テーブルの「トレンド」ボタンから遷移できる。
   - ⑧ **フィルター**: `daily_trends` と `sku_breakdown` はユーザー別に再集計できないため、フィルター適用中は「全社値 (フィルター非対応)」と明示する (SDD-07 §2.13)。

