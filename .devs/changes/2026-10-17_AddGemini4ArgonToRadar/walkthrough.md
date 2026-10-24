# Walkthrough - AIモデル特性レーダーへの Gemini 4 Argon 追加および仕様・コード二重同期 (#345)

## 1. 概要 (Overview)
Google DeepMind の次世代フロンティア推論モデル **Gemini 4 Argon** (`gemini-4-argon`) を AIモデル特性レーダーに新規登録し、リポジトリの **仕様・コード二重同期ポリシー（`.agents/rules/model-benchmark-management.md`）** に則って、公式サポート仕様・ベンチマーク定義・正規化カタログ・UIプリセット・詳細評価ロジック・テストケースを完全同期しました。

---

## 2. 実績データと仕様諸元 (Model Specifications)

| 項目 | 諸元値 | 出典・準拠仕様 |
| :--- | :--- | :--- |
| **モデルID** | `gemini-4-argon` | 命名規約準拠 |
| **表示名 / ベンダー** | Gemini 4 Argon / Google | Google DeepMind フラッグシップ |
| **ファミリー / 階層** | Gemini 4 / Powerful Tier | 最上位推論・自律エージェント |
| **Terminal-Bench 4.0** | **57.27%** (189/330 tasks) | 実測確認値（verified） |
| **AA Intelligence Index** | **53** (v4.3) | 実測確認値（verified） |
| **Arena WebDev Elo** | 1720 (推測値 `estimated_metrics`) | 未掲載のため推測値フラグ付与 |
| **出力速度 (Speed)** | 110 TPS (推測値) | 推論デコード重視モデル |
| **トークン単価** | 入力: $2.00 / 出力: $10.00 (/1M tokens) | キャッシュ: $0.10, 書込: $2.50 |
| **コンテキスト長** | 1,000,000 (1M) トークン | Configurable Reasoning 対応 |
| **ライセンス提供状況** | GA (Pro: 非対象 / Pro+, Max, Business, Enterprise: 付属) | `supported_models.md` Table 6 準拠 |

---

## 3. 変更対象ファイル一覧 (Synchronized Artifacts)

1. **仕様ドキュメント**:
   - `supported_models.md`: Table 1 (Copilot GA), Table 3 (1M & Configurable Reasoning), Table 4 (Clients), Table 5 (Min IDE Versions: VS Code 1.136.1, VS 17.14.22), Table 6 (Seat Licensing)
   - `docs/specifications/10_ai_model_benchmark_radar_spec.ja.md`: Googleモデル数を 5モデルへ更新、プリセット（`flagship-2026`, `tier-powerful`, `vendor-google`）更新、一覧表に Gemini 4 Argon 行を追加
   - `docs/specifications/10_ai_model_benchmark_radar_spec.md`: 英語版仕様のモデル数・プリセット・一覧表を完全同期
2. **ベンチマークデータ & カタログ**:
   - `.devs/changes/2026-10-13_RadarBenchmarkSourcesRefresh/verified-benchmarks-2026-10.json`: `gemini-4-argon` の実測検証値（TB4: 57.27, AA: 53, Elo: null）を登録
   - `scripts/benchmark-data/benchmark-records.json`: `gemini-4-argon` のマスターレコード追加
   - `src/processor/model-catalog.ts`: `gemini-4-argon` エントリと正規化エイリアス (`Gemini 4 Argon`, `gemini-4`, `argon` 等) を登録
3. **推論評価・UIコンポーネント**:
   - `src/processor/benchmark-definitions.ts`: `getModelBuzz` に Google DeepMind 旗艦としてのコミュニティ反響・SNSの噂・公式ブログ出典を追加
   - `src/processor/benchmark-evaluator.ts`: `evaluateModel` に自律エージェント・推論旗艦としての推奨用途・総評・利用指針を追加
   - `dashboard/src/components/radar/radar-constants.ts`: `flagship-2026`（Google代表として採用）、`tier-powerful`（6モデル枠）、`vendor-google`（Gemini 4 Argon 先頭）を更新
   - `dashboard/src/components/ModelSelectorSidebar.tsx`: `getModelShortName` に `gemini-4-argon` 省幅表示ルールを追加
   - `dashboard/src/utils/modelDisplay.ts`: `MODEL_DISPLAY` に `gemini-4-argon` (Google Deep Blue: `#2563eb`) を登録
4. **テストスイート**:
   - `src/tests/benchmark-sources-2026-10.test.ts`: 全46モデルの実測検証値整合性を確認
   - `src/tests/benchmark-normalization.test.ts`: 同点検証および全46モデルのパーセンタイル正規化・カタログ双方向整合性を確認
   - `src/tests/benchmark-evaluator.test.ts`: 全46モデルのベンダー属性検証・エイリアス正規化を確認
   - `src/tests/radar-presets.test.ts`: `flagship-2026`, `tier-powerful`, `vendor-google` の更新後プリセット構成を検証
   - `src/tests/model-display.test.ts` & `radar-selector-sidebar.test.ts`: 表示名・カラー・略称マッピングを検証

---

## 4. 品質ゲート検証結果 (Quality Gate Verification)

全5段階の品質ゲートがすべて警告ゼロ・エラーゼロで合格しました。

```bash
# 1. Fork Health & Data Isolation Check
$ npm run fork:verify
  -> ✅ Zero runtime data files tracked on main branch. Fork-Safe Storage is preserved.

# 2. TypeScript Static Typecheck
$ npm run typecheck
  -> ✅ Exit code 0 (clean, no type errors).

# 3. Test Suite Execution (Unit, Integration & E2E Tests)
$ npm test
  -> ✅ tests 1205, pass 1204, fail 0, skipped 1.

# 4. Enterprise Secret & Zero-Leakage Scanner
$ npm run secret-scan
  -> ✅ Scanned 698 files. Zero secrets, PII or absolute paths found!

# 5. Production Application Build
$ npm run build
  -> ✅ vite built in 2.47s. Main chunk: 169.78 kB / 300 kB budget. No fs/zod in bundle.
```
