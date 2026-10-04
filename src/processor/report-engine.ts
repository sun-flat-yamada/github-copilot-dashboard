import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { z } from 'zod';
import {
  DEFAULT_BREAKDOWN_LIMIT,
  FILTER_OPERATORS,
  MAX_BREAKDOWN_LIMIT,
  REPORT_DATASETS,
  REPORT_OUTPUTS,
  REPORT_SCHEDULES,
  type BreakdownSection,
  type KpiSection,
  type ReportDataset,
  type ReportDefinition,
  type ReportFilter,
  type ReportLanguage,
} from '../domain/entities/report-definition.js';
import { METRIC_REGISTRY, QUALITY_PRESENTATION, qualify, type MetricId, type MetricQuality, type MetricUnit } from '../domain/metrics/metric-registry.js';
import { isPrivacyTier, PRIVACY_TIERS } from '../domain/privacy-profile.js';
import { CSV_BOM, escapeCsvCell } from './seat-audit-csv.js';

/**
 * Report Engine (P4-5 / E-04)。定義 (reports/*.yaml) の検証と、集計済みデータセットからの描画 (純関数)。
 * 入出力 (定義ファイルの読み込みを除く保存・対象判定) は application 層が受け持つ。
 * 利用者単位の行 (users / user_profiles / user_details) は読まない。
 */

type Doc = Record<string, unknown>;
type CellValue = number | string | null;

// ---------------------------------------------------------------------------
// 指標の束縛: 指標カタログの ID が、各データセットのどの値か
// ---------------------------------------------------------------------------

function pick(doc: Doc, ...keys: string[]): CellValue {
  let cur: unknown = doc;
  for (const k of keys) {
    if (typeof cur !== 'object' || cur === null) return null;
    cur = (cur as Doc)[k];
  }
  if (typeof cur === 'number') return Number.isFinite(cur) ? cur : null;
  if (typeof cur === 'string' && cur.length > 0) return cur;
  return null;
}

type Binding = (doc: Doc) => CellValue;

/** データセットごとに値を取り出せる指標。ここに無い指標を定義が参照したら拒否する */
export const METRIC_BINDINGS: Record<ReportDataset, Partial<Record<MetricId, Binding>>> = {
  monthly: {
    total_spend: (d) => pick(d, 'overview', 'total_spend_usd'),
    active_rate: (d) => pick(d, 'overview', 'active_ratio'),
    idle_waste: (d) => pick(d, 'overview', 'idle_waste_usd'),
    acceptance_rate: (d) => pick(d, 'overview', 'overall_acceptance_rate'),
    agent_sessions: (d) => pick(d, 'agent_summary', 'total_sessions'),
    agent_messages: (d) => pick(d, 'agent_summary', 'total_messages'),
    agent_active_users: (d) => pick(d, 'agent_summary', 'engaged_users'),
    agent_adoption_rate: (d) => pick(d, 'agent_summary', 'adoption_rate'),
  },
  reports: {
    report_gross_spend: (d) => pick(d, 'overview', 'total_gross_spend_usd'),
    report_net_spend: (d) => pick(d, 'overview', 'total_net_spend_usd'),
    report_requests: (d) => pick(d, 'overview', 'total_requests'),
    report_active_users: (d) => pick(d, 'overview', 'total_active_users'),
    report_top_model: (d) => pick(d, 'overview', 'top_model'),
    report_top_sku: (d) => pick(d, 'overview', 'top_sku'),
  },
};

// ---------------------------------------------------------------------------
// 内訳 (breakdown) の入力: グループと列
// ---------------------------------------------------------------------------

interface ColumnSpec {
  label: { ja: string; en: string };
  unit: MetricUnit;
  field: string;
}

interface GroupSource {
  /** record = { name: row }、array = row[] */
  shape: 'record' | 'array';
  /** データセット内のキー */
  key: string;
  /** 行の名称の項目 */
  labelField: string;
  columns: Record<string, ColumnSpec>;
}

