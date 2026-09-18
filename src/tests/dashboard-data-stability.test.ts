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
    // 1. Report in-memory cache
    assert.ok(
      hookContent.includes('reportCacheRef = useRef<Map<string, MonthlyReportAggregatedData>>'),
      'useDashboardData must use reportCacheRef for in-memory memoization'
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
      hookContent.includes('scopeDataCacheRef = useRef<Map<string, ScopeAggregatedData>>'),
      'useDashboardData must use scopeDataCacheRef for caching live metrics scopes'
    );
    assert.ok(
      hookContent.includes('currentDataRef.current?.scope_key === selectedKey'),
      'useDashboardData must skip redundant fetch if scope is already loaded'
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
