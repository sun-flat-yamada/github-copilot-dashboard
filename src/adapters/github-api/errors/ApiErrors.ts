export class ApiError extends Error {
  readonly status: number;
  readonly endpoint: string;

  constructor(message: string, status: number, endpoint: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
  }
}

export class RateLimitError extends ApiError {
  readonly resetAt: string | null;

  constructor(endpoint: string, resetAt: string | null = null) {
    super(`GitHub API rate limit exceeded on ${endpoint}`, 429, endpoint);
    this.name = 'RateLimitError';
    this.resetAt = resetAt;
  }
}

export class AuthorizationError extends ApiError {
  /**
   * @param status 実際の HTTP ステータス (401 | 403)。トークン未設定など送信前の失敗は 401 とする。
   */
  constructor(endpoint: string, details?: string, status: number = 401) {
    super(
      `GitHub API authorization failed on ${endpoint}${details ? `: ${details}` : ''}`,
      status,
      endpoint
    );
    this.name = 'AuthorizationError';
  }
}
