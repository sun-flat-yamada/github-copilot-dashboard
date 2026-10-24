# Walkthrough: モデル特性レーダー著名ベンチマーク詳細テーブルの左右スクロール操作性とモデル名列固定 (#354)

## 概要 / Summary
`モデル特性レーダー` の `著名ベンチマーク最新実測データ詳細テーブル` に対し、`ユーザー明細` (`UserDetailTable`) と同等の左右スクロール操作性（上部スクロールナビゲーション、下部追従スライダー・プログレスバー）およびモデル名列の固定表示（sticky column + ドラッグリサイズ）を実装しました。

## 変更内容 / Changes Made
### Dashboard Component
- [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx):
  - `tableContainerRef` によるテーブル水平・垂直スクロール状態管理 (`scrollState`) とスムーズスクロールヘルパー (`scrollTable`, `handleSliderChange`) を追加。
  - 上部ヘッダー（表示件数の右隣）に左右スクロールナビゲーションボタン（`ChevronLeft`, `ChevronRight`）を常設。
  - テーブルコンテナを `overflow-auto max-h-[600px]` とし、`whitespace-nowrap min-w-max` で列の潰れを防止。
  - `thead` 全体を `sticky top-0 bg-slate-950` で垂直スクロール時にも固定。
  - モデル名列（`th`）を `sticky top-0 left-0 z-30`、データセル（`td`）を `sticky left-0 z-10` で固定し、境界線（`border-r`）とドロップシャドウ（`shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)]`）、不透明背景色（`bg-slate-900 group-hover:bg-slate-800/90`）を付与。
  - モデル名列にドラッグリサイズ機能（既定 220px、120px〜500px、ダブルクリックリセット、キーボード操作、localStorage 保存）を導入。
  - テーブルカード下部に追従型 水平スクロールコントローラー（Sticky Bottom Bar: パーセンテージ表示、レンジスライダー、左右スクロールボタン）を設置。

### Specifications
- [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md):
  - 第2章に「2.9 著名ベンチマーク最新実測データ詳細テーブルの左右スクロール操作性とモデル名列固定仕様」を追加し、UIコンポーネント、列固定、リサイズ、永続化仕様を明記。

### Automated Tests
- [src/tests/radar-table-scroll.test.ts](../../../src/tests/radar-table-scroll.test.ts):
  - 幅定数値、スクロール状態管理、上部ボタン、固定モデル列スタイル、リサイズハンドル、下部追従スライダーの存在と結合を検証するユニットテストを新設。

## 検証結果 / Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | ✅ 1215/1215 Pass (Exit 0) |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) |
| Production Build | `npm run build` | ✅ Built in 1.33s (Exit 0) |
