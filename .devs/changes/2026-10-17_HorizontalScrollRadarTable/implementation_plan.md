# feat(dashboard): モデル特性レーダー著名ベンチマーク詳細テーブルの左右スクロール操作性とモデル名列固定 (#354)

`モデル特性レーダー` の `著名ベンチマーク最新実測データ詳細テーブル` に対し、`ユーザー明細` (`UserDetailTable`) と同等の左右スクロール操作性（上部スクロールナビゲーション、下部追従スライダー・プログレスバー）およびモデル名列の固定表示（sticky column）を実装します。

## ユーザー確認事項 / User Review Required
> [!NOTE]
> 本変更は UI/UX の操作性改善であり、既存のソートロジック（`handleSort`）、モデル選択トグル（`handleToggleModel`）、各指標値の算出・表示ロジックには影響を与えません。
> 列固定は「モデル / 仕様・Tier」列を対象とし、横スクロール時にも常時表示されます。

## 変更内容 / Proposed Changes

### Dashboard Component
#### [MODIFY] [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx)
- `lucide-react` より `ChevronLeft`, `ChevronRight` をインポート。
- テーブルスクロール状態（`scrollState`: `canScrollLeft`, `canScrollRight`, `scrollLeft`, `scrollWidth`, `clientWidth`, `progress`）および更新ロジック（`updateScrollState`, `scrollTable`, `handleSliderChange`）を追加。
- 著名ベンチマーク詳細テーブル上部に、左右スクロールナビゲーションボタン（`ChevronLeft`, `ChevronRight`）を追加。
- テーブルコンテナを `overflow-auto max-h-[650px] rounded-lg border border-slate-800 relative scrollbar-thin scrollbar-thumb-slate-700` に更新。
- テーブルヘッダー `thead` を `sticky top-0 bg-slate-950` で縦スクロール時にも固定。
- モデル名列のヘッダーセル（`th`）を `sticky top-0 left-0 z-30 bg-slate-950 border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)]` として最前面に固定。
- モデル名列のデータセル（`td`）を `sticky left-0 z-10 border-r border-slate-700/80 shadow-[3px_0_6px_-2px_rgba(0,0,0,0.5)]` かつ不透明背景色（`bg-slate-900 group-hover:bg-slate-800/90`）で固定。
- テーブル下部に追従型 水平スクロールコントローラー（Sticky Bottom Bar: パーセンテージ表示、レンジスライダー、左右スクロールボタン）を設置。

### Specification
#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)
- ベンチマーク詳細テーブルの仕様記述に、ユーザー明細と同様の左右スクロールコントローラーおよびモデル名列の固定表示仕様（sticky column）を明記。

### Test
#### [NEW] [src/tests/radar-table-scroll.test.ts](../../../src/tests/radar-table-scroll.test.ts)
- `ModelRadarView.tsx` において、`tableContainerRef`、`updateScrollState`、`scrollTable`、`ChevronLeft`、`ChevronRight`、下部追従スライダー、およびモデル名列の `sticky left-0` 固定スタイルが正しく組み込まれていることを検証するテストを追加。

## 検証計画 / Verification Plan
### Automated Tests
- `npm run fork:verify`
- `npm run typecheck`
- `npm test`
- `npm run secret-scan`
- `npm run build`
- 個別テスト: `npm test -- src/tests/radar-table-scroll.test.ts`
