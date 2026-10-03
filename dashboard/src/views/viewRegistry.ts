import type { ViewContext, ViewDatasetId, ViewManifest } from './types';

export interface ViewRegistry {
  /** order 昇順 (同順位は登録順) */
  getAll(): ViewManifest[];
  get(id: string): ViewManifest | undefined;
  /** 表示条件 (isVisible) を満たすビューのみ */
  getVisible(ctx: ViewContext): ViewManifest[];
}

/**
 * requiredDatasets のいずれも取得済みでないとき、不足データセットを返す (理由付き案内用)。
 * 空配列の manifest はデータ非依存なので常に空を返す。
 */
export function getMissingDatasets(manifest: ViewManifest, ctx: ViewContext): ViewDatasetId[] {
  if (manifest.requiredDatasets.length === 0) return [];
  const loaded: Record<ViewDatasetId, boolean> = {
    scope: ctx.currentData !== null,
    report: ctx.currentReportData !== null,
  };
  return manifest.requiredDatasets.some((d) => loaded[d]) ? [] : [...manifest.requiredDatasets];
}

/** manifest の配列から Registry を作る。ID 重複は設定ミスなので例外にする */
export function createViewRegistry(manifests: ViewManifest[]): ViewRegistry {
  const byId = new Map<string, ViewManifest>();
  for (const m of manifests) {
    if (byId.has(m.id)) throw new Error(`Duplicate view id: ${m.id}`);
    byId.set(m.id, m);
  }
  const sorted = [...manifests]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.order - b.m.order || a.i - b.i)
    .map((x) => x.m);
  return {
    getAll: () => sorted,
    get: (id) => byId.get(id),
    getVisible: (ctx) => sorted.filter((m) => !m.isVisible || m.isVisible(ctx)),
  };
}
