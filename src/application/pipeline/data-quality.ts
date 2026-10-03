import {
  DATA_QUALITY_HISTORY_LIMIT,
  DATA_QUALITY_SCHEMA_VERSION,
  DataQualityHistory,
  DataQualityLevel,
  DataQualityReport,
  DataQualitySummary,
  DataQualityTrend,
  QualityObservations,
} from '../../domain/entities/data-quality.js';
import type { SourceStatus } from '../../domain/entities/copilot.js';

export const DATA_QUALITY_HISTORY_FILE = 'quality/history.json';

const SEVERITY: Record<DataQualityLevel, number> = { ok: 0, warning: 1, error: 2 };

export function buildDataQualityReport(
  obs: QualityObservations,
  statuses: SourceStatus[],
  nowIso: string,
  runId?: string
): DataQualityReport {
  const available = new Set(obs.available_days);
  const missing_days = obs.requested_days.filter((d) => !available.has(d));
  const sources = statuses.map((s) => ({
    source: s.source,
    status: s.status,
    records: s.records,
    quarantined: s.quarantined ?? 0,
  }));

  let level: DataQualityLevel = 'ok';
  // 利用状況・シート・Cost Center の失敗は異常。AI Credits (Billing の権限が別) の失敗は注意に留める
  if (sources.some((s) => s.status === 'failed' && s.source !== 'ai_credits')) {
    level = 'error';
  } else if (
    sources.some((s) => s.status === 'partial' || s.status === 'failed') ||
    missing_days.length > 0 ||
    obs.out_of_range > 0 ||
    obs.quarantined > 0 ||
    obs.malformed_lines > 0
  ) {
    level = 'warning';
  }

  return {
    schema_version: DATA_QUALITY_SCHEMA_VERSION,
    generated_at: nowIso,
    ...(runId ? { run_id: runId } : {}),
    window:
      obs.requested_days.length > 0
        ? { start: obs.requested_days[0], end: obs.requested_days[obs.requested_days.length - 1] }
        : null,
    missing_days,
    duplicates_collapsed: obs.duplicates_collapsed,
    out_of_range: obs.out_of_range,
    quarantined: obs.quarantined,
    malformed_lines: obs.malformed_lines,
    sources,
    level,
  };
}

/** 履歴に追記する。同じ run_id (再処理) は置き換え、上限を超えた古い分は捨てる */
export function appendQualityHistory(
  history: DataQualityHistory | null,
  report: DataQualityReport
): DataQualityHistory {
  const kept = (history?.entries ?? []).filter((e) => !report.run_id || e.run_id !== report.run_id);
  const entries = [...kept, report].sort((a, b) => a.generated_at.localeCompare(b.generated_at));
  return {
    schema_version: DATA_QUALITY_SCHEMA_VERSION,
    entries: entries.slice(-DATA_QUALITY_HISTORY_LIMIT),
  };
}

export function summarizeQualityHistory(history: DataQualityHistory): DataQualitySummary | null {
  const entries = history.entries;
  if (entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;

  let trend: DataQualityTrend = 'first';
  if (previous) {
    const delta = SEVERITY[latest.level] - SEVERITY[previous.level];
    trend = delta > 0 ? 'degraded' : delta < 0 ? 'recovered' : 'unchanged';
  }

  // 直近で level が変わった時刻 (最新と同じ level が続き始めた最初の実行)
  let lastChange: string | null = null;
  for (let i = entries.length - 1; i > 0; i--) {
    if (entries[i].level !== entries[i - 1].level) {
      lastChange = entries[i].generated_at;
      break;
    }
  }

  return {
    level: latest.level,
    generated_at: latest.generated_at,
    missing_days_count: latest.missing_days.length,
    out_of_range: latest.out_of_range,
    quarantined: latest.quarantined,
    malformed_lines: latest.malformed_lines,
    trend,
    previous_level: previous?.level ?? null,
    last_change_at: lastChange,
    history_file: DATA_QUALITY_HISTORY_FILE,
  };
}
