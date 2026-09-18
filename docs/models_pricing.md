# GitHub Copilot のモデルと価格設定

GitHub Copilotで使用可能なモデルのトークンごとの価格と、プラン全体の追加の使用量に関するリファレンス 料金を参照してください。

## モデルの価格のしくみ

Copilotを使用すると、対話によってトークン (入力トークン (モデルに送信されたもの)、出力トークン (モデルによって生成されたもの)、キャッシュされたトークン (モデルが再利用または格納するコンテキスト) が使用されます。 各トークンは、使用されるモデルに基づいて価格が設定され、合計は AI creditsに変換されます。ここで、1 AI credit = $0.01 USD。

対話のコストは、モデルと使用されるトークンの数の 2 つの要素によって異なります。

使用状況 Copilot 追跡および課金される方法は、プランの種類によって異なります。

* 個々のプラン (Copilot Free、 Copilot Pro、 Copilot Pro+、 Copilot Max) には、プランによって異なる GitHub AI Credits の許容量が含まれます。 詳細については、「[Usage-based billing for individuals](/ja/copilot/concepts/billing/usage-based-billing-for-individuals)」を参照してください。
* Copilot Business
  Copilot Enterpriseには、課金エンティティ レベルでプールされるユーザーごとのGitHub AI Credits許容量が含まれます。 詳細については、「[Usage-based billing for organizations and enterprises](/ja/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises)」を参照してください。

使用がCopilotプランに含まれる許容量を超えると、以下の価格表 (1 GitHub AI CreditsAI credit = ) に示されているトークンごとの料金で、$0.01 USDで追加の使用量が課金されます。

> \[!NOTE] 追加のAI creditsを購入するオプションは、iOS または Android でCopilotを使用してGitHub Mobile プランにサブスクライブした場合、またはサブスクライブしている場合は使用できません。

## 価格表

すべての価格は **100万トークンあたりの価格です**。

### OpenAI

> \[!NOTE] Models with a **Long context** tier, offer extended capabilities and longer context windows. See [GitHub Copilotでサポートされている AI モデル](/ja/copilot/reference/ai-models/supported-models#models-with-extended-capabilities)

GPT-5.6 Sol、 GPT-5.6 Terra、 GPT-5.6 Luna、および GPT-6 Astra には、キャッシュされた入力に加えて、キャッシュ書き込みコストも含まれます。 以前の OpenAI モデルには、キャッシュ書き込みコストはありません。

| Model         | リリースの状態 | カテゴリ        | レベル          | しきい値 (入力トークン)  |     入力 | キャッシュされた入力 |      キャッシュ書き込み | アウトプット |
| ------------- | ------- | ----------- | ------------ | -------------- | -----: | ---------: | -------------: | -----: |
|               |         |             |              |                |        |            |                |        |
| GPT-5 mini    | GA      | Lightweight | Default      | Not applicable |  $0.25 |     $0.025 | Not applicable |  $2.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.3-Codex | GA      | Powerful    | Default      | Not applicable |  $1.75 |     $0.175 | Not applicable | $14.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.4       | GA      | Versatile   | Default      | ≤ 272K         |  $2.50 |      $0.25 | Not applicable | $15.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.4       | GA      | Versatile   | Long context | > 272K         |  $5.00 |      $0.50 | Not applicable | $22.50 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.4 mini  | GA      | Lightweight | Default      | Not applicable |  $0.75 |     $0.075 | Not applicable |  $4.50 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.4 nano  | GA      | Lightweight | Default      | Not applicable |  $0.20 |      $0.02 | Not applicable |  $1.25 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.5       | GA      | Powerful    | Default      | ≤ 272K         |  $5.00 |      $0.50 | Not applicable | $30.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.5       | GA      | Powerful    | Long context | > 272K         | $10.00 |      $1.00 | Not applicable | $45.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.6 Luna  | GA      | Lightweight | Default      | ≤ 200K         |  $0.20 |      $0.02 |          $0.25 |  $1.20 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.6 Luna  | GA      | Lightweight | Long context | > 200K         |  $0.40 |      $0.04 |          $0.50 |  $1.80 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.6 Sol   | GA      | Powerful    | Default      | ≤ 272K         |  $4.00 |      $0.40 |          $5.00 | $20.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.6 Sol   | GA      | Powerful    | Long context | > 272K         |  $8.00 |      $0.80 |         $10.00 | $30.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.6 Terra | GA      | Versatile   | Default      | ≤ 272K         |  $2.00 |      $0.20 |          $2.50 | $12.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-5.6 Terra | GA      | Versatile   | Long context | > 272K         |  $4.00 |      $0.40 |          $5.00 | $18.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-6 Astra   | GA      | Powerful    | Default      | ≤ 272K         | $10.00 |      $1.00 |         $12.50 | $50.00 |
|               |         |             |              |                |        |            |                |        |
| GPT-6 Astra   | GA      | Powerful    | Long context | > 272K         | $20.00 |      $2.00 |         $25.00 | $75.00 |
|               |         |             |              |                |        |            |                |        |

### Anthropic

Anthropicモデルには、キャッシュされた入力に加えて、キャッシュ書き込みコストも含まれます。

| Model                                 | リリースの状態 | カテゴリ      |     入力 | キャッシュされた入力 | キャッシュ書き込み | アウトプット |
| ------------------------------------- | ------- | --------- | -----: | ---------: | --------: | -----: |
|                                       |         |           |        |            |           |        |
| Claude Haiku 4.5                      | GA      | Versatile |  $1.00 |      $0.10 |     $1.25 |  $5.00 |
|                                       |         |           |        |            |           |        |
| Claude Sonnet 4                       | GA      | Versatile |  $3.00 |      $0.30 |     $3.75 | $15.00 |
|                                       |         |           |        |            |           |        |
| Claude Sonnet 4.6                     | GA      | Versatile |  $3.00 |      $0.30 |     $3.75 | $15.00 |
|                                       |         |           |        |            |           |        |
| Claude Opus 4.7                       | GA      | Powerful  |  $5.00 |      $0.50 |     $6.25 | $25.00 |
|                                       |         |           |        |            |           |        |
| Claude Opus 4.8                       | GA      | Powerful  |  $5.00 |      $0.50 |     $6.25 | $25.00 |
|                                       |         |           |        |            |           |        |
| Claude Opus 5                         | GA      | Powerful  |  $5.00 |      $0.50 |     $6.25 | $25.00 |
|                                       |         |           |        |            |           |        |
| Claude Sonnet 5                       | GA      | Versatile |  $2.00 |      $0.20 |     $2.50 | $10.00 |
|                                       |         |           |        |            |           |        |
| Claude Opus 4.8 (fast mode) (preview) | GA      | Powerful  | $10.00 |      $1.00 |    $12.50 | $50.00 |
|                                       |         |           |        |            |           |        |
| Claude Fable 5                        | GA      | Powerful  | $10.00 |      $1.00 |    $12.50 | $50.00 |
|                                       |         |           |        |            |           |        |
| Claude Fable 5.1                      | GA      | Powerful  | $10.00 |      $0.25 |    $12.50 | $50.00 |
|                                       |         |           |        |            |           |        |

### Google

> \[!NOTE] Models with a **Long context** tier, offer extended capabilities and longer context windows. See [GitHub Copilotでサポートされている AI モデル](/ja/copilot/reference/ai-models/supported-models#models-with-extended-capabilities)

| Model                                 | リリースの状態 | カテゴリ        | レベル     | しきい値 (入力トークン)  |    入力 | キャッシュされた入力 | アウトプット |
| ------------------------------------- | ------- | ----------- | ------- | -------------- | ----: | ---------: | -----: |
|                                       |         |             |         |                |       |            |        |
| Gemini 3.5 Flash                      | GA      | Lightweight | Default | Not applicable | $1.50 |      $0.15 |  $9.00 |
|                                       |         |             |         |                |       |            |        |
| Gemini 3.6 Flash[^gemini-flash-promo] | GA      | Versatile   | Default | Not applicable | $0.75 |     $0.075 |  $3.75 |
|                                       |         |             |         |                |       |            |        |
| Gemini 3.7 Flash[^gemini-flash-promo] | GA      | Versatile   | Default | Not applicable | $0.75 |     $0.075 |  $3.75 |
|                                       |         |             |         |                |       |            |        |
| Gemini 3.8 Flash[^gemini-flash-promo] | GA      | Versatile   | Default | Not applicable | $0.75 |     $0.075 |  $3.75 |
|                                       |         |             |         |                |       |            |        |

### 微調整 (GitHub)

| Model | リリースの状態 | カテゴリ | 入力 | キャッシュされた入力 | アウトプット |
| ----- | ------- | ---- | -: | ---------: | -----: |
|       |         |      |    |            |        |

### マイクロソフト

| Model              | リリースの状態 | カテゴリ        |    入力 | キャッシュされた入力 | アウトプット |
| ------------------ | ------- | ----------- | ----: | ---------: | -----: |
|                    |         |             |       |            |        |
| MAI-Code-1.1-Flash | GA      | Lightweight | $0.20 |      $0.02 |  $1.20 |
|                    |         |             |       |            |        |

### 説明可能な人工知能 (xAI)

> \[!NOTE] Models with a **Long context** tier, offer extended capabilities and longer context windows. See [GitHub Copilotでサポートされている AI モデル](/ja/copilot/reference/ai-models/supported-models#models-with-extended-capabilities)

| Model    | リリースの状態 | カテゴリ      | レベル          | しきい値 (入力トークン) |    入力 | キャッシュされた入力 | アウトプット |
| -------- | ------- | --------- | ------------ | ------------- | ----: | ---------: | -----: |
|          |         |           |              |               |       |            |        |
| Grok 4.5 | GA      | Versatile | Default      | ≤ 200K        | $2.00 |      $0.50 |  $6.00 |
|          |         |           |              |               |       |            |        |
| Grok 4.5 | GA      | Versatile | Long context | > 200K        | $4.00 |      $1.00 | $12.00 |
|          |         |           |              |               |       |            |        |
| Grok 4.6 | GA      | Versatile | Default      | ≤ 200K        | $2.00 |      $0.50 |  $6.00 |
|          |         |           |              |               |       |            |        |
| Grok 4.6 | GA      | Versatile | Long context | > 200K        | $4.00 |      $1.00 | $12.00 |
|          |         |           |              |               |       |            |        |

### ムーンショットAI

| Model          | リリースの状態 | カテゴリ      |    入力 | キャッシュされた入力 | アウトプット |
| -------------- | ------- | --------- | ----: | ---------: | -----: |
|                |         |           |       |            |        |
| Kimi K2.7 Code | GA      | Versatile | $0.95 |      $0.19 |  $4.00 |
|                |         |           |       |            |        |
| Kimi K3        | GA      | Powerful  | $3.00 |      $0.30 | $15.00 |
|                |         |           |       |            |        |

## コード補完

コード補完と next edit suggestions は、 AI creditsでは課金されません。 すべての有料 Copilot プランに対して無制限のままであり、既存のカウント メカニズムを引き続き使用します。

## の価格と使用コストに関する考慮事項 Copilot code review

ほとんどの Copilot 機能では、各操作に使用されるモデルが表示されるため、上記の価格表を参照してコストを見積もることができます。
Copilot code review は例外です。モデルは自動的に選択され、公開されないため、トークンごとのコストはレビューによって異なる場合があります。

コード レビューごとに 2 つの方法で課金されます。トークン使用量は AI creditsで課金され、レビューを実行するエージェント インフラストラクチャは GitHub Actions 分で消費されます。

GitHub Actions 分はリポジトリに計上され、そこから該当する場合は企業またはコスト センターに計上されます。
AI credits は、レビューを要求したユーザー、またはポリシーによってレビューが自動的にトリガーされる pull request の作成者に課金されます。 そのユーザーが Copilot シートを持っていない場合は、代わりにエンタープライズまたはコスト センターに使用量が課金されます。
Copilot cloud agentによって作成されたプル要求の場合、使用は最初に変更に関連付けられている人間の共同作成者に起因します。 共同作成者に課金できない場合、使用状況は組織に直接課金されます。 他のボットによって作成されたプル要求の場合、またはボットがレビューを要求すると、使用状況も組織に直接課金されます。 これらのプル要求は、エージェント レビューの対象となります。

GitHub Actionsの現在のCopilot code reviewの使用状況は、次の方法で表示できます。

* **GitHub Actions メトリック**: `copilot-pull-request-reviewer` ワークフローでフィルター処理します。 「[GitHub Actions のメトリックをあなたの組織で表示する](/ja/organizations/collaborating-with-groups-in-organizations/viewing-github-actions-metrics-for-your-organization)」を参照してください。
* **課金使用状況レポート**: 値 `workflow_path` を使用して `dynamic/agents/copilot-pull-request-reviewer` でフィルターします。 「[課金レポート リファレンス](/ja/billing/reference/billing-reports)」を参照してください。

## 年間契約者Copilot Pro および Copilot Pro+ のモデル乗数

Copilot Pro
Copilot Pro+の課金モデルを使用する**既存の年次請求プラン**のサブスクライバーと\*\*\*\* サブスクライバーには、異なるモデル乗数があります。 「[リクエストベース課金の年間プラン向けモデル係数（旧）](/ja/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans)」を参照してください。

[^gemini-flash-promo]: Gemini 3.6 Flash, Gemini 3.7 Flash, and Gemini 3.8 Flash are available at the promotional pricing of $0.75 per 1M input tokens, $0.075 per 1M cached input tokens, and $3.75 per 1M output tokens through December 31, 2026.