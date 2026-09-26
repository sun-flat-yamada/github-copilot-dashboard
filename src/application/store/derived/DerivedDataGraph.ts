import { DataStoreState } from '../DataStoreState.js';

export interface DerivedDataNode<T = unknown> {
  id: string;
  dependencies: string[];
  compute(state: DataStoreState): T;
}

interface CacheEntry {
  value: unknown;
  inputHash: string;
}

/**
 * Directed Acyclic Graph (DAG) for reactive derived data computation.
 * Implements topological sort, cycle detection at registration, input hashing memoization,
 * and workingDerived state propagation to downstream nodes.
 */
export class DerivedDataGraph {
  private nodes = new Map<string, DerivedDataNode<unknown>>();
  private cache = new Map<string, CacheEntry>();

  registerNode(node: DerivedDataNode<any>): void {
    if (this.nodes.has(node.id)) {
      throw new Error(`DerivedDataNode with id '${node.id}' is already registered`);
    }
    this.nodes.set(node.id, node);
    this.detectCycles();
  }

  getNode(id: string): DerivedDataNode<unknown> | undefined {
    return this.nodes.get(id);
  }

  getRegisteredNodeIds(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Cycle detection using Depth-First Search with coloring (0: unvisited, 1: visiting, 2: visited).
   */
  private detectCycles(): void {
    const visited = new Map<string, number>();

    const dfs = (nodeId: string, path: string[]) => {
      visited.set(nodeId, 1);
      const node = this.nodes.get(nodeId);
      if (node) {
        for (const dep of node.dependencies) {
          if (this.nodes.has(dep)) {
            const state = visited.get(dep) || 0;
            if (state === 1) {
              throw new Error(
                `Cyclic dependency detected in DerivedDataGraph: ${[...path, nodeId, dep].join(' -> ')}`
              );
            }
            if (state === 0) {
              dfs(dep, [...path, nodeId]);
            }
          }
        }
      }
      visited.set(nodeId, 2);
    };

    for (const nodeId of this.nodes.keys()) {
      if ((visited.get(nodeId) || 0) === 0) {
        dfs(nodeId, []);
      }
    }
  }

  /**
   * Collect all nodes transitively affected by changed state keys.
   */
  collectAffected(changedKeys: string[]): Set<string> {
    const affected = new Set<string>();
    const toVisit = [...changedKeys];

    while (toVisit.length > 0) {
      const current = toVisit.pop()!;
      for (const [nodeId, node] of this.nodes.entries()) {
        if (node.dependencies.includes(current) && !affected.has(nodeId)) {
          affected.add(nodeId);
          toVisit.push(nodeId);
        }
      }
    }

    return affected;
  }

  /**
   * Topologically sort affected nodes so upstream dependencies are computed first.
   */
  topologicalSort(affected: Set<string>): string[] {
    const inDegree = new Map<string, number>();
    for (const id of affected) {
      inDegree.set(id, 0);
    }

    for (const id of affected) {
      const node = this.nodes.get(id)!;
      for (const dep of node.dependencies) {
        if (affected.has(dep)) {
          inDegree.set(id, (inDegree.get(id) || 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const [otherId, otherNode] of this.nodes.entries()) {
        if (affected.has(otherId) && otherNode.dependencies.includes(current)) {
          const newDeg = (inDegree.get(otherId) || 1) - 1;
          inDegree.set(otherId, newDeg);
          if (newDeg === 0) {
            queue.push(otherId);
          }
        }
      }
    }

    return sorted;
  }

  /**
   * Compute input hash for memoization check.
   */
  computeInputHash(node: DerivedDataNode<unknown>, state: DataStoreState): string {
    const inputs: unknown[] = [];
    for (const dep of node.dependencies) {
      if (this.nodes.has(dep)) {
        inputs.push(state.derived.get(dep));
      } else {
        inputs.push((state as any)[dep]);
      }
    }
    try {
      return JSON.stringify(inputs);
    } catch {
      return String(inputs.length);
    }
  }

  /**
   * Invalidate affected nodes and recompute in topological order.
   * Uses workingDerived pattern (C-1) so computed values are immediately visible to child nodes.
   */
  invalidate(changedKeys: string[], state: DataStoreState): Map<string, unknown> {
    const affected = this.collectAffected(changedKeys);
    if (affected.size === 0) {
      return state.derived;
    }

    const sorted = this.topologicalSort(affected);
    const workingDerived = new Map(state.derived);

    for (const nodeId of sorted) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      const workingState: DataStoreState = {
        ...state,
        derived: workingDerived,
      };

      const inputHash = this.computeInputHash(node, workingState);
      const cached = this.cache.get(nodeId);

      if (cached && cached.inputHash === inputHash) {
        workingDerived.set(nodeId, cached.value);
        continue;
      }

      const value = node.compute(workingState);
      this.cache.set(nodeId, { value, inputHash });
      workingDerived.set(nodeId, value);
    }

    return workingDerived;
  }
}
