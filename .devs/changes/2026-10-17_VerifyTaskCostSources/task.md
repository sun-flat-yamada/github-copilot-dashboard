# タスク追跡チェックリスト / Task Tracking Checklist (#379)

- [ ] 計画立案とアーティファクト作成 <!-- id: 0 -->
  - [x] 実装計画書（`implementation_plan.md`）の作成 <!-- id: 1 -->
  - [x] タスク追跡チェックリスト（`task.md`）の初期化 <!-- id: 2 -->
  - [ ] リポジトリ内 `.devs/changes/` への計画コミット <!-- id: 3 -->
- [ ] データセット更新 <!-- id: 4 -->
  - [ ] `scripts/benchmark-data/benchmark-records.json` の推測値26モデルに `task_cost_usd` を追加 <!-- id: 5 -->
  - [ ] `npm run update-benchmarks` による `model-benchmarks.json` 再生成 <!-- id: 6 -->
- [ ] 仕様書同期 <!-- id: 7 -->
  - [ ] `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md` および `.md` の更新 <!-- id: 8 -->
- [ ] テスト拡充と品質ゲート検証 <!-- id: 9 -->
  - [ ] `src/tests/radar-task-cost.test.ts` に実測・推測の区別および `#radar-sources` の完全性検証を追加 <!-- id: 10 -->
  - [ ] 品質ゲート（`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`）の全通過 <!-- id: 11 -->
- [ ] PR作成と自動マージ <!-- id: 12 -->
  - [ ] PR作成と `change-dev finish` によるマージ <!-- id: 13 -->
