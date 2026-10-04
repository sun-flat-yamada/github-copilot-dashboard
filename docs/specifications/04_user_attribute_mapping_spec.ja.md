[English](04_user_attribute_mapping_spec.md) | [日本語](04_user_attribute_mapping_spec.ja.md)

---

# SDD-04: ユーザー属性情報マッピング & 秘匿化仕様書 (User Attribute Mapping)

- **文書番号**: SPEC-COPILOT-004
- **ステータス**: Approved / Active
- **対象バージョン**: 2026.09-LTS
- **作成日**: 2026-09-10

---

## 1. 目的とセキュリティ原則

GitHub Copilotの利用者を「部署」「プロジェクト」「仕訳コード」「表示名」に紐付けて分析する際、個人の氏名や社内組織図などのプライベート情報を**公開Gitコミットに一切残さない（Zero Leakage in Git History）**ことを絶対条件とする。

> [!WARNING]
> この保証が及ぶのは **`main`（ソース）ブランチだけ** である。`copilot-data` ブランチと GitHub Pages の配信物には、解決済みの氏名・部署・タグ・個人別利用が必然的に含まれる。それらが公開されるかは、リポジトリ / Pages の公開範囲による。公開リポジトリで実データを公開する前に、§5（公開範囲と仮名化）を必ず確認すること。

---

## 2. 注入メカニズム (GitHub Actions Variables / Secrets)

本システムは、リポジトリまたはOrganization単位で設定される以下の環境変数を自動認識する：

1. **優先度 1: `COPILOT_USER_MAPPING_FILE` (ローカルファイルパス、オプション)**
   - ローカルファイルシステム上のJSON/CSVファイルパスを指定する。
   - GitHub Secrets/Variables の 48KB サイズ上限を超える大規模マッピングを扱うための
     **GPG暗号化ワークアラウンド** (第6章参照) が実行時にこの変数を利用する。
   - 指定されたファイルが存在しない場合は警告を出力し、優先度2以降へ自動フォールバックする。
