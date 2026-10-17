# Walkthrough: テスト用 DEMO データのタグ情報バリエーション拡充 (#378)

## 概要 / Summary
テスト用 DEMO データ（2026.09 LTS）における Tag 情報のバリエーションを拡充しました。
従来は全ユーザーが「正社員/業務委託」＋「所属部署名タグ」の2種類しか持たず、複数タグの AND 掛け合わせ検索がほぼすべて0件になる問題や、タグ検索と部署フィルターの結果が同一になる問題がありました。
今回の変更により、雇用形態・勤務形態・技術スタック・役割・社内施策・部署の6軸にわたる33種類のタグが各ユーザーに2〜5個複合的に付与され、単一タグ検索および複数タグ AND 絞り込みが正常に検証可能となりました。

## 変更内容 / Changes Made
### DEMO マッピング & モック生成
- [scripts/generate-demo-mapping-gpg.ts](../../../scripts/generate-demo-mapping-gpg.ts):
  - 主要コアメンバー（7名）および月次レポートユーザー（9名）に技術・役割・勤務形態を多角的に付与。
  - developer-8〜85の78名に対して、雇用形態（正社員/業務委託/契約社員/インターン）、勤務形態（リモート/ハイブリッド/オンサイトを全社33%ずつ均等配分）、技術スタック（TypeScript/Python/Go/React/Kubernetes/SQL/iOS）、役割（テックリード/シニア/ジュニア/マネージャー）、全社施策（AI推進/社内DX/セキュリティ/コスト最適化）を体系的に付与。
- [src/collector/mock-generator.ts](../../../src/collector/mock-generator.ts):
  - `generateSampleUserMappings()` に多軸タグ定義を追加し、スタンドアロンモック生成環境でもタグが維持されるよう改善。
  - `generateUserUsageProfiles()` にて `mapped?.tags` をプロファイルに明示的に反映。
- [fixtures/demo/copilot-user-mapping.demo.json.gpg](../../../fixtures/demo/copilot-user-mapping.demo.json.gpg):
  - GPG暗号化フィクスチャを最新のマッピング定義で再生成。
- [data/demo/](../../../data/demo/) & [dashboard/public/data/demo/](../../../dashboard/public/data/demo/):
  - `npm run demo:generate` により月次、カスタム、日次、レポート、Deep Analysisの全パーティションを再生成。

### テスト検証
- [src/tests/demo-data.test.ts](../../../src/tests/demo-data.test.ts):
  - タグ総数（33種類 >= 15）の検証。
  - 主要技術・勤務形態・役割・施策タグの存在検証。
  - 部署横断タグ（TypeScript, Python, リモート等）が複数部署に跨って分布していることの検証。
  - 複数タグ AND 掛け合わせ絞り込み（TypeScript+正社員, リモート+Python, Go+SRE, テックリード+正社員等）が複数ヒットすることの検証。

## 検証結果 / Verification Results
### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean (Exit 0) |
| TypeScript Check | `npm run typecheck` | ✅ Pass (Exit 0) |
| Unit & Integration Tests | `npm test` | ✅ 1245/1245 Pass |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks (Exit 0) |
| Production Build | `npm run build` | ✅ Built in 1.97s (bundle 169.78 kB / 300 kB budget) |

### フィルター掛け合わせ検証結果
| 条件 | 該当人数 |
| :--- | :--- |
| `TypeScript` + `正社員` | 24名 |
| `TypeScript` + `リモート` | 11名 |
| `Python` + `AI推進` | 16名 |
| `Go` + `SRE` | 13名 |
| `Go` + `リモート` | 8名 |
| `テックリード` + `正社員` | 8名 |
| `シニア` + `リモート` | 9名 |
| `業務委託` + `リモート` | 6名 |
| `TypeScript` + `正社員` + `リモート` | 8名 |
| `Python` + `正社員` + `ハイブリッド` | 8名 |
