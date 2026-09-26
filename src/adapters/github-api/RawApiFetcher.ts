import { ApiError, RateLimitError, AuthorizationError } from './errors/index.js';
import { resolveEffectiveApiVersion } from './api-compatibility.js';

export interface RawApiFetcherConfig {
  token?: string;
  baseUrl?: string;
  apiVersion?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Raw HTTP client with automated Calendar Version header, Rate Limit detection,
 * and exponential backoff retry capability.
 */
export class RawApiFetcher {
  private token?: string;
  private baseUrl: string;
  private apiVersion: string;
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: RawApiFetcherConfig = {}) {
    this.token = config.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    this.baseUrl = (config.baseUrl || 'https://api.github.com').replace(/\/+$/, '');
    this.apiVersion = resolveEffectiveApiVersion(config.apiVersion);
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  async fetchRaw<T = unknown>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    let resolvedEndpoint = endpoint;
    for (const [key, value] of Object.entries(params)) {
      resolvedEndpoint = resolvedEndpoint.replace(`{${key}}`, encodeURIComponent(value));
    }

    const url = `${this.baseUrl}${resolvedEndpoint.startsWith('/') ? '' : '/'}${resolvedEndpoint}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.apiVersion,
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, { headers });

        if (response.status === 429) {
          const resetHeader = response.headers.get('x-ratelimit-reset');
          throw new RateLimitError(resolvedEndpoint, resetHeader);
        }

        if (response.status === 401 || response.status === 403) {
          const bodyText = await response.text().catch(() => '');
          throw new AuthorizationError(resolvedEndpoint, bodyText);
        }

        if (!response.ok) {
          const bodyText = await response.text().catch(() => '');
          throw new ApiError(
            `HTTP ${response.status} from ${resolvedEndpoint}: ${bodyText}`,
            response.status,
            resolvedEndpoint
          );
        }

        return (await response.json()) as T;
      } catch (err: any) {
        lastError = err;
        if (err instanceof RateLimitError || err instanceof AuthorizationError) {
          throw err;
        }
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new ApiError(`Request failed after ${this.maxRetries} retries`, 500, resolvedEndpoint);
  }

  getApiVersion(): string {
    return this.apiVersion;
  }
}
