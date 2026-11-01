import { useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import { AppAction } from '../state/actionTypes';
import { useOffThreadBridgeAtlas } from '../components/Worldforge/useOffThreadBridgeAtlas';
import { knownPortsFromPack } from '../systems/worldforge/travel/knownPorts';

/**
 * Populates `naval.knownPorts` from the FMG world pack for the given seed.
 *
 * Idempotency: fires once per seed change and only when `knownPorts` is empty.
 * If the list is already populated this hook does nothing, preventing redundant
 * dispatches on re-renders or hot-reloads.
 *
 * GG-575 (2026-11-02): the atlas now comes from `useOffThreadBridgeAtlas`, not
 * from `getBridgeAtlas` in the effect. GameModals mounts this hook on every
 * page with a world seed, so on a page that had not built the atlas yet it ran
 * `generateFmgWorld` on the main thread (about 1 s on the World3D demo). The
 * hook now waits for the atlas worker, or reads the bridge cache at once when
 * another screen built it. With no Worker (jsdom, Node) the atlas is built at
 * once, as before. The ports and the dispatch are unchanged; only the thread
 * moves. It asks for no atlas while the list is full.
 *
 * No fallback: if the atlas worker fails, the effect throws its message — one
 * real path, fail honestly, as the old `getBridgeAtlas` throw did.
 */
export function useKnownPortsSync(
  worldSeed: number | null | undefined,
  knownPorts: string[],
  dispatch: Dispatch<AppAction>,
): void {
  // Re-run when the list empties as well as on a seed change. START_GAME_SUCCESS
  // and LOAD_GAME_SUCCESS reset naval.knownPorts to [] but keep the same seed, so a
  // seed-only key left the list empty for the whole session (C9, agora-9ed9.9).
  const portsEmpty = knownPorts.length === 0;
  const { atlas, error } = useOffThreadBridgeAtlas(worldSeed != null && portsEmpty ? worldSeed : null);
  // The effect keys on "the atlas is ready", not on the atlas object: a worker
  // install or a fresh no-Worker build may hand over a new object for the same
  // seed, and that must not dispatch twice.
  const atlasRef = useRef(atlas);
  atlasRef.current = atlas;
  const atlasReady = atlas != null;
  useEffect(() => {
    if (worldSeed == null) return;
    // Idempotency guard: if the list is already populated, do nothing.
    if (!portsEmpty) return;
    if (error) throw new Error(`Known ports for world ${worldSeed}: the atlas failed to build: ${error}`);
    const ready = atlasRef.current;
    if (!ready) return; // The atlas worker has not finished yet.

    // Cast to the narrow structural type that knownPortsFromPack accepts.
    // Pack.burgs is Burg[] (no numeric holes in the TS type) but at runtime
    // FMG places a 0-sentinel at index 0. knownPortsFromPack already handles
    // both cases — the cast is a type-system seam, not a runtime change.
    const ports = knownPortsFromPack(ready.pack as Parameters<typeof knownPortsFromPack>[0]);
    dispatch({ type: 'NAVAL_SET_KNOWN_PORTS', payload: { ports } });
  }, [worldSeed, portsEmpty, atlasReady, error, dispatch]); // dispatch is stable; the guard above stops a loop
}
