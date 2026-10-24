# ウィジェットカタログ内での KPI ウィジェットと詳細分析セクションの視覚的分離・識別性向上 (#344)

## 背景と目的
Issue #344 に基づき、`Dashboard` タブの「ウィジェットカタログ」パネル内で、単一指標を表示する **KPI ウィジェット (`size: 'kpi'`)** と、グラフ・テーブル等を表示する **詳細分析セクションウィジェット (`size: 'full'`)** が一目で識別できるよう UI/UX を改善する。

## 変更内容

### 1. カタログ内の 2 グループ構造化・カテゴリフィルター・視覚的差別化 (`dashboard/src/views/dashboard/View.tsx`)
- **カテゴリフィルタータブの追加**:
  - カタログヘッダーに `すべて` / `KPI カード (1/5幅)` / `詳細分析セクション (全幅)` の切り替えタブ (`data-testid="widget-catalog-filter-all"`, `widget-catalog-filter-kpi`, `widget-catalog-filter-section`) を配置。
- **明確な 2 セクション分割表示**:
  1. **KPI サマリーカード (小型・5列グリッド配置)** (`data-testid="widget-catalog-group-kpi"`)
     - エメラルド系のアクセントヘッダー・アイコン・配置済み件数表示 (`X / 5 配置中`)・説明文（「単一の重要指標を1/5幅のカードでコンパクトに表示します」）。
     - 各カードアイテムにも左ボーダーアクセント (`border-l-4 border-l-emerald-500/70`) と「📊 KPI カード (1/5幅)」バッジを表示。
  2. **詳細分析セクション (大型・全幅アコーディオン)** (`data-testid="widget-catalog-group-section"`)
     - インディゴ系のアクセントヘッダー・アイコン・配置済み件数表示 (`X / Y 配置中`)・説明文（「グラフ・内訳テーブル・診断パネルを全幅セクションで表示します」）。
     - 各セクションアイテムにも左ボーダーアクセント (`border-l-4 border-l-indigo-500/70`) と「📑 分析セクション (全幅)」バッジを表示。

### 2. テストおよび仕様書の更新
- `src/tests/ui/overview-widgets.test.tsx`:
  - カタログパネルを開いた際、`widget-catalog-group-kpi` と `widget-catalog-group-section` の 2 つのグループに明確に分離されていること、およびカテゴリフィルターで KPI のみ / 分析セクションのみに絞り込めることを検証。
- `docs/specifications/07_dashboard_ui_ux_spec.ja.md` および `docs/specifications/07_dashboard_ui_ux_spec.md`:
  - ウィジェットカタログにおける KPI ウィジェットと詳細分析セクションのグループ分離仕様を追記。

## 検証計画
- `npm run change-dev:plan-check`
- `npm run fork:verify && npm run typecheck && npm run lint && npm test && npm run secret-scan && npm run build`
