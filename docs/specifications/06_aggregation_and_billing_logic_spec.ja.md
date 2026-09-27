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

### 1.3 Cost Center 予算管理 (Budget Management Model)
GitHub Enterprise Billingで定義された各Cost CenterのBudgetに対して、以下の指標を算出・管理する：
1. **上限Budget額 ($B_{\text{limit}}$)**: 期間または月間の支出上限設定値。
2. **無料Budget額 ($B_{\text{free}}$)**: プラン付帯またはクレジット付与による無償枠。
3. **現在使用済みBudget額 ($S_{\text{current}}$)**: 該当Cost Centerに属する全シートの期間消費額合計。
4. **課金対象実使用額 ($S_{\text{billable}}$)**:
   $$S_{\text{billable}} = \max(0, S_{\text{current}} - B_{\text{free}})$$
5. **残余Budget額 ($B_{\text{remaining}}$)**:
   $$B_{\text{remaining}} = \max(0, B_{\text{limit}} - S_{\text{billable}})$$
6. **予算消化率 ($U_{\%}$)**:
   $$U_{\%} = \frac{S_{\text{billable}}}{B_{\text{limit}}} \times 100\%$$
   - $U_{\%} < 80\%$: 正常 (`normal`)
   - $80\% \le U_{\%} < 100\%$: 注意・警告 (`warning`)
   - $U_{\%} \ge 100\%$: 超過 (`exceeded`)

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

#### 1.4.3 設定値非存在区間の公的為替レート自動算出
- 期間別設定または基本設定において為替レートが指定されていない区間（月）については、一般公開されている信頼できる公的データソースを参照して為替レートを自動算出する：
  - **欧州中央銀行 (European Central Bank: ECB)** 公式参照為替相場 (Euro foreign exchange reference rates)
  - **日本銀行 (Bank of Japan: BOJ)** 公表外国為替相場
- これにより、未設定月や過去履歴の分析時においても、常に公式公表相場に裏付けられた適正な為替換算が自動的に適用される。

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

| ステータス | 判定条件 | 推奨アクション |
|---|---|---|
| **Active** | 最終アクティビティが過去14日以内 (`now - last_activity_at <= 14d`) | 継続利用 |
| **Low Active** | 最終アクティビティが過去15〜30日以内 (`14d < now - last_activity_at <= 30d`) | 利用促進・ヒアリング |
| **Idle (遊休)** | 最終アクティビティが過去31日以上前 (`now - last_activity_at > 30d`) | **ライセンス回収・解約推奨** |
| **Never Used (未利用)** | `last_activity_at == null` かつ付与から7日以上経過 | **即時回収推奨** |

### コスト削減機会 (Savings Potential) の算出
$$\text{Potential Monthly Savings} = \sum_{u \in \text{Idle} \cup \text{NeverUsed}} \text{Price}(u.\text{plan})$$

---

## 4. 利用量メトリクス集計指標 & 分析ガイドライン

### 4.1 基本指標の定義
1. **コード受諾率 (Code Completion Acceptance Rate)**:
   $$\text{Acceptance Rate} = \frac{\text{Total Code Acceptances}}{\text{Total Code Suggestions}} \times 100\%$$
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
> 3. **見かけ上の受諾率激減**: 先進的な活用者ほど受諾率が10%〜15%以下に低下する「受諾率の逆転（パラドックス）」が生じる。

### 4.3 推奨分析設計（サーフェス別分離評価）
組織および個人の開発生産性を評価する際は、受諾率単一の数値に依存せず、以下の複合評価を実施する：
- **サーフェス別分離**: IDEコード補完（手動コーディング補助）、Chat/CLI（対話・コマンド実行）、Agent（自律タスク実行）を別セグメントとして計測する。
- **アウトカム指標との連動**: プルリクエスト作成速度、サイクルタイム、PRサマリー作成率（`total_pr_summaries_created`）、AIクレジット消費等の成果ベース指標と突き合わせて総合判断する。
- **ワークフロー分類軸としての活用**: 受諾率を「手動補完中心型」と「CLI/Agent自律型」の開発スタイル分類フィルターとして用いる。
