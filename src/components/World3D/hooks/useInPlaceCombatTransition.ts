// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 19:30:23
 * Dependents: components/World3D/World3DWrapper.tsx
 * Imports: 21 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { useCallback, useEffect, useRef } from 'react';
import { useGameState } from '../../../state/GameContext';
import type { DisposableChunkLoader } from '../createWorkerChunkLoader';
import type { GroundWorld } from '../../../systems/worldforge/bridge/groundChunkLoader';
import { groundSurfaceYM } from '../terrain/groundSurfaceYM';
import { scheduleClockFromGameTime } from '../../../systems/worldforge/roster/gameClock';
import type { BattleMapBiome, BattleMapData } from '../../../types/combat';
import type { Monster } from '../../../types';
import {
  prepareActiveGroundSettlementEncounter,
  registerActiveGroundCombatProvider,
  registerActiveGroundOpeningCombatProvider,
  type ActiveGroundOpeningEncounterRequest,
  type ActiveGroundSettlementEncounterRequest,
} from '../../../systems/combat/fightInPlace/activeGroundCombatSession';
import { planBattlefieldFromExploration } from '../../../systems/combat/fightInPlace/explorationBattlefieldContext';
import { findStatePatrolWorldEvent } from '../../../systems/combat/worldScenario/statePatrolWorldEvent';
import type { OpeningThreatSceneReceipt } from '../../../systems/combat/worldScenario/worldforgeEncounterReceipt';
import { getGameDay } from '../../../utils/core';
import { surfaceHostileSourceScope, SURFACE_HOSTILE_CONTACT_RADIUS_M } from '../../../systems/combat/worldScenario/surfaceHostileContinuity';

/**
 * Hook for managing in-place combat transitions, battle referee handoffs, and hostile encounters.
 *
 * When exploration in the 3D ground world turns into combat (via walking into a hostile creature,
 * encountering a state patrol, or opening a confrontation), this hook captures the exact 3D player
 * position, extracts a 40x30 tactical battle map from the live ground terrain, registers active
 * combat providers, and freezes the scene for fight-in-place battle mode.
 *
 * Called by: World3DWrapper.tsx
 * Depends on: GameContext, fightInPlaceHandoff, handleEncounter, and worldScenario systems
 */

// ============================================================================
// Provenance Helper
// ============================================================================

/**
 * Mark a terrain patch as a projection of the live world before combat owns it.
 *
 * The battle map painter uses this lineage to avoid inventing roads, shoreline props,
 * and set pieces that are absent from the source GroundWorld.
 */
export function attachWorldforgeBattleMapProvenance(
  mapData: BattleMapData,
  worldSeed: number,
  anchorCellId: number | undefined,
  anchorX: number,
  anchorZ: number,
): BattleMapData {
  return {
    ...mapData,
    provenance: {
      kind: 'worldforge',
      worldSeed,
      anchorCellId,
      anchorWorldMeters: { x: anchorX, z: anchorZ },
      generationPath: ['World', 'Region', 'Local', 'Ground', 'Tactical patch'],
    },
  };
}

/**
 * True when the player's ground-meters position falls inside a generated town's
 * footprint. `ground.towns` carries each site's center and half-extent, so this
 * is the settlement signal the battlefield picker needs — the surface biome
 * under a town is still "Grassland", which would otherwise theme a street fight
 * as open country.
 */
export function standsInSettlement(
  ground: Pick<GroundWorld, 'towns'>,
  xM: number,
  zM: number,
): boolean {
  return (ground.towns ?? []).some((town) => (
    Math.abs(xM - town.xM) <= town.halfM && Math.abs(zM - town.zM) <= town.halfM
  ));
}

// ============================================================================
// Types
// ============================================================================

