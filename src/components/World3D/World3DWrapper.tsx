/**
 * @file src/components/World3D/World3DWrapper.tsx
 * Wraps World3DScene and connects the camera position to game state dispatch.
 *
 * Responsibilities:
 * 1. Renders World3DScene with the correct loader and start position
 * 2. Listens to camera position changes and dispatches SET_PLAYER_WORLD_POS
 * 3. Resolves terrain height (Y) from WorldData during position updates
 * 4. Throttles position dispatches to ~10Hz to avoid dispatch spam
 * 5. Coordinates modular lifecycle sub-hooks:
 *    - useWorld3DDiscovery: Proximity discovery of hidden sites and dungeon entrances
 *    - useInteriorTransition: Transitions between exterior ground and dungeon interiors
 *    - useInPlaceCombatTransition: Live battle map extraction, encounters, and fight-in-place
 * 6. Renders InWorldHUD overlay (control panel, view-mode toggle, debug)
 * 7. Builds a worker-backed ChunkLoader for PLAYING (W3DUI-1) so mesh work stays off the main thread
 *
 * Sandbox `World3DDemo` still uses an inline loader; only this PLAYING wrapper uses the worker path.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 03/11/2026, 08:18:36
 * Dependents: components/screens/PlayingScreen.tsx
 * Imports: 83 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {activeLodgingReservation, lodgingRoomDoorAccess, lodgingRestError, rememberRestGround} from '../../systems/gameplay/lodging';
import React, { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import World3DScene from './World3DScene';
import { doorInteractionError } from './groundDoorInteraction';
import type {NearbyBuildingDoorAction} from './NearbyBuildingDoor';
import type {NearbyFurnishingAction,ResolveFurnishingPlan} from './NearbyFurnishing';
import {GuestBedRestAction} from './GuestBedRestAction';
import { createHouseholdResidentNpc, civicResidentHomePlot, residentMemberIndex, residentNpcId, residentReachError, residentSiteAt, type ReadResidentPick } from './groundResidentInteraction';
import { siteDoorKey, siteOrientationFromQuad } from '@/systems/worldforge/bridge/sitePartTransform';
import { recipeFromCharacter, recipeFromRichNpc } from '@/systems/entities3d/recipeFromCharacter';
import { createForgeAssetService } from '@/systems/worldforge/assets/forgeAssetService';
import { assetAddress } from '@/systems/worldforge/assets/assetKey';

const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
let _stubService: ReturnType<typeof createForgeAssetService> | undefined;
if (urlParams.get('stubForgeAssets') === '1') {
  _stubService = createForgeAssetService({
    generator: {
      async generate(key) {
        // Simple red texture data URI
        const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2NkYGD4z8DAwMgAI0AMDA4YAQFDzMCmAAAAAElFTkSuQmCC'; 
        return { key, address: assetAddress(key), source: 'generated', imageUri: dataUri };
      }
    },
    online: true,
  });
}

import InWorldHUD from './InWorldHUD';
import {NearbyFurnishingChoices} from './NearbyFurnishingChoices';
import { furnishingReachError, type AvatarFootfall, type FurnishingPick } from './groundFurnishingInteraction';
import {isPublicLibraryDesk, libraryReadingAccessError} from './libraryReadingAccess';
import {PublicSeatRestAction, publicSeatRestAccessError} from './publicSeatRest';
import {TempleDedicationAction, templeDedicationAccessError} from './templeDedication';
import type {TempleDedicationReading} from '../../systems/religion/worldforgeTemple';
import {resolveTownForLocation} from '../../systems/worldforge/townsim/chronicleForLocation';
import {selectTownNews} from '../../systems/worldforge/townsim/townNews';
import { workbenchAccessError } from './workbenchAccess';
import { householdResidentAliveAt, type TownLifeRegistry } from '../../systems/worldforge/roster/agentLife';
import { householdMemberIdentity } from '../../systems/worldforge/town/householdBrief';
import { householdNpcAliveAt } from '../../systems/worldforge/townsim/householdNpc';
const TownSalvageWorkshop = React.lazy(() => import('../Crafting/SalvageModal').then(module => ({default: module.SalvageModal})));
import type { TownBuildingVisit } from '../Worldforge/townBuildingVisit';
import { HouseholdContainerContents } from './HouseholdContainerContents';
import ResidentProfile from './ResidentProfile';
import { latestSpokenDialogueReplies } from '@/systems/social/npcDialogueMemory';
import DungeonExpeditionOverlay from './DungeonExpeditionOverlay';
import type { Action } from '../../types';
import { Button } from '../ui/Button';
import { SystemMenu } from '../ActionPane/SystemMenu';
import WorldMessageLog from './WorldMessageLog';
import WorldGenLoadingScreen, { type WorldGenLoadingStage } from './WorldGenLoadingScreen';
import type { DisposableWorldGenClient } from './createWorldGenClient';
import LocaleMovePane from './LocaleMovePane';
import { type ClickMoveIntent } from './clickMoveAuthority';
import { localeFeetToGroundMeters } from '../../systems/worldforge/local/localePosition';
import { requestMapCenterOnPlayer, requestMapDrillToPlayerTown } from '../Worldforge/mapFocusSignal';
import {
  OPEN_AGENT_SIM_EVENT,
  OPEN_TOWN_HISTORY_EVENT,
  requestDevOverlay,
} from '../debug/devOverlayEvents';
import { type DisposableChunkLoader } from './createWorkerChunkLoader';
import { resolveGroundEntryCellId } from './entryCellIdentity';
import { usePlayerWorldPos, useWorldViewMode } from '../../hooks/useWorldViewMode';
import { useGameState } from '../../state/GameContext';
import { type SceneCastMember } from './SceneCast';
import { projectSurfaceHostileOutcomes, surfaceHostileSourceScope } from '../../systems/combat/worldScenario/surfaceHostileContinuity';
import { placeCompanionCast, partyCompanionPresence, type CompanionPosition } from '../../systems/companions/companionWhereabouts';
import { scheduleClockFromGameTime } from '../../systems/worldforge/roster/gameClock';
import { GamePhase } from '../../types/core';
import type { PlayerWorldPosition } from '../../types';

import { WORLD3D_CONFIG } from '../../systems/world3d/config';
import { groundSurfaceYM } from './terrain/groundSurfaceYM';
import {measureEntryActors,selectInitialPublicTownEntry,resolveCompanionActivityPlacements} from './initialTownEntry';
import { qualifyPartyJourneyArrival } from './partyJourneyArrival';
import {companionActivityContactError} from '@/systems/companions/companionWorldActivities';
import {layoutCast} from '@/systems/entities3d/sceneCastUtils';
import { POSITION_DISPATCH_INTERVAL_MS } from './transitionTiming';
// The worldforge bridge modules pull the entire FMG generation stack —
// they are DYNAMICALLY imported inside the ground branch below so PLAYING's
// initial chunk (and the unit-test module graph) never pays for them; the
// same reason AtlasDemo is lazy. Only types may be imported statically.
import type { WorldDelta } from '../../systems/worldforge/delta/types';
import type {
  GroundWorld,
} from '../../systems/worldforge/bridge/groundChunkLoader';
import type { RegionArtifact } from '../../systems/worldforge/artifacts';
import {
  artifactsForAtlasGroundDrilldown,
  atlasGroundAddressFromDrilldown,
  groundStartForFocus,
  type AtlasGroundDrilldown,
} from '../../systems/worldforge/leaf3d/atlasGroundDrilldown';
import {
  atlasGroundSpawnForAddress,
} from '../../systems/worldforge/leaf3d/atlasGroundContinuity';
import {captureRenderedGroundPropShape, measureRenderedGroundProps} from './groundPropGeometry';
import {verifyRenderedPropSupport} from './groundPropSupport';
import {proposeExteriorPropRepair, exteriorPropClearanceIssues} from '../../systems/worldforge/props/exteriorPropRepair';
import {exteriorRevisionContext, exteriorRevisionChain, freezeExteriorPropRevision, freezeInteriorWildPropRetirement, isInteriorWildPropCandidate, propDataSignature} from '../../systems/worldforge/props/exteriorPropRevision';
import {propSourceId} from '../../systems/worldforge/props/propSchema';
import {makeGroundWorldProbe, runPropPlacementGate} from '../../systems/worldforge/bridge/propPlacementGate';
import {guestCirculationRecipeFor} from '../../systems/worldforge/interior/guestCirculation';
import {bedsideStorageMoves, outsideLayoutRepairEnvelope} from '../../systems/worldforge/interior/buildingLayoutRepair';
import type { BuildingSourcesByBurg } from '../../systems/worldforge/interior/buildingSource';
import type { BuildingEventLogsByBurg } from '../../systems/worldforge/interior/blueprintTypes';
import {
  buildingHistoryEventCount,
  cloneBuildingEventHistory,
} from '../../systems/worldforge/interior/buildingEventHistory';
import type { TownSimRegistry } from '../../systems/worldforge/townsim/townSimRegistry';
import { computeBurgMerchants } from '../../systems/worldforge/townsim/registerBurgMerchants';
import { getGameDay } from '../../utils/core';

// Sub-hook imports
import { useWorld3DDiscovery } from './hooks/useWorld3DDiscovery';
import { useInteriorTransition } from './hooks/useInteriorTransition';
import {
  useInPlaceCombatTransition,
  attachWorldforgeBattleMapProvenance,
} from './hooks/useInPlaceCombatTransition';

// Re-export provenance helper for backwards compatibility
export { attachWorldforgeBattleMapProvenance };

// PLAYING's 3D view enters the Worldforge ground world (walking scale,
// interiors, occupants) at the party/clicked tile BY DEFAULT — the legacy
// continent streamer (km-scale smooth pyramids, lattice-banded tree rows)
// is what Remy's 2026-06-12 atlas→Enter-3D review rejected; SPEC decision:
// replace legacy aggressively. ?wf_legacy=1 keeps the old streamer for
// comparison. Optional ?wf_tile=x,y overrides the entry tile; ?wf_seed=
// pins the world; ?wf_town=1 auto-picks the nearest burg-bearing tile.
//
// IMPORTANT: this module is LAZY-loaded — by the time Enter 3D mounts it,
// useHistorySync has already REWRITTEN the URL (?phase=playing...) and the
// wf_ params are gone from location.search. The navigation timing entry
// preserves the URL the document was actually loaded with, so flags read
// from there survive the rewrite. Current search wins when present (so
// hand-editing the URL mid-session still works).
function wfParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const current = new URLSearchParams(window.location.search).get(name);
  if (current !== null) return current;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.name) return new URL(nav.name).searchParams.get(name);
  } catch {
    /* fall through */
  }
  return null;
}
const WF_GROUND = wfParam('wf_legacy') !== '1';
// Grid retirement: the ?wf_tile / ?wf_town grid-coord dev overrides are gone —
// 3D entry is cell-native (anchor cell or the player's canonical cell).
const WF_SEED: number | null = (() => {
  const raw = wfParam('wf_seed');
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
})();

interface World3DWrapperProps {
  /** Forward normal player commands to the existing action authority inside expeditions. */
  onAction?: (action: Action) => void;
  /** Initial world position to start at. */
  entryPosition: { x: number; y: number; z: number };
  /** Exact transient Atlas selection; absent for Classic map and developer entry. */
  atlasGroundDrilldown?: AtlasGroundDrilldown | null;
  /**
   * Click-to-talk: called with an NPC figure's id when the player clicks a
   * townsperson/stranger in the 3D world. App wires this to the same `talk`
   * action the 2D action pane runs, so the dialogue opens with full bookkeeping.
   */
  onTalkToNpc?: (npcId: string) => void;
}

// ============================================================================
// Exact Atlas receipt projection
// ============================================================================
// PLAYING owns gameplay, but Atlas owns the selected Region and Local objects.
// This boundary proves the ground adapter receives those exact references and
// derives the spawn from the selected focus rather than a regenerated center.
export type GroundLoaderFactory = typeof import('../../systems/worldforge/bridge/groundChunkLoader').createGroundChunkLoader;

export function createAtlasReceiptGroundSession(
  drilldown: AtlasGroundDrilldown,
  createGroundLoader: GroundLoaderFactory,
  options: Parameters<GroundLoaderFactory>[3] = {},
): {
  ground: GroundWorld;
  start: readonly [number, number, number];
  surfaceY: number;
} {
  // Validate lineage first, then pass the retained object references straight
  // through to the existing Ground adapter. The injected factory is also the
  // narrow proof seam used by the deterministic identity test.
  const { region, local } = artifactsForAtlasGroundDrilldown(drilldown);
  const { ground } = createGroundLoader(
    local,
    drilldown.worldSeed,
    region,
    options,
  );

  // Focus coordinates are authored in absolute Atlas feet. Convert them once
  // to Local meters, then sample the corresponding height for the camera spawn.
  const [xM, zM] = groundStartForFocus(local, drilldown.focus);
  // New feet use the same continuous terrain query as ordinary walking.
  // This never replaces an accepted saved height.

  // Return the already-assembled GroundWorld so PLAYING can attach its worker
  // mesher and full interaction stack without a second terrain generation.
  return {
    ground,
    start: [xM, 0, zM],
    surfaceY: groundSurfaceYM(ground, xM, zM),
  };
}

/** Throttle interval in ms (~10Hz) — see transitionTiming.ts for perf budget. */
const DISPATCH_INTERVAL_MS = POSITION_DISPATCH_INTERVAL_MS;

/**
 * Strip the living-town registry down to worker-safe building history only.
 * Sorted numeric keys make the serialized effect dependency stable when
 * unrelated villagers, news, or prosperity change.
 */
export function compactBuildingEventLogs(
  registry: TownSimRegistry | undefined,
): BuildingEventLogsByBurg | undefined {
  const result: BuildingEventLogsByBurg = {};
  const burgIds = Object.keys(registry ?? {}).map(Number).sort((a, b) => a - b);
  for (const burgId of burgIds) {
    const source = registry?.[burgId]?.buildingEvents;
    if (!source) continue;
    const byPlot: BuildingEventLogsByBurg[number] = {};
    for (const plotId of Object.keys(source).map(Number).sort((a, b) => a - b)) {
      const events = source[plotId];
      if (buildingHistoryEventCount(events) === 0) continue;
      byPlot[plotId] = cloneBuildingEventHistory(events);
    }
    if (Object.keys(byPlot).length) result[burgId] = byPlot;
  }
  return Object.keys(result).length ? result : undefined;
}

/**
 * Name the registered business owners that belong to the retained GroundWorld.
 *
 * The Atlas entry cell can sit beside a town's own cell, so cell-only NPC
 * selectors can omit the exact Local's keepers. These ids use the same burg and
 * plot identity as registerTownContent, giving PLAYING a small clickable cast
 * that routes through the existing talk/dialogue and merchant systems.
 */
