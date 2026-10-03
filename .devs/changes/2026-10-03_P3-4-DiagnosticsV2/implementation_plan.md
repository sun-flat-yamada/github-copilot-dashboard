# 診断 v2（透明なシグナル・チーム単位既定・データ充足度制御）(P3-4 / #191)

親 Issue: #174（Phase 3）。前提 P1-1（実測プロファイル）と P3-1（指標カタログ）はマージ済み。指摘 B-11 / B-12 / D-04 を解消する。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 6 点に限定する。判断結果 #2: 個人表示は残し、社内限定・閲覧権限のある社員向けである旨を SDD-11 に明記する。

> [!WARNING]
> 診断のしきい値は依然として未較正のヒューリスティックである。本変更は「確率」の表示をやめ、入力値・しきい値・根拠を併記した「シグナル強度」に改める。較正は SDD-11 に計画（手順・基準・時期）として記載し、実装はしない。

## Proposed Changes
### 設定・純関数
#### [NEW] `src/processor/diagnostic-config.ts`
- `DiagnosticConfig`: タイムゾーン、稼働曜日、祝日カレンダー（既定は日本の 2026 年祝日）、最小稼働日数・最小チーム人数 k（既定 5）、パターン別の最小サンプル、シグナル強度の帯しきい値。`resolveDiagnosticConfig(partial)` で上書き可能（閾値の設定化）。
- `isNonWorkingDay(date, config)`: `YYYY-MM-DD` を UTC 暦日として解釈し、実行環境のタイムゾーンに依存しない（B-12 の週末判定）。祝日も非稼働日。
- `resolveReferenceDate(...)`: 分析窓の終端。ユーザーごとの履歴末尾ではなく組織全体の最新日（無ければ設定タイムゾーンの今日）。
#### [NEW] `src/processor/model-classification.ts`
- モデル ID を正規化し、ティア（`reasoning_heavy` / `heavy` / `standard` / `light` / `unknown`）へ分類するカタログ。ティア別の推計チャットコスト。2025 年の固定 ID（o1 等）ではなく、ファミリー規則（`o1` `o3` `opus` `sonnet` `gpt-5` `flash` `mini` `haiku` ほか）で現行モデルも分類。未知のモデルは `unknown` とし、重量級にも軽量にも数えない。
- `MODEL_ESTIMATED_CHAT_COST` は互換のため残し、分類カタログから導出する。
#### [NEW] `src/processor/diagnostic-signals.ts`
- `buildSignalEvidence(pattern)`: 各パターンの `contributingFactors` から、入力値・しきい値・根拠・成立有無を持つ `SignalRuleEvidence[]` を構築。
- `assessDataSufficiency(...)`: パターンごとに最小サンプル（稼働日数・提案数・チャット数・窓の日数）を判定し、不足時は理由付きで判定不能にする（小サンプルの固定 12% 等は廃止）。
- `signalStrengthBand(strength)`: 強度 → 帯（なし / 弱 / 中 / 強）。
#### [MODIFY] `src/processor/inefficiency-rules.ts` / `inefficiency-diagnostic.ts`
- モデル判定（過剰依存・コスト不整合）をティア分類に置換。`diagnoseOffHoursWorkload` は `isNonWorkingDay`（TZ 非依存 + 祝日）。
- 結果に `signalStrengthPercent` / `signalBand` / `evidence` / `dataSufficiency` を追加。`probabilityPercent` は互換のため残す（deprecated、同値）。
- `diagnoseUser`: 参照日を組織の最新日に固定。パターン別の充足度ゲート。「受諾率 28% 以上の健全ボーナス」を削除（SDD-06 §4.2 の受諾率パラドックス方針と矛盾するため）。
- `diagnoseTeam(profiles, ...)`: チーム単位の集計（k 未満は判定せず理由表示）。パターン別に強度の帯の人数分布のみを返す（個人名は含めない）。
- `UserDiagnosticResult` に `calibration`（`uncalibrated`）を付与。

### 画面
#### [MODIFY] `dashboard/src/components/DeepAnalysisView.tsx` ほか deep-analysis 配下 / `UserDrilldownPanel.tsx`
- 既定をチーム単位表示（`TeamDiagnosticPanel`）にし、「個人表示」への切替を残す。個人表示に「社内限定・閲覧権限のある社員向け」注意書き。
- 「兆候確率 %」を「シグナル強度（帯 + 値）」に改め、ルール（入力値・しきい値・根拠）を展開表示。判定不能は理由を表示。未較正バッジ。

### テスト
- `src/tests/diagnostic-config.test.ts`: TZ 非依存（`TZ=Asia/Tokyo` / `America/Los_Angeles` の双方で同一結果）、祝日、窓の終端、境界値。
- `src/tests/model-classification.test.ts`: 現行モデル ID のティア、未知モデル、正規化。
- `src/tests/diagnostic-signals.test.ts`: 充足度の境界値（不足 / ちょうど / 超過）、証拠生成、帯の境界。
- `src/tests/diagnostic-team.test.ts`: k 未満で判定なし、k 以上で分布のみ（個人名なし）。
- 既存の診断テストを新仕様（小サンプル判定不能、モデル分類）へ更新。合成プロファイルから判定しないことの回帰を維持。

### 仕様
- SDD-11（EN/JA）: 診断 v2 の仕様（モデル分類、シグナル透明性、強度、チーム既定と k、充足度、TZ・祝日、閾値設定、較正計画、閲覧範囲の明記）。

## Verification Plan
- 品質ゲート 5 点 + `npm run lint`。
