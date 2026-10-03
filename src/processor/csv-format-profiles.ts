import type { CsvColumnMatch, CsvFormatProfileId } from '../domain/entities/csv-import.js';

/**
 * CSV フォーマットプロファイル (P1-5)。
 *
 * 列名の別名 (FIELD_RULES) と、フォーマットごとの必須列 (CSV_FORMAT_PROFILES) を宣言する。
 * 列名は小文字化し、(a) 英数字と `_` 以外を除いた形 (`user-name` → `username`)、(b) 英数字以外を `_` に
 * 置き換えた形 (`Gross Amount ($)` → `gross_amount`) のどちらかが別名に一致すれば認識する。
 * 自動判別できないとき (どのプロファイルの必須列も満たさない) は、取込を止めて理由を出す。
 */

/** 英数字と `_` 以外を除く (`user-name` → `username`)。従来の比較キー */
const stripped = (h: string): string => h.toLowerCase().replace(/[^a-z0-9_]/g, '');
/** 英数字以外を `_` に置き換える (`Gross Amount ($)` → `gross_amount`, `Net Amount` → `net_amount`) */
const underscored = (h: string): string =>
  h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

interface FieldRule {
  field: string;
  test: (h: string) => boolean;
}

const oneOf = (field: string, aliases: string[]): FieldRule => ({ field, test: (h) => aliases.includes(h) });

const DATE_ALIASES = ['date', 'day', 'usage_date', 'report_date'];

/** 正準フィールド → 列名の別名。1 つの列が複数のフィールドに対応しうる (旧実装と同じ) */
export const FIELD_RULES: FieldRule[] = [
  oneOf('date', DATE_ALIASES),
  {
    field: 'report_time',
    test: (h) => !DATE_ALIASES.includes(h) && (h.includes('report_time') || h.includes('timestamp')),
  },
  oneOf('username', ['username', 'login', 'user', 'user_login', 'github_username']),
  oneOf('product', ['product', 'product_name']),
  oneOf('sku', ['sku', 'sku_name', 'metric']),
  oneOf('model', ['model', 'model_name', 'ai_model']),
  // 'tokens' は token_count 専用。quantity と token_count の両方に割り当てない
  oneOf('quantity', ['quantity', 'requests', 'requests_count', 'count']),
  oneOf('unit_type', ['unit_type', 'unit', 'pricing_unit']),
  oneOf('applied_cost_per_quantity', ['applied_cost_per_quantity', 'cost_per_unit', 'unit_price', 'rate']),
  oneOf('gross_amount', ['gross_amount', 'gross_cost', 'total_gross']),
  oneOf('discount_amount', ['discount_amount', 'discount', 'credits_applied']),
  oneOf('net_amount', ['net_amount', 'net_cost', 'cost', 'amount', 'total_amount']),
  oneOf('organization', ['organization', 'org', 'organization_name']),
  oneOf('cost_center_name', ['cost_center_name', 'cost_center', 'costcenter', 'cost_centre']),
  oneOf('last_activity_at', ['last_activity_at', 'last_interaction_at']),
  oneOf('last_authenticated_at', ['last_authenticated_at']),
  oneOf('last_surface_used', ['last_surface_used', 'surface', 'editor', 'ide']),
  oneOf('ai_credits_consumed', ['ai_credits_consumed', 'credits_consumed', 'credits', 'ai_credits']),
  oneOf('token_count', ['token_count', 'tokens', 'total_tokens']),
  oneOf('input_tokens', ['input', 'input_tokens']),
  oneOf('output_tokens', ['output', 'output_tokens']),
  oneOf('cache_read_tokens', ['cache_read', 'cache_read_tokens']),
  oneOf('cache_write_tokens', ['cache_write', 'cache_write_tokens']),
];

export interface CsvFormatProfile {
  id: CsvFormatProfileId;
  label: string;
  /** すべて必要な正準フィールド */
  requires: string[];
  /** このうち 1 つ以上が必要な正準フィールド */
  requiresAnyOf?: string[];
}

/** 判別の優先順 (より特徴的なものを先に) */
export const CSV_FORMAT_PROFILES: CsvFormatProfile[] = [
  {
    id: 'ai-usage-report',
    label: 'AI usage report (モデル別トークン内訳)',
    requires: ['username', 'model'],
    requiresAnyOf: ['input_tokens', 'output_tokens', 'token_count'],
  },
  {
    id: 'activity-report',
    label: 'Activity report (最終アクティビティ)',
    requires: ['username', 'last_activity_at'],
  },
  {
    id: 'billing-usage-report',
    label: 'Billing usage report (使用量・金額)',
    requires: ['username'],
    requiresAnyOf: ['quantity', 'net_amount', 'gross_amount', 'ai_credits_consumed'],
  },
];

export interface HeaderAnalysis {
  /** 正準フィールド → 列インデックス (同じフィールドに複数列が当たったら後の列) */
  map: Record<string, number>;
  recognized: CsvColumnMatch[];
  unrecognized: string[];
  profile: CsvFormatProfile | null;
  /** profile が null のときの理由 */
  stopReason?: string;
}

export function analyzeHeaders(headerRow: string[]): HeaderAnalysis {
  const map: Record<string, number> = {};
  const recognized: CsvColumnMatch[] = [];
  const unrecognized: string[] = [];

  headerRow.forEach((header, idx) => {
    const forms = [stripped(header), underscored(header)];
    let matched = false;
    for (const rule of FIELD_RULES) {
      if (forms.some((h) => rule.test(h))) {
        map[rule.field] = idx;
        recognized.push({ header, field: rule.field });
        matched = true;
      }
    }
    if (!matched && header.trim() !== '') unrecognized.push(header);
  });

  const has = (f: string) => map[f] !== undefined;
  const profile =
    CSV_FORMAT_PROFILES.find(
      (p) => p.requires.every(has) && (!p.requiresAnyOf || p.requiresAnyOf.some(has))
    ) ?? null;

  if (profile) return { map, recognized, unrecognized, profile };

  const billing = CSV_FORMAT_PROFILES[CSV_FORMAT_PROFILES.length - 1];
  const missing = billing.requires.filter((f) => !has(f));
  const reason = missing.length
    ? `必須列を認識できません: ${missing.join(', ')}（列名の例: ${REQUIRED_COLUMN_EXAMPLES[missing[0]] ?? missing[0]}）`
    : `使用量・金額の列を認識できません（${(billing.requiresAnyOf ?? []).join(' / ')} のいずれかが必要）`;
  return {
    map,
    recognized,
    unrecognized,
    profile: null,
    stopReason: `${reason}。認識できた列: ${recognized.map((r) => r.field).join(', ') || 'なし'}`,
  };
}

const REQUIRED_COLUMN_EXAMPLES: Record<string, string> = {
  username: 'username / login / user',
};
