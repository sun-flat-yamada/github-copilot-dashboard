# 実装計画: テスト用 DEMO データのタグ情報バリエーション拡充 (#378)

## 目的
テスト用 DEMO データにおける Tag 情報のバリエーションを拡充し、ダッシュボードでのタグ単一選択・複数タグ AND 掛け合わせ絞り込み・部署横断フィルタリングの挙動を確実に確認できるようにする。

## 背景と課題
現在提供されている DEMO データ（2026.09 LTS）では、85名の全ユーザーに「正社員/業務委託」＋「所属部署名に対応するタグ1つ」のみが一律付与されている。
1. **部署との完全結合**: タグが所属部署（Gr）と1対1に固定されており、タグで絞り込んでも部署フィルターと結果が同一になり、タグ固有の横断的フィルタリングが検証できない。
2. **複数タグ AND 選択の破綻**: 各ユーザーが最大2タグ（雇用形態＋部署名）しか持たないため、例えば「リモート」×「決済」や「TypeScript」×「正社員」など、日常的なタグ掛け合わせを行うとほぼ全ての組み合わせで該当0件（該当なし）となる。
3. **技術・職能・勤務形態タグの欠落**: 開発現場でCopilotを活用する主要スタック（TypeScript, Python, Go, React, Kubernetes等）や、役割（テックリード, シニア, ジュニア等）、勤務形態（リモート, ハイブリッド, オンサイト）のバリエーションが不足している。
4. **モック生成フォールバック時の欠落**: `src/collector/mock-generator.ts` の `generateSampleUserMappings()` に `tags` 定義が存在せず、GPG復号を伴わない単体テスト・モック実行時にタグ情報が欠落する。

## 変更内容
### 1. DEMO ユーザーマッピング生成の拡充 (`scripts/generate-demo-mapping-gpg.ts`)
- `buildDemoUserMappings()` を改修し、以下の多軸タグをユーザーごとに2〜5個複合的に付与:
  - **雇用形態**: `正社員`, `業務委託`, `契約社員`, `インターン`
  - **勤務形態**: `リモート`, `ハイブリッド`, `オンサイト`（特定部署に偏らず全社に配分）
  - **技術スタック**: `TypeScript`, `Python`, `Go`, `React`, `iOS`, `Kubernetes`, `SQL` 等
  - **役割・等級**: `テックリード`, `シニア`, `ジュニア`, `マネージャー`, `エキスパート`
  - **社内施策**: `AI推進`, `社内DX`, `セキュリティ`, `コスト最適化`
  - **部署関連（既存互換）**: `決済`, `SRE`, `インフラ`, `モバイル`, `データ基盤`, `リード` 等（既存テスト・定義の後方互換性を完全維持）
- 部署を跨いだタグ分布により、同一タグ（例: `TypeScript`, `Go`, `リモート`）で複数部署のユーザーがヒットするように設計。
- 複数タグの AND 組み合わせ（例: `['正社員', 'TypeScript']`, `['リモート', 'Go']`, `['AI推進', 'Python']`）で複数名が抽出されるよう担保。

### 2. スタンドアロンモック生成のタグ同期 (`src/collector/mock-generator.ts`)
- `generateSampleUserMappings()` の7名に `tags` 配列を定義し、GPG非依存環境でもタグ付きモックが生成されるよう同期。
- `generateUserUsageProfiles()` で `mapped?.tags` を `UserUsageProfile.tags` に正しく反映。

### 3. DEMO データセット再生成 (`scripts/generate-demo-data.ts`)
- `fixtures/demo/copilot-user-mapping.demo.json.gpg` を更新。
- `npm run demo:generate` を実行し、`data/demo/` および `dashboard/public/data/demo/` の月次、カスタム、日次、レポート、Deep Analysis データを一貫性を持って再生成。

### 4. テスト検証 (`src/tests/demo-data.test.ts`)
- タグの多様性（ユニーク数 >= 15）の検証。
- 部署横断タグ（複数部署に属する共通タグ）の存在検証。
- 複数タグ AND 検索で 2名以上ヒットする実用的な組み合わせの検証。

## 影響範囲
- 既存の DEMO データ検証テスト（`src/tests/demo-data.test.ts`）
- `data/demo/` および `dashboard/public/data/demo/` の成果物（git管理対象外のためワークツリー汚染なし）
- GPGフィクスチャ `fixtures/demo/copilot-user-mapping.demo.json.gpg`

## 検証計画
### 自動テスト
- `npm test -- src/tests/demo-data.test.ts`
- `npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`
