/**
 * NDJSON (1 行 1 JSON) のパーサー。
 *
 * Usage Metrics Reports API は、署名付き URL の先に NDJSON ファイルを置く。1 行が壊れていても
 * ファイル全体を捨てないよう、行単位で解析し、壊れた行は件数と (値を含まない) 理由だけを返す。
 */
export interface NdjsonParseResult {
  rows: unknown[];
  /** JSON として解釈できなかった行数 */
  malformed: number;
  /** 壊れた行の理由 (先頭数件。行の内容は含めない: 個人情報を残さない) */
  malformedReasons: string[];
}

const MAX_REASONS = 3;

export function parseNdjson(text: string): NdjsonParseResult {
  const rows: unknown[] = [];
  let malformed = 0;
  const malformedReasons: string[] = [];

  // 改行は LF / CRLF の両方を許容する
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') continue;
    try {
      rows.push(JSON.parse(line));
    } catch (err: any) {
      malformed++;
      if (malformedReasons.length < MAX_REASONS) {
        malformedReasons.push(`line ${i + 1}: ${String(err?.message ?? 'invalid JSON').slice(0, 80)}`);
      }
    }
  }
  return { rows, malformed, malformedReasons };
}
