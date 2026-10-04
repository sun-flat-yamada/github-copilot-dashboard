import type { RevisionRequest } from '../application/pipeline/month-close.js';

export interface ReprocessArgs {
  runId?: string;
  revision?: RevisionRequest;
}

function valueOf(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  if (!v || v.startsWith('--')) throw new Error(`${flag} requires a value`);
  return v;
}

/** `pipeline:reprocess` の引数。--revise は理由 (--reason) が必須で、月は YYYY-MM */
export function parseReprocessArgs(argv: string[]): ReprocessArgs {
  const runId = valueOf(argv, '--run');
  const months: string[] = [];
  argv.forEach((a, i) => {
    if (a !== '--revise') return;
    const m = argv[i + 1];
    if (!m || !/^\d{4}-\d{2}$/.test(m)) throw new Error('--revise requires a month in YYYY-MM format');
    months.push(m);
  });
  const reason = valueOf(argv, '--reason');
  const actor = valueOf(argv, '--actor');
  if (months.length === 0) {
    if (reason || actor) throw new Error('--reason / --actor are only valid together with --revise <YYYY-MM>');
    return { runId };
  }
  if (!reason || !reason.trim()) throw new Error('--revise requires --reason "<why the closed figures change>"');
  return { runId, revision: { months: [...new Set(months)], reason: reason.trim(), ...(actor ? { actor } : {}) } };
}
