# Walkthrough - Compact Plan Breakdown Numbers Display (#358)

## Overview
ユーザーからの要望に基づき、月次レポートの「レポート内アクティブ人数」カード内のプラン内訳表示を改善しました：
1. ヘッダーを `プラン内訳 (アクティブ / ノンアクティブ / 全数):` に更新し、ヘッダー内の「アクティブ」をエメラルドグリーン太字で強調。
2. Enterprise / Business の行を `124 / 26 / 150` のような数字のみのスラッシュ区切り表示に変更。
3. アクティブ人数のみ太字（`font-bold`）かつエメラルドグリーン（`text-emerald-400`）で表示し、ノンアクティブ人数および全数は通常ウェイト（`font-normal`）のスレート色（`text-slate-400`）として視認性と直感性を大幅に向上。
4. SDD-07 (`07_dashboard_ui_ux_spec.ja.md`, `07_dashboard_ui_ux_spec.md`) の仕様を同期更新。
5. UI テスト (`src/tests/ui/monthly-report-kpis.test.tsx`) を拡張し、5段階品質ゲートを全件パス。

---

## Changes Summary

### 1. UI Component: `dashboard/src/components/monthly-report/MonthlyReportKpis.tsx`
- ヘッダー表示を更新:
  ```tsx
  <div className="text-[10px] text-slate-400 font-medium">
    プラン内訳 (<span className="text-emerald-400 font-bold">アクティブ</span> / ノンアクティブ / 全数):
  </div>
  ```
- 各行（Enterprise / Business）の表示を更新:
  ```tsx
  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
    <b className="font-bold text-emerald-400" data-testid={`report-plan-${plan.key}-active`}>
      {formatNumber(plan.active)}
    </b>
    <span className="text-slate-600 font-normal">/</span>
    <span className="text-slate-400 font-normal" data-testid={`report-plan-${plan.key}-inactive`}>
      {formatNumber(plan.nonActive)}
    </span>
    <span className="text-slate-600 font-normal">/</span>
    <span className="text-slate-400 font-normal" data-testid={`report-plan-${plan.key}-total`}>
      {formatNumber(plan.count)}
    </span>
    {/* 後方互換性テスト維持用の hidden span */}
    <span className="sr-only" data-testid={`report-plan-${plan.key}-count`}>
      {formatNumber(plan.count)}
    </span>
  </div>
  ```

### 2. Specifications: `docs/specifications/07_dashboard_ui_ux_spec.ja.md` & `.md`
- セクション 2.14d を更新し、プラン内訳ヘッダー表記と数字のみ（アクティブ強調）のフォーマット規定を最新化。

### 3. Tests: `src/tests/ui/monthly-report-kpis.test.tsx`
- ヘッダー文言および Enterprise / Business の active / inactive / total 各 data-testid 要素の出力を検証。
- 計8件のテストケースがすべて正常パス。

---

## Quality Gate Verification

| Stage | Command | Result |
|---|---|---|
| Stage 1: Fork Health Audit | `npm run fork:verify` | **Clean (Exit 0)** |
| Stage 2: TypeScript Typecheck | `npm run typecheck` | **Clean (Exit 0)** |
| Stage 3: Test Suite | `npm test` | **1,222 Passed, 0 Failed, 1 Skipped (Exit 0)** |
| Stage 4: Secret & Privacy Scan | `npm run secret-scan` | **Clean (Zero Secrets / Zero PII / Zero Abs Paths, Exit 0)** |
| Stage 5: Production Build | `npm run build` | **Clean (Bundle within budget 169.78 kB / 300 kB, Exit 0)** |

---

## Visual Comparison

### Before
```text
プラン内訳 (アクティブ / 全数):
  Enterprise: 124 / 150 名 (82.7%) [26 名未利用]
  Business:   0 / 0 名
```

### After
```text
プラン内訳 (アクティブ / ノンアクティブ / 全数):
  Enterprise: 124 / 26 / 150
  Business:   0 / 0 / 0
```
※ 「124」は `text-emerald-400 font-bold` で描画され、ヘッダーの「アクティブ」の文字色・太字と完全に同期します。
