# Walkthrough: ユーザー明細への使用量可視化の追加

## Summary

月次レポートのユーザー明細に、使用量・トークン・単価・長大化の兆候を追加した。公式の Billing reports reference で、AI usage report が `input` / `output` / `cache_read` / `cache_write` を `date × model × username` 単位で持つことを確認し、取り込みと指標をそれに合わせた。セッションの長さと話題の混在は、どのデータにも無いため断定せず、「特記なし / 参考 / 確認を推奨 / データ不足」の兆候（推定）として出す。表現は確認を勧める温度感にした。

## Changes Made

### 取り込みとデータ契約
- `src/processor/report-parser.ts`: token 4 列の取り込み、重複判定への反映、`unit_type` の無い AI usage 行の `quantity` をリクエスト数に混ぜない分類（`classifyRecordUnit`）、ユーザー行への `usage_insight` 付与（組織基準は全ユーザーから、表示フィルターの前に算出）。
- `src/domain/entities/copilot.ts`: `UsageInsight`、`UsageSignal`、`SignalLevel` ほか。

### 計算と定義（純関数）
- `src/processor/usage-insight.ts`: 使用量・トークン・単価（分母と同じ種類の明細の費用だけで割る。シート行は混ぜない）、兆候 S1〜S5、組織基準。
- `src/processor/usage-insight-definitions.ts`: 閾値、文言、注記、根拠文。

### 表示
- `MonthlyReportUserTable.tsx`: 列（トークン / コスト/100 万トークン / 兆候）、並べ替え、「確認を推奨のみ」、CSV。
- `monthly-report/UsageInsightPanel.tsx`、`common/UsageSignalBadge.tsx`: 使用量と効率、根拠、助言、日別グラフ、常設注記。

### デモデータ
- `src/collector/mock-generator.ts`: `generateAiUsageReportCSV`（典型パターン 8 種。決定的）。

### 仕様書（英日）
- SDD-03（トークンとセッション粒度が無いこと）、SDD-06 §5、SDD-07 §2.15、SDD-09 §3.5。

## Verification Results

### Automated Quality Gates
| Stage | Command | Result |
| :--- | :--- | :--- |
| Code-Data Decoupling | `npm run fork:verify` | ✅ Clean |
| TypeScript Check | `npm run typecheck` | ✅ Pass |
| Unit & Integration Tests | `npm test` | ✅ 703/703 Pass（追加: `processor/usage-insight.test.ts` 19、`usage-insight-ui.test.ts` 4） |
| Zero Secret / PII Scan | `npm run secret-scan` | ✅ 0 Leaks |
| Production Build | `npm run build` | ✅ Built |

最終コミット後にもう一度ゲート全体を実行した結果は PR に記載する。

### 確認できていないこと
- **実ファイルでの確認**: AI usage report の `quantity` の単位（クレジットと仮定）。実 CSV での閾値の分布。
- **実ブラウザでの目視確認**: 未実施。表示は、サーバーレンダリングによる挙動テスト（文言・注記・「—」の理由・データ不足）と型・ビルドで確認した。
- **ライブ経路**（`UserDetailTable`）には未対応。
- 公式ドキュメントは `docs.github.com` に到達できなかったため、`github/docs` リポジトリの原稿を読んだ。公開ページより先行している可能性がある。
