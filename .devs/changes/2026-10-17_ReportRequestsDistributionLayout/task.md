# Task: 月次レポート「総リクエスト数」カードの分布グラフサイズ適正化と最小・中央・最大直感対応レイアウト (#359)

- [ ] 計画策定とブランチ・ワークツリー準備 <!-- id: 0 -->
    - [x] Issue #359 の作成 <!-- id: 1 -->
    - [ ] `implementation_plan.md` の作成とレビュー <!-- id: 2 -->
    - [ ] 計画ファーストコミット (`npm run change-dev:plan-check`) <!-- id: 3 -->
    - [x] 独立作業用 sibling worktree の作成 (`fix/359-report-requests-distribution-layout`) <!-- id: 4 -->
- [ ] UI コンポーネント実装 & レイアウト最適化 <!-- id: 5 -->
    - [ ] `DistributionMiniHistogram` をカード全幅・適切な高さ (h-10) へサイズ拡大 <!-- id: 6 -->
    - [ ] ヒストグラムの各バー上に度数（人数）ラベルを直接表示 <!-- id: 7 -->
    - [ ] 分布グラフの真下にX軸ラインと「最小値」「中央値」「最大値」を目盛りとして一体配置 <!-- id: 8 -->
    - [ ] 両方（リクエスト & AIC）時のレイアウト調整 <!-- id: 9 -->
- [ ] 仕様書・ドキュメント更新 <!-- id: 10 -->
    - [ ] `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md` を更新 <!-- id: 11 -->
- [ ] テスト & 品質ゲート検証 & PR作成・マージ <!-- id: 12 -->
    - [ ] `src/tests/ui/monthly-report-requests-kpi.test.tsx` の UI テストを更新・追加 <!-- id: 13 -->
    - [ ] フル品質ゲート検証 (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`) <!-- id: 14 -->
    - [ ] `walkthrough.md` の作成 <!-- id: 15 -->
    - [ ] PR作成とオートパイロット (`change-dev:finish`) <!-- id: 16 -->