const col = (ja: string, en: string, unit: MetricUnit, field: string): ColumnSpec => ({ label: { ja, en }, unit, field });

const SEAT_GROUP_COLUMNS: Record<string, ColumnSpec> = {
  total_seats: col('シート数', 'Seats', 'seats', 'total_seats'),
  active_seats: col('利用中シート', 'Active seats', 'seats', 'active_seats'),
  idle_seats: col('遊休シート', 'Idle seats', 'seats', 'idle_seats'),
  total_cost_usd: col('費用', 'Cost', 'usd', 'total_cost_usd'),
  net_cost_usd: col('請求見込み額', 'Net cost', 'usd', 'net_cost_usd'),
  potential_savings_usd: col('削減見込み額', 'Potential savings', 'usd', 'potential_savings_usd'),
  active_ratio: col('アクティブ率', 'Active rate', 'ratio', 'active_ratio'),
  acceptance_rate: col('受諾率', 'Acceptance rate', 'ratio', 'acceptance_rate'),
  total_chats: col('チャット数', 'Chats', 'count', 'total_chats'),
  total_requests: col('リクエスト数', 'Requests', 'count', 'total_requests'),
};

function seatGroup(key: string): GroupSource {
  return { shape: 'record', key, labelField: 'group_name', columns: SEAT_GROUP_COLUMNS };
}

export const GROUP_SOURCES: Record<ReportDataset, Record<string, GroupSource>> = {
  monthly: {
    cost_center: seatGroup('by_cost_center'),
    organization: seatGroup('by_organization'),
    department: seatGroup('by_department'),
    team: seatGroup('by_team'),
  },
  reports: {
    cost_center: seatGroup('by_cost_center'),
    organization: seatGroup('by_organization'),
    department: seatGroup('by_department'),
    model: {
      shape: 'array',
      key: 'model_breakdown',
      labelField: 'model_name',
      columns: {
        total_requests: col('リクエスト数', 'Requests', 'count', 'total_requests'),
        total_spend_usd: col('費用', 'Spend', 'usd', 'total_spend_usd'),
        active_users: col('利用者数', 'Active users', 'users', 'active_users'),
        percentage: col('構成比 (%)', 'Share (%)', 'count', 'percentage'),
      },
    },
    sku: {
      shape: 'array',
      key: 'sku_breakdown',
      labelField: 'sku_name',
      columns: {
        total_quantity: col('数量', 'Quantity', 'count', 'total_quantity'),
        total_spend_usd: col('費用', 'Spend', 'usd', 'total_spend_usd'),
        percentage: col('構成比 (%)', 'Share (%)', 'count', 'percentage'),
      },
    },
  },
};

// ---------------------------------------------------------------------------
// 定義のスキーマと検証
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SECTION_ID_RE = /^[a-z0-9]+([-_][a-z0-9]+)*$/;
/** 定義ファイルの上限 (バイト)。巨大な YAML (alias 展開など) を読まない */
export const MAX_DEFINITION_BYTES = 64 * 1024;

const filterSchema = z.strictObject({
  column: z.string().min(1),
  op: z.enum(FILTER_OPERATORS),
  value: z.number().finite(),
});

const kpiSectionSchema = z.strictObject({
  type: z.literal('kpi'),
  id: z.string().regex(SECTION_ID_RE),
  title: z.string().min(1).max(120),
  metrics: z.array(z.string().min(1)).min(1).max(30),
});

const breakdownSectionSchema = z.strictObject({
  type: z.literal('breakdown'),
  id: z.string().regex(SECTION_ID_RE),
  title: z.string().min(1).max(120),
  group_by: z.string().min(1),
  columns: z.array(z.string().min(1)).min(1).max(12),
  sort_by: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(MAX_BREAKDOWN_LIMIT).optional(),
  filters: z.array(filterSchema).max(10).optional(),
});

