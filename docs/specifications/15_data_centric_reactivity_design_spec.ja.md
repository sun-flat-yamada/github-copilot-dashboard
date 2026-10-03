[English](15_data_centric_reactivity_design_spec.md) | [日本語](15_data_centric_reactivity_design_spec.ja.md)

---

# SDD-15: データセントリック・リアクティビティ設計仕様書 (Data-Centric Reactivity Design Specification)

- **文書番号**: SPEC-COPILOT-015
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-22 (2026-10-03 改訂: §7 Dataset Loader / Query 層を追加。2026-10-01: ケーススタディ C / D、§3.6、§6)
- **関連要件**: [SDD-01 FR-9 (ビュー横断データセントリック・リアクティビティ)](01_requirements_specification.ja.md)

---

## 1. 目的・背景

本ダッシュボードは、ヘッダーの **アクティブデータソース選択 (`ActiveDataSelector`)**（スコープ選択およびANDフィルター条件を統合）をグローバルなコントロールとして常設し、その配下に 6 種の分析View（`ViewNavigation`、SDD-01 FR-8）を切り替え表示する構成を採る。

この構成には、実装を誤ると顕在化しにくい構造的な罠がある：

> **グローバルなコントロール（データソース/スコープ/フィルター）は、各Viewコンポーネントの外側の要素として配置されている。フィルターやスコープを変更しても、現在表示中のViewは通常「アンマウント→再マウント」されない。**

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
- **修正方針**: `model_breakdown` の再集計ロジックをフック内のインライン処理から独立した純粋関数 `buildFilteredModelBreakdown`（`dashboard/src/query/reportModelBreakdown.ts`）として抽出し、`filteredActiveReportData` から呼び出すよう変更。純粋関数化したことで、実データ入出力による回帰テストが可能になった。

#### ケーススタディ C: Cost Center / Organization / 部署 / ユーザー条件だけを変えても月次レポートの KPI が変わらない (P0-6)
- **症状**: 月次レポート (CSV) またはアップロードファイルを表示中に、Cost Center・Organization・部署・ユーザーの条件を変えても KPI が変化せず、タグを変えたときだけ変化した。「未割当」フィルターは 0 件になり、日次・期間スコープでフィルターを適用すると費用が黙って*月額*に変わった。
- **根本原因 1 (依存配列)**: `filteredActiveReportData` を生成する `useMemo` の依存配列が `[activeReportData, selectedTags]` で、他のフィルター条件の変更で再計算されなかった。処理は条件を*使って*いるのに、依存配列がそれを宣言していなかった。
- **根本原因 2 (同じ概念の複数定義)**: パイプラインは経路ごとに異なる「未割当」ラベル (`Default-CostCenter`・`Unassigned-CC`・`未分類 (Unassigned)`・`Default-Org`) を出力する一方、フィルターは `''`・`'Unassigned'`・`'未設定'` しか認識しておらず、「未割当」フィルターが常に 0 件になっていた。費用はスコープに関わらず月額単価で再計算され、予算使用率は 3 か所で異なる規則で計算されていた。
- **根本原因 3 (部分的再集計漏れ — ケース B と同型)**: 利用状況メトリクス・`daily_trends`・言語別・SKU 内訳はユーザー別に再集計できないにもかかわらず、絞り込み後のシート数の隣に、同じ母集団の値のように表示されていた。
- **修正方針**: すべての条件の影響を依存配列で網羅し ESLint で強制 (§6)。センチネル (`UNASSIGNED_FILTER_SENTINEL`) と判定関数 (`isUnassignedValue`) を `src/domain/constants/unassigned.ts` の 1 か所に集約。スコープ種別ごとの費用は `seatCostForScope`、予算は `BudgetUtilizationRule.evaluateUsd` を使う。再集計できないセクションは `src/domain/constants/filter-scope.ts` に列挙し、`filter_notice` 経由で「全社値 (フィルター非対応)」と明示 (§3.6)。

