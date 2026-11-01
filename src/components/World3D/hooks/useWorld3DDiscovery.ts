// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 18:08:04
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 9 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useRef } from 'react';
import { DiscoveryType } from '../../../types';
import { useGameState } from '../../../state/GameContext';
import type { GroundWorld } from '../../../systems/worldforge/bridge/groundChunkLoader';
import {
  atlasGroundAddressFromDrilldown,
  type AtlasGroundDrilldown,
} from '../../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import { atlasHiddenSiteForAddress } from '../../../systems/worldforge/leaf3d/atlasGroundContinuity';
import { dungeonNameForEntrance } from '../../../systems/worldforge/bridge/dungeonEntrances';
import { publicBuildingDiscovery } from '../publicBuildingDiscovery';
import { townBuildingVisit, type TownBuildingVisit } from '../../Worldforge/townBuildingVisit';
import type { BuildingEventHistory } from '../../../systems/worldforge/interior/blueprintTypes';

/**
 * Records hidden-site proximity and physically supported public-room visits in the existing log.
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
    /** Actual arrived body height. Missing height cannot record a public visit. */
    playerY?: number,
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
  const journaledRef = useRef<Set<string>>(new Set());
  // Cache only blueprint computation, not discovery status. Saved log identities
  // remain authoritative after reload; changed ground/history rebuild the plan.
  const visitsRef = useRef(new Map<string, {ground: GroundWorld; history?: BuildingEventHistory; visit: TownBuildingVisit}>());

  // Proximity evaluation callback called on ground position change
  const checkProximityDiscoveries = useCallback(
    (playerX: number, playerZ: number, _cameraX: number, _cameraZ: number, playerY?: number) => {
      const ground = groundRef.current;
      if (!ground) return;

      if (Number.isFinite(playerY)) {
        const account = publicBuildingDiscovery(ground, {xM: playerX, zM: playerZ, yM: playerY!}, state, (burgId, plotId) => {
          const retained = state.townSim?.[burgId]?.buildingSources?.[plotId];
          const key = `${state.worldSeed}:${burgId}:${plotId}:${state.townSim?.[burgId]?.layoutRevision ?? ''}:${retained?.planSignature ?? ''}:${retained?.furnishingRepair?.recipe ?? ''}:${retained?.circulationRepair?.planSignature ?? ''}:${retained?.householdRevision?.planSignature ?? ''}`;
          const history = state.townSim?.[burgId]?.buildingEvents?.[plotId];
          const cached = visitsRef.current.get(key);
          if (cached?.ground === ground && cached.history === history) return cached.visit;
          const visit = townBuildingVisit(state.worldSeed!, burgId, plotId, history, retained, state.townSim?.[burgId]?.layoutRevision);
          visitsRef.current.set(key, {ground, history, visit});
          return visit;
        });
        if (account && !journaledRef.current.has(account.source.id) && !state.discoveryLog.some(entry =>
          entry.type === DiscoveryType.LOCATION_DISCOVERY && entry.flags.some(flag => flag.key === 'locationId' && flag.value === account.source.id))) {
          journaledRef.current.add(account.source.id);
          dispatch({type: 'ADD_DISCOVERY_ENTRY', payload: account});
        }
      }

      // A map pin and its journal account describe one actual source. Older
      // saves may already have the pin; revisiting can add the missing account
      // once, without treating camera movement as exploration or granting loot.
      const recordAccount = (id: string, cellId: number, name: string, kind: string) => {
        const locationId = `world:${state.worldSeed}:cell:${cellId}:site:${id}`;
        if (journaledRef.current.has(locationId) || state.discoveryLog.some(entry =>
          entry.type === DiscoveryType.LOCATION_DISCOVERY && entry.flags.some(flag => flag.key === 'locationId' && flag.value === locationId))) return;
        journaledRef.current.add(locationId);
        dispatch({ type: 'ADD_DISCOVERY_ENTRY', payload: {
          gameTime: state.gameTime.toISOString(),
          type: DiscoveryType.LOCATION_DISCOVERY,
          title: `Place Discovered: ${name}`,
          content: `You found ${name} (${kind}) nearby. Its location is marked on your world map.`,
          source: { type: 'LOCATION', id: locationId, name },
          flags: [{ key: 'locationId', value: locationId, label: name }, { key: 'hiddenSiteId', value: id, label: kind }],
          isQuestRelated: false,
          associatedLocationId: `cell_${cellId}`,
        }});
      };

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
            recordAccount(discovery.id, siteCellId, hs.name, hs.kind);

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
          // Discovery follows the arrived body; panning the camera cannot find a doorway.

          const distanceToDungeon = Math.hypot(playerX - de.xM, playerZ - de.zM);
          if (distanceToDungeon <= de.discoveryRadiusM) {


            const seed = state.worldSeed ?? 42;
            const name = dungeonNameForEntrance(seed, de.sitePath) ?? 'an unknown dungeon';
            recordAccount(de.id, de.cellId, name, de.entranceKind);
            if (discoveredDungeonRef.current.has(de.id) ||
              state.discoveredHiddenSites.some(known => known.id === de.id)) continue;
            discoveredDungeonRef.current.add(de.id);

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
      state.discoveryLog,
      state.gameTime,
      state.playerCell?.cellId,
      state.worldSeed,
      state.worldBusinesses,
      state.townSim,
    ],
  );

  return {
    checkProximityDiscoveries,
  };
}
