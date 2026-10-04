import { afterEach, beforeEach, describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { isoWeek, ReportGenerationService } from '../application/pipeline/report-generation.js';
import { METRIC_REGISTRY } from '../domain/metrics/metric-registry.js';
import { loadReportDefinitions, METRIC_BINDINGS, parseReportDefinition, renderReport } from '../processor/report-engine.js';
import { ForkSafeStorage } from '../storage/fork-safe-storage.js';

// 値はすべて架空 (実在の組織・部署・個人・金額ではない)
const VALID = `
id: sample-report
title: Sample report
dataset: monthly
outputs: [markdown, csv]
language: en
sections:
  - type: kpi
    id: headline
    title: Headline
    metrics: [total_spend, active_rate, agent_sessions]
  - type: breakdown
    id: groups
    title: Groups
    group_by: cost_center
    columns: [total_seats, total_cost_usd, idle_seats]
    sort_by: total_cost_usd
    limit: 2
    filters:
      - { column: total_seats, op: gte, value: 2 }
`;

const MONTHLY_DOC = {
  overview: { total_spend_usd: 1200.5, active_ratio: 0.8, idle_waste_usd: 10 },
  agent_summary: { total_sessions: null },
  by_cost_center: {
    'cc-a': { group_name: 'cc-a', total_seats: 10, total_cost_usd: 400, idle_seats: 1 },
    'cc-b': { group_name: 'cc-b', total_seats: 5, total_cost_usd: 700, idle_seats: 0 },
    'cc-c': { group_name: 'cc-c', total_seats: 1, total_cost_usd: 900, idle_seats: 0 },
    'cc-d': { group_name: '=cmd|calc', total_seats: 3, total_cost_usd: 100, idle_seats: null },
  },
  users: [{ login: 'must-not-appear-user' }],
};

const CTX = { dataMonth: '2026-09', period: '2026-09', isDemo: false, definitionSha256: 'a'.repeat(64) };

function parse(text: string, id?: string) {
  return parseReportDefinition(text, id);
}

describe('Report definition schema (P4-5)', () => {
  it('accepts a valid definition and applies defaults', () => {
    const r = parse(VALID, 'sample-report');
    assert.deepEqual(r.errors, []);
    assert.equal(r.definition?.privacy_tier, 'aggregate-only');
    assert.match(r.sha256 ?? '', /^[0-9a-f]{64}$/);
  });

  it('rejects an unknown metric (not in the metric catalog)', () => {
    const r = parse(VALID.replace('total_spend,', 'made_up_metric,'));
    assert.ok(r.errors.some((e) => /unknown metric "made_up_metric"/.test(e)), r.errors.join('\n'));
  });

  it('rejects a catalog metric the dataset cannot provide', () => {
    const r = parse(VALID.replace('agent_sessions', 'report_net_spend'));
    assert.ok(r.errors.some((e) => /report_net_spend.*not available from dataset "monthly"/.test(e)), r.errors.join('\n'));
  });

  it('rejects unknown columns, groups, sort keys, filter columns and unknown keys', () => {
    assert.ok(parse(VALID.replace('idle_seats]', 'nope]')).errors.some((e) => /unknown column "nope"/.test(e)));
    assert.ok(parse(VALID.replace('group_by: cost_center', 'group_by: user')).errors.some((e) => /unknown group "user"/.test(e)));
    assert.ok(parse(VALID.replace('sort_by: total_cost_usd', 'sort_by: idle_seats2')).errors.some((e) => /sort_by/.test(e)));
    assert.ok(parse(VALID.replace('column: total_seats', 'column: ghost')).errors.some((e) => /filters\.0\.column/.test(e)));
    assert.ok(parse(`${VALID}\nunexpected: 1\n`).errors.length > 0);
  });

  it('accepts both privacy tiers (P4-6) and still rejects unknown ones', () => {
    const identified = parse(`${VALID}privacy_tier: identified\n`);
    assert.deepEqual(identified.errors, []);
    assert.equal(identified.definition?.privacy_tier, 'identified');
    assert.ok(parse(`${VALID}privacy_tier: public\n`).errors.some((e) => /unknown tier/.test(e)));
    assert.deepEqual(parse(`${VALID}privacy_tier: aggregate-only\n`).errors, []);
  });

  it('requires the id to equal the file name and reserves a safe id shape', () => {
    assert.ok(parse(VALID, 'other-name').errors.some((e) => /must equal the file name/.test(e)));
    assert.ok(parse(VALID.replace('id: sample-report', 'id: ../escape')).errors.length > 0);
  });

  it('rejects duplicate section ids, duplicate metrics, malformed YAML, and oversized files', () => {
    const dupSection = VALID.replace('id: groups', 'id: headline');
    assert.ok(parse(dupSection).errors.some((e) => /duplicate section id/.test(e)));
    assert.ok(parse(VALID.replace('[total_spend, active_rate, agent_sessions]', '[total_spend, total_spend]')).errors.some((e) => /duplicate metric/.test(e)));
    assert.ok(parse('id: [unclosed').errors[0].startsWith('(yaml)'));
    assert.ok(parse(`# ${'x'.repeat(70 * 1024)}\n${VALID}`).errors[0].includes('larger than'));
  });

  it('does not evaluate YAML type tags (safe schema)', () => {
    const r = parse(`${VALID}\nextra: !!js/function 'function(){}'\n`);
    assert.ok(r.errors.length > 0);
  });

  it('every binding refers to a catalog metric', () => {
    for (const ids of Object.values(METRIC_BINDINGS)) {
      for (const id of Object.keys(ids)) assert.ok(id in METRIC_REGISTRY, id);
    }
  });
});

describe('renderReport (P4-5)', () => {
  const def = parse(VALID, 'sample-report').definition!;

  it('renders KPI with "—（reason）" for missing values (never 0), sorting, filters and limit', () => {
    const { markdown } = renderReport(def, MONTHLY_DOC, CTX);
    assert.ok(markdown);
    assert.match(markdown, /\| Total spend \| 1,200\.50 USD \|/);
    assert.match(markdown, /Total agent sessions \| —（value not available）/);
    // cc-c (1 seat) is filtered out; sorted by cost desc; limit 2 → cc-b (700), cc-a (400)
    const rows = markdown.split('\n').filter((l) => /^\| cc-/.test(l));
    assert.equal(rows.length, 2);
    assert.match(rows[0], /^\| cc-b \|/);
    assert.match(rows[1], /^\| cc-a \|/);
    assert.ok(!markdown.includes('must-not-appear-user'), 'user rows are never read');
  });

  it('is deterministic and carries no generation time', () => {
    assert.deepEqual(renderReport(def, MONTHLY_DOC, CTX), renderReport(def, MONTHLY_DOC, CTX));
  });

  it('marks demo data as demo quality and says so', () => {
    const r = renderReport(def, MONTHLY_DOC, { ...CTX, isDemo: true });
    assert.match(r.markdown!, /Demo data/);
    assert.match(r.csv!, /total_spend,1200\.5,usd,demo/);
  });

  it('writes CSV with BOM, CRLF, an empty cell for missing values, and defuses formulas', () => {
    const wide = parse(VALID.replace('value: 2', 'value: 0').replace('limit: 2', 'limit: 10')).definition!;
    const { csv } = renderReport(wide, MONTHLY_DOC, CTX);
    assert.ok(csv!.startsWith('﻿section,group,item,value,unit,quality\r\n'));
    assert.ok(csv!.endsWith('\r\n'));
    assert.match(csv!, /headline,,agent_sessions,,count,missing\r\n/);
    assert.ok(csv!.includes("groups,'=cmd|calc,total_seats,3"), 'formula-looking group name is prefixed with a quote');
    assert.match(csv!, /groups,'=cmd\|calc,idle_seats,,seats,missing/);
  });

  it('honours the outputs list', () => {
    const mdOnly = parse(VALID.replace('[markdown, csv]', '[markdown]')).definition!;
    const r = renderReport(mdOnly, MONTHLY_DOC, CTX);
    assert.ok(r.markdown && r.csv === undefined);
  });
});

describe('definition files and scheduled generation (P4-5)', () => {
  let tmp: string;
  let defsDir: string;
  let storage: ForkSafeStorage;
  const NOW = new Date('2026-10-07T03:00:00Z'); // 2026-W41

  const monthly = (month: string) => ({ ...MONTHLY_DOC, scope_type: 'monthly', scope_key: month });
  const writeJson = (rel: string, v: unknown) => {
    const f = path.join(tmp, 'data', rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(v), 'utf-8');
  };
  const addDefinition = (name: string, body: string) => fs.writeFileSync(path.join(defsDir, `${name}.yaml`), body, 'utf-8');
  const entries = () => loadReportDefinitions(defsDir).definitions;
  const outputs = () => storage.loadReportOutputIndex()?.outputs ?? [];

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'report-engine-'));
    defsDir = path.join(tmp, 'reports');
    fs.mkdirSync(defsDir);
    storage = new ForkSafeStorage({ baseDir: path.join(tmp, 'data'), publicDir: undefined });
    writeJson('processed/monthly/2026-08.json', monthly('2026-08'));
    writeJson('processed/monthly/2026-09.json', monthly('2026-09'));
    writeJson('processed/closes/2026-08.json', { schema_version: 1, month: '2026-08', closed: { checksum: 'c'.repeat(64) }, revisions: [] });
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('adding ONE definition file produces a new report with no code change', () => {
    const service = new ReportGenerationService(storage);
    assert.equal(entries().length, 0);
    addDefinition(
      'brand-new',
      `id: brand-new\ntitle: Brand new\nschedule: monthly-close\ndataset: monthly\noutputs: [markdown, csv]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`
    );
    const [entry] = entries();
    assert.equal(entry.definition.id, 'brand-new');
    const due = service.dueTargets(entry, NOW);
    assert.deepEqual(due, [{ period: '2026-08', dataMonth: '2026-08' }]); // 2026-09 is not closed yet
    for (const t of due) assert.equal(service.generate(entry, t, NOW).status, 'generated');
    const dir = path.join(tmp, 'data/audit/report-outputs/brand-new');
    assert.ok(fs.existsSync(path.join(dir, '2026-08.md')));
    assert.ok(fs.existsSync(path.join(dir, '2026-08.csv')));
    assert.match(fs.readFileSync(path.join(dir, '2026-08.md'), 'utf-8'), /Month close checksum|月次締めのチェックサム/);
    assert.equal(outputs()[0].definition_sha256, entry.sha256);
    assert.ok(!fs.existsSync(path.join(tmp, 'data/processed/report-outputs')), 'never under processed/');
  });

  it('is idempotent, and regenerates when the definition changes', () => {
    const service = new ReportGenerationService(storage);
    const body = `id: r1\ntitle: R1\nschedule: monthly-close\ndataset: monthly\noutputs: [markdown]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`;
    addDefinition('r1', body);
    let [entry] = entries();
    service.generate(entry, service.dueTargets(entry, NOW)[0], NOW);
    assert.deepEqual(service.dueTargets(entry, NOW), []);
    addDefinition('r1', body.replace('title: R1', 'title: R1 v2'));
    [entry] = entries();
    assert.equal(service.dueTargets(entry, NOW).length, 1);
    service.generate(entry, service.dueTargets(entry, NOW)[0], NOW);
    assert.equal(outputs().length, 1, 'one index entry per report and period');
  });

  it('weekly reports use the ISO week of the run and the latest month; manual-only reports are never due', () => {
    const service = new ReportGenerationService(storage);
    addDefinition('wk', `id: wk\ntitle: W\nschedule: weekly\ndataset: monthly\noutputs: [csv]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`);
    addDefinition('manual', `id: manual\ntitle: M\ndataset: monthly\noutputs: [csv]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`);
    const [manual, wk] = entries();
    assert.deepEqual(service.dueTargets(wk, NOW), [{ period: '2026-W41', dataMonth: '2026-09' }]);
    assert.deepEqual(service.dueTargets(manual, NOW), []);
    assert.deepEqual(service.manualTarget(manual, '2026-08'), { period: '2026-08', dataMonth: '2026-08' });
    assert.equal(isoWeek(new Date('2026-12-31T00:00:00Z')), '2026-W53');
    assert.equal(isoWeek(new Date('2027-01-01T00:00:00Z')), '2026-W53');
    assert.equal(isoWeek(new Date('2027-01-04T00:00:00Z')), '2027-W01');
  });

  it('reports no_data without writing when the dataset has no such month', () => {
    const service = new ReportGenerationService(storage);
    addDefinition('r2', `id: r2\ntitle: R2\ndataset: reports\noutputs: [markdown]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [report_net_spend] }\n`);
    const [entry] = entries();
    assert.equal(service.manualTarget(entry, undefined), null);
    const r = service.generate(entry, { period: '2026-08', dataMonth: '2026-08' }, NOW);
    assert.equal(r.status, 'no_data');
    assert.equal(storage.loadReportOutputIndex(), null);
  });

  it('an invalid definition is reported but does not block the valid ones', () => {
    addDefinition('good', `id: good\ntitle: G\ndataset: monthly\noutputs: [csv]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`);
    addDefinition('bad', `id: bad\ntitle: B\ndataset: monthly\noutputs: [csv]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [nonexistent] }\n`);
    addDefinition('dupe', `id: good\ntitle: G2\ndataset: monthly\noutputs: [csv]\nsections:\n  - { type: kpi, id: k, title: K, metrics: [total_spend] }\n`);
    const loaded = loadReportDefinitions(defsDir);
    assert.deepEqual(loaded.definitions.map((d) => d.definition.id), ['good']);
    assert.deepEqual(loaded.invalid.map((i) => i.file).sort(), ['bad.yaml', 'dupe.yaml']);
  });

  it('rejects unsafe report ids and periods at the storage boundary', () => {
    assert.throws(() => storage.saveReportOutput('../x', '2026-09', 'md', ''), /Invalid report id/);
    assert.throws(() => storage.saveReportOutput('ok', '../2026', 'md', ''), /Invalid report period/);
  });

  it('the report definitions shipped in reports/ are valid', () => {
    const loaded = loadReportDefinitions(path.resolve(process.cwd(), 'reports'));
    assert.deepEqual(loaded.invalid, []);
    assert.ok(loaded.definitions.length >= 2);
    for (const d of loaded.definitions) assert.equal(d.definition.privacy_tier, 'aggregate-only');
  });
});
