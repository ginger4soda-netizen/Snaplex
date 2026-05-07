import { useEffect, useState } from 'react';
import { AnalysisResult } from '@/types';

// Module-level singleton that owns in-flight prompt-analysis runs.
// Lives outside the React tree so an analysis started on image A keeps
// running (and persists its result to the DB) even after the user navigates
// to image B and unmounts the original DimensionCards instance.

type AnalyzeState = 'started' | 'completed' | 'failed';
type Listener = (event: { imageId: string; state: AnalyzeState }) => void;

class AnalyzeManager {
  private inFlight = new Map<string, Promise<AnalysisResult | null>>();
  private listeners = new Set<Listener>();

  isAnalyzing(imageId: string): boolean {
    return this.inFlight.has(imageId);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private emit(event: Parameters<Listener>[0]) {
    this.listeners.forEach(l => { try { l(event); } catch (e) { console.error(e); } });
  }

  start(
    imageId: string,
    runner: () => Promise<AnalysisResult>
  ): Promise<AnalysisResult | null> {
    const existing = this.inFlight.get(imageId);
    if (existing) return existing;

    // Set up the externally-resolvable promise BEFORE running the IIFE so the
    // map is populated before any subscriber reads from it. Subscribers query
    // `isAnalyzing(imageId)` to derive UI state, so the order of map mutations
    // and `emit` calls is load-bearing.
    let resolve!: (v: AnalysisResult | null) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<AnalysisResult | null>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.inFlight.set(imageId, promise);
    this.emit({ imageId, state: 'started' });

    (async () => {
      let result: AnalysisResult | null = null;
      let error: unknown = null;
      let finalState: AnalyzeState = 'completed';
      try {
        result = await runner();
      } catch (e) {
        console.error(`Background analyze failed for ${imageId}:`, e);
        error = e;
        finalState = 'failed';
      }
      // Delete BEFORE emitting so subscribers that re-read isAnalyzing()
      // observe the post-completion state, never the in-between state.
      this.inFlight.delete(imageId);
      this.emit({ imageId, state: finalState });
      if (finalState === 'failed') reject(error);
      else resolve(result);
    })();

    return promise;
  }

  await(imageId: string): Promise<AnalysisResult | null> | undefined {
    return this.inFlight.get(imageId);
  }
}

export const analyzeManager = new AnalyzeManager();

// Subscribes a component to the manager and returns whether `imageId`
// currently has an in-flight analysis. Re-renders on start/complete/fail.
export function useAnalyzing(imageId: string | undefined): boolean {
  const [analyzing, setAnalyzing] = useState(() =>
    imageId ? analyzeManager.isAnalyzing(imageId) : false
  );

  useEffect(() => {
    if (!imageId) {
      setAnalyzing(false);
      return;
    }
    setAnalyzing(analyzeManager.isAnalyzing(imageId));
    return analyzeManager.subscribe(({ imageId: changedId }) => {
      if (changedId === imageId) {
        setAnalyzing(analyzeManager.isAnalyzing(imageId));
      }
    });
  }, [imageId]);

  return analyzing;
}
