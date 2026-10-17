# 実装計画: 月次レポート「総リクエスト数」カードの分布グラフサイズ適正化と最小・中央・最大直感対応レイアウト (#359)

月次レポートの **`総リクエスト数` カード (`report_kpi_requests`)** について、ユーザーフィードバックに基づき、小さすぎて見づらかった分布グラフをカード全幅の視認性の高い適正サイズ（高さ 40px、横幅均等バー）に拡大し、バー上に度数（人数）を直接表示します。さらに、分布ヒストグラムの真下に X 軸目盛り線と【最小値（左端）】【中央値（中央強調）】【最大値（右端）】を配置することで、分布の山や偏りと統計代表値との位置関係が一目で直感的に把握できるレイアウトへ刷新します。

---

## ユーザーレビュー必須事項 (User Review Required)

> [!IMPORTANT]
> - **分布グラフのサイズ適正化**:
>   - 従来の 24px 極小サイズから、カードの横幅をフルに活用する 5 本の均等バー（高さ 40px、`h-10`）へ拡大します。
>   - 各バーの上部または内部に度数（人数: 例 `3`、`8` 等）を直接数値表示し、ツールチップを開かなくても各階級のボリュームが一目で分かるようにします。
> - **最小・中央・最大値と直感対応した目盛り軸レイアウト**:
>   - 分布ヒストグラムの直下に X 軸ラインを配置し、その下に対応する代表値を配置:
>     - **左端**: 「最小 [数値]」（分布の開始地点）
>     - **中央**: 「中央値 [数値]」（インディゴ/アンバーの強調バッジ、分布の中央目安）
>     - **右端**: 「最大 [数値]」（分布の終了地点）
>   - これにより、データのロングテールや中央値への偏り・分散が、グラフの形状と統計値の対応関係として直感的に理解できるようになります。
> - **既存 testid との完全互換性**:
>   - `report-requests-distribution`, `distribution-bar-*`, `report-requests-min`, `report-requests-median`, `report-requests-max`, `report-credits-*` をすべて保持します。

---

## 変更対象ファイル一覧 (Proposed Changes)

### 1. UI コンポーネント層

#### [MODIFY] [dashboard/src/components/monthly-report/MonthlyReportKpis.tsx](../../../dashboard/src/components/monthly-report/MonthlyReportKpis.tsx)
- `DistributionMiniHistogram` を一体型分布チャートコンポーネントへ拡張・再設計:
  - バーのサイズを拡大（高さ 40px、横幅均等 `flex-1`）。
  - バー上部に度数（人数）を直接数値表示。
  - バー直下に X 軸目盛りライン、および左端（最小値）・中央（中央値）・右端（最大値）を直感的に配置。
- `report_kpi_requests` カード全体のレイアウト調整:
  - 上段: ヘッダー + バッジ + アイコン
  - 中段: 合計値 + 利用アカウント数（横並び）
  - 下段: 分布ヒストグラム ＋ 最小・中央・最大目盛り軸ブロック

### 2. 仕様書 & テスト

#### [MODIFY] [docs/specifications/07_dashboard_ui_ux_spec.ja.md](../../../docs/specifications/07_dashboard_ui_ux_spec.ja.md) & [docs/specifications/07_dashboard_ui_ux_spec.md](../../../docs/specifications/07_dashboard_ui_ux_spec.md)
- Section 2.20 に適正サイズ拡大、バー上度数表示、および最小・中央・最大目盛り軸レイアウトの仕様を更新。

#### [MODIFY] [src/tests/ui/monthly-report-requests-kpi.test.tsx](../../../src/tests/ui/monthly-report-requests-kpi.test.tsx)
- 拡大されたバーの度数表示、X軸目盛り数値、および代表値配置の UI テストを検証・更新。

---

## 検証計画 (Verification Plan)

### 自動テスト & 品質ゲート
1. **単体テスト & UI テスト**:
   ```bash
   npx tsx --test src/tests/account-stats.test.ts src/tests/ui/monthly-report-requests-kpi.test.tsx
   ```
2. **品質ゲートフル実行**:
   ```bash
   npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build
   ```
