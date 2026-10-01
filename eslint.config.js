// ESLint (flat config) — 現時点の目的は React Hooks の規則違反を機械的に検出すること。
//
// - react-hooks/rules-of-hooks: 条件分岐・早期 return の後でフックを呼ぶと、描画ごとにフック数が変わり
//   「Rendered fewer hooks than expected」で画面全体が落ちる。
// - react-hooks/exhaustive-deps: 依存配列の漏れ。useDashboardData の月次レポート再集計が `[activeReportData, selectedTags]`
//   (タグ以外のフィルター条件を依存に含めない) だったため、Cost Center / Org / 部署の変更が KPI に反映されなかった。
//
// TypeScript の構文解析は Babel (preset-typescript) で行う。このリポジトリは TypeScript 7 (ネイティブ版) を使っており、
// typescript-eslint が必要とする JS API (createProgram 等) が提供されないため、typescript-eslint は使えない。
// 型付きの lint ルール (no-floating-promises 等) を導入する場合は、パーサーの選定を ADR で決める (計画書 Phase 2 / P2-6)。
import babelParser from '@babel/eslint-parser';
import reactHooks from 'eslint-plugin-react-hooks';

const sharedRules = {
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'error',
};

const parserFor = (isTSX) => ({
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      babelrc: false,
      configFile: false,
      presets: [
        ['@babel/preset-typescript', { isTSX, allExtensions: true }],
        ['@babel/preset-react', { runtime: 'automatic' }],
      ],
    },
  },
});

export default [
  { ignores: ['dist/**', 'node_modules/**', 'data/**', 'dashboard/public/**', '.devs/**'] },
  {
    files: ['dashboard/src/**/*.tsx'],
    languageOptions: parserFor(true),
    plugins: { 'react-hooks': reactHooks },
    rules: sharedRules,
  },
  {
    files: ['dashboard/src/**/*.ts'],
    languageOptions: parserFor(false),
    plugins: { 'react-hooks': reactHooks },
    rules: sharedRules,
  },
];
