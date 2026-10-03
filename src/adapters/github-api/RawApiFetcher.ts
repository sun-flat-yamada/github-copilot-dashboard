import { ApiError, RateLimitError, AuthorizationError } from './errors/index.js';
import { resolveEffectiveApiVersion } from './api-compatibility.js';

export interface RawApiFetcherConfig {
  token?: string;
  baseUrl?: string;
  apiVersion?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  /** テスト用に fetch 実装を差し替える (既定はグローバルの fetch) */
  fetchImpl?: typeof fetch;
}

/** GitHub REST API の 1 ページあたり最大件数 */
export const MAX_PER_PAGE = 100;

/** ページング暴走の安全弁 (100 件 × 1,000 ページ = 10 万件) */
export const MAX_PAGES = 1000;

/** レポートファイル 1 つあたりのダウンロード上限 (文字数。暴走・誤設定の安全弁) */
export const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;

/**
 * 認証トークンの解決順: 明示指定 → COPILOT_READ_TOKEN → GITHUB_TOKEN → GH_TOKEN。
 * ワークフローは COPILOT_READ_TOKEN だけを渡すため、これを最優先で読む。
 */
export function resolveGitHubToken(
  explicit?: string,
  env: NodeJS.ProcessEnv = process.env
): string | undefined {
  return explicit || env.COPILOT_READ_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN || undefined;
}

/**
 * RFC 8288 の Link ヘッダー (`<url>; rel="next", <url>; rel="last"`) を rel -> URL の辞書にする。
 */
export function parseLinkHeader(header: string | null | undefined): Record<string, string> {
  const links: Record<string, string> = {};
  if (!header) return links;
  for (const part of header.split(/,\s*(?=<)/)) {
    const match = part.match(/<([^>]+)>\s*;\s*(?:[^;]*;\s*)*rel="?([^";]+)"?/);
    if (match) {
      links[match[2].trim().toLowerCase()] = match[1];
    }
  }
  return links;
}

export interface PaginatedResult<TItem, TFirstPage> {
  items: TItem[];
  /** 取得したページ数 */
  pages: number;
  /** 先頭ページの本文 (total_seats 等の件数照合に使う) */
  firstPage: TFirstPage;
  /** MAX_PAGES に達して打ち切った場合 true */
  truncated: boolean;
}

/**
 * Raw HTTP client with automated Calendar Version header, Rate Limit detection,
 * exponential backoff retry capability and Link-header pagination.
 */
export class RawApiFetcher {
  private token?: string;
  private baseUrl: string;
  private apiVersion: string;
  private maxRetries: number;
  private retryDelayMs: number;
  private fetchImpl: typeof fetch;

  constructor(config: RawApiFetcherConfig = {}) {
    this.token = resolveGitHubToken(config.token);
    this.baseUrl = (config.baseUrl || 'https://api.github.com').replace(/\/+$/, '');
    this.apiVersion = resolveEffectiveApiVersion(config.apiVersion || process.env.GITHUB_API_VERSION);
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
    this.fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** 認証トークンが解決できているか (値そのものは公開しない) */
  hasToken(): boolean {
    return Boolean(this.token);
  }

  getApiVersion(): string {
    return this.apiVersion;
  }

  async fetchRaw<T = unknown>(
    endpoint: string,
    params: Record<string, string> = {},
    query: Record<string, string | number> = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint, params, query);
    const { body } = await this.request<T>(url);
    return body;
  }

  /**
   * 「想定内の非 2xx」を例外にせず返す取得 (Usage Metrics Reports の 204 / 404 など)。
   * - 204 (本文なし) と allowStatuses に含まれるステータスは `{ status, body: null }` で返す
   * - それ以外のエラーは fetchRaw と同じ (401/403 は AuthorizationError、429 は RateLimitError)
   */
  async fetchRawAllowing<T = unknown>(
    endpoint: string,
    params: Record<string, string>,
    query: Record<string, string | number>,
    allowStatuses: number[]
  ): Promise<{ status: number; body: T | null }> {
    const url = this.buildUrl(endpoint, params, query);
    const { body, status } = await this.request<T>(url, allowStatuses);
    return { status, body: (body as T | null) ?? null };
  }

