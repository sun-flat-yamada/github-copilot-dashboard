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

## 4. 利用量メトリクス集計指標

1. **受諾率 (Acceptance Rate)**:
   $$\text{Acceptance Rate} = \frac{\text{Total Code Acceptances}}{\text{Total Code Suggestions}} \times 100\%$$
2. **コード生成寄与度 (Lines Accepted)**:
   受諾された総行数と提案総行数の比率。
3. **チャット活性度 (Chat Engagement)**:
   IDE Chat、Dotcom Chat、CLIの利用セッション数およびモデル別（Claude 3.7 Sonnet, GPT-4o, o1）の利用割合。
4. **アクティブ利用率 (Active Seat Ratio)**:
   $$\text{Active Ratio} = \frac{\text{Total Active Users in Period}}{\text{Total Assigned Seats}} \times 100\%$$
