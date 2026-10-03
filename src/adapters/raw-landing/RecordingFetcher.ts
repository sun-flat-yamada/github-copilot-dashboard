import { RawApiClient } from '../github-api/RawApiClient.js';
import type { PaginatedResult } from '../github-api/RawApiFetcher.js';
import { RawLandingStore } from './RawLandingStore.js';
import { canonicalRequestKey, downloadKey, stripSignature } from './request-key.js';
import { RawEntry, RunManifest, RUN_MANIFEST_SCHEMA_VERSION } from '../../domain/entities/run-manifest.js';

const MAX_ERROR_MESSAGE = 300;

function errorSummary(err: any): NonNullable<RawEntry['error']> {
  return {
    name: String(err?.name ?? 'Error'),
    ...(typeof err?.status === 'number' ? { status: err.status } : {}),
    message: String(err?.message ?? err).slice(0, MAX_ERROR_MESSAGE),
  };
}

/** 署名付き URL の署名を取り除いた download_links の写し (署名は有効期限付きの資格情報なので保存しない) */
function sanitizeBody(body: unknown): unknown {
  if (body && typeof body === 'object' && Array.isArray((body as any).download_links)) {
    return {
      ...(body as object),
      download_links: (body as any).download_links.map((l: unknown) =>
        typeof l === 'string' ? stripSignature(l) : l
      ),
    };
  }
  return body;
}

/**
 * 取得をそのまま実クライアントへ委譲しつつ、応答を Raw Landing に記録する。
 * 記録の失敗は収集を止めない代わりに finish() の戻り値で呼び出し側へ伝える。
 */
export class RecordingFetcher implements RawApiClient {
  private entries = new Map<string, RawEntry>();
  private readonly startedAt = new Date().toISOString();
  private writeFailures = 0;

  constructor(
    private readonly inner: RawApiClient,
    private readonly store: RawLandingStore,
    readonly runId: string
  ) {}

  hasToken(): boolean {
    return this.inner.hasToken();
  }
  getApiVersion(): string {
    return this.inner.getApiVersion();
  }

  async fetchRaw<T = unknown>(
    endpoint: string,
    params: Record<string, string> = {},
    query: Record<string, string | number> = {}
  ): Promise<T> {
    const request = canonicalRequestKey(endpoint, params, query);
    try {
      const body = await this.inner.fetchRaw<T>(endpoint, params, query);
      this.recordObject(request, 'json', 200, JSON.stringify(sanitizeBody(body)), 'json');
      return body;
    } catch (err) {
      this.recordError(request, 'json', err);
      throw err;
    }
  }

  async fetchRawAllowing<T = unknown>(
    endpoint: string,
    params: Record<string, string>,
    query: Record<string, string | number>,
    allowStatuses: number[]
  ): Promise<{ status: number; body: T | null }> {
    const request = canonicalRequestKey(endpoint, params, query);
    try {
      const result = await this.inner.fetchRawAllowing<T>(endpoint, params, query, allowStatuses);
      if (result.body === null) {
        this.put(request, { request, kind: 'json', outcome: 'empty', status: result.status, fetched_at: new Date().toISOString() });
      } else {
        this.recordObject(request, 'json', result.status, JSON.stringify(sanitizeBody(result.body)), 'json');
      }
      return result;
    } catch (err) {
      this.recordError(request, 'json', err);
      throw err;
    }
  }

  async downloadSigned(url: string, options?: { maxBytes?: number }): Promise<string> {
    const request = downloadKey(url);
    try {
      const text = await this.inner.downloadSigned(url, options);
      this.recordObject(request, 'download', 200, text, 'ndjson');
      return text;
    } catch (err) {
      this.recordError(request, 'download', err);
      throw err;
    }
  }

  async fetchPaginated<TPage = unknown, TItem = unknown>(
    endpoint: string,
    params: Record<string, string>,
    extractItems: (page: TPage) => TItem[],
    options?: { perPage?: number; maxPages?: number }
  ): Promise<PaginatedResult<TItem, TPage>> {
    const request = canonicalRequestKey(endpoint, params);
    try {
      const result = await this.inner.fetchPaginated<TPage, TItem>(endpoint, params, extractItems, options);
      // 項目は items に持つので、先頭ページからは配列を除く (件数照合用の total_seats などの値だけを残す)
      const firstPage =
        result.firstPage && typeof result.firstPage === 'object'
          ? Object.fromEntries(Object.entries(result.firstPage).filter(([, v]) => !Array.isArray(v)))
          : result.firstPage;
      this.recordObject(
        request,
        'paginated',
        200,
        JSON.stringify({ items: result.items, pages: result.pages, firstPage, truncated: result.truncated }),
        'json'
      );
      return result;
    } catch (err) {
      this.recordError(request, 'paginated', err);
      throw err;
    }
  }

  /** manifest を書き出す。書き込めなかった場合は null (収集結果そのものには影響させない) */
  finish(config: RunManifest['config']): RunManifest | null {
    if (this.writeFailures > 0) {
      console.warn(`⚠️  Raw landing: ${this.writeFailures} response(s) could not be stored; this run is not reprocessable.`);
      return null;
    }
    const manifest: RunManifest = {
      schema_version: RUN_MANIFEST_SCHEMA_VERSION,
      run_id: this.runId,
      started_at: this.startedAt,
      finished_at: new Date().toISOString(),
      api_version: this.inner.getApiVersion(),
      config,
      entries: [...this.entries.values()].sort((a, b) => a.request.localeCompare(b.request)),
    };
    try {
      this.store.writeManifest(manifest);
      return manifest;
    } catch (err: any) {
      console.warn(`⚠️  Raw landing: could not write the run manifest (${err?.message ?? err}).`);
      return null;
    }
  }

  private put(request: string, entry: RawEntry): void {
    this.entries.set(request, entry);
  }

  private recordObject(request: string, kind: RawEntry['kind'], status: number, content: string, ext: string): void {
    try {
      const stored = this.store.putObject(content, ext);
      this.put(request, {
        request,
        kind,
        outcome: 'ok',
        status,
        fetched_at: new Date().toISOString(),
        ...stored,
      });
    } catch (err: any) {
      this.writeFailures++;
      console.warn(`⚠️  Raw landing: failed to store a response (${err?.message ?? err}).`);
    }
  }

  private recordError(request: string, kind: RawEntry['kind'], err: unknown): void {
    const summary = errorSummary(err);
    this.put(request, {
      request,
      kind,
      outcome: 'error',
      status: summary.status ?? 0,
      fetched_at: new Date().toISOString(),
      error: summary,
    });
  }
}
