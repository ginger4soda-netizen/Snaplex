import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeManager } from './analyzeManager';
import { AnalysisResult } from '@/types';

const fakeResult = (): AnalysisResult => ({
  description: 'x',
  structuredPrompts: {
    subject: { original: 'a', translated: '' },
    environment: { original: '', translated: '' },
    composition: { original: '', translated: '' },
    lighting: { original: '', translated: '' },
    mood: { original: '', translated: '' },
    style: { original: '', translated: '' },
  },
});

describe('analyzeManager', () => {
  beforeEach(() => {
    // Drain anything left from previous tests
    // (Manager is module-scoped; tests should leave it clean.)
  });

  it('isAnalyzing returns true synchronously after start, before runner resolves', async () => {
    let release!: () => void;
    const runner = () => new Promise<AnalysisResult>(res => {
      release = () => res(fakeResult());
    });

    const promise = analyzeManager.start('img-1', runner);
    expect(analyzeManager.isAnalyzing('img-1')).toBe(true);

    release();
    await promise;
    expect(analyzeManager.isAnalyzing('img-1')).toBe(false);
  });

  it('emits started AFTER the map is populated (subscribers see isAnalyzing=true)', async () => {
    const observed: boolean[] = [];
    const unsub = analyzeManager.subscribe(({ imageId, state }) => {
      if (imageId !== 'img-2') return;
      if (state === 'started') observed.push(analyzeManager.isAnalyzing('img-2'));
    });

    let release!: () => void;
    const runner = () => new Promise<AnalysisResult>(res => {
      release = () => res(fakeResult());
    });
    const promise = analyzeManager.start('img-2', runner);
    release();
    await promise;
    unsub();

    expect(observed).toEqual([true]);
  });

  it('emits completed AFTER the map is cleared (subscribers see isAnalyzing=false)', async () => {
    const observed: boolean[] = [];
    const unsub = analyzeManager.subscribe(({ imageId, state }) => {
      if (imageId !== 'img-3') return;
      if (state === 'completed') observed.push(analyzeManager.isAnalyzing('img-3'));
    });

    await analyzeManager.start('img-3', async () => fakeResult());
    unsub();

    expect(observed).toEqual([false]);
  });

  it('start dedupes concurrent requests for the same imageId', async () => {
    let calls = 0;
    let release!: () => void;
    const runner = () => {
      calls++;
      return new Promise<AnalysisResult>(res => {
        release = () => res(fakeResult());
      });
    };

    const p1 = analyzeManager.start('img-4', runner);
    const p2 = analyzeManager.start('img-4', runner);
    expect(p1).toBe(p2);
    release();
    await p1;
    expect(calls).toBe(1);
  });

  it('rejects the returned promise when the runner throws', async () => {
    const failures: string[] = [];
    const unsub = analyzeManager.subscribe(({ imageId, state }) => {
      if (imageId === 'img-5' && state === 'failed') failures.push('failed');
    });

    await expect(
      analyzeManager.start('img-5', async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');
    unsub();

    expect(failures).toEqual(['failed']);
    expect(analyzeManager.isAnalyzing('img-5')).toBe(false);
  });
});