const definitionSchema = z.strictObject({
  id: z.string().regex(ID_RE).max(60),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  schedule: z.enum(REPORT_SCHEDULES).optional(),
  dataset: z.enum(REPORT_DATASETS),
  privacy_tier: z.string().optional(),
  language: z.enum(['ja', 'en']).optional(),
  outputs: z.array(z.enum(REPORT_OUTPUTS)).min(1),
  sections: z.array(z.discriminatedUnion('type', [kpiSectionSchema, breakdownSectionSchema])).min(1).max(20),
});

export interface ParsedDefinition {
  definition?: ReportDefinition;
  /** 定義ファイル内容の SHA-256 (hex)。定義の版 */
  sha256?: string;
  errors: string[];
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`);
}

/** 意味の検証: 指標カタログ・束縛・列・グループ・重複 ID・プライバシー階層 */
function semanticErrors(def: ReportDefinition): string[] {
  const errors: string[] = [];
  const bindings = METRIC_BINDINGS[def.dataset];
  const groups = GROUP_SOURCES[def.dataset];
  const seen = new Set<string>();
  def.sections.forEach((section, i) => {
    const at = `sections.${i}`;
    if (seen.has(section.id)) errors.push(`${at}.id: duplicate section id "${section.id}"`);
    seen.add(section.id);
    if (section.type === 'kpi') {
      section.metrics.forEach((m, j) => {
        if (!(m in METRIC_REGISTRY)) errors.push(`${at}.metrics.${j}: unknown metric "${m}" (not in the metric catalog)`);
        else if (!bindings[m as MetricId]) {
          errors.push(`${at}.metrics.${j}: metric "${m}" is not available from dataset "${def.dataset}" (available: ${Object.keys(bindings).join(', ')})`);
        }
      });
      const dup = section.metrics.find((m, j) => section.metrics.indexOf(m) !== j);
      if (dup) errors.push(`${at}.metrics: duplicate metric "${dup}"`);
      return;
    }
    const group = groups[section.group_by];
    if (!group) {
      errors.push(`${at}.group_by: unknown group "${section.group_by}" for dataset "${def.dataset}" (available: ${Object.keys(groups).join(', ')})`);
      return;
    }
    const known = Object.keys(group.columns);
    section.columns.forEach((c, j) => {
      if (!known.includes(c)) errors.push(`${at}.columns.${j}: unknown column "${c}" for group "${section.group_by}" (available: ${known.join(', ')})`);
    });
    if (section.sort_by !== undefined && !section.columns.includes(section.sort_by)) {
      errors.push(`${at}.sort_by: "${section.sort_by}" must be one of the section columns`);
    }
    section.filters?.forEach((f, j) => {
      if (!known.includes(f.column)) errors.push(`${at}.filters.${j}.column: unknown column "${f.column}" for group "${section.group_by}"`);
    });
  });
  return errors;
}

/** YAML 文字列の定義を検証して返す。`fileId` (ファイル名の拡張子を除いた部分) と `id` の一致も検査する */
export function parseReportDefinition(text: string, fileId?: string): ParsedDefinition {
  if (Buffer.byteLength(text, 'utf-8') > MAX_DEFINITION_BYTES) {
    return { errors: [`(file): definition is larger than ${MAX_DEFINITION_BYTES} bytes`] };
  }
  let raw: unknown;
  try {
    // 既定の (安全な) スキーマ。任意の型タグ・コードは評価されない
    raw = yaml.load(text);
  } catch (e) {
    return { errors: [`(yaml): ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`] };
  }
  const parsed = definitionSchema.safeParse(raw);
  if (!parsed.success) return { errors: formatZodIssues(parsed.error) };
  const d = parsed.data;
  const errors: string[] = [];
  if (d.privacy_tier !== undefined && !isPrivacyTier(d.privacy_tier)) {
    errors.push(`privacy_tier: unknown tier "${d.privacy_tier}" (use ${PRIVACY_TIERS.map((t) => `"${t}"`).join(' or ')})`);
  }
  if (fileId !== undefined && d.id !== fileId) errors.push(`id: "${d.id}" must equal the file name "${fileId}"`);
  const definition: ReportDefinition = {
    id: d.id,
    title: d.title,
    description: d.description,
    schedule: d.schedule,
    dataset: d.dataset,
    privacy_tier: isPrivacyTier(d.privacy_tier) ? d.privacy_tier : 'aggregate-only',
    language: d.language ?? 'ja',
    outputs: [...new Set(d.outputs)],
    sections: d.sections as ReportDefinition['sections'],
  };
  errors.push(...semanticErrors(definition));
  if (errors.length > 0) return { errors };
  return { definition, sha256: createHash('sha256').update(text).digest('hex'), errors: [] };
}

export interface LoadedDefinitions {
  definitions: Array<{ definition: ReportDefinition; sha256: string; file: string }>;
  /** 不正な定義。他の定義の生成は止めない */
  invalid: Array<{ file: string; errors: string[] }>;
}

/** `dir` 直下の *.yaml / *.yml を読み込む。無いディレクトリは空 */
export function loadReportDefinitions(dir: string): LoadedDefinitions {
  const out: LoadedDefinitions = { definitions: [], invalid: [] };
  if (!fs.existsSync(dir)) return out;
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.ya?ml$/.test(e.name))
    .map((e) => e.name)
    .sort();
  const ids = new Map<string, string>();
  for (const file of files) {
    const full = path.join(dir, file);
    let text: string;
    try {
      if (fs.statSync(full).size > MAX_DEFINITION_BYTES) {
        out.invalid.push({ file, errors: [`(file): definition is larger than ${MAX_DEFINITION_BYTES} bytes`] });
        continue;
      }
      text = fs.readFileSync(full, 'utf-8');
    } catch (e) {
      out.invalid.push({ file, errors: [`(file): ${e instanceof Error ? e.message : String(e)}`] });
      continue;
    }
    const parsed = parseReportDefinition(text, file.replace(/\.ya?ml$/, ''));
    if (!parsed.definition || !parsed.sha256) {
      out.invalid.push({ file, errors: parsed.errors });
      continue;
    }
    const prior = ids.get(parsed.definition.id);
    if (prior) {
      out.invalid.push({ file, errors: [`id: duplicate report id "${parsed.definition.id}" (also in ${prior})`] });
      continue;
    }
    ids.set(parsed.definition.id, file);
    out.definitions.push({ definition: parsed.definition, sha256: parsed.sha256, file });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 描画
// ---------------------------------------------------------------------------

export interface RenderContext {
  /** 入力に使った月次集計の月 (YYYY-MM) */
  dataMonth: string;
  /** 出力の期間 (YYYY-MM / YYYY-Www) */
  period: string;
  /** 入力が demo (架空データ) か */
  isDemo: boolean;
  /** 定義の版 (SHA-256 hex) */
  definitionSha256: string;
  /** 月次締めのチェックサム (締め済みの月だけ) */
  closeChecksum?: string;
}

export interface RenderedReport {
  markdown?: string;
  csv?: string;
}

interface Cell {
  value: CellValue;
  quality: MetricQuality;
  reason?: string;
}

const MISSING_REASON: Record<ReportLanguage, string> = { ja: '値を取得できていません', en: 'value not available' };
const BADGE: Record<ReportLanguage, Record<MetricQuality, string | null>> = {
  ja: { measured: null, estimated: QUALITY_PRESENTATION.estimated.badge, missing: QUALITY_PRESENTATION.missing.badge, demo: QUALITY_PRESENTATION.demo.badge },
  en: { measured: null, estimated: 'estimated', missing: 'missing', demo: 'demo' },
};
const UNIT_SUFFIX: Record<ReportLanguage, Record<MetricUnit, string>> = {
  ja: { usd: 'USD', ratio: '%', count: '', seats: '席', users: '人', credits: 'クレジット', name: '' },
  en: { usd: 'USD', ratio: '%', count: '', seats: 'seats', users: 'users', credits: 'credits', name: '' },
};

function metricCell(id: MetricId, raw: CellValue, ctx: RenderContext, lang: ReportLanguage): Cell {
  if (typeof raw === 'string') {
    return { value: raw, quality: ctx.isDemo ? 'demo' : METRIC_REGISTRY[id].defaultQuality };
  }
  const q = qualify(id, raw, { isDemo: ctx.isDemo, missingReason: MISSING_REASON[lang] });
  return { value: q.value, quality: q.quality, reason: q.reason };
}

function plainCell(raw: CellValue, ctx: RenderContext, lang: ReportLanguage): Cell {
  if (raw === null) return { value: null, quality: 'missing', reason: MISSING_REASON[lang] };
  return { value: raw, quality: ctx.isDemo ? 'demo' : 'measured' };
}

function formatValue(value: CellValue, unit: MetricUnit, lang: ReportLanguage): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  const suffix = UNIT_SUFFIX[lang][unit];
  let text: string;
  if (unit === 'usd') text = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  else if (unit === 'ratio') text = (value * 100).toFixed(1);
  else text = Number.isInteger(value) ? value.toLocaleString('en-US') : value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (unit === 'usd') return `${text} ${suffix}`;
  return suffix ? `${text} ${suffix}` : text;
}

/** Markdown の表のセル。縦棒・改行で表が崩れないようにする */
function mdText(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

function displayCell(cell: Cell, unit: MetricUnit, lang: ReportLanguage): string {
  if (cell.value === null) return `—（${cell.reason ?? MISSING_REASON[lang]}）`;
  const badge = BADGE[lang][cell.quality];
  const text = mdText(formatValue(cell.value, unit, lang));
  return badge ? `${text} [${badge}]` : text;
}

function compare(a: CellValue, b: CellValue, order: 'asc' | 'desc'): number {
  // 欠損は並び順にかかわらず末尾
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const r = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
  return order === 'asc' ? r : -r;
}

function matches(value: CellValue, f: ReportFilter): boolean {
  if (typeof value !== 'number') return false; // 欠損は条件に合致しない
  switch (f.op) {
    case 'gt': return value > f.value;
    case 'gte': return value >= f.value;
    case 'lt': return value < f.value;
    case 'lte': return value <= f.value;
    case 'eq': return value === f.value;
  }
}

interface BreakdownRow {
  label: string;
  values: Record<string, CellValue>;
}

function breakdownRows(def: ReportDefinition, section: BreakdownSection, doc: Doc): BreakdownRow[] {
  const source = GROUP_SOURCES[def.dataset][section.group_by];
  const container = doc[source.key];
  const rawRows: Doc[] =
    source.shape === 'record'
      ? container && typeof container === 'object' && !Array.isArray(container)
        ? Object.values(container as Record<string, unknown>).filter((r): r is Doc => typeof r === 'object' && r !== null)
        : []
      : Array.isArray(container)
      ? container.filter((r): r is Doc => typeof r === 'object' && r !== null)
      : [];
  const wanted = new Set([...section.columns, ...(section.filters ?? []).map((f) => f.column)]);
  let rows: BreakdownRow[] = rawRows.map((r) => {
    const values: Record<string, CellValue> = {};
    for (const c of wanted) values[c] = pick(r, source.columns[c].field);
    const label = r[source.labelField];
    return { label: typeof label === 'string' ? label : '', values };
  });
  for (const f of section.filters ?? []) rows = rows.filter((r) => matches(r.values[f.column], f));
  const sortBy = section.sort_by ?? section.columns[0];
  const order = section.order ?? 'desc';
  rows.sort((a, b) => compare(a.values[sortBy], b.values[sortBy], order) || a.label.localeCompare(b.label));
  return rows.slice(0, section.limit ?? DEFAULT_BREAKDOWN_LIMIT);
}

const CSV_HEADER = ['section', 'group', 'item', 'value', 'unit', 'quality'] as const;

function csvLine(cells: Array<string | null>): string {
  return cells.map((c) => escapeCsvCell(c)).join(',');
}

function csvValue(value: CellValue): string | null {
  if (value === null) return null;
  return typeof value === 'number' ? String(value) : value;
}

/**
 * 定義とデータセットからレポートを描画する。同じ入力は同じ内容 (生成時刻は本文に入れない)。
 * 欠損は「—（理由）」で、0 や空の表にしない。CSV は UTF-8 BOM + CRLF、数式インジェクション対策済み。
 */
export function renderReport(def: ReportDefinition, doc: Doc, ctx: RenderContext): RenderedReport {
  const lang = def.language;
  const bindings = METRIC_BINDINGS[def.dataset];
  const csvRows: string[] = [csvLine([...CSV_HEADER])];
  const md: string[] = [`# ${def.title}`, ''];
  if (def.description) md.push(def.description, '');
  const meta: string[] = [
    `${lang === 'ja' ? '対象期間' : 'Period'}: ${ctx.period}`,
    `${lang === 'ja' ? 'データの月' : 'Data month'}: ${ctx.dataMonth}`,
    `${lang === 'ja' ? 'データセット' : 'Dataset'}: ${def.dataset}`,
    `${lang === 'ja' ? 'プライバシー階層' : 'Privacy tier'}: ${def.privacy_tier}`,
    `${lang === 'ja' ? '定義' : 'Definition'}: ${def.id} (${ctx.definitionSha256.slice(0, 12)})`,
  ];
  if (ctx.closeChecksum) meta.push(`${lang === 'ja' ? '月次締めのチェックサム' : 'Month close checksum'}: ${ctx.closeChecksum.slice(0, 12)}`);
  md.push(...meta.map((m) => `- ${m}`), '');
  if (ctx.isDemo) {
    md.push(`> ${lang === 'ja' ? '架空のデモデータです (実データではありません)。' : 'Demo data (fictitious, not real data).'}`, '');
  }

