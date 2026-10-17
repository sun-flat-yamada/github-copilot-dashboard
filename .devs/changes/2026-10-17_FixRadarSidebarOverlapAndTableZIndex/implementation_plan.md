# fix(dashboard): AIモデル選択ペインの本体表示重複防止とベンチマークテーブルz-index修正 (#361)

`モデル特性レーダー` において、`AIモデル選択` ペインが本体表示（レーダーチャート等）に重複して表示されてしまうレイアウト不具合を解消し、サイドバー表示領域の幅を本体側が使えないように排他制御します。また、`著名ベンチマーク最新実測データ詳細テーブル` のヘッダー行および下部フッター行（横スクロール部）がサイドバーより手前側に突き抜けて表示される不具合を修正します。

## ユーザー確認事項 / User Review Required
> [!NOTE]
> 本変更により、画面幅に関わらず `AIモデル選択` ペインと本体表示エリアが横並び（`flex-row`）で配置され、ペインの表示幅（通常表示・省幅表示）が本体から排他的に専有されるため、重なりが完全に防止されます。
> また、右側メインエリアに `isolate`（Stacking Context 分離）を付与し、テーブル下部バーの z-index を適正化することで、スクロール時にテーブルのヘッダー・フッターがサイドバーの手前に突き抜ける現象を根絶します。

## 変更内容 / Proposed Changes

### Dashboard Components
#### [MODIFY] [dashboard/src/components/ModelRadarView.tsx](../../../dashboard/src/components/ModelRadarView.tsx)
- 2 カラムレイアウトコンテナを `flex flex-col lg:flex-row` から `flex flex-row items-start gap-6 relative w-full` に変更し、サイドバーの専有幅を本体表示が使えないように制御。
- 右側メインエリアのコンテナに `isolate` クラスを付与し、内部要素（テーブルヘッダー・フッター・セル）の sticky / z-index をメインエリア内に完全にカプセル化（Stacking Context 分離）。
- 著名ベンチマーク詳細テーブル下部の追従型水平スクロールコントローラーの z-index を `z-40` から `z-20` に調整（テーブル行セル `z-10` より上、かつメインエリア内部で完結）。

#### [MODIFY] [dashboard/src/components/ModelSelectorSidebar.tsx](../../../dashboard/src/components/ModelSelectorSidebar.tsx)
- サイドバーの `sticky` 位置を `top-20` から `top-28`（ナビゲーションバー真下に追従）に調整し、`max-h-[calc(100vh-7.5rem)]` で画面下端へのはみ出しを防止。
- `z-30` を保持し、メインエリア（`isolate` により親レベルで `z-0` 相当）より確実に前面レイヤーとして維持。

### Specifications
#### [MODIFY] [docs/specifications/10_ai_model_benchmark_radar_spec.ja.md](../../../docs/specifications/10_ai_model_benchmark_radar_spec.ja.md)
- 第 2.8 節および第 2.9 節に、サイドバーの排他的幅専有レイアウト制御と Stacking Context（`isolate`）による手前突き抜け防止仕様を追記。

### Automated Tests
#### [NEW] [src/tests/radar-sidebar-layout.test.ts](../../../src/tests/radar-sidebar-layout.test.ts)
- `ModelRadarView.tsx` の 2 カラムコンテナが `flex-row` かつ右側メインエリアに `isolate` が設定されていること、テーブルフッターの z-index が適正化されていること、`ModelSelectorSidebar.tsx` の sticky 配置が正しく設定されていることを検証するユニットテストを追加。

## 検証計画 / Verification Plan
### Automated Tests
- `npm run fork:verify`
- `npm run typecheck`
- `npm test`
- `npm run secret-scan`
- `npm run build`
- 個別テスト: `npm test -- src/tests/radar-sidebar-layout.test.ts`
