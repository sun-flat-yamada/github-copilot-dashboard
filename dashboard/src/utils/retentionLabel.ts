/** `COPILOT_DATA_RETENTION_MONTHS` の既定値 (src/domain/entities/retention.ts と同じ。SDD-17 §8.1) */
export const DEFAULT_RETENTION_MONTHS = 60;

/** About モーダルの保持期間表示。月数が無い旧 index.json (旧項目 data_retention_days のみ) は既定の 60 か月として扱う */
export function formatRetention(months: number | undefined): string {
  const m = Number.isInteger(months) && (months as number) > 0 ? (months as number) : DEFAULT_RETENTION_MONTHS;
  return m % 12 === 0 ? `${m / 12} 年 (${m} か月)` : `${m} か月`;
}
