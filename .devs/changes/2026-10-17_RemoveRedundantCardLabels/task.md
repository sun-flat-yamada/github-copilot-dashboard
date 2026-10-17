# Task: 月次レポートカード内の冗長な「選択した月次レポートの月」および「リクエスト」ラベルの削除 (#362)

- [ ] 計画策定とブランチ・ワークツリー準備 <!-- id: 0 -->
    - [x] Issue #362 の作成 <!-- id: 1 -->
    - [x] `implementation_plan.md` の作成 <!-- id: 2 -->
    - [x] 独立作業用 sibling worktree の作成 (`fix/362-remove-redundant-card-labels`) <!-- id: 3 -->
    - [ ] 計画ファーストコミット (`npm run change-dev:plan-check`) <!-- id: 4 -->
- [ ] UI コンポーネント実装 & 仕様同期 <!-- id: 5 -->
    - [ ] `MonthlyReportKpis.tsx` で各カードの「選択した月次レポートの月」窓ラベルを非表示化 (`hideWindow`) <!-- id: 6 -->
    - [ ] `MonthlyReportKpis.tsx` で「総リクエスト数」カードの冗長な「リクエスト」バッジを非表示化 <!-- id: 7 -->
    - [ ] `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md` を更新 <!-- id: 8 -->
- [ ] テスト & 品質ゲート検証 & PR作成・マージ <!-- id: 9 -->
    - [ ] `src/tests/ui/monthly-report-requests-kpi.test.tsx` の UI テストを更新 <!-- id: 10 -->
    - [ ] フル品質ゲート検証 (`fork:verify`, `typecheck`, `test`, `secret-scan`, `build`) <!-- id: 11 -->
    - [ ] `walkthrough.md` の作成 <!-- id: 12 -->
    - [ ] PR作成とオートパイロット (`change-dev:finish`) <!-- id: 13 -->
