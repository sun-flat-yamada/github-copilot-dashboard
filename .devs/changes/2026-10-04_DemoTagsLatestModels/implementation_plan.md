# 実装計画: DEMO のタグ付与と最新モデル化 (#270)

## 目的
DEMO のユーザー別プロファイルに Tag を付け、利用モデルの例を最新寄りにする。

## 変更
1. `PipelineOrchestrator` / `DemoHistoryService`: モックのユーザー別プロファイルも `enrichUserProfiles` を通し、tags・部署・Cost Center を付与。
2. `mock-generator.ts`: チャット内訳を `claude-sonnet-5` / `gpt-6-astra` / `claude-opus-5-5` / `gemini-3-8-flash` に更新。AI usage report の単価表と典型パターンを `claude-fable-5-1` / `claude-sonnet-5` / `gpt-6-astra` / `gpt-5-4-mini` に更新し、値は `benchmark-records.json` と一致させる。月次レポート CSV のモデル表記を表示名に統一し、Fable 5.1 と GPT-5.4 mini を加える。
3. dashboard: モデル色・名称の定義 (`UserDrilldownPanel` / `UserTrendViewer` / `PatternDrilldownChart`) を共通ヘルパーにまとめ、現行モデルに対応。未知のモデルは系列色をフォールバックし崩れない。
4. テスト (タグ・単価一致・カタログ解決・色定義)、SDD-05 (EN/JA)。

## 範囲外
`supported_models.md` にあって `model-catalog.ts` に無いモデル (GPT-6.1 Sol / Claude Sonnet 5.5 等) の追加は別 Issue (モデル同期)。

## 検証
`npm run demo:generate` の出力検査、品質ゲート、e2e。
