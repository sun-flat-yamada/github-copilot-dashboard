# P2-7 バンドル予算と、ブラウザバンドルからの fs / zod 排除 (Issue #187)

## 目的
メインチャンクが 330 kB で、300 kB の予算を超えている。初期表示を軽くし、予算を CI で強制する。

## 方針
1. `scripts/check-bundle.ts`: `npm run build` の最後に実行。メインチャンク > 300 kB、または zod / Node 組み込みスタブを含むチャンクがあれば失敗。
2. `CreditsPresenter` / `BudgetPresenter` は Node 専用の `BillingConfigLoader` (fs + zod) を import しない。請求設定は入力で受け取り、未指定は `DEFAULT_BILLING_CONFIG`。
3. 全 View マニフェストを `React.lazy` にし、チャート (recharts) を遅延ロードにする。DuckDB-WASM は既に dynamic import。
4. `vendor-zod` の manualChunks を削除。
5. テスト: 予算ゲートが失敗することと、`dashboard/src/main.tsx` から辿れる import に Node 組み込み / zod が無いことを検査する。
6. SDD-15 §9 と SDD-02 §4.4 を日英で同期。

## 確認
品質ゲート + `npm run lint`。`BUNDLE_BUDGET_MAIN_KB=100` で失敗することを実証。
