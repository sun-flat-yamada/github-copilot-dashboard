import fs from 'node:fs';
import { RawApiFetcher, resolveGitHubToken } from '../src/adapters/github-api/RawApiFetcher.js';
import { reportWindowDays, ReportScope } from '../src/adapters/github-api/usage-reports/UsageReportsClient.js';
import { diffFingerprints, driftSignature, fingerprintOf, hasDrift, FingerprintDrift } from '../src/adapters/github-api/schema-fingerprint.js';
import {
  CONTRACT_SOURCES,
  ContractSource,
  baselinePath,
  fixtureFingerprints,
  loadBaseline,
  samplesOf,
} from '../src/adapters/github-api/api-contract-fixtures.js';

/**
 * 実 API のスキーマ指紋を、フィクスチャ側の基準と比較する (P1-4)。
 *
 *   npm run schema:drift                        実 API と比較 (COPILOT_READ_TOKEN と COPILOT_ENTERPRISE / COPILOT_ORGS が必要)
 *   npm run schema:drift -- --dry-run           フィクスチャ同士を比較 (通信なし。配線の確認用)
 *   npm run schema:drift -- --update-baseline   フィクスチャから基準 fingerprints.json を作り直す
 *   --out <file>                                比較結果の JSON (パスと型のみ。値は含まない) を書き出す
 *
 * 差分があっても終了コードは 0。Issue の起票はワークフロー (schema-drift.yml) が行う。
 */
interface Report {
  checked_at: string;
  mode: 'live' | 'dry-run' | 'skipped';
  reason?: string;
  drift: boolean;
  signature?: string;
  sources: Partial<Record<ContractSource, FingerprintDrift>>;
}

const args = process.argv.slice(2);
const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : undefined;

function emit(report: Report): void {
  console.log(JSON.stringify(report, null, 2));
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n');
}

async function fetchLiveSamples(fetcher: RawApiFetcher): Promise<Partial<Record<ContractSource, unknown[]>>> {
  const ent = process.env.COPILOT_ENTERPRISE?.trim();
  const orgs = (process.env.COPILOT_ORGS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const scopes: ReportScope[] = [
    ...(ent ? [{ kind: 'enterprise', slug: ent } as const] : []),
    ...orgs.map((slug) => ({ kind: 'org', slug }) as const),
  ];
  const live: Partial<Record<ContractSource, unknown[]>> = {};

  // users-1-day: 直近の、レポートがある日 (検証前の生の行から指紋を取る)
  const days = reportWindowDays().reverse().slice(0, 7);
  outer: for (const scope of scopes) {
    for (const day of days) {
      const { endpoint, params } = scope.kind === 'enterprise'
        ? { endpoint: '/enterprises/{ent}/copilot/metrics/reports/users-1-day', params: { ent: scope.slug } }
        : { endpoint: '/orgs/{org}/copilot/metrics/reports/users-1-day', params: { org: scope.slug } };
      const { body } = await fetcher.fetchRawAllowing<{ download_links?: string[] }>(endpoint, params, { day }, [404]);
      const link = body?.download_links?.[0];
      if (!link) continue;
      const text = await fetcher.downloadSigned(link);
      live['users-1-day'] = text.split('\n').filter((l) => l.trim()).slice(0, 500).flatMap((l) => {
        try { return [JSON.parse(l)]; } catch { return []; }
      });
      break outer;
    }
  }

  const seatScope = ent
    ? { endpoint: '/enterprises/{ent}/copilot/billing/seats', params: { ent } }
    : orgs[0] ? { endpoint: '/orgs/{org}/copilot/billing/seats', params: { org: orgs[0] } } : undefined;
  if (seatScope) live.seats = [await fetcher.fetchRaw(seatScope.endpoint, seatScope.params, { per_page: 100 })];
  if (ent) live['cost-centers'] = [await fetcher.fetchRaw('/enterprises/{ent}/settings/billing/cost-centers', { ent })];
  return live;
}

async function main(): Promise<void> {
  const checked_at = new Date().toISOString();

  if (args.includes('--update-baseline')) {
    fs.writeFileSync(baselinePath(), JSON.stringify(fixtureFingerprints(), null, 2) + '\n');
    console.log(`Wrote ${baselinePath()}`);
    return;
  }

  const baseline = loadBaseline();
  let livePrints: Partial<Record<ContractSource, ReturnType<typeof fingerprintOf>>>;
  let mode: Report['mode'];

  if (args.includes('--dry-run')) {
    mode = 'dry-run';
    livePrints = fixtureFingerprints();
  } else {
    const token = resolveGitHubToken();
    if (!token || (!process.env.COPILOT_ENTERPRISE && !process.env.COPILOT_ORGS)) {
      emit({ checked_at, mode: 'skipped', reason: 'COPILOT_READ_TOKEN and COPILOT_ENTERPRISE / COPILOT_ORGS are required', drift: false, sources: {} });
      return;
    }
    mode = 'live';
    const samples = await fetchLiveSamples(new RawApiFetcher({ token }));
    livePrints = {};
    for (const source of CONTRACT_SOURCES) {
      const s = samples[source];
      if (s && s.length > 0) livePrints[source] = fingerprintOf(samplesOf(source, s));
    }
  }

  const sources: Report['sources'] = {};
  for (const source of CONTRACT_SOURCES) {
    const live = livePrints[source];
    if (live) sources[source] = diffFingerprints(baseline[source], live);
  }
  const drifted = Object.values(sources).filter((d) => hasDrift(d));
  const signature = driftSignature({
    added: drifted.flatMap((d) => d.added),
    removed: drifted.flatMap((d) => d.removed),
    typeChanged: drifted.flatMap((d) => d.typeChanged),
  });
  emit({ checked_at, mode, drift: drifted.length > 0, signature: drifted.length ? signature : undefined, sources });
}

main().catch((err: Error) => {
  // 値や URL を出さない (エラー名とメッセージの先頭のみ)
  console.error(`schema-drift failed: ${err.name}: ${err.message.slice(0, 120)}`);
  process.exit(1);
});