export function retainedTownNpcIdsForGround(ground: GroundWorld | null): string[] {
  const ids: string[] = [];
  for (const town of ground?.townPlans ?? []) {
    for (const plot of town.plan.plots) {
      if (plot.role !== 'market' && plot.role !== 'workshop') continue;
      ids.push(`npc_burg_${town.burgId}_plot_${plot.id}`);
    }
  }
  return ids;
}

const World3DWrapper: React.FC<World3DWrapperProps> = ({
  entryPosition,
  atlasGroundDrilldown,
  onTalkToNpc,
  onAction,
}) => {
  const { dispatch, state } = useGameState();
  const { setPosition, position } = usePlayerWorldPos();
  const { setMode } = useWorldViewMode();
  const isDevModeEnabled = state.isDevModeEnabled ?? false;
  const buildingEventLogJson = useMemo(
    () => JSON.stringify(compactBuildingEventLogs(state.townSim) ?? {}),
    [state.townSim],
  );

  // Only life facts and admitted layout selection enter this worker signature. Wealth, gossip and clock
  // seconds must not tear down a town while the player is walking through it.
  const townLifeJson = useMemo(() => JSON.stringify(Object.fromEntries(
    // Shop keepers (NPC lives, 2026-11-02): keeper and closure only, so the 3D
    // counter follows an heir or a reopening; a fortune change never rebuilds.
    Object.entries(state.townSim ?? {}).map(([id, town]) => [id, {layoutRevision: town.layoutRevision,
      ...(town.shops ? {shops: Object.fromEntries(Object.entries(town.shops).map(([plot, s]) => [plot,
        {keeperId: s.keeperId, sinceDay: s.sinceDay, ...(s.closedDay !== undefined ? {closedDay: s.closedDay} : {})}]))} : {}),
      villagers: Object.fromEntries(Object.entries(town.villagers).map(([key, v]) => [key,
      {occupantId: v.occupantId, householdMemberId: v.householdMemberId, name: v.name,
        homePlotId: v.homePlotId, bornDay: v.bornDay, diedDay: v.diedDay, role: v.role}]))}]),
  )), [state.townSim]);
  const townLifeDay = getGameDay(state.gameTime);
  // Only an admitted correction changes this identity. A first observation
  // still leaves the current scene intact around accepted walking feet.
  const buildingRepairSignature = Object.entries(state.townSim ?? {}).flatMap(([burg, town]) =>
    Object.entries(town.buildingSources ?? {}).filter(([, source]) => source.furnishingRepair || source.circulationRepair || source.householdRevision || Object.keys(source.exteriorPropRevisions ?? {}).length)
      .map(([plot, source]) => `${burg}:${plot}:${source.furnishingRepair?.recipe ?? ''}:${source.circulationRepair?.planSignature ?? ''}:${source.householdRevision?.planSignature ?? ''}:${Object.values(source.exteriorPropRevisions ?? {}).map(r => r.signature).join(',')}`)).sort().join('|');
  // Capture is an identical mounted foundation, not a reason to rebuild the
  // scene around accepted feet. The next normal entry reads this snapshot.
  const buildingSourcesRef = useRef<BuildingSourcesByBurg>({});
  buildingSourcesRef.current = Object.fromEntries(Object.entries(state.townSim ?? {})
    .filter(([, town]) => town.buildingSources && Object.keys(town.buildingSources).length)
    .map(([id, town]) => [id, town.buildingSources!]));

  // Tracks whether the player is currently exploring the walking-scale Ground Mode (true)
  // or flying above the global-scale Continent Mode (false).
  // Initialized from the URL parameters (?wf_legacy=1 starts in Continent Mode).
  // Toggling this value tears down the existing scene streamer and rebuilds it dynamically.
  const [isGroundMode, setIsGroundMode] = useState(() => wfParam('wf_legacy') !== '1');

  // The click-to-move Locale map is available in ground mode but no longer
  // occupies the scene by default. Controls owns its explicit visibility.
  const [isLocaleMapOpen, setIsLocaleMapOpen] = useState(false);
  // Reading uses the existing message stream, never a generated recap or save edit.
  const [isMessageLogOpen, setIsMessageLogOpen] = useState(false);
  const closeMessageLog = useCallback(() => setIsMessageLogOpen(false), []);

  // Bumped by the HUD "Town Cell" button to pull the 3D camera up to an overhead
  // framing of the spawn town (stays in the scene — see World3DScene.frameTownCellNonce).
  const [frameTownCellNonce, setFrameTownCellNonce] = useState(0);
  const [framePlayerNonce, setFramePlayerNonce] = useState(0);
  // A sampled view bearing belongs to this mounted HUD, never the save or body.
  const [cameraBearingDegrees, setCameraBearingDegrees] = useState<number | null>(null);

  // Worker-backed loader for PLAYING — keeps chunk mesh generation off the main thread.
  // Created and disposed inside ONE effect (the React-correct disposable-resource pattern): under
  // StrictMode's dev double-mount (setup → cleanup → setup) each setup builds a fresh loader+worker
  // and each cleanup disposes the very instance it built, so the committed tree always holds a LIVE
  // worker. The previous render-phase `useMemo` + out-of-band worker termination left the chunk
  // streamer bound to a worker that StrictMode had already terminated → it posted forever to a dead
  // worker and never loaded a chunk (the empty/flat 3D world). See createWorkerChunkLoader.
  const [loader, setLoader] = useState<DisposableChunkLoader | undefined>(undefined);
  // Staged 3D entry: which loading-stage label to show while the world assembles
  // off-thread (null once the scene can render), plus an honest error if the
  // worker failed. See WorldGenLoadingScreen + createWorldGenClient.
  const [worldGenStage, setWorldGenStage] = useState<WorldGenLoadingStage | null>(null);
  const [worldGenError, setWorldGenError] = useState<string | null>(null);
  // Bumped when Stage B patches props into the live ground, so the scene re-renders
  // the prop layer. Only the setter is used — any state change forces the re-read.
  const [groundNonce, setGroundNonce] = useState(0);
  // Set when WF_GROUND succeeds: walking-scale spawn + camera profile +
  // the resolved tile (the unit-scope for persisted ground positions).
  const [wfGroundView, setWfGroundView] = useState<{
    start: readonly [number, number, number];
    surfaceY: number;
    tile: { x: number; y: number };
    // The active Locale's extent in ground cells (cols×5 ft by rows×5 ft). Held
    // in render state (not just groundRef) so the 2D LocaleMovePane re-renders
    // when a ground session becomes active. Cell-native world, Stage 3.
    localeExtent: { cols: number; rows: number };
    activityPositions: Record<string,{xM:number;yM:number;zM:number}>;
  } | null>(null);

  // References to keep track of ground world details for combat transition and movement
  const groundRef = useRef<GroundWorld | null>(null);
  const avatarFootfall = useRef<{ pose: AvatarFootfall; ground: GroundWorld | null; at: number } | null>(null);
  const lastLayoutMovementAt = useRef(Infinity);
  const attemptedLayoutRevisions = useRef(new Set<string>());
  const [propLayer, setPropLayer] = useState<{ root: import('three').Group; ground: GroundWorld; origin: {x:number;z:number}; bodies: ReadonlyMap<string, import('./actorPersonalSpace').ActorBody> } | null>(null);
  const attemptedPropRevisions = useRef(new Set<string>());
  useEffect(() => {
    const actual = avatarFootfall.current;
    if (!actual || actual.ground !== groundRef.current || performance.now() - actual.at > 500
      || performance.now() - lastLayoutMovementAt.current < 1000 || clickMoveIntent.current || state.party.length !== 1
      || !state.playerGroundPos || state.playerGroundPos.yM === undefined
      || Math.hypot(actual.pose.xM - state.playerGroundPos.xM, actual.pose.zM - state.playerGroundPos.zM,
        actual.pose.yM - state.playerGroundPos.yM) > .001) return;
    for (const town of Object.values(state.townSim ?? {})) for (const source of Object.values(town.buildingSources ?? {})) {
      if (source.worldSeed !== state.worldSeed
        || source.position.tileX !== state.playerGroundPos?.tileX || source.position.tileY !== state.playerGroundPos?.tileY
        || !outsideLayoutRepairEnvelope(source.plan, source.site, actual.pose)) continue;
      if (!source.furnishingRepair && bedsideStorageMoves(source.plan).length) {
        dispatch({type: 'ADMIT_BUILDING_LAYOUT_REPAIR', payload: {burgId: source.burgId, plotId: source.plotId, sourceSignature: source.planSignature}});
        continue;
      }
      // Household revisions share the acknowledged outside-pose protocol. A
      // missing town revision waits for its owning source admission first.
      const household=!source.householdRevision&&source.plan.type==='cottage'&&(town.layoutRevision===1||town.layoutRevision===2);
      if (!household&&(source.circulationRepair || !guestCirculationRecipeFor(source.plan))) continue;
      const mounted = groundRef.current?.buildings.find(b => b.id === `wf-plot-${source.burgId}-${source.plotId}`);
      if (!mounted?.blueprintSignature) continue;
      const orientation = siteOrientationFromQuad(mounted.cornersM);
      if (Math.hypot(mounted.xM - source.site.xM, mounted.zM - source.site.zM) > 1e-5
        || Math.abs(groundSurfaceYM(groundRef.current!, mounted.xM, mounted.zM) - source.site.surfaceY) > 1e-5
        || orientation.rotationY !== source.site.rotationY || orientation.doorZSign !== source.site.doorZSign) continue;
      const key = `${household?'household':'guest'}:${source.worldSeed}:${source.burgId}:${source.plotId}:${mounted.blueprintSignature}`;
      if (attemptedLayoutRevisions.current.has(key)) continue;
      attemptedLayoutRevisions.current.add(key);
      dispatch({type: household?'ADMIT_HOUSEHOLD_LAYOUT_REVISION':'ADMIT_GUEST_CIRCULATION_REPAIR', payload: {burgId: source.burgId, plotId: source.plotId,
        sourceSignature: source.planSignature, mountedSignature: mounted.blueprintSignature}});
    }
  }, [state.townSim, state.worldSeed, state.playerGroundPos, state.gameTime, state.party.length, dispatch]);
  // This uses the same acknowledged stationary outside body as room repairs.
  // Geometry is read from the mounted layer; only a checked source receipt is
  // dispatched. No debug pose setter or live prop transform is involved.
  useEffect(() => {
    const actual=avatarFootfall.current, position=state.playerGroundPos, ground=groundRef.current;
    if(!propLayer||!ground||propLayer.ground!==ground||!actual||actual.ground!==ground
      ||performance.now()-actual.at>500||performance.now()-lastLayoutMovementAt.current<1000
      ||clickMoveIntent.current||state.party.length!==1||!position||position.yM===undefined
      ||Math.hypot(actual.pose.xM-position.xM,actual.pose.zM-position.zM,actual.pose.yM-position.yM)>.001)return;
    const body=propLayer.bodies.get('player'); if(!body||!(body.radiusM>=.1))return;
    const sources=buildingSourcesRef.current;
    for(const town of Object.values(state.townSim??{}))for(const source of Object.values(town.buildingSources??{})){
      if(source.worldSeed!==state.worldSeed||source.cellId!==state.playerCell?.cellId
        ||(town.layoutRevision!==1&&town.layoutRevision!==2)||!outsideLayoutRepairEnvelope(source.plan,source.site,actual.pose)
        ||Math.hypot(actual.pose.xM-source.site.xM,actual.pose.zM-source.site.zM)>20
        ||(source.plan.type==='cottage'&&!source.householdRevision)
        ||(guestCirculationRecipeFor(source.plan)&&!source.circulationRepair))continue;
      const building=ground.buildings.find(b=>b.id===`wf-plot-${source.burgId}-${source.plotId}`);
      if(!building?.blueprintSignature)continue;
      for(const original of ground.props.filter(p=>!p.retainedSourceId&&(p.defId==='woodpile'
        ||source.plan.type==='temple'&&['bush','boulder'].includes(p.defId)))){
        const key=`${source.worldSeed}:${source.burgId}:${source.plotId}:${building.blueprintSignature}:${propSourceId(original)}`;
        if(attemptedPropRevisions.current.has(key))continue;
        const dx=original.xM-source.site.xM,dz=original.zM-source.site.zM;
        if(Math.hypot(dx,dz)>Math.hypot(source.plan.widthFt,source.plan.depthFt)*.3048/2)continue;
        try{
          const measured=measureRenderedGroundProps(propLayer.root,propLayer.origin,ground.props,{xM:original.xM,zM:original.zM,radiusM:25});
          if(measured.issues.length)continue;
          if(original.defId!=='woodpile'){
            if(source.exteriorPropRevisions?.[propSourceId(original)]||!isInteriorWildPropCandidate(source,ground,original))continue;
            const bound=measured.bounds.find(row=>row.sourceId===propSourceId(original));if(!bound||bound.radiusM>3)continue;
            // Retire only after every represented body is clear. Source and
            // actual stationary outside-player checks remain in the reducer.
            if([...propLayer.bodies.values()].some(other=>other.yM<bound.maxYM&&other.yM+other.heightM>bound.minYM
              &&Math.hypot(other.xM-original.xM,other.zM-original.zM)<=bound.radiusM+other.radiusM+.25))continue;
            const receipt=freezeInteriorWildPropRetirement({source,ground,original,measured:bound,
              admittedAt:new Date(state.gameTime).toISOString(),position:{...position,yM:position.yM},bodyRadiusM:body.radiusM,
              characterSignature:propDataSignature(state.party[0]),predecessors:exteriorRevisionChain(ground,sources).map(r=>r.receipt.signature)});
            attemptedPropRevisions.current.add(key);
            dispatch({type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground}});return;
          }
          const ctx=exteriorRevisionContext(ground,original,measured.bounds);
          if(!exteriorPropClearanceIssues({x:original.xM,z:original.zM},ctx).includes(building.id))continue;
          attemptedPropRevisions.current.add(key);
          if(!original.surface)continue;
          const captured=captureRenderedGroundPropShape(propLayer.root,propLayer.origin,original,original.surface.groundYM-original.surface.sinkM);
          const probe=makeGroundWorldProbe(ground);if(!captured.shape||captured.issues.length||!probe)continue;
          const candidate=proposeExteriorPropRepair(original,ctx,{seatCandidate(p){
            const ownDistance=Math.hypot(p.xM-source.site.xM,p.zM-source.site.zM);
            if(ground.buildings.some(b=>b.id!==building.id&&Math.hypot(p.xM-b.xM,p.zM-b.zM)<ownDistance-1e-6))return;
            const gate=runPropPlacementGate([p],probe,{surface:'town',groundMutable:false,report:()=>{}});
            if(gate.result?.report.passedCount!==1||gate.result.report.failures.length)return;
            const seated=gate.props[0],base=seated.surface!.groundYM-seated.surface!.sinkM;
            if([...propLayer.bodies.values()].some(other=>other.yM<base+1.2&&other.yM+other.heightM>base
              &&Math.hypot(other.xM-seated.xM,other.zM-seated.zM)<=ctx.radiusM+other.radiusM+.25))return;
            return verifyRenderedPropSupport(seated,captured.shape!,probe).passed?seated:undefined;
          }});
          if(candidate.status!=='proposed')continue;
          const receipt=freezeExteriorPropRevision({source,ground,original,revised:candidate.proposed,captured:captured.shape,neighbours:measured.bounds,
            admittedAt:new Date(state.gameTime).toISOString(),position:{...position,yM:position.yM},bodyRadiusM:body.radiusM,
            characterSignature:propDataSignature(state.party[0]),predecessors:exteriorRevisionChain(ground,sources).map(r=>r.receipt.signature)});
          dispatch({type:'ADMIT_EXTERIOR_PROP_REVISION',payload:{receipt,ground}});return;
        }catch(error){console.warn('[building-prop-repair] candidate retained without admission',error);}
      }
    }
  },[propLayer,state.townSim,state.worldSeed,state.playerCell?.cellId,state.playerGroundPos,state.gameTime,state.party,dispatch]);
  const [furnishingInspection, setFurnishingInspection] = useState<{ visit: TownBuildingVisit; level: number; index: number; burgId: number; plotId: number; pick: FurnishingPick; ground: GroundWorld; worldSeed: number; historySignature: string; dedication?: TempleDedicationReading } | null>(null);
  const [dedicationPending, setDedicationPending] = useState(false);
  const dedicationReadPending = useRef(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [furnishingError, setFurnishingError] = useState<string | null>(null);
  const [residentInspection, setResidentInspection] = useState<{visit: TownBuildingVisit; spaceVisit: TownBuildingVisit; burgId: number; memberIndex: number; npcId: string; read: ReadResidentPick; ground: GroundWorld} | null>(null);
  const [cameraVisitCache, setCameraVisitCache] = useState<{
    nonce: number; ground: GroundWorld; visits: ReadonlyMap<string, TownBuildingVisit>;
    planSignature: string;
  } | null>(null);
  const cameraPlanInputs = useRef({worldSeed: state.worldSeed ?? 42, townSim: state.townSim});
  cameraPlanInputs.current = {worldSeed: state.worldSeed ?? 42, townSim: state.townSim};
  const openDoorSignature = useMemo(() => Object.entries(state.townSim ?? {}).flatMap(([burgId, town]) =>
    Object.entries(town.buildingDoors ?? {}).flatMap(([plotId, doors]) => Object.entries(doors)
      .filter(([, open]) => open).map(([doorId]) => `wf-plot-${burgId}-${plotId}/${doorId}`))).sort().join('\n'), [state.townSim]);
  // Keep the collision-cache key stable across clock ticks, until a door changes.
  const openDoors = useMemo(() => new Set(openDoorSignature.split('\n').filter(Boolean)), [openDoorSignature]);
  const doorActionPending = useRef(false);
  const [doorPending, setDoorPending] = useState<'opening' | 'closing' | null>(null);
  const [nearbyBuildingDoor, setNearbyBuildingDoor] = useState<NearbyBuildingDoorAction | null>(null);
  const [nearbyFurnishings, setNearbyFurnishings] = useState<NearbyFurnishingAction[]>([]);
  // Choice focus is presentation only. The original action still rechecks
  // current feet, source and room before opening the examination card.
  const [focusedFurnishingId, setFocusedFurnishingId] = useState<string | null>(null);
  const resolveNearbyFurnishingPlan = useCallback<ResolveFurnishingPlan>(async siteId => {
    const identity = /^wf-plot-(\d+)-(\d+)$/.exec(siteId);
    if (!identity) return null;
    const {townBuildingVisit} = await import('../Worldforge/townBuildingVisit');
    const burgId = Number(identity[1]), plotId = Number(identity[2]);
    return townBuildingVisit(state.worldSeed ?? 42, burgId, plotId,
      state.townSim?.[burgId]?.buildingEvents?.[plotId], state.townSim?.[burgId]?.buildingSources?.[plotId], state.townSim?.[burgId]?.layoutRevision).plan;
  }, [state.worldSeed, state.townSim]);
  const arrivedGroundPosRef = useRef<typeof state.playerGroundPos>(null);
  const lastAvatarProximityAt = useRef(-Infinity);
  const arrivedSavedPose = useRef<AvatarFootfall | null>(null);
  useEffect(() => {
    avatarFootfall.current = null;
    arrivedGroundPosRef.current = null;
    lastAvatarProximityAt.current = -Infinity;
    arrivedSavedPose.current = null;
    clickMoveIntent.current = null;
    // A structural revision invalidates old array indexes and room context;
    // clear transient cards/targets while preserving the accepted saved body.
    setFurnishingInspection(null);
    setFurnishingError(null);
    setResidentInspection(null);
  }, [state.worldSeed, wfGroundView?.tile.x, wfGroundView?.tile.y, buildingRepairSignature]);
  const handleSelectResident = useCallback(async (read: ReadResidentPick) => {
    const ground = groundRef.current, pick = read();
    const identity = pick && /^wf-plot-(\d+)-(\d+)$/.exec(pick.siteId);
    const source = ground?.buildings.find(building => building.id === pick?.siteId);
    if (!ground || !pick || !identity || !source || Math.hypot(source.xM - pick.transform.groupX, source.zM - pick.transform.groupZ) > .05) return;
    try {
      const { townBuildingVisit } = await import('../Worldforge/townBuildingVisit');
      if (groundRef.current !== ground) return;
      const burgId = Number(identity[1]), plotId = Number(identity[2]);
      const spaceVisit = townBuildingVisit(state.worldSeed ?? 42, burgId, plotId, state.townSim?.[burgId]?.buildingEvents?.[plotId], state.townSim?.[burgId]?.buildingSources?.[plotId], state.townSim?.[burgId]?.layoutRevision);
      // A priest at the public temple still belongs to their actual household.
      // Load that family only for an explicit current duty row; physical reach
      // continues to use the building and floor where the body really stands.
      const homePlotId = residentMemberIndex(spaceVisit, pick.memberId) < 0
        ? civicResidentHomePlot(burgId, plotId, pick.memberId, ground.rosters ?? []) : undefined;
      const visit = homePlotId === undefined ? spaceVisit
        : townBuildingVisit(state.worldSeed ?? 42, burgId, homePlotId, state.townSim?.[burgId]?.buildingEvents?.[homePlotId], state.townSim?.[burgId]?.buildingSources?.[homePlotId], state.townSim?.[burgId]?.layoutRevision);
      const currentPick = read();
      if (!currentPick || currentPick.memberId !== pick.memberId || currentPick.siteId !== pick.siteId) {
        setFurnishingError('This resident has moved. Meet them where they are now.');
        setResidentInspection(null); return;
      }
      const actual = avatarFootfall.current;
      const error = residentReachError(visit, currentPick, actual?.ground === ground && performance.now() - actual.at < 500 ? actual.pose : null, {ground, openDoors, spaceVisit});
      if (error) {setFurnishingError(error); setResidentInspection(null); return;}
      const memberIndex = residentMemberIndex(visit, pick.memberId);
      const member = visit.household?.members[memberIndex];
      if (member && !householdResidentAliveAt(state.townSim?.[burgId], pick.memberId, member.name, getGameDay(state.gameTime), visit.household!.members.filter(m => m.name === member.name).length === 1)) {
        setFurnishingError('This resident has died. Their history remains in the town chronicle.');
        setResidentInspection(null); return;
      }
      const worker = ground.rosters?.find(roster => roster.burgId === burgId)?.occupants.find(occupant => occupant.householdMemberId === pick.memberId);
      const npcId = residentNpcId(burgId, pick.memberId, worker?.workPlotId);
      const keeperIds = new Map((ground.rosters?.find(roster => roster.burgId === burgId)?.occupants ?? [])
        .filter(o => o.householdMemberId && o.workPlotId !== undefined)
        .map(o => [o.householdMemberId!, residentNpcId(burgId, o.householdMemberId!, o.workPlotId)]));
      // An established keeper or resident keeps all saved identity and memory.
      // New residents receive the canonical household, never a random family.
      if (!state.generatedNpcs?.[npcId]) dispatch({type: 'REGISTER_GENERATED_NPC', payload: {npc: createHouseholdResidentNpc(visit, memberIndex, npcId, state.worldSeed ?? 42, burgId, keeperIds, state.townSim?.[burgId], getGameDay(state.gameTime))}});
      setFurnishingError(null);
      setFurnishingInspection(null);
      setResidentInspection({visit, spaceVisit, burgId, memberIndex, npcId, read, ground});
    } catch (error) {setFurnishingError(error instanceof Error ? error.message : 'This resident is unavailable.');}
  }, [state.worldSeed, state.townSim, state.gameTime, state.generatedNpcs, openDoors, dispatch]);
  const handleTalkToResident = useCallback(() => {
    if (!residentInspection || residentInspection.ground !== groundRef.current) return;
    const actual = avatarFootfall.current;
    const error = residentReachError(residentInspection.visit, residentInspection.read(), actual?.ground === groundRef.current && performance.now() - actual.at < 500 ? actual.pose : null, {ground: residentInspection.ground, openDoors, spaceVisit: residentInspection.spaceVisit});
    if (error) {setFurnishingError(error); return;}
    if (!state.generatedNpcs?.[residentInspection.npcId]) return;
    const member = residentInspection.visit.household?.members[residentInspection.memberIndex];
    if (member && !householdResidentAliveAt(state.townSim?.[residentInspection.burgId],
      householdMemberIdentity(residentInspection.visit.household!, residentInspection.memberIndex), member.name, getGameDay(state.gameTime), residentInspection.visit.household!.members.filter(m => m.name === member.name).length === 1)) {
      setFurnishingError('This resident has died. Their history remains in the town chronicle.'); return;
    }
    if (!householdNpcAliveAt(state.generatedNpcs[residentInspection.npcId], state.townSim, getGameDay(state.gameTime))) {
      setFurnishingError('This resident’s current identity could not be verified.'); return;
    }
    onTalkToNpc?.(residentInspection.npcId);
    setResidentInspection(null);
  }, [residentInspection, state.generatedNpcs, state.townSim, state.gameTime, openDoors, onTalkToNpc]);
  const handleSelectFurnishing = useCallback(async (pick: FurnishingPick) => {
    const ground = groundRef.current;
    const identity = /^wf-plot-(\d+)-(\d+)$/.exec(pick.siteId);
    const source = ground?.buildings.find(building => building.id === pick.siteId);
    const target = pick.part.furnishing;
    if (!ground || !source || !identity || !target || Math.hypot(source.xM - pick.transform.groupX, source.zM - pick.transform.groupZ) > 0.05) {
      setFurnishingError('This furnishing is unavailable.');
      return;
    }
    try {
      // Resolve on demand through the same canonical, saved-history path as
      // Town Plan. The renderer supplies identity, never an inventory or loot.
      const { townBuildingVisit } = await import('../Worldforge/townBuildingVisit');
      if (groundRef.current !== ground) return;
      const burgId = Number(identity[1]), plotId = Number(identity[2]);
      const eventLog = state.townSim?.[burgId]?.buildingEvents?.[plotId];
      const visit = townBuildingVisit(state.worldSeed ?? 42, burgId, plotId, eventLog, state.townSim?.[burgId]?.buildingSources?.[plotId], state.townSim?.[burgId]?.layoutRevision);
      const actual = avatarFootfall.current;
      const pose = actual?.ground === ground && performance.now() - actual.at < 500 ? actual.pose : null;
      const error = furnishingReachError(visit.plan, pick, pose);
      if (error) { setFurnishingInspection(null); setFurnishingError(error); return; }
      // Retain the exact physically reached source before future layout work.
      // An older worker without a signature remains inspectable but cannot
      // claim that a fresh reconstruction is the building it actually drew.
      if (source.blueprintSignature && state.playerGroundPos && state.playerCell
        && !state.townSim?.[burgId]?.buildingSources?.[plotId]) {
        const {captureObservedBuildingSource} = await import('../../systems/worldforge/interior/buildingSource');
        if (groundRef.current !== ground) return;
        const retained = captureObservedBuildingSource({
          worldSeed: state.worldSeed ?? 42, burgId, plotId, cellId: state.playerCell.cellId,
          observedAt: state.gameTime.toISOString(), position: {...state.playerGroundPos, ...pose!},
          site: {xM: source.xM, zM: source.zM, surfaceY: pick.transform.surfaceY,
            rotationY: pick.transform.rotationY, doorZSign: pick.transform.doorZSign},
          historySignature: JSON.stringify(eventLog ?? null), plan: visit.plan,
          household: visit.household, workplaceOnly: visit.workplaceOnly, manifests: visit.manifests,
        }, source.blueprintSignature);
        dispatch({type: 'RETAIN_OBSERVED_BUILDING_SOURCE', payload: retained});
      }
      setFurnishingError(null);
      setResidentInspection(null);
      setFurnishingInspection({ visit, level: target.level, index: target.index, burgId, plotId, pick, ground,
        worldSeed: state.worldSeed ?? 42, historySignature: JSON.stringify(state.townSim?.[burgId]?.buildingEvents?.[plotId] ?? null) });
    } catch (error) {
      setFurnishingError(error instanceof Error ? error.message : 'This furnishing is unavailable.');
    }
  }, [state.worldSeed, state.townSim, state.playerGroundPos, state.playerCell, state.gameTime, dispatch]);
  const handleUseGuestBed = useCallback(() => {
    const inspection = furnishingInspection;
    if (!inspection || inspection.ground !== groundRef.current) return;
    const actual = avatarFootfall.current;
    const pose = actual?.ground === groundRef.current && performance.now() - actual.at < 500 ? actual.pose : null;
    const reachError = furnishingReachError(inspection.visit.plan, inspection.pick, pose);
    if (reachError || !pose || !state.playerGroundPos) {setFurnishingError(reachError ?? 'Wait until your character arrives.'); return;}
    const stay = activeLodgingReservation(state, 'biz_burg_' + inspection.burgId + '_plot_' + inspection.plotId);
    const piece = inspection.visit.plan.floors.find(f => f.level === inspection.level)?.furnishings[inspection.index];
    if (!stay || piece?.kind !== 'bed') {setFurnishingError('Ask the innkeeper to reserve a guest bed before sleeping here.'); return;}
    const admission = {reservationId: stay.id, bed: {level: inspection.level, index: inspection.index, roomId: piece.roomId},
      position: {...state.playerGroundPos, ...pose}};
    const error = lodgingRestError({...state, playerGroundPos: admission.position}, admission);
    if (error) {setFurnishingError(error); return;}
    // The reached body, not a camera target, supplies the rest anchor. Stop any
    // remaining walk intent before opening the normal recovery confirmation.
    clickMoveIntent.current = null;
    dispatch({type: 'SET_PLAYER_GROUND_POS', payload: {position: admission.position}});
    dispatch({type: 'OPEN_LODGING_REST', payload: admission});
    setFurnishingInspection(null);
  }, [furnishingInspection, state, dispatch]);
  const handleSelectDoor = useCallback(async (pick: FurnishingPick) => {
    if (doorActionPending.current) return;
    const ground = groundRef.current, identity = /^wf-plot-(\d+)-(\d+)$/.exec(pick.siteId);
    const source = ground?.buildings.find(b => b.id === pick.siteId);
    const canonical = source?.parts.find(p => p.door?.id === pick.part.door?.id);
    if (!ground || !identity || !canonical?.door || Math.hypot(source!.xM - pick.transform.groupX, source!.zM - pick.transform.groupZ) > 0.05
      || (['x', 'z', 'w', 'd', 'h'] as const).some(key => canonical[key] !== pick.part[key])) {
      setFurnishingError('This door is unavailable.'); return;
    }
    const open = openDoors.has(siteDoorKey(pick.siteId, canonical));
    doorActionPending.current = true;
    setDoorPending(open ? 'closing' : 'opening');
    setFurnishingError(null);
    try {
      const { townBuildingVisit } = await import('../Worldforge/townBuildingVisit');
      if (groundRef.current !== ground) return;
      const burgId = Number(identity[1]), plotId = Number(identity[2]);
      const visit = townBuildingVisit(state.worldSeed ?? 42, burgId, plotId, state.townSim?.[burgId]?.buildingEvents?.[plotId], state.townSim?.[burgId]?.buildingSources?.[plotId], state.townSim?.[burgId]?.layoutRevision);
      const actual = avatarFootfall.current;
      const pose = actual?.ground === ground && performance.now() - actual.at < 500 ? actual.pose : null;
      const bodies=pick.readDoorBodies?.();
      if(visit.plan.doorLeafProfile&&!bodies?.has('player')){setFurnishingError('Wait until the doorway is ready before operating this door.');return;}
      const error = doorInteractionError(visit.plan, { ...pick, part: canonical }, pose, open,
        lodgingRoomDoorAccess(state,visit,'biz_burg_'+burgId+'_plot_'+plotId),bodies);
      if (error) { setFurnishingError(error); return; }
      setFurnishingInspection(null); setFurnishingError(null);
      dispatch({ type: 'SET_TOWN_BUILDING_DOOR', payload: { burgId, plotId, doorId: canonical.door.id, open: !open } });
    } catch { setFurnishingError('This door is unavailable. Try again after the building refreshes.'); }
    finally { doorActionPending.current = false; setDoorPending(null); }
  }, [state.worldSeed, state.townSim, openDoors, dispatch]);
  const extractPatchRef = useRef<typeof import('../../systems/worldforge/bridge/groundChunkLoader').extractLocalTerrainPatch | null>(null);
  const groundOccupantsAtRef = useRef<typeof import('../../systems/worldforge/bridge/groundAgentMotion').allGroundAgentsAt | null>(null);
  const combatTriggered = useRef(false);
  const partyArrivalPlan = useRef<{ worldSeed: number; locationId: string; cellId: number; leader: { x: number; z: number };
    arrivals: Array<{ companionId: string; journeyId: string; position: CompanionPosition }> } | null>(null);

  // Latest ground meters the player stands on for combat handoffs and dungeon return
  const lastGroundXZ = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Retain the requested click route for transition/cancellation bookkeeping.
  // Camera reports do not write movement state; actual footfalls separately own
  // proximity. A collision or dungeon return clears the requested route.
  const clickMoveIntent = useRef<ClickMoveIntent>(null);
  // Requested routes are transient. Only rendered, supported body arrivals
  // belong in save state, including a save while a stair walk is unfinished.
  const [, wakeMovement] = useState(0);
  useEffect(() => {
    const position = state.playerGroundPos, issued = arrivedSavedPose.current, tile = wfGroundView?.tile;
    // Existing transition/combat callers can still request a discrete move
    // through the reducer. Preserve that request as a route before subsequent
    // body-owned save updates replace it; our own arrival writes match issued.
    if (position && issued && tile && position.tileX === tile.x && position.tileY === tile.y
      && Math.hypot(position.xM - issued.xM, position.zM - issued.zM) > .001) {
      clickMoveIntent.current = { ...position };
      wakeMovement(value => value + 1);
    }
  }, [state.playerGroundPos, wfGroundView?.tile]);

  // ========================================================================
  // Domain Sub-Hooks Integration
  // ========================================================================

  // 1. Proximity discovery sub-hook: detects hidden locations & dungeon entrances
  const { checkProximityDiscoveries } = useWorld3DDiscovery({
    groundRef,
    atlasGroundDrilldown,
  });

  // 2. Interior & dungeon transition sub-hook: manages dungeon entrance prompts & overlay
  const {
    nearbyDungeonEntrance,
    activeDungeonEntry,
    dungeonEntryError,
    refreshNearbyDungeonEntrance,
    handleEnterDungeon,
    handleReturnFromDungeon,
  } = useInteriorTransition({
    groundRef,
    wfGroundView,
    playerGroundPosRef: arrivedGroundPosRef,
    lastGroundXZ,
    clickMoveIntent,
  });

  // 3. In-place combat transition sub-hook: handles state patrol, hostiles, and provider handoffs
  const { checkCombatTriggers } = useInPlaceCombatTransition({
    groundRef,
    extractPatchRef,
    groundOccupantsAtRef,
    lastGroundXZ,
    wfGroundView,
    loader,
    combatTriggered,
  });

  useEffect(() => {
    let cancelled = false;
    let activeCleanup: (() => void) | null = null;
    let client: DisposableWorldGenClient | null = null;

    // Grid retirement: the legacy continent streamer (createWorkerChunkLoader over
    // the 30x20 mapData heightfield) is gone. Continent Mode (?wf_legacy=1) now
    // renders nothing — the streamed cell-native ground below is the only world.
    if (!isGroundMode) {
      setWfGroundView(null);
      setLoader(undefined);
      setWorldGenStage(null);
      setWorldGenError(null);
      return () => {
        cancelled = true;
      };
    }

    // Worldforge ground entry (the DEFAULT): build the village/terrain
    // loader at the clicked/party tile — gameTime drives occupant hours,
    // saved worldforge deltas replay into the town. The bridge modules are
    // dynamically imported (they pull the whole FMG stack). No-fallback
    // directive (2026-06-15): a failure here surfaces honestly instead of
    // silently substituting the legacy continent streamer — one real path.
    (async () => {
      try {
        // Only the light main-thread bits load here (entry-cell resolution, the
        // shop/NPC registration helpers, the combat-patch extractor). The heavy
        // world assembly runs in the world-gen worker (createWorldGenClient), so
        // this dynamic import keeps the FMG stack off PLAYING's initial chunk.
        const [bridge, loaderMod, adapter, clientMod, groundLoaderMod, agentMotionMod] = await Promise.all([
          import('../../systems/worldforge/bridge/legacySubmapBridge'),
          import('../../systems/worldforge/bridge/groundChunkLoader'),
          import('../../systems/worldforge/bridge/groundWorldAdapter'),
          import('./createWorldGenClient'),
          import('./createGroundWorkerChunkLoader'),
          import('../../systems/worldforge/bridge/groundAgentMotion'),
        ]);
        if (cancelled) return;

        // Atlas receipt authority wins over URL and reducer hints. Classic map
        // entry keeps the established cell-addressed resolution unchanged.
        const wfSeed = atlasGroundDrilldown?.worldSeed ?? WF_SEED ?? state.worldSeed;
        // Grid retirement (2026-07-01): 3D entry is fully cell-native. The entry
        // CELL is the anchor's cell (map click / start-selection / travel carry an
        // Entry3DAnchor) or — for a toggle-to-3D from gameplay with no anchor — the
        // player's canonical cell. A settlement's centerPx only frames the town;
        // resolving that coordinate back through Voronoi geometry could redirect
        // the worker to a neighbour and contradict the saved/2D player cell.
        const anchor = state.entry3DAnchor;
        const entryCellId =
          atlasGroundDrilldown?.atlasCellId ??
          resolveGroundEntryCellId(anchor, state.playerCell);
        // The ground session's tile identity is the entry cell (opaque {x: cellId,
        // y: 0}) — cell-native, no grid coord. Feeds wfGroundView.tile + the
        // ground-position save/restore below.
        const coords = entryCellId != null ? { x: entryCellId, y: 0 } : null;
        if (!(coords && wfSeed != null && entryCellId != null)) return;

        // Game clock is an in-world UTC Date; read UTC hours so the initial
        // lighting hour matches the HUD clock (never host-machine getHours()).
        const hour =
          state.gameTime instanceof Date ? state.gameTime.getUTCHours() : 12;
        const deltas =
          (state as { worldforgeDeltas?: WorldDelta[] }).worldforgeDeltas ?? [];

        // Register shops and reconcile household identity through the same path
        // as 2D arrival. Existing stock, IDs and meeting memory remain intact.
        // Deferred to idle after Stage A so it does not block the first paint.
        const registerTownContent = (region: RegionArtifact | undefined) => {
          for (const t of region?.townSites ?? []) {
            // 2D arrival and 3D entry share one town-seeded identity resolver.
            // Reconciliation preserves plot ids, stock and the memory store.
            const {npcs, businesses} = computeBurgMerchants(wfSeed, t.burgId, getGameDay(state.gameTime), state.generatedNpcs, state.worldBusinesses, state.townSim?.[t.burgId]);
            for (const npc of npcs) dispatch({type: 'REGISTER_GENERATED_NPC', payload: {npc}});
            for (const business of businesses) dispatch({type: 'REGISTER_WORLD_BUSINESS', payload: {business}});
          }
        };

        const buildingEventLogs = JSON.parse(buildingEventLogJson) as BuildingEventLogsByBurg;
        const townLife = JSON.parse(townLifeJson) as TownLifeRegistry;
        const buildingSources = buildingSourcesRef.current;

        // Native Atlas entry is the canonical exact-artifact path. Assemble
        // GroundWorld directly from the retained Local and Region, then hand
        // it to PLAYING's avatar, NPC, HUD, movement, and combat systems.
        if (atlasGroundDrilldown) {
          setWorldGenError(null);
          setWorldGenStage('land');
          const exactSession = createAtlasReceiptGroundSession(
            atlasGroundDrilldown,
            loaderMod.createGroundChunkLoader,
            {
              hour,
              deltas,
              // The saved business owns its name and stock. Without this
              // registry the same inn can acquire a fresh fallback sign in 3D.
              worldBusinesses: state.worldBusinesses,
              buildingEventLogs,
              buildingSources,
              townLife,
              day: townLifeDay,
              anchorCellId: entryCellId,
            },
          );
          if (cancelled) return;

          const ground = exactSession.ground;
          // Replay only source actors from this exact Local before meshing it.
          if (ground.hostiles) ground.hostiles = projectSurfaceHostileOutcomes(ground.hostiles, state.worldforgeEncounterReceipts ?? [], wfSeed,
            entryCellId ?? coords.x, surfaceHostileSourceScope({...state, atlasGroundAddress: atlasGroundAddressFromDrilldown(atlasGroundDrilldown)}, entryCellId ?? coords.x));
          groundRef.current = ground;
          rememberRestGround({...state, atlasGroundAddress: atlasGroundAddressFromDrilldown(atlasGroundDrilldown)}, ground);
          extractPatchRef.current = loaderMod.extractLocalTerrainPatch;
          groundOccupantsAtRef.current = agentMotionMod.allGroundAgentsAt;
          combatTriggered.current = false;

          // Developer probes can distinguish the player-facing retained-artifact
          // route from the explicit URL reconstruction harness.
          (window as unknown as { __wfEntry?: unknown }).__wfEntry = {
            anchor: anchor ?? null,
            usedCellEntry: true,
            source: 'atlas-receipt',
            localSeedPath: atlasGroundDrilldown.localSeedPath,
            groundTownBurgs: (ground.towns ?? []).map((town) => town.burgId),
          };

          // Initial descent uses the selected focus. Combat return remains exact
          // by preferring saved meters when they belong to this same Atlas cell.
          const address = atlasGroundAddressFromDrilldown(atlasGroundDrilldown);
          const canonicalSpawn = atlasGroundSpawnForAddress(
            address,
            state.atlasGroundPosition,
            [exactSession.start[0], exactSession.start[2]],
          );
          const spawn = { x: canonicalSpawn.xM, z: canonicalSpawn.zM };
          const activities=resolveCompanionActivityPlacements(ground,state);
          lastGroundXZ.current = spawn;
          setWfGroundView({
            start: [spawn.x, 0, spawn.z],
            activityPositions:activities.positions,
            surfaceY:
              spawn.x === exactSession.start[0] && spawn.z === exactSession.start[2]
                ? exactSession.surfaceY
                : groundSurfaceYM(ground, spawn.x, spawn.z),
            tile: { x: coords.x, y: coords.y },
            localeExtent: { cols: ground.cols, rows: ground.rows },
          });

          // PLAYING keeps chunk meshing off the main thread even though Atlas
          // already authored the retained Local artifact on the main thread.
          const disposable = groundLoaderMod.createGroundWorkerChunkLoader(ground);
          setLoader(() => disposable);
          setWorldGenStage(null);

          // Town registration uses the same retained Region that produced the
          // rendered ground, preserving dialogue and business interactions.
          const requestIdle = (window as unknown as {
            requestIdleCallback?: (callback: () => void) => number;
          }).requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 0));
          requestIdle(() => {
            if (!cancelled) registerTownContent(atlasGroundDrilldown.region);
          });

          // Teardown matches the established generated-ground path so combat
          // return and continent compatibility state retain their behavior.
          const exitTile = { x: coords.x, y: coords.y };
          activeCleanup = () => {
            disposable.dispose();
            setLoader(undefined);
            groundRef.current = null;
            extractPatchRef.current = null;
            groundOccupantsAtRef.current = null;
            if (!combatTriggered.current) {
              setPosition({
                x: (exitTile.x + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
                y: 0,
                z: (exitTile.y + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
              });
            }
            combatTriggered.current = false;
          };
          return;
        }

        // Off-thread staged assembly. The loading screen animates while the worker
        // builds terrain + town (Stage A), then props (Stage B). No-fallback: a
        // worker failure surfaces plainly instead of a silent legacy substitute.
        setWorldGenError(null);
        setWorldGenStage('land');
        client = clientMod.createWorldGenClient();
        client.generate(
          {
            wfSeed,
            terrainRevision: state.worldforgeTerrainRevision,
            entryCellId,
            centerPx: anchor?.centerPx,
            hour,
            deltas,
            // Saved-entry towns need the same owned signs and stock as Atlas
            // entry. The worker consumes this snapshot without restocking it.
            worldBusinesses: state.worldBusinesses,
            ...(Object.keys(buildingEventLogs).length ? { buildingEventLogs } : {}),
            buildingSources,
            townLife,
            day: townLifeDay,
          },
          {
            onProgress: (stage) => {
              if (!cancelled && stage === 'town') setWorldGenStage('town');
            },
            onError: (message) => {
              if (!cancelled) setWorldGenError(message);
            },
            // GG-573: the world-gen worker also sends the Stage A ground to the
            // chunk-mesh worker, so this thread does not clone it a second time.
            handOffGround: true,
            onStageA: ({ ground, region, meshGroundPort }) => {
              if (cancelled) { meshGroundPort?.close(); return; }
              // Store refs so position changes and combat handoffs can read
              // the live world and extraction helpers.
              if (ground.hostiles) ground.hostiles = projectSurfaceHostileOutcomes(ground.hostiles, state.worldforgeEncounterReceipts ?? [], wfSeed,
                entryCellId ?? coords.x, surfaceHostileSourceScope(state, entryCellId ?? coords.x));
              groundRef.current = ground;
              rememberRestGround(state, ground);
              extractPatchRef.current = loaderMod.extractLocalTerrainPatch;
              groundOccupantsAtRef.current = agentMotionMod.allGroundAgentsAt;
              combatTriggered.current = false;
              // Dev hook: resolved entry anchor + rendered town burg ids for probes.
              (window as unknown as { __wfEntry?: unknown }).__wfEntry = {
                anchor: anchor ?? null,
                usedCellEntry: !!anchor,
                groundTownBurgs: (ground.towns ?? []).map((t) => t.burgId),
              };

              // Spawn at the SAVED ground position when it belongs to this tile
              // (WF-STORE-2 contract item 3); else the inherited burg / artifact center.
              const saved = (state as { playerGroundPos?: { tileX: number; tileY: number; xM: number; zM: number } | null }).playerGroundPos;
              const burgSpawn = ground.towns && ground.towns.length > 0
                ? { x: ground.towns[0].xM, z: ground.towns[0].zM }
                : { x: ground.extentMetersX / 2, z: ground.extentMetersZ / 2 };
              const retainedEntry = saved && saved.tileX === coords.x && saved.tileY === coords.y;
              const activities=resolveCompanionActivityPlacements(ground,state);
              const activityProbe=window as unknown as {__wfEntry?:Record<string,unknown>};
              activityProbe.__wfEntry={...activityProbe.__wfEntry,companionActivities:activities};
              let spawn = retainedEntry ? {x:saved.xM,z:saved.zM} : burgSpawn;
              // A town center is an address, not a free standing place. Before
              // a NEW entry is committed, fit the actual initial group onto the
              // town's public streets/plazas. Saved feet and named NPC anchors
              // bypass this choice entirely; this is never a compatibility move.
              if (!retainedEntry && ground.towns?.length && state.party[0]) {
                try {
                  const player=state.party[0];
                  const cast=(state.currentLocationActiveDynamicNpcIds??[]).slice(0,4)
                    .filter(id=>!state.companions[id]?.publicActivity&&!state.companions[id]?.inParty&&!state.party.some(p=>p.id===id))
                    .map(id=>state.generatedNpcs[id]?{id,name:state.generatedNpcs[id].name,recipe:recipeFromRichNpc(state.generatedNpcs[id],state.companions[id]?.identity.race)}:null)
                    .filter((person):person is NonNullable<typeof person>=>person!==null);
                  const people=[{id:player.id,offset:{x:0,z:0},recipe:recipeFromCharacter(player),isPlayer:true},
                    ...layoutCast(cast).filter(person=>!state.companions[person.id]?.whereabouts?.position)
                      .map(person=>({id:person.id,offset:{x:person.pos[0],z:person.pos[2]},recipe:person.recipe!}))];
                  const bodies=measureEntryActors(people);
                  const entry=selectInitialPublicTownEntry(ground,burgSpawn,bodies,activities.occupied);
                  if(!entry){setWorldGenError('No clear public arrival fits this group in the selected town. The entry has not been placed.');return;}
                  spawn={x:entry.x,z:entry.z};
                  const probe=window as unknown as {__wfEntry?:Record<string,unknown>};
                  probe.__wfEntry={...probe.__wfEntry,initialPublicEntry:{...entry,bodies}};
                } catch(error) {
                  setWorldGenError('Town arrival could not be checked: '+(error instanceof Error?error.message:String(error)));return;
                }
              }
              // Seed the combat anchor immediately. A player can click a staged
              // watch NPC before the camera emits its first movement callback;
              // without this assignment that fast interaction cut a patch at
              // ground coordinate 0,0 instead of the visible spawn location.
              const partyArrival = qualifyPartyJourneyArrival(ground, state, spawn, activities.occupied);
              if (partyArrival.error) { setWorldGenError(partyArrival.error); return; }
              partyArrivalPlan.current = partyArrival.arrivals.length ? { worldSeed: state.worldSeed!, locationId: state.currentLocationId,
                cellId: entryCellId, leader: spawn, arrivals: partyArrival.arrivals } : null;
              lastGroundXZ.current = spawn;
              setWfGroundView({
                start: [spawn.x, 0, spawn.z],
                activityPositions:activities.positions,
                surfaceY: groundSurfaceYM(ground, spawn.x, spawn.z),
                tile: { x: coords.x, y: coords.y },
                localeExtent: { cols: ground.cols, rows: ground.rows },
              });
              // Mesh ground chunks OFF the main thread so walking stays smooth.
              // The worker is init'd with the Stage A ground (props empty) — meshing
              // never reads props, so Stage B never re-inits it. Self-healing loader
              // (survives StrictMode double-mount); disposed in cleanup below.
              // GG-573: its first worker reads the ground from meshGroundPort.
              const disposable = groundLoaderMod.createGroundWorkerChunkLoader(ground, undefined, undefined, { groundPort: meshGroundPort });
              setLoader(() => disposable);
              // Terrain + town are up — the loading screen gives way to the scene.
              setWorldGenStage(null);

              // Wire shops/NPCs in idle time so registration never blocks the paint.
              const ric = (window as unknown as {
                requestIdleCallback?: (cb: () => void) => number;
              }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 0));
              ric(() => { if (!cancelled) registerTownContent(region); });

              const exitTile = { x: coords.x, y: coords.y };
              activeCleanup = () => {
                disposable.dispose(); // terminate the ground mesh worker
                setLoader(undefined);
                groundRef.current = null;
                extractPatchRef.current = null;
                groundOccupantsAtRef.current = null;
                // HOSTILE-1: entering combat keeps the saved playerGroundPos as the
                // return point, so skip the continent position override.
                if (!combatTriggered.current) {
                  setPosition({
                    x: (exitTile.x + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
                    y: 0,
                    z: (exitTile.y + 0.5) * WORLD3D_CONFIG.METERS_PER_CELL,
                  });
                }
                combatTriggered.current = false;
              };
            },
            onStageB: (ground) => {
              if (cancelled) return;
              // Props are patched into `ground`; swap to a fresh identity + bump a
              // nonce so World3DScene re-renders the prop layer over the live world.
              if (ground.hostiles) ground.hostiles = projectSurfaceHostileOutcomes(ground.hostiles, state.worldforgeEncounterReceipts ?? [], wfSeed,
                entryCellId ?? coords.x, surfaceHostileSourceScope(state, entryCellId ?? coords.x));
              groundRef.current = { ...ground };
              setGroundNonce((n) => n + 1);
            },
          },
        );
      } catch (err) {
        // No-fallback directive: surface the failure plainly, never a silent
        // legacy substitute.
        setWorldGenError(
          `village entry failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    })();

    return () => {
      cancelled = true;
      client?.dispose();
      activeCleanup?.();
    };
    // Re-run the effect if the location, seed, or active mode scale changes.
    // HOSTILE-1: also re-run on game phase change so the ground world rebuilds
    // after a return-from-combat (BATTLE_MAP_DEMO → PLAYING transition).
    // The clock and saved walking coordinates are entry snapshots, not world
    // identities. Restarting for each clock tick or step terminates the worker
    // before a town can load. Live lighting/schedules still receive state.gameTime
    // below; a different cell, anchor, or retained artifact starts a new session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.currentLocationId,
    state.worldSeed,
    state.worldforgeTerrainRevision,
    isGroundMode,
    state.phase,
    state.entry3DAnchor,
    buildingEventLogJson,
    buildingRepairSignature,
    townLifeJson,
    townLifeDay,
    atlasGroundDrilldown,
    setPosition,
    state.playerCell?.cellId,
  ]);

  // FPS is NOT counted here any more (2026-09-29). This spot ran a second
  // requestAnimationFrame loop and re-rendered the whole wrapper once a
  // second, in every build, only to feed the dev-mode Debug HUD. The HUD now
  // reads the shared 'world3d' performance session that World3DScene's
  // PerfProbe feeds (src/devtools/perf), so the game shows the same number as
  // the Alt+P panel and pays for no second loop.

  // Streamer stats tracking (basic: count loaded chunks via scene re-renders).
  const [chunkCount, setChunkCount] = useState(0);
  const [streamerStats, setStreamerStats] = useState({
    chunksLoaded: 0,
    chunksUnloaded: 0,
    pendingRequests: 0,
  });

  // Use a ref to track previous chunk count for detecting changes.
  const prevChunkCount = useRef(0);

  // Callback to update chunk stats (called by scene when chunks change).
  const handleChunkUpdate = useCallback((loaded: number) => {
    setChunkCount(loaded);
    const delta = loaded - prevChunkCount.current;
    if (delta > 0) {
      setStreamerStats((prev) => ({
        ...prev,
        chunksLoaded: prev.chunksLoaded + delta,
      }));
    } else if (delta < 0) {
      setStreamerStats((prev) => ({
        ...prev,
        chunksUnloaded: prev.chunksUnloaded + Math.abs(delta),
      }));
    }
    prevChunkCount.current = loaded;
  }, []);

  // Throttle state for position dispatches.
  const lastDispatchTime = useRef(0);
  const lastDispatchedPos = useRef<{ x: number; z: number }>({ x: NaN, z: NaN });

  /**
   * Called on high-frequency movement ticks while exploring the 3D ground world.
   * Coordinates proximity checks for doorway prompts, hidden locations, and hostile battles.
   */
  const handleGroundPositionChange = useCallback(
    (_cameraX: number, _cameraZ: number) => {
      const tile = wfGroundView?.tile;
      if (!tile || activeDungeonEntry) return;

      // Camera panning and requested destinations never discover sites, open
      // entrances, or start fights. The current rendered body owns proximity.
      const actual = avatarFootfall.current;
      if (!actual || actual.ground !== groundRef.current || performance.now() - actual.at > 500) return;
      const playerX = actual.pose.xM, playerZ = actual.pose.zM;
      lastGroundXZ.current = { x: playerX, z: playerZ };

      // 1. Refresh doorway prompt
      refreshNearbyDungeonEntrance(playerX, playerZ);

      // 2. SP4 / Pillar 2 location & dungeon discoveries
      // Public visits require this same fresh body on its actual floor, not
      // a camera target or a saved/requested height from another ground world.
      checkProximityDiscoveries(playerX, playerZ, playerX, playerZ, actual.pose.yM);

      // 3. State patrol & hostile creature proximity combat triggers
      checkCombatTriggers(playerX, playerZ, tile);
    },
    [
      wfGroundView?.tile,
      activeDungeonEntry,
      refreshNearbyDungeonEntrance,
      checkProximityDiscoveries,
      checkCombatTriggers,
    ],
  );

  const handleAvatarPositionChange = useCallback((pose: AvatarFootfall) => {
    if (![pose.xM, pose.zM, pose.yM].every(Number.isFinite)) return;
    const now = performance.now();
    const previousFootfall = avatarFootfall.current;
    if (!previousFootfall || previousFootfall.ground !== groundRef.current || Math.hypot(
      previousFootfall.pose.xM - pose.xM, previousFootfall.pose.zM - pose.zM, previousFootfall.pose.yM - pose.yM) > .001) lastLayoutMovementAt.current = now;
    avatarFootfall.current = { pose, ground: groundRef.current, at: now };
    const tile = wfGroundView?.tile;
    if (tile) arrivedGroundPosRef.current = { tileX: tile.x, tileY: tile.y, ...pose };
    // The route receipt and ground admission choose a NEW group arrival. Only
    // the actual leader's first reached footfall commits it to saved state.
    const arrival = partyArrivalPlan.current;
    if (arrival && tile?.x === arrival.cellId && Math.hypot(pose.xM - arrival.leader.x, pose.zM - arrival.leader.z) < .05) {
      partyArrivalPlan.current = null;
      dispatch({ type: 'SET_PLAYER_GROUND_POS', payload: { position: { tileX: tile.x, tileY: tile.y, ...pose } } });
      dispatch({ type: 'RECORD_COMPANION_ARRIVALS', payload: { worldSeed: arrival.worldSeed, locationId: arrival.locationId, arrivals: arrival.arrivals } });
    }
    // A click walk can leave the camera stationary. Report from the body at
    // ten hertz as well, so arrival does not depend on panning the camera.
    if (now - lastAvatarProximityAt.current >= 100) {
      lastAvatarProximityAt.current = now;
      if (tile) {
        const previous = arrivedSavedPose.current;
        if (!previous || Math.hypot(previous.xM - pose.xM, previous.zM - pose.zM, previous.yM - pose.yM) > .001) {
          arrivedSavedPose.current = pose;
          dispatch({ type: 'SET_PLAYER_GROUND_POS', payload: { position: { tileX: tile.x, tileY: tile.y, ...pose } } });
        }
        const intent = clickMoveIntent.current;
        if (intent && Math.hypot(intent.xM - pose.xM, intent.zM - pose.zM) < .02) clickMoveIntent.current = null;
      }
      handleGroundPositionChange(pose.xM, pose.zM);
    }
  }, [wfGroundView?.tile, handleGroundPositionChange, dispatch]);

  const partyCompanions = useMemo(() => partyCompanionPresence(state), [state.party, state.companions, state.generatedNpcs, state.worldSeed, state.currentLocationId, state.playerGroundPos]);
  // Freeze accepted party feet and the exact candidate sites only when the HUD
  // issues To Player. Follower steps may update partyCompanions, but cannot
  // restart room lookup or camera framing for this one-shot request.
  const cameraFrameRequestSnapshot = useMemo(() => {
    const ground = groundRef.current, live = avatarFootfall.current;
    if (!framePlayerNonce || !wfGroundView || !ground) return null;
    const player = live?.ground === ground ? {...live.pose}
      : state.playerGroundPos ? {xM:state.playerGroundPos.xM,zM:state.playerGroundPos.zM,yM:state.playerGroundPos.yM ?? wfGroundView.surfaceY} : null;
    const companions = partyCompanions.map(member => ({id:member.character.id,position:{...member.position}}));
    const playerSite = player ? residentSiteAt(ground, player) : null;
    // Only the leader's current plot can admit party framing. A companion in a
    // different site is already excluded by its exact footprint identity.
    return {nonce:framePlayerNonce,ground,player,companions,siteIds:playerSite?[playerSite.id]:[]};
    // This is a deliberate point-in-time capture. The next explicit camera
    // request reads newer accepted feet; follower animation does not move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framePlayerNonce]);
  const cameraPlanSignature = useMemo(() => {
    const request = cameraFrameRequestSnapshot;
    if (!request) return null;
    return JSON.stringify([groundNonce, state.worldSeed ?? 42, request.ground.artifactSeedPath,
      request.siteIds.map(id => {
        const identity = /^wf-plot-(\d+)-(\d+)$/.exec(id);
        if (!identity) return [id];
        const town = state.townSim?.[Number(identity[1])], plotId = Number(identity[2]);
        return [id, town?.layoutRevision ?? null, town?.buildingEvents?.[plotId] ?? null,
          town?.buildingSources?.[plotId] ?? null];
      })]);
  }, [cameraFrameRequestSnapshot, groundNonce, state.worldSeed, state.townSim]);
  useEffect(() => {
    const request = cameraFrameRequestSnapshot, planSignature = cameraPlanSignature;
    if (!request || !planSignature || request.ground !== groundRef.current) { setCameraVisitCache(null); return; }
    const {worldSeed, townSim} = cameraPlanInputs.current;
    let cancelled = false;
    void import('../Worldforge/townBuildingVisit').then(({townBuildingVisit}) => {
      const visits = new Map<string, TownBuildingVisit>();
      for (const id of request.siteIds) {
        const identity = /^wf-plot-(\d+)-(\d+)$/.exec(id);
        if (!identity) continue;
        const burgId = Number(identity[1]), plotId = Number(identity[2]), town = townSim?.[burgId];
        visits.set(id, townBuildingVisit(worldSeed, burgId, plotId,
          town?.buildingEvents?.[plotId], town?.buildingSources?.[plotId], town?.layoutRevision));
      }
      if (!cancelled && groundRef.current === request.ground) setCameraVisitCache({nonce:request.nonce,ground:request.ground,visits,planSignature});
    }).catch(() => {
      // A failed lookup is terminal, unlike a lookup still in flight. Let the
      // scene try its ordinary player fallback rather than wait indefinitely.
      if (!cancelled && groundRef.current === request.ground) setCameraVisitCache({
        nonce:request.nonce,ground:request.ground,visits:new Map(),planSignature});
    });
    return () => { cancelled = true; };
  }, [cameraFrameRequestSnapshot, cameraPlanSignature]);
  const cameraFrameRoomData = useMemo(() => {
    const request = cameraFrameRequestSnapshot;
    if (!request || !cameraPlanSignature) return undefined;
    const cached = cameraVisitCache?.nonce === request.nonce && cameraVisitCache.ground === request.ground
      && cameraVisitCache.planSignature === cameraPlanSignature ? cameraVisitCache : null;
    return {...request, visits:cached?.visits ?? new Map<string,TownBuildingVisit>(),
      plansReady:cached !== null,planSignature:cameraPlanSignature};
  }, [cameraFrameRequestSnapshot, cameraPlanSignature, cameraVisitCache]);
  const companionCheckpoints = useRef(new Map<string, { at: number; key: string }>());
  const handleCompanionPositionChange = useCallback((id: string, pose: CompanionPosition, trail: CompanionPosition[]) => {
    if (![pose.xM, pose.yM, pose.zM].every(Number.isFinite) || !Number.isFinite(state.worldSeed)) return;
    const now = performance.now(), previous = companionCheckpoints.current.get(id);
    if (previous && now - previous.at < 200) return;
    const key = JSON.stringify([state.worldSeed, state.currentLocationId, pose, trail]);
    if (previous?.key === key) return;
    companionCheckpoints.current.set(id, { at: now, key });
    dispatch({ type: 'RECORD_COMPANION_POSITION', payload: { companionId: id, worldSeed: state.worldSeed!, locationId: state.currentLocationId, position: pose, trail } });
  }, [state.worldSeed, state.currentLocationId, dispatch]);

  /**
   * Called by FreeRoamCameraController (via World3DScene) when the continent camera moves.
   * Receives world X/Z coordinates, resolves terrain height Y, and dispatches
   * SET_PLAYER_WORLD_POS (throttled to ~10Hz).
   */
  const handlePositionChange = useCallback((worldX: number, worldZ: number) => {
    const now = Date.now();

    // Skip if throttled (less than DISPATCH_INTERVAL_MS since last dispatch).
    if (now - lastDispatchTime.current < DISPATCH_INTERVAL_MS) {
      return;
    }

    // Skip if position hasn't actually changed (avoid redundant dispatches).
    const lastPos = lastDispatchedPos.current;
    if (Math.abs(lastPos.x - worldX) < 0.1 && Math.abs(lastPos.z - worldZ) < 0.1) {
      return;
    }

    // Grid retirement: continent-grid terrain height is gone. The cell-native
    // ground reports its own surface via handleGroundPositionChange; this legacy
    // continent path keeps the entry Y.
    const terrainY = entryPosition.y;

    // Update throttle state.
    lastDispatchTime.current = now;
    lastDispatchedPos.current = { x: worldX, z: worldZ };

    // Dispatch position to game state.
    const position: PlayerWorldPosition = {
      x: worldX,
      y: terrainY,
      z: worldZ,
    };
    setPosition(position);
  }, [setPosition, entryPosition.y]);

  // FREEZE the scene origin / spawn at the value present when 3D was entered.
  //
  // `entryPosition` is `gameState.playerWorldPos` (App.tsx), which THIS component drives via
  // `setPosition` as the camera moves. Deriving `start` from it live created a feedback loop:
  //   camera pans → onPositionChange → SET_PLAYER_WORLD_POS → entryPosition → start →
  //   World3DScene re-derives its floating `sceneOrigin` → the whole world shifts under the camera →
  //   the camera reports a new position → … (repeats every frame)
  // The visible result was the map "sliding through space" and never stopping. The floating origin
  // must stay fixed for the session, so we capture the entry coords once and ignore later updates.
  const frozenEntry = useRef(entryPosition);
  const startPos: readonly [number, number, number] = useMemo(
    () => [frozenEntry.current.x, frozenEntry.current.y, frozenEntry.current.z],
    [],
  );

  // Spawn-surface height via the SAME mapping the chunk geometry uses
  // (heightToMeters: 0..100 → exaggerated meters). Saved entry positions
  // carry y≈0 from before vertical exaggeration landed, which parked the
  // camera hundreds of meters UNDER the terrain — every face back-culled,
  // so PLAYING's 3D view rendered nothing but sky (the "light blue box").
  // Grid retirement: the continent heightfield is gone. The cell-native ground
  // sets its own spawn surface (wfGroundView.surfaceY); this legacy entry keeps
  // the frozen entry Y.
  const startSurfaceY = useMemo(() => frozenEntry.current.y, []);

  // Staged cast for an in-world scene: the player + the dynamic NPCs actually
  // present at this location (the opening-situation strangers at spawn). Rendered
  // only in ground/walking mode, where figures are at a visible scale. Resolves
  // names from generatedNpcs; the conversation's first participant is the speaker.
  const sceneCast = useMemo<SceneCastMember[]>(() => {
    // Native Atlas ground adds the retained Local's actual keepers to the
    // existing opening cast. The generated-NPC lookup below admits only owners
    // that registerTownContent has completed, so no parallel placeholder NPCs
    // are created for this interaction surface.
    const activeIds = Array.from(new Set([
      ...(state.currentLocationActiveDynamicNpcIds ?? []),
      ...(atlasGroundDrilldown ? retainedTownNpcIdsForGround(groundRef.current) : []),
    ]));
    if (!activeIds || activeIds.length === 0) return [];
    const speakerId = state.activeConversation?.kind === 'situation'
      ? state.activeConversation.participants?.[0]
      : undefined;
    // Opening strangers retain their bounded cast. Independently placed local
    // companions must not disappear merely because four strangers came first.
    const visibleIds=[...activeIds.filter(id=>!state.companions[id]?.publicActivity).slice(0,4),
      ...activeIds.filter(id=>state.companions[id]?.publicActivity)];
    const npcs = visibleIds
      .map((id): SceneCastMember | null => {
        const npc = state.generatedNpcs?.[id];
        return npc
          ? { id, name: npc.name, isSpeaker: id === speakerId, recipe: recipeFromRichNpc(npc, state.companions?.[id]?.identity.race) }
          : null;
      })
      .filter((m): m is SceneCastMember => m !== null);
    if (npcs.length === 0) return [];
    const player = state.party?.[0];
    const cast: SceneCastMember[] = [];
    if (player) {
      cast.push({
        id: player.id ?? 'player',
        name: player.name ?? 'You',
        isPlayer: true,
        recipe: recipeFromCharacter(player),
      });
    }
    cast.push(...npcs);
    return cast;
  }, [
    state.currentLocationActiveDynamicNpcIds,
    state.generatedNpcs,
    state.companions,
    state.party,
    state.activeConversation,
    atlasGroundDrilldown,
  ]);

  // A companion's source-world point survives re-entry with a different scene
  // origin. Capture the initial production layout once; never follow the camera.
  const retainedCast = useMemo(() => {
    if (!wfGroundView || wfGroundView.tile.x !== state.playerCell?.cellId) {
      return { cast: [], checkpoints: [] };
    }
    const ground = groundRef.current;
    // Each first placement samples its own feet; retained world points stay exact.
    return placeCompanionCast(state, sceneCast, wfGroundView.start, ground
      ? (xM, zM) => groundSurfaceYM(ground, xM, zM)
      : wfGroundView.surfaceY,wfGroundView.activityPositions);
  }, [sceneCast, wfGroundView, state.playerCell?.cellId, state.companions,
    state.worldSeed, state.currentLocationId, state.currentLocationActiveDynamicNpcIds, state.party]);
  useEffect(() => {
    for (const payload of retainedCast.checkpoints) dispatch({ type: 'RECORD_COMPANION_POSITION', payload });
  }, [retainedCast, dispatch]);

  const handleSelectCastNpc=useCallback((id:string)=>{
    const actual=avatarFootfall.current;
    const feet=actual?.ground===groundRef.current&&performance.now()-actual.at<500?actual.pose:undefined;
    const error=companionActivityContactError(state,id,feet);
    if(error){setFurnishingError(error);return;}
    onTalkToNpc?.(id);
  },[state,onTalkToNpc]);

  // Cell-native world, Stage 3 — 2D Locale view click-to-move. The 2D pane and
  // the 3D ground are TWO SYNCED VIEWS of ONE movement state (`playerGroundPos`).
  // A 2D click dispatches the SAME `SET_PLAYER_GROUND_POS` action the 3D camera
  // walk dispatches — converting the clicked Locale feet → tile-local meters via
  // the bridge and stamping the active tile — so the reducer (which mirrors the
  // position into `playerCell.localeCoords` as feet) is the single sync point.
  const handleLocaleMoveTo = useCallback(
    (feetX: number, feetY: number) => {
      const tile = wfGroundView?.tile;
      if (!tile) return;
      const { xM, zM } = localeFeetToGroundMeters({ x: feetX, y: feetY });
      // Arm click-move authority — a 2D Locale click is a discrete destination
      // too, so it must survive a subsequent camera pan just like a 3D click.
      clickMoveIntent.current = { xM, zM, tileX: tile.x, tileY: tile.y };
      wakeMovement(value => value + 1);
    },
    [dispatch, wfGroundView?.tile],
  );

  // Interactive-3D locomotion: a click on open ground in the 3D world walks the
  // avatar there. GroundMovePlane already converted the raycast hit to tile/world
  // meters (the SAME convention the camera walk uses), so this is a discrete
  // dispatch of the ONE movement state — the body follows, exactly like a camera
  // walk or a 2D Locale-map click.
  const handleGroundClickMove = useCallback(
    (xM: number, zM: number) => {
      const tile = wfGroundView?.tile;
      if (!tile) return;
      // ARM click-move authority: this destination is now authoritative and the
      // camera's pan reports won't clobber it until the avatar arrives.
      clickMoveIntent.current = { xM, zM, tileX: tile.x, tileY: tile.y };
      wakeMovement(value => value + 1);
    },
    [dispatch, wfGroundView?.tile],
  );

  const handleAvatarMovementBlocked = useCallback((position: AvatarFootfall) => {
    const tile = wfGroundView?.tile;
    if (!tile) return;
    clickMoveIntent.current = null;
    arrivedSavedPose.current = position;
    // A blocked click must save the reached side of the wall, not its target.
    dispatch({ type: 'SET_PLAYER_GROUND_POS', payload: { position: { tileX: tile.x, tileY: tile.y, ...position } } });
    refreshNearbyDungeonEntrance(position.xM, position.zM);
  }, [dispatch, wfGroundView?.tile, refreshNearbyDungeonEntrance]);

  // Reading and conversation own the keyboard just as resting does; closing returns ordinary
  // walking at the reached feet instead of moving the hidden body behind paper.
  // Household dialogue has its own modal state. It owns the same movement
  // hold as companion conversation, so meeting a librarian cannot keep walking
  // the player or advertise another physical interaction behind the dialogue.
  // The log owns walking while reading, just like the existing rest/readers.
  const commitmentOpen = Boolean(isMessageLogOpen || state.lodgingOffer || state.isLongRestModalVisible || state.isShortRestModalVisible || state.isBroadsheetVisible || state.activeConversation || state.isDialogueInterfaceOpen);
  // Loading the world-faith reader must not let an old click publish knowledge
  // after the player changes rooms, worlds, saves or the selected furniture.
  const dedicationContext = useRef({state, furnishingInspection, activeDungeonEntry, commitmentOpen, isWorkbenchOpen});
  dedicationContext.current = {state, furnishingInspection, activeDungeonEntry, commitmentOpen, isWorkbenchOpen};
  useEffect(() => { if (commitmentOpen || isWorkbenchOpen) clickMoveIntent.current = null; }, [commitmentOpen, isWorkbenchOpen]);
  useEffect(() => {
    if (!furnishingInspection || activeDungeonEntry) setIsWorkbenchOpen(false);
    if (activeDungeonEntry) { setFurnishingInspection(null); setResidentInspection(null); }
  }, [furnishingInspection, activeDungeonEntry]);
  const examinedFloor = furnishingInspection?.visit.plan.floors.find(floor => floor.level === furnishingInspection.level);
  const residentMember = residentInspection?.visit.household?.members[residentInspection.memberIndex];
  const residentNpc = residentInspection && state.generatedNpcs?.[residentInspection.npcId];
  const examinedPiece = examinedFloor?.furnishings[furnishingInspection?.index ?? -1];
  const examinedContainer = furnishingInspection?.visit.manifests.find(manifest => manifest.level === furnishingInspection.level && manifest.furnishingIndex === furnishingInspection.index);
  const examinedRoom = examinedFloor?.rooms.find(room => room.id === examinedPiece?.roomId);
  const readable = (value: string) => value.replace(/[-_]/g, ' ');

  const handleReadLibraryChronicle = useCallback(() => {
    const inspection = furnishingInspection;
    if (!inspection || inspection.ground !== groundRef.current || activeDungeonEntry || commitmentOpen) return;
    const history = state.townSim?.[inspection.burgId]?.buildingEvents?.[inspection.plotId];
    if (JSON.stringify(history ?? null) !== inspection.historySignature) {
      setFurnishingError('The library has changed. Close and inspect the desk again.'); return;
    }
    const actual = avatarFootfall.current;
    const pose = actual?.ground === inspection.ground && performance.now() - actual.at < 500 ? actual.pose : null;
    const memberId = inspection.visit.household && householdMemberIdentity(inspection.visit.household, 0);
    const keeper = inspection.ground.buildings.find(building => building.id === inspection.pick.siteId)?.occupants
      ?.find(person => person.burgId === inspection.burgId && person.householdMemberId === memberId);
    const denial = libraryReadingAccessError(inspection.visit, inspection.pick, pose, state.gameTime,
      state.townSim?.[inspection.burgId], keeper);
    if (denial) { setFurnishingError(denial); return; }
    const townName = inspection.visit.townName;
    const town = resolveTownForLocation({ground: state, worldSeed: state.worldSeed ?? 42,
      cellId: state.playerCell?.cellId, currentLocationId: state.currentLocationId,
      townSim: state.townSim ?? {}, gameTime: state.gameTime});
    if (!townName || !town || town !== state.townSim?.[inspection.burgId] || !selectTownNews(town, getGameDay(state.gameTime), {max: 24}).length) {
      setFurnishingError('No current town chronicle is available at this desk.'); return;
    }
    // The existing reader owns news, hearsay labels and closing behavior. This
    // grants no item, private shelf contents, quest knowledge or NPC consent.
    clickMoveIntent.current = null;
    setFurnishingError(null);
    setFurnishingInspection(null);
    dispatch({type: 'SET_BROADSHEET_VISIBLE', payload: true, readingPlace: {burgId: inspection.burgId, townName,
      ...(state.playerGroundPos ? {library: {worldSeed: state.worldSeed ?? 42, plotId: inspection.plotId,
        level: inspection.level, index: inspection.index, position: {...state.playerGroundPos},
        historySignature: inspection.historySignature}} : {})}});
  }, [furnishingInspection, state, activeDungeonEntry, commitmentOpen, dispatch]);

  const handleReviewSeatRest = useCallback(() => {
    // Close the stale card so it cannot cover the reason the action is refused.
    const refuse = (message: string) => {
      setFurnishingInspection(null);
      setFurnishingError(message);
    };
    const inspection = furnishingInspection;
    if (!inspection || inspection.ground !== groundRef.current || activeDungeonEntry || commitmentOpen || isWorkbenchOpen
      || inspection.worldSeed !== (state.worldSeed ?? 42)) {
      refuse('This bench is no longer available. Inspect it again before resting.'); return;
    }
    const history = state.townSim?.[inspection.burgId]?.buildingEvents?.[inspection.plotId];
    if (JSON.stringify(history ?? null) !== inspection.historySignature) {
      refuse('The room has changed. Inspect the bench again before resting.'); return;
    }
    const actual = avatarFootfall.current;
    const pose = actual?.ground === groundRef.current && performance.now() - actual.at < 500 ? actual.pose : null;
    const denial = publicSeatRestAccessError(inspection.visit, inspection.pick, pose);
    if (denial) { refuse(denial); return; }
    // The bench supplies a reached seat, not recovery. The existing rest
    // dialog and handler still own eligibility, time, Hit Dice and confirmation.
    clickMoveIntent.current = null;
    setFurnishingError(null);
    setFurnishingInspection(null);
    dispatch({type: 'TOGGLE_SHORT_REST_MODAL'});
  }, [furnishingInspection, state.worldSeed, state.townSim, activeDungeonEntry, commitmentOpen, isWorkbenchOpen, dispatch]);

  const handleReadTempleDedication = useCallback(async () => {
    if (dedicationReadPending.current) return;
    const inspection = dedicationContext.current.furnishingInspection;
    if (!inspection) return;
    const refuse = (message: string) => {
      setFurnishingInspection(null);
      setFurnishingError(message);
    };
    dedicationReadPending.current = true;
    setDedicationPending(true);
    try {
      const {resolveWorldforgeTempleIdentity, templeDedicationReading} = await import('../../systems/religion/worldforgeTemple');
      const current = dedicationContext.current;
      // An obsolete request must not close or replace a newly selected card.
      if (current.furnishingInspection !== inspection) return;
      if (inspection.ground !== groundRef.current || current.activeDungeonEntry || current.commitmentOpen || current.isWorkbenchOpen
        || inspection.worldSeed !== (current.state.worldSeed ?? 42)) {
        refuse('This altar is no longer available. Inspect it again before reading.'); return;
      }
      const town = current.state.townSim?.[inspection.burgId];
      if (JSON.stringify(town?.buildingEvents?.[inspection.plotId] ?? null) !== inspection.historySignature) {
        refuse('The temple has changed. Inspect the altar again before reading.'); return;
      }
      const actual = avatarFootfall.current;
      const pose = actual?.ground === groundRef.current && performance.now() - actual.at < 500 ? actual.pose : null;
      const denial = templeDedicationAccessError(inspection.visit, inspection.pick, pose);
      if (denial) { refuse(denial); return; }
      const identity = resolveWorldforgeTempleIdentity(inspection.worldSeed, inspection.burgId, inspection.plotId,
        getGameDay(current.state.gameTime), town);
      const reading = identity && templeDedicationReading(identity, current.state.gameTime);
      if (!reading) { refuse('No dedication is available to read at this altar.'); return; }
      // Use the existing dated account on rereads. This grants knowledge only:
      // no meeting, priest skill, divine favor, service, item or quest is earned.
      const prior = current.state.discoveryLog.find(entry => entry.id === reading.entry.id
        && entry.content === reading.entry.content && entry.source.id === reading.entry.source.id);
      const delivered = prior ? {...reading, entry:prior} : reading;
      clickMoveIntent.current = null;
      setFurnishingError(null);
      dispatch({type:'ADD_DISCOVERY_ENTRY', payload:delivered.entry});
      setFurnishingInspection({...inspection, dedication:delivered});
    } catch {
      if (dedicationContext.current.furnishingInspection === inspection) {
        refuse('The dedication could not be read. Inspect the altar and try again.');
      }
    } finally {
      dedicationReadPending.current = false;
      setDedicationPending(false);
    }
  }, [dispatch]);

  const checkWorkbenchAccess = useCallback((durationMinutes: number): string | null => {
    const inspection = furnishingInspection;
    if (!inspection || inspection.ground !== groundRef.current || activeDungeonEntry || commitmentOpen) return 'This workbench is no longer available.';
    const history = state.townSim?.[inspection.burgId]?.buildingEvents?.[inspection.plotId];
    if (JSON.stringify(history ?? null) !== inspection.historySignature) return 'The workshop has changed. Close and inspect the bench again.';
    const actual = avatarFootfall.current;
    const pose = actual?.ground === groundRef.current && performance.now() - actual.at < 500 ? actual.pose : null;
    return workbenchAccessError(inspection.visit, inspection.pick, pose, state.gameTime, durationMinutes, state.townSim?.[inspection.burgId]);
  }, [furnishingInspection, state.gameTime, state.townSim, activeDungeonEntry, commitmentOpen]);
  const handleUseWorkbench = useCallback(() => {
    const denial = checkWorkbenchAccess(0);
    if (denial) { setFurnishingError(denial); return; }
    const pose = avatarFootfall.current?.pose;
    if (!pose || !state.playerGroundPos) return;
    // Stop at the reached body before opening timed work. Keep footfall reports
    // running so every dismantle can revalidate that same physical station.
    clickMoveIntent.current = null;
    dispatch({type:'SET_PLAYER_GROUND_POS', payload:{position:{...state.playerGroundPos,...pose}}});
    setIsWorkbenchOpen(true);
  }, [checkWorkbenchAccess, state.playerGroundPos, dispatch]);


  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Keep world labels inside the scene layer, below the inspection panels. */}
      <div data-testid="world3d-scene-layer" style={{ width: '100%', height: '100%', isolation: 'isolate' }}>
      {loader ? (
        <World3DScene
          suspended={Boolean(activeDungeonEntry)}
          forgeAssetService={_stubService}
          loader={loader}
          start={wfGroundView?.start ?? startPos}
          startSurfaceY={wfGroundView?.surfaceY ?? startSurfaceY}
          viewProfile={wfGroundView ? 'ground' : 'continent'}
          playerWorldPos={wfGroundView ? null : position}
          onPositionChange={wfGroundView ? handleGroundPositionChange : handlePositionChange}
          onChunkUpdate={handleChunkUpdate}
          onCameraBearingChange={wfGroundView ? setCameraBearingDegrees : undefined}
          // Ground mode only: townsfolk walk the streets on the game clock.
          groundWorld={wfGroundView ? groundRef.current : null}
          onPropLayerReady={(root, ground, origin, bodies) => setPropLayer({root, ground, origin, bodies})}
          agentClock={state.gameTime instanceof Date ? scheduleClockFromGameTime(state.gameTime) : undefined}
          // Night-sky port (2026-08-26): the sun/sky/fog model AND the
          // physically-based night sky (NightSky -> TakramSkySystem) are both
          // driven by the SAME fractional UTC hour the agent schedules use.
          timeOfDayHours={state.gameTime instanceof Date ? scheduleClockFromGameTime(state.gameTime) : undefined}
          frameTownCellNonce={frameTownCellNonce}
          framePlayerNonce={framePlayerNonce}
          onPlayerFrameUnavailable={() => dispatch({type: 'ADD_NOTIFICATION', payload: {
            type: 'info', message: 'No clear camera position nearby. Orbit or zoom to inspect your surroundings.',
          }})}
          sceneCast={wfGroundView ? retainedCast.cast : undefined}
          partyCompanions={wfGroundView ? partyCompanions : undefined}
          cameraFrameRoomData={cameraFrameRoomData?.nonce === framePlayerNonce
            && cameraFrameRoomData.ground === groundRef.current
            && cameraFrameRoomData.planSignature === cameraPlanSignature ? cameraFrameRoomData : undefined}
          partyPaused={!!activeDungeonEntry || commitmentOpen || isWorkbenchOpen || !!state.activeConversation}
          onCompanionPositionChange={activeDungeonEntry || commitmentOpen ? undefined : handleCompanionPositionChange}
          onSelectNpc={isWorkbenchOpen ? undefined : handleSelectCastNpc}
          // The dungeon owns locomotion while its overlay is open. Leaving this
          // callback armed lets the same arrow key walk the hidden world body.
          onGroundPick={wfGroundView && !activeDungeonEntry && !commitmentOpen && !isWorkbenchOpen ? handleGroundClickMove : undefined}
          // Keep the retained world body at the return anchor, without letting
          // hidden interpolation overwrite the save while the dungeon owns play.
          onAvatarPositionChange={activeDungeonEntry || commitmentOpen ? undefined : handleAvatarPositionChange}
          onAvatarMovementBlocked={activeDungeonEntry || commitmentOpen ? undefined : handleAvatarMovementBlocked}
          onSelectFurnishing={wfGroundView && !isWorkbenchOpen ? handleSelectFurnishing : undefined}
          onSelectDoor={wfGroundView && !isWorkbenchOpen ? handleSelectDoor : undefined}
          onNearbyBuildingDoorChange={setNearbyBuildingDoor}
          onNearbyFurnishingChange={setNearbyFurnishings}
          focusedFurnishingId={nearbyFurnishings.some(action => action.id === focusedFurnishingId) ? focusedFurnishingId : null}
          resolveNearbyFurnishingPlan={resolveNearbyFurnishingPlan}
          onSelectResident={wfGroundView && !isWorkbenchOpen ? handleSelectResident : undefined}
          openDoors={openDoors}
          // Player avatar: the body follows the ONE movement state
          // (playerGroundPos) when it belongs to this tile; else it stands at
          // the spawn until the first move dispatch stamps the tile.
          playerGroundPos={
            activeDungeonEntry
              ? {xM: activeDungeonEntry.returnContext.xM, zM: activeDungeonEntry.returnContext.zM, yM: activeDungeonEntry.returnContext.yM}
              : wfGroundView &&
            state.playerGroundPos &&
            state.playerGroundPos.tileX === wfGroundView.tile.x &&
            state.playerGroundPos.tileY === wfGroundView.tile.y
              ? { xM: ((commitmentOpen || isWorkbenchOpen) ? undefined : clickMoveIntent.current?.xM) ?? state.playerGroundPos.xM,
                zM: ((commitmentOpen || isWorkbenchOpen) ? undefined : clickMoveIntent.current?.zM) ?? state.playerGroundPos.zM, yM: state.playerGroundPos.yM }
              : null
          }
          groundMoveRequest={clickMoveIntent.current}
          playerCharacter={wfGroundView ? (state.party?.[0] ?? null) : null}
        />
      ) : worldGenError ? (
        // No-fallback: a failed world build says so plainly instead of a blank view.
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '520px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px',
            boxSizing: 'border-box',
            background: 'var(--bg-surface-alt, #2a1418)',
            color: 'var(--text-secondary, #f2b8c0)',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #5a3a42)',
          }}
        >
          <div style={{ fontWeight: 700 }}>The world could not be built.</div>
          <div style={{ opacity: 0.85 }}>{worldGenError}</div>
        </div>
      ) : worldGenStage ? (
        // Staged assembly is running off-thread — honest, animated progress.
        <WorldGenLoadingScreen stage={worldGenStage} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            minHeight: '520px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface-alt, #1e2e3e)',
            color: 'var(--text-secondary, #8a9aaa)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '14px',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #3a4a5a)',
          }}
        >
          World data is not ready for 3D view. Use Open Map to return to the atlas.
        </div>
      )}
      </div>
      {/* A reached entry is usable without aiming through a cramped camera.
          The live scene rechecks feet and resident right of way on activation;
          handleSelectDoor still owns source, room and swing admission. */}
      <div className="absolute bottom-24 left-4 z-40 w-80 max-w-[calc(100%-2rem)] space-y-2">
      {nearbyBuildingDoor && wfGroundView && !activeDungeonEntry && !commitmentOpen && !isWorkbenchOpen &&
        <section aria-label="Nearby door" className="rounded border border-amber-300/40 bg-slate-950 p-3 text-sm text-slate-100 shadow-xl">
          <h3 className="font-semibold text-amber-200">Nearby door</h3>
          <p className="my-2">{nearbyBuildingDoor.name}</p>
          {nearbyBuildingDoor.users.length > 0 && <p className="mb-2">{nearbyBuildingDoor.users.join(', ')} {nearbyBuildingDoor.users.length === 1 ? 'is' : 'are'} using the doorway.</p>}
          <Button size="sm" variant="secondary" disabled={!!doorPending || nearbyBuildingDoor.users.length > 0}
            onClick={nearbyBuildingDoor.activate}>{nearbyBuildingDoor.open ? 'Close door' : 'Open door'}</Button>
        </section>}
      {/* These are actual reached furnishings, filtered by the shared room,
          floor and distance rule. Selection opens the ordinary guarded reader;
          no reading, rest, goods or permission is granted by this prompt. */}
      {nearbyFurnishings.length > 0 && wfGroundView && !activeDungeonEntry && !commitmentOpen && !isWorkbenchOpen && !furnishingInspection && !residentInspection &&
        <NearbyFurnishingChoices actions={nearbyFurnishings} onFocusTarget={setFocusedFurnishingId} />}
      </div>
      {doorPending && <div role="status" className="absolute left-4 top-16 z-40 max-w-sm rounded border border-amber-300/40 bg-slate-950 p-3 text-sm text-slate-100 shadow-xl">{doorPending === 'opening' ? 'Opening door…' : 'Closing door…'}</div>}
      {/* Desktop reading space keeps family and household records legible while the world remains visible. */}
      {residentInspection && residentMember && <aside aria-label="Resident" data-testid="ground-resident-inspection" className="absolute left-6 top-28 z-40 max-h-[calc(100%-10rem)] w-[760px] max-w-[calc(100%-3rem)] overflow-y-auto rounded-lg border border-amber-300/40 bg-slate-950 p-6 text-base text-slate-100 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-amber-200">{residentNpc?.name ?? residentMember.name}</h3><Button size="sm" variant="secondary" onClick={() => setResidentInspection(null)}>Close</Button></div>
        <ResidentProfile household={residentInspection.visit.household!} memberIndex={residentInspection.memberIndex} life={state.townSim?.[residentInspection.burgId]} gameTime={state.gameTime} />
        <p className="mt-3">{(state.metNpcIds.includes(residentInspection.npcId) || latestSpokenDialogueReplies(state,residentInspection.npcId,1).length>0) ? 'You have met before.' : 'You have not spoken yet.'}</p>
        <Button className="mt-3" disabled={!residentNpc || !onTalkToNpc || !householdNpcAliveAt(residentNpc, state.townSim, getGameDay(state.gameTime))} onClick={handleTalkToResident}>Talk</Button>
      </aside>}
      {furnishingError && <div role="status" data-testid="furnishing-reach-message" className="absolute left-4 top-16 z-40 max-w-sm rounded border border-amber-300/40 bg-slate-950 p-3 text-sm text-slate-100 shadow-xl">
        <p>{furnishingError}</p><Button size="sm" variant="secondary" onClick={() => setFurnishingError(null)}>Dismiss</Button>
      </div>}
      {/* Keep the furniture reader clear of the independently docked party chat. */}
      {furnishingInspection && examinedPiece && <aside aria-label="Furnishing examination" data-testid="ground-furnishing-inspection" className="absolute left-4 top-16 z-40 max-h-[70%] w-80 max-w-[calc(100%-2rem)] overflow-y-auto rounded border border-amber-300/40 bg-slate-950 p-4 text-sm text-slate-100 shadow-xl">
        <div className="mb-2 flex items-start justify-between gap-3"><h3 className="text-lg font-semibold capitalize text-amber-200">{readable(examinedPiece.kind)}</h3><Button size="sm" variant="secondary" onClick={() => setFurnishingInspection(null)}>Close</Button></div>
        <p>{/^[aeiou]/i.test(readable(examinedPiece.kind)) ? 'An' : 'A'} {readable(examinedPiece.kind)} in the {readable(examinedRoom?.purpose ?? 'room')}.</p>
        <PublicSeatRestAction visit={furnishingInspection.visit} level={furnishingInspection.level} index={furnishingInspection.index} onReview={handleReviewSeatRest} />
        <TempleDedicationAction visit={furnishingInspection.visit} level={furnishingInspection.level} index={furnishingInspection.index} reading={furnishingInspection.dedication} pending={dedicationPending} onRead={handleReadTempleDedication} />
        {examinedPiece.kind === 'bed' && <div className="mt-3 space-y-2">
          <p>Sleeping here requires the owner's permission. Private beds are not spare lodging.</p>
          <GuestBedRestAction state={state} visit={furnishingInspection.visit}
            businessId={'biz_burg_' + furnishingInspection.burgId + '_plot_' + furnishingInspection.plotId}
            level={furnishingInspection.level} index={furnishingInspection.index} onUse={handleUseGuestBed}/>
        </div>}
        {examinedPiece.kind === 'workbench' && <div className="mt-3 space-y-2">
          <p>A private bench needs its owner's permission. Staffed public workshops offer short dismantling jobs using your own equipment.</p>
          {furnishingInspection.visit.isBusiness && ['workshop', 'forge'].includes(examinedRoom?.purpose ?? '') &&
            <Button onClick={handleUseWorkbench}>Ask to use workbench</Button>}
        </div>}
        {isPublicLibraryDesk(furnishingInspection.visit, furnishingInspection.level, furnishingInspection.index) && <div className="mt-3 space-y-2">
          <p>Consult the town chronicle during staffed library hours. Household goods remain owned.</p>
          <Button onClick={handleReadLibraryChronicle}>Read town chronicle</Button>
        </div>}
        {examinedContainer && <HouseholdContainerContents manifest={examinedContainer} />}
      </aside>}
      {isWorkbenchOpen && furnishingInspection && <React.Suspense fallback={<div role="status" className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 text-slate-100">Opening the workshop…</div>}>
        <TownSalvageWorkshop onClose={() => setIsWorkbenchOpen(false)} station={{
          name: (furnishingInspection.visit.household?.members[0]?.name ?? 'Keeper') + ' · ' + furnishingInspection.visit.townName + ' workbench',
          checkAccess: checkWorkbenchAccess,
        }} />
      </React.Suspense>}
      {/* Cell-native world, Stage 3: the 2D Locale view, ground-mode only. It is
          the second synced view of the one movement state (`playerGroundPos`):
          it renders the player marker from that state and writes back to it on
          click via the shared SET_PLAYER_GROUND_POS action. Additive — it sits
          beside the compass / drill views, replacing none of them. */}
      {wfGroundView && isLocaleMapOpen ? (
        <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 20 }}>
          <LocaleMovePane
            localeExtent={wfGroundView.localeExtent}
            groundPos={state.playerGroundPos ?? null}
            onMoveTo={handleLocaleMoveTo}
          />
        </div>
      ) : null}
      {/* The active dungeon or borrowed bench owns interaction; retained world state is preserved. */}
      {!activeDungeonEntry && !isWorkbenchOpen && <InWorldHUD
        isDevModeEnabled={isDevModeEnabled}
        worldData={null}
        worldGen={null}
        chunkCount={chunkCount}
        playerPos={position}
        cameraBearingDegrees={wfGroundView ? cameraBearingDegrees : null}
        streamerStats={streamerStats}
        onOpenMap={() => setMode('atlas')}
        onExitToMenu={() => dispatch({ type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU })}
        isLocaleMapAvailable={Boolean(wfGroundView)}
        isLocaleMapOpen={isLocaleMapOpen}
        onToggleLocaleMap={() => setIsLocaleMapOpen((open) => !open)}
        onOpenAgentSim={isDevModeEnabled
          ? () => requestDevOverlay(OPEN_AGENT_SIM_EVENT)
          : undefined}
        onOpenTownHistory={isDevModeEnabled
          ? () => requestDevOverlay(OPEN_TOWN_HISTORY_EVENT)
          : undefined}
        isGroundMode={isGroundMode}
        onShortRest={wfGroundView && !activeDungeonEntry ? () => dispatch({type: 'TOGGLE_SHORT_REST_MODAL'}) : undefined}
        onLongRest={wfGroundView && !activeDungeonEntry ? () => dispatch({type: 'TOGGLE_LONG_REST_MODAL'}) : undefined}
        onToggleGroundMode={() => setIsGroundMode(prev => !prev)}
        // The PLAYING title is the same canonical focus and Atlas burg receipt
        // shown by Local. Classic ground and the developer URL have no retained
        // focus, so they keep the established generic 3D label.
        groundFocus={atlasGroundDrilldown?.focus ?? null}
        groundTownIdentity={atlasGroundDrilldown?.local.townPlan?.identity ?? null}
        // Only meaningful in ground/village mode (a town to frame); pulls the
        // camera up to the spawn town's overhead "cell" view without leaving 3D.
        onFrameTownCell={wfGroundView ? () => { setFramePlayerNonce(0); setFrameTownCellNonce(n => n + 1); } : undefined}
        onFramePlayer={wfGroundView && !activeDungeonEntry ? () => { setFrameTownCellNonce(0); setFramePlayerNonce(n => n + 1); } : undefined}
        // "Cell Map": open the 2D Voronoi world map as a modal over the 3D view,
        // centered on the player's town cell. TOGGLE_MAP_VISIBILITY leaves
        // worldViewMode untouched, so closing the map returns here in place.
        onOpenCellMap={wfGroundView ? () => {
          requestMapCenterOnPlayer();
          dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
        } : undefined}
        // "Town Plan": open the same 2D map modal but drilled straight to the
        // town the player's 3D world is showing (World ▸ Region ▸ Town). The
        // target burg must be passed explicitly: the player usually stands in a
        // cell ADJACENT to the town's own cell (the ground window spans several
        // atlas cells), so the town can't be derived from the player's cell.
        // Pick the nearest ground town to the player; default to the spawn town.
        onOpenTownPlan={wfGroundView ? () => {
          const towns = groundRef.current?.towns ?? [];
          const p = state.playerGroundPos;
          let burgId: number | null = towns[0]?.burgId ?? null;
          if (p && towns.length > 1) {
            let best = Infinity;
            for (const t of towns) {
              const d = (t.xM - p.xM) ** 2 + (t.zM - p.zM) ** 2;
              if (d < best) { best = d; burgId = t.burgId; }
            }
          }
          requestMapDrillToPlayerTown(burgId);
          dispatch({ type: 'TOGGLE_MAP_VISIBILITY' });
        } : undefined}
      />}

      <WorldMessageLog isOpen={isMessageLogOpen} onClose={closeMessageLog}
        messages={state.messages ?? []} openingStatus={state.gameEntry?.status} />

      {/* Reuse the same player menu as 2D and dungeon play, including ordinary
          save actions. Developer diagnostics are a separate existing surface. */}
      {onAction && !activeDungeonEntry && !isWorkbenchOpen && (!commitmentOpen || isMessageLogOpen) && <div data-testid="world-system-menu" className="absolute bottom-14 right-4 z-40 flex items-center gap-2">
        <Button type="button" aria-haspopup="dialog" aria-expanded={isMessageLogOpen}
          onClick={() => { clickMoveIntent.current = null; setIsMessageLogOpen(true); }}>Adventure log</Button>
        <SystemMenu compact onAction={onAction} disabled={Boolean(state.isLoading) || isMessageLogOpen}
          unreadDiscoveryCount={state.unreadDiscoveryCount ?? 0}
          hasNewRateLimitError={Boolean(state.hasNewRateLimitError)}
          isDevModeEnabled={Boolean(state.isDevModeEnabled)} autoSaveEnabled={Boolean(state.autoSaveEnabled)}
          combatDifficulty={state.combatDifficulty} rulesEdition={state.rulesEdition} allowSaveScum={state.allowSaveScum} />
      </div>}

      {/* Walking close to a discovered doorway exposes one explicit entry action. The prompt is
          separate from discovery/pinning so finding a dungeon never forces the player inside. */}
      {nearbyDungeonEntrance && !activeDungeonEntry && !isWorkbenchOpen ? (
        <aside
          data-testid="dungeon-entry-prompt"
          data-dungeon-id={nearbyDungeonEntrance.id}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: dungeonEntryError ? '72px' : '24px',
            zIndex: 60,
            // A companion's reason needs room to read at the desktop doorway.
            width: dungeonEntryError ? 'min(760px, calc(100% - 32px))' : 'min(520px, calc(100% - 32px))',
            transform: 'translateX(-50%)',
            padding: '14px 16px',
            border: '1px solid rgba(251, 191, 36, 0.7)',
            borderRadius: '12px',
            background: 'rgba(12, 10, 8, 0.94)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
            color: '#f7ecd1',
            textAlign: 'center',
          }}
        >
          <div style={{ color: '#fbbf24', fontSize: '11px', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {/* Use only this world's firsthand discovery. Learned directions do
                not identify an undiscovered doorway or move its entry gate. */}
            {state.discoveryLog?.find(entry => entry.source.type === 'LOCATION'
              && entry.source.id === `world:${state.worldSeed}:cell:${nearbyDungeonEntrance.cellId}:site:${nearbyDungeonEntrance.id}`)?.source.name ?? 'Dungeon Entrance'}
          </div>
          <div style={{ margin: '4px 0 10px', fontSize: '13px', color: '#d6c7aa' }}>
            {readable(nearbyDungeonEntrance.entranceKind)}
          </div>
          <Button
            type="button"
            onClick={handleEnterDungeon}
            data-testid="enter-dungeon"
            variant="action"
            size="md"
            style={{
              border: '1px solid #fbbf24',
              background: '#92400e',
              color: '#fff7db',
              fontWeight: 800,
            }}
          >
            Enter Dungeon
          </Button>
          {dungeonEntryError ? (
            <div role="alert" style={{ marginTop: '14px', color: '#fca5a5', fontSize: '16px', lineHeight: 1.5, textAlign: 'left' }}>
              {dungeonEntryError}
            </div>
          ) : null}
        </aside>
      ) : null}

      {/* The generated interior covers the world visually but does not unmount it. Returning closes
          this layer and restores the saved tile-local position through the existing movement action. */}
      {activeDungeonEntry ? (
        <DungeonExpeditionOverlay
          onAction={onAction}
          entry={activeDungeonEntry}
          onReturn={handleReturnFromDungeon}
        />
      ) : null}
    </div>
  );
};

export default World3DWrapper;
