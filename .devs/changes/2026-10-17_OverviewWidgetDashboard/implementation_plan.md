# 初期表示 Dashboard ページ (Overview) の Widget 方式配置・カスタマイズ機能 実装計画

Issue: #331

GitHub Pages の初期表示 Dashboard ページ（`overview` ビュー）を Widget 方式で配置可能にし、アクセス者が Widget の追加・削除・表示順番変更（上下移動ボタンおよびドラッグ＆ドロップ）・デフォルトプリセットへのリセットを行えるようにします。また、カスタマイズ内容はブラウザの `localStorage` に自動保存され、次回アクセス時にも前回設定内容が維持されます。

## 変更概要 (Proposed Changes)

### 1. Widget 状態管理・永続化フック層
#### [NEW] [dashboard/src/hooks/useOverviewWidgets.ts](../../../dashboard/src/hooks/useOverviewWidgets.ts)
- `LIVE_WIDGET_CATALOG` および `REPORT_WIDGET_CATALOG` の定義（デフォルトプリセット Widget + 追加可能な拡張 Widget カタログ）。
  - Live モード既定プリセット (`DEFAULT_LIVE_WIDGET_IDS`): `['advisor', 'allocation', 'yearly-trend', 'budget', 'usage', 'users']`
  - Live モード追加可能カタログ: `budget-timeline` (Cost Center 予算推移と上限到達予測), `credits` (AI Credits & コスト内訳), `agent` (AI Agent & MCP 活用動向), `adoption` (AI 採用成熟度), `audit` (監査・データ品質)
  - Report / Upload モード既定プリセット (`DEFAULT_REPORT_WIDGET_IDS`): `['report_charts', 'report_users']`
  - Report / Upload モード追加可能カタログ: `report_budget` (Cost Center 予算進捗管理), `report_budget_timeline` (Cost Center 予算推移と上限到達予測), `report_credits` (AI Credits & コスト内訳), `report_audit` (監査・データ品質)
- `localStorage` キー (`copilot_dashboard_overview_widgets_v1`) による状態の読み込み・自動保存・スキーマ検証。
- 操作 API:
  - `addWidget(id)`: カタログから Widget を末尾に追加
  - `removeWidget(id)`: 指定 Widget を表示一覧から削除
  - `moveWidget(id, direction: 'up' | 'down')`: 表示順番を前後に移動
  - `reorderWidgets(fromId, toId)`: ドラッグ＆ドロップ等で表示順番を入れ替え
  - `resetWidgets()`: 現在のデータソース種別（または全体）をデフォルトプリセットへリセット
  - `isCustomized`: デフォルトプリセットから変更されているかどうかの判定フラグ

### 2. UI コンポーネント層
#### [MODIFY] [dashboard/src/components/common/CollapsibleSection.tsx](../../../dashboard/src/components/common/CollapsibleSection.tsx)
- Widget 方式の操作コントロール（ドラッグハンドル、上へ移動 `↑`、下へ移動 `↓`、削除 `×`）をオプショナル Props として受け取れるよう拡張。
- WCAG 2.2 AA / `axe-core` の `nested-interactive` ルールに違反しないよう、アコーディオン開閉 `<button>` と Widget 操作 `<button>` 群を兄弟要素として配置。

#### [MODIFY] [dashboard/src/views/overview/View.tsx](../../../dashboard/src/views/overview/View.tsx)
- `useOverviewWidgets` を用いて、初期表示 Dashboard の各セクションを Widget として動的に配置・描画。
- セクションヘッダーバーに以下のコントロールを統合:
  - 「**＋ ウィジェット追加**」ボタン & カタログポップオーバー/ドロワー（未配置の Widget を一覧表示しワンクリックで追加可能、全配置済み時はその旨を表示）
  - 「**初期設定にリセット**」ボタン（デフォルトプリセットへ即座に復元）
  - 既存の「すべて展開 / すべて収納」ボタンとの調和配置
- Widget がすべて削除された場合の空状態（Empty State）表示と、そこからの「ウィジェット追加」「デフォルトプリセットに戻す」導線を提供。

#### [MODIFY] [dashboard/src/AppShell.tsx](../../../dashboard/src/AppShell.tsx)
- `ALL_SECTION_IDS` に追加カタログ Widget のセクション ID を登録し、「すべて展開 / すべて収納」が一貫して機能するように拡張。

### 3. ドキュメント・仕様書層
#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md)
#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- Overview 初期表示 Dashboard における Widget 方式配置・追加・削除・順序変更・デフォルトプリセットリセット・`localStorage` 永続化仕様を追記。

### 4. テスト層
#### [NEW] [src/tests/ui/overview-widgets.test.tsx](../../../src/tests/ui/overview-widgets.test.tsx)
- デフォルトプリセットでの初期表示確認
- Widget の追加・削除・表示順番変更（上移動・下移動・並び替え）の検証
- `localStorage` への保存および再マウント時の前回設定内容の維持確認
- デフォルトプリセットへのリセット動作の検証

## 検証計画 (Verification Plan)
1. `npm run change-dev:plan-check` による Plan-First コミット順序の検証
2. `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` の5段階品質ゲート実行
