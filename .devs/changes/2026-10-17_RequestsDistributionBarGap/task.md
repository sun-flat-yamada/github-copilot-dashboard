# Task: 月次レポート「総リクエスト数」カードの分布グラフのバー間隔拡大と離散分布デザインへの調整 (#373)

- [/] 計画策定とブランチ・ワークツリー準備 <!-- id: 0 -->
    - [x] Issue #373 の作成 <!-- id: 1 -->
    - [x] 独立作業用 sibling worktree の作成 (`fix/373-requests-distribution-bar-gap`) <!-- id: 2 -->
    - [x] `implementation_plan.md` の作成とレビュー <!-- id: 3 -->
    - [ ] 計画ファーストコミット (`npm run change-dev:plan-check`) <!-- id: 4 -->
- [ ] UI コンポーネント実装 & デザイン調整 <!-- id: 5 -->
    - [ ] `RequestsDistributionChart` のバー間隔（gap）を 50% 以上拡大 (`gap-1.5` -> `gap-2.5` / `gap-3`) <!-- id: 6 -->
    - [ ] 各バーの幅・角丸を調整し、離散的な独立柱（ピラー）デザインへ最適化 <!-- id: 7 -->
    - [ ] 度数0の階級の視覚表現の洗練 <!-- id: 8 -->
- [ ] 仕様書・ドキュメント更新 <!-- id: 9 -->
    - [ ] `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md` を更新 <!-- id: 10 -->
- [ ] テスト & 品質ゲート検証 & PR作成・マージ <!-- id: 11 -->
    - [ ] `src/tests/ui/monthly-report-requests-kpi.test.tsx` の UI テストを更新 <!-- id: 12 -->
    - [ ] フル品質ゲート検証 (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`) <!-- id: 13 -->
    - [ ] `walkthrough.md` の作成 <!-- id: 14 -->
    - [ ] PR作成とオートパイロット (`change-dev:finish`) <!-- id: 15 -->
