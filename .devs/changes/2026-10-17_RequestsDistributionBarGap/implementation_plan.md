# Implementation Plan: 月次レポート「総リクエスト数」カードの分布グラフのバー間隔拡大と離散分布デザインへの調整 (#373)

## 1. 概要・背景
月次レポート「総リクエスト数」カード内の分布ヒストグラムは、選択データの利用量分布（5階級）を可視化しています。
しかし現状の実装では、バー同士の隙間が小さく（`gap-1.5` / 6px）かつ各バーがコンテナ全幅を占有しているため、棒グラフというよりも「連続した面グラフ・帯グラフ」のように見えてしまい、連続値のグラフであるかのような錯覚を生じさせていました。

本改修では、バー間の隙間を 50% 以上拡大（`gap-2.5`〜`gap-3`）するとともに、各バーを適度な幅と角丸を持つ独立した柱（ピラー）としてデザイン調整し、連続データではなく「5階級の離散的な度数分布イメージ」であることが一目で伝わる視覚表現を実現します。

---

## 2. 変更対象コンポーネントと方針

### A. `RequestsDistributionChart`（`MonthlyReportKpis.tsx`）
1. **バー間隔（隙間）の 50% 以上拡大**:
   - バーの親コンテナの `gap-1.5` (6px) を `gap-2.5` (10px) または `gap-3` (12px) に拡大。
2. **バー自体の形状・幅の最適化（離散ピラー表現）**:
   - 各バーのコンテナ内で、バー要素自体の幅を `w-full` から `w-4/5 max-w-[28px]` 等にスリム化。
   - 上部に適度な角丸（`rounded-t`）を付与し、独立した柱（ピラー）であることを視覚的に強調。
   - 度数 0 の階級は、高さを `h-0.5`（2px）程度のスリット形状（`bg-slate-800/40 rounded-full`）にし、度数があるバーとのコントラストを明確化。
3. **視覚バランスの調整**:
   - 上部の度数（人数）テキストとバーの中心軸を整合させ、各バーが独立したビンを表現していることを一貫させる。

### B. UI/UX 仕様書（`07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md`）
- Section 2.20 項3 に「離散的な度数分布イメージを強調するためのバー間隔拡大（gap-2.5〜3、独立ピラー形状）仕様」を追記。

### C. UI テスト（`src/tests/ui/monthly-report-requests-kpi.test.tsx`）
- バー間隔のクラス（拡大された gap）や、バーのレンダリングスタイルを検証するテストを追加・更新。

---

## 3. 実装手順
1. **Worktree への変更追跡ディレクトリの初期化**:
   - `.devs/changes/2026-10-17_RequestsDistributionBarGap/` に `implementation_plan.md`, `task.md` を作成。
2. **Plan-First コミット**:
   - `git add .devs/changes/... && git commit -m "docs: implementation plan for issue #373"`
   - `npm run change-dev:plan-check` のパスを確認。
3. **UI 実装**:
   - `MonthlyReportKpis.tsx` の `RequestsDistributionChart` の gap およびバー形状を調整。
4. **仕様書・テスト更新**:
   - 仕様書（日英）を更新。
   - UI テストを更新して実行。
5. **フル品質ゲート検証**:
   - `fork:verify`, `typecheck`, `test`, `secret-scan`, `build` の全パスを確認。
6. **PR 作成 & オートパイロットマージ**:
   - PR を作成し、`change-dev:finish` でリベースマージと後片付け。
