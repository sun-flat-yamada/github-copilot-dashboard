# 実装計画: 月次レポートカード内の冗長な「選択した月次レポートの月」および「リクエスト」ラベルの削除 (#362)

月次レポート概要の各 KPI カード（費用サマリー、総リクエスト数、アクティブ人数、最多利用 AI モデル）において、月次レポートのコンテキスト全体から自明な「選択した月次レポートの月」窓ラベル、およびタイトル「総リクエスト数」と重複しているヘッダーの「リクエスト」バッジを削除・非表示化し、カードヘッダーの対称性と視認性を高めます。

---

## ユーザーレビュー必須事項 (User Review Required)

> [!IMPORTANT]
> - **「選択した月次レポートの月」窓ラベルの非表示化**:
>   - 月次レポートセクション全体が選択された月次レポートデータを対象としているため、各カードの指標ラベルに付与されている窓チップ（`選択した月次レポートの月`）は冗長です。
>   - `report_kpi_cost`（`report_gross_spend`）、`report_kpi_active_users`（`report_active_users`）、`report_kpi_top_model`（`report_top_model`）に `hideWindow` を指定して窓ラベルを非表示にします（`report_net_spend` および `report_requests` は既に `hideWindow` 適用済み）。
> - **「総リクエスト数」カードの「リクエスト」バッジの削除**:
>   - カードタイトルが「総リクエスト数」と明示されている場合、ヘッダーに併記されていた「リクエスト」バッジ（`report-requests-badge`）は重複表記であるため削除（非表示）とします。
>   - これにより、他の 3 枚のカードと同様に、ヘッダーは「指標タイトル（+ 情報アイコン）」および「右端のアイコンボックス」という統一されたクリーンなレイアウトになります。

---

## 変更対象ファイル一覧 (Proposed Changes)

### 1. UI コンポーネント層

#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `report_kpi_cost` の `report_gross_spend` に `hideWindow` を指定。
- `report_kpi_active_users` の `report_active_users` に `hideWindow` を指定。
- `report_kpi_top_model` の `report_top_model` に `hideWindow` を指定。
- `report_kpi_requests` において、`hasRequests` かつクレジットなしの場合の `badgeLabel` を `null` とし、「リクエスト」バッジを表示しないように変更。

### 2. 仕様書・ドキュメント

#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- Section 2.14d に、月次レポートの各 KPI カード内では「選択した月次レポートの月」窓ラベルを非表示（`hideWindow`）とし、「総リクエスト数」カードにおける冗長な「リクエスト」バッジを非表示とする仕様を明記。

### 3. テスト

#### [MODIFY] [src/tests/ui/monthly-report-requests-kpi.test.tsx](../../../src/tests/ui/monthly-report-requests-kpi.test.tsx)
- 「リクエストのみ」のテストケースにおいて、冗長な「リクエスト」バッジがレンダリングされない（`queryByTestId('report-requests-badge') === null`）こと、および「選択した月次レポートの月」窓チップが表示されないことを検証。

---

## 検証計画 (Verification Plan)

### 自動テスト & 品質ゲート
1. **単体テスト & UI テスト**:
   ```bash
   npm test -- src/tests/ui/monthly-report-requests-kpi.test.tsx
   ```
2. **品質ゲートフル実行**:
   ```bash
   npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
   ```
