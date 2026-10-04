# Walkthrough: 属性マッピングの実効期間対応（SCD2）(P3-8 / #196)

## 変更内容
- `UserAttributeMapping` / `UserAttributeMappingV2` に任意の `valid_from` / `valid_to`（`YYYY-MM-DD`、両端を含む）を追加。期間なしは無期限（後方互換）。CSV は同名の列を追加できる。
- `src/collector/mapping-periods.ts`（新規・純関数）: 検証（不正日付・from>to・重複 = error、隙間 = warning）と実効行の選択（`YYYY-MM` は月末日、`asOf` 省略は現行行、重複は新しい `valid_from` を優先）。
- `AttributeResolver.resolve(login, asOf?)` / `getValidationIssues()`、`IAttributeResolver` と `AttributeResolverAdapter` に `asOf` を追加。不正な行は解決対象から外し、警告ログは件数のみ（ログイン名を出さない）。
- `ReportParser`: レコードの日付で属性を解決（異動月は実効日で部署・Cost Center が分かれる）。ユーザー別は最終利用日の属性。`BillingCalculator`: 基準日で解決。
- SDD-04（EN/JA）に 4.1 節を追加。

## 検証
- 新規テスト `src/tests/attribute-mapping-effective-period.test.ts`（17 件）: 検証、境界日（前日/当日）、CSV、後方互換、匿名化との併用、アダプター、異動月と過去月の配賦。すべて架空データ。
- 品質ゲート `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build` と `npm run lint` が成功。

## スコープ外・既知事項
- 画面（ダッシュボード）側でのマッピング編集 UI は対象外。ライブ（日次メトリクス）の月次凍結は、取得時点のマッピングを使うという既存の性質のまま（`BillingCalculator` は基準日で解決する）。
