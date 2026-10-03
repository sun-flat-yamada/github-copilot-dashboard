import { RawApiClient } from '../RawApiClient.js';
import {
  AiCreditUsageItem,
  aiCreditUsageResponseSchema,
  validateAiCreditUsageItem,
} from './ai-credit-usage-schema.js';

const ENDPOINT = '/enterprises/{ent}/settings/billing/ai_credit/usage';
const DEFAULT_CONCURRENCY = 4;

export type AiCreditDayOutcome =
  | { day: string; outcome: 'ok'; items: number }
  /** 404: その日のレポートが無い、または権限が無い (GitHub は権限不足にも 404 を返すことがある) */
  | { day: string; outcome: 'empty'; status: number }
  | { day: string; outcome: 'error'; error: Error };

export interface AiCreditRangeResult {
  /** 日付 → 検証済みの明細 (昇順に走査した順) */
  itemsByDay: Map<string, AiCreditUsageItem[]>;
  outcomes: AiCreditDayOutcome[];
  /** 検証に失敗して隔離した明細の数 */
  quarantined: number;
  quarantineReasons: string[];
}

/**
 * AI credit usage API のクライアント (Enterprise 単位)。1 日 1 リクエスト (year / month / day)。
 * 日単位の失敗は outcomes に記録して他を続行する (呼び出し側が SourceStatus を決める)。
 */
export class AiCreditUsageClient {
  private concurrency: number;

  constructor(
    private readonly fetcher: RawApiClient,
    options: { concurrency?: number } = {}
  ) {
    this.concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  }

  async fetchDay(
    enterprise: string,
    day: string
  ): Promise<{ status: number; items: AiCreditUsageItem[] | null; quarantined: number; reasons: string[] }> {
    const [year, month, dayOfMonth] = day.split('-').map(Number);
    const { status, body } = await this.fetcher.fetchRawAllowing<unknown>(
      ENDPOINT,
      { ent: enterprise },
      { year, month, day: dayOfMonth },
      [404]
    );
    if (body === null) return { status, items: null, quarantined: 0, reasons: [] };

    const parsed = aiCreditUsageResponseSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new Error(`Unexpected AI credit usage response shape: ${issue.path.join('.') || '(body)'}: ${issue.message}`);
    }
    const period = parsed.data.timePeriod;
    if (period.year !== year || (period.month !== undefined && period.month !== month) || (period.day !== undefined && period.day !== dayOfMonth)) {
      throw new Error(`AI credit usage period mismatch: requested ${day}`);
    }

    const items: AiCreditUsageItem[] = [];
    let quarantined = 0;
    const reasons: string[] = [];
    for (const raw of parsed.data.usageItems) {
      const result = validateAiCreditUsageItem(raw);
      if (result.ok) {
        items.push(result.item);
      } else {
        quarantined++;
        if (reasons.length < 3) reasons.push(result.reason);
      }
    }
    return { status, items, quarantined, reasons };
  }

  async fetchRange(enterprise: string, days: string[]): Promise<AiCreditRangeResult> {
    const outcomes: AiCreditDayOutcome[] = new Array(days.length);
    const itemsByDay = new Map<string, AiCreditUsageItem[]>();
    let quarantined = 0;
    const quarantineReasons: string[] = [];

    let next = 0;
    const worker = async () => {
      while (true) {
        const i = next++;
        if (i >= days.length) return;
        const day = days[i];
        try {
          const result = await this.fetchDay(enterprise, day);
          quarantined += result.quarantined;
          for (const r of result.reasons) if (quarantineReasons.length < 3) quarantineReasons.push(`${day} ${r}`);
          if (result.items === null) {
            outcomes[i] = { day, outcome: 'empty', status: result.status };
          } else {
            itemsByDay.set(day, result.items);
            outcomes[i] = { day, outcome: 'ok', items: result.items.length };
          }
        } catch (err: any) {
          outcomes[i] = { day, outcome: 'error', error: err };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, days.length) }, worker));

    const sorted = new Map([...itemsByDay.entries()].sort(([a], [b]) => a.localeCompare(b)));
    return { itemsByDay: sorted, outcomes, quarantined, quarantineReasons };
  }
}
