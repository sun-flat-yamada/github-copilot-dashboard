# タスク追跡チェックリスト / Task Tracking Checklist (#375)

- [x] 計画立案とアーティファクト作成 <!-- id: 0 -->
  - [x] 実装計画書（`implementation_plan.md`）の作成 <!-- id: 1 -->
  - [x] タスク追跡チェックリスト（`task.md`）の初期化 <!-- id: 2 -->
  - [x] リポジトリ内 `.devs/changes/` への計画コミット <!-- id: 3 -->
- [x] UIコンポーネント改修 <!-- id: 4 -->
  - [x] `ModelRadarView.tsx` に動的ソートアイコン（ArrowUp / ArrowDown）を導入 <!-- id: 5 -->
  - [x] `task_cost` ソートロジックの堅牢化（未定義値の末尾配置・双方向ソート） <!-- id: 6 -->
  - [x] ソートバーにアクティブ時の昇順・降順インジケーターを追加 <!-- id: 7 -->
- [x] 仕様書同期 <!-- id: 8 -->
  - [x] `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md` および `.md` の更新 <!-- id: 9 -->
- [x] テスト拡充と品質ゲート検証 <!-- id: 10 -->
  - [x] `src/tests/radar-task-cost.test.ts` に動的アイコン・ソート検証を追加 <!-- id: 11 -->
  - [x] 品質ゲート（`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`）の全通過 <!-- id: 12 -->
- [ ] PR作成と自動マージ <!-- id: 13 -->
  - [ ] PR作成と `change-dev finish` によるマージ <!-- id: 14 -->
