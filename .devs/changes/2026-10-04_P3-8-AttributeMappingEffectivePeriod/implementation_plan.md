# 属性マッピングの実効期間対応（SCD Type 2）(P3-8 / #196)

親 Issue: #174（Phase 3）。指摘 B-17（属性マッピングに時点がなく、異動後の所属で過去月も集計される）を解消する。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 4 点（実効期間付きマッピングの読み込み・検証 / 実効日での属性解決 / 異動月の配賦テスト / SDD-04 日英同期）に限定する。

> [!WARNING]
> マッピングは個人情報を含む。テスト・文書・フィクスチャは架空のログイン名・部署のみを使い、`COPILOT_USER_MAPPING` は従来どおり環境変数・暗号化ファイル経由のみ。検証の警告ログにはログイン名を出さない（匿名化モードでなくても件数と行番号相当の情報だけにする）。`fork:verify` / `secret-scan` は変更しない。

## Proposed Changes
### スキーマ（後方互換）
- `UserAttributeMapping` / `UserAttributeMappingV2` に任意項目 `valid_from` / `valid_to`（`YYYY-MM-DD`、両端を含む）を追加。期間なしは無期限（従来動作）。
- 同一ユーザーに複数行を許す（1 行 = 1 つの実効期間）。CSV は `valid_from` / `valid_to` 列を追加（列が無い従来 CSV はそのまま）。

### 読み込み・検証
#### [NEW] `src/collector/mapping-periods.ts`（ブラウザでも安全な純関数）
- `validateMappingPeriods(entries)`: 不正日付・`valid_from > valid_to`（error）、期間の重複（error）、期間の隙間（warning）を検出して返す。
- `selectEffectiveMapping(entries, asOf?)`: `asOf`（`YYYY-MM-DD` または `YYYY-MM`）に有効な行を選ぶ。月指定は月末日で判定（月末時点の所属）。重複時は `valid_from` が新しい行を優先（決定的）。`asOf` 省略時は現行（最新）の行。有効な行が無ければ未登録として扱う（フォールバック）。
#### [MODIFY] `src/collector/attribute-resolver.ts`
- 内部表現を `Map<login, entries[]>` にし、`resolve(login, asOf?)` と `getValidationIssues()` を追加。検証結果は `console.warn` で件数のみ通知（PII を出さない）。

### 配賦への適用
- `report-parser.ts`: 月次レポートはレコードの日付で属性を解決する（異動月は日付で部署・Cost Center が分かれる。日付なしは対象月の月末）。ユーザー別プロファイルは最終利用日の属性。
- `billing-calculator.ts`: 基準日の属性で解決。`AttributeResolverAdapter` / `IAttributeResolver` にも任意の `asOf` を通す。

### テスト・文書
- 単体: 読み込み（JSON / CSV / 後方互換）、検証（重複・隙間・不正）、実効日の境界（前日 / 当日 / 翌日）、異動月のレポート配賦が日付で分かれること、匿名化モードで期間付きでも仮名化されること。
- SDD-04（EN/JA）にスキーマ・検証・解決規則・個人表示の前提を追記。
