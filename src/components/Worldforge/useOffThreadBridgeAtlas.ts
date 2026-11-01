/**
 * @file useOffThreadBridgeAtlas.ts
 * The canonical world atlas for a seed, built in the atlas worker instead of on
 * the main thread (GG-555, Remy 2026-11-01).
 *
 * `getBridgeAtlas(seed)` runs `generateFmgWorld`, which blocks the page for
 * about 4.5 s. MapPane and the town page already send that build to the atlas
 * worker (`prepareResponsiveAtlas`). This hook gives every other screen the
 * same path:
 *
 *  1. If the atlas for the seed is already in the bridge cache, it returns that
 *     object at once. It does not start the worker, because the worker install
 *     replaces the cached object and would change its identity under other
 *     consumers.
 *  2. With no Worker (jsdom tests, Node), it builds on the current thread at
 *     once, as the screens did before. Tests keep a synchronous atlas.
 *  3. Otherwise it returns `atlas: null` until the worker result is installed.
 *     The caller shows a "preparing the world" state in that time.
 *
 * The result is keyed by seed: after a seed change it never returns the atlas
 * of the old seed. The world data is unchanged; only the thread moves.
 */
import { useEffect, useState } from 'react';
import type { FmgWorldResult } from '../../systems/worldforge/fmg/generateWorld';
import { getBridgeAtlas, peekBridgeAtlas } from '../../systems/worldforge/bridge/legacySubmapBridge';
import {
  canPrepareResponsiveAtlasOffThread,
  prepareResponsiveAtlas,
} from './responsiveAtlasPreparation';

export interface OffThreadBridgeAtlas {
  /** The canonical atlas, or null while the worker builds it. */
  atlas: FmgWorldResult | null;
  /** The worker failure message, or null. */
  error: string | null;
}

interface AtlasState extends OffThreadBridgeAtlas {
  seed: number | null;
}

/** The atlas this seed can have without a wait, or null. */
function immediateAtlas(seed: number | null): FmgWorldResult | null {
  if (seed == null) return null;
  const cached = peekBridgeAtlas(seed);
  if (cached) return cached;
  return canPrepareResponsiveAtlasOffThread() ? null : getBridgeAtlas(seed);
}

export function useOffThreadBridgeAtlas(seed: number | null): OffThreadBridgeAtlas {
  const [state, setState] = useState<AtlasState>(() => ({ seed, atlas: immediateAtlas(seed), error: null }));

  useEffect(() => {
    if (seed == null) return;
    const ready = immediateAtlas(seed);
    if (ready) {
      setState((s) => (s.seed === seed && s.atlas === ready ? s : { seed, atlas: ready, error: null }));
      return;
    }
    let alive = true;
    prepareResponsiveAtlas({ seed }).then(
      (prepared) => { if (alive) setState({ seed, atlas: prepared.atlas, error: null }); },
      (err: unknown) => {
        if (alive) setState({ seed, atlas: null, error: err instanceof Error ? err.message : String(err) });
      },
    );
    return () => { alive = false; };
  }, [seed]);

  // A state left from an older seed never leaks out. Until the effect runs for
  // the new seed, answer from the cache (or the no-Worker build) alone.
  if (state.seed !== seed) return { atlas: immediateAtlas(seed), error: null };
  return { atlas: state.atlas, error: state.error };
}
