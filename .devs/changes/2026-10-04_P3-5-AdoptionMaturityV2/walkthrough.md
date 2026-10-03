# Walkthrough: 採用成熟度 v2 (P3-5 / #192)

## 変更内容
- `AdoptionPhaseRule.evaluate()`（v2）: 直近 28 日の実測の利用日数（活動・補完・チャット・Agent・CLI）から判定。しきい値は `ADOPTION_RULE_V2` に集約。旧 `classify()`（代理値・MCP 呼び出し）を廃止。
- データ不足（観測日数 7 日未満、Agent フラグ欠落で下位判定になる場合）は判定せず理由を返す。判定不能は No Cohort に数えず `unclassified_users` として別計上。
- `user-report-mapper.ts`: 窓内の利用日数を数え、`adoption_inputs` と `ai_adoption_phase`（または `adoption_unclassified_reason`）をプロファイルに設定。
- `AdoptionPresenter`: チーム別は判定済みの実人数。k<5 は「少人数チーム (合算)」に集約し、合算も k 未満なら分布を伏せる。シート数で評価対象人数を代用しない。判定基準をビューモデルへ。
- 画面: 判定基準（版・窓・基準）、判定不能の件数と理由、チーム表の合算・抑止行。指標 `adoption_unclassified_users` をカタログ登録。
- SDD-11 §8 / SDD-06 §4.4 を日英で更新。

## 検証
- 新規テスト `src/tests/adoption-maturity-v2.test.ts`（18 件）: 境界値、観測日数不足、Agent フラグ欠落、窓外の除外、k=4/5 境界、合算、実人数、個人名の非露出。
- 品質ゲート: `fork:verify` / `typecheck` / `test`（897 件成功）/ `secret-scan` / `build` / `lint` すべて成功。

## 残課題
- しきい値は未較正（SDD-11 §8.5 の計画）。
- 合算行を伏せても全社合計との差から少人数が推測され得る（SDD-11 §8.4 に記載、個人表示は権限者のみの前提）。
