# Walkthrough: ユーザー明細の統一と、ライブ側への使用量列の追加

## Summary

1. **公式情報の調査**: GitHub Docs の最新（`github/docs` の `main`、2026-10-02）から AI usage report の項目・単位・換算・取得経路を特定し、ダミーデータと仕様書に反映した。`quantity` は AI クレジット（$0.01/クレジット）で、トークンは `input` / `output` / `cache_read` / `cache_write`。実ファイルは未入手のため、CSV の列順と `unit_type` の文字列は未確認。
2. **ユーザー明細の統一**: ライブと月次レポートで別々だった 2 つの表を、`UserDetailTable` 1 つに統合した。両ソースを同じキーの行モデルにそろえ、22 列・同じ順序・同じ意味で描画する。ソースに無い値は「—」と理由。ライブにも、トークン・コスト/100 万トークン・兆候の列が出る。

## Changes Made

### 公式仕様への適合（ダミーデータ）
- [src/collector/mock-generator.ts](../../../src/collector/mock-generator.ts): 公式の単価表とクレジット換算で `generateAiUsageReportCSV` を再実装。列は公式の項目のみ。

### 行モデル
- [src/adapters/presenters/UserDetailRows.ts](../../../src/adapters/presenters/UserDetailRows.ts): `buildLiveRows` / `buildReportRows`。全キー必須、欠損は `null`。
- [src/processor/usage-insight.ts](../../../src/processor/usage-insight.ts): `accumulatorFromDailyHistory`（ライブの日別履歴から同じ算出関数へ）、リクエスト数の「不明」と「0 件」の区別。
- [src/processor/usage-insight-definitions.ts](../../../src/processor/usage-insight-definitions.ts): ツールチップ（評価できていない指標を示す）。

### 表示
- [dashboard/src/components/UserDetailTable.tsx](../../../dashboard/src/components/UserDetailTable.tsx): 統合コンポーネント。`MonthlyReportUserTable.tsx` は削除。`App.tsx`、`MonthlyReportView.tsx`、3 つの ViewPlugin の呼び出しを統一。

### 仕様書（英日）
- SDD-07 §2.16（統一ルール）・§2.15、SDD-09 §3.5（公式情報の確認結果と出典）、SDD-09 / SDD-11 の名称。

## Verification Results

### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean |
| TypeScript Check | `npm run typecheck` | ✅ Pass |
| Unit & Integration Tests（lint を含む） | `npm test` | ✅ 719/719 Pass（追加: 行モデル 11、統合表の描画 7、ダミーデータの公式適合 4 ほか） |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks |
| Production Build | `npm run build` | ✅ Built |

### 実ブラウザでの確認（Chromium + Playwright、Vite の開発サーバー）
- ライブ（デモデータ）と、ダミーの AI usage report（オンデマンド CSV に投入）で、ユーザー明細の見出しが **22 列とも完全に一致**した。ブラウザのエラーはなし。
- ライブ: トークン系は「—」（Reports API に無い）、兆候は日別履歴から算出（デモでは全員「特記なし」）。
- 月次（ダミー）: 長大化パターンのユーザーが「確認を推奨」、利用の少ないユーザーが「データ不足」。ドリルダウンの上に「使用量と効率」。
- 確認で見つけて直した点: 見出しの二重括弧（`利用費用 (月次 (USD))`）、リクエストの「0」（AI usage report のみのときは不明）、パネル見出しの右端切れ。

### 確認できていないこと・残した点
- **実際の AI usage report ファイル**での確認（列順、`unit_type` の文字列、`model` の表記）。
- ライブの「利用費用」と「超過請求」は、従来どおり同じ値（スコープ単位のシート費）。
- ドリルダウン（`UserDrilldownPanel`）の中身はソースごとに違う（既存。例: 月次では「プラン未確定」と表示される）。表の形式は統一したが、ドリルダウンの統一は対象外。
- 自動マージ（`CHG_DEV_AUTO_PILOT`）は、リポジトリの設定で有効だが、このセッションでは行わない（承認とマージはユーザーの操作とする）。