#### ケーススタディ D: 早期 `return` の後ろでの Hook 呼び出し (P0-6、新設の lint が検出)
- **症状 (潜在)**: `CreditsView`・`AgentActivityView`・`AdoptionMaturityView`・`UserTrendViewer`・`CostCenterBudgetCards` が、`if (!data) return …` の*後ろで* `useState` / `useMemo` を呼んでいた。2 回の描画の間にデータが到着 (または消失) すると Hook の数が変わり、React が描画を中断して (「Rendered more hooks than during the previous render」/「Rendered fewer hooks than expected」) 画面全体が真っ白になる。
- **根本原因**: 検出する仕組みが無かった。テストの多くは挙動ではなくソース文字列を検査しており、lint ルールも未導入だった。
- **修正方針**: Hook をすべての早期 return より上へ移動し、`react-hooks/rules-of-hooks` と `react-hooks/exhaustive-deps` を error として強制する (§6)。

これらに共通する構造的教訓は 第2節・第3節・第6節 に一般化して整理する。

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
- **Viewの非アンマウント性を前提に設計すること**: `ActiveDataSelector` / `DataSelectionModal` は各Viewの外側に配置されているため、これらの変更はViewを再マウントさせない。Viewは「マウント時に1度だけ実行されるeffect」と「アクティブ選択データの変化のたびに実行されるeffect」を明確に分離して実装すること。

### 3.4 フォールバック経路の同等性原則 (Fallback Path Parity)
- ある値の算出に複数のデータソース経路（例: Live Metrics優先、空の場合はMonthly Reportにフォールバック）が存在する場合、**フォールバック先の経路も、主経路と全く同じフィルター条件を適用した派生データを参照**しなければならない。「フォールバック経路だから」という理由でフィルター未対応が許容されることはない。
- 経路ごとにデータの粒度が異なる場合（例: Live Metricsはユーザー単位のモデル別内訳を保持するが、Monthly Reportはユーザーの主要モデル1つのみ保持）、フォールバック経路では**利用可能な最良の近似値**でフィルター条件を反映すること。近似である旨は当該仕様書または実装コメントに明記する（例: SDD-10 §2.3 の `primary_model` 按分近似）。

### 3.5 テスト規約 (Testing Convention)
- フィルター・集計ロジックは、Reactフックやコンポーネントに直接インライン記述せず、**入出力を明示できる独立した純粋関数**として `dashboard/src/utils/` 等に抽出すること。これにより、実データを用いた入出力ベースの回帰テスト（`node:test`）が可能になる。
- 「タグ/スコープ変更で値が更新されない」不具合を修正した場合は、必ず以下を検証する回帰テストを追加すること：
  1. フィルター適用前後で対象の集計値が変化すること（同一のまま固定されていないこと）。
  2. フィルターで対象がゼロ件になった場合でも例外（ゼロ除算等）を起こさないこと。
  3. フィルター未適用時は、元の（パース時点の）厳密な値が維持されること（回帰防止）。

- **ソース文字列テストより挙動テスト (P2-6)**: UI の挙動は、ソース文字列への正規表現ではなく、画面を描画して操作するテストで守る。2 層ある: React Testing Library のテスト (`src/tests/ui/*.test.tsx`、`npm test` で実行。§8) と、Playwright スモーク (`e2e/*.spec.ts`、`npm run e2e` で実行。§8)。ソース文字列のテストは、見える挙動を持たない構造ルール (例: import の向き) に限って許容する。

### 3.6 フィルターエンジンの単一化と、概念ごとの単一定義 (P0-5 / P0-6)
複数のモジュールが必要とする振る舞いは 1 か所に定義して import する。複製は必ずずれる (ケーススタディ C)。
- **フィルターエンジン**: フィルター適用と全派生フィールドの再計算は `dashboard/src/query/filterEngine.ts` (`applyFilterCriteriaToLiveScope`、レポート版、`isFilterCriteriaActive`) に置く。コンポーネントやフックでフィルターを再実装しない。
- **未割当**: `UNASSIGNED_FILTER_SENTINEL` と `isUnassignedValue` (`src/domain/constants/unassigned.ts`) が、「Cost Center / Organization / グループ未設定」の唯一の定義。
- **金額**: スコープ別のシート費用は `seatCostForScope` (日次=日割り、月次=月額、期間=日割り×日数)、予算使用率は `BudgetUtilizationRule.evaluateUsd`、価格は `src/domain/pricing/pricing-catalog.ts` (SDD-03 の価格表、SDD-06 §1.1 / §1.5 / §1.6)。母集団を変えるフィルターは、費用を**アクティブスコープの単位で**再計算しなければならない。
- **フィルターに追従できないセクション**: ユーザー別の実測を持たないセクションは再計算せず、フィルター済みとして黙って表示することもしない。`LIVE_UNFILTERABLE_SECTIONS` / `REPORT_UNFILTERABLE_SECTIONS` (`src/domain/constants/filter-scope.ts`) に列挙し、全社値のまま、結果に `filter_notice.unfiltered_sections` を付けて View に「全社値 (フィルター非対応)」バッジを表示させる (SDD-07 §2.13)。集計データ型に新しいセクションを追加するときは、再計算するか、このリストへ追加する。§4 のチェックリストが対象とする。

