# 実装計画: SDD 最終同期 (P4-7 / #203)

## 目的

Phase 1〜4 の実装後に、SDD-16 / SDD-17 と関連 SDD を実装と突き合わせ、食い違いを解消または Issue 化する。文書のみの変更（コード・テストは触らない）。

## 範囲

- SDD-16: カタログ表を `METRIC_REGISTRY` の全 28 件に揃える（欠けていた 3 件を追加）。データ契約の索引（§7）を追加。
- SDD-17: §1 の個人情報の行に §4.3 / §7 への参照を追加。§9 を「同期状況と既知の差分」にする。
- SDD-08: 為替・請求 Issue・レポート生成・保持期間ドライランのステップ、変数 4 件、`issues: write` を追加。
- SDD-05: `raw/` のレイアウトを実装（`YYYY-MM-DD-raw.json`）に合わせる。「無期限」の記述を保持ポリシーに合わせる。`data_retention_days` を旧表示値と明記。
- SDD-07: About モーダルの保持期間が旧フィールドである旨を明記。
- README（索引）の SDD-16 / SDD-17 の説明を更新。日英を同期。

## 範囲外（別 Issue）

- `data_retention_days` の表示値の整合（コード・型・テストに及ぶ）。
- `.agents/rules/model-benchmark-management.md` / `AGENTS.md` の存在しない `dashboard/src/data/models.ts` の記述。

## 検証

- カタログ表の id 集合と `metric-registry.ts` の一致を機械的に確認。
- 品質ゲート + lint。
