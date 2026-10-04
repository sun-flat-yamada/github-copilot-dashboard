# Implementation Plan: Top-3 primary models with share (%) in the user detail table

## Objective
The `主利用モデル` column of `ユーザー明細` shows only the single top model. Show the Top 3 models, each with its share (%).

## Design
- `UserDetailRow` gains `top_models: { model: string; share: number | null }[]` (max 3, share is 0-1).
  - Live: from `UserUsageProfile.model_usage_totals` (share = count / sum of all models).
  - Report: from `ReportUserDetail.model_requests`, falling back to `model_spend_usd`; with neither, only `primary_model` with `share: null`.
- `primary_model` stays (sort key, CSV, search).
- `UserDetailTable`: render up to 3 badges `Model NN%`; CSV column keeps the primary model and adds nothing new except the Top3 text in the same cell format `A (50%); B (30%); C (20%)`.
- Add unit tests to `UserDetailRows.test.ts`; update SDD-07 §2.16.