2. **優先度 2: `COPILOT_USER_MAPPING` (GitHub Secret または Variable)**
   - GitHub Actions 設定の `Variables` または `Secrets` に設定されたJSON文字列またはCSV文字列。
   - **重要**: 個々の Secret/Variable の値は **48KB (49,152バイト)** に制限されている
     （[GitHub公式ドキュメント: Storing large secrets](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions#storing-large-secrets)、
     [Variables reference: Limits for configuration variables](https://docs.github.com/actions/writing-workflows/choosing-what-your-workflow-does/store-information-in-variables#limits-for-configuration-variables)）。
     従業員規模が大きく48KBを超える場合は第6章のGPGワークアラウンドを使用すること。
3. **優先度 3: `COPILOT_USER_MAPPING_BASE64` (オプション)**
   - 改行や特殊文字による破損を防ぐためのBase64エンコード済み文字列。こちらも48KB上限の対象。
4. **優先度 4: 未設定時のフォールバック**
   - マッピングが存在しないユーザーは、GitHub login名をそのまま表示名とし、仕訳グループは「未分類 (Unassigned)」とする。

---

## 3. マッピングデータスキーマ

### 3.1 JSON形式 (推奨)

```json
[
  {
    "github_user": "tanaka-taro",
    "display_name": "田中 太郎",
    "department": "決済プラットフォーム部",
    "cost_center_override": "Platform-Engineering",
    "notes": "リードエンジニア / 正社員"
  },
  {
    "github_user": "sato-hanako",
    "display_name": "佐藤 花子",
    "department": "データサイエンス推進部",
    "cost_center_override": "AI-and-Data-Platform",
    "notes": "MLエンジニア"
  },
  {
    "github_user": "suzuki-ken",
    "display_name": "鈴木 健 (パートナー)",
    "department": "フロントエンド基盤G",
    "cost_center_override": "Platform-Engineering",
    "notes": "業務委託",
    "tags": ["業務委託", "リモート"]
  }
]
```

### 3.2 CSV形式 (簡易設定用)

ヘッダー行付きのCSV形式も自動判別してパースする (任意の `valid_from` / `valid_to` 列で実効期間を追加できる。4.1 節)：

```csv
github_user,display_name,department,cost_center_override,notes,tags
tanaka-taro,田中 太郎,決済プラットフォーム部,Platform-Engineering,正社員,
sato-hanako,佐藤 花子,データサイエンス推進部,AI-and-Data-Platform,MLエンジニア,
suzuki-ken,鈴木 健 (パートナー),フロントエンド基盤G,Platform-Engineering,業務委託,業務委託;リモート
```

`tags` 列は複数値を1セルに格納するため、カンマ (列区切り) と衝突しないよう **セミコロン (`;`) 区切り** を用いる
(例: `業務委託;リモート` → `["業務委託", "リモート"]`)。値が不要な場合は空欄のままでよい。

---

## 4. フィールド定義

| フィールド名 | 型 | 必須 | 説明 | デフォルト値 |
|---|---|---|---|---|
| `github_user` | string | ○ | GitHubのログインID (case-insensitive) | - |
| `display_name` | string | - | ダッシュボード上に表示する氏名・表記 | `github_user` と同一 |
| `department` | string | - | 任意指定の仕訳グループ名・部署名・プロジェクト名 | `"未分類 (Unassigned)"` |
| `cost_center_override` | string | - | GitHub APIのCost Centerを上書き指定する場合に設定 | API取得値を優先、無ければ `"デフォルトCostCenter"` |
| `notes` | string | - | 雇用形態やメモ情報 | `""` |
| `tags` | string[] | - | 自由入力の複数ラベル (例: `["業務委託", "リモート"]`)。JSONは配列、CSVは `;` 区切りの1セルで指定 | 未設定 (`undefined`) |
| `valid_from` | string (`YYYY-MM-DD`) | - | この行が有効になる最初の日 (当日を含む)。4.1 節 | 未設定 (開始の制限なし) |
| `valid_to` | string (`YYYY-MM-DD`) | - | この行が有効な最後の日 (当日を含む) | 未設定 (無期限) |

### 4.1 実効期間 (SCD Type 2, P3-8 / B-17)

異動で部署・コストセンターは変わる。時点を持たないマッピングは過去月も**現在の所属**で配賦し直してしまうため、ユーザーは**実効期間ごとに 1 行**を持てる。

```json
[
  { "github_user": "dev_alice", "department": "Unit Alpha", "cost_center_override": "CC-ALPHA", "valid_to": "2026-08-14" },
  { "github_user": "dev_alice", "department": "Unit Beta",  "cost_center_override": "CC-BETA",  "valid_from": "2026-08-15" }
]
```

(上記は架空のプレースホルダー。実際のマッピングは `COPILOT_USER_MAPPING` / 暗号化マッピングファイルでのみ供給し、コミットしない。)

- **後方互換**: `valid_from` / `valid_to` のどちらも無い行は無期限で、既存のマッピングは従来どおり動く。CSV は `valid_from` / `valid_to` 列を足す (列が無い CSV は変わらない)。
- **解決時点 (`asOf`)**: `AttributeResolver.resolve(login, asOf)` (および `IAttributeResolver.resolve`) は `asOf` に有効な行を選ぶ。`asOf` は `YYYY-MM-DD`、`YYYY-MM` は**その月の月末日**。`asOf` 省略時は現行の行 (`valid_from` が最新の行)。有効な行が無い場合 (最初の期間より前・期間の隙間) は未登録として扱う (表示名はログイン名、部署は `Unassigned`)。
- **適用箇所**: 月次レポートの集計 (`ReportParser.aggregate`) はレコードごとにそのレコードの日付で解決するため、異動月の部署・コストセンター配賦は**実効日で分かれる** (日付の無いレコードは月末)。ユーザー別の行は最終利用日の属性。`BillingCalculator` は基準日で解決する。過去月が新しい所属に付け替わることはない。
- **検証** (`validateMappingPeriods`。マッピング読み込み時に実行し、`AttributeResolver.getValidationIssues()` で取得):

| 検出内容 | 重大度 | 扱い |
|---|---|---|
| 不正な日付 / `valid_from` が `valid_to` より後 | error | その行は解決対象から外す (未登録扱い) |
| 期間の重複 (期間なしの行が 1 ユーザーに 2 行ある場合を含む) | error | `valid_from` が新しい行 (同じなら入力順で後の行) を優先 |
| 期間の隙間 | warning | 隙間の日は未登録扱い |

  読み込み時の警告ログは件数のみで、ログイン名は出さない (Zero PII)。
- **仮名化** (5.2 節) は、その日付で選ばれた行に適用する。異動すると `Group-<hex>` は変わるが `dev_<hex>` は変わらない。
- **閲覧の前提**: 個人別の表示は該当期間の属性を示し、閲覧権限のある社員向け (SDD-01 §1.1)。

---

## 5. 運用の前提・公開範囲のガード・仮名化 (E-05)

> **前提 (SDD-01 §1.1)**: 本ダッシュボードは、企業の GitHub Enterprise 環境内の **private または internal** リポジトリと、**アクセス制御付きの Pages** で運用し、自社の社員だけが参照する。したがって、個人が識別できるデータ (氏名・部署・ユーザー別の利用状況) を表示してよい。**実データの公開デプロイはサポートしない。** 以下の仕組みは、(a) 前提に反する構成を検出するガードと、(b) 任意の仮名化措置である。

### 5.1 何がどこに含まれ、誰に見えるか

| 場所 | 内容 | 閲覧範囲 |
|---|---|---|
| `main` ブランチ | ソースコードのみ（データ・マッピングなし） | リポジトリの公開範囲 |
| `copilot-data` ブランチ（同一リポジトリ） | `processed/*`（解決済みの表示名・部署・タグ・個人別利用・診断）、`raw/*`（GitHub ログイン名・数値ユーザー ID・アバター URL を含むシート割り当て）、取り込んだレポート CSV | **リポジトリと同じ。** 公開リポジトリならこのブランチも公開される |
| `copilot-data` ブランチ: `audit/seat-events/*`（P4-3） | シート監査イベント（ログインごとの付与・剥奪・プラン変更・最終利用日の変化。`ANONYMIZE_USERS=true` ではログインは仮名）。`processed/` の外にあるのでステージされない | リポジトリと同じ。**Pages には配信しない**（`dist/data/` に `audit` があれば `pages:verify` が失敗）。CSV 出力は権限のある社内の閲覧者のみ（SDD-17 §4） |
| GitHub Pages の配信物 | `index.json`、ルートへ展開した `processed/*` | **リポジトリが非公開でも既定で公開される**（GitHub Enterprise Cloud のアクセス制御付き Pages を使う場合を除く） |

リポジトリと Pages の **両方** を、データの公開境界として扱うこと。前提のもとでは、どちらも Enterprise のメンバーに限定する (internal / private リポジトリ、アクセス制御付き Pages)。

### 5.2 仮名化モード (`ANONYMIZE_USERS=true`)

前提のもとでは任意。社内の閲覧者に見せる範囲を絞りたい場合や、前提より広い閲覧者を承知のうえで受け入れる場合に有効にする。

閲覧者が想定を超えて広がりうる場合に有効にする：

- Variable `ANONYMIZE_USERS=true` と、シークレット **`ANONYMIZE_SECRET`**（16 文字以上のランダム値。例: `openssl rand -hex 32`）。**十分な長さの秘密鍵が無い場合、パイプラインは何も書き込まずに停止する**（fail closed）。秘密鍵の無い匿名化は復元可能で、公開してはならないため。
- 方式: `ANONYMIZE_SECRET` を鍵とする **HMAC-SHA256**。入力は `<種別>\0<小文字化・前後空白除去した値>`（種別 = `login` / `name` / `department` / `team` / `project`。種別ごとにドメインを分離する）。旧実装は 32 ビットの秘密鍵なしハッシュで、GitHub ログイン名の辞書照合により誰でも復元できた。
- 出力形式（同じ鍵なら決定的なので、月をまたぐ推移・突合は維持される）：

| 項目 | 仮名 |
|---|---|
| `github_user` / ログイン名 | `dev_<16 桁 hex>`（64 ビット） |
| `display_name` | `User-<8 桁 hex>` |
| `department` | `Group-<8 桁 hex>`（未割当ラベルは維持） |
| チーム / プロジェクト | `Team-<8 桁 hex>` / `Project-<8 桁 hex>` |

- **すべての出力から除去するもの**: `avatar_url`（数値の GitHub ユーザー ID を含み、公開 API で本人に解決できる）、Raw のシート割り当てにある数値ユーザー ID・プロフィール URL、自由記述の `notes`。Raw パーティションでは、Cost Center のユーザーリソース名とチーム名も仮名化する。取り込んだ月次レポートの元の CSV は **保存も push もしない**（仮名化した集計結果だけを保存。`--push` は無視される）。
- **変更しないもの**: タグ、Cost Center 名、Organization のログイン名、`role`（個人ではなく組織構造を表すため）。組織構造が機密ならリポジトリを非公開にすること。
- `index.json` は `privacy: { anonymized, contains_user_level_data }` を宣言する。公開されたデータが個人を特定できるかを、ツール（`fork:verify`）が判定できるようにするため。デモデータでは `contains_user_level_data` は `false`。
- **限界**: 仮名化は匿名化ではない。仮名は安定した識別子であり、部署 / Cost Center / 活動日と組み合わせると、少人数のグループでは個人を再特定できうる。`ANONYMIZE_SECRET` を変更すると全仮名が変わる（新旧データの突合ができなくなる）。鍵を失うと再紐付けはできない。仮名化した出力も、各国の個人情報保護の規制上は個人データとして扱うこと。旧方式（旧ハッシュ）で公開済みのデータは、ブランチ履歴から削除するまで残る。

### 5.3 公開範囲の検査 (`npm run fork:verify`)

`fork:verify` は前提のためのガードである。実際のユーザー単位のデータを **誰でも読めるか** (= リポジトリや Pages が Enterprise に限定されていないか) を、匿名で（`Authorization` ヘッダーなしで）確かめる：

1. `GET https://api.github.com/repos/{owner}/{repo}` → `200`: リポジトリは公開
2. `GET https://raw.githubusercontent.com/{owner}/{repo}/copilot-data/data/index.json` → `200`: データブランチが読める
3. `GET {Pages の URL}/data/index.json` → `200`: 配信物がデータを公開している（カスタムドメインは `COPILOT_PAGES_URL` で `https://{owner}.github.io/{repo}/` を上書き）

公開されているもの（またはリポジトリが公開）があり、**かつ** 仮名化されていない実際のユーザー単位のデータが公開済み（`index.json` の privacy 属性。旧形式はシート / 日次実績の有無で判定）、または収集しようとしている（`COPILOT_READ_TOKEN` と `COPILOT_ENTERPRISE` / `COPILOT_ORGS` が設定済み、またはローカルの `data/index.json` に実データがある）のに、仮名化の設定が揃っていない場合は **失敗** とする。デモデータのみ・仮名化済みの運用は通る。**取り込んだ月次レポート (CSV) だけの場合は警告にとどめる**: index は `privacy.contains_imported_reports` を宣言する。レポートは (本家リポジトリのような) 架空の見本にも実データにもなり得るため、公開で読める index に `available_reports` があれば、見本であることの確認を求める警告とし、失敗にするのはライブ収集したデータ (シート・日次実績・ユーザー別プロファイル) の場合だけである。ネットワークに到達できない場合・レート制限の場合は **警告** とし、失敗にはしない（オフラインでも動作する）。`COPILOT_ALLOW_PUBLIC_DATA=true` で失敗を警告へ下げられる（リスクの明示的な受容。非推奨）。`--quick` はネットワークを使う検査を行わない。

定期実行ワークフローは、データを収集する **前** に `npm run fork:verify` を実行する。公開リポジトリが仮名化なしの実データの公開を始めることはできない。

### 5.4 プライバシー階層・発行プロファイル・保持期間 (P4-6)

発行物ごとに `aggregate-only` / `identified` を発行プロファイル（`src/domain/privacy-profile.ts`）に宣言し、その宣言を Pages のステージ設定と `pages:verify` / `fork:verify`（オフライン部分）で突き合わせる。これは §5.3 の公開範囲の検査に**加える**ものであり、置き換えない。`identified` のレポートは仮名化（§5.2）か、明示的な `COPILOT_ALLOW_IDENTIFIED_REPORTS=true` が必要で、`COPILOT_ALLOW_PUBLIC_DATA` はこのゲートを開けない。生データと利用者単位の監査データ（`raw/`、CSV 原本、`audit/seat-events/`）は既定で 60 か月後に期限切れとなり、明示的な `npm run retention:apply` でだけ削除される（先にドライラン。締め済みの月のスナップショットは保持）。詳細は [SDD-17 §7 / §8](17_audit_and_report_spec.ja.md)。

---

## 6. 48KB超マッピング向け GPG暗号化ワークアラウンド (オプション)

### 6.1 背景

第2章で示した通り、GitHub Secrets/Variables は個々の値につき **48KB (49,152バイト)** のサイズ上限がある。
全社員規模 (数百〜数千名) のマッピングをJSON形式 (推奨形式) で用意すると、この上限を容易に超過する。
本ワークアラウンドは [GitHub公式ドキュメントが案内する手法](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions#storing-large-secrets)
(ファイルをGPG暗号化してリポジトリにコミットし、パスフレーズのみをSecretとして保管する) を、
本プロジェクトの **Zero-Leakageアーキテクチャ** (コードブランチにはデータを一切含めない) に適合させたものである。
暗号化済みブロブは `main` / `fork/custom` などのコードブランチではなく、**データ専用の `copilot-data` オーファンブランチ**
にのみコミットする。

> 💡 この方式ではペイロードサイズの48KB上限が実質撤廃される。GitHub Secretに格納するのは
> 小さなパスフレーズのみであり、本体のマッピングデータ (暗号化済み) は `copilot-data` ブランチの
> Gitオブジェクトとして保管されるため、JSON形式 (推奨形式) をそのまま暗号化してよい。

### 6.2 対応ファイル形式

GPGによる暗号化/復号そのものは任意のファイル (バイト列) に適用できるため、**暗号化層に形式の制限はない**。
ただし、復号後のファイルは最終的に `COPILOT_USER_MAPPING_FILE` として `AttributeResolver`
(`src/collector/attribute-resolver.ts`) に渡され、実行時に解釈されるため、**復号後の中身**は
第3章で定義した以下のいずれかのスキーマに従う必要がある:

| 形式 | 詳細 | 備考 |
|---|---|---|
| JSON | 第3.1節 (`UserAttributeMapping` オブジェクトの配列) | 推奨形式 |
| CSV | 第3.2節 (ヘッダー行: `github_user,display_name,department,cost_center_override,notes,tags`) | 簡易設定用 |

`scripts/encrypt-user-mapping.ts` (暗号化前) と `scripts/decrypt-user-mapping.ts` (復号後) は、
それぞれ実行時にファイル内容を簡易判定し、検出したフォーマット・レコード数・`tags`フィールドの有無を
標準出力に表示する。これは参考情報のプレビューであり、実際のパース可否を最終決定するのは
`AttributeResolver` 自身である。上記2形式のいずれとしても認識できない場合は警告を表示するが、
暗号化/復号処理自体は中断されない (GPG層は形式非依存のため)。

### 6.3 セットアップ手順

1. **マッピングファイルをローカルで用意する** (第3章のJSON形式を推奨)。
2. **GPGで暗号化する**:
   ```bash
   npm run mapping:encrypt -- <入力ファイル> [出力ファイル] [--push] [--passphrase-env <VAR>]
   # 例:
   npm run mapping:encrypt -- _sensitive-data/copilot-user-mapping.draft.json
   ```
   既定ではGnuPGが対話的にパスフレーズの設定を求める（対称鍵暗号化 / AES256）。
   このパスフレーズは手順4で使用するため必ず控えること。
   `--push` を付けると、暗号化済みファイルを自動的に `data/config/<ファイル名>.gpg` として
   `copilot-data` ブランチへコミット&プッシュする（手順3を省略できる）。
   非対話/CI実行の場合は `--passphrase-env <ENV_VAR_NAME>` を指定すると、対話プロンプトの代わりに
   指定した環境変数の値をパスフレーズとして使用する (`mapping:decrypt` の同名オプションと同じ挙動)。
3. **(`--push` を使わない場合) 暗号化済みファイルを `copilot-data` ブランチにのみコミットする**。
   `main` / `fork/custom` などのコードブランチには**絶対にコミットしないこと**。
   ```bash
   npm run mapping:decrypt -- <暗号化ファイル.gpg> ./verify.json   # 任意: ローカルで復号確認
   ```
4. **パスフレーズをリポジトリ Secret として登録する** (値は小さいため48KB制限に抵触しない):
   ```bash
   gh secret set COPILOT_USER_MAPPING_PASSPHRASE
   ```
5. ワークフロー (`.github/workflows/copilot-analysis-cron.yml`) は実行のたびに以下を自動で行う:
   - `copilot-data` ブランチから `data/config/copilot-user-mapping.json.gpg` を復元
   - `COPILOT_USER_MAPPING_PASSPHRASE` を用いて `$RUNNER_TEMP` 配下に復号 (リポジトリには一切書き込まない)
   - `COPILOT_USER_MAPPING_FILE` 環境変数を自動設定し、パイプラインへ引き渡す

### 6.4 関連コマンド一覧

| コマンド | 用途 |
|---|---|
| `npm run mapping:encrypt -- <input> [output] [--push] [--passphrase-env <VAR>]` | マッピングファイルをGPG暗号化 (任意で `copilot-data` へ自動コミット&プッシュ、非対話CIモードも利用可) |
| `npm run mapping:decrypt -- <input.gpg> <output> [--passphrase-env <VAR>]` | 暗号化ファイルを復号 (CI向け非対話モード、またはローカル対話確認用) |

### 6.5 セキュリティ上の注意

- 暗号化済み `.gpg` ファイルは `copilot-data` ブランチ以外のブランチに **絶対にコミットしないこと**。
- 復号後の平文ファイルは `$RUNNER_TEMP` (ジョブ終了後にランナーごと破棄される一時領域) にのみ書き出され、
  リポジトリやアーティファクトとしては保存されない。
- パスフレーズは `COPILOT_USER_MAPPING_PASSPHRASE` という名前で Secret としてのみ登録し、
  ソースコードやログに出力しないこと。

---

## 7. DEMO環境専用の暗号化マッピングフィクスチャ (DEMO Mapping Fixture)

### 7.1 目的と背景
DEMO / Mock モード実行時や、公開フォーク環境において、本物の個人情報（PII）を一切含めることなく、リアルな「部署」「CostCenter」「Organization」「タグ」の分類・按分・予算対比を検証可能にする。

### 7.2 アーキテクチャと仕様
1. **リポジトリ内フィクスチャ**:
   - `fixtures/demo/copilot-user-mapping.demo.json.gpg`
   - 94名の合成モックユーザー（自動収集データ 85名 + Monthly Usage Report ユーザー）を完全網羅。
   - AES256 GPG対称暗号化（デフォルトパスフレーズ: `copilot-demo-secret-passphrase-2026`）。
2. **自動配置・デプロイ**:
   - `scripts/generate-demo-data.ts` 実行時に暗号化ファイルを `data/demo/config/` および `dashboard/public/data/demo/config/` へ自動配置。
3. **自動復号フォールバック**:
   - `src/cli/run-pipeline.ts` は `--mock` または `MOCK_DATA=true` 実行時、`COPILOT_USER_MAPPING` や `COPILOT_USER_MAPPING_FILE` が未指定の場合、`src/collector/demo-mapping-loader.ts` の `loadDemoUserMapping()` を自動呼出し。
   - `$TMPDIR` 配下に一時平文ファイルを安全に作成して `AttributeResolver` に引き渡すため、DEMOデータ生成時に全ユーザーが「未分類 (Unassigned)」にフォールバックすることなく、CostCenter / Organization / 部署に適切に仕訳される。