  /**
   * 署名付き URL (Usage Metrics Reports の download_links) を **認証ヘッダーなし** で取得する。
   * 署名付き URL は GitHub の API とは別のホスト (オブジェクトストレージ) を指すため、
   * Authorization を送ると PAT を第三者ホストへ漏えいさせてしまう。https のみ許可し、サイズ上限を設ける。
   */
  async downloadSigned(url: string, options: { maxBytes?: number } = {}): Promise<string> {
    const maxBytes = options.maxBytes ?? MAX_DOWNLOAD_BYTES;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ApiError('Report download link is not a valid URL', 502, 'download');
    }
    if (parsed.protocol !== 'https:') {
      throw new ApiError('Refusing to download a report over a non-https link', 502, 'download');
    }
    // 署名 (クエリ) をログ・エラーに残さないよう、ホストとパスだけをラベルにする
    const label = `${parsed.host}${parsed.pathname}`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, { headers: {} });
        if (!response.ok) {
          throw new ApiError(`HTTP ${response.status} while downloading ${label}`, response.status, label);
        }
        const declared = Number(response.headers.get('content-length') ?? '0');
        if (declared > maxBytes) {
          throw new ApiError(`Report file ${label} is larger than the ${maxBytes}-byte limit`, 502, label);
        }
        const text = await response.text();
        if (text.length > maxBytes) {
          throw new ApiError(`Report file ${label} is larger than the ${maxBytes}-byte limit`, 502, label);
        }
        return text;
      } catch (err: any) {
        lastError = err;
        const retryable = !(err instanceof ApiError) || err.status >= 500;
        if (!retryable || attempt >= this.maxRetries) break;
        await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt)));
      }
    }
    throw lastError || new ApiError('Report download failed', 500, label);
  }

  /**
   * Link ヘッダー (rel="next") を最終ページまで追従して全件取得する。
   * - per_page=100 を指定する
   * - 次ページ URL は同一オリジンのときだけ追従する (認証ヘッダーの漏えい防止)
   * - いずれかのページが失敗した場合は例外を投げる (部分取得を完全な結果として返さない)
   */
  async fetchPaginated<TPage = unknown, TItem = unknown>(
    endpoint: string,
    params: Record<string, string>,
    extractItems: (page: TPage) => TItem[],
    options: { perPage?: number; maxPages?: number } = {}
  ): Promise<PaginatedResult<TItem, TPage>> {
    const perPage = Math.min(options.perPage ?? MAX_PER_PAGE, MAX_PER_PAGE);
    const maxPages = options.maxPages ?? MAX_PAGES;

    let url: string | null = this.buildUrl(endpoint, params, { per_page: perPage });
    const baseOrigin = new URL(this.baseUrl).origin;

    const items: TItem[] = [];
    let firstPage: TPage | undefined;
    let pages = 0;
    let truncated = false;

    while (url) {
      if (pages >= maxPages) {
        truncated = true;
        break;
      }
      const response: { body: TPage; headers: Headers } = await this.request<TPage>(url);
      if (pages === 0) firstPage = response.body;
      items.push(...extractItems(response.body));
      pages++;

      const next: string | undefined = parseLinkHeader(response.headers.get('link')).next;
      if (!next) {
        url = null;
      } else if (new URL(next, this.baseUrl).origin !== baseOrigin) {
        throw new ApiError(
          `Refusing to follow pagination link to a different origin from ${endpoint}`,
          502,
          endpoint
        );
      } else {
        url = new URL(next, this.baseUrl).toString();
      }
    }

    return { items, pages, firstPage: firstPage as TPage, truncated };
  }

  private buildUrl(
    endpoint: string,
    params: Record<string, string>,
    query: Record<string, string | number>
  ): string {
    let resolvedEndpoint = endpoint;
    for (const [key, value] of Object.entries(params)) {
      resolvedEndpoint = resolvedEndpoint.replace(`{${key}}`, encodeURIComponent(value));
    }
    const url = new URL(`${this.baseUrl}${resolvedEndpoint.startsWith('/') ? '' : '/'}${resolvedEndpoint}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async request<T>(
    url: string,
    allowStatuses: number[] = []
  ): Promise<{ body: T; headers: Headers; status: number }> {
    const label = new URL(url).pathname;

    // Copilot / Billing 系のエンドポイントは必ず認証が必要。トークン未設定で無認証リクエストを
    // 送ると 401/404 の原因が分かりにくいため、送信前に明示的なエラーにする。
    if (!this.token) {
      throw new AuthorizationError(
        label,
        'GitHub token is not configured. Set COPILOT_READ_TOKEN (or GITHUB_TOKEN) as an Actions secret.'
      );
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.apiVersion,
      'User-Agent': 'GitHub-Copilot-Analytics-Platform/2026.09',
      Authorization: `Bearer ${this.token}`,
    };

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, { headers });

        const remainingHeader = response.headers.get('x-ratelimit-remaining');
        if (response.status === 429 || (response.status === 403 && remainingHeader === '0')) {
          const resetHeader = response.headers.get('x-ratelimit-reset');
          throw new RateLimitError(label, resetHeader);
        }

        if (allowStatuses.includes(response.status) || response.status === 204) {
          return { body: null as unknown as T, headers: response.headers, status: response.status };
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text().catch(() => '');
          throw new AuthorizationError(label, bodyText, response.status);
        }

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '');
          throw new ApiError(`HTTP ${response.status} from ${label}: ${bodyText}`, response.status, label);
        }

        return { body: (await response.json()) as T, headers: response.headers, status: response.status };
      } catch (err: any) {
        lastError = err;
        if (err instanceof RateLimitError || err instanceof AuthorizationError) {
          throw err;
        }
        // 4xx (429 / 401 / 403 以外) は再試行しても結果が変わらない
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          throw err;
        }
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new ApiError(`Request failed after ${this.maxRetries} retries`, 500, label);
  }
}
