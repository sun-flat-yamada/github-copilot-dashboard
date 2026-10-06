[English](06_aggregation_and_billing_logic_spec.md) | [日本語](06_aggregation_and_billing_logic_spec.ja.md)

---

# SDD-06: 分析・集計・仕訳ロジック仕様書 (Aggregation & Billing Logic)

- **文書番号**: SPEC-COPILOT-006
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. 料金計算モデル

GitHub Copilotのライセンス体系に基づき、2通りの計算手法をサポートする。

### 1.1 月次定額計算 (Monthly Flat Rate)
月額課金（Business: \$19/月、Enterprise: \$39/月）を、各月のシート保有期間または月末時点の割当シート数に基づき算出する。
$$\text{Monthly Cost} = \sum_{\text{user} \in \text{Seats}} \text{Price}(\text{user.plan})$$

`Price(plan)` は、Enterprise の契約設定による上書きが無い限り、価格カタログ（SDD-03 §5.1）から取得する。**`plan_type` が欠損・未知（`unknown`）のシートは料金を付けない**: Enterprise (\$39) と見なさず、費用は *未確定*（`cost_unconfirmed: true`、月額 0）とする。未確定のシートはすべての費用合計から除外し、`overview.cost_unconfirmed_seats` に件数を示す。UI は \$0.00 ではなく、理由付きの「—」を表示する。

### 1.3 Cost Center 予算管理 (Budget Management Model)
GitHub Enterprise Billingで定義された各Cost CenterのBudgetに対して、以下の指標を算出・管理する：
1. **上限Budget額 ($B_{\text{limit}}$)**: 期間または月間の支出上限設定値。
2. **無料Budget額 ($B_{\text{free}}$)**: プラン付帯またはクレジット付与による無償枠。
3. **現在使用済みBudget額 ($S_{\text{current}}$)**: 該当Cost Centerに属する全シートの期間消費額合計。
4. **課金対象実使用額 ($S_{\text{billable}}$)**:
   $$S_{\text{billable}} = \max(0, S_{\text{current}} - B_{\text{free}})$$
5. **残余Budget額 ($B_{\text{remaining}}$)**:
6. **採用成熟度**は、直近 28 日の実測の利用日数から導出し、チーム別は判定済み 5 人以上のグループのみ表示する。データが足りないユーザーは No Cohort ではなく判定不能として示す (SDD-11 §8)。
   $$B_{\text{remaining}} = \max(0, B_{\text{limit}} - S_{\text{billable}})$$
6. **予算消化率 ($U_{\%}$)**:
   $$U_{\%} = \frac{S_{\text{billable}}}{B_{\text{limit}}} \times 100\%$$
   - $U_{\%} < 80\%$: 正常 (`normal`)
   - $80\% \le U_{\%} < 100\%$: 注意・警告 (`warning`)
   - $U_{\%} \ge 100\%$: 超過 (`exceeded`)

**定義と単一の実装**
- *総額 (gross)*（`current_spend_usd`）は無料枠の控除前の消費額、*純額 (net billable)*（`net_billable_spend_usd`）は控除後。消化率は **純額** で計算する。
- `remaining` は負にならない（0 で下限を固定）。上限が 0 以下は「上限未設定」を意味し、消化率は 0、ステータスは `normal`。
- `BudgetUtilizationRule`（`evaluateUsd`）が **唯一の実装** である。パイプライン (`BillingCalculator`)、ブラウザ側のフィルター再集計 (`filterEngine`)、月次レポートの予算 (`App.tsx`) のすべてがこれを呼ぶため、同じ入力なら純額・残余・消化率・ステータスはどこでも一致する（金額は小数 2 桁、割合は小数 1 桁）。フィルター適用時は、金額だけでなく `status` と `budget_utilization_percent` も再評価する。
- Cost Center の予算は **月次** の枠なので、評価に使う使用額は、画面が日次・期間スコープを表示していても、常に月額のシート費用（パイプラインと同じ基準）とする。
- 上限額と無料枠は、管理者の宣言（`COPILOT_COST_CENTER_BUDGETS`）だけから取得する。GitHub の公開 API は返さず、生成も推測もしない。解釈できない宣言は、設定の不備として issue に記録する。

### 1.4 Enterprise Agreement (EA) 契約料金・期間別パラメータ設定 & 公的為替レート自動算出

#### 1.4.1 USD表記の基準定義 (GitHubカタログ価格)
- ダッシュボード上の主たる **USD表記は「GitHubのカタログ価格(USD)」(定価: Business \$19/月、Enterprise \$39/月、AI Credits \$0.01/AIC)** を指す。
- 画面上の各KPIカード、テーブル見出し、およびツールチップにおいて「GitHubのカタログ価格(USD)」であることを明記する。
- これに伴い、サブ表示通貨に **「EA契約レートによるサブ表示単位（EA-USD, EA-JPY, EA-EUR）」** を提供し、カタログUSD定価とユーザーが設定したEA契約レートによる実効価格（例: `$39.00 ($33.15 EA)`、`$39.00 (¥4,973)`、`$39.00 (€30.50)`）を並列比較可能とする。選択肢には `[]` 説明を付与せず、冒頭の統一コメントにより説明を完結する。

#### 1.4.2 期間別パラメータ設定 (`periods`)
企業の契約年度・改定サイクルに対応するため、開始年月 (`startMonth`: YYYY-MM) から終了年月 (`endMonth`: YYYY-MM) の範囲で以下のパラメータを設定可能とする：
1. **Copilot seat価格**: Enterprise、Business毎の月額および通貨単位（例: `customSeatPricing: { businessMonthly: 2500, enterpriseMonthly: 5000, currency: "JPY" }`）。
2. **AI Credit単価**: 通貨単位と合わせた個別単価（例: `customPricePerCredit: 1.273`, `customPricePerCreditCurrency: "JPY"`）。
3. **EAディスカウント率**: ボリュームディスカウント率（例: `discountPercent: 15`）。
4. **USDから各通貨への変換レート**: 契約適用為替レート（例: `exchangeRateFromUSD: 155.0` または `exchangeRates: { JPY: 155.0, EUR: 0.92 }`）。

**デフォルト値へのフォールバック規則**:
- 設定された期間（`startMonth` 〜 `endMonth`）に該当しない月の計算は、デフォルト設定値（GitHubカタログ価格および基本設定）を使用する。

#### 1.4.3 設定値非存在区間の為替レート (為替カタログ)
- 期間別設定または基本設定で為替レートが指定されていない月は、**為替カタログ** (`data/catalog/exchange-rates.json`) の月次平均レートで換算する。
- カタログは `npm run catalog:fx` (収集ワークフローの 1 ステップ) が **欧州中央銀行 (ECB) の月次平均レート** (`EXR/M.<通貨>.EUR.SP00.A`) を取得し、USD 基準 (1 USD = N 通貨) へ変換して保存する。出典 (`source` / `source_url`) と取得時刻 (`fetched_at`) を記録する。
- **終了した月だけ** を保存し、保存済みの月は上書きしない。過去月の換算値は閲覧日にも更新日にも依存しない (ブラウザからの最新レート取得は行わない)。
- カタログに無い月は、**それより前で最も近い月のレート** を引き継ぐ (未来の月や固定値では補わない)。前の月も無ければレート無しとして、換算表示 (EA-JPY / EA-EUR) を選択肢から外す。**コードに為替の数値表は持たない**。
- 取得に失敗しても既存カタログは変更せず、警告のみで収集を続行する。デモデータにはカタログが無いため、換算は USD のみ。

#### 1.4.4 価格カタログの一次情報照合
既定価格 (`src/domain/pricing/pricing-catalog.ts`、版 `2026-10-05-v2`) とトークン単価表 (`docs/models_pricing.md`) を **2026-10-05 に GitHub 公式ドキュメントと照合した**。開発環境から `docs.github.com` には到達できないため、そのソースリポジトリ `github/docs` をコミット `45a0f053ac67e8d1f56fc8f7ee38f0b2a58925c3` で読んだ。

