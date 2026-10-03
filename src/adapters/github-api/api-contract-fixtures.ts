import fs from 'node:fs';
import path from 'node:path';
import { fingerprintOf, SchemaFingerprint } from './schema-fingerprint.js';

/**
 * 契約テストとスキーマドリフト検知が共有する、匿名化した録画フィクスチャ (`fixtures/api-contract/`)。
 * 実名・トークンは含めない。API の既知の形を固定する基準であり、形が変わったら更新する
 * (`npm run schema:drift -- --update-baseline`)。
 */
export const CONTRACT_DIR = path.resolve('fixtures/api-contract');
export const CONTRACT_SOURCES = ['users-1-day', 'seats', 'cost-centers'] as const;
export type ContractSource = (typeof CONTRACT_SOURCES)[number];

export const loadContractSample = (source: ContractSource): unknown =>
  JSON.parse(fs.readFileSync(path.join(CONTRACT_DIR, `${source}.sample.json`), 'utf8'));

/** 応答本文 → 指紋を取る単位 (users-1-day は NDJSON の行ごと) */
export function samplesOf(source: ContractSource, body: unknown): unknown[] {
  return source === 'users-1-day' && Array.isArray(body) ? body : [body];
}

export function fixtureFingerprints(): Record<ContractSource, SchemaFingerprint> {
  const out = {} as Record<ContractSource, SchemaFingerprint>;
  for (const source of CONTRACT_SOURCES) out[source] = fingerprintOf(samplesOf(source, loadContractSample(source)));
  return out;
}

export const baselinePath = (): string => path.join(CONTRACT_DIR, 'fingerprints.json');

export function loadBaseline(): Record<ContractSource, SchemaFingerprint> {
  return JSON.parse(fs.readFileSync(baselinePath(), 'utf8'));
}
