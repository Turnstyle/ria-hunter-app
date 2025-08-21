'use client';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  onRetry?: (attempt: number, delay: number) => void;
}

export interface FetchWithRetryOptions extends RetryOptions {
  signal?: AbortSignal;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  const jitterDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
  return Math.min(jitterDelay, maxDelay);
}

function parseRetryAfter(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) return null;
  
  const seconds = parseInt(retryAfterHeader, 10);
  if (isNaN(seconds)) return null;
  
  return seconds * 1000; // Convert to milliseconds
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry,
    signal
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal
      });

      // If successful or non-retryable error, return response
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }

      // Handle rate limiting (429) and server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        if (attempt > maxRetries) {
          // Last attempt, throw error
          const errorMessage = response.status === 429 
            ? 'Too many requests. Please try again later.'
            : `Server error: ${response.statusText}`;
          
          throw new ApiError(errorMessage, response.status, 
            response.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR'
          );
        }

        // Calculate delay for retry
        let retryDelay: number;
        
        if (response.status === 429) {
          // Use Retry-After header if present, otherwise use exponential backoff
          const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
          retryDelay = retryAfter || calculateDelay(attempt, baseDelay, maxDelay, backoffFactor);
        } else {
          // Use exponential backoff for server errors
          retryDelay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor);
        }

        // Call retry callback if provided
        onRetry?.(attempt, retryDelay);

        // Wait before retrying
        await delay(retryDelay);
        continue;
      }

      // For other errors, return the response (let caller handle)
      return response;

    } catch (error) {
      lastError = error as Error;
      
      // If it's an AbortError or network error, don't retry
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt > maxRetries) {
        throw lastError;
      }

      // Calculate delay and retry
      const retryDelay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor);
      onRetry?.(attempt, retryDelay);
      await delay(retryDelay);
    }
  }

  throw lastError || new Error('Maximum retries exceeded');
}

// Utility function to create API error from response
export async function createApiError(response: Response): Promise<ApiError> {
  let message = `HTTP ${response.status}: ${response.statusText}`;
  let code: string | undefined;

  try {
    const data = await response.json();
    message = data.message || data.error || message;
    code = data.code;
  } catch {
    // Response body is not JSON, use default message
  }

  return new ApiError(message, response.status, code);
}
