import { describe, it, expect, vi } from 'vitest';
import { withRetry, processWithConcurrency } from './async';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce({ message: 'Failed to fetch', status: 503 })
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw enhanced error after exhausting retries on network error', async () => {
    const networkErr = new TypeError('Failed to fetch');
    const fn = vi.fn().mockRejectedValue(networkErr);

    await expect(withRetry(fn, { maxRetries: 1, baseDelayMs: 10, label: 'test' }))
      .rejects.toThrow('Network connection failed');
  });

  it('should NOT retry on non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Invalid API key'));

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 }))
      .rejects.toThrow('Invalid API key');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 429 rate limit errors', async () => {
    const rateLimitErr = Object.assign(new Error('Rate limit'), { status: 429 });
    const fn = vi.fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 2, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('processWithConcurrency', () => {
  it('should process all items and return results', async () => {
    const items = [1, 2, 3, 4, 5];
    const { results, errors } = await processWithConcurrency(items, 2, async (item) => item * 2);
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(errors).toEqual([]);
  });

  it('should respect concurrency limit', async () => {
    let activeTasks = 0;
    let maxActiveTasks = 0;

    const items = [1, 2, 3, 4, 5, 6];
    await processWithConcurrency(items, 3, async (item) => {
      activeTasks++;
      maxActiveTasks = Math.max(maxActiveTasks, activeTasks);
      await new Promise(r => setTimeout(r, 50));
      activeTasks--;
      return item;
    });

    expect(maxActiveTasks).toBeLessThanOrEqual(3);
  });

  it('should track individual task failures with error details', async () => {
    const items = [1, 2, 3];
    const { results, errors } = await processWithConcurrency(items, 3, async (item) => {
      if (item === 2) throw new Error('fail');
      return item * 10;
    });

    expect(results[0]).toBe(10);
    expect(results[1]).toBeNull();
    expect(results[2]).toBe(30);
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
    expect(errors[0].error.message).toBe('fail');
  });

  it('should handle empty array', async () => {
    const { results, errors } = await processWithConcurrency([], 5, async () => 'x');
    expect(results).toEqual([]);
    expect(errors).toEqual([]);
  });

  it('should work when concurrency exceeds items length', async () => {
    const items = [1, 2];
    const { results } = await processWithConcurrency(items, 10, async (item) => item);
    expect(results).toEqual([1, 2]);
  });
});