---

## 4. レビューチェックリスト

Tagフィルター・スコープ・データソース切り替えに関わるコード変更（View / `useDashboardData` / 集計ユーティリティ）をレビューまたは実装する際は、以下を確認すること：

- [ ] 変更対象のViewは、`aggregatedData` / `monthlyReportData` 等の**派生データの変化のみ**をトリガーに再計算されるか（生データや `selectedTags` を独自に再参照していないか）。
- [ ] 対象の集計データ型が持つ**全てのフィールド**が、フィルター適用済みメモ関数内で再計算されているか（一部フィールドの素通しがないか）。
- [ ] 「一度きりの初期化フラグ」で将来の正当な再計算をブロックしていないか（`isManualSelectionRef` 等の意図分離ができているか）。
- [ ] フォールバック経路が存在する場合、その経路も同じフィルター条件を反映しているか。
- [ ] フィルター適用前後で値が変化することを検証する回帰テストが追加されているか。
- [ ] メモ / effect が*読んでいる*フィルター条件はすべて依存配列に入っているか (`npm run lint` がクリーン。理由を書かない `eslint-disable` が無いこと)。
- [ ] すべての Hook が、コンポーネント内の早期 `return` / 条件分岐より前に呼ばれているか。
- [ ] 変更が §3.6 の単一定義 (センチネル・`seatCostForScope`・`BudgetUtilizationRule`・価格カタログ) を再利用し、複製を増やしていないか。
- [ ] フィルター下で再集計できないセクションは、再計算されているか、`filter-scope.ts` に列挙して明示されているか。

---

## 5. 関連仕様

- [SDD-01 §3 FR-9: ビュー横断データセントリック・リアクティビティ](01_requirements_specification.ja.md) — 本設計方針が実現すべき要求仕様の本文。
- [SDD-07 §1: UI全体レイアウト (データセントリック & 1カラム垂直スタック)](07_dashboard_ui_ux_spec.ja.md) — グローバルコントロールバーとViewの配置構造。
- [SDD-10 §2.3: タグ/スコープ絞り込みとの連動](10_ai_model_benchmark_radar_spec.ja.md) — 本原則の具体適用例（AIモデル特性レーダー）。

---

## 6. 静的な強制: ESLint (React Hooks)

ケーススタディ C・D はレビューのチェックリストでは検出できなかった。機械で検出する。

- **ルール** (`eslint.config.js`、flat config、`dashboard/src/**/*.{ts,tsx}` に適用): `react-hooks/rules-of-hooks: error` と `react-hooks/exhaustive-deps: error`。
- **実行箇所**: ローカルの `npm run lint`、`.github/workflows/test-and-preview.yml` の専用ステップ「Run ESLint (React Hooks rules + TypeScript-oriented core rules)」、および `npm test` 内の `src/tests/lint-react-hooks.test.ts`。したがって、文書化済みの 5 段階の品質ゲート (`fork:verify → typecheck → test → secret-scan → build`) が 6 段目を足さずにこれを強制する。
- **抑止**: 意図的な省略は `// eslint-disable-next-line react-hooks/exhaustive-deps` に**理由を書いたコメントを添えて**記す (例: `useDashboardData` のレポート取得 effect は、選択レポート月が変わったときだけ実行する必要があり、`currentReportData` を依存に加えると無限ループになる)。理由の無い抑止はレビューの指摘事項とする。
- **パーサー**: TypeScript は Babel (`@babel/eslint-parser` + `@babel/preset-typescript`) で構文解析する。本リポジトリは TypeScript 7 (ネイティブ版) を使っており、`typescript-eslint` が必要とする JavaScript API が提供されない。
- **typescript-eslint の対応状況 (P2-6 で再確認)**: 最新の typescript-eslint (8.x) は peerDependencies に `typescript >=4.8.4 <6.1.0` を宣言しており、TypeScript 7 では使えない。TypeScript 7 に対応するまで、型情報を使うルール (例: `no-floating-promises`) は導入**しない**。代わりに、型情報を要しない次の規則を同じ flat config で強制する: ESLint コア規則 `eqeqeq` (`null` は許可)・`no-var`・`prefer-const`・`no-debugger`、および Babel パーサーが生成する TS ノードに対する `no-restricted-syntax` セレクター (非 null アサーションの連鎖 `x!!`、`Function` 型)。型検査は引き続き `tsc --noEmit` (`strict`・`noUnusedLocals`・`noUnusedParameters`) が担う。typescript-eslint が TypeScript 7 に対応したら、このファイルのパーサーを差し替え、推奨の型付きルール一式を加える。

