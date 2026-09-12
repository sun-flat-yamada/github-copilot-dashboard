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

1. **優先度 1: `COPILOT_USER_MAPPING` (GitHub Secret または Variable)**
   - GitHub Actions 設定の `Variables` または `Secrets` に設定されたJSON文字列またはCSV文字列。
2. **優先度 2: `COPILOT_USER_MAPPING_BASE64` (オプション)**
   - 改行や特殊文字による破損を防ぐためのBase64エンコード済み文字列。
3. **優先度 3: 未設定時のフォールバック**
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
    "notes": "業務委託"
  }
]
```

### 3.2 CSV形式 (簡易設定用)

ヘッダー行付きのCSV形式も自動判別してパースする：

```csv
github_user,display_name,department,cost_center_override,notes
tanaka-taro,田中 太郎,決済プラットフォーム部,Platform-Engineering,正社員
sato-hanako,佐藤 花子,データサイエンス推進部,AI-and-Data-Platform,MLエンジニア
```

---

## 4. フィールド定義

| フィールド名 | 型 | 必須 | 説明 | デフォルト値 |
|---|---|---|---|---|
| `github_user` | string | ○ | GitHubのログインID (case-insensitive) | - |
| `display_name` | string | - | ダッシュボード上に表示する氏名・表記 | `github_user` と同一 |
| `department` | string | - | 任意指定の仕訳グループ名・部署名・プロジェクト名 | `"未分類 (Unassigned)"` |
| `cost_center_override` | string | - | GitHub APIのCost Centerを上書き指定する場合に設定 | API取得値を優先、無ければ `"デフォルトCostCenter"` |
| `notes` | string | - | 雇用形態やメモ情報 | `""` |

---

## 5. プライバシー保護・マスキング機能 (Anonymization Mode)

社外公開用GitHub Pagesや広範な閲覧権限を持つ環境向けに、環境変数 `ANONYMIZE_USERS=true` を設定することで、個人情報保護（PIIマスキング）を有効化できる：
- `github_user`: ハッシュ化（例: `user_a1b2c3`）
- `display_name`: イニシャル化（例: `T. T.`）
- `department`: そのまま保持、またはグループコードへの置換

これにより、GitHub Pagesが万が一パブリックに公開された場合でも個人の特定を防止する。
