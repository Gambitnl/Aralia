// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 04/09/2026, 15:02:41
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useRef } from 'react';
import { useGameState } from '../../../state/GameContext';
import type { GroundWorld } from '../../../systems/worldforge/bridge/groundChunkLoader';
import {
  atlasGroundAddressFromDrilldown,
  type AtlasGroundDrilldown,
} from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import { atlasHiddenSiteForAddress } from '../../../systems/worldforge/leaf3d/atlasGroundContinuity';
import { dungeonNameForEntrance } from '../../../systems/worldforge/bridge/dungeonEntrances';

/**
 * Hook for managing 3D world proximity discoveries (hidden locations and dungeon entrances).
 *
 * As the player walks through the 3D ground world, this hook checks if they come within
 * discovery range of any secret places or world dungeon doorways. When a discovery occurs,
 * it records the location in game state so it gets marked on the map and notifies the player
 * with an in-game log message.
 *
 * Called by: World3DWrapper.tsx (during player position updates)
 * Depends on: GameContext for dispatching discovery actions, atlasGroundContinuity for location tagging
 */

// ============================================================================
// Types
// ============================================================================

export interface UseWorld3DDiscoveryOptions {
  /** Reference to the currently loaded ground world data */
  groundRef: React.MutableRefObject<GroundWorld | null>;
  /** Optional Atlas drilldown metadata when entered via the world map */
  atlasGroundDrilldown?: AtlasGroundDrilldown | null;
}

export interface UseWorld3DDiscoveryResult {
  /**
   * Evaluates proximity to all hidden sites and dungeon entrances around the player.
   *
   * @param playerX - Authoritative player character X position in ground meters
   * @param playerZ - Authoritative player character Z position in ground meters
   * @param cameraX - Camera focus X position in ground meters
   * @param cameraZ - Camera focus Z position in ground meters
   */
  checkProximityDiscoveries: (
    playerX: number,
    playerZ: number,
    cameraX: number,
    cameraZ: number,
  ) => void;
}

// ============================================================================
// Discovery Hook Implementation
// ============================================================================

export function useWorld3DDiscovery({
  groundRef,
  atlasGroundDrilldown,
}: UseWorld3DDiscoveryOptions): UseWorld3DDiscoveryResult {
  const { dispatch, state } = useGameState();

  // Track discovered IDs in the current session to ensure idempotency across renders and re-entry
  const discoveredHiddenRef = useRef<Set<string>>(new Set());
  const discoveredDungeonRef = useRef<Set<string>>(new Set());

  // Proximity evaluation callback called on ground position change
  const checkProximityDiscoveries = useCallback(
    (playerX: number, playerZ: number, cameraX: number, cameraZ: number) => {
      const ground = groundRef.current;
      if (!ground) return;

      // ========================================================================
      // 1. Hidden Site Proximity Check (SP4 Discovery)
      // ========================================================================
      // Reveal any hidden place (e.g. shrines, ruins, hidden groves) when the
      // player avatar gets close enough to its authored discovery radius.
      if (ground.hiddenSites && ground.hiddenSites.length > 0) {
        for (const hs of ground.hiddenSites) {
          const distanceToSite = Math.hypot(playerX - hs.xM, playerZ - hs.zM);

          if (distanceToSite <= hs.discoveryRadiusM) {
            // Calculate sub-tile normalized offsets (-0.5 to 0.5) so map pins align precisely
            const exX = ground.extentMetersX || 1;
            const exZ = ground.extentMetersZ || 1;
            const offsetX = Math.max(-0.5, Math.min(0.5, hs.xM / exX - 0.5));
            const offsetY = Math.max(-0.5, Math.min(0.5, hs.zM / exZ - 0.5));

            // Pin discovery to the canonical Atlas cell
            const siteCellId = state.playerCell?.cellId;
            if (siteCellId == null) continue;

            const atlasAddress = atlasGroundDrilldown
              ? atlasGroundAddressFromDrilldown(atlasGroundDrilldown)
              : null;

            const discovery = atlasAddress
              ? atlasHiddenSiteForAddress({
                  address: atlasAddress,
                  sourceId: hs.id,
                  sourceKind: 'hidden-site',
                  name: hs.name,
                  kind: hs.kind,
                  xM: hs.xM,
                  zM: hs.zM,
                  offsetX,
                  offsetY,
                })
              : {
                  id: hs.id,
                  cellId: siteCellId,
                  name: hs.name,
                  kind: hs.kind,
                  offsetX,
                  offsetY,
                };

            if (!discovery) continue;

            // Skip if already discovered in this session or stored in persistent game state
            if (
              discoveredHiddenRef.current.has(discovery.id) ||
              state.discoveredHiddenSites.some((known) => known.id === discovery.id)
            ) {
              continue;
            }

            discoveredHiddenRef.current.add(discovery.id);
            dispatch({ type: 'REVEAL_HIDDEN_SITE', payload: discovery });

            // Send notification message to the player's event log
            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: Date.now() + Math.floor(Math.random() * 1000),
                text: `You discovered a hidden place: ${hs.name}.`,
                sender: 'system',
                timestamp: new Date(),
              },
            });
          }
        }
      }

      // ========================================================================
      // 2. Dungeon Entrance Proximity Check (Pillar 2 Discovery)
      // ========================================================================
      // When the player walks within range of a dungeon entrance, name it and
      // pin it to the map. Idempotent per session using discoveredDungeonRef.
      if (ground.dungeonEntrances && ground.dungeonEntrances.length > 0) {
        for (const de of ground.dungeonEntrances) {
          if (discoveredDungeonRef.current.has(de.id)) continue;

          const distanceToDungeon = Math.hypot(cameraX - de.xM, cameraZ - de.zM);
          if (distanceToDungeon <= de.discoveryRadiusM) {
            discoveredDungeonRef.current.add(de.id);

            const seed = state.worldSeed ?? 42;
            const name = dungeonNameForEntrance(seed, de.sitePath) ?? 'an unknown dungeon';

            const exX = ground.extentMetersX || 1;
            const exZ = ground.extentMetersZ || 1;
            const offsetX = Math.max(-0.5, Math.min(0.5, de.xM / exX - 0.5));
            const offsetY = Math.max(-0.5, Math.min(0.5, de.zM / exZ - 0.5));

            dispatch({
              type: 'REVEAL_HIDDEN_SITE',
              payload: {
                id: de.id,
                cellId: de.cellId,
                name,
                kind: de.entranceKind,
                offsetX,
                offsetY,
              },
            });

            dispatch({
              type: 'ADD_MESSAGE',
              payload: {
                id: Date.now() + Math.floor(Math.random() * 1000),
                text: `You found ${name} — the way down is dark.`,
                sender: 'system',
                timestamp: new Date(),
              },
            });
          }
        }
      }
    },
    [
      atlasGroundDrilldown,
      dispatch,
      groundRef,
      state.discoveredHiddenSites,
      state.playerCell?.cellId,
      state.worldSeed,
    ],
  );

  return {
    checkProximityDiscoveries,
  };
}