  for (const section of def.sections) {
    md.push(`## ${section.title}`, '');
    if (section.type === 'kpi') {
      md.push(`| ${lang === 'ja' ? '指標' : 'Metric'} | ${lang === 'ja' ? '値' : 'Value'} |`, '| :-- | --: |');
      for (const id of (section as KpiSection).metrics) {
        const meta2 = METRIC_REGISTRY[id];
        const cell = metricCell(id, bindings[id]!(doc), ctx, lang);
        md.push(`| ${mdText(meta2.label[lang])} | ${displayCell(cell, meta2.unit, lang)} |`);
        csvRows.push(csvLine([section.id, '', id, csvValue(cell.value), meta2.unit, cell.quality]));
      }
    } else {
      const source = GROUP_SOURCES[def.dataset][section.group_by];
      const rows = breakdownRows(def, section, doc);
      md.push(
        `| ${lang === 'ja' ? '名称' : 'Name'} | ${section.columns.map((c) => mdText(source.columns[c].label[lang])).join(' | ')} |`,
        `| :-- |${section.columns.map(() => ' --: |').join('')}`
      );
      if (rows.length === 0) {
        md.push(`| —（${lang === 'ja' ? '該当する行がありません' : 'no matching rows'}） |${section.columns.map(() => ' |').join('')}`);
      }
      for (const row of rows) {
        const cells = section.columns.map((c) => plainCell(row.values[c], ctx, lang));
        md.push(`| ${mdText(row.label)} | ${cells.map((cell, i) => displayCell(cell, source.columns[section.columns[i]].unit, lang)).join(' | ')} |`);
        section.columns.forEach((c, i) => {
          csvRows.push(csvLine([section.id, row.label, c, csvValue(cells[i].value), source.columns[c].unit, cells[i].quality]));
        });
      }
    }
    md.push('');
  }

  const result: RenderedReport = {};
  if (def.outputs.includes('markdown')) result.markdown = `${md.join('\n').trimEnd()}\n`;
  if (def.outputs.includes('csv')) result.csv = `${CSV_BOM}${csvRows.join('\r\n')}\r\n`;
  return result;
}