---

## 7. Dataset Loader と Query 層 (P2-2 / ADR-0001)

ビューごとにデータの取得・結合・フィルターが散在し、同じ条件でも画面によって数値が食い違う原因になっていた (改善計画 C-02 / C-03)。全ビューが同一のデータ契約 **Dataset (Loader) + Query** を参照する。

```text
index.json / スコープ JSON / レポート JSON
   └─ Dataset Loader  (dashboard/src/dataset/datasetLoader.ts)   取得と状態。フィルターはしない
        └─ Query 層 (dashboard/src/query/)                        フィルター・集計の唯一の実装
             └─ hook / ビュー                                     結果を使うだけ。再実装しない
```

### 7.1 Dataset Loader

- `index.json`、スコープ (`daily` / `monthly` / `custom`)、月次レポートを取得する。URL は `resolveDataPath` と複数階層フォールバック `getCandidateDataUrls` (直下 → `processed/`。SDD-05 §2.2) で組み立てる。デモデータへ勝手に切り替えない。
- `DatasetResult<T>` を **状態** 付きで返す。

| 状態 | 意味 |
|:--|:--|
| `ok` | 取得できた。既知の欠けはない |
| `partial` | 取得できたが一部が欠けている。`index.json` に `failed` / `partial` のソースがある、またはスコープに `error` の異常がある |
| `failed` | 取得できなかった。`data` は `null`、理由は `error`。失敗を空データや DEMO として見せない |
| `demo` | DEMO データ。`/demo/` パスから取得、または `is_mock_mode: true` の宣言。デモの数値を実データと誤認させないため、`partial` / `ok` より優先する |

- `custom:<開始>_<終了>` のスコープは取得後に期間で切り出す (`sliceScopeDataByDateRange`)。
- `useDashboardData` は状態をソース別に保持し (`scopeDatasetState`、`reportDatasetState`)、URL の組み立てや DEMO 判定は持たない。

### 7.2 Query 層

- `filterEngine` (§3.6 の唯一のフィルター実装) は `queryEngine` とともに `dashboard/src/query/` に置く。ビューと hook は `dashboard/src/query` だけを import する。
- API: `queryLiveScope` / `queryReport` (フィルター適用後の完全再集計データ)、`queryPopulation` (該当 / 全ユーザー数)、`queryFilterOptions` (選択肢)、`queryCapabilities` (フィルターに追従しないセクション。§3.6)。
- `queryPopulation` は再集計と同じ述語 (`matchUserWithCriteria`) を使うため、セレクターに出る件数は、再集計後の KPI・明細のユーザー数と必ず一致する。渡すデータは**フィルター適用前**のもの。
- フィルターに追従できない指標は `queryCapabilities(source).unfilterableSections` (§3.6 の一覧) で明示し、ビューでラベル表示する。黙ってフィルター済みとして扱わない。

### 7.3 DuckDB-WASM (遅延ロード)

