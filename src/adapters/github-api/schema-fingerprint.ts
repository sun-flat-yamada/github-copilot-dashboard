/**
 * API 応答のスキーマ指紋 (P1-4, A-09 / A-13)。
 *
 * 応答の「キーパスと型」だけを取り出す。値は一切保持しない (個人情報・トークンを残さない)。
 * 配列の要素はまとめて `[]` で表し、複数サンプルの和集合を取る。
 */
export type FingerprintType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

/** パス (例: `seats[].assignee.login`) → 観測した型 (昇順) */
export type SchemaFingerprint = Record<string, FingerprintType[]>;

function typeOf(value: unknown): FingerprintType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'object';
}

function walk(value: unknown, path: string, acc: Map<string, Set<FingerprintType>>): void {
  const type = typeOf(value);
  if (path) {
    let set = acc.get(path);
    if (!set) acc.set(path, (set = new Set()));
    set.add(type);
  }
  if (type === 'array') {
    for (const item of value as unknown[]) walk(item, `${path}[]`, acc);
  } else if (type === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      walk(child, path ? `${path}.${key}` : key, acc);
    }
  }
}

/** サンプル (応答本文や NDJSON の行) 群から指紋を作る。出力のキー順は決定的 */
export function fingerprintOf(samples: unknown[]): SchemaFingerprint {
  const acc = new Map<string, Set<FingerprintType>>();
  for (const sample of samples) walk(sample, '', acc);
  const out: SchemaFingerprint = {};
  for (const path of [...acc.keys()].sort()) out[path] = [...acc.get(path)!].sort();
  return out;
}

export interface FingerprintDrift {
  /** 実応答にあって基準に無いパス (API が項目を追加した) */
  added: string[];
  /** 基準にあって、どの実サンプルにも現れないパス (項目の削除、またはサンプルに現れなかった任意項目) */
  removed: string[];
  /** 実応答に、基準に無い型が現れたパス */
  typeChanged: Array<{ path: string; baseline: FingerprintType[]; live: FingerprintType[] }>;
}

export const hasDrift = (d: FingerprintDrift): boolean =>
  d.added.length + d.removed.length + d.typeChanged.length > 0;

/**
 * 基準 (フィクスチャ) と実応答の指紋を比較する。
 * 実応答の型が基準の部分集合なら差分としない (サンプルに null が現れなかっただけ、など)。
 */
export function diffFingerprints(baseline: SchemaFingerprint, live: SchemaFingerprint): FingerprintDrift {
  const added = Object.keys(live).filter((p) => !(p in baseline));
  const removed = Object.keys(baseline).filter((p) => !(p in live));
  const typeChanged: FingerprintDrift['typeChanged'] = [];
  for (const path of Object.keys(live)) {
    if (!(path in baseline)) continue;
    if (live[path].some((t) => !baseline[path].includes(t))) {
      typeChanged.push({ path, baseline: baseline[path], live: live[path] });
    }
  }
  return { added, removed, typeChanged };
}

/** Issue の重複起票を防ぐための、差分の短い識別子 (パスと型のみから作る) */
export function driftSignature(drift: FingerprintDrift): string {
  const text = JSON.stringify([drift.added, drift.removed, drift.typeChanged.map((t) => [t.path, t.live])]);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}
