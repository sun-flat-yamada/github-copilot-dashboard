# Walkthrough: SDD 最終同期 (P4-7 / #203)

## 同期確認の結果

SDD-17 §9.1 に一覧を載せた。修正したもの:

| 文書 | 食い違い | 対応 |
|:--|:--|:--|
| SDD-16 | カタログ表に `adoption_unclassified_users` / `yoy_spend_change` / `yoy_active_seats_change` が無かった | 追加（28 件が `metric-registry.ts` と一致） |
| SDD-16 | 「データ契約」の記述が無かった | §7 に契約の索引を追加 |
| SDD-05 | `raw/` が `*-metrics.json` 等と記載。実装は `YYYY-MM-DD-raw.json` | 修正 |
| SDD-05 | 「無期限に蓄積」 | 保持ポリシー (60 か月) に合わせた |
| SDD-08 | 為替・請求 Issue・レポート生成・保持ドライランのステップ、変数、`issues: write` が欠落 | 追加 |
| SDD-17 §1 | 個人情報の行が P4-1 のまま | §4.3 / §7 / §8 への参照を追加 |
| SDD-07 | About の保持期間表示が旧フィールドである旨が無い | 明記 |

確認のみで差分なし: SDD-02 / 03 / 04 / 06 / 10 / 11 / 15（SDD-06 は P4-6 に無関係）。

## 判断

- `index.json` の `data_retention_days: 365`: 表示値の変更はコード・型・多数のテストフィクスチャに及ぶため、文書化 (SDD-17 §8.1、SDD-05 §3、SDD-07) にとどめ、別 Issue とした。
- `dashboard/src/data/models.ts` の記述 (`.agents/rules/`、`AGENTS.md`): SDD の範囲外。別 Issue とした。

## 品質ゲート

fork:verify、typecheck、test、secret-scan、build、lint がすべて成功（rebase 後にも再実行）。
