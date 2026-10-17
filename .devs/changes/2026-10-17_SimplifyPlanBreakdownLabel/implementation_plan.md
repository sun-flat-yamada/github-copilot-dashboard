# Implementation Plan - Simplify Plan Breakdown Header Label (#393)

## 1. Overview / 概要
月次レポート KPI サマリーカード「レポート内アクティブ人数」において、カード冒頭に `(アクティブ / ノンアクティブ / 全数)` が明記されたため、下部の `プラン内訳 (アクティブ / ノンアクティブ / 全数):` という記述が重複しています。下部の表示を `プラン内訳:` のみに簡素化します。

## 2. Changes / 変更点
1. `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`:
   - `プラン内訳 (<span className="text-emerald-400 font-bold">アクティブ</span> / ノンアクティブ / 全数):` を `プラン内訳:` に変更。
2. `src/tests/ui/monthly-report-kpis.test.tsx`:
   - `assert.ok(breakdown.textContent?.includes('プラン内訳:'));` にアサーションを更新。

## 3. Verification / 検証手順
1. `npx tsx --test src/tests/ui/monthly-report-kpis.test.tsx`
2. `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
