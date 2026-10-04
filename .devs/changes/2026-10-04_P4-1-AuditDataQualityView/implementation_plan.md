# 「監査・データ品質」ビュー（Run Manifest・ソース状態・品質チェック履歴）(P4-1 / #197)

親 Issue: #175（Phase 4）。指摘 E-01（実行履歴・ソース別状態・品質履歴を見る画面が無く、データがいつ・なぜ悪化したか追えない）を解消する。前提 P1-2（Run Manifest）/ P1-7（品質履歴）/ P2-4（View Registry）はマージ済み。

## User Review Required
> [!NOTE]
> Auto-Pilot on のため承認待ちなしで進める。スコープは Issue の 4 点（ビューと「—（理由）」表示 / Playwright スモーク / SDD-07・SDD-17 の日英同期 / 品質ゲート）に限定する。

> [!WARNING]
> Run Manifest 本体（`raw/landing/manifests/`）は公開しない（SDD-05 §2.3、`pages:verify` が `raw/` を禁止）。ビューが扱うのは公開配信済みの `quality/history.json`（`run_id`・時刻・ソース別ステータス・件数・日付のみ）と `index.json`（`source_status` / `data_quality` / `run`）に限る。`pages-staging.ts` の allow-list・`fork:verify`・`secret-scan` は変更しない。個人情報（ログイン名・値）は表示しない。

## Proposed Changes
### データ取得
#### [MODIFY] `dashboard/src/dataset/datasetLoader.ts`
- `loadQualityHistoryDataset(baseDir)`: `quality/history.json` を `getCandidateDataUrls` で取得（反対モードへは暗黙に切り替えない。失敗は `failed` + 理由）。

### ビュー（View Registry）
#### [NEW] `dashboard/src/views/audit/manifest.ts` / `View.tsx`
- manifest + コンポーネントの 2 ファイルだけで登録（App.tsx / ナビは変更しない）。`order: 100`、データ非依存（`requiredDatasets: []`）。
#### [NEW] `dashboard/src/components/AuditDataQualityPanel.tsx`
- 純関数 `buildAuditModel(index, history)` と表示。
- 最終成功時刻（ソース別 `last_success_at`、最新の品質レベルと悪化・回復の起点）、ソース状態一覧、実行履歴（実行 ID・時刻・ソース別ステータス・レベル）、品質チェック履歴（欠損日・重複・範囲外・隔離・不正行の件数）。
- 取得不能・履歴無しは 0 や空欄にせず「—（理由）」。DEMO は履歴を作らない（モックでは記録しない）ため「—（デモデータには実行履歴がありません）」。
#### [MODIFY] `ViewNavigation.tsx`
- アイコン `ShieldCheck` を `ICON_MAP` に追加。

### テスト・文書
- 単体/RTL: モデル構築（最新・悪化起点・欠損）、「—（理由）」の各分岐、manifest が Registry に現れること、個人情報の非表示。
- Playwright スモーク: 監査ビューへ遷移して見出しと状態表示を確認。
- SDD-07（§ 監査・データ品質ビュー、EN/JA）、新規 SDD-17（監査 & レポート。本 Issue の範囲と月次締め等の既定値、EN/JA）、README 索引（EN/JA）。
