import { ForkSafeStorageWriter } from '../adapters/storage/ForkSafeStorageWriter.js';
import { MonthCloseService } from '../application/pipeline/month-close.js';
import { parseBusinessCalendar } from '../processor/month-close.js';

/**
 * 月次締め (P4-2)。
 *   npm run month:close    締め日 (翌月の第 N 営業日) を迎えた月を確定する
 *   npm run month:verify   確定月の数値が、改訂の記録なしに変わっていないか検査する (変わっていれば exit 1)
 * 営業日カレンダーは環境変数 COPILOT_BUSINESS_CALENDAR (JSON) で設定する。
 */
function main(): number {
  const command = process.argv[2] ?? 'close';
  const storage = new ForkSafeStorageWriter({ isDemo: process.argv.includes('--demo') });
  const cal = parseBusinessCalendar(process.env.COPILOT_BUSINESS_CALENDAR);
  if (cal.error) {
    console.error(`❌ COPILOT_BUSINESS_CALENDAR: ${cal.error}`);
    return 1;
  }
  const svc = new MonthCloseService(storage, { now: new Date(), calendar: cal.config });

  if (command === 'close') {
    const closed = svc.closeDueMonths();
    console.log(closed.length > 0 ? `✅ Closed ${closed.length} month(s): ${closed.join(', ')}.` : 'ℹ️ No month is due for closing.');
    return 0;
  }
  if (command === 'verify') {
    const problems = svc.verify();
    if (problems.length === 0) {
      console.log(`✅ ${svc.closedMonthsMap().size} closed month(s) verified: no figure changed without a recorded revision.`);
      return 0;
    }
    for (const p of problems) {
      console.error(`❌ ${p.month}: ${p.message}`);
      for (const d of p.diff.slice(0, 10)) console.error(`   - ${d.key}: ${d.before ?? '—'} -> ${d.after ?? '—'}`);
    }
    console.error('   Record the change with `npm run pipeline:reprocess -- --revise <month> --reason "<reason>"`.');
    return 1;
  }
  console.error('Usage: tsx src/cli/month-close.ts <close|verify> [--demo]');
  return 2;
}

process.exit(main());
