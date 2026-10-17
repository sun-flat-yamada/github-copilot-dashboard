# 変更内容ウォークスルー / Walkthrough (#375)

## 修正の目的
`モデル特性レーダー` の `著名ベンチマーク最新実測データ詳細テーブル` において、Task単価（`task_cost`）列のソート挙動を修正・堅牢化し、ソート方向（昇順・降順）が一目でわかるように動的ソートアイコン（`ArrowUp` / `ArrowDown`）およびソート状態バッジを整備しました。

---

## 主な変更点

### 1. 動的ソートアイコン (`renderSortIcon`) の全列導入
- `dashboard/src/components/ModelRadarView.tsx`:
  - アクティブな列に対して、昇順時は `<ArrowUp className="text-indigo-400" />`、降順時は `<ArrowDown className="text-indigo-400" />` を描画。
  - 非アクティブな列には控えめな `<ArrowUpDown className="text-slate-500 opacity-60" />` を表示。
  - これにより、クリックするたびに矢印の向きが反転し、現在のソート状態が100%視覚的に把握可能。

### 2. Task単価ソートロジックの堅牢化
- `dashboard/src/components/ModelRadarView.tsx`:
  - `task_cost` のソート比較において、`undefined` の値を安全に検知し、昇順・降順いずれの場合も常に末尾に配置される安全な比較処理を実装。
  - ヘッダーセルおよび上部ソートバーに「安い順」「高い順」を示すバッジを明示。

### 3. 仕様書同期
- `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md` & `docs/specifications/10_ai_model_benchmark_radar_spec.md`:
  - 動的ソートアイコン（`ArrowUp`/`ArrowDown`）とソート状態バッジの仕様を明記。

---

## 検証結果 / Quality Gate
- `npm run fork:verify`: 7 Passed, 0 Failures
- `npm run typecheck`: Passed (Zero errors across root & dashboard)
- `npm test`: 1,245 tests (1,244 passed, 1 skipped, 0 failed)
- `npm run secret-scan`: 748 files scanned, 0 findings
- `npm run build`: Vite build + bundle check passed (169.78 kB / 300 kB budget)
