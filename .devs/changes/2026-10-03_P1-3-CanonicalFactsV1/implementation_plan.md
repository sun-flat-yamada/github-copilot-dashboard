# Plan: 正準ファクト v1 と JSON Schema 生成 (P1-3)

Issue: #177（親 #172）。親計画 付録 A.7.2。

## Proposed Changes
- [NEW] `src/domain/facts/{schemas,mappers,json-schema,index}.ts`: zod スキーマ 5 種（usage_user_daily / usage_user_feature_daily / usage_org_daily / seat_snapshot / cost_line）、アダプタ出力からの写像、JSON Schema 生成
- [NEW] `scripts/generate-fact-schemas.ts`、`npm run schema:facts`（`--check` で差分検知）
- [NEW] `docs/schemas/facts/*.schema.json`（生成物）
- [NEW] `src/tests/domain/CanonicalFacts.test.ts`: `schema_version`、欠損は null、二重計上なし、生成物との差分で失敗
- [MODIFY] SDD-05 §2.4（日英）

## 判断
- 合計と内訳を別ファクトに分け、二重計上を構造で防ぐ。
- パイプラインへの結線（成果物としての書き出し）は Phase 2 の Dataset 層で行う。本 PR は契約と変換まで。
