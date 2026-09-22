[English](15_data_centric_reactivity_design_spec.md) | [日本語](15_data_centric_reactivity_design_spec.ja.md)

---

# SDD-15: データセントリック・リアクティビティ設計仕様書 (Data-Centric Reactivity Design Specification)

- **文書番号**: SPEC-COPILOT-015
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-22
- **関連要件**: [SDD-01 FR-9 (ビュー横断データセントリック・リアクティビティ)](01_requirements_specification.ja.md)

---

## 1. 目的・背景

本ダッシュボードは、ヘッダーの **アクティブデータソース選択 (`ActiveDataSelector`)**、**スコープ選択 (`ScopeSelector`)**、**タグANDフィルター (`TagFilterBar`)** をグローバルなコントロールバーとして常設し、その配下に 6 種の分析View（`ViewNavigation`、SDD-01 FR-8）を切り替え表示する構成を採る。

この構成には、実装を誤ると顕在化しにくい構造的な罠がある：

> **グローバルなコントロールバー（データソース/スコープ/タグ）は、各Viewコンポーネントの外側の兄弟要素として配置されている。フィルターやスコープを変更しても、現在表示中のViewは通常「アンマウント→再マウント」されない。**

つまり、あるViewが「初回マウント時にのみ計算し、以後は放置する」実装になっていた場合、ユーザーがタブを切り替えずにタグやスコープだけを変更しても、そのViewは**古い計算結果を表示し続ける**。これは見た目上「フィルターが効いていないバグ」として観測されるが、実体は「アクティブ選択データの変化にViewが追従していない」という設計原則の欠落である。

本仕様書は、この**データセントリックな追従性 (Data-Centric Reactivity)** をシステム全体の設計原則としてナレッジ化し、恒久的な再発防止のための具体的な設計方針・実装規約・レビューチェックリストを定める。

### 1.1 実際に発生した不具合（ケーススタディ）

本原則が未整備だったために実際に発生し、修正された代表的な不具合を以下に記録する。今後の実装・レビューにおける具体的な反面教師とする。

#### ケーススタディ A: デフォルト選択モデルがアクティブ選択データに追従しない (`model_radar` View)
- **症状**: 「モデル特性レーダー」Viewを開いた際、デフォルトで選択されるべき「アクティブ選択されている分析対象データのTop3利用モデル」が、常に固定のモデルID (`claude-3-7-sonnet`) になっていた。またタグ/スコープ変更後もデフォルト選択が再計算されなかった。
- **根本原因 1**: `App.tsx` が `focusedRadarModelId` の初期状態値をハードコードされた有効なモデルIDに固定していたため、「Top3自動選択」ロジックへ到達する分岐が実質的に到達不能になっていた（常に「明示的単一モデル指定」分岐が選ばれてしまう）。
- **根本原因 2**: `ModelRadarView.tsx` 内の `hasInitializedRef` が初回effectで無条件に `true` にセットされ、以後「Top3再計算」を行う安全弁effectが永久に無効化されていた。Viewはタグ/スコープ変更時に再マウントされないため、この一度きりの初期化ガードが「未来の正当な再計算」までブロックしてしまっていた。
- **修正方針**: 「ユーザーが手動で選択を上書きしたか」を表す `isManualSelectionRef` と、「直前に適用した明示的モデルID」を表す `appliedInitialModelIdRef` を分離導入。手動操作時のみ `isManualSelectionRef.current = true` をセットし、それ以外は `aggregatedData` / `monthlyReportData` の変化のたびにTop3を再計算する設計に変更（詳細は [SDD-10 §2.3](10_ai_model_benchmark_radar_spec.ja.md)）。

