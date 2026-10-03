import type { CsvImportReport } from '../domain/entities/csv-import.js';

const UNIT_LABELS: Record<string, string> = {
  requests: 'リクエスト',
  credits: 'AI クレジット',
  seats: 'シート',
  tokens: 'トークン',
  other: 'その他の単位',
};

export const csvUnitLabel = (unit: string): string => UNIT_LABELS[unit] ?? unit;

const fmt = (v: number | null, digits = 2): string =>
  v === null ? '—（値なし）' : v.toLocaleString('en-US', { maximumFractionDigits: digits });

/** 取込レポートを、CLI やログに出せる行にする (値は件数・列名・合計のみ) */
export function formatCsvImportReport(report: CsvImportReport): string[] {
  const lines: string[] = [];
  lines.push(`取込レポート${report.file_name ? ` (${report.file_name})` : ''}`);
  if (!report.profile) {
    lines.push(`  ❌ 取り込めません: ${report.stop_reason ?? 'フォーマットを判別できません'}`);
    if (report.columns.unrecognized.length > 0) lines.push(`  未認識の列: ${report.columns.unrecognized.join(', ')}`);
    return lines;
  }
  lines.push(`  フォーマット: ${report.profile.label}`);
  lines.push(
    `  行: ${report.rows.imported}/${report.rows.total} 行を取込` +
      (report.rows.skipped > 0 ? `、${report.rows.skipped} 行をスキップ` : '')
  );
  for (const [reason, count] of Object.entries(report.rows.skipped_by_reason)) {
    lines.push(`    - ${reason}: ${count} 行`);
  }
  if (report.columns.unrecognized.length > 0) lines.push(`  未認識の列: ${report.columns.unrecognized.join(', ')}`);
  for (const t of report.totals_by_unit) {
    lines.push(
      `  ${csvUnitLabel(t.unit)}: ${t.rows} 行 / 数量 ${fmt(t.quantity, 4)} / gross ${fmt(t.gross_usd)} USD / net ${fmt(t.net_usd)} USD`
    );
  }
  for (const w of report.warnings) lines.push(`  ⚠️ ${w}`);
  return lines;
}
