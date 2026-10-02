import React from 'react';
import { UsageInsight } from '../../../../src/types/copilot';
import {
  describeSignal,
  SIGNAL_DEFINITIONS,
  USAGE_INSIGHT_ADVICE,
  USAGE_INSIGHT_DISCLAIMER,
} from '../../../../src/processor/usage-insight-definitions';
import { UsageSignalBadge } from '../common/UsageSignalBadge';
import { useCurrency } from '../../contexts/CurrencyContext';

const num = (n: number | null | undefined, d = 0): string =>
  n === null || n === undefined ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d });

interface UsageInsightPanelProps {
  insight: UsageInsight;
}

/** ユーザー明細の行を開いたときに出す「使用量と効率」。値の無い項目は「—」とし、理由を添える。 */
export const UsageInsightPanel: React.FC<UsageInsightPanelProps> = ({ insight }) => {
  const { formatMoney } = useCurrency();
  const { usage, tokens, unit_cost: cost } = insight;
  const money = (v: number | null) => {
    if (v === null) return '—';
    const m = formatMoney(v);
    return m.sub ? `${m.usd} (${m.sub})` : m.usd;
  };
  const maxDaily = Math.max(1, ...insight.daily.map((d) => d.tokens ?? d.requests ?? 0));
  const noTokens = tokens === null ? 'トークン列のない CSV のため' : '';

  return (
    <div className="bg-slate-900/70 border-b border-slate-800 px-4 py-3 space-y-3 text-xs whitespace-normal" data-testid="usage-insight-panel">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-bold text-white">使用量と効率</h4>
        <UsageSignalBadge level={insight.level} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        <div><dt className="text-slate-500">リクエスト</dt><dd className="text-slate-100 font-mono">{num(usage.requests)}</dd></div>
        <div><dt className="text-slate-500">クレジット</dt><dd className="text-slate-100 font-mono">{num(usage.credits, 1)}</dd></div>
        <div><dt className="text-slate-500">利用日数</dt><dd className="text-slate-100 font-mono">{num(usage.active_days)} 日</dd></div>
        <div>
          <dt className="text-slate-500">1 利用日あたり</dt>
          <dd className="text-slate-100 font-mono">
            {num(usage.per_active_day, 1)} {usage.per_active_day_unit === 'credits' ? 'クレジット' : usage.per_active_day_unit ? 'リクエスト' : ''}
          </dd>
        </div>
        <div title={noTokens}><dt className="text-slate-500">トークン合計</dt><dd className="text-slate-100 font-mono">{num(tokens?.total)}</dd></div>
        <div title={noTokens}><dt className="text-slate-500">入力 / 出力</dt><dd className="text-slate-100 font-mono">{num(tokens?.input)} / {num(tokens?.output)}</dd></div>
        <div title={noTokens}><dt className="text-slate-500">キャッシュ 読取 / 書込</dt><dd className="text-slate-100 font-mono">{num(tokens?.cache_read)} / {num(tokens?.cache_write)}</dd></div>
        <div title="トークンを持つ明細行の割合。低いと他の指標の信頼度が下がります"><dt className="text-slate-500">トークン取得率</dt><dd className="text-slate-100 font-mono">{tokens ? `${Math.round(tokens.coverage * 100)}%` : '—'}</dd></div>
        <div title="利用額 ÷ トークン合計 (キャッシュを含む混合単価)"><dt className="text-slate-500">コスト / 100 万トークン</dt><dd className="text-slate-100 font-mono">{money(cost.per_million_tokens_usd)}</dd></div>
        <div><dt className="text-slate-500">コスト / リクエスト</dt><dd className="text-slate-100 font-mono">{money(cost.per_request_usd)}</dd></div>
        <div><dt className="text-slate-500">コスト / クレジット</dt><dd className="text-slate-100 font-mono">{money(cost.per_credit_usd)}</dd></div>
        <div>
          <dt className="text-slate-500">ピーク日</dt>
          <dd className="text-slate-100 font-mono">{usage.peak_day ? `${usage.peak_day.date} (${num(usage.peak_day.value, 1)})` : '—'}</dd>
        </div>
      </dl>

      <ul className="space-y-1.5" aria-label="長大化・混在の兆候">
        {insight.signals.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            <UsageSignalBadge level={s.level} />
            <span className="text-slate-300">
              <span className="font-semibold text-slate-200">{SIGNAL_DEFINITIONS[s.id].name}</span>
              {' — '}
              {describeSignal(s)}
            </span>
          </li>
        ))}
      </ul>

      {insight.level === 'review' && <p className="text-amber-300/90">{USAGE_INSIGHT_ADVICE}</p>}

      {insight.daily.length > 0 && (
        <div aria-label="日別の使用量">
          <div className="text-slate-500 mb-1">日別 ({insight.daily[0].tokens !== null ? 'トークン' : 'リクエスト'})</div>
          <div className="flex items-end gap-0.5 h-12">
            {insight.daily.map((d) => {
              const v = d.tokens ?? d.requests ?? 0;
              return (
                <div
                  key={d.date}
                  title={`${d.date}: ${num(v)}`}
                  className="flex-1 min-w-[3px] bg-indigo-500/70 rounded-t"
                  style={{ height: `${Math.max(4, (v / maxDaily) * 100)}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-500">{USAGE_INSIGHT_DISCLAIMER}</p>
    </div>
  );
};
