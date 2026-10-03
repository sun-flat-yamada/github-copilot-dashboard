# ADR-0001: フロントエンドの単一アーキテクチャ（Dataset + Registry）

[English](0001-single-frontend-architecture.md) | [日本語](0001-single-frontend-architecture.ja.md)

- **状態**: 承認済み（2026-10-03）
- **決定者**: リポジトリオーナー（改善計画の判断結果 #1、2026-10-01）
- **指摘 ID**: C-01（C-02, C-03, C-08 を含む）
- **追跡**: Issue #181（P2-1）、親 #173（Phase 2）

## 1. 背景

フロントエンドには 2 つのアーキテクチャが併存している。

| 経路 | 入口 | 状態・フィルター | 描画 | 状態 |
|:--|:--|:--|:--|:--|
| **hook 経路** | `dashboard/src/App.tsx`（762 行） | `useDashboardData`（673 行）+ `dashboard/src/utils/filterEngine.ts` | `App.tsx` の条件分岐 | **本番**。`main.tsx` は常に `App` を描画する |
| **DataStore 経路** | `dashboard/src/AppV2.tsx`（145 行） | `DataStore` + `DerivedDataGraph`（`src/application/store/**`） | `ViewOrchestrator` 経由の `ViewPlugin`（`src/adapters/views/**`） | **未マウント**。`VITE_USE_NEW_STORE=true` は `App` を `DashboardProvider` で包むだけで、描画内容は変わらない |

レビューで確認した影響（C-01）:

- `ViewPlugin` は `App.tsx` の対応する JSX の複製であり、実際の描画主体ではない。両者は乖離する。
- ビューの追加で最大 7 箇所を直す（`AnalysisViewId`、`ANALYSIS_VIEW_REGISTRY`、ViewPlugin、`adapters/views/index.ts`、`App.tsx` の条件分岐、`ICON_MAP`、ナビゲーションのメタ情報）。
- SDD-02 の目標アーキテクチャは DataStore 経路を記述しているが、実際に動くのは hook 経路である（SDD-02 §2.7）。
- どちらの経路も事前集計済みの `ScopeAggregatedData` を入力にしている。どちらか一方に寄せるだけでは C-02 / C-03 は解消しない（決定を参照）。

## 2. 選択肢

| 案 | 概要 | 評価 |
|:--|:--|:--|
| **A. DataStore 経路を昇格** | `AppV2` を完成させて本番を切り替え、hook を削除する | ストアは旧来の集計済み JSON の形に合わせて書かれ、hook ロジックの写しである（`StoreEquivalence.test.ts` はその一致を確かめるためだけに存在する）。昇格すると C-02 / C-03 のデータ契約の問題が残り、プロダクトに不要なイベントソース型ストアが加わる。却下 |
| **B. hook 経路のまま維持** | DataStore 経路を削除して終える | 最小コストだが、7 箇所修正・条件分岐描画・データソース別の重複コンポーネント（C-02）が残る。最終形としては却下。中間状態としては許容 |
| **C. hook 経路を Dataset + Registry へ移行し、DataStore 経路を撤去（採用）** | 本番で動くものを土台に、Dataset Loader / Query 層、Metric Registry、View Registry へ段階移行し、DataStore 系を削除する | 各ステップが通常の PR で、本番を壊さない。C-01〜C-03 をまとめて解消できる。DataStore 経路のうち残す価値のある部品を再利用できる（下記） |

## 3. 決定

**案 C** を採用する。

1. **hook 経路を土台とする**。実利用と挙動のテスト資産があるのはこの経路だけであり、移行の全期間を通じて稼働させ続ける。
2. **目標の構成**（改善計画 A.7.4）:
   - **Dataset Loader**: `index.json` を読み、パーティションを遅延ロードする。表示コンポーネントはデータソースを知らない。
   - **Query 層**: フィルター・グループ化・集計を行う唯一の場所（DuckDB-WASM、判断結果 #4）。`key={datasetVersionKey}` による再マウントを不要にする。
   - **Metric Registry**: 実行可能な指標カタログ。値に品質属性（実測 / 推定 / 欠損 / デモ）を付ける。
   - **View Registry**: 描画の唯一の入口。`App.tsx` の条件分岐を撤去する。ビュー追加は manifest + コンポーネントで完結する。
