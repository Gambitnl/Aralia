/**
 * @file useChunkStreaming.ts
 * @description React binding for ChunkStreamer. Creates one streamer per mount, re-renders
 * when its loaded set changes (via useSyncExternalStore), and exposes update().
 *
 * Why this is built this way:
 * - `useSyncExternalStore` is React's recommended hook for subscribing to external stateful
 *   objects, ensuring no rendering glitches, race conditions, or state tearing.
 * - Snapshots are cached referentially using `snapshotRef` because React requires referential
 *   stability for `getSnapshot` when no actual loaded set change occurred, preventing
 *   infinite re-render loops.
 * - The streamer is created *inside* the mount effect (not `useMemo`) and disposed in that same
 *   effect's cleanup. This is the StrictMode-safe disposable-resource pattern: under React's dev
 *   double-mount (setup → cleanup → setup) each setup builds a fresh streamer and each cleanup
 *   disposes the very instance it created, so the remounted tree always gets a *live* streamer.
 *   A `useMemo`-pinned streamer would instead be permanently disposed by the simulated-unmount
 *   cleanup, leaving the scene with a dead streamer that drops its first load batch and never
 *   streams again (observed live as a stuck, empty 3D world).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChunkStreamer, type ChunkStreamerOptions } from '@/systems/world3d/chunkStreamer';
import type { ChunkLoader, LoadedChunk } from '@/systems/world3d/types';

export interface UseChunkStreamingResult {
  loaded: LoadedChunk[];
  update: (worldX: number, worldZ: number) => void;
  pendingCount: number;
}

const EMPTY_LOADED: LoadedChunk[] = [];

/**
 * Custom React hook that hosts a per-mount ChunkStreamer instance and exposes its loaded state.
 */
export function useChunkStreaming(
  loader: ChunkLoader,
  options?: ChunkStreamerOptions,
): UseChunkStreamingResult {
  // `streamer` is null between initial render and the mount effect; the effect owns its lifecycle.
  const [streamer, setStreamer] = useState<ChunkStreamer | null>(null);
  // Latest loader/options without forcing streamer re-creation when their identity changes.
  const loaderRef = useRef(loader);
  const optionsRef = useRef(options);
  loaderRef.current = loader;
  optionsRef.current = options;

  useEffect(() => {
    const s = new ChunkStreamer(loaderRef.current, optionsRef.current);
    setStreamer(s);
    return () => s.dispose();
  }, []);

  // Keep a stable snapshot reference to avoid infinite re-renders when React compares state.
  const snapshotRef = useRef<LoadedChunk[]>(EMPTY_LOADED);

  const subscribe = useCallback(
    (cb: () => void) => (streamer ? streamer.onChange(cb) : () => {}),
    [streamer],
  );

  const getSnapshot = useCallback(() => {
    if (!streamer) return EMPTY_LOADED;
    const next = streamer.getLoaded();
    // Verify structural equality so we only swap the array reference when content changed.
    const current = snapshotRef.current;
    if (
      current.length === next.length &&
      current.every((c, idx) => c.cx === next[idx].cx && c.cy === next[idx].cy && c.lod === next[idx].lod)
    ) {
      return current;
    }
    snapshotRef.current = next;
    return next;
  }, [streamer]);

  const loaded = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const update = useCallback(
    (worldX: number, worldZ: number) => streamer?.update(worldX, worldZ),
    [streamer],
  );

  return { loaded, update, pendingCount: streamer?.pendingCount ?? 0 };
}
