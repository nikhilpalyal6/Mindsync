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

export function toUnifiedError(err, providerName) {
  let type = 'SERVER_ERROR';
  let status = err.statusCode || err.status || 500;
  let recoverable = true;
  let retryable = true;
  let retryAfter = null;

  const errorClass = err.constructor?.name || '';
  const message = err.message || 'An unexpected AI provider error occurred.';
  const lowerMsg = message.toLowerCase();

  if (errorClass === 'AIRequestValidationError' || err.name === 'AIRequestValidationError') {
    type = 'INVALID_REQUEST';
    status = 400;
    recoverable = false;
  } else if (errorClass === 'AIRateLimitError' || err.name === 'AIRateLimitError') {
    type = 'RATE_LIMIT';
    status = 429;
  } else if (errorClass === 'AIQuotaExceededError' || err.name === 'AIQuotaExceededError') {
    type = 'QUOTA_EXCEEDED';
    status = 429;
  } else if (errorClass === 'AITimeoutError' || err.name === 'AITimeoutError') {
    type = 'TIMEOUT';
    status = 408;
  } else if (errorClass === 'AINetworkError' || err.name === 'AINetworkError') {
    type = 'NETWORK_ERROR';
    status = 503;
  } else if (errorClass === 'AIServerError' || err.name === 'AIServerError') {
    type = 'SERVER_ERROR';
    status = err.statusCode || 500;
  }

  // Detect Ollama specific errors
  if (lowerMsg.includes('ollama_model_not_found') || lowerMsg.includes('model not found') || lowerMsg.includes('is not installed')) {
    type = 'OLLAMA_MODEL_NOT_FOUND';
    status = 404;
    retryable = false;
  } else if (lowerMsg.includes('ollama_unavailable') || lowerMsg.includes('ollama connection refused') || lowerMsg.includes('local ollama service is unreachable')) {
    type = 'OLLAMA_UNAVAILABLE';
    status = 503;
    retryable = false;
  } else if (status === 429 || lowerMsg.includes('quota') || lowerMsg.includes('rate limit') || lowerMsg.includes('limit exceeded') || lowerMsg.includes('exhausted') || lowerMsg.includes('too many requests')) {
    if (lowerMsg.includes('requests per day') || lowerMsg.includes('daily') || lowerMsg.includes('free_tier_requests') || lowerMsg.includes('quota') || lowerMsg.includes('exhausted') || lowerMsg.includes('credit') || lowerMsg.includes('billing')) {
      type = 'QUOTA_EXCEEDED';
      retryable = false;
    } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('rate_limit') || lowerMsg.includes('too many requests') || lowerMsg.includes('requests per minute') || lowerMsg.includes('rpm') || lowerMsg.includes('free_tier')) {
      type = 'RATE_LIMIT';
      retryable = true;
    } else {
      type = 'RATE_LIMIT';
      retryable = true;
    }
    status = 429;
  } else if (status === 404 || lowerMsg.includes('model_not_found') || lowerMsg.includes('model not found') || lowerMsg.includes('unknown model')) {
    type = 'MODEL_NOT_FOUND';
    status = 404;
    retryable = false;
  } else if (status === 402 || lowerMsg.includes('insufficient_credits') || lowerMsg.includes('credit') || lowerMsg.includes('payment required') || lowerMsg.includes('billing') || lowerMsg.includes('more credits')) {
    type = 'INSUFFICIENT_CREDITS';
    status = 402;
    retryable = false;
  } else if (status === 401 || status === 403 || lowerMsg.includes('unauthorized') || lowerMsg.includes('api key') || lowerMsg.includes('forbidden')) {
    type = 'INVALID_API_KEY';
    status = status || 401;
    retryable = false;
  } else if (status === 408 || lowerMsg.includes('timeout') || lowerMsg.includes('time out')) {
    type = 'TIMEOUT';
    status = 408;
    retryable = true;
  } else if (status === 503 || lowerMsg.includes('network') || lowerMsg.includes('fetch') || lowerMsg.includes('connect')) {
    type = 'NETWORK_ERROR';
    status = 503;
    retryable = true;
  }

  // Formatting / intelligence errors should not be retried on the same provider
  if (lowerMsg.includes('json') || lowerMsg.includes('structured response') || lowerMsg.includes('validation') || lowerMsg.includes('schema')) {
    retryable = false;
  }

  if (!recoverable) {
    retryable = false;
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
    retryable,
    message,
    originalError: rawErr
  };
}
