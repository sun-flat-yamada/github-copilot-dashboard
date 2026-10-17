# Walkthrough: Overview Widget Dashboard (#331)

## 1. 変更サマリー (Summary of Changes)
GitHub Pages の初期表示 Dashboard ページ（`overview` ビュー）を Widget 方式で配置・カスタマイズ可能にしました。

- **`dashboard/src/hooks/useOverviewWidgets.ts` [NEW]**
  - 自動収集データ（Live）および月次レポート/アップロード（Report）の各モードに対応する Widget カタログ（`LIVE_WIDGET_CATALOG`, `REPORT_WIDGET_CATALOG`）とデフォルトプリセット（`DEFAULT_LIVE_WIDGET_IDS`, `DEFAULT_REPORT_WIDGET_IDS`）を定義。
  - `localStorage`（キー: `copilot_dashboard_overview_widgets_v1`）への自動保存と、再アクセス時の復元・バリデーション処理を実装。
  - 追加 (`addWidget`)、削除 (`removeWidget`)、上下移動 (`moveWidget`)、ドラッグ＆ドロップ並び替え (`reorderWidgets`)、デフォルトプリセットへのリセット (`resetWidgets`) を提供。
- **`dashboard/src/components/common/CollapsibleSection.tsx` [MODIFY]**
  - 各 Widget ヘッダーにドラッグハンドル、上へ移動（`↑`）、下へ移動（`↓`）、削除（`×`）ボタンを追加。
  - WCAG 2.2 AA (`nested-interactive`) 準拠のため、アコーディオン展開 `<button>` と Widget 操作 `<button>` 群を兄弟要素として分離配置。
- **`dashboard/src/views/overview/View.tsx` [MODIFY]**
  - `useOverviewWidgets` を統合し、初期表示 Dashboard の各セクションを Widget として動的に配置・描画。
  - セクションヘッダーバーに「＋ ウィジェット追加」ボタン（カタログパネル開閉）と「リセット」ボタン（デフォルトプリセット復元）を追加。
  - 全 Widget 削除時の Empty State 表示（追加またはデフォルトプリセット復元の導線付き）を実装。
- **`dashboard/src/AppShell.tsx` [MODIFY]**
  - `ALL_SECTION_IDS` に拡張カタログ Widget の ID を追加し、一括展開・一括収納と連動。
- **`docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `07_dashboard_ui_ux_spec.md` [MODIFY]**
  - SDD-07 §2.4 に Overview ウィジェット配置・追加・削除・順序変更・リセット・`localStorage` 永続化仕様を追記。
- **`src/tests/ui/overview-widgets.test.tsx` [NEW]**
  - 初期プリセット表示、順序変更、削除、カタログからの追加、`localStorage` 永続化と再マウント時の設定維持、およびデフォルトプリセットへのリセットを検証する RTL テストを追加。

## 2. 品質ゲート検証結果 (Quality Gate Verification)
- `npm run fork:verify`: PASS (Exit code 0)
- `npm run typecheck`: PASS (Exit code 0)
- `npm run lint`: PASS (Exit code 0)
- `npx tsx --test src/tests/ui/overview-widgets.test.tsx`: PASS (2/2 tests passed)
- `npm run secret-scan`: PASS (Exit code 0, Zero secrets/PII)
- `npm run build`: PASS (`main chunk: 165.03 kB / 300 kB budget`)
