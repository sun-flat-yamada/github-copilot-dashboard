# 採用成熟度 v2（実測ベース、チーム別は実人数・k≥5）(P3-5 / #192)

親 Issue: #174（Phase 3）。前提 P1-1（ユーザー別実測プロファイル）と P3-1（指標カタログ）はマージ済み。指摘 B-06 を解消する。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 3 点（判定ルール v2 / チーム別は実人数・k≥5 / データ不足は理由表示）に限定する。判断結果: 個人表示は残す（社内限定・閲覧権限のある社員向け）。チーム別のみ k≥5 で抑止する。

> [!WARNING]
> 判定しきい値は未較正のヒューリスティックである。判定基準・窓・入力値を画面と SDD に明示し、較正は計画として記載するにとどめる。Reports API のユーザー別レポートには MCP 呼び出し数・利用エージェント種類数が無いため、旧ルールの「MCP 利用」「複数エージェント」は測れない。測れる指標（利用日数と利用サーフェス数）で再定義する。

## Proposed Changes
### ドメイン
#### [MODIFY] `src/domain/rules/AdoptionPhaseRule.ts`
- v2: 入力は窓内の利用日数（活動日・補完日・チャット日・Agent 日・CLI 日）と観測日数。窓は直近 28 日（組織の最新日が終端）。
- `evaluate()` は判定済み（phase と根拠）または判定不能（理由）を返す。観測日数が最小未満、Agent 利用フラグが取得できず判定が下振れし得る場合は判定しない。
- `ADOPTION_RULE_V2`: 版・窓・しきい値・最小チーム人数 k（5）を 1 か所で宣言。旧 `classify()`（提案数・チャット数の代理値、MCP 呼び出し）は廃止。

#### [MODIFY] `src/domain/entities/copilot.ts` / `agent-metrics.ts`
- `UserUsageProfile.adoption_inputs`（窓・利用日数）と `adoption_unclassified_reason` を追加。`AdoptionPhaseMetrics.unclassified_users` を追加。

### 集計・表示
#### [MODIFY] `src/adapters/github-api/usage-reports/user-report-mapper.ts`
- `buildUserProfiles` で窓内の利用日数を数え、v2 ルールで `ai_adoption_phase` を実測から設定（判定不能は未設定 + 理由）。
#### [MODIFY] `src/processor/metrics-aggregator.ts`
- 位相未設定を `no_cohort` に数えない。`unclassified_users` として別計上し、評価対象人数は判定済みユーザーのみ。
#### [MODIFY] `src/adapters/presenters/AdoptionPresenter.ts`
- チーム別は判定済みの実人数で集計。k 未満のチームは「少人数チーム（合算）」へ集約し、合算も k 未満なら分布を出さず理由を表示。判定基準・窓・判定不能人数をビューモデルに含める。
#### [MODIFY] `dashboard/src/components/views/AdoptionMaturityView.tsx` / `src/domain/metrics/metric-registry.ts`
- 判定基準・窓の表示、判定不能の理由表示、チーム表の合算行・抑止表示。新指標 `adoption_unclassified_users` をカタログ登録。

### テスト
- `AdoptionPhaseRule` 境界値（しきい値ちょうど / 直前）、観測日数不足、Agent フラグ欠落、override。
- mapper: 窓内の日数集計と位相の設定、窓外の除外。
- aggregator: 未判定が `no_cohort` に混ざらない。
- presenter: k=4 / k=5 境界、合算、合算が k 未満の抑止、個人名が出ない。
- 既存の `BusinessRules.test.ts` の採用ルールを v2 へ更新。

### 仕様
- SDD-06（§4）と SDD-11（EN/JA）: 判定ルール v2、窓、入力値、k≥5、データ不足、較正計画、閲覧範囲。

## Verification Plan
- 品質ゲート 5 点 + `npm run lint`。
