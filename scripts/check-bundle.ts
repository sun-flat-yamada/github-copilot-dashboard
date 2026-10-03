/**
 * Bundle budget gate (run after `vite build`, wired into `npm run build`).
 *
 * - The main (entry) chunk must stay within the budget (default 300 kB, decimal like Vite's report).
 *   Override with BUNDLE_BUDGET_MAIN_KB (used by the tests to prove the gate fails).
 * - No emitted chunk may contain Node built-ins stubs (`__vite-browser-external`) or zod:
 *   server-side code and its validation must not reach the browser bundle.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const DEFAULT_MAIN_BUDGET_KB = 300;

/** Markers that only appear when zod / a Node built-in stub is bundled */
const FORBIDDEN_MARKERS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Node built-in stub (fs/path/...)', pattern: /__vite-browser-external/ },
  { label: 'zod', pattern: /\bZodError\b|\$ZodType\b|\bZodType\b/ },
];

export interface BundleReport {
  mainChunk: string | null;
  mainBytes: number;
  budgetBytes: number;
  errors: string[];
}

/** The entry script referenced from index.html (`<script type="module" src="...">`) */
export function findMainChunk(distDir: string): string | null {
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
  const tag = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/) ?? html.match(/<script[^>]*src="([^"]+)"[^>]*type="module"/);
  if (!tag) return null;
  return path.join(distDir, tag[1].replace(/^\.?\//, ''));
}

export function checkBundle(distDir: string, budgetKb = DEFAULT_MAIN_BUDGET_KB): BundleReport {
  const errors: string[] = [];
  const budgetBytes = budgetKb * 1000;
  const mainChunk = findMainChunk(distDir);
  let mainBytes = 0;

  if (!mainChunk || !fs.existsSync(mainChunk)) {
    errors.push('main chunk not found (dist/index.html has no module script)');
  } else {
    mainBytes = fs.statSync(mainChunk).size;
    if (mainBytes > budgetBytes) {
      errors.push(
        `main chunk ${path.basename(mainChunk)} is ${(mainBytes / 1000).toFixed(2)} kB, over the ${budgetKb} kB budget. ` +
          'Lazy-load heavy code (dynamic import) instead of raising the budget.'
      );
    }
  }

  const assetsDir = path.join(distDir, 'assets');
  const files = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js')) : [];
  for (const file of files) {
    const code = fs.readFileSync(path.join(assetsDir, file), 'utf-8');
    for (const { label, pattern } of FORBIDDEN_MARKERS) {
      if (pattern.test(code)) errors.push(`${file} contains ${label}; browser code must not import it`);
    }
  }

  return { mainChunk, mainBytes, budgetBytes, errors };
}

function main(): void {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('dist/ not found. Run `npm run build` first.');
    process.exit(1);
  }
  const budgetKb = Number(process.env.BUNDLE_BUDGET_MAIN_KB ?? DEFAULT_MAIN_BUDGET_KB);
  const report = checkBundle(distDir, budgetKb);
  console.log(`[bundle] main chunk: ${(report.mainBytes / 1000).toFixed(2)} kB / ${budgetKb} kB budget`);
  if (report.errors.length > 0) {
    for (const e of report.errors) console.error(`[bundle] ❌ ${e}`);
    process.exit(1);
  }
  console.log('[bundle] ✅ within budget, no fs/zod in the browser bundle');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main();
}
