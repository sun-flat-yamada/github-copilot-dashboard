# Task: 月次レポート「総リクエスト数」カードの分布グラフを横型ミニ箱ひげ図へ刷新 (#377)

- [/] 計画策定とブランチ・ワークツリー準備 <!-- id: 0 -->
    - [x] Issue #377 の作成 <!-- id: 1 -->
    - [x] 独立作業用 sibling worktree の作成 (`feat/377-report-requests-boxplot`) <!-- id: 2 -->
    - [x] `implementation_plan.md` の作成とレビュー <!-- id: 3 -->
    - [ ] 計画ファーストコミット (`npm run change-dev:plan-check`) <!-- id: 4 -->
- [ ] UI コンポーネント実装 & 四分位数計算ロジック <!-- id: 5 -->
    - [ ] 四分位数 (Q1, Median, Q3) 計算関数の追加 <!-- id: 6 -->
    - [ ] `RequestsBoxPlot`（横型ミニ箱ひげ図コンポーネント）の実装 <!-- id: 7 -->
    - [ ] 箱（IQR: Q1〜Q3）、ヒゲ（Min〜Max）、中央値ラインの視覚スタイリング <!-- id: 8 -->
    - [ ] ツールチップおよびアクセシビリティ対応 <!-- id: 9 -->
- [ ] 仕様書・ドキュメント更新 <!-- id: 10 -->
    - [ ] `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md` を更新 <!-- id: 11 -->
- [ ] テスト & 品質ゲート検証 & PR作成・マージ <!-- id: 12 -->
    - [ ] `src/tests/ui/monthly-report-requests-kpi.test.tsx` の UI テストを箱ひげ図対応に更新 <!-- id: 13 -->
    - [ ] フル品質ゲート検証 (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`) <!-- id: 14 -->
    - [ ] `walkthrough.md` の作成 <!-- id: 15 -->
    - [ ] PR作成とオートパイロット (`change-dev:finish`) <!-- id: 16 -->
