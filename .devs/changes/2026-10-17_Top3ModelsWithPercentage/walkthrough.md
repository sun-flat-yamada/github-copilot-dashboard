# Walkthrough: 最多利用 AI モデルカードにおける Top 3 モデル割合(%)表示 (#337)

## 概要
Issue #337 に基づき、月次レポート（Monthly Usage Report / User Upload モード）の「最多利用 AI モデル」カード (`report_top_model`) において、選択されているデータ (`model_breakdown`) から上位 3 件の AI モデルを順位・モデル名・リクエスト占有割合(%)付きで表示するように改善しました。

## 変更内容
### UI コンポーネント
- [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
  - カード 4（`report_top_model`）の描画ロジックを更新。
  - `reportData.model_breakdown` から上位 3 モデルを `slice(0, 3)` で抽出し、順位（1〜3）・モデル名・割合(%)のリストとして表示。
  - 1位のモデルには強調バッジ（パープルアクセント）を付与し、モデル名は `truncate` と `title` 属性で安全に表示。
  - モデルデータが 3 件未満（1〜2 件）の場合は存在する件数分のみ表示し、0 件の場合は「データなし」フォールバックを表示。
  - カード下部に「上位3モデルのリクエスト占有率」注記を配置し、カード全体の縦幅・レイアウトを他の KPI カードと調和。

### テスト
- [src/tests/ui/monthly-report-kpis.test.tsx](../../../src/tests/ui/monthly-report-kpis.test.tsx)
  - 3 モデル以上存在する場合の Top 3 順位・モデル名・割合(%)表示および 4 件目以降の除外検証。
  - 2 モデル存在時の 2 件表示検証。
  - 0 モデル時の「データなし」フォールバック表示検証。

### 仕様書
- [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md)
- [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
  - セクション 2.14d を新設し、月次レポート KPI カードの「最多利用 AI モデル」Top 3 表示仕様を明文化。

## 検証結果
### 5段階品質ゲート
| 段階 | コマンド | 結果 |
| :--- | :--- | :--- |
| 1. Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| 2. TypeScript 型検査 | `npm run typecheck` | ✅ 0 エラー (Exit 0) |
| 3. 自動テストスイート | `npm test` | ✅ 1194/1194 Pass, 0 Fail (Exit 0) |
| 4. 秘密情報・PII スキャン | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) |
| 5. プロダクションビルド | `npm run build` | ✅ Built in 1.25s (Exit 0) |
| プランファースト検証 | `npm run change-dev:plan-check` | ✅ Plan in 2c61733, Impl in 647f708 |
