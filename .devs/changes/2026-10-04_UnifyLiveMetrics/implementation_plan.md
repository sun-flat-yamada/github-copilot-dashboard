# Implementation Plan: Unifying Deprecated "Live Metrics" Terminology (#151)

## Background & Objective
In Issue #87, the dashboard established the 2-Tier Data Selection Model and formally replaced the legacy "Live Metrics" phrasing with:
- **Japanese**:
  - Full title: `自動定期収集データ（API収集・期間指定）`
  - Short title: `自動収集データ`
  - Category: `API定期自動蓄積`
- **English**:
  - Full: `Auto-collected Data (API Collection with Period Scope)`
  - Short: `Auto-collected Data`

However, remnants of the legacy string **"Live Metrics"** still linger across:
1. **User-facing UI**:
   - `dashboard/src/components/layout/DashboardHeader.tsx`: Tooltip string `(Live Metrics / Monthly Report / User Upload)`
   - `dashboard/src/components/layout/ActiveDataSelector.tsx`: Tooltip descriptions
   - `dashboard/src/hooks/useDeepAnalysisData.ts`: `label: 'Live Metrics (確定テレメトリ)'` (displayed in `UserTrendViewer` and `DeepAnalysisView`)
2. **Scripts & Tooling**:
   - `scripts/generate-demo-data.ts`, `scripts/generate-demo-mapping-gpg.ts`, `scripts/sync-demo-to-copilot-data.ts`, `scripts/verify-fork-health.ts`
3. **SDD Specifications & User Guides**:
   - `docs/specifications/01_requirements_specification.ja.md`, `01_requirements_specification.md`
   - `docs/specifications/04_user_attribute_mapping_spec.ja.md`, `04_user_attribute_mapping_spec.md`
   - `docs/specifications/05_data_storage_and_fork_isolation_spec.ja.md`, `05_data_storage_and_fork_isolation_spec.md`
   - `docs/specifications/07_dashboard_ui_ux_spec.ja.md`, `07_dashboard_ui_ux_spec.md`
   - `docs/specifications/08_automation_workflow_spec.md`
   - `docs/specifications/09_monthly_usage_report_mode_spec.ja.md`, `09_monthly_usage_report_mode_spec.md`
   - `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md`, `10_ai_model_benchmark_radar_spec.md`
   - `docs/specifications/11_deep_analysis_view_spec.ja.md`, `11_deep_analysis_view_spec.md`
   - `docs/specifications/12_fork_sync_and_customization_ops_spec.ja.md`
   - `docs/specifications/13_fork_restricted_environment_setup_guide.md`
   - `docs/specifications/15_data_centric_reactivity_design_spec.ja.md`, `15_data_centric_reactivity_design_spec.md`
   - `docs/setup_guide.md`

## Proposed Changes

### 1. UI Components & Hooks
- `dashboard/src/components/layout/DashboardHeader.tsx`:
  - Update tooltip to `(自動収集データ / 月次レポート / オンデマンドCSV)` to match `DATA_SOURCE_LABELS.*.shortTitle`.
- `dashboard/src/components/layout/ActiveDataSelector.tsx`:
  - Update tooltips to refer to `自動定期収集データ`.
- `dashboard/src/hooks/useDeepAnalysisData.ts`:
  - Change `label: 'Live Metrics (確定テレメトリ)'` to `label: '自動収集データ (確定テレメトリ)'`.
- Code comments across `dashboard/src/` (e.g. `AppShell.tsx`, `radar-utils.ts`, `useDashboardData.ts`, `filterEngine.ts`, `queryEngine.ts`).

### 2. Scripts & Verification Tools
- Update log messages and comments in `scripts/generate-demo-data.ts`, `scripts/generate-demo-mapping-gpg.ts`, `scripts/sync-demo-to-copilot-data.ts`, `scripts/verify-fork-health.ts` from "Live Metrics DEMO" to "Auto-collected DEMO" / "自動定期収集 DEMO".

### 3. SDD Specifications & Documentation
- Unify terminology across `docs/specifications/*.md` and `docs/setup_guide.md`:
  - Japanese: `Live Metrics` -> `自動定期収集データ` / `自動収集データ`
  - English: `Live Metrics` -> `Auto-collected Data`

### 4. Automated Tests
- Add regression test cases in `src/tests/data-selection-modal.test.ts`:
  - Verify that `DashboardHeader.tsx` does not mention `Live Metrics`.
  - Verify that `useDeepAnalysisData.ts` contains `自動収集データ (確定テレメトリ)` and does not contain `Live Metrics (確定テレメトリ)`.

## Quality Gate Checklist
Before PR creation and merge:
1. `npm run fork:verify`
2. `npm run typecheck`
3. `npm test`
4. `npm run secret-scan`
5. `npm run build`

## Lifecycle Workflow
```text
Issue #151 -> Plan Approval -> Sibling Worktree -> Code Changes -> Quality Gate -> Walkthrough Artifact -> PR -> Rebase Merge -> Clean
```
