export class AIProviderError extends Error {
  constructor(message, provider, statusCode = null, rawError = null) {
    super(message);
    this.name = this.constructor.name;
    this.provider = provider;
    this.statusCode = statusCode;
    this.rawError = rawError;
  }
}

// 400 - Bad request, invalid prompts, bad parameters (should NOT failover)
export class AIRequestValidationError extends AIProviderError {
  constructor(message, provider, rawError = null) {
    super(message, provider, 400, rawError);
  }
}

// 429 - Rate limit / quota (SHOULD failover)
export class AIRateLimitError extends AIProviderError {
  constructor(message, provider, rawError = null) {
    super(message, provider, 429, rawError);
  }
}

// 429 - Quota limit exceeded (SHOULD failover)
export class AIQuotaExceededError extends AIProviderError {
  constructor(message, provider, rawError = null) {
    super(message, provider, 429, rawError);
  }
}

// Network timeouts (SHOULD failover)
export class AITimeoutError extends AIProviderError {
  constructor(message, provider, rawError = null) {
    super(message, provider, 408, rawError);
  }
}

// Network errors (SHOULD failover)
export class AINetworkError extends AIProviderError {
  constructor(message, provider, rawError = null) {
    super(message, provider, 503, rawError);
  }
}

// 500 / 502 / 503 / 504 - Server errors (SHOULD failover)
export class AIServerError extends AIProviderError {
  constructor(message, provider, statusCode = 500, rawError = null) {
    super(message, provider, statusCode, rawError);
  }
}

/**
 * Normalizes all custom provider errors to a unified schema structure.
 */
export function toUnifiedError(err, providerName) {
  let type = 'SERVER_ERROR';
  let status = err.statusCode || err.status || 500;
  let recoverable = true;
  let retryAfter = null;

  const errorClass = err.constructor?.name || '';
  const message = err.message || 'An unexpected AI provider error occurred.';

  if (errorClass === 'AIRequestValidationError' || err.name === 'AIRequestValidationError') {
    type = 'INVALID_REQUEST';
    status = 400;
    recoverable = false;
  } else if (errorClass === 'AIRateLimitError' || err.name === 'AIRateLimitError') {
    type = 'RATE_LIMIT';
    status = 429;
    recoverable = true;
  } else if (errorClass === 'AIQuotaExceededError' || err.name === 'AIQuotaExceededError') {
    type = 'QUOTA_EXCEEDED';
    status = 429;
    recoverable = true;
  } else if (errorClass === 'AITimeoutError' || err.name === 'AITimeoutError') {
    type = 'TIMEOUT';
    status = 408;
    recoverable = true;
  } else if (errorClass === 'AINetworkError' || err.name === 'AINetworkError') {
    type = 'NETWORK_ERROR';
    status = 503;
    recoverable = true;
  } else if (errorClass === 'AIServerError' || err.name === 'AIServerError') {
    type = 'SERVER_ERROR';
    status = err.statusCode || 500;
    recoverable = true;
  }

  // Extract Retry-After if headers are present
  const rawErr = err.rawError || err;
  if (rawErr?.headers) {
    const retryAfterHeader = rawErr.headers.get?.('retry-after') || rawErr.headers['retry-after'];
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10);
      if (!isNaN(seconds)) {
        retryAfter = seconds;
      }
    }
  }

  return {
    provider: providerName || err.provider || 'unknown',
    type,
    status,
    retryAfter,
    recoverable,
    message,
    originalError: rawErr
  };
}
