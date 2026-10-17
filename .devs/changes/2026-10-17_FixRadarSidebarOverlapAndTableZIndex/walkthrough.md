# Walkthrough: Fix Radar Sidebar Overlapping and Benchmark Table Header/Footer Z-Index (#361)

## Overview
This change resolves two critical layout and z-index stacking issues in the **AI Model Radar (モデル特性レーダー)**:
1. **Sidebar and Content Overlap**: In intermediate screen widths (<1024px), the container fell back to vertical stacking (`flex-col`), resulting in the sticky sidebar floating over and obscuring the main content (charts and cards) during vertical scroll. This has been resolved by enforcing horizontal flex layout (`flex-row items-start`) across all screen widths, guaranteeing mutually exclusive horizontal space for the sidebar and the main content.
2. **Table Header & Sticky Bottom Bar Breakthrough**: The benchmark table's sticky headers (`z-30`, `z-20`) and bottom horizontal scroll bar (`z-40`) leaked out of their container and rendered in front of the `ModelSelectorSidebar` (`z-30`) on horizontal/vertical scrolling. This has been resolved by applying CSS `isolation: isolate` to both the right-hand main content container and the table card container, fully isolating their stacking contexts, and adjusting the bottom scrollbar's z-index to `z-20`.

---

## Changes

### 1. Frontend Components
- **`dashboard/src/components/ModelRadarView.tsx`**:
  - Updated 2-column container from `flex flex-col lg:flex-row items-start gap-6 relative w-full` to `flex flex-row items-start gap-6 relative w-full`.
  - Added `isolate` to the right-hand main area container (`flex-1 min-w-0 flex flex-col space-y-6 w-full isolate`).
  - Added `relative isolate` to the benchmark table container (`id="radar-table"`).
  - Adjusted sticky bottom scrollbar z-index from `z-40` to `z-20`.
- **`dashboard/src/components/ModelSelectorSidebar.tsx`**:
  - Adjusted sticky positioning from `top-20` to `top-28` (`max-h-[calc(100vh-7.5rem)]`) to track smoothly below the global navigation bar.

### 2. Specification Synchronization
- **`docs/specifications/10_ai_model_benchmark_radar_spec.ja.md`**:
  - Added Section 2.8: 画面レイアウトの排他制御仕様 (Horizontal flex layout with dedicated sidebar width).
  - Added Section 2.9: テーブルとサイドバーの重ね合わせコンテキスト分離 (Stacking Context separation with `isolation: isolate`).

### 3. Automated Tests
- **`src/tests/radar-sidebar-layout.test.ts`**:
  - Verified horizontal flex row layout without `flex-col` fallback.
  - Verified CSS `isolate` on the main container and table container.
  - Verified bounded z-index layering (`z-30` pinned model column, `z-20` headers and footer).
  - Verified sidebar sticky offset `top-28` and max height constraints.
- **`src/tests/radar-selector-sidebar.test.ts`** & **`src/tests/radar-table-scroll.test.ts`**:
  - Updated assertions for `top-28`, `flex-row`, and `z-20`.

---

## Verification & Quality Gate Results

| Check | Command | Result |
|---|---|---|
| **Fork Health & Isolation** | `npm run fork:verify` | ✅ Passed (0 failures) |
| **Type Check** | `npm run typecheck` | ✅ Passed (0 errors) |
| **Unit Test Suite** | `npm test` | ✅ Passed (1228 passed, 0 failed, 1 skipped) |
| **Secret & PII Scan** | `npm run secret-scan` | ✅ Clean (718 files scanned, 0 leaks) |
| **Production Build** | `npm run build` | ✅ Built in 3.68s, bundle within budget |