3. **DataStore 経路は昇格せず撤去する**（§5）。
4. **`VITE_USE_NEW_STORE` は P2-5 で撤去する**（それ以前には行わない。§6）。このフラグは別の UI を選ぶものではなかったため、撤去しても挙動は変わらない。
5. SDD-02 / SDD-15 は、対応するステップ（P2-2〜P2-4）の着地時に更新し、仕様と本番経路が再び乖離しないようにする。

## 4. 再利用する部品と置き換える部品

| 部品 | 扱い |
|:--|:--|
| `src/application/views/ViewPluginRegistry.ts`, `ViewOrchestrator.ts` | View Registry へ発展させる（P2-4） |
| `src/adapters/presenters/*`（データ → ビューモデルの純粋関数） | 残す。Query 層の出力の下へ移す。Credits / Agent / Adoption の Presenter は `App.tsx` が既に使用している |
| `src/adapters/views/*ViewPlugin.tsx` | 実コンポーネントを指す View manifest に置き換え、JSX の複製を削除する（P2-4, P2-5） |
| `dashboard/src/utils/filterEngine.ts`, `useDashboardData` | P2-2 で `filterEngine` を `dashboard/src/query/` へ移し、Query 層の実装とした。`useDashboardData` は取得を Dataset Loader へ委譲済みで、P2-4 で退役する |

## 5. 撤去対象

Registry が依存しなくなった後、P2-5（C-08）で削除する:

- `dashboard/src/AppV2.tsx`
- `src/application/store/**`（`DataStore`、`DataStoreReducer`、`DataStoreState`、`derived/DerivedDataGraph`、`derived/nodes/*`）
- `src/frameworks/react/**`（`DashboardProvider`、`useStoreSelector`、`useStoreDispatch`、`useViewPlugin`）と `src/frameworks/composition-root.ts`（`createDashboardApp`）
- DataStore 経路専用のテスト: `src/tests/application/DerivedDataGraph.test.ts`、`src/tests/application/StoreEquivalence.test.ts`

改善計画の付録 C にあるその他の未参照モジュールも P2-5 で扱う。本決定の対象ではない。

## 6. `VITE_USE_NEW_STORE` の扱い

| 時期 | 対応 |
|:--|:--|
| 現在（P2-1） | コード変更なし。SDD-02 §2.7 が「フラグは `App` を変えない」と既に記載している |
| P2-2〜P2-4 | フラグは無効のまま。新しいコードはこれを参照しない |
| **P2-5** | `dashboard/src/main.tsx` の分岐を撤去し（`App` を直接描画）、`createDashboardApp` の import を削除する。§5 の対象と同じ PR で行う |

## 7. 結果

- **利点**: 描画経路が 1 本になる。新ビューは manifest + コンポーネントで済む。データ契約（C-02 / C-03）とアーキテクチャを同じ順序で解消できる。どのステップでも本番を出荷可能に保てる。
- **欠点**: P2-4 まで `App.tsx` と `useDashboardData` の規模は残る。DataStore 経路のテストは破棄するため、移行後の挙動の保護は P2-6（挙動テスト）で担う。
- **可逆性**: P2-5 まではリスクが小さい。P2-5 以降、DataStore のコードは Git 履歴からしか戻せない。

## 8. 移行手順

| ステップ | タスク | 結果 |
|:--|:--|:--|
| P2-1 | 本 ADR | 決定の記録 |
| P2-2 | Dataset Loader / Query 層（#182） | 全ビューが同一のデータ契約を参照 |
| P2-3 | Metric Registry（#183） | 推定・欠損・デモを共通スタイルで表示 |
| P2-4 | View Registry、`App.tsx` の条件分岐撤去（#184） | 新ビュー = 2 ファイル |
| P2-5 | デッドコードと層違反の解消（#185） | §5 の対象と `VITE_USE_NEW_STORE` を撤去 |
| P2-6 | テスト刷新（#186） | 主要フローを挙動テストで保護 |
| P2-7 | バンドル予算（#187） | CI でメインチャンク 300 kB 以下を強制 |

## 9. 参照

- 改善計画: `.devs/changes/2026-10-01_DashboardReviewAndImprovementPlan/implementation_plan.md`（判断結果 #1、C-01〜C-03、C-08、A.7.4、付録 C）
- SDD-02 §2.7（実装の結線状況）、SDD-15（データセントリック・リアクティビティ設計）
