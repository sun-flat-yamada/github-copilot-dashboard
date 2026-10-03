import { RawApiClient } from '../github-api/RawApiClient.js';
import type { PaginatedResult } from '../github-api/RawApiFetcher.js';
import { ApiError, AuthorizationError, RateLimitError } from '../github-api/errors/index.js';
import { RawLandingStore } from './RawLandingStore.js';
import { canonicalRequestKey, downloadKey } from './request-key.js';
import { RawEntry, RunManifest } from '../../domain/entities/run-manifest.js';

/** 再生中に、収集時に無かったリクエストが要求された (再処理のロジックが収集とずれている) */
export class ReplayMissError extends ApiError {
  constructor(request: string, runId: string) {
    super(`No raw landing entry for "${request}" in run ${runId}`, 424, request);
    this.name = 'ReplayMissError';
  }
}

function rebuildError(entry: RawEntry): Error {
  const e = entry.error;
  if (e?.name === 'RateLimitError') return new RateLimitError(entry.request, null);
  if (e?.name === 'AuthorizationError') return new AuthorizationError(entry.request, e.message, e.status ?? 401);
  return new ApiError(e?.message ?? 'Recorded request failed', e?.status ?? entry.status ?? 500, entry.request);
}

/** 通信せず、Run Manifest が指す記録から応答を返す (`pipeline:reprocess` 用) */
export class ReplayFetcher implements RawApiClient {
  private byRequest = new Map<string, RawEntry>();

  constructor(
    private readonly manifest: RunManifest,
    private readonly store: RawLandingStore
  ) {
    for (const e of manifest.entries) this.byRequest.set(e.request, e);
  }

  /** 再生に認証は要らない */
  hasToken(): boolean {
    return true;
  }
  getApiVersion(): string {
    return this.manifest.api_version;
  }

  private entry(request: string): RawEntry {
    const entry = this.byRequest.get(request);
    if (!entry) throw new ReplayMissError(request, this.manifest.run_id);
    return entry;
  }

  private body<T>(entry: RawEntry): T {
    if (entry.outcome === 'error') throw rebuildError(entry);
    if (!entry.object) throw new ApiError(`Raw landing entry has no object: ${entry.request}`, 500, entry.request);
    return JSON.parse(this.store.readObject(entry.object)) as T;
  }

  async fetchRaw<T = unknown>(
    endpoint: string,
    params: Record<string, string> = {},
    query: Record<string, string | number> = {}
  ): Promise<T> {
    return this.body<T>(this.entry(canonicalRequestKey(endpoint, params, query)));
  }

  async fetchRawAllowing<T = unknown>(
    endpoint: string,
    params: Record<string, string>,
    query: Record<string, string | number>
  ): Promise<{ status: number; body: T | null }> {
    const entry = this.entry(canonicalRequestKey(endpoint, params, query));
    if (entry.outcome === 'empty') return { status: entry.status, body: null };
    return { status: entry.status, body: this.body<T>(entry) };
  }

  async downloadSigned(url: string): Promise<string> {
    const entry = this.entry(downloadKey(url));
    if (entry.outcome === 'error') throw rebuildError(entry);
    return this.store.readObject(entry.object as string);
  }

  async fetchPaginated<TPage = unknown, TItem = unknown>(
    endpoint: string,
    params: Record<string, string>
  ): Promise<PaginatedResult<TItem, TPage>> {
    return this.body<PaginatedResult<TItem, TPage>>(this.entry(canonicalRequestKey(endpoint, params)));
  }
}
