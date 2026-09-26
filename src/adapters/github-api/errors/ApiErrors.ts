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
  constructor(endpoint: string, details?: string) {
    super(
      `GitHub API authorization failed on ${endpoint}${details ? `: ${details}` : ''}`,
      401,
      endpoint
    );
    this.name = 'AuthorizationError';
  }
}