export interface UseInPlaceCombatTransitionOptions {
  /** Reference to the currently loaded ground world */
  groundRef: React.MutableRefObject<GroundWorld | null>;
  /** Reference to the terrain patch extraction utility */
  extractPatchRef: React.MutableRefObject<
    | typeof import('../../../systems/worldforge/bridge/groundChunkLoader').extractLocalTerrainPatch
    | null
  >;
  /** Reference to the ground occupant query utility */
  groundOccupantsAtRef: React.MutableRefObject<
    | typeof import('../../../systems/worldforge/bridge/groundAgentMotion').allGroundAgentsAt
    | null
  >;
  /** Reference to the latest ground-space coordinates */
  lastGroundXZ: React.MutableRefObject<{ x: number; z: number }>;
  /** Active ground view configuration */
  wfGroundView: {
    start: readonly [number, number, number];
    surfaceY: number;
    tile: { x: number; y: number };
    localeExtent: { cols: number; rows: number };
  } | null;
  /** Active chunk loader */
  loader: DisposableChunkLoader | undefined;
  /** Shared ref indicating whether combat transition is currently active */
  combatTriggered: React.MutableRefObject<boolean>;
}

export interface UseInPlaceCombatTransitionResult {
  /** Checks for state patrols and hostile creature encounters around the given coordinate */
  checkCombatTriggers: (x: number, z: number, tile: { x: number; y: number }) => void;
  /** Developer utility to trigger a fight-in-place test encounter at current coordinates */
  startFightInPlace: () => Promise<void>;
}

// ============================================================================
// Combat Transition Hook Implementation
// ============================================================================

