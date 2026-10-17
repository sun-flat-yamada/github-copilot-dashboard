# Task Checklist (#339)

- [x] Issue #339 の作成およびブランチ `feat/339-report-requests-kpi-stats` の作成
- [x] `implementation_plan.md` の作成・先行コミット
- [x] Sibling Worktree のプロビジョニング (`feat-339-report-requests-kpi-stats`)
- [x] アカウント統計ユーティリティ `dashboard/src/utils/accountStats.ts` の実装
- [x] `MonthlyReportKpis.tsx` に AIC / リクエスト明確化表示と最大値・中央値・最小値の併記を実装
- [x] `accountStats.test.ts` および `monthly-report-requests-kpi.test.tsx` のテスト作成・検証
- [x] 仕様書 (`07_dashboard_ui_ux_spec*.md`) の更新
- [/] ローカル品質ゲート (`fork:verify`, `typecheck`, `lint`, `test`, `secret-scan`, `build`, `change-dev:plan-check`) 通過
- [ ] `walkthrough.md` の作成
- [ ] PR 作成および Rebase Merge (auto when `CHG_DEV_AUTO_PILOT=true`)