#### ケーススタディ B: モデル利用割合(%)がタグ選択に追従しない (`model_radar` View, Monthly Usage Report経路)
- **症状**: Tagフィルターを変更しても、各AIモデルの「利用割合 (%)」表示が更新されなかった。
- **根本原因**: `useDashboardData.ts` の `filteredActiveReportData`（タグ絞り込み後の月次レポートデータを生成するメモ化フック）は、`overview` / `user_details` / `by_department` 等の集計フィールドはタグ絞り込み後に正しく再集計していたが、**`model_breakdown`（モデル別内訳）だけはパース時点の組織全体の値をそのまま素通し**させていた。利用割合(%)の算出ロジック (`computeModelUsage`) は Live Metrics が空の場合にこの `model_breakdown` をフォールバックとして参照するため、Monthly Report / アップロードデータを分析中のユーザーには、タグ選択の効果が一切反映されなかった。
- **教訓**: **1つの集計データ型に複数の派生フィールドが存在する場合、フィルター再計算メモは「一部のフィールドだけ」を更新し、残りを素通しさせる「部分的再集計漏れ」を起こしやすい。** 新しいフィールドをデータ型に追加するたびに、そのデータ型を再集計している全てのメモ関数を横断的に点検する必要がある。
- **修正方針**: `model_breakdown` の再集計ロジックをフック内のインライン処理から独立した純粋関数 `buildFilteredModelBreakdown`（`dashboard/src/utils/reportModelBreakdown.ts`）として抽出し、`filteredActiveReportData` から呼び出すよう変更。純粋関数化したことで、実データ入出力による回帰テストが可能になった。

両ケースに共通する構造的教訓は 第2節・第3節 に一般化して整理する。

---

## 2. 用語定義

| 用語 | 定義 |
| :--- | :--- |
| **アクティブ選択データ (Active Selected Data)** | 現在ユーザーが選択している **(a) アクティブデータソース種別**（Live Metrics / Monthly Usage Report / User Upload、SDD-01 FR-3-1）、**(b) 時間・グループスコープ**（日次/月次/指定期間 × 選択キー、SDD-01 FR-3-2）、**(c) タグANDフィルター**（`selectedTags`、SDD-01 FR-6）の組み合わせ全体を指す。 |
| **データセントリック・リアクティビティ (Data-Centric Reactivity)** | 各Viewの表示内容（KPI数値、デフォルト選択、グラフ、派生集計値）が、常に「現在のアクティブ選択データ」に対する純粋な写像として算出される性質。マウントタイミングに依存せず、アクティブ選択データが変化するたびに即時追従しなければならない。 |
| **派生データ (Derived Data)** | `useDashboardData` フックが生データ（`currentData` 等の生スコープデータ、`activeReportData` 等の生レポートデータ）から算出する、フィルター適用済みの2次データ（`filteredCurrentData` / `filteredActiveReportData` 等）。Viewコンポーネントはこの派生データのみを参照すべきであり、生データを直接参照してはならない。 |
| **フォールバック経路 (Fallback Path)** | 主経路のデータが空・未取得の場合に、代替のデータソースから値を補完するロジック分岐（例: `computeModelUsage` の Live Metrics 分岐が空の場合の Monthly Report 分岐）。 |

---

## 3. 設計方針 (Design Policy)

### 3.1 単一情報源の原則 (Single Source of Truth via Hooks)
- `useDashboardData` フックは、フィルター・スコープ適用済みの**派生データのみ**（`currentData` = `filteredCurrentData`、`currentReportData` = `filteredActiveReportData` 等）を戻り値として公開する。
- Viewコンポーネント（`App.tsx` 配下の各Viewコンポーネント）は、この派生データを props 経由で受け取って描画するのみとし、フィルター適用前の生データや `selectedTags` を直接参照して独自に再フィルタリングしてはならない（二重実装によるロジックのズレを防止するため）。

### 3.2 派生集計フィールドの完全性原則 (Completeness of Derived Aggregates)
- ある集計データ型（例: `MonthlyReportAggregatedData`）が複数の集計フィールド（`overview`, `user_details`, `by_department`, `model_breakdown`, `sku_breakdown` 等）を持つ場合、その型のフィルター済み版を生成するメモ関数（例: `filteredActiveReportData`）は、**当該型に属する全ての集計フィールドを例外なく再計算**しなければならない。一部のフィールドのみを再計算し、残りを `...unfiltered` のスプレッドで素通しさせることは禁止する。
- **実装規約**: データ型に新しい集計フィールドを追加する際は、そのデータ型を生成・再計算している全てのメモ関数（`filteredCurrentData`, `filteredActiveReportData` 等）を横断的に検索し、同じフィルター条件で再計算ロジックを追加すること。

