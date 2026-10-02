# Task: ユーザー明細への使用量可視化の追加

- [/] Phase 1: Issue Definition & Scoping — 計画の承認後に Issue を作成する
- [/] Phase 2: Implementation Plan 作成済み。**承認待ち（判断 1〜3 の回答が必要）**
  - [ ] 判断 1: 実 CSV のヘッダー行（トークン列の有無・列名）を確認
  - [ ] 判断 2: 兆候の扱い（推奨案 / 実測のみ / 別ソース調査）
  - [ ] 判断 3: 閾値の置き方（組織内の相対値を既定にするか）
- [ ] Phase 3: Implementation（承認後）
  - [ ] U0: 取り込みとデータ契約（トークン別名、`usage_insight` 型、モック CSV のパターン）
  - [ ] U1: 計算の純関数と定義、テスト、実データ/モックで閾値確定
  - [ ] U2: 明細テーブル・ドリルダウン・バッジ・フィルター・CSV エクスポート
  - [ ] U3: 仕様書（SDD-03 / 06 / 07 / 09、英日）の同期
- [ ] Phase 4: Local Quality Gate (`npm run fork:verify && npm run typecheck && npm test && npm run secret-scan && npm run build`)
- [ ] Phase 5: Walkthrough（閾値の分布確認結果とスクリーンショットを含める）
- [ ] Phase 6: PR / Phase 7: Rebase & Merge
