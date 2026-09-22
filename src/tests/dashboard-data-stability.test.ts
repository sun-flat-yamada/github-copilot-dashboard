import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Dashboard Data Stability & Infinite Loop Prevention Tests', async (t) => {
  const hookFilePath = path.resolve(process.cwd(), 'dashboard/src/hooks/useDashboardData.ts');
  const appFilePath = path.resolve(process.cwd(), 'dashboard/src/App.tsx');

  assert.ok(fs.existsSync(hookFilePath), 'useDashboardData.ts must exist');
  assert.ok(fs.existsSync(appFilePath), 'App.tsx must exist');

  const hookContent = fs.readFileSync(hookFilePath, 'utf-8');
  const appContent = fs.readFileSync(appFilePath, 'utf-8');

  await t.test('verifies Monthly Usage Report useEffect has no circular state dependencies', () => {
    // 1. currentReportData must NOT be in the dependency array
    assert.ok(
      !hookContent.includes('[selectedReportMonth, appMode, currentReportData]'),
      'useEffect must NOT contain currentReportData in dependency array (causes infinite loop)'
    );
    assert.ok(
      !hookContent.includes('[selectedReportMonth, currentReportData]'),
      'useEffect must NOT contain currentReportData in dependency array'
    );

    // 2. Dependency array should be precisely [selectedReportMonth]
    assert.ok(
      hookContent.includes('}, [selectedReportMonth]);'),
      'Monthly Usage Report useEffect must depend solely on [selectedReportMonth]'
    );
  });

  await t.test('verifies in-memory caching and race condition cancellation guards exist', () => {
    // 1. Report in-memory cache (data + isDemoSourced tuple, so cache hits restore per-source demo status)
    assert.ok(
      hookContent.includes(
        'reportCacheRef = useRef<Map<string, { data: MonthlyReportAggregatedData; isDemoSourced: boolean }>>'
      ),
      'useDashboardData must use reportCacheRef for in-memory memoization, storing isDemoSourced alongside data'
    );

    // 2. Redundant fetch guard via ref
    assert.ok(
      hookContent.includes('currentReportDataRef.current?.report_month === selectedReportMonth'),
      'useDashboardData must skip fetch if selectedReportMonth is already loaded in currentReportDataRef'
    );

    // 3. Race-condition cancellation token
    assert.ok(
      hookContent.includes('isCancelled = true'),
      'useDashboardData must set isCancelled = true in useEffect cleanup to prevent async race conditions'
    );
  });

  await t.test('verifies Live Metrics caching to prevent flicker on mode/tab toggle', () => {
    assert.ok(
      hookContent.includes(
        'scopeDataCacheRef = useRef<Map<string, { data: ScopeAggregatedData; isDemoSourced: boolean }>>'
      ),
      'useDashboardData must use scopeDataCacheRef for caching live metrics scopes, storing isDemoSourced alongside data'
    );
    assert.ok(
      hookContent.includes('currentDataRef.current?.scope_key === selectedKey'),
      'useDashboardData must skip redundant fetch if scope is already loaded'
    );
  });

  await t.test('verifies initial index load does not reset user-selected scope/report month on implicit isDemoMode flips', () => {
    // Regression test: loadIndex() unconditionally resets selectedKey/selectedReportMonth to the
    // metadata's "latest" defaults. If the mount effect re-runs loadIndex whenever isDemoMode changes
    // (e.g. a silent DEMO fallback triggered while fetching a specific scope/report), the user's
    // manual month selection gets clobbered back to the newest available month.
    // The mount effect must therefore run exactly once and must NOT list loadIndex as a dependency.
    assert.ok(
      !/useEffect\(\(\)\s*=>\s*\{\s*loadIndex\(\);\s*\}\s*,\s*\[loadIndex\]\)/.test(hookContent),
      'Initial loadIndex() useEffect must NOT depend on [loadIndex] (re-fires on every isDemoMode change and resets user selections)'
    );
    assert.ok(
      /useEffect\(\(\)\s*=>\s*\{\s*loadIndex\(\);[\s\S]*?\}\s*,\s*\[\]\)/.test(hookContent),
      'Initial loadIndex() useEffect must run exactly once on mount (empty dependency array)'
    );

    // Explicit user-initiated mode switching must still reset to the new mode's defaults.
    assert.ok(
      hookContent.includes("loadIndex(next ? './data/demo' : './data');"),
      'toggleDemoMode must continue to explicitly call loadIndex to reset defaults for the newly selected mode'
    );
  });

  await t.test('verifies per-source DEMO status tracking is decoupled from the global isDemoMode preference', () => {
    // Regression test: previously both the Live Metrics and Monthly Report fetch effects called the
    // SAME global setIsDemoMode(true) whenever THEIR OWN fetch fell back to a /demo/ path. Since
    // isDemoMode drove a single shared header badge, an unrelated Live Metrics fallback could mark
    // the entire app "DEMO" even while the user's actively-selected Monthly Report was genuinely LIVE.
    //
    // The fix must track "is this fetch's result demo-sourced" per data source, and must NOT mutate
    // the global isDemoMode flag as a side effect of an individual fetch's fallback resolution.
    assert.ok(
      !hookContent.includes("if (finalUrl.includes('/demo/') && !isDemoMode) {\n          setIsDemoMode(true);\n        }"),
      'Per-request /demo/ fallback detection must NOT flip the global isDemoMode flag anymore'
    );
    assert.ok(
      hookContent.includes('const [scopeDataIsDemoSourced, setScopeDataIsDemoSourced] = useState<boolean | undefined>(undefined);'),
      'useDashboardData must track whether the active Live Metrics data is demo-sourced, independently of isDemoMode'
    );
    assert.ok(
      hookContent.includes('const [reportDataIsDemoSourced, setReportDataIsDemoSourced] = useState<boolean | undefined>(undefined);'),
      'useDashboardData must track whether the active Monthly Report data is demo-sourced, independently of isDemoMode'
    );
    assert.ok(
      /const isDemoSourced = finalUrl\.includes\('\/demo\/'\);/.test(hookContent),
      'Both fetch effects must derive a local per-request isDemoSourced flag from finalUrl'
    );

    // The derived value exposed to the UI must resolve per-activeSource, defaulting user_upload to
    // "never demo" since an uploaded file is always the user's own real data.
    const activeDataIsDemoSourcedMemoMatch = hookContent.match(
      /const activeDataIsDemoSourced = useMemo\(\(\): boolean \| undefined => \{([\s\S]*?)\}, \[activeSource, scopeDataIsDemoSourced, reportDataIsDemoSourced\]\);/
    );
    assert.ok(activeDataIsDemoSourcedMemoMatch, 'useDashboardData must expose an activeDataIsDemoSourced derived memo');
    const memoBody = activeDataIsDemoSourcedMemoMatch![1];
    assert.match(memoBody, /if \(activeSource === 'user_upload'\) \{\s*return false;/, 'user_upload must always resolve to false (never DEMO)');
    assert.match(memoBody, /if \(activeSource === 'monthly_report'\) \{\s*return reportDataIsDemoSourced;/, 'monthly_report must resolve from reportDataIsDemoSourced');
    assert.match(memoBody, /return scopeDataIsDemoSourced;/, 'live_metrics (default) must resolve from scopeDataIsDemoSourced');

    // Must be returned from the hook so App.tsx / DashboardHeader can consume it.
    assert.ok(
      hookContent.includes('activeDataIsDemoSourced,'),
      'useDashboardData must return activeDataIsDemoSourced from its result object'
    );
  });

  await t.test('verifies App.tsx wires activeDataIsDemoSourced from the hook into DashboardHeader', () => {
    assert.ok(
      appContent.includes('activeDataIsDemoSourced,'),
      'App.tsx must destructure activeDataIsDemoSourced from useDashboardData'
    );
    assert.ok(
      appContent.includes('activeDataIsDemoSourced={activeDataIsDemoSourced}'),
      'App.tsx must pass activeDataIsDemoSourced through to DashboardHeader'
    );
  });

  await t.test('verifies App.tsx renders MonthlyReportView without destructive unmounting during background fetch', () => {
    // When reportLoading is true but currentReportData exists, App should NOT destroy MonthlyReportView
    assert.ok(
      appContent.includes('reportLoading && !currentReportData'),
      'App.tsx must show full loading spinner only when initial data is absent (!currentReportData)'
    );
    assert.ok(
      appContent.includes('currentReportData && ('),
      'App.tsx must keep existing report mounted to prevent DOM flicker and unmounting'
    );
  });
});
