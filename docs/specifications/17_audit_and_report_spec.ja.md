[English](17_audit_and_report_spec.md) | [日本語](17_audit_and_report_spec.ja.md)

---

# SDD-17: 監査 & レポート仕様書 (Audit & Report Specification)

- **文書番号**: SPEC-COPILOT-017
- **ステータス**: Approved / Active（Phase 4 に合わせて拡張。P4-2〜P4-6 で節を追加する）
- **対象バージョン**: 2026.10
- **作成日**: 2026-10-04 (P4-1 / #197: 監査・データ品質ビュー)
- **関連**: [SDD-05 §2.3 / §2.5](05_data_storage_and_fork_isolation_spec.ja.md)、[SDD-07 §2.19](07_dashboard_ui_ux_spec.ja.md)、[SDD-16 データ契約 & 指標カタログ](16_data_contract_and_metric_catalog_spec.ja.md)

---

## 1. 目的と監査要件

ダッシュボードは社内で Copilot の費用と利用状況を説明するために使う。運用者が「データが最後に更新されたのはいつか、どのソースが失敗したか、品質がいつ悪化したか」に答えられなければならない。オーナーが決定した要件（2026-10-01）:

| 項目 | 決定 | 状態 |
|:--|:--|:--|
| 月次締め | 翌月 5 営業日 | ここで定義。実装は P4-2 |
| 締め後の改訂 | 履歴付きで可 | P4-2 |
| 生データの保持 | 5 年（60 か月）。`data_retention` の既定は 60 か月 | P4-6 |
| 個人情報 | 監査画面と出力は件数・日付・ソース名のみ | P4-1（本書 §2） |

## 2. 監査・データ品質ビュー (P4-1 / E-01)

| 情報 | 出典 | 生成箇所 |
|:--|:--|:--|
| ソース別の状態・取得件数・隔離・最終試行・最終成功 | `index.json` `source_status` | `PipelineOrchestrator`（SDD-05 §2.3 / SDD-02） |
| 最新の品質レベル・トレンド・レベルが変わった時刻 | `index.json` `data_quality` | `summarizeQualityHistory`（SDD-05 §2.5） |
| 実行別の履歴: `run_id`・時刻・ソース別ステータス・欠損日・重複・範囲外・隔離・不正行 | `quality/history.json`（最大 90 件、新しいものが末尾） | `buildDataQualityReport` / `appendQualityHistory`（SDD-05 §2.5） |

- **Run Manifest 本体を読まない理由**: `raw/landing/` にあり、生の応答のリクエストキーと内容ハッシュを含む。`raw/` は公開しない（`pages:stage` の許可リスト、`pages:verify`）。公開済みの品質レポートが同じ `run_id` を持つため、運用者は画面から `copilot-data` の Run Manifest を特定できる。
- **表示規約**: SDD-07 §2.19。取得できないデータは **「—（理由）」** で表示し、0 や空の表にしない。デモデータは実行履歴を持たず、その旨を表示する。
- **個人情報なし**: これらのファイルに保存され画面に出るのは、件数・日付・ソース名のみ。
- ビューは manifest とコンポーネントで登録する（View Registry、SDD-07 §2.14b）。`App.tsx` やナビゲーションの変更は不要。

## 3. 今後追加する節（未仕様）

月次締めと改訂履歴（P4-2）、シート監査イベントと CSV 出力（P4-3）、請求突合（P4-4）、定義駆動レポート（P4-5）、プライバシー階層と保持期間ポリシー（P4-6）は、各タスクの実装時に本書へ追記する。
