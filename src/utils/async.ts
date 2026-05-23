// ============================================
// Async Utilities: Retry & Concurrency Control
// ============================================

/**
 * Wraps an async function with exponential backoff retry logic.
 * Retries on network errors (Failed to fetch), 429 (rate limit), and 503 (overload).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, label = 'API call' } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      const isRetryable = isRetryableError(error);

      if (isLastAttempt || !isRetryable) {
        // Enhance error message for network failures
        if (isNetworkError(error)) {
          throw new Error(
            `Network connection failed. Please check your internet connection or proxy/VPN settings. (${label})`
          );
        }
        throw error;
      }

      // Exponential backoff: 1s, 3s
      const delay = baseDelayMs * Math.pow(3, attempt);
      console.warn(`⚠️ ${label} attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  // TypeScript safety - never reached
  throw new Error(`${label} failed after ${maxRetries} retries`);
}

/**
 * Process an array of items with controlled concurrency.
 * Unlike Promise.all (all at once) or sequential (one at a time),
 * this runs up to `concurrency` tasks in parallel.
 * Returns results with error tracking so callers can report failures.
 */
export interface ConcurrencyResult<R> {
  results: (R | null)[];
  errors: { index: number; error: Error }[];
}

export async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<ConcurrencyResult<R>> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  const errors: { index: number; error: Error }[] = [];
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = await fn(items[currentIndex], currentIndex);
      } catch (e: any) {
        console.error(`Concurrent task ${currentIndex} failed:`, e);
        errors.push({ index: currentIndex, error: e instanceof Error ? e : new Error(String(e)) });
        results[currentIndex] = null;
      }
    }
  };

  // Spawn `concurrency` workers
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);

  return { results, errors };
}

// --- Internal helpers ---

function isRetryableError(error: any): boolean {
  if (isNetworkError(error)) return true;

  const status = error?.status || error?.statusCode;
  if (status === 429 || status === 503) return true;

  const msg = error?.message?.toLowerCase() || '';
  if (msg.includes('quota') || msg.includes('rate') || msg.includes('unavailable')) return true;
  if (msg.includes('high demand')) return true;

  return false;
}

function isNetworkError(error: any): boolean {
  if (error instanceof TypeError && error.message === 'Failed to fetch') return true;

  const msg = error?.message?.toLowerCase() || '';
  return msg.includes('failed to fetch') || msg.includes('network');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
