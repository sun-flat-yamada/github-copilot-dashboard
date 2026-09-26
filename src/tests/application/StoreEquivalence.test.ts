import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { DataStore } from '../../application/store/DataStore.js';
import { DerivedDataGraph } from '../../application/store/derived/DerivedDataGraph.js';
import { registerCoreDerivedNodes } from '../../application/store/derived/nodes/index.js';
import { ScopeAggregatedData, MonthlyReportAggregatedData } from '../../domain/entities/copilot.js';

describe('Store Equivalence Tests (Legacy Hook vs Reactive DataStore)', () => {
  const demoScopePath = path.resolve(process.cwd(), 'data/demo/processed/monthly/2026-09.json');
  const demoReportPath = path.resolve(process.cwd(), 'data/demo/processed/reports/2026-09.json');

  let scopeData: ScopeAggregatedData;
  let reportData: MonthlyReportAggregatedData;

  if (fs.existsSync(demoScopePath)) {
    scopeData = JSON.parse(fs.readFileSync(demoScopePath, 'utf-8'));
  }
  if (fs.existsSync(demoReportPath)) {
    reportData = JSON.parse(fs.readFileSync(demoReportPath, 'utf-8'));
  }

  it('yields identical tag-filtered user counts between legacy filter logic and filteredScopeData node', () => {
    if (!scopeData) return;

    const testTags = ['正社員'];

    // 1. 旧 Hook のフィルタロジック (useDashboardData.ts lines 220-230 相当)
    const legacyFilteredUsers = scopeData.users.filter((user) => {
      if (!user.tags || user.tags.length === 0) return false;
      return testTags.every((tag) => user.tags!.includes(tag));
    });

    // 2. 新 DataStore + DAG ノード
    const graph = new DerivedDataGraph();
    registerCoreDerivedNodes(graph);
    const store = new DataStore(graph);

    store.dispatch({ type: 'SET_RAW_SCOPE_DATA', data: scopeData });
    store.dispatch({ type: 'SET_TAGS', tags: testTags });

    const newFilteredScope = store.getDerived<ScopeAggregatedData>('filteredScopeData');

    assert.ok(newFilteredScope);
    assert.equal(newFilteredScope.users.length, legacyFilteredUsers.length);
    assert.deepEqual(
      newFilteredScope.users.map((u) => u.login),
      legacyFilteredUsers.map((u) => u.login)
    );
  });

  it('yields identical available tags extraction between legacy and DAG node', () => {
    if (!scopeData) return;

    // 旧ロジック: 全usersのtagsのSet結合
    const legacyTagsSet = new Set<string>();
    for (const u of scopeData.users) {
      if (u.tags) {
        for (const t of u.tags) {
          if (t.trim()) legacyTagsSet.add(t.trim());
        }
      }
    }
    const legacyTags = Array.from(legacyTagsSet).sort();

    // 新 DataStore
    const graph = new DerivedDataGraph();
    registerCoreDerivedNodes(graph);
    const store = new DataStore(graph);

    store.dispatch({ type: 'SET_RAW_SCOPE_DATA', data: scopeData });
    const newTags = store.getDerived<string[]>('availableTags');

    assert.ok(newTags);
    assert.deepEqual(newTags, legacyTags);
  });

  it('yields identical tag-filtered report users between legacy and DAG node', () => {
    if (!reportData) return;

    const testTags = ['正社員'];
    const legacyFiltered = reportData.user_details.filter((u) => {
      if (!u.tags || u.tags.length === 0) return false;
      return testTags.every((t) => u.tags!.includes(t));
    });

    const graph = new DerivedDataGraph();
    registerCoreDerivedNodes(graph);
    const store = new DataStore(graph);

    store.dispatch({ type: 'SET_RAW_REPORT_DATA', data: reportData });
    store.dispatch({ type: 'SET_TAGS', tags: testTags });

    const newFilteredReport = store.getDerived<MonthlyReportAggregatedData>('filteredReportData');
    assert.ok(newFilteredReport);
    assert.equal(newFilteredReport.user_details.length, legacyFiltered.length);
  });
});
