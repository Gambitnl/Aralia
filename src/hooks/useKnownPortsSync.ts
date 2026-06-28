import { useEffect } from 'react';
import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
import { getBridgeAtlas } from '../systems/worldforge/bridge/legacySubmapBridge';
import { knownPortsFromPack } from '../systems/worldforge/travel/knownPorts';

/**
 * Populates `naval.knownPorts` from the FMG world pack for the given seed.
 *
 * Idempotency: fires once per seed change and only when `knownPorts` is empty.
 * If the list is already populated this hook does nothing, preventing redundant
 * dispatches on re-renders or hot-reloads.
 *
 * No fallback/try-catch: if `getBridgeAtlas` throws (e.g. the world hasn't been
 * generated yet) the error propagates — one real path, fail honestly.
 */
export function useKnownPortsSync(
  worldSeed: number | null | undefined,
  knownPorts: string[],
  dispatch: Dispatch<AppAction>,
): void {
  useEffect(() => {
    if (worldSeed == null) return;
    // Idempotency guard: if the list is already populated, do nothing.
    if (knownPorts.length > 0) return;

    const { pack } = getBridgeAtlas(worldSeed);
    // Cast to the narrow structural type that knownPortsFromPack accepts.
    // Pack.burgs is Burg[] (no numeric holes in the TS type) but at runtime
    // FMG places a 0-sentinel at index 0. knownPortsFromPack already handles
    // both cases — the cast is a type-system seam, not a runtime change.
    const ports = knownPortsFromPack(pack as Parameters<typeof knownPortsFromPack>[0]);
    dispatch({ type: 'NAVAL_SET_KNOWN_PORTS', payload: { ports } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldSeed]); // intentionally omit knownPorts/dispatch — only re-run when seed changes
}
