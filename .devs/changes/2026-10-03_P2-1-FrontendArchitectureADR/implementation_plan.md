# Plan: フロントエンドの単一アーキテクチャを ADR に記録する (P2-1)

Issue: #181（親 #173）。C-01。判断結果 #1（推奨案）の追認の記録。コードの変更はなし。

## Proposed Changes
- [NEW] `docs/adr/README.md` / `README.ja.md`: ADR の索引と書き方
- [NEW] `docs/adr/0001-single-frontend-architecture.md` / `.ja.md`: 背景・選択肢・決定・結果・移行手順・撤去対象・`VITE_USE_NEW_STORE` の扱い
- [MODIFY] `docs/specifications/README.md` / `README.ja.md`: ADR 索引の追記
- [MODIFY] SDD-02 §2.7（日英）: 「未決の判断」を ADR-0001 への参照に更新

## 判断
- `VITE_USE_NEW_STORE` はこの PR では変更せず、撤去を P2-5 とする（描画が変わらないフラグであり、DataStore 系の撤去と同じ PR で消すのが最小）。
- DataStore 系のテスト（`DerivedDataGraph` / `StoreEquivalence`）は P2-5 で一緒に削除する。

## 検証
- 品質ゲート: `fork:verify` / `typecheck` / `test` / `secret-scan` / `build`（+ `lint`）