### 3.3 Reactフック実装規約 (React Hook Implementation Conventions)
- **依存配列は「派生データの参照」を含めること**: `useMemo` / `useEffect` の依存配列には、フィルター適用済みの派生データオブジェクト（`aggregatedData`, `monthlyReportData` 等）を含め、それらの参照が変化するたびに再計算がトリガーされる設計とする。
- **「一度きりの初期化フラグ」を安易に導入しない**: `hasInitializedRef.current = true` のように、一度セットしたら二度と `false` に戻らないフラグで再計算をブロックする実装は、Viewが再マウントされない限り恒久的にデータ変化への追従を止めてしまう。デフォルト自動選択と手動選択を共存させたい場合は、以下のように**意図の異なる2つのフラグに分離**すること：
  - `isManualSelectionRef`: ユーザーが明示的に操作した場合のみ `true`。true の間はシステムによる自動再計算を抑制する。
  - （必要であれば）`appliedXxxRef`: 直前に適用した明示的な値を記録し、同一値の再適用による無限ループを防止する用途に限定する。
- **Viewの非アンマウント性を前提に設計すること**: `TagFilterBar` / `ScopeSelector` / `ActiveDataSelector` は各Viewの外側（兄弟要素）に配置されているため、これらの変更はViewを再マウントさせない。Viewは「マウント時に1度だけ実行されるeffect」と「アクティブ選択データの変化のたびに実行されるeffect」を明確に分離して実装すること。

### 3.4 フォールバック経路の同等性原則 (Fallback Path Parity)
- ある値の算出に複数のデータソース経路（例: Live Metrics優先、空の場合はMonthly Reportにフォールバック）が存在する場合、**フォールバック先の経路も、主経路と全く同じフィルター条件を適用した派生データを参照**しなければならない。「フォールバック経路だから」という理由でフィルター未対応が許容されることはない。
- 経路ごとにデータの粒度が異なる場合（例: Live Metricsはユーザー単位のモデル別内訳を保持するが、Monthly Reportはユーザーの主要モデル1つのみ保持）、フォールバック経路では**利用可能な最良の近似値**でフィルター条件を反映すること。近似である旨は当該仕様書または実装コメントに明記する（例: SDD-10 §2.3 の `primary_model` 按分近似）。

### 3.5 テスト規約 (Testing Convention)
- フィルター・集計ロジックは、Reactフックやコンポーネントに直接インライン記述せず、**入出力を明示できる独立した純粋関数**として `dashboard/src/utils/` 等に抽出すること。これにより、実データを用いた入出力ベースの回帰テスト（`node:test`）が可能になる。
- 「タグ/スコープ変更で値が更新されない」不具合を修正した場合は、必ず以下を検証する回帰テストを追加すること：
  1. フィルター適用前後で対象の集計値が変化すること（同一のまま固定されていないこと）。
  2. フィルターで対象がゼロ件になった場合でも例外（ゼロ除算等）を起こさないこと。
  3. フィルター未適用時は、元の（パース時点の）厳密な値が維持されること（回帰防止）。

---

## 4. レビューチェックリスト

Tagフィルター・スコープ・データソース切り替えに関わるコード変更（View / `useDashboardData` / 集計ユーティリティ）をレビューまたは実装する際は、以下を確認すること：

- [ ] 変更対象のViewは、`aggregatedData` / `monthlyReportData` 等の**派生データの変化のみ**をトリガーに再計算されるか（生データや `selectedTags` を独自に再参照していないか）。
- [ ] 対象の集計データ型が持つ**全てのフィールド**が、フィルター適用済みメモ関数内で再計算されているか（一部フィールドの素通しがないか）。
- [ ] 「一度きりの初期化フラグ」で将来の正当な再計算をブロックしていないか（`isManualSelectionRef` 等の意図分離ができているか）。
- [ ] フォールバック経路が存在する場合、その経路も同じフィルター条件を反映しているか。
- [ ] フィルター適用前後で値が変化することを検証する回帰テストが追加されているか。

---

## 5. 関連仕様

- [SDD-01 §3 FR-9: ビュー横断データセントリック・リアクティビティ](01_requirements_specification.ja.md) — 本設計方針が実現すべき要求仕様の本文。
- [SDD-07 §1: UI全体レイアウト (データセントリック & 1カラム垂直スタック)](07_dashboard_ui_ux_spec.ja.md) — グローバルコントロールバーとViewの配置構造。
- [SDD-10 §2.3: タグ/スコープ絞り込みとの連動](10_ai_model_benchmark_radar_spec.ja.md) — 本原則の具体適用例（AIモデル特性レーダー）。
