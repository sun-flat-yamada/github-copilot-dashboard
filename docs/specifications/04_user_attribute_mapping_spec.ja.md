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

ヘッダー行付きのCSV形式も自動判別してパースする：

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

---

## 5. プライバシー保護・マスキング機能 (Anonymization Mode)

社外公開用GitHub Pagesや広範な閲覧権限を持つ環境向けに、環境変数 `ANONYMIZE_USERS=true` を設定することで、個人情報保護（PIIマスキング）を有効化できる：
- `github_user`: ハッシュ化（例: `user_a1b2c3`）
- `display_name`: イニシャル化（例: `T. T.`）
- `department`: そのまま保持、またはグループコードへの置換

これにより、GitHub Pagesが万が一パブリックに公開された場合でも個人の特定を防止する。

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
   npm run mapping:encrypt -- <入力ファイル> [出力ファイル] [--push]
   # 例:
   npm run mapping:encrypt -- _sensitive-data/copilot-user-mapping.draft.json
   ```
   実行するとGnuPGが対話的にパスフレーズの設定を求める（対称鍵暗号化 / AES256）。
   このパスフレーズは手順4で使用するため必ず控えること。
   `--push` を付けると、暗号化済みファイルを自動的に `data/config/<ファイル名>.gpg` として
   `copilot-data` ブランチへコミット&プッシュする（手順3を省略できる）。
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
| `npm run mapping:encrypt -- <input> [output] [--push]` | マッピングファイルをGPG暗号化 (任意で `copilot-data` へ自動コミット&プッシュ) |
| `npm run mapping:decrypt -- <input.gpg> <output> [--passphrase-env <VAR>]` | 暗号化ファイルを復号 (CI向け非対話モード、またはローカル対話確認用) |

### 6.5 セキュリティ上の注意

- 暗号化済み `.gpg` ファイルは `copilot-data` ブランチ以外のブランチに **絶対にコミットしないこと**。
- 復号後の平文ファイルは `$RUNNER_TEMP` (ジョブ終了後にランナーごと破棄される一時領域) にのみ書き出され、
  リポジトリやアーティファクトとしては保存されない。
- パスフレーズは `COPILOT_USER_MAPPING_PASSPHRASE` という名前で Secret としてのみ登録し、
  ソースコードやログに出力しないこと。
