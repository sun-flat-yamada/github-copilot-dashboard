# 実装計画: 月次レポート「総リクエスト数」カードの分布ミニグラフ追加とレイアウト最適化、AIC尺度明記 (#352)

月次レポートの **`総リクエスト数` カード (`report_kpi_requests`)** について、選択されたデータにおけるリクエスト数の分布状況を直感的に把握できる **分布ミニヒストグラム（ミニグラフ）** を追加し、カード内のレイアウトをコンパクトに最適化します。さらに、指標カタログおよびツールチップにおいて、物理呼出回数である「リクエスト数 (req)」とコンピュート消費量である「AI クレジット (AIC)」が異なる尺度であることを明記します。

---

## ユーザーレビュー必須事項 (User Review Required)

> [!IMPORTANT]
> - **分布ミニグラフの表現**:
>   - 選択中のデータ（`user_details`）で実績値（> 0）を持つアカウントのリクエスト数（または AIC 消費量）を 5 段階の階級（ビン: Min〜Max）に等分割し、各ビンの度数（人数）をバーの高さ（最大度数に対する比率）で表す軽量 SVG/HTML ミニヒストグラムを合計値の右横にコンパクトに配置します。
>   - 各バーへホバーすると、該当階級の数値範囲とアカウント数（例: `1〜25 req: 8名 (40%)`）がツールチップで表示されます。
> - **カード内レイアウトのコンパクト最適化**:
>   - 合計値と分布ミニグラフを横並び（`flex justify-between items-end`）に配置し、下部の統計セクション（利用アカウント数・最小値・中央値・最大値）を単一のまとまったマイクログリッド（`bg-slate-950/60`）へ集約してカード全体の高さを他の 3 枚の KPI カードと美しく調和させます。
> - **リクエスト数 vs AIC の尺度差異の明記**:
>   - `report_requests` 指標の定義ツールチップ (`MetricLabel`) において、`caveats` に「リクエスト数は物理的な API 呼出・対話実行回数を表し、AI クレジットはモデル種別やトークン規模に応じたコンピュート消費量を表す異なる尺度である」旨を追加明記します。

---

## 変更対象ファイル一覧 (Proposed Changes)

### 1. ユーティリティ & ドメイン層

#### [MODIFY] [dashboard/src/utils/accountStats.ts](../../../dashboard/src/utils/accountStats.ts)
- `DistributionBucket` インターフェースの追加:
  - `min: number`, `max: number`, `label: string`, `count: number`, `percentage: number`
- `computeDistributionBuckets(values, bucketCount = 5)` の追加:
  - 正の実績値（> 0）を対象に、最小値から最大値までの範囲を `bucketCount` 等分し、各階級に属するアカウント数と比率を算出。実績値がない場合は空配列、全値が同一の場合は単一バケットを生成。

#### [MODIFY] [src/domain/metrics/metric-registry.ts](../../../src/domain/metrics/metric-registry.ts)
- `report_requests` の `definition` を更新し、`caveats` にリクエスト数（物理呼出回数）と AIC（消費量）の尺度差異を明記。

### 2. UI コンポーネント層

#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `report_kpi_requests` カード内の中段レイアウトを改修:
  - 合計値（`text-2xl font-black`）と分布ミニグラフを `flex justify-between items-end` で横並び配置。
  - 分布ミニグラフ（`data-testid="report-requests-distribution"`）を描画。各バー（`distribution-bar-0`〜`4`）にタイトルツールチップを設定。
  - 単独（リクエストのみ / AIC のみ）および混在（リクエスト & AIC）時の双方で破綻しないコンパクトなグリッドレイアウトへ再設計。

### 3. 仕様書 & テスト

#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- Section 2.20 に分布ミニヒストグラムの仕様、コンパクトレイアウト仕様、リクエストと AIC の尺度差異ツールチップ仕様を追記。

#### [MODIFY] [docs/specifications/16_data_contract_and_metric_catalog_spec.ja.md](../../../docs/specifications/16_data_contract_and_metric_catalog_spec.ja.md)
- `report_requests` の定義および注意書き（caveats）の更新を反映。

#### [MODIFY] [src/tests/account-stats.test.ts](../../../src/tests/account-stats.test.ts)
- `computeDistributionBuckets` の単体テストを追加（空配列、同値、多峰性・偏りのあるデータ、階級範囲とパーセンテージの検証）。

#### [MODIFY] [src/tests/ui/monthly-report-requests-kpi.test.tsx](../../../src/tests/ui/monthly-report-requests-kpi.test.tsx)
- 分布ミニグラフの描画、バー本数、ツールチップ、およびレイアウト要素のテストを追加。

---

## 検証計画 (Verification Plan)

### 自動テスト & 品質ゲート
1. **単体テスト**:
   ```bash
   npx tsx --test src/tests/account-stats.test.ts src/tests/ui/monthly-report-requests-kpi.test.tsx src/tests/metric-catalog.test.ts
   ```
2. **品質ゲートフル実行**:
   ```bash
   npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
   ```
