# Walkthrough: View Registry (P2-4 / #184)

## Summary
`App.tsx` のビュー条件分岐を撤去し、`ViewHost` + View Registry を描画の唯一の入口にした。ビュー追加は `views/<id>/manifest.ts` + `View.tsx` の 2 ファイルで完結する。

## Verification Results
| Stage | Command | Result |
| :--- | :--- | :--- |
| Fork isolation | `npm run fork:verify` | ✅ |
| TypeScript | `npm run typecheck` | ✅ |
| Tests | `npm test` | ✅ 811 pass / 0 fail |
| Secret scan | `npm run secret-scan` | ✅ |
| Build | `npm run build` | ✅ |
| Lint | `npm run lint` | ✅ |

## Not verified
ブラウザでの目視確認（ビュー切替・遅延ロード表示）は未実施。描画は JSX 移設のみで、既存テスト（ソース検査）は移設先を読むよう更新した。
