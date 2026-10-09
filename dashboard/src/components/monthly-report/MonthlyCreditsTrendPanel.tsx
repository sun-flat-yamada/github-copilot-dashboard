import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  Coins,
  Layers,
  Info,
} from 'lucide-react';
import type { MonthlyReportAggregatedData } from '../../../../src/types/copilot';
import { loadReportDataset, loadIndexDataset } from '../../dataset/datasetLoader';
import {
  buildMonthlyCreditsTrend,
  filterCreditsTrendByRange,
  type MonthlyCreditsTrendPoint,
  type DailyCreditsTrendPoint,
} from '../../utils/monthlyCreditsTrend';
import { AccessibleChart } from '../common/AccessibleChart';

interface MonthlyCreditsTrendPanelProps {
  /** 利用可能な月次レポート一覧 (例: ['2026-08', '2026-09'])。未指定時は index.json より自動取得 */
  availableMonths?: string[];
  /** 既に取得済みの現在選択中レポートデータ (オプション) */
  currentReportData?: MonthlyReportAggregatedData | null;
  /** データベースディレクトリ (例: './data' または './data/demo') */
  baseDir?: string;
  /** デモデータ表示フラグ */
  isDemo?: boolean;
}

export const MonthlyCreditsTrendPanel: React.FC<MonthlyCreditsTrendPanelProps> = ({
  availableMonths: propAvailableMonths,
  currentReportData,
  baseDir = './data',
  isDemo = false,
}) => {
  // 自動取得された利用可能月一覧
  const [fetchedMonths, setFetchedMonths] = useState<string[]>([]);

  // 利用可能月の解決
  const availableMonths = useMemo(() => {
    if (propAvailableMonths && propAvailableMonths.length > 0) return propAvailableMonths;
    if (fetchedMonths.length > 0) return fetchedMonths;
    if (currentReportData?.report_month) return [currentReportData.report_month];
    return [];
  }, [propAvailableMonths, fetchedMonths, currentReportData]);

  // propAvailableMonths が無い場合、index.json から available_reports を取得
  useEffect(() => {
    if (propAvailableMonths && propAvailableMonths.length > 0) return;

    let isCancelled = false;
    async function fetchIndex() {
      try {
        const res = await loadIndexDataset(baseDir);
        if (res.state !== 'failed' && res.data?.available_reports && !isCancelled) {
          setFetchedMonths(res.data.available_reports);
        }
      } catch {
        // index取得失敗時は currentReportData のみでフォールバック
      }
    }
    fetchIndex();
    return () => {
      isCancelled = true;
    };
  }, [baseDir, propAvailableMonths]);

  // レポートデータの月別キャッシュ
  const [reportsMap, setReportsMap] = useState<Map<string, MonthlyReportAggregatedData>>(
    () => new Map()
  );
  const [loading, setLoading] = useState<boolean>(false);

  // currentReportData があれば即時マップに登録
  useEffect(() => {
    if (currentReportData?.report_month) {
      setReportsMap((prev) => {
        const next = new Map(prev);
        next.set(currentReportData.report_month, currentReportData);
        return next;
      });
    }
  }, [currentReportData]);

  // 利用可能な月次レポートの全件取得
  useEffect(() => {
    if (availableMonths.length === 0) return;

    let isCancelled = false;
    async function fetchAllReports() {
      setLoading(true);
      try {
        const fetchedMap = new Map<string, MonthlyReportAggregatedData>();
        if (currentReportData?.report_month) {
          fetchedMap.set(currentReportData.report_month, currentReportData);
        }

        for (const month of availableMonths) {
          if (fetchedMap.has(month)) continue;
          try {
            const res = await loadReportDataset(baseDir, month);
            if (res.state !== 'failed' && res.data) {
              fetchedMap.set(month, res.data);
            }
          } catch {
            // 個別月の取得失敗は無視して可能な限り表示
          }
        }

        if (!isCancelled) {
          setReportsMap(fetchedMap);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchAllReports();

    return () => {
      isCancelled = true;
    };
  }, [availableMonths, baseDir, currentReportData]);

  // 全レポートから月次トレンド配列を構築
  const allMonthlyPoints = useMemo<MonthlyCreditsTrendPoint[]>(() => {
    const reports = Array.from(reportsMap.values());
    return buildMonthlyCreditsTrend(reports);
  }, [reportsMap]);

  // データ範囲選択状態
  const sortedMonths = useMemo(() => {
    return [...availableMonths].sort((a, b) => a.localeCompare(b));
  }, [availableMonths]);

  const [startMonth, setStartMonth] = useState<string>('');
  const [endMonth, setEndMonth] = useState<string>('');

  useEffect(() => {
    if (sortedMonths.length > 0) {
      if (!startMonth || !sortedMonths.includes(startMonth)) {
        setStartMonth(sortedMonths[0] ?? '');
      }
      if (!endMonth || !sortedMonths.includes(endMonth)) {
        setEndMonth(sortedMonths[sortedMonths.length - 1] ?? '');
      }
    }
  }, [sortedMonths, startMonth, endMonth]);

  // 選択範囲でフィルタされた月次ポイント
  const filteredMonthlyPoints = useMemo(() => {
    return filterCreditsTrendByRange(allMonthlyPoints, startMonth, endMonth);
  }, [allMonthlyPoints, startMonth, endMonth]);

  // 指定月内の変化を表示する対象月
  const [selectedMonthForDaily, setSelectedMonthForDaily] = useState<string>('');

  useEffect(() => {
    if (currentReportData?.report_month) {
      setSelectedMonthForDaily(currentReportData.report_month);
    } else if (filteredMonthlyPoints.length > 0) {
      // 範囲内の最後の月をデフォルトに
      setSelectedMonthForDaily(filteredMonthlyPoints[filteredMonthlyPoints.length - 1]?.month ?? '');
    }
  }, [currentReportData, filteredMonthlyPoints]);

  // 指定月の詳細データ
  const selectedMonthPoint = useMemo(() => {
    return allMonthlyPoints.find((p) => p.month === selectedMonthForDaily) ?? null;
  }, [allMonthlyPoints, selectedMonthForDaily]);

  // 指定月の日別データ
  const dailyProgression = useMemo<DailyCreditsTrendPoint[]>(() => {
    return selectedMonthPoint?.dailyTrends ?? [];
  }, [selectedMonthPoint]);

  // 表示モード (累積増加グラフ / 日別消費量)
  const [dailyViewMode, setDailyViewMode] = useState<'cumulative' | 'daily' | 'both'>('both');

  // ハンドラー
  const handleMonthBarClick = useCallback((month: string) => {
    setSelectedMonthForDaily(month);
  }, []);

  if (availableMonths.length === 0 && !currentReportData) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
        <Coins className="w-8 h-8 mx-auto text-slate-600 mb-2" />
        <p className="text-sm">確定月次CSVデータが登録されていません。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="monthly-credits-trend-panel">
      {/* 1. コントロールバー: データ範囲選択 & 指定月選択 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span>確定月次 AI Credit 消費推移</span>
              {isDemo && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                  DEMO
                </span>
              )}
            </h4>
            <p className="text-xs text-slate-400">
              確定月次CSVに基づく月別変化および月内の日別総量増加推移
            </p>
          </div>
        </div>

        {/* データ範囲選択セレクター */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">データ範囲:</span>
            <select
              aria-label="開始月"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              {sortedMonths.map((m) => (
                <option key={`start-${m}`} value={m} className="bg-slate-900 text-slate-200">
                  {m}
                </option>
              ))}
            </select>
            <span className="text-slate-500">〜</span>
            <select
              aria-label="終了月"
              value={endMonth}
              onChange={(e) => setEndMonth(e.target.value)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              {sortedMonths.map((m) => (
                <option key={`end-${m}`} value={m} className="bg-slate-900 text-slate-200">
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* クイックリセット */}
          <button
            type="button"
            onClick={() => {
              if (sortedMonths.length > 0) {
                setStartMonth(sortedMonths[0] ?? '');
                setEndMonth(sortedMonths[sortedMonths.length - 1] ?? '');
              }
            }}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition border border-slate-700"
          >
            全期間
          </button>
        </div>
      </div>

      {loading && filteredMonthlyPoints.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
          <p className="text-xs">確定月次CSVデータを読み込み中です...</p>
        </div>
      )}

      {/* 2. グラフ 1: 登録されている確定月次CSVの月次変化 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>月次 AI Credit 消費の推移 (確定月次CSV)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              選択した範囲 ({startMonth || '—'} 〜 {endMonth || '—'}) における月ごとのAI Credit消費総量
              (棒をクリックすると指定月が切り替わります)
            </p>
          </div>

          {selectedMonthPoint && (
            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
              <span className="text-slate-400">現在選択月:</span>
              <span className="font-bold text-amber-300 font-mono">{selectedMonthPoint.month}</span>
              <span className="text-slate-500">|</span>
              <span className="font-bold text-emerald-400 font-mono">
                {selectedMonthPoint.totalCredits.toLocaleString()} Credits
              </span>
            </div>
          )}
        </div>

        {filteredMonthlyPoints.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">選択範囲内にデータがありません。</p>
        ) : (
          <AccessibleChart
            title="月次 AI Credit 消費推移"
            summary={`選択期間の確定月次CSV ${filteredMonthlyPoints.length} ヶ月分のAI Credit消費推移`}
            testId="monthly-credits-trend-chart"
            columns={[
              { key: 'month', label: '対象月' },
              { key: 'credits', label: '消費 AI Credits' },
              { key: 'cost', label: '換算費用 (USD)' },
              { key: 'mom', label: '前月比' },
              { key: 'users', label: 'アクティブ人数' },
            ]}
            rows={filteredMonthlyPoints.map((p) => ({
              month: p.month,
              credits: `${p.totalCredits.toLocaleString()} Credits`,
              cost: `$${p.totalSpendUsd.toFixed(2)}`,
              mom:
                p.momCreditsDelta === null
                  ? '—'
                  : `${p.momCreditsDelta >= 0 ? '+' : ''}${p.momCreditsDelta.toLocaleString()} (${p.momCreditsRate !== null ? `${p.momCreditsRate}%` : '—'})`,
              users: `${p.activeUsers} 名`,
            }))}
          >
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredMonthlyPoints}
                  margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  onClick={(e: any) => {
                    const payload = e?.activePayload?.[0]?.payload;
                    if (payload?.month) handleMonthBarClick(payload.month);
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                  <YAxis
                    stroke="#f59e0b"
                    fontSize={11}
                    tickFormatter={(v: number) => `${v.toLocaleString()} c`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d13',
                      borderColor: '#334155',
                      borderRadius: 8,
                      fontSize: '11px',
                    }}
                    formatter={(val: any, name: any) => {
                      if (name === '消費 AI Credits') return [`${Number(val).toLocaleString()} Credits`, name];
                      return [val, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  <Bar
                    dataKey="totalCredits"
                    name="消費 AI Credits"
                    fill="#f59e0b"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </AccessibleChart>
        )}
      </div>

      {/* 3. グラフ 2: 指定月内の変化 (日ごとのAI Credit消費総量の増加を見るグラフ) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-bold text-white">
                指定月内の推移: {selectedMonthForDaily || '未選択'} (日ごとのAI Credit消費総量の増加)
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              指定された月における日次消費ペースと、月末に向けた累積AI Credit消費総量の増加推移
            </p>
          </div>

          {/* 月切替セレクター ＆ 表示切替 */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400">表示月:</span>
              <select
                aria-label="詳細表示月"
                value={selectedMonthForDaily}
                onChange={(e) => setSelectedMonthForDaily(e.target.value)}
                className="bg-transparent text-amber-300 font-bold font-mono text-xs focus:outline-none cursor-pointer"
              >
                {sortedMonths.map((m) => (
                  <option key={`daily-month-${m}`} value={m} className="bg-slate-900 text-slate-200">
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setDailyViewMode('both')}
                className={`px-2.5 py-1 rounded-md transition text-[11px] ${
                  dailyViewMode === 'both' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                累積＋日次
              </button>
              <button
                type="button"
                onClick={() => setDailyViewMode('cumulative')}
                className={`px-2.5 py-1 rounded-md transition text-[11px] ${
                  dailyViewMode === 'cumulative' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                累積総量
              </button>
              <button
                type="button"
                onClick={() => setDailyViewMode('daily')}
                className={`px-2.5 py-1 rounded-md transition text-[11px] ${
                  dailyViewMode === 'daily' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                日別消費
              </button>
            </div>
          </div>
        </div>

        {dailyProgression.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center text-slate-500 text-xs">
            <Info className="w-5 h-5 mx-auto mb-1 text-slate-600" />
            <p>指定された月 ({selectedMonthForDaily}) の日別データが存在しません。</p>
          </div>
        ) : (
          <AccessibleChart
            title={`${selectedMonthForDaily} 日別 AI Credit 消費推移`}
            summary={`${selectedMonthForDaily} の日別AI Credit消費量と累積消費総量の推移`}
            testId="daily-credits-progression-chart"
            columns={[
              { key: 'date', label: '日付' },
              { key: 'daily', label: '当日消費 Credits' },
              { key: 'cumulative', label: '累積消費総量' },
              { key: 'spend', label: '当日費用 (USD)' },
              { key: 'active', label: 'アクティブ人数' },
            ]}
            rows={dailyProgression.map((d) => ({
              date: d.date,
              daily: `${d.dailyCredits.toLocaleString()} c`,
              cumulative: `${d.cumulativeCredits.toLocaleString()} c`,
              spend: `$${d.dailySpendUsd.toFixed(2)}`,
              active: `${d.activeUsers} 名`,
            }))}
          >
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyProgression}
                  margin={{ top: 10, right: 15, left: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="creditsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} />
                  <YAxis
                    yAxisId="left"
                    stroke="#10b981"
                    fontSize={11}
                    tickFormatter={(v: number) => `${v.toLocaleString()}`}
                  />
                  {(dailyViewMode === 'both' || dailyViewMode === 'daily') && (
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#f59e0b"
                      fontSize={11}
                      tickFormatter={(v: number) => `${v.toLocaleString()}`}
                    />
                  )}
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090d13',
                      borderColor: '#334155',
                      borderRadius: 8,
                      fontSize: '11px',
                    }}
                    formatter={(val: any, name: any) => {
                      if (name.includes('Credits') || name.includes('総量') || name.includes('消費')) {
                        return [`${Number(val).toLocaleString()} Credits`, name];
                      }
                      return [val, name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />

                  {(dailyViewMode === 'both' || dailyViewMode === 'cumulative') && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="cumulativeCredits"
                      name="累積 AI Credit 消費総量"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#creditsAreaGradient)"
                    />
                  )}

                  {(dailyViewMode === 'both' || dailyViewMode === 'daily') && (
                    <Bar
                      yAxisId={dailyViewMode === 'daily' ? 'left' : 'right'}
                      dataKey="dailyCredits"
                      name="日別 AI Credit 消費量"
                      fill="#f59e0b"
                      radius={[3, 3, 0, 0]}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </AccessibleChart>
        )}
      </div>
    </div>
  );
};
