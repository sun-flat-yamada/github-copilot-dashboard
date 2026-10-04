# Implementation Plan: Show the share (%) before the model name in the user detail Top 3

## Objective
Follow-up to the Top-3 primary models change: render each entry as `53% claude-opus-5.5` (share first, then model name) in the table and in the CSV cell, instead of `claude-opus-5.5 53%`.

## Design
- `formatTopModels` (CSV) emits `NN% model; ...`; models without a share (monthly report without breakdown) keep the bare name.
- `UserDetailTable`: the badge renders the share first, then the model name.
- Update the unit test and the SDD-07 wording (EN/JA).
