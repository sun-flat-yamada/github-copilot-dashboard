import type { PaginatedResult } from './RawApiFetcher.js';

/**
 * GitHub REST API への取得の契約。ソースアダプタはこの契約にだけ依存する。
 * 実装: RawApiFetcher (HTTP)、RecordingFetcher (録画)、ReplayFetcher (Raw Landing からの再生)。
 */
export interface RawApiClient {
  hasToken(): boolean;
  getApiVersion(): string;
  fetchRaw<T = unknown>(
    endpoint: string,
    params?: Record<string, string>,
    query?: Record<string, string | number>
  ): Promise<T>;
  fetchRawAllowing<T = unknown>(
    endpoint: string,
    params: Record<string, string>,
    query: Record<string, string | number>,
    allowStatuses: number[]
  ): Promise<{ status: number; body: T | null }>;
  downloadSigned(url: string, options?: { maxBytes?: number }): Promise<string>;
  fetchPaginated<TPage = unknown, TItem = unknown>(
    endpoint: string,
    params: Record<string, string>,
    extractItems: (page: TPage) => TItem[],
    options?: { perPage?: number; maxPages?: number }
  ): Promise<PaginatedResult<TItem, TPage>>;
}