| 値 | 公式の出典 (`github/docs`) | 結果 |
| :--- | :--- | :--- |
| Business \$19 / Enterprise \$39 (1 ユーザー・月) | `data/variables/copilot.yml` (`cfb_price_per_month`、`ce_price_per_month`)、`content/copilot/concepts/billing-and-usage/organizations-and-enterprises/seats-and-billing-cycles.md` | 一致 |
| 1 AI クレジット = \$0.01、2026-06-01 から使用量ベース課金 | `data/variables/product.yml` (`prodname_ai_credits_value`)、`content/copilot/reference/copilot-billing/request-based-billing-legacy/what-changed-with-billing.md` | 一致 |
| 包含量 Business 1,900 / Enterprise 3,900 クレジット (ユーザー・月)、請求エンティティ単位のプール | `data/variables/copilot.yml` (`ai_credits_per_user_*`)、`content/copilot/concepts/billing-and-usage/organizations-and-enterprises/billing.md` | 一致 |
| 移行プロモーション 2026-06〜2026-08: 3,000 / 7,000 クレジット | `data/variables/copilot.yml` (`*_promo`)、`.../organizations-and-enterprises/billing.md` のコミット `f169461e985f3820a38233db99648dc0e75fd4dc` 時点 (期限切れとして `19a110200a3b` (2026-09-11) で削除済み) | 値と期間 (2026-06-01〜2026-09-01) は一致。**適用範囲の差異**: 公式は *既存顧客* のみが対象だが、カタログは全シートに適用している (Issue #296) |
| `docs/models_pricing.md` の全モデルのトークン単価 | `data/tables/copilot/models-and-pricing.yml` | 掲載価格はすべて一致。モデル一覧が古かったため同期した (6 モデル追加、2026-10-02 リタイアの 4 モデル削除、Gemini プロモーションの脚注更新) |

- カタログの各エントリは `verification` (`verifiedAt`、コミット付きの `sources`) を持ち、`PRICING_CATALOG_VERIFICATION` に照合日・リポジトリ・コミットを記録する。照合できない値を追加するときは、版名に `unverified` を付け `verification` を付けない (推測値を照合済みとして扱わない)。
- 範囲外の突き合わせ: `scripts/benchmark-data/benchmark-records.json` の入力・キャッシュ入力・出力単価は公式と一致したが、GPT-6.1 Sol にキャッシュ書き込みと長コンテキストの単価が無い (Issue #297)。
- 2026-10-06 に照合済み (Issue #212): 実ネットワークに到達できる環境で `npm run catalog:fx` を実 ECB エンドポイントに対して実行し、正常終了を確認した (確定月のみ取得、既存月は上書きしない、失敗時は既存カタログを保持)。取得値は、同じ ECB 系列を直接取得して `toUsdBase()` を手計算で再現し、完全一致を確認した (例: 2025-01 の JPY/USD 月次平均)。
- 未照合のまま残るもの: 2026-06〜08 の移行プロモーション値 (期限切れのプロモーションは公式の公開ページに残らないため。§1.4.1、適用対象は Issue #296 で追跡)。

### 1.5 スコープ別の費用の単位

費用の単位はスコープごとに異なり、`seatCostForScope` が 1 か所で定義する：

| スコープ | シート費用 |
|---|---|
| `daily` | 日割り費用（`月額 ÷ 当月の日数`） |
| `monthly` | 月額の満額（「月初からの累計」ではない） |
| `custom` | 日割り費用 × 期間の日数 |

パイプラインの集計とブラウザ側のフィルター再集計は同じ関数を使うため、フィルターを適用しても単位が変わらない（以前は、日次スコープでもフィルターを適用した途端に月額へ変わっていた）。遊休の削減可能額は、スコープに関わらず常に **月額換算** で表す（`monthlyIdleSavingsUsd`）。

### 1.6 AI クレジット費用と包含クレジットのプール

- 費用 = クレジット数 × 単価。単価は価格カタログ（1 クレジット \$0.01）または契約設定から取得し、サービス固有の既定値は持たない（SDD-03 §5.1）。
- 包含クレジットは **プラン別・期間別で、請求エンティティ単位のプール** を成す: `プール = Σ 各シートのプランの包含クレジット`。プラン未確定のシートは算入せず、「プラン未確定」として示す。EA 契約値（`creditsPricing.includedCreditsPerSeat`）があれば、全プラン共通でそれを使う。
- プール消化率 = 使用クレジット ÷ プール × 100。**100% で頭打ちにしない**（超過はそのまま示す）。プールが未確定または 0 のときは算出しない。
- シート別の AI クレジット費用は使用額（クレジット数 × 単価）である。包含分はプール単位のため、個人の超過額は導出できず、超過額としては表示しない。
- **AI credit 利用量 API の値** (P1-5、SDD-03 §4a) は `fact.cost_line` に `unit_type` ごとに保持する。単位の異なる数量・金額は合算せず、応答に通貨が無いため通貨も断定しない。上記の集計にはまだ反映していない (Phase 2)。

---

## 2. 3軸グループへの費用配賦アルゴリズム

各シート割当ユーザー $u$ に対し、以下の優先順位で所属グループを特定し、集計バケットに按分する：

```
[User u]
   │
   ├── 1. Organization 軸:
   │      u.organization.login (例: "corp-core-engineering")
   │
   ├── 2. Cost Center 軸:
   │      a) u.cost_center_override (ユーザー属性テーブルによる上書き)
   │      b) GitHub Enterprise Cost Centers APIで紐付くCost Center名
   │      c) 未紐付け時は "Default-Cost-Center"
   │
   └── 3. 任意仕訳グループ 軸:
          a) u.department (ユーザー属性テーブルによる設定値)
          b) 未設定時は "未分類 (Unassigned)"
```

---

## 3. 遊休シート (Idle Seat) 判定ロジック

ライセンスコスト適正化のため、以下の基準で各シートの利用状況ステータスを判定する：

判定は `SeatClassificationRule`（閾値: `SEAT_ONBOARDING_DAYS = 7`、`SEAT_LOW_ACTIVE_DAYS = 14`、`SEAT_IDLE_DAYS = 30`）が行う。「付与後に未使用」とは、シートの付与後にアクティビティが無いこと（付与日当日のアクティビティは利用済み）。

| ステータス | 判定条件 | 遊休（削減可能額）に含むか | 推奨アクション |
|---|---|---|---|
| **Onboarding (導入期間)** | 付与後に未使用で、付与から **7日未満** | **含まない** | 様子を見る（新しいシートが未使用なのは想定内） |
| **Never Used (未利用)** | 付与後に未使用で、付与から **7日以上** 経過 | 含む | **即時回収推奨** |
| **Idle (遊休)** | 最終アクティビティが30日より前 (`> 30d`)、**または** 14日より前で、直近28日の AI クレジット消費が 0 と判明している | 含む | **ライセンス回収・解約推奨** |
| **Low Active** | 最終アクティビティが14日より前で、30日以内 | 含まない | 利用促進・ヒアリング |
| **Active** | 最終アクティビティが過去14日以内 | 含まない | 継続利用 |

画面のラベルも同じ定数（`SEAT_IDLE_CRITERIA_TEXT`）から作るため、表示する基準は常に判定と一致する。（以前は、ラベルが「30日以上未利用」なのに、クレジット連動の14日ルールでも遊休になり、付与2日のシートが遊休の無駄として報告されていた。）

### コスト削減機会 (Savings Potential) の算出
$$\text{Potential Monthly Savings} = \sum_{u \in \text{Idle} \cup \text{NeverUsed}} \text{MonthlyPrice}(u.\text{plan})$$

Onboarding のシートは除外する。プラン未確定のシートは 0 として扱い、その旨を示す。値はどのスコープでも月額（`monthlyIdleSavingsUsd`）。

---

## 4. 利用量メトリクス集計指標 & 分析ガイドライン

### 4.1 基本指標の定義
1. **Inline補完受諾率 (Inline Completion Acceptance Rate)**:
   $$\text{Inline Acceptance Rate} = \frac{\text{Total Code Acceptances}}{\text{Total Code Suggestions}} \times 100\%$$
   - **対象範囲**: エディタ内のインライン補完（Ghost Text）のみ。
2. **コード生成寄与度 (Lines Accepted Ratio)**:
   受諾された総行数と提案総行数の比率（$\frac{\text{Lines Accepted}}{\text{Lines Suggested}} \times 100\%$）。
3. **チャット・エージェント活性度 (Chat & Agent Engagement)**:
   IDE Chat、Dotcom Chat、CLI、Agentの利用セッション数およびモデル別（Claude 3.7 Sonnet, GPT-4o, o1, Gemini 2.0 Flash）の利用割合。
4. **アクティブ利用率 (Active Seat Ratio)**:
   $$\text{Active Ratio} = \frac{\text{Total Active Users in Period}}{\text{Total Assigned Seats}} \times 100\%$$

### 4.2 「受諾率パラドックス (Acceptance Rate Paradox)」と分析上の留意点

> [!WARNING]
> **「受諾率が低い ＝ 活用度が低い」という安易な評価の禁止**
> GitHub Copilot CLI や Autopilot（`--allow-all` / `/yolo` モード）、Agentモード（自律型タスク実行）を高度に活用しているエンジニアほど、エディタ上で手動タイピングして `Tab` で1行ずつ補完を受け入れる作業を行わなくなります。
> この結果、以下の現象が発生します：
> 1. **分母の機械的膨張**: エディタ上でエージェントの生成コードを閲覧・確認する際のキーストロークやカーソル移動により、裏でゴーストテキスト（Suggestions）のみが生成・破棄（暗黙的拒否）され、分母が累積する。
> 2. **分子の非加算**: CLIやエージェントがファイルに直接適用したパッチやコマンド実行は、IDEコード補完の受諾（Acceptances）には一切カウントされない。
> 3. **見かけ上の受諾率激減**: 先進的な活用者ほどInline補完受諾率が10%〜15%以下に低下する「受諾率の逆転（パラドックス）」が生じる。

### 4.3 推奨分析設計（サーフェス別分離評価）
組織および個人の開発生産性を評価する際は、Inline補完受諾率単一の数値に依存せず、以下の複合評価を実施する：
- **サーフェス別分離**: IDEコード補完（手動コーディング補助）、Chat/CLI（対話・コマンド実行）、Agent（自律タスク実行）を別セグメントとして計測する。
- **アウトカム指標との連動**: プルリクエスト作成速度、サイクルタイム、PRサマリー作成率（`total_pr_summaries_created`）、AIクレジット消費等の成果ベース指標と突き合わせて総合判断する。
- **ワークフロー分類軸としての活用**: Inline補完受諾率を「手動補完中心型」と「CLI/Agent自律型」の開発スタイル分類フィルターとして用いる。

### 4.4 欠損値・推定値・出所の扱い（捏造の禁止）

1. **欠損は `null`。0 や定数で埋めない。** 実測のない値は `null` で保持し、UI は理由付きの「—」（「取得不可: 利用状況メトリクスを取得できていません」）を表示する。受諾率・提案数・受諾数・チャット数・PR 要約数は null 許容で、0 は実測の 0 だけを意味する。
2. **利用状況メトリクスの出所** (`usage_metrics.availability`): `live`（今回の実行で取得）、`carried_over`（前回成功時の値。`as_of` 付き。「前回値」バッジで表示）、`unavailable`（一度も取得できていない）。
3. **グループ別の利用指標**: ライブデータでは *推定*（全社合計をシート比で按分）であり、`is_estimated` / `estimation_method` で示す。実測ではない。月次レポート (CSV) は提案数・受諾数・チャット数を持たないため、これらは `null`（旧: 固定の受諾率 35%、`requests × 0.35` / `× 0.2` の導出）。
4. **捏造しないもの**: 1 年推移は保存済みの月次集計から月ごとに構成する（保存データのない月は含めず、利用状況が未計測の月は利用指標を `null`）。個人別プロファイルを集計済み CSV から合成しない。採用成熟度のコホートを代理値から導かない。エージェント / PR に基づく診断は実測のフィールドだけを使う。ピア平均は実際のプロファイルから算出するか、算出できなければ出さない。CSV 行の利用面は無ければ空のまま（既定の「VS Code」は付けない）。包含クレジットの根拠がなければ「不明」とし、3,900 を仮定しない。
5. **フィルター**: ユーザー別の実測を持たないセクション（利用状況メトリクス・日次推移・言語別・SKU 内訳）は再集計できない。フィルター適用中も全社値のまま残し、「全社値（フィルター非対応）」と明示する（`filter_notice`）。

### 4.5 前期比と月末着地予測 (P3-2 / D-02)

`src/domain/metrics/kpi-analysis.ts` の純関数として実装する（同じ入力から同じ出力。現在時刻は注入）。日付は UTC の `YYYY-MM-DD`。

**前期比** (`compareToPrevious`): 比較対象は、月次スコープなら前月、日次スコープなら前日。期間 (custom) スコープには比較対象を定義しない。前期スコープは `index.json` に載っているときだけ取得し、当期と同じフィルターで再集計する。出力は差分 (`当期 - 前期`)、変化率 (`/ 前期`。**前期が 0 のときは出さない**)、方向。前期の値または比較対象が無いときは「前月比 —（理由）」とし、0 と比較しない。比率の指標（アクティブ率・予算消化率・受諾率）は差をポイント (pt) で示す。

**月末着地予測** (`forecastMonthEnd`) は *推定* 値（「推定」バッジ）:

```text
予測値   = 当月実績累計 + 直近 7 観測日の平均 × 残日数
残日数   = 月の日数 - 最終観測日の日
レンジ   = 当月実績累計 + (平均 ± 標準偏差) × 残日数   (下限は当月実績累計)
```

| 条件 | 結果 |
|:--|:--|
| 月次スコープではない | 算出しない:「—（月次スコープでのみ算出）」 |
| 観測 7 日未満（月初） | 算出しない:「—（観測 N 日 / 7 日未満）」 |
| 観測日数 / 経過日数 < 50%（欠損が多い） | 算出しない:「—（欠損が多い）」 |
| 過去の月、または月末まで観測済み | **締め済みの月**: 予測せず実績を表示 |
| 上記以外 | 予測値 + レンジ + 信頼度 + 算出式 |

欠損日 (`null`) は観測日に数えず、0 として扱わない。信頼度は、**高** = 観測 21 日以上・変動係数 0.2 以下・カバレッジ 90% 以上、**中** = 14 日以上・変動係数 0.5 以下・カバレッジ 70% 以上、それ以外は **低**。予測するのは 2 系列: 日次シート費 (`daily_trends.daily_cost_usd`、`spend_forecast`) と AI Credits 消費量 (`daily_trends.ai_credits_used`、`credits_forecast`)。シート費は日割りでほぼ一定のため、予測が効くのは主に AI Credits。`daily_trends` はユーザー別の実測を持たないため、フィルター適用中も全社値のままで、その旨を表示する（§4.4-5）。

### 4.6 1 年推移・月次締め・前年同月比 (P3-6 / B-01)

`src/processor/yearly-trend.ts` の純関数で実装する（現在時刻は注入、日付は UTC）。

**月次締めのルール。** 月は、**確定スナップショット**があるときだけ**確定**とする（月次締め、SDD-17 §3: **翌月の第 N 営業日**（既定 5、営業日カレンダーは設定可能）に数値をチェックサム付きで凍結する）。それ以外（当月、締めジョブが未実行の月を含む）は**暫定**。締め日を過ぎただけでは確定にしない。`points[].revision_count` に締め後の改訂回数を示す。宣言したルール（`close_rule`）は `buildYearlyTrendCloseRule(calendar)` で作り、データセットに書き出す。

**系列。** 保存済みの最新月を終端とする暦月で連続した 12 か月。保存済み集計が無い月は `missing`（値は null）で、0 にしない。月はあるが利用状況を実測できていない場合、`acceptance_rate` / `total_chats` は null のまま。

**前年同月比**は、月を前年の同じ月と指標ごとに比較する（`total_spend_usd` / `total_seats` / `active_seats` / `acceptance_rate` / `total_chats` / `total_ai_credits_used`）。差（`当月 - 前年`。割合指標は割合の差）と変化率（`/ 前年`）を出す。

| 条件 | 結果 |
|:--|:--|
| その月の保存済み集計が無い | 「—（この月の保存済み集計がない）」 |
| 月はあるが当該指標を実測できていない | 「—（当月の指標を取得できていない）」 |
| 前年同月のデータが無い | 「—（前年同月のデータなし）」。0 とは比較しない |
| 前年同月の値が 0 | 差のみ。変化率は出さない（「前年同月が 0 のため変化率は算出しない」） |

カタログ登録は `yoy_spend_change` と `yoy_active_seats_change`。

### 4.7 Billing API との突合 (P4-4 / E-03)

本書の金額は**計算値**（価格カタログ + 使用量）で、GitHub の請求額と一致する保証はない。AI Credits については、計算額（請求 API の数量 × USD の単価）と Billing API の金額（`grossAmount`）を月ごとに突合する。許容差は設定でき（既定は 1 USD **かつ** 1 %）、超えた月は GitHub issue になり、結果に価格カタログと為替カタログの版を記録する。請求データのない月は `unavailable` で、0 USD とは扱わない。データは非公開（`audit/billing-reconciliation/`、配信しない）。詳細は SDD-17 §5。

---

## 5. ユーザー別の使用量インサイト（使用量・トークン・単価・長大化の兆候）

`src/processor/usage-insight.ts` の純関数で算出する。閾値と文言は `src/processor/usage-insight-definitions.ts` に一元化する。月次レポートのユーザー行に `ReportUserDetail.usage_insight` として付与する（SDD-09 §3.5）。

### 5.1 測れるもの・測れないもの
- **測れる**: リクエスト数、AI クレジット、費用。レポートにあれば、トークン（GitHub の *AI usage report* の `input` / `output` / `cache_read` / `cache_write`。`date × model × username` 単位）。
- **どのソースにも無い**: セッション ID、セッションの長さ、ターン数、会話の内容。粒度の下限は「ユーザー × モデル × 1 日」。Reports API（SDD-03 §2.2）にはトークンの項目が無い。
- そのため「セッションが不当に長い」「複数の話題が混ざっている」は**断定しない**。兆候は日次の集計からの推定で、利用方法を見直す価値があるかもしれない、という手がかりにとどまる。会話の内容は読まず、保存もしない（Zero PII）。

### 5.2 指標（実測。取得できなければ `null`）
| 指標 | 定義 |
|:--|:--|
| 使用量 | リクエスト数（requests 系の明細のみ）、クレジット（`ai_credits_consumed`、無ければクレジット行の `quantity`）、利用日数、1 利用日あたり（リクエスト、無ければクレジット）、ピーク日 |
| トークン | `input` + `output` + `cache_read` + `cache_write`（従来の `token_count` は合計のみで内訳なし）。`coverage` はトークンを持つ明細行の割合 |
| コスト/100 万トークン | トークンを持つ行の利用額 ÷ そのトークン × 10⁶。キャッシュ読取は単価が安いため混合単価 |
| コスト/リクエスト、コスト/クレジット | requests 行の利用額 ÷ リクエスト数、クレジット行の利用額 ÷ クレジット。**シート（ライセンス）行は含めない** |

費用は利用額（gross、定価ベース）を使う。付与クレジットの範囲内では net が 0 になり、単価がすべて 0 になるため。

### 5.3 兆候（推定）
段階は `none`（特記なし）/ `watch`（参考）/ `review`（確認を推奨）/ `insufficient`（データ不足）。点数化・順位づけはしない。**利用日数が 5 日未満**のユーザー、または必要な列が無い場合は `insufficient` とし、「健全」とはしない。

| ID | 兆候 | 定義 | 参考 / 確認を推奨 |
|:--|:--|:--|:--|
| S1 | 文脈の持ち越し | (input + cache_read) ÷ output。組織中央値との比 | 2 倍以上 / 3 倍以上 |
| S2 | 高トークン日 | 1 日のトークン合計が組織の中央値日の 3 倍以上の日 | 2 日以上 / 3 日以上かつ利用日の 3 割以上 |
| S3 | 1 利用日あたりの量 | 利用日 1 日あたりのリクエスト（無ければクレジット）。組織中央値との比 | 2 倍以上 / 3 倍以上 |
| S4 | モデル切替 | 1 日に使った異なるモデル数の平均（弱い手がかり。複数モデルの併用は一般的） | 平均 2.5 以上で「参考」止まり |
| S5 | 高単価モデルでの持ち越し | 全モデルの単価（100 万トークンあたり）の中央値の 2 倍以上のモデルにトークンの 5 割以上が集中し、かつ S1 が参考以上 | S1 の段階を引き継ぐ |

総合: 有効なシグナルのうち 1 つでも `review` なら `review`。`watch` が 2 つ以上、または S4 以外の `watch` が 1 つなら `watch`。それ以外は `none`。評価できるシグナルが無ければ `insufficient`。S4 だけでは総合を上げない。

組織の基準値（中央値、モデル別単価）は、**表示フィルターを適用する前の当月の全ユーザー**から作る。フィルターを切り替えても各ユーザーの段階は変わらない。

### 5.4 表示の原則
- 文言は推奨にとどめ、断定しない: 「確認を推奨」「参考」。「不当」「違反」「問題」は使わない。
- 兆候が日次集計からの推定であること、会話の内容は見ていないこと、個人の評価ではないことを、画面に常に表示する（`USAGE_INSIGHT_DISCLAIMER`）。
- `review` への助言は断定しない（例:「話題ごとに新しいセッションを始めると、毎回送られる文脈が小さくなる場合があります」）。

