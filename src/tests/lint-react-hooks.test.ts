import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { ESLint } from 'eslint';

/**
 * ESLint (react-hooks) の違反が無いことを `npm test` の一部として保証する。
 *
 * - rules-of-hooks: 早期 return の後でフックを呼ぶと、描画ごとにフック数が変わり画面全体が落ちる
 *   (CreditsView / AgentActivityView / AdoptionMaturityView / UserTrendViewer で実際に発生しうる状態だった)
 * - exhaustive-deps: 依存配列の漏れ (月次レポートの再集計がタグ以外のフィルター条件を依存に含めていなかった)
 *
 * 設定は eslint.config.js。意図的に依存を絞る箇所は `eslint-disable-next-line` と理由のコメントで明示する。
 */
describe('ESLint: React Hooks rules (P0-6)', () => {
  it('dashboard sources have no rules-of-hooks / exhaustive-deps violations', async () => {
    const root = path.resolve(import.meta.dirname, '../..');
    const eslint = new ESLint({ cwd: root });
    const results = await eslint.lintFiles(['dashboard/src/**/*.{ts,tsx}']);

    const problems = results.flatMap((result) =>
      result.messages.map(
        (m) => `${path.relative(root, result.filePath)}:${m.line}:${m.column} [${m.ruleId ?? 'parse'}] ${m.message}`
      )
    );
    assert.deepEqual(problems, [], `ESLint reported problems:\n${problems.join('\n')}`);
    assert.ok(results.length > 50, 'the lint run must actually cover the dashboard sources');
  });
});
