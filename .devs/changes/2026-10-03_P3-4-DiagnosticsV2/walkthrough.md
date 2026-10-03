# Walkthrough: 診断 v2 (P3-4 / #191)

## 変更の要約
| 受け入れ項目 | 実装 |
| :--- | :--- |
| モデル分類のカタログ化 (B-11) | `model-classification.ts`: ファミリー規則でティア分類。過剰依存・コスト不整合をティア比率で判定。未分類は重量級にも軽量にも数えない |
| 透明なシグナル | 各パターンに `evidence[]` (入力値・しきい値・根拠・成立)。ドリルダウンで表示 |
| 「確率」→「シグナル強度」(D-04) | `signalStrengthPercent` / `signalBand`。`probabilityPercent` は非推奨エイリアス。UI の文言を改称。受諾率 28% の健全ボーナスを廃止 |
| チーム単位を既定 | `diagnoseTeam` + `TeamDiagnosticPanel`。k < 5 は判定せず、セルも伏せる。個人表示は切替で残し、社内限定・閲覧権限者向けと明記 |
| データ充足度制御 | `assessDataSufficiency`: パターン別の最小サンプル。不足時は判定不能 + 理由 + 要件一覧 |
| TZ・祝日・設定化・較正計画 (B-12) | `diagnostic-config.ts`: UTC 暦日の曜日、祝日カレンダー、窓の終端 = 組織最新日、`DiagnosticConfig` / `resolveDiagnosticConfig`、`CALIBRATION_PLAN` |

## テスト
- 新規: `diagnostic-config` (TZ 非依存を 4 TZ で検証、祝日、設定フォールバック、窓の終端)、`model-classification`、`diagnostic-signals` (帯・充足度の境界値、証拠)、`diagnostic-team` (k 境界、個人情報なし、セル抑制)、`team-diagnostic-panel` (SSR)。
- 更新: 1 日分の履歴を使っていた 3 件の既存テストを、最小稼働日数 (3 日) を満たす履歴へ。合成プロファイルを作らない既存の回帰テスト (`deep-analysis-active-source`) は変更なしで成功。

## 品質ゲート
`fork:verify` / `typecheck` / `test` (884 件) / `secret-scan` / `build` / `lint` を実行（最終結果は PR 本文）。

## 仕様
- SDD-11 §7 (EN/JA) を追加。§6.5 のピア平均を合計比に更新。

## 設計上の注意 (次の作業者向け)
- 各パターン関数内部のルールしきい値はコード定数のまま (設定化したのは充足度・帯・チーム人数・カレンダー)。個別しきい値の外部化は較正 (SDD-11 §7.6) と一緒に行う。
- `diagnoseUser` の充足度ゲートは `diagnoseUser` 経由でのみ働く。ルール関数を直接呼ぶ場合は小サンプルの旧挙動が残る。