- DuckDB-WASM は Query 層の SQL エンジン (改善計画 判断結果 #4)。`@duckdb/duckdb-wasm` を import するのは `dashboard/src/query/duckdb/duckdbLoader.ts` だけで、呼び出し側は dynamic `import()` で読み込む。静的 import はどこにも無く、Query の index からも再エクスポートしない (`src/tests/query-layer.test.ts` が検査する)。そのため初期バンドルには入らず、ビルドでは別チャンクと wasm / worker ファイルとして出力され、初回利用時にだけ取得される。バンドル予算は P2-7。
- 同梱するのは例外処理 (`eh`) 対応ビルド (wasm 約 34 MB) だけ。現行の主要ブラウザはすべて対応している。
- 最初に SQL 集計を必要とするビュー (ユーザー × 日のファクト。P1-3) が入るまでは、どのビューもローダーを参照せず、ビルド成果物にも含まれない。

### 7.4 移行状況

| 段階 | 状況 |
|:--|:--|
| `useDashboardData` の取得を Dataset Loader へ (index / スコープ / レポート) | 完了 (P2-2) |
| hook のフィルター・選択肢を Query 層経由に | 完了 (P2-2) |
| Query 結果を使うビュー: `ActiveDataSelector` (該当件数)、`DataSelectionModal` (プレビュー件数) | 完了 (P2-2)。どちらも独自にユーザー数を数えており、元データも異なっていた (セレクターはフィルター後のデータ、モーダルの母数は未フィルターのデータ) |
| 残りのビューは hook の再集計済みデータを参照 | 段階移行。Metric Registry + 品質属性: 概要 KPI カードは完了 (P2-3、SDD-07 §2.14a)、View Registry を描画の唯一の入口にし `App.tsx` の分岐を撤去 (P2-4、SDD-07 §2.14b) |
| デッドコードと層違反 | 完了 (P2-5): DataStore 経路と付録 C の未参照モジュールを削除。`src/tests/layer-boundaries.test.ts` が `src/**` から `dashboard/` への import を検出して失敗させる (SDD-02 §3.1) |

---

## 8. 挙動テスト: React Testing Library と Playwright (P2-6)

| 層 | 場所 | 実行 | 守るもの |
|:--|:--|:--|:--|
| React Testing Library (jsdom) | `src/tests/ui/app-behavior.test.tsx` | `npm test` (品質ゲートの一部) | Cost Center フィルターの適用で、その母集団だけで KPI が再計算される / 品質属性 (実測・推定・デモのバッジ、欠損は理由つきの「—」で `0` を出さない) / データ状態バナー (デモバナーと「実データを表示」切替、取得失敗ソースを `role="alert"` で通知、実データが無いときはデモを案内するが黙って読み込まない) |
| Playwright スモーク (Chromium) | `e2e/smoke.spec.ts` | `npm run e2e`。`.github/workflows/test-and-preview.yml` の CI ステップ | フィルター → KPI 変化 (と解除)、デモバナーとデモバッジ、データセレクターからの過去月の表示 |

- **Vite なしでの描画**: `import.meta.glob` (View Registry の自動収集) は Vite でしか動かない。そのためアプリ本体を `AppShell` (`dashboard/src/AppShell.tsx`) とし、`ViewRegistry` を受け取る形にした。`App.tsx` は `defaultViewRegistry` を渡し、テストは同じ探索規則の `discoverViewRegistry()` (`src/tests/ui/test-harness.ts`) で作った Registry を渡す。テストで `App` を描画しない。
- **データ**: RTL テストは固定の 13 ユーザーのデータセット (`src/tests/fixtures/auto-collected-data-fixtures.ts`) を `fetch` スタブ (`installFakeDataServer`) で返す。未登録の URL は静的ホストと同じく 404 を返し、これで「デモへの黙った切替が無い」ことを検証する。Playwright は `npm run demo:generate` で生成したデモデータ (git 管理外) を `?demo=true` で開く。
- **jsdom の準備**: `src/tests/ui/dom-setup.ts` を UI テストの最初の import にする (RTL は import 時に `document` を参照する)。
- **ブラウザ**: Playwright は事前インストール済みの Chromium (`PLAYWRIGHT_BROWSERS_PATH/chromium` または `PLAYWRIGHT_CHROMIUM_EXECUTABLE`) を使い、ダウンロードしない。事前インストールの無い CI では `npx playwright install --with-deps chromium` を実行する。
- **置き換えたソース文字列テスト** (P2-6): `data-status-banner.test.ts` の「App wiring」2 件 (バナーがコンテンツの上に描画される / デモが明示操作として提示される) と、`dashboard-data-stability.test.ts` の `activeDataIsDemoSourced` の受け渡しテストを削除した。同じ挙動を、描画した画面で検証するようになったため。`App.tsx` を読んでいた残りのソース文字列テストは `AppShell.tsx` へ向け直しており、各画面に挙動テストが加わるにつれて段階的に置き換える。