export function useInPlaceCombatTransition({
  groundRef,
  extractPatchRef,
  groundOccupantsAtRef,
  lastGroundXZ,
  wfGroundView,
  loader,
  combatTriggered,
}: UseInPlaceCombatTransitionOptions): UseInPlaceCombatTransitionResult {
  const { dispatch, state } = useGameState();

  // State patrol scans run on a high-frequency movement callback. Remember each
  // deterministic event attempted during this mounted ground session so a
  // source gap or withheld provider result cannot spam the same request.
  const statePatrolAttemptedRef = useRef<Set<string>>(new Set());
  // Report one profile failure per actual approach, rather than at movement frequency.
  const surfaceSourceGapsRef = useRef<Set<string>>(new Set());
  const exploringRef = useRef(true);
  useEffect(() => {
    exploringRef.current = true;
    return () => { exploringRef.current = false; };
  }, []);

  // ========================================================================
  // Live GroundWorld Combat Provider Registration
  // ========================================================================
  // NPC and world-event actions run outside this component, but only this
  // component owns the generated GroundWorld, exact player meters, and worker
  // loader. Publish a provider while ground mode is live.
  // ========================================================================

  useEffect(() => {
    if (!wfGroundView || !loader) return undefined;

    /**
     * Extract the tactical crop once from the player's exact live meters.
     */
    const extractCurrentBattlefield = () => {
      const ground = groundRef.current;
      const extractPatch = extractPatchRef.current;
      if (!ground || !extractPatch) {
        return {
          status: 'unavailable' as const,
          detail: 'The GroundWorld is mounted but its tactical extractor is not ready.',
        };
      }

      const { x, z } = lastGroundXZ.current;
      const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(x / 1.524)));
      const by = Math.max(0, Math.min(ground.rows - 1, Math.round(z / 1.524)));
      const groundBiome = ground.biomeIds[by * ground.cols + bx] ?? '';
      // Full-freedom initiation (9C): the battlefield theme is now picked from
      // the WHOLE standing context — terrain id, settlement footprint, and the
      // hostiles in reach — by one shared, pure, testable rule. It replaces the
      // three inline branches (desert / swamp / else-forest) that covered only
      // three of WorldForge's thirteen biomes and could not be reached from any
      // other combat entry point. Behavior for those three inputs is preserved.
      const explorationPlan = planBattlefieldFromExploration({
        positionM: { x, z },
        terrainId: groundBiome,
        inSettlement: standsInSettlement(ground, x, z),
        nearbyEntities: (ground.hostiles ?? []).map((hostile) => ({
          id: hostile.id,
          name: hostile.name,
          xM: hostile.xM,
          zM: hostile.zM,
          hostile: true,
        })),
      });
      const theme: BattleMapBiome = explorationPlan.theme;
      const worldSeed = state.worldSeed ?? 42;
      const occupantClock =
        state.gameTime instanceof Date
          ? scheduleClockFromGameTime(state.gameTime)
          : 12;
      const liveOccupants = groundOccupantsAtRef.current?.(ground, occupantClock);
      const mapData = attachWorldforgeBattleMapProvenance(
        extractPatch(
          ground,
          x,
          z,
          theme,
          worldSeed,
          liveOccupants ? { occupants: liveOccupants } : undefined,
        ),
        worldSeed,
        state.playerCell?.cellId,
        x,
        z,
      );

      return {
        status: 'ready' as const,
        ground,
        x,
        z,
        worldSeed,
        mapData,
        explorationPlan,
      };
    };

    /**
     * Freeze the exact 3D position and live scene handoff before changing phase.
     */
    const freezeCurrentGroundForCombat = async (
      ground: GroundWorld,
      x: number,
      z: number,
      worldSeed: number,
    ) => {
      combatTriggered.current = true;
      dispatch({
        type: 'SET_PLAYER_GROUND_POS',
        payload: {
          position: {
            tileX: wfGroundView.tile.x,
            tileY: wfGroundView.tile.y,
            xM: x,
            zM: z,
          },
        },
      });
      const { setFightInPlaceHandoff } = await import(
        '../../../systems/combat/fightInPlace/fightInPlaceHandoff'
      );
      setFightInPlaceHandoff({
        ground,
        loader,
        sceneOrigin: { x: wfGroundView.start[0], z: wfGroundView.start[2] },
        anchor: { playerXM: x, playerZM: z },
        surfaceY: groundSurfaceYM(ground, x, z),
        worldSeed,
      });
    };

    const prepareSettlementEncounter = async (
      request: ActiveGroundSettlementEncounterRequest,
    ) => {
      const current = extractCurrentBattlefield();
      if (current.status !== 'ready') return current;
      const { ground, x, z, worldSeed, mapData: extractedMap } = current;

      const playerStanding =
        request.trigger.kind === 'state-confrontation'
          ? request.playerFactionStandings[request.trigger.factionId]
          : undefined;
      const { projectLiveSettlementEncounter } = await import(
        '../../../systems/combat/worldScenario/liveSettlementEncounter'
      );
      const projection = projectLiveSettlementEncounter(
        ground,
        extractedMap,
        { x, z },
        {
          trigger: request.trigger,
          knownCrimes: request.knownCrimes,
          playerStanding,
        },
      );
      if (projection.status !== 'ready') {
        return {
          status: projection.status,
          detail: projection.detail,
        };
      }
      if (!projection.defendingForce) {
        return {
          status: 'source-gap' as const,
          detail: 'The live settlement projection was ready but supplied no defending-force receipt.',
        };
      }

      const { createWorldDefenderCombatants } = await import(
        '../../../systems/combat/worldScenario/worldEncounterCombatants'
      );
      const combatants = await createWorldDefenderCombatants(projection.defendingForce);
      if (combatants.length === 0) {
        return {
          status: 'source-gap' as const,
          detail: 'Hostility was authorized, but the source regiment produced no tactical actors.',
        };
      }

      await freezeCurrentGroundForCombat(ground, x, z, worldSeed);

      return {
        status: 'ready' as const,
        detail: projection.detail,
        payload: {
          monsters: [],
          combatants,
          extractedBattleMap: projection.mapData,
        },
      };
    };

    const prepareOpeningEncounter = async (
      request: ActiveGroundOpeningEncounterRequest,
    ) => {
      const current = extractCurrentBattlefield();
      if (current.status !== 'ready') return current;

      const activeCellId = state.playerCell?.cellId;
      if (
        request.source.worldSeed !== current.worldSeed ||
        request.source.cellId !== activeCellId
      ) {
        return {
          status: 'source-gap' as const,
          detail: `Opening receipt ${request.source.receiptId} does not match the mounted world ${current.worldSeed}, cell ${activeCellId ?? 'unknown'}.`,
        };
      }

      const receiptCenter = request.source.centerPx;
      const mountedCenter =
        state.entry3DAnchor?.cellId === activeCellId
          ? state.entry3DAnchor.centerPx
          : undefined;
      if (
        receiptCenter &&
        mountedCenter &&
        (receiptCenter[0] !== mountedCenter[0] || receiptCenter[1] !== mountedCenter[1])
      ) {
        return {
          status: 'source-gap' as const,
          detail: `Opening receipt ${request.source.receiptId} does not match the mounted WorldForge site center.`,
        };
      }

      const { projectOpeningThreatBattlefield } = await import(
        '../../../systems/combat/worldScenario/openingThreatBattlefield'
      );
      const existingOpeningScene = [...(state.worldforgeEncounterReceipts ?? [])]
        .reverse()
        .find(
          (receipt): receipt is OpeningThreatSceneReceipt =>
            receipt.kind === 'opening-threat-scene' &&
            receipt.sourceOpeningReceiptId === request.source.receiptId,
        );
      const projection = projectOpeningThreatBattlefield(
        current.mapData,
        request.source,
        request.enemies,
        existingOpeningScene,
      );
      if (projection.status !== 'ready') return projection;

      await freezeCurrentGroundForCombat(
        current.ground,
        current.x,
        current.z,
        current.worldSeed,
      );
      return projection;
    };

    const unregisterSettlement = registerActiveGroundCombatProvider(prepareSettlementEncounter);
    const unregisterOpening = registerActiveGroundOpeningCombatProvider(prepareOpeningEncounter);
    return () => {
      unregisterOpening();
      unregisterSettlement();
    };
  }, [
    combatTriggered,
    dispatch,
    extractPatchRef,
    groundOccupantsAtRef,
    groundRef,
    lastGroundXZ,
    loader,
    state.entry3DAnchor,
    state.gameTime,
    state.playerCell?.cellId,
    state.worldSeed,
    state.worldforgeEncounterReceipts,
    wfGroundView,
  ]);

  // ========================================================================
  // Combat Proximity & State Patrol Evaluation
  // ========================================================================

  const checkCombatTriggers = useCallback(
    (x: number, z: number, tile: { x: number; y: number }) => {
      if (combatTriggered.current) return;
      const ground = groundRef.current;
      const extractPatch = extractPatchRef.current;

      // 1. State Patrol Check
      if (ground && state.gameTime instanceof Date) {
        const statePatrolEvent = findStatePatrolWorldEvent(ground, {
          worldSeed: state.worldSeed ?? 42,
          gameDay: getGameDay(state.gameTime),
          gameTimeMs: state.gameTime.getTime(),
          playerGroundMeters: { x, z },
          playerFactionStandings: state.playerFactionStandings ?? {},
          receipts: state.worldforgeEncounterReceipts ?? [],
        });

        if (statePatrolEvent && !statePatrolAttemptedRef.current.has(statePatrolEvent.id)) {
          statePatrolAttemptedRef.current.add(statePatrolEvent.id);
          combatTriggered.current = true;

          void (async () => {
            try {
              const prepared = await prepareActiveGroundSettlementEncounter({
                trigger: statePatrolEvent.trigger,
                knownCrimes: state.notoriety?.knownCrimes ?? [],
                playerFactionStandings: state.playerFactionStandings ?? {},
              });

              if (prepared.status === 'unavailable') {
                statePatrolAttemptedRef.current.delete(statePatrolEvent.id);
                combatTriggered.current = false;
                return;
              }

              if (prepared.status !== 'ready') {
                combatTriggered.current = false;
                if (prepared.status === 'source-gap') {
                  dispatch({
                    type: 'ADD_NOTIFICATION',
                    payload: {
                      type: 'warning',
                      message: `State patrol source gap: ${prepared.detail}`,
                    },
                  });
                }
                return;
              }

              dispatch({
                type: 'RECORD_WORLDFORGE_ENCOUNTER',
                payload: { receipt: statePatrolEvent.receipt },
              });
              dispatch({
                type: 'ADD_MESSAGE',
                payload: {
                  id: statePatrolEvent.receipt.triggeredAtGameTimeMs,
                  text: `${statePatrolEvent.defense.stateName}'s patrol recognizes the party near ${statePatrolEvent.defense.burgName} and moves to intercept.`,
                  sender: 'system',
                  timestamp: new Date(statePatrolEvent.receipt.triggeredAtGameTimeMs),
                },
              });

              const { handleStartBattleMapEncounter } = await import(
                '../../../hooks/actions/handleEncounter'
              );
              await handleStartBattleMapEncounter(dispatch, prepared.payload);
            } catch (error) {
              combatTriggered.current = false;
              dispatch({
                type: 'ADD_NOTIFICATION',
                payload: {
                  type: 'error',
                  message: `State patrol encounter failed: ${error instanceof Error ? error.message : String(error)}`,
                },
              });
            }
          })();
          return;
        }
      }

      // 2. Hostile Creatures Proximity Check (4m radius)
      if (ground && extractPatch) {
        for (const h of ground.hostiles) {
          const dist = Math.hypot(x - h.xM, z - h.zM);
          const contactKey = [state.worldSeed ?? 42, state.playerCell?.cellId ?? tile.x, h.id].join(':');
          if (dist >= SURFACE_HOSTILE_CONTACT_RADIUS_M) surfaceSourceGapsRef.current.delete(contactKey);
          if (dist < SURFACE_HOSTILE_CONTACT_RADIUS_M && !surfaceSourceGapsRef.current.has(contactKey)) {
            combatTriggered.current = true;

            void (async () => {
              // Catalog imports must not turn a past footfall into a forced fight.
              const stillAtContact = () => exploringRef.current && groundRef.current === ground
                && lastGroundXZ.current.x === x && lastGroundXZ.current.z === z;
              try {
                const { resolveSurfaceHostileTemplate } = await import(
                  '../../../systems/combat/worldScenario/surfaceHostileTemplate'
                );
                const profile = await resolveSurfaceHostileTemplate(h);
                if (!stillAtContact()) { combatTriggered.current = false; return; }
                if (profile.status !== 'ready') {
                  surfaceSourceGapsRef.current.add(contactKey);
                  combatTriggered.current = false;
                  dispatch({type: 'ADD_NOTIFICATION', payload: {type: 'warning',
                    message: 'Combat unavailable for ' + h.name + ': ' + profile.detail + ' No encounter has started.',
                  }});
                  return;
                }
                const monster = profile.monster;
                const { prepareSurfaceHostileEncounter, selectSurfaceHostileParticipants } = await import('../../../systems/combat/worldScenario/surfaceHostileEncounter');
                if (!stillAtContact()) { combatTriggered.current = false; return; }
                const sourceScope = surfaceHostileSourceScope(state);
                const participants = selectSurfaceHostileParticipants({hostile: h, hostiles: ground.hostiles,
                  player: {xM: x, zM: z}, worldSeed: state.worldSeed ?? 42, cellId: state.playerCell?.cellId ?? tile.x,
                  sourceScope, receipts: state.worldforgeEncounterReceipts ?? []});
                if (participants.status !== 'ready') {
                  surfaceSourceGapsRef.current.add(contactKey); combatTriggered.current = false;
                  dispatch({type: 'ADD_NOTIFICATION', payload: {type: 'warning', message: participants.detail + ' No encounter has started.'}});
                  return;
                }
                // Validate every participating source body before extracting or
                // freezing anything. A broken pack member cannot be omitted.
                const profiles: Array<{entityId: string; monster: Monster}> = [];
                for (const member of participants.hostiles) {
                  if (member.id === h.id) continue;
                  const resolved = await resolveSurfaceHostileTemplate(member);
                  if (!stillAtContact()) { combatTriggered.current = false; return; }
                  if (resolved.status !== 'ready') {
                    surfaceSourceGapsRef.current.add(contactKey); combatTriggered.current = false;
                    dispatch({type: 'ADD_NOTIFICATION', payload: {type: 'warning',
                      message: 'Combat unavailable for ' + member.name + ': ' + resolved.detail + ' No group member was omitted and no encounter has started.'}});
                    return;
                  }
                  profiles.push({entityId: member.id, monster: resolved.monster});
                }
                const { handleStartBattleMapEncounter } = await import(
                  '../../../hooks/actions/handleEncounter'
                );
                if (!stillAtContact()) { combatTriggered.current = false; return; }
                const partyAnchors: Array<{characterId:string;xM:number;zM:number;yM?:number}> = [];
                for (const [index, member] of (state.party ?? []).entries()) {
                  if (index === 0) partyAnchors.push({characterId: member.id, xM: x, zM: z, yM: state.playerGroundPos?.yM});
                  else {
                    const companion = state.companions?.[member.id], where = companion?.whereabouts;
                    if (!companion?.inParty || where?.worldSeed !== state.worldSeed || where.locationId !== state.currentLocationId || !where.position) {
                      surfaceSourceGapsRef.current.add(contactKey); combatTriggered.current = false;
                      dispatch({type: 'ADD_NOTIFICATION', payload: {type: 'warning', message: member.name + ' has no current source-ground position. No encounter has started.'}});
                      return;
                    }
                    partyAnchors.push({characterId: member.id, ...where.position});
                  }
                }

                // Full-freedom initiation (9C): walking into an enemy is THE
                // unscripted combat entry, so it uses the same shared picker as
                // every other route. It previously carried its own third copy of
                // the desert/swamp/forest ternary, which meant a fight started by
                // walking into a wolf on a glacier or in a town square produced a
                // forest battlefield.
                const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(x / 1.524)));
                const by = Math.max(0, Math.min(ground.rows - 1, Math.round(z / 1.524)));
                const groundBiome = ground.biomeIds[by * ground.cols + bx];
                const combatTheme: BattleMapBiome = planBattlefieldFromExploration({
                  positionM: { x, z },
                  terrainId: groundBiome,
                  inSettlement: standsInSettlement(ground, x, z),
                  nearbyEntities: (ground.hostiles ?? []).map((nearby) => ({
                    id: nearby.id,
                    name: nearby.name,
                    xM: nearby.xM,
                    zM: nearby.zM,
                    hostile: true,
                  })),
                }).theme;

                const worldSeed = state.worldSeed ?? 42;
                const occupantClock =
                  state.gameTime instanceof Date
                    ? scheduleClockFromGameTime(state.gameTime)
                    : 12;
                const liveOccupants = groundOccupantsAtRef.current?.(ground, occupantClock);
                const extractedMap = attachWorldforgeBattleMapProvenance(
                  extractPatch(
                    ground,
                    x,
                    z,
                    combatTheme,
                    worldSeed,
                    liveOccupants ? { occupants: liveOccupants } : undefined,
                  ),
                  worldSeed,
                  state.playerCell?.cellId,
                  x,
                  z,
                );

                const prepared = prepareSurfaceHostileEncounter({hostile: h, profile: monster, hostiles: ground.hostiles, profiles, map: extractedMap,
                  worldSeed, cellId: state.playerCell?.cellId ?? tile.x, sourceScope,
                  gameTimeMs: state.gameTime.getTime(), party: partyAnchors, receipts: state.worldforgeEncounterReceipts ?? []});
                if (prepared.status !== 'ready') {
                  surfaceSourceGapsRef.current.add(contactKey); combatTriggered.current = false;
                  dispatch({type: 'ADD_NOTIFICATION', payload: {type: 'warning', message: prepared.detail + ' No encounter has started.'}});
                  return;
                }
                // Persist only a fully validated contact; the root outcome gate
                // consumes this same receipt before clearing the tactical map.
                dispatch({type: 'SET_PLAYER_GROUND_POS', payload: {position: {
                  tileX: tile.x, tileY: tile.y, xM: x, zM: z,
                  ...(state.playerGroundPos?.yM !== undefined ? {yM: state.playerGroundPos.yM} : {}),
                }}});
                dispatch({type: 'RECORD_WORLDFORGE_ENCOUNTER', payload: {receipt: prepared.receipt}});
                await handleStartBattleMapEncounter(dispatch, prepared.payload);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[combat handoff] failed to enter battle:', err);
                combatTriggered.current = false;
                if (!stillAtContact()) return;
                surfaceSourceGapsRef.current.add(contactKey);
                dispatch({type: 'ADD_NOTIFICATION', payload: {type: 'error',
                  message: 'Could not prepare combat for ' + h.name + '. No encounter has started.',
                }});
              }
            })();
            break;
          }
        }
      }
    },
    [
      combatTriggered,
      dispatch,
      extractPatchRef,
      groundOccupantsAtRef,
      groundRef,
      state.gameTime,
      state.notoriety?.knownCrimes,
      state.playerCell?.cellId,
      state.playerFactionStandings,
      state.worldSeed,
      state.worldforgeEncounterReceipts,
      state.party, state.companions, state.currentLocationId, state.playerGroundPos,
      state.atlasGroundAddress, state.entry3DAnchor,
      lastGroundXZ,
    ],
  );

  // ========================================================================
  // Fight-in-place Developer Entry
  // ========================================================================

  const startFightInPlace = useCallback(async () => {
    const ground = groundRef.current;
    const extractPatch = extractPatchRef.current;
    if (!ground || !extractPatch) {
      // eslint-disable-next-line no-console
      console.warn('[fip dev] no live ground world yet — enter 3D first');
      return;
    }
    const { pickCombatSurface } = await import(
      '../../../systems/combat/fightInPlace/combatSurfacePicker'
    );
    const decision = pickCombatSurface({ worldLive: true });
    // eslint-disable-next-line no-console
    console.info(
      `[fip dev] surface=${decision.surface} deriveFromWorld=${decision.deriveFromWorld} — ${decision.reason}`,
    );

    const { x, z } = lastGroundXZ.current;
    const bx = Math.max(0, Math.min(ground.cols - 1, Math.round(x / 1.524)));
    const by = Math.max(0, Math.min(ground.rows - 1, Math.round(z / 1.524)));
    const groundBiome = ground.biomeIds[by * ground.cols + bx] ?? '';
    // Third and last copy of the old inline picker, now routed through the same
    // shared rule (9C) so the dev entry cannot disagree with production.
    const devPlan = planBattlefieldFromExploration({
      positionM: { x, z },
      terrainId: groundBiome,
      inSettlement: standsInSettlement(ground, x, z),
    });
    const theme: BattleMapBiome = devPlan.theme;
    // eslint-disable-next-line no-console
    console.info(`[fip dev] battlefield: ${devPlan.reason}`);

    const worldSeed = state.worldSeed ?? 42;
    const occupantClock =
      state.gameTime instanceof Date
        ? scheduleClockFromGameTime(state.gameTime)
        : 12;
    const liveOccupants = groundOccupantsAtRef.current?.(ground, occupantClock);
    const extractedMap = decision.deriveFromWorld
      ? attachWorldforgeBattleMapProvenance(
          extractPatch(
            ground,
            x,
            z,
            theme,
            worldSeed,
            liveOccupants ? { occupants: liveOccupants } : undefined,
          ),
          worldSeed,
          state.playerCell?.cellId,
          x,
          z,
        )
      : undefined;

    if (decision.deriveFromWorld && loader && wfGroundView) {
      const { setFightInPlaceHandoff } = await import(
        '../../../systems/combat/fightInPlace/fightInPlaceHandoff'
      );
      setFightInPlaceHandoff({
        ground,
        loader,
        sceneOrigin: { x: wfGroundView.start[0], z: wfGroundView.start[2] },
        anchor: { playerXM: x, playerZM: z },
        surfaceY: groundSurfaceYM(ground, x, z),
        worldSeed: state.worldSeed ?? 42,
      });
    }

    const tile = wfGroundView?.tile;
    if (tile) {
      dispatch({
        type: 'SET_PLAYER_GROUND_POS',
        payload: { position: { tileX: tile.x, tileY: tile.y, xM: x, zM: z } },
      });
    }

    try {
      const { handleStartBattleMapEncounter } = await import(
        '../../../hooks/actions/handleEncounter'
      );
      combatTriggered.current = true;
      await handleStartBattleMapEncounter(dispatch, {
        monsters: [
          {
            name: 'Test Brigand',
            quantity: 1,
            cr: '1/4',
            description: 'Dev fight-in-place test combatant',
          },
        ],
        extractedBattleMap: extractedMap,
      });
      // eslint-disable-next-line no-console
      console.info('[fip dev] encounter dispatched — phase should be COMBAT');
    } catch (err) {
      combatTriggered.current = false;
      // eslint-disable-next-line no-console
      console.error('[fip dev] failed to start fight:', err);
    }
  }, [
    combatTriggered,
    dispatch,
    extractPatchRef,
    groundOccupantsAtRef,
    groundRef,
    lastGroundXZ,
    loader,
    state.gameTime,
    state.playerCell?.cellId,
    state.worldSeed,
    wfGroundView,
  ]);

  // Expose dev test window hooks and URL param ?fipfight auto-trigger
  useEffect(() => {
    (window as unknown as { __fipTestFight?: () => void }).__fipTestFight = () => {
      void startFightInPlace();
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('fipfight')
    ) {
      timer = setTimeout(() => {
        void startFightInPlace();
      }, 2500);
    }

    return () => {
      if (timer) clearTimeout(timer);
      delete (window as unknown as { __fipTestFight?: () => void }).__fipTestFight;
    };
  }, [startFightInPlace]);

  return {
    checkCombatTriggers,
    startFightInPlace,
  };
}
