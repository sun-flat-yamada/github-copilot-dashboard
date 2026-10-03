# Task: ダッシュボード全体レビューに基づく改善

- [x] Phase 1: Issue Definition & Scoping <!-- id: 0 -->
  - [x] レビュー依頼に基づき、範囲と重点観点を確定（Issue は未起票）
- [/] Phase 2: Implementation Plan formulated & approved <!-- id: 1 -->
  - [x] `implementation_plan.md` を策定（全体レビューと Phase 0〜4 の改善計画）
  - [x] 最新の `main`（`b163671`）へ rebase し、change-dev の成果物規約に沿って配置
  - [x] User Review Required の判断事項 1〜7 への回答 — すべて回答済み（計画書「判断結果」。#5 は PAT のみ）
- [/] Phase 3: Sibling Worktree Provisioning & Implementation <!-- id: 2 -->
  - [x] Phase 0 止血（P0-1〜P0-11）— 実装済み（レビュー待ち）。成果物: [../2026-10-01_DashboardPhase0Stabilization/](../2026-10-01_DashboardPhase0Stabilization/)、Issue: [sun-flat-yamada/github-copilot-dashboard#160](https://github.com/sun-flat-yamada/github-copilot-dashboard/issues/160)
  - [ ] Phase 1 取得基盤（P1-1〜P1-7）— User Review Required の判断待ち（特に 3. データの公開範囲、5. 収集スコープと認証）
  - [ ] Phase 2 フロントエンド収束（P2-1〜P2-7）— 判断事項 1（収束先）、4（ブラウザ内クエリ方式）の判断待ち
  - [ ] Phase 3 分析手法・可視化（P3-1〜P3-8）— 判断事項 2（個人単位診断の扱い）の判断待ち
  - [ ] Phase 4 監査・レポート（P4-1〜P4-7）— 判断事項 6（監査要件）の判断待ち
  - 各実装フェーズは、着手時にフェーズごとの change ディレクトリ（`.devs/changes/yyyy-mm-dd_<ChangeTitle>/`）を作成して進める
- [ ] Phase 4: Local Quality Gate & Specification Sync <!-- id: 3 -->
  - [/] 各 PR で 5 段階の品質ゲートを通過（Phase 0 はローカルで通過済み。結果は Phase 0 の `walkthrough.md`）
  - [/] SDD の同期（SDD-02 / 03 / 04 / 05 / 06 / 07 / 10 / 11 / 15 の改訂、SDD-16 / SDD-17 の新設）— Phase 0 分（SDD-01 / 02 / 03 / 04 / 05 / 06 / 07 / 08 / 09 / 11 / 15、README、SECURITY、セットアップガイド）は完了。SDD-10 の改訂と SDD-16 / SDD-17 の新設は Phase 3 / 4
- [/] Phase 5: Walkthrough Artifact Generation & Evidence Sealing <!-- id: 4 -->
  - [x] Phase 0 の walkthrough（[../2026-10-01_DashboardPhase0Stabilization/walkthrough.md](../2026-10-01_DashboardPhase0Stabilization/walkthrough.md)）
- [ ] Phase 6: Rebase onto Base & Create PR <!-- id: 5 -->
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup <!-- id: 6 -->

## 作業単位 Issue の索引（1 タスク = 1 Issue = 1 PR）

新しいセッションは「Issue #N を対応せよ」で開始できる（`.agents/skills/change-dev/SKILL.md` の「Work-Unit Issue」）。親（追跡）Issue は各フェーズの共通前提と推奨順を持つ。

| フェーズ | 親 Issue | 子 Issue |
| :--- | :--- | :--- |
| Phase 1（残り） | #172 | P1-2 #176 / P1-3 #177 / P1-4 #178 / P1-5 #179 / P1-7 #180（完了済み: P1-1 #163、P1-6 PR #165） |
| Phase 2 | #173 | P2-1 #181 / P2-2 #182 / P2-3 #183 / P2-4 #184 / P2-5 #185 / P2-6 #186 / P2-7 #187 |
| Phase 3 | #174 | P3-1 #188 / P3-2 #189 / P3-3 #190 / P3-4 #191 / P3-5 #192 / P3-6 #193 / P3-7 #195 / P3-8 #196 |
| Phase 4 | #175 | P4-1 #197 / P4-2 #198 / P4-3 #199 / P4-4 #200 / P4-5 #201 / P4-6 #202 / P4-7 #203 |
