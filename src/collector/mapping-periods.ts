/**
 * 属性マッピングの実効期間 (SCD Type 2) を扱う純関数。
 * ブラウザでも動くよう Node 固有の API には依存しない。
 *
 * 期間は valid_from / valid_to (YYYY-MM-DD, 両端を含む)。省略した側は無制限。
 * 期間を一切持たないマッピングは従来どおり無期限の 1 行として扱う (後方互換)。
 */

export interface PeriodEntry {
  valid_from?: string;
  valid_to?: string;
}

export interface MappingPeriodIssue {
  severity: 'error' | 'warning';
  code: 'invalid_date' | 'invalid_range' | 'overlap' | 'gap';
  /** 個人を特定しない説明 (ログイン名は含めない) */
  message: string;
  /** 同一ユーザーの行のうち問題のある行の 0 起点の位置 (入力順) */
  indexes: number[];
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** YYYY-MM-DD として実在する日付か */
export function isValidDateString(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** YYYY-MM-DD はそのまま、YYYY-MM は月末日にする。解釈できなければ undefined */
export function normalizeAsOf(asOf: string | undefined): string | undefined {
  if (!asOf) return undefined;
  const trimmed = asOf.trim();
  if (isValidDateString(trimmed)) return trimmed;
  const m = MONTH_RE.exec(trimmed);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) {
      const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      return `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`;
    }
  }
  // 日時文字列 (ISO 8601) は日付部分だけを使う
  const head = trimmed.slice(0, 10);
  return isValidDateString(head) ? head : undefined;
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

const FAR_PAST = '0000-01-01';
const FAR_FUTURE = '9999-12-31';

function bounds(e: PeriodEntry): { from: string; to: string } {
  return { from: e.valid_from || FAR_PAST, to: e.valid_to || FAR_FUTURE };
}

/**
 * 同一ユーザーの実効期間の行を検証する。
 * - 不正な日付・from > to: error
 * - 期間の重複: error (解決時は valid_from が新しい行を優先する)
 * - 期間の隙間: warning (隙間の日は未登録として扱う)
 */
export function validateMappingPeriods(entries: PeriodEntry[]): MappingPeriodIssue[] {
  const issues: MappingPeriodIssue[] = [];
  const usable: { index: number; from: string; to: string }[] = [];

  entries.forEach((e, index) => {
    const badFrom = e.valid_from !== undefined && e.valid_from !== '' && !isValidDateString(e.valid_from);
    const badTo = e.valid_to !== undefined && e.valid_to !== '' && !isValidDateString(e.valid_to);
    if (badFrom || badTo) {
      issues.push({
        severity: 'error',
        code: 'invalid_date',
        message: 'valid_from / valid_to must be a real date in YYYY-MM-DD format',
        indexes: [index],
      });
      return;
    }
    const b = bounds(e);
    if (b.from > b.to) {
      issues.push({
        severity: 'error',
        code: 'invalid_range',
        message: 'valid_from must not be later than valid_to',
        indexes: [index],
      });
      return;
    }
    usable.push({ index, ...b });
  });

  // 期間を持つ行が 2 行以上ある (または期間なしが複数ある) ときだけ重複・隙間を見る
  const sorted = [...usable].sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.from <= prev.to) {
      issues.push({
        severity: 'error',
        code: 'overlap',
        message: 'effective periods overlap',
        indexes: [prev.index, cur.index],
      });
    } else if (prev.to !== FAR_FUTURE && nextDay(prev.to) < cur.from) {
      issues.push({
        severity: 'warning',
        code: 'gap',
        message: 'there is a gap between effective periods (the gap is treated as unmapped)',
        indexes: [prev.index, cur.index],
      });
    }
  }
  return issues;
}

/**
 * asOf (YYYY-MM-DD または YYYY-MM=月末日) に有効な行を選ぶ。
 * - asOf 省略 (または解釈不能): 現行の行 = 開始日が最も新しい行 (期間なしだけなら最後の行)
 * - 該当なし: undefined (呼び出し側が未登録のフォールバックを使う)
 * - 重複: 開始日が新しい行、同じなら入力順で後の行
 */
export function selectEffectiveEntry<T extends PeriodEntry>(entries: T[], asOf?: string): T | undefined {
  if (entries.length === 0) return undefined;
  const date = normalizeAsOf(asOf);
  let best: { e: T; from: string; order: number } | undefined;
  entries.forEach((e, order) => {
    const b = bounds(e);
    if (date !== undefined && (date < b.from || date > b.to)) return;
    if (!best || b.from > best.from || (b.from === best.from && order > best.order)) {
      best = { e, from: b.from, order };
    }
  });
  return best?.e;
}
