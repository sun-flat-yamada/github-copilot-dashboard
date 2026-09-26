import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { DerivedDataGraph, DerivedDataNode } from '../../application/store/derived/DerivedDataGraph.js';
import { DEFAULT_DATA_STORE_STATE, DataStoreState } from '../../application/store/DataStoreState.js';

describe('DerivedDataGraph Tests', () => {
  it('AR-3-F1: detects cyclic dependencies and throws error on registration', () => {
    const graph = new DerivedDataGraph();

    const nodeA: DerivedDataNode = {
      id: 'nodeA',
      dependencies: ['nodeB'],
      compute: () => 'A',
    };

    const nodeB: DerivedDataNode = {
      id: 'nodeB',
      dependencies: ['nodeA'],
      compute: () => 'B',
    };

    graph.registerNode(nodeA);
    assert.throws(() => graph.registerNode(nodeB), /Cyclic dependency detected/);
  });

  it('correctly topologically sorts nodes according to dependency chain', () => {
    const graph = new DerivedDataGraph();

    const node1: DerivedDataNode = { id: 'root', dependencies: ['activeSource'], compute: () => 1 };
    const node2: DerivedDataNode = { id: 'child', dependencies: ['root'], compute: () => 2 };
    const node3: DerivedDataNode = { id: 'grandchild', dependencies: ['child'], compute: () => 3 };

    graph.registerNode(node3);
    graph.registerNode(node1);
    graph.registerNode(node2);

    const affected = graph.collectAffected(['activeSource']);
    const sorted = graph.topologicalSort(affected);

    assert.deepEqual(sorted, ['root', 'child', 'grandchild']);
  });

  it('C-1: workingDerived pattern propagates updated values to child nodes during single invalidation', () => {
    const graph = new DerivedDataGraph();

    const parentNode: DerivedDataNode<number> = {
      id: 'parent',
      dependencies: ['userStatusFilter'],
      compute: (state) => (state.userStatusFilter === 'active' ? 100 : 50),
    };

    const childNode: DerivedDataNode<number> = {
      id: 'child',
      dependencies: ['parent'],
      compute: (state) => {
        const parentVal = state.derived.get('parent') as number;
        return parentVal * 2;
      },
    };

    graph.registerNode(parentNode);
    graph.registerNode(childNode);

    const state: DataStoreState = {
      ...DEFAULT_DATA_STORE_STATE,
      userStatusFilter: 'active',
    };

    const derived = graph.invalidate(['userStatusFilter'], state);
    assert.equal(derived.get('parent'), 100);
    assert.equal(derived.get('child'), 200); // 100 * 2 propagated via workingDerived
  });

  it('memoizes computation results when inputs have not changed', () => {
    const graph = new DerivedDataGraph();
    let computeCount = 0;

    const node: DerivedDataNode<string> = {
      id: 'memoNode',
      dependencies: ['groupingDimension'],
      compute: (state) => {
        computeCount++;
        return `computed:${state.groupingDimension}`;
      },
    };

    graph.registerNode(node);

    const state: DataStoreState = {
      ...DEFAULT_DATA_STORE_STATE,
      groupingDimension: 'department',
    };

    // First computation
    let derived = graph.invalidate(['groupingDimension'], state);
    assert.equal(computeCount, 1);
    assert.equal(derived.get('memoNode'), 'computed:department');

    // Second invalidation with identical state -> cache hit
    derived = graph.invalidate(['groupingDimension'], state);
    assert.equal(computeCount, 1); // Not incremented!
  });
});
