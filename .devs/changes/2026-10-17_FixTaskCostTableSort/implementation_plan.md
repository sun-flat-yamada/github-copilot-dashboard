# 実装計画書: Task単価テーブルソート修正およびソート方向インジケーター整備 (#375)

## 1. 概要 / Overview
`モデル特性レーダー` の `著名ベンチマーク最新実測データ詳細テーブル` において、Task単価（`task_cost`）列のソート挙動を修正・堅牢化し、ソート方向（昇順・降順）が視覚的に一目で判別できるように動的ソートアイコン（`ArrowUp` / `ArrowDown`）およびソート状態バッジを導入します。

## 2. 問題の根本原因 / Root Cause Analysis
1. **視覚的フィードバックの欠落**:
   - テーブルヘッダーのアイコンが常に固定の `ArrowUpDown` のままであり、クリックして昇順（安い順）または降順（高い順）に切り替わってもアイコンに変化がなく、ソートが適用されたかどうかがユーザーに伝わらない。
2. **`sortAsc` のセマンティクス不整合**:
   - スコア指標（Overall, Terminal等）は `sortAsc: false` が降順（高スコア順＝優秀順）。
   - `cost`（Token単価）も `cost_efficiency`（効率スコア）でソートされるため `sortAsc: false` が降順（高効率＝安い順）。
   - しかし `task_cost` のみ金額そのものを比較しているため、`sortAsc: true` が昇順（安い順）となっており、列切り替え時の状態整合が複雑化していた。
3. **未定義値（undefined / null）のハンドリング不備**:
   - `valA = a.raw_metrics.task_cost_usd ?? 0` により、仮に未定義値が存在した場合に $0.00 として昇順ソートの最上位に配置されてしまう潜在的バグが存在した。

## 3. 実装詳細 / Implementation Details

### (1) `ModelRadarView.tsx`: 動的ソートアイコンの導入
- テーブルヘッダーの各列に `renderSortIcon(key)` ヘルパーを適用。
  - `sortKey !== key`: `<ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60" />`
  - `sortKey === key`:
    - `sortAsc`: `<ArrowUp className="w-3 h-3 text-indigo-400" />`（昇順）
    - `!sortAsc`: `<ArrowDown className="w-3 h-3 text-indigo-400" />`（降順）
- Task単価列およびToken単価列の `title` 属性を改善し、クリックによる昇順・降順切り替えを明記。

### (2) `ModelRadarView.tsx`: ソートロジックの堅牢化
- `task_cost` のソート比較において、未定義値は昇順・降順を問わず常に末尾に配置される安全な比較処理を実装。
- 上部ソートバーの「Task単価」および「Token単価」ボタンに、アクティブ時の方向インジケーター（`安い順` / `高い順` 等）を付与。

### (3) テスト拡充
- `src/tests/radar-task-cost.test.ts` に、動的ソートアイコン（ArrowUp/ArrowDown）の存在、未定義値の末尾配置、双方向ソートの動作検証テストを追加。

## 4. 影響範囲 / Scope
- `dashboard/src/components/ModelRadarView.tsx`
- `src/tests/radar-task-cost.test.ts`
- `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md`
- `docs/specifications/10_ai_model_benchmark_radar_spec.md`
