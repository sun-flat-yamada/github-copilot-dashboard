# Task: ユーザー明細の統一と、ライブ側への使用量列の追加

- [x] Phase 1: Issue Definition & Scoping — Issue は未作成（作業環境から GitHub の GraphQL に到達できないため。PR 本文に概要を記載）
- [x] Phase 2: Implementation Plan（ユーザーの明示的な実装指示を承認として進行）
- [x] Phase 3: Implementation
  - [x] 公式情報（github/docs 最新）の調査と、ダミーデータ・仕様書への反映
  - [x] 行モデル `UserDetailRow` とアダプタ（ライブ / 月次）、ライブの兆候（日別履歴から）
  - [x] `UserDetailTable` に統合、`MonthlyReportUserTable` を削除、全呼び出し箇所を置換
  - [x] 既存の構造テスト 5 本を統合後の形に更新、新規テスト追加
  - [x] 実ブラウザでの確認（ライブ / ダミー CSV）と修正（見出しの二重括弧、リクエストの 0 / 不明、パネルの見出し）
- [x] Phase 4: Local Quality Gate & Specification Sync（SDD-07 §2.16、SDD-09 §3.5 ほか、英日）
- [x] Phase 5: Walkthrough
- [/] Phase 6: Rebase onto Base & Create PR
- [ ] Phase 7: Rebase & Merge and Worktree Cleanup（自動マージは行わない。下記 walkthrough 参照）
