/**
 * @file InteriorOccupants.tsx — the live interior-occupant render layer.
 *
 * The payoff of the living-interiors slice: each household member moves through
 * their house hour by hour on the LIVE game clock, instead of freezing at the
 * hour the player entered. This mirrors the street-agent layer (GroundAgents)
 * but reads its figures from the baked per-building occupant schedule
 * (`site.occupants`) rather than a commuter roster.
 *
 * DATA vs RENDER: which member belongs at each station is baked
 * deterministically as `stationsByHour` (plan feet, blueprint frame; null = OUT
 * that hour). This component is pure render-side selection against the live
 * fractional clock — it interpolates each in-house station change and draws a
 * shared OccupantFigure with a matching walk gait. A joined nearby commuter
 * keeps that SAME figure on the street instead of changing to a crowd ancestry.
 * Nothing here re-meshes a
 * chunk or touches the streaming worker; the flattened figure list is memoized
 * on the loaded-chunk set and only lightweight group transforms update per frame.
 *
 * Generated soft bodies are deliberately a close-interior detail, not a whole-
 * town layer. The nearby selector favors people in the current view within its bounded set so
 * an overview cannot accidentally polygonize dozens of unseen residents.
 *
 * Placement uses the SAME shared transform SiteBuilding and InteriorLights use
 * (planFeetToSiteLocal → siteLocalToScene), so a figure can never drift from the
 * shell it stands in. Arrivals and departures share the street layer's
 * game-clock handoff. Indoor walks now take measured seconds;
 * people then remain at their clear activity position instead of spending half
 * an hour converging on the same door. Nearby visible bodies also reserve their
 * real envelopes: residents take small source-supported yield steps around
 * accepted player feet, then return toward their scheduled station. This is
 * transient physical placement, not a change to identity or saved routines.
 * Opt-in private-room packets now follow supported, source-permitted routes;
 * legacy schedule interpolation below remains the shared street handoff sampler.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 01/11/2026, 18:13:13
 * Dependents: components/World3D/GroundAgents.tsx, components/World3D/World3DScene.tsx, components/World3D/libraryReadingAccess.ts, components/World3D/residentDoorUse.ts, components/World3D/streetOwnedAgents.ts
 * Imports: 17 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Frustum, Matrix4, Sphere, Vector3, type Group } from "three";
import type {
  BuildingOccupantRender,
  LoadedChunk,
} from "@/systems/world3d/types";
import { chunkOriginWorld } from "@/systems/world3d/coords";
import { worldToScene, type SceneOrigin } from "@/systems/world3d/sceneOrigin";
import { BTN_BASE, BTN_GHOST } from "@/styles/buttonStyles";
import {
  siteLocalToScene,
  planFeetToSiteLocal,
  type SitePlacement,
} from "./interiorPlacement";
import OccupantFigure from "./OccupantFigure";
import { useInteriorClockRef } from "./InteriorHourContext";
import { GroundFurnishingContext } from './GroundFurnishingContext';
import type { ReadResidentPick } from './groundResidentInteraction';
import { groundAgentScenePositions } from '@/systems/worldforge/bridge/groundAgentMotion';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { ActorPersonalSpaceContext } from './ActorPersonalSpaceContext';
import { actorCourtesySpace, actorSpaceOverlaps, clipActorStep, yieldActorStep, canActorTurn, type ActorPoint, type ActorFootprint, type ActorYieldRouteState } from './actorPersonalSpace';
import { resolveGroundWaterWalk } from './groundWaterMovement';
import type { GroundWalkSurfaces } from './groundBuildingMotion';
import { siteDoorKey, worldOffsetToSiteLocal } from '@/systems/worldforge/bridge/sitePartTransform';
import {cancelResidentInteriorPlanning,createResidentPlanningFrameBudget,type ResidentPlanningFrameBudget,advanceResidentInteriorRoute,heldResidentFoot,residentRouteRegion,residentRouteRadius,type ResidentInteriorRouteState} from './residentInteriorMotion';
import type { TownRoster } from '@/systems/worldforge/roster/types';

/**
 * Only villagers near the camera get a full generated body. Interior figures
 * read only through nearby doors and windows, and a whole town holds hundreds
 * of at-home members — mounting them all would cost gigabytes of geometry.
 * Re-evaluated at a slow tick with hysteresis so figures don't pop at the rim.
 */
const BODY_RADIUS_M = 18;
const BODY_RADIUS_EXIT_M = 24;
/** A small distance preference prevents flicker without letting old neighbors hide a newly reached household. */
const BODY_RETENTION_MARGIN_M = 1;

/**
 * A dense block can put many households inside the same radius. Ten live soft
 * bodies still makes a room feel inhabited while bounding both CPU work and
 * geometry memory; farther residents remain represented by the simulation and
 * appear as the player approaches them.
 */
export const MAX_LIVE_INTERIOR_BODIES = 10;

/** The small position record needed to choose which residents get live bodies. */
export interface InteriorBodyCandidate {
  key: string;
  x: number;
  y: number;
  z: number;
  /** HOME owners receive scarce live-body slots before OUT continuity groups. */
  interiorOwned?: boolean;
  /** A real moving person stays identifiable ahead of idle/hidden neighbors. */
  moving?: boolean;
  /** Rendering priority only; not proof of sight, reach or permission. */
  inView?: boolean;
}

/**
 * Choose the nearest visible residents with enter/exit hysteresis.
 *
 * Previously every resident within a broad 42-metre sphere mounted a live
 * marching-cubes body. A town overview could therefore create 60+ animated
 * fields and collapse to one-digit FPS. This pure selector makes that budget
 * explicit and testable while keeping already-visible residents alive a little
 * farther out so they do not flicker at the boundary.
 */
export function selectInteriorBodyKeys(
  candidates: InteriorBodyCandidate[],
  camera: { x: number; y: number; z: number },
  previous: ReadonlySet<string>,
  limit = MAX_LIVE_INTERIOR_BODIES,
): ReadonlySet<string> {
  // Measure full 3D distance so an overhead town view does not spend the body
  // budget on residents hidden several storeys below the camera.
  const eligible = candidates
    .map((candidate) => {
      const distance = Math.hypot(
        candidate.x - camera.x,
        candidate.y - camera.y,
        candidate.z - camera.z,
      );
      const radius = previous.has(candidate.key)
        ? BODY_RADIUS_EXIT_M
        : BODY_RADIUS_M;
      return { candidate, distance, eligible: distance < radius };
    })
    .filter((entry) => entry.eligible)
    .sort((a, b) => {
      const priority = (entry: {
        candidate: InteriorBodyCandidate;
        distance: number;
        eligible: boolean;
      }): number => {
        if (entry.candidate.moving && entry.candidate.interiorOwned !== false) return -1;
        if (entry.candidate.interiorOwned !== false) return entry.candidate.inView === false ? 1 : 0;
        return 2;
      };
      // Moving people keep first priority. Otherwise favor the current view
      // before idle neighbors behind the camera; distance alone can hide a
      // nearby host while spending every slot on people the player cannot see.
      // Offscreen bodies remain eligible, ahead of absent placeholders.
      // Retention has a bounded margin, so approaching a different household
      // can reveal its hosts while keeping the same radius and ten-body cap.
      const retainedDistance = (entry: typeof a) => entry.distance
        - (previous.has(entry.candidate.key) ? BODY_RETENTION_MARGIN_M : 0);
      return priority(a) - priority(b) || retainedDistance(a) - retainedDistance(b)
        || a.distance - b.distance;
    })
    .slice(0, Math.max(0, limit));

  return new Set(eligible.map((entry) => entry.candidate.key));
}

/**
 * Historical nominal storey spacing for packets without a matching source
 * floor. Current buildings use their actual slab boxes below; this fallback
 * cannot qualify physical support or a stair route.
 */
const STOREY_M = 3;

/**
 * Retain the old half-hour value as an upper bound for pathological long paths.
 * Normal room travel uses distance and walking speed below. The hourly owner
 * and exact frontage-door handoff remain shared with the street schedule.
 */
export const INTERIOR_WALK_FRACTION = 0.5;
/** Ordinary indoor walking, measured in game seconds rather than half an hour. */
export const INTERIOR_WALK_METERS_PER_SECOND = 1.2;

function interiorTravelHours(a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}): number {
  return Math.min(INTERIOR_WALK_FRACTION, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / INTERIOR_WALK_METERS_PER_SECOND / 3600);
}

// ============================================================================
// Cross-Layer Resident Identity and Ownership
// ============================================================================
// The household member key is the person; the burg prefix prevents two towns
// whose plot ids restart at zero from claiming the same render identity. These
// helpers are shared with GroundAgents so both layers make the same ownership
// decision from the same baked schedule and live clock.
// ============================================================================

/** A globally stable resident identity built from the landed household key. */
export function residentIdentityKey(
  burgId: number,
  householdMemberId: string,
): string {
  return `${burgId}:${householdMemberId}`;
}

/** The burg-scoped numeric id used to join a roster instance to its body packet. */
export function residentRenderKey(burgId: number, occupantId: number): string {
  return `${burgId}:${occupantId}`;
}

/** A numeric id alone cannot join people from different settlements or homes. */
export function residentRosterIndex(rosters: TownRoster[]): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const roster of rosters) for (const person of roster.occupants) {
    if (person.householdMemberId !== undefined) index.set(residentRenderKey(roster.burgId, person.id),
      residentIdentityKey(roster.burgId, person.householdMemberId));
  }
  return index;
}

/** Distant proxies may reduce detail, but must not reroll a known ancestry. */
export function residentAncestryIndex(rosters: TownRoster[], handoffs: ReadonlyMap<string, ResidentHandoffRecord>): ReadonlyMap<string, string> {
  const source = residentRosterIndex(rosters), out = new Map<string, string>();
  const names = new Map(rosters.flatMap(r => r.occupants.map(o => [residentRenderKey(r.burgId, o.id), o.name] as const)));
  for (const [renderKey, handoff] of handoffs) {
    if (source.get(renderKey) === handoff.stableKey && names.get(renderKey) === handoff.occupant.name)
      out.set(renderKey, handoff.occupant.race ?? 'Human');
  }
  return out;
}

/** Exactly one layer owns a joined resident at any clock value. */
export type ResidentRenderOwner = "interior" | "street";

/** Resolve ownership from the canonical integer occupancy slot. */
export function residentRenderOwnerAtClock(
  occupant: BuildingOccupantRender,
  clock: number,
): ResidentRenderOwner {
  const wrapped = ((clock % 24) + 24) % 24;
  const hour = Math.floor(wrapped);
  const interiorOwned =
    occupant.interiorOwnedByHour?.[hour] ??
    Boolean(occupant.stationsByHour[hour]);
  const arrival = occupant.interiorArrivalDelayByHour?.[hour] ?? 0;
  return interiorOwned && wrapped - hour >= arrival ? "interior" : "street";
}

/** One canonical body packet indexed for the street/interior ownership join. */
export interface ResidentHandoffRecord {
  stableKey: string;
  renderKey: string;
  occupant: BuildingOccupantRender;
  /** Every real home/work packet for this one person, not duplicate people. */
  locations?: BuildingOccupantRender[];
}

/**
 * Collect one resident identity with all of its real building destinations.
 * Home/work packets share a person; their current schedule selects the owner.
 */
export function collectResidentHandoffIndex(
  loaded: LoadedChunk[],
): ReadonlyMap<string, ResidentHandoffRecord> {
  const byRenderKey = new Map<string, ResidentHandoffRecord>();
  const byStableKey = new Map<string, ResidentHandoffRecord>();
  const orderedChunks = [...loaded].sort(
    (left, right) => left.cx - right.cx || left.cy - right.cy,
  );
  for (const chunk of orderedChunks) {
    const orderedSites = [...chunk.bundle.sites].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (const site of orderedSites) {
      for (const occupant of site.occupants ?? []) {
        if (
          occupant.burgId === undefined ||
          occupant.householdMemberId === undefined
        ) {
          continue;
        }
        const stableKey = residentIdentityKey(
          occupant.burgId,
          occupant.householdMemberId,
        );
        const existing = byStableKey.get(stableKey);
        if (existing) {
          existing.locations!.push(occupant);
          continue;
        }
        const renderKey = residentRenderKey(occupant.burgId, occupant.id);
        const record = { stableKey, renderKey, occupant, locations: [occupant] };
        byStableKey.set(stableKey, record);
        byRenderKey.set(renderKey, record);
      }
    }
  }
  return byRenderKey;
}

export type ResidentStreetSampler = (residentKey: string, clock: number) => InteriorOccupantMotion | null;

/** Read the existing street simulation, without moving anyone or changing a
 * schedule. One cached snapshot serves every nearby actor at the same clock.
 * The one-second look-ahead supplies heading from the actual route, including
 * a freshly loaded traveller with no previous render frame. */
export function createResidentStreetSampler(
  ground: GroundWorld | null | undefined, loaded: LoadedChunk[], origin: SceneOrigin,
): ResidentStreetSampler {
  if (!ground) return () => null;
  const handoffs = collectResidentHandoffIndex(loaded), source = residentRosterIndex(ground.rosters ?? []);
  let lastClock: number | undefined;
  let motions = new Map<string, InteriorOccupantMotion>();
  return (residentKey, clock) => {
    if (lastClock !== clock) {
      const previous = motions;
      motions = new Map(); lastClock = clock;
      const nodes = groundAgentScenePositions(ground, clock);
      const ahead = nodes.some(n => n.moving) ? new Map(groundAgentScenePositions(ground, clock + 1 / 3600)
        .map(n => [residentRenderKey(n.burgId, n.occupantId), n])) : new Map();
      for (const node of nodes) {
        const renderKey = residentRenderKey(node.burgId, node.occupantId), handoff = handoffs.get(renderKey);
        // A reused household head key cannot turn a successor into an older
        // packet's person. Name is an additional guard, never the join itself.
        if (!handoff || source.get(renderKey) !== handoff.stableKey || node.name !== handoff.occupant.name) continue;
        const point = worldToScene(node.xM, node.zM, origin), next = ahead.get(renderKey);
        const dx = next ? next.xM - node.xM : 0, dz = next ? next.zM - node.zM : 0;
        motions.set(handoff.stableKey, {position: {x: point.x, y: node.surfaceY, z: point.z}, moving: node.moving,
          rotationY: Math.hypot(dx, dz) > 1e-8 ? Math.atan2(dx, dz) : previous.get(handoff.stableKey)?.rotationY ?? 0});
      }
    }
    return motions.get(residentKey) ?? null;
  };
}

/** The source slab fields needed for a local station support query. */
type FloorSupport = {x:number;z:number;w:number;d:number;h:number;baseY?:number};

/** Source floor levels are ordered around the ground slab, whose base is zero.
 * Resolve once per immutable site packet, never by a hard-coded storey height.
 * Furniture, ceilings and entry stairs cannot stand in for a room floor. */
function sourceFloorLevels(parts: NonNullable<LoadedChunk['bundle']['sites'][number]['parts']>): ReadonlyMap<number, readonly FloorSupport[]> {
  const floors=parts.filter(part=>part.walkSurface==='floor');
  const bases=[...new Set(floors.map(part=>part.baseY??0))].sort((a,b)=>a-b);
  const ground=bases.findIndex(base=>Math.abs(base)<1e-7);
  if(ground<0)return new Map();
  return new Map(bases.map((base,index)=>[index-ground,floors.filter(part=>(part.baseY??0)===base)]));
}

/** The interior envelope, in PLAN FEET (blueprint frame) — the station frame. */
interface OccupantFrame {
  widthFt: number;
  depthFt: number;
  /** Stable plot origin when the current envelope grew asymmetrically. */
  originXFt?: number;
  originYFt?: number;
  /** Exact slab boxes in this station's local frame; older packets may lack them. */
  floorLevels?: ReadonlyMap<number, readonly FloorSupport[]>;
}

/** Plan-feet to meters, used only for the canonical frontage-door anchor. */
const FEET_TO_METERS = 0.3048;

/**
 * Resolve the center of the canonical street-facing wall into scene space.
 * The street router uses the same wall-center door convention.
 */
export function occupantDoorScenePosition(
  frame: OccupantFrame,
  placement: SitePlacement,
  surfaceY: number,
): { x: number; y: number; z: number } {
  const door = siteLocalToScene(
    0,
    -(frame.depthFt * FEET_TO_METERS) / 2,
    placement,
  );
  return { x: door.x, y: surfaceY, z: door.z };
}

/**
 * Resolve one occupant's scene position at `hour`, or null when the member is
 * OUT that hour. The station is plan feet in the blueprint frame; map it to
 * site-local meters (centered), project through the shared placement transform,
 * and stand on the matching source floor slab. Legacy packets without that
 * support keep their nominal storey placement. Units are meters throughout.
 */
export function occupantScenePosition(
  occ: BuildingOccupantRender,
  hour: number,
  frame: OccupantFrame,
  placement: SitePlacement,
  surfaceY: number,
): { x: number; y: number; z: number } | null {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  const st = occ.stationsByHour[h];
  if (!st) return null;
  const local = planFeetToSiteLocal(
    st.xFt,
    st.yFt,
    frame.widthFt,
    frame.depthFt,
    frame.originXFt,
    frame.originYFt,
  );
  const { x, z } = siteLocalToScene(local.x, local.z, placement);
  const floor=frame.floorLevels?.get(st.level)?.find(part=>
    Math.abs(local.x-part.x)<=part.w/2+1e-7 && Math.abs(local.z-part.z)<=part.d/2+1e-7);
  // Stand on the actual slab top, not its base. Retain the historical placement
  // when no matching source slab exists; that missing support stays unqualified.
  // This fixes activity stations, not the still-straight indoor/stair routes.
  const height=floor ? (floor.baseY??0)+floor.h : st.level*STOREY_M;
  return { x, y: surfaceY + height, z };
}

/** The per-frame placement and gait state for one visible resident. */
export interface InteriorOccupantMotion {
  position: { x: number; y: number; z: number };
  rotationY: number;
  moving: boolean;
}

/**
 * Resolve continuous movement at a fractional game clock.
 *
 * The schedule says where a resident belongs during each integer hour. When
 * that destination differs from the previous hour, this resolver walks a
 * straight line from the old in-house station at normal walking speed,
 * then holds at the destination. The final/first travel seconds around an OUT slot
 * uses the canonical router door so street routing owns exterior travel while
 * both layers exchange the resident at one physical endpoint.
 */
export function occupantMotionAtClock(
  occ: BuildingOccupantRender,
  clock: number,
  frame: OccupantFrame,
  placement: SitePlacement,
  surfaceY: number,
  doorPosition?: { x: number; y: number; z: number },
): InteriorOccupantMotion | null {
  // Wrap the live clock so midnight and negative capture values use the same
  // 24-hour station table as the integer resolver.
  const wrapped = ((clock % 24) + 24) % 24;
  const hour = Math.floor(wrapped);
  const fraction = wrapped - hour;
  const arrival = occ.interiorArrivalDelayByHour?.[hour] ?? 0;
  if (fraction < arrival) return null;
  const destination = occupantScenePosition(
    occ,
    hour,
    frame,
    placement,
    surfaceY,
  );
  if (!destination) return null;

  // During the final walking seconds before an OUT slot, the interior owner walks
  // from its last room station to the shared frontage door. At the next exact
  // hour the street owner begins at that same door.
  const next = occupantScenePosition(
    occ,
    hour + 1,
    frame,
    placement,
    surfaceY,
  );
  const leavingHours = doorPosition ? interiorTravelHours(destination, doorPosition) : 0;
  if (!next && doorPosition && leavingHours > 0 && fraction >= 1 - leavingHours) {
    const progress =
      (fraction - (1 - leavingHours)) / leavingHours;
    const dx = doorPosition.x - destination.x;
    const dy = doorPosition.y - destination.y;
    const dz = doorPosition.z - destination.z;
    return {
      position: {
        x: destination.x + dx * progress,
        y: destination.y + dy * progress,
        z: destination.z + dz * progress,
      },
      rotationY: Math.atan2(dx, dz),
      moving: Math.hypot(dx, dy, dz) >= 0.001,
    };
  }

  // A resident coming in from OUT has no baked interior doorway route. Keep
  // the truthful destination placement rather than drawing a fabricated line
  // through an exterior wall.
  const previous = occupantScenePosition(
    occ,
    hour - 1,
    frame,
    placement,
    surfaceY,
  );
  const enteringHours = doorPosition ? interiorTravelHours(doorPosition, destination) : 0;
  if (!previous && doorPosition && enteringHours > 0 && fraction < arrival + enteringHours) {
    // The street owner ended at the frontage door. When HOME begins, the
    // interior owner starts there and walks to its actual room station.
    const progress = (fraction - arrival) / enteringHours;
    const dx = destination.x - doorPosition.x;
    const dy = destination.y - doorPosition.y;
    const dz = destination.z - doorPosition.z;
    return {
      position: {
        x: doorPosition.x + dx * progress,
        y: doorPosition.y + dy * progress,
        z: doorPosition.z + dz * progress,
      },
      rotationY: Math.atan2(dx, dz),
      moving: Math.hypot(dx, dy, dz) >= 0.001,
    };
  }
  const movingHours = previous ? interiorTravelHours(previous, destination) : 0;
  if (!previous || fraction >= movingHours) {
    return {
      position: destination,
      rotationY: placement.rotationY,
      moving: false,
    };
  }

  // Identical consecutive station slots mean the activity continued in place;
  // do not trigger a walk gait just because the integer schedule advanced.
  const dx = destination.x - previous.x;
  const dy = destination.y - previous.y;
  const dz = destination.z - previous.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 0.001) {
    return {
      position: destination,
      rotationY: placement.rotationY,
      moving: false,
    };
  }

  // Indoor distance sets walking time. Room-door/stair obstacle routing is
  // still a separate missing behavior: this leg remains a straight segment
  // and must not be treated as verified collision-aware resident navigation.
  const progress = fraction / movingHours;
  return {
    position: {
      x: previous.x + dx * progress,
      y: previous.y + dy * progress,
      z: previous.z + dz * progress,
    },
    rotationY: Math.atan2(dx, dz),
    moving: true,
  };
}

/** A room-to-room walk near the frontage is not permission to operate it.
 * Reuse the actor's measured entry windows, including the street arrival gate. */
export function isInteriorEntryTraversalAtClock(
  occ: BuildingOccupantRender, clock: number, frame: OccupantFrame,
  placement: SitePlacement, surfaceY: number, door: {x: number; y: number; z: number},
): boolean {
  const wrapped = ((clock % 24) + 24) % 24, hour = Math.floor(wrapped), fraction = wrapped - hour;
  const arrival = occ.interiorArrivalDelayByHour?.[hour] ?? 0;
  if (fraction < arrival) return false;
  const destination = occupantScenePosition(occ, hour, frame, placement, surfaceY);
  if (!destination) return false;
  const departing = !occupantScenePosition(occ, hour + 1, frame, placement, surfaceY) &&
    fraction >= 1 - interiorTravelHours(destination, door);
  const arriving = !occupantScenePosition(occ, hour - 1, frame, placement, surfaceY) &&
    fraction < arrival + interiorTravelHours(door, destination);
  return departing || arriving;
}

/** One flattened occupant plus everything needed to place and draw it. */
interface ResidentLocation {
  siteId?: string;
  /** Immutable canonical solids/leaves, shared with the rendered site. */
  parts?: LoadedChunk['bundle']['sites'][number]['parts'];
  occ: BuildingOccupantRender;
  placement: SitePlacement;
  frame: OccupantFrame;
  surfaceY: number;
  /** Shared street/interior transfer point at the frontage door. */
  doorPosition: { x: number; y: number; z: number };
}

/** One persistent body retains all the buildings this resident actually uses. */
interface FlatFigure extends ResidentLocation {
  key: string;
  locations?: ResidentLocation[];
}

/** The present building wins by schedule, never by lexical plot-id order. */
export function residentLocationAtClock(figure: FlatFigure, clock: number): ResidentLocation | null {
  return (figure.locations ?? [figure]).find(location =>
    residentRenderOwnerAtClock(location.occ, clock) === 'interior') ?? null;
}

/**
 * A close-body name chip sourced directly from the baked render packet. It is
 * mounted inside the moving actor group, so the visible name follows the exact
 * body rather than hovering at the building center with every other resident.
 */
export const InteriorOccupantNameplate: React.FC<{
  occupant: BuildingOccupantRender;
  onSelect?: () => void;
  readVisible?: () => boolean;
  readSelectable?: () => boolean;
  readHeight?: () => number | undefined;
}> = ({ occupant, onSelect, readVisible, readSelectable, readHeight }) => {
  const anchorRef = useRef<Group>(null);
  // Html forwards its ref to the DOM; onUpdate supplies its actual Three group.
  const attachAnchor = React.useCallback((group: Group) => {anchorRef.current = group;}, []);
  const labelRef = useRef<HTMLButtonElement | null>(null);
  const attachLabel = React.useCallback((label: HTMLButtonElement | null) => {
    labelRef.current = label;
    if (!label) return;
    // Drei's HTML sits inside the canvas event source. Stop native pointer
    // events at the label before the ground plane can also request a walk.
    // Click still reaches React so the accessible button opens the profile.
    // A ref callback also handles Drei's later portal mount; a parent effect
    // can run before the HTML button exists and miss the actual live node.
    label.onpointerdown = event => event.stopPropagation();
    label.onpointerup = event => event.stopPropagation();
  }, []);
  // Three's hidden groups do not hide Drei's DOM labels. Keep absent people
  // out of pointer and keyboard interaction as their schedule changes.
  useFrame(() => {
    // Follow the same measured body used for physical admission. A fixed tall
    // anchor can leave the viewport while a shorter resident remains visible.
    // The legacy height is only a fallback until that body reports its bounds.
    const height = readHeight?.();
    if (anchorRef.current) anchorRef.current.position.y = height !== undefined && Number.isFinite(height) && height > 0
      ? height + .15 : 2.15;
    const label = labelRef.current;
    if (!label) return;
    if (readVisible) label.hidden = !readVisible();
    // The body owner supplies current contact admission. A visible, source-
    // sampled traveller can be met; an absent or hidden continuity group cannot.
    const selectable = !readSelectable || readSelectable();
    label.disabled = !onSelect || !selectable;
    label.setAttribute('aria-label', selectable ? `Meet ${occupant.name}` : occupant.name);
    label.style.cursor = onSelect && selectable ? 'pointer' : 'default';
  });
  return (
  <Html onUpdate={attachAnchor} center position={[0, 2.15, 0]} zIndexRange={[35, 0]}>
    <button
      type="button"
      ref={attachLabel}
      hidden={readVisible ? true : undefined}
      disabled={!onSelect}
      aria-label={`Meet ${occupant.name}`}
      onClick={(event) => {
        event.stopPropagation();
        if (readSelectable && !readSelectable()) return;
        onSelect?.();
      }}
      data-testid={`interior-occupant-name-${occupant.id}`}
      data-household-member-id={occupant.householdMemberId}
      // Shared button states (weight, focus ring, dimmed while not selectable).
      // The inline style below keeps the small dark name-tag shape and colors.
      className={`${BTN_BASE} ${BTN_GHOST}`}
      style={{
        pointerEvents: onSelect ? "auto" : "none",
        cursor: onSelect ? 'pointer' : 'default',
        userSelect: "none",
        whiteSpace: "nowrap",
        color: "white",
        fontSize: "11px",
        fontFamily: "Outfit, sans-serif",
        padding: "1px 5px",
        borderRadius: "4px",
        background: "rgba(9, 19, 28, 0.82)",
        border: "1px solid rgba(148, 163, 184, 0.55)",
      }}
    >
      {occupant.name}
    </button>
  </Html>
  );
};

/**
 * Apply one ownership frame to the persistent R3F group. Tests exercise this
 * exact mutation boundary to prove visibility, transforms, and gait reset.
 */
export function applyInteriorOccupantMotion(
  group: Pick<Group, "visible" | "position" | "rotation">,
  motionRef: React.MutableRefObject<{ moving: boolean }>,
  motion: InteriorOccupantMotion | null,
): void {
  group.visible = motion !== null;
  motionRef.current.moving = motion?.moving ?? false;
  if (!motion) return;
  group.position.set(motion.position.x, motion.position.y, motion.position.z);
  group.rotation.set(0, motion.rotationY, 0);
}

/**
 * Apply one actor frame after consulting the canonical cross-layer owner. The
 * mounted group survives every hour, but only the owning layer may make its
 * resident body visible.
 */
export function applyInteriorResidentFrame(
  group: Pick<Group, "visible" | "position" | "rotation">,
  motionRef: React.MutableRefObject<{ moving: boolean }>,
  occupant: BuildingOccupantRender,
  clock: number,
  motion: InteriorOccupantMotion | null,
): void {
  applyInteriorOccupantMotion(
    group,
    motionRef,
    residentRenderOwnerAtClock(occupant, clock) === "interior" ? motion : null,
  );
}

/**
 * Read the same capture/scrub clock source as GroundAgents on every frame.
 * The shared ref remains the normal live-game channel, while the direct
 * override prevents React/context scheduling from leaving an interior body on
 * the previous hour after the street layer has already claimed that resident.
 */
export function readInteriorActorClock(
  clockRef: React.MutableRefObject<number>,
): number {
  return (
    (window as typeof window & { __wfAgentClock?: number }).__wfAgentClock ??
    clockRef.current
  );
}

/**
 * One continuously moving resident. This small child component owns the R3F
 * frame hook that updates its outer group, while OccupantFigure keeps ownership
 * of the generated body and reads the shared gait signal.
 */
export const InteriorOccupantActor: React.FC<{
  figure: FlatFigure;
  clockRef: React.MutableRefObject<number>;
  streetMotion?: ResidentStreetSampler;
  ground?: GroundWorld | null;
  walkingSurfaces?: GroundWalkSurfaces;
  planningBudget?: ResidentPlanningFrameBudget;
}> = ({ figure, clockRef, streetMotion, ground, walkingSurfaces, planningBudget }) => {
  const groupRef = useRef<Group>(null);
  const motionRef = useRef({ moving: false });
  const bodyHovered = useRef(false);
  const interaction = React.useContext(GroundFurnishingContext);
  const personalSpace=React.useContext(ActorPersonalSpaceContext),bodyKey='resident:'+figure.key;
  const personalBody=useRef<{radiusM:number;heightM:number;footprint?:ActorFootprint}|null>(null),yielded=useRef<ActorPoint|null>(null);
  const yieldRoute=useRef<ActorYieldRouteState>({});
  const interiorRoute=useRef<ResidentInteriorRouteState>({});
  useLayoutEffect(()=>{yieldRoute.current={};},[interaction?.openDoors]);
  const receiveBody=React.useCallback((body:{radiusM:number;heightM:number;footprint?:ActorFootprint})=>{personalBody.current=body;},[]);
  useLayoutEffect(()=>()=>{personalSpace?.delete(bodyKey);},[personalSpace,bodyKey]);
  const readPick: ReadResidentPick = () => {
    const group = groupRef.current, memberId = figure.occ.householdMemberId;
    const clock = readInteriorActorClock(clockRef);
    const location = residentLocationAtClock(figure, clock);
    // A person walking between their real buildings remains the same contact.
    // Only the current street sampler may admit an OUT body; a mounted hidden
    // placeholder or an absent route cannot turn into a remote conversation.
    const street = !location ? streetMotion?.(figure.key, clock) : null;
    const source = location ?? (street ? figure : null);
    if (!group?.visible || !interaction || !memberId || !source?.siteId || !Number.isFinite(clock)) return null;
    if (street && ![street.position.x, street.position.y, street.position.z].every(Number.isFinite)) return null;
    if (![group.position.x, group.position.y, group.position.z, interaction.origin.x, interaction.origin.z].every(Number.isFinite)) return null;
    return {siteId: source.siteId, memberId, ...(street ? {streetOwned: true} : {}),
      pose: {xM: group.position.x + interaction.origin.x, zM: group.position.z + interaction.origin.z, yM: group.position.y},
      transform: {groupX: source.placement.gx + interaction.origin.x, groupZ: source.placement.gz + interaction.origin.z,
        rotationY: source.placement.rotationY, doorZSign: source.placement.doorZSign, surfaceY: source.surfaceY},
      activity: source.occ.stationsByHour[((Math.floor(clock) % 24) + 24) % 24]?.activity ?? 'out'};
  };
  const select = interaction?.onResident && figure.occ.householdMemberId
    ? () => interaction.onResident!(readPick) : undefined;
  const bodySelectable = Boolean(select);
  useLayoutEffect(() => () => {
    // A disappearing or no-longer-interactive person must not leave a pointer
    // cursor behind after its body stops owning this hover.
    if (bodyHovered.current) {
      bodyHovered.current = false;
      if (document.body.style.cursor === 'pointer') document.body.style.cursor = 'auto';
    }
  }, [bodySelectable]);

  const cancelPlanning=()=>cancelResidentInteriorPlanning(bodyKey,interiorRoute.current,planningBudget);
  useLayoutEffect(()=>()=>{cancelResidentInteriorPlanning(bodyKey,interiorRoute.current,planningBudget);planningBudget?.forget(bodyKey);},[bodyKey,planningBudget]);
  useFrame((frame, delta) => {
    const sampledClock = readInteriorActorClock(clockRef);
    const location = residentLocationAtClock(figure, sampledClock);
    let motion = location ? occupantMotionAtClock(
      location.occ, sampledClock, location.frame, location.placement,
      location.surfaceY, location.doorPosition,
    ) : streetMotion?.(figure.key, sampledClock) ?? null;
    if(location && residentRenderOwnerAtClock(location.occ,sampledClock)!=='interior')motion=null;
    const group=groupRef.current;
    if(!group){cancelPlanning();return;}
    const shape=personalBody.current;
    const profiled=location?.occ.privateDoorAccess?.profile==='private-room-leaves-v1';
    if(!profiled)cancelPlanning();
    if(profiled&&location){
      const accepted=personalSpace?.get(bodyKey);
      // Opt-in physical movement starts at an existing accepted body whenever
      // one exists. A changed clock/source never snaps it to a new station.
      const destination=occupantScenePosition(location.occ,Math.floor(sampledClock),location.frame,location.placement,location.surfaceY);
      const source=ground?.rosters?.find(r=>r.burgId===location.occ.burgId)?.occupants.find(o=>o.id===location.occ.id);
      const permission=location.occ.privateDoorAccess!;
      const floors=new Map([...location.frame.floorLevels??[]].map(([level,parts])=>[level,location.surfaceY+(parts[0].baseY??0)+parts[0].h]));
      const transform={groupX:location.placement.gx+(interaction?.origin.x??0),groupZ:location.placement.gz+(interaction?.origin.z??0),
        rotationY:location.placement.rotationY,doorZSign:location.placement.doorZSign,surfaceY:location.surfaceY};
      const region=residentRouteRegion(permission,location.occ.householdMemberId??'',transform,{x:location.frame.originXFt??location.frame.widthFt/2,y:location.frame.originYFt??location.frame.depthFt/2},floors);
      const sourceMatches=source&&source.name===location.occ.name&&source.householdMemberId===permission.memberId
        &&location.siteId==='wf-plot-'+location.occ.burgId+'-'+source.homePlotId;
      if(shape&&destination&&ground&&interaction&&personalSpace&&region&&sourceMatches){
        if(shape.footprint)shape.footprint={...shape.footprint,yawRad:group.rotation.y};
        const from=accepted??(group.visible?{xM:group.position.x+interaction.origin.x,yM:group.position.y,zM:group.position.z+interaction.origin.z}
          :{xM:destination.x+interaction.origin.x,yM:destination.y,zM:destination.z+interaction.origin.z});
        const hour=((Math.floor(sampledClock)%24)+24)%24,current=location.occ.stationsByHour[hour],prior=location.occ.stationsByHour[(hour+23)%24];
        const doors=(location.parts??[]).filter(part=>part.door&&permission.doors.some(claim=>claim.id===part.door!.id&&claim.level===part.door!.level
          &&claim.roomId===part.door!.privateRoomId&&(Boolean(current&&current.level===claim.level&&current.roomId===claim.roomId)!==Boolean(prior&&prior.level===claim.level&&prior.roomId===claim.roomId))))
          .filter(part=>!interaction.openDoors?.has(siteDoorKey(location.siteId!,part)))
          .filter(part=>{
            if(Math.abs(from.yM-transform.surfaceY-(part.baseY??0))>.08)return true;
            const local=worldOffsetToSiteLocal(from.xM-transform.groupX,from.zM-transform.groupZ,transform.rotationY);
            const target=worldOffsetToSiteLocal(destination.x+interaction.origin.x-transform.groupX,destination.z+interaction.origin.z-transform.groupZ,transform.rotationY);
            // Once the body has crossed, closing the leaf behind it must not
            // send it back to the doorway for the rest of the schedule hour.
            return part.door!.axis==='x'?(local.lz*-transform.doorZSign-part.z)*(target.lz*-transform.doorZSign-part.z)<0:(local.lx-part.x)*(target.lx-part.x)<0;
          }).map(part=>({part,transform}));
        const step=advanceResidentInteriorRoute(from,{xM:destination.x+interaction.origin.x,yM:destination.y,zM:destination.z+interaction.origin.z},delta,{ground,key:bodyKey,body:{...from,...shape},bodies:personalSpace,
          query:{bodyRadiusM:residentRouteRadius({...from,...shape}),standingHeightM:shape.heightM,doors:interaction.openDoors??new Set(),surfaces:walkingSurfaces,acceptsFoot:region,
            grid:{originXM:transform.groupX,originZM:transform.groupZ,yawRad:transform.rotationY,stepM:.1524},maxNodes:3000,coarseSearch:{stepMultiplier:4,maxNodes:128}},policyToken:location,doors,planningFrame:planningBudget?{id:frame.clock.elapsedTime,budget:planningBudget}:undefined},interiorRoute.current);
        motion={position:{x:step.position.xM-interaction.origin.x,y:step.position.yM,z:step.position.zM-interaction.origin.z},rotationY:step.rotationY,moving:step.moving};
        personalSpace.set(bodyKey,{...step.position,...shape,footprint:shape.footprint?{...shape.footprint,yawRad:step.rotationY}:undefined});
      }else if(interaction){
        cancelPlanning();
        // Missing movement authority must not erase a genuine household
        // member. Keep its body visible and in the all-body ledger, holding
        // accepted feet across clock changes; do not borrow another's claim.
        const held=heldResidentFoot(accepted,group.visible?{xM:group.position.x+interaction.origin.x,yM:group.position.y,zM:group.position.z+interaction.origin.z}:null,
          interiorRoute.current.expected,destination?{xM:destination.x+interaction.origin.x,yM:destination.y,zM:destination.z+interaction.origin.z}:null);
        if(held){
          interiorRoute.current.expected={...held};
          motion={position:{x:held.xM-interaction.origin.x,y:held.yM,z:held.zM-interaction.origin.z},rotationY:group.rotation.y,moving:false};
          if(shape&&personalSpace)personalSpace.set(bodyKey,{...held,...shape,footprint:shape.footprint?{...shape.footprint,yawRad:group.rotation.y}:undefined});
        }else motion=null;
      }else {cancelPlanning();motion=group.visible?{position:{x:group.position.x,y:group.position.y,z:group.position.z},rotationY:group.rotation.y,moving:false}:destination?{position:destination,rotationY:location.placement.rotationY,moving:false}:null;}
    }
    if(!profiled&&personalSpace&&motion&&shape&&ground&&interaction){
      const desired={xM:motion.position.x+interaction.origin.x,yM:motion.position.y,zM:motion.position.z+interaction.origin.z};
      let from=yielded.current ?? personalSpace.get(bodyKey) ?? desired;
      // Source ownership still owns floor changes. A local yield never carries
      // a stale offset across a storey or invents a stair traversal.
      if(Math.abs(from.yM-desired.yM)>.2){yielded.current=null;yieldRoute.current={};from=desired;}
      if(shape.footprint)shape.footprint={...shape.footprint,yawRad:group.rotation.y};
      const body={...from,...shape}, reservation=actorCourtesySpace(personalSpace);
      // A person stopped beside another yielding resident makes room before
      // bodies touch. The physical map below still prevents a new collision.
      const underPressure=actorSpaceOverlaps(from,bodyKey,body,reservation);
      const blocked=clipActorStep(from,desired,bodyKey,body,reservation).blocked;
      if(yielded.current||blocked||actorSpaceOverlaps(desired,bodyKey,body,reservation)){
        const maxDrift=Math.max(2,Math.hypot(from.xM-desired.xM,from.zM-desired.zM));
        const probe=(point:ActorPoint,start:ActorPoint=from,budgetM=INTERIOR_WALK_METERS_PER_SECOND*Math.min(.1,Math.max(0,delta))):ActorPoint|null=>{
          if(Math.hypot(point.xM-desired.xM,point.zM-desired.zM)>maxDrift+1e-6)return null;
          if(location){
            const level=location.occ.stationsByHour[((Math.floor(sampledClock)%24)+24)%24]?.level;
            const floors=level===undefined?undefined:location.frame.floorLevels?.get(level);
            const local=worldOffsetToSiteLocal(point.xM-interaction.origin.x-location.placement.gx,point.zM-interaction.origin.z-location.placement.gz,location.placement.rotationY);
            const z=local.lz*-location.placement.doorZSign;
            // Indoor yielding stays on this building's actual source slab;
            // adjacent terrain is not a second room or an outdoor escape.
            if(!floors?.some(f=>Math.abs(local.lx-f.x)<=f.w/2&&Math.abs(z-f.z)<=f.d/2))return null;
          }
          const walk=resolveGroundWaterWalk(ground,start,point,budgetM,{standingHeightM:shape.heightM},interaction.openDoors,walkingSurfaces);
          return walk.water.mode==='dry'&&Math.abs(walk.yM-start.yM)<=.08?{xM:walk.xM,yM:walk.yM,zM:walk.zM}:null;
        };
        const reached=yieldActorStep(from,desired,bodyKey,body,reservation,INTERIOR_WALK_METERS_PER_SECOND*Math.min(.1,Math.max(0,delta)),probe,personalSpace,yieldRoute.current);
        const dx=reached.xM-from.xM,dz=reached.zM-from.zM,moving=Math.hypot(dx,dz)>1e-5;
        yielded.current=Math.hypot(reached.xM-desired.xM,reached.zM-desired.zM)>.015?reached:null;
        motion={...motion,position:{x:reached.xM-interaction.origin.x,y:reached.yM,z:reached.zM-interaction.origin.z},
          // Keep the measured facing while following a planned sidestep. Every
          // segment is still checked against current bodies and source solids.
          rotationY:yieldRoute.current.following?group.rotation.y:moving?Math.atan2(dx,dz):motion.rotationY,moving};
      }
      if(shape.footprint){
        const feet={xM:motion.position.x+interaction.origin.x,yM:motion.position.y,zM:motion.position.z+interaction.origin.z};
        // Translating safely does not grant room to swing a long body. Keep
        // the current facing for a close sidestep when the turn is obstructed.
        if(!canActorTurn(feet,bodyKey,{...feet,...shape},motion.rotationY,personalSpace))motion={...motion,rotationY:group.rotation.y};
        shape.footprint={...shape.footprint,yawRad:motion.rotationY};
      }
      personalSpace.set(bodyKey,{xM:motion.position.x+interaction.origin.x,yM:motion.position.y,zM:motion.position.z+interaction.origin.z,...shape,yielding:underPressure||yielded.current!==null});
    } else if(!profiled&&personalSpace){personalSpace.delete(bodyKey);yielded.current=null;yieldRoute.current={};}
    applyInteriorOccupantMotion(group,motionRef,motion);
  });


  return (
    // Preserve the stable person key on the persistent Three group so scene
    // lifecycle checks can audit visibility without guessing body geometry.
    <group
      ref={groupRef}
      name={`residentInterior:${figure.key}`}
      visible={false}
      onPointerOver={select ? (event: ThreeEvent<PointerEvent>) => {
        // This same resident consumes the primary click. Stop the hover at
        // its body too, so a hearth behind it cannot advertise the wrong action.
        // R3F also clears farther hovered objects when propagation stops.
        if (streetMotion && !readPick()) return;
        event.stopPropagation();
        bodyHovered.current = true;
        document.body.style.cursor = 'pointer';
      } : undefined}
      onPointerOut={select ? () => {
        if (!bodyHovered.current) return;
        bodyHovered.current = false;
        if (document.body.style.cursor === 'pointer') document.body.style.cursor = 'auto';
      } : undefined}
      onPointerDown={select ? (event: ThreeEvent<PointerEvent>) => {
        // Camera gestures may start over a person; they must not begin a meeting.
        if (event.button !== 0 || (streetMotion && !readPick())) return;
        event.stopPropagation(); select();
      } : undefined}
    >
      <OccupantFigure
        occupantId={figure.occ.id}
        ageBand={figure.occ.ageBand}
        race={figure.occ.race}
        position={[0, 0, 0]}
        motionRef={motionRef}
        onBodySpace={receiveBody}
      />
      <InteriorOccupantNameplate occupant={figure.occ} onSelect={select} readVisible={() => groupRef.current?.visible ?? false}
        readHeight={() => personalBody.current?.heightM}
        readSelectable={streetMotion ? () => readPick() !== null : undefined} />
    </group>
  );
};

/**
 * Flatten the loaded chunks into one entry per baked occupant, in scene space.
 * Mirrors InteriorLights.collectInteriorLighting: chunk origin → scene, then the
 * site's (localX, localZ) added to build each building group's placement.
 */
export function collectInteriorOccupants(
  loaded: LoadedChunk[],
  origin: SceneOrigin,
): FlatFigure[] {
  const out: FlatFigure[] = [];
  const figuresByResident = new Map<string, FlatFigure>();
  // Sort before claiming duplicate member keys so chunk stream arrival order
  // cannot change which authored packet wins during deterministic replay.
  const orderedChunks = [...loaded].sort(
    (left, right) => left.cx - right.cx || left.cy - right.cy,
  );
  for (const chunk of orderedChunks) {
    const o = chunkOriginWorld(chunk.cx, chunk.cy);
    const chunkScene = worldToScene(o.x, o.y, origin); // chunk-local frame origin
    const orderedSites = [...chunk.bundle.sites].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    for (const s of orderedSites) {
      if (!s.occupants || s.occupants.length === 0) continue;
      const placement: SitePlacement = {
        gx: chunkScene.x + s.localX,
        gz: chunkScene.z + s.localZ,
        rotationY: s.rotationY ?? 0,
        doorZSign: s.doorZSign ?? -1,
      };
      const frame: OccupantFrame = {
        widthFt: s.interiorWidthFt ?? 0,
        depthFt: s.interiorDepthFt ?? 0,
        originXFt: s.interiorOriginXFt,
        originYFt: s.interiorOriginYFt,
        floorLevels: sourceFloorLevels(s.parts??[]),
      };
      for (const occ of s.occupants) {
        const stableResidentKey =
          occ.burgId !== undefined && occ.householdMemberId !== undefined
            ? residentIdentityKey(occ.burgId, occ.householdMemberId)
            : undefined;
        // A household may be referenced by more than one building packet.
        // Keep one deterministic body for its stable person identity.
        const existing = stableResidentKey ? figuresByResident.get(stableResidentKey) : undefined;
        const figure: FlatFigure = {
          siteId: s.id,
          parts: s.parts,
          key: stableResidentKey ?? `${s.localX}:${s.localZ}:${occ.id}`,
          occ,
          placement,
          frame,
          surfaceY: s.surfaceY,
          // Prefer the exact endpoint baked by frontDoorForPlot. Older packets
          // keep the matching wall-center convention as a compatibility tail.
          doorPosition:
            s.frontDoorOffsetX !== undefined &&
            s.frontDoorOffsetZ !== undefined
              ? {
                  x: placement.gx + s.frontDoorOffsetX,
                  y: s.surfaceY,
                  z: placement.gz + s.frontDoorOffsetZ,
                }
              : occupantDoorScenePosition(frame, placement, s.surfaceY),
        };
        if (existing) {
          // Retain a second destination, not a second body. Repeated chunk
          // copies of the same building cannot add another location.
          existing.locations ??= [{...existing}];
          if (!existing.locations.some(location => location.siteId === figure.siteId)) existing.locations.push(figure);
        } else {
          if (stableResidentKey) figuresByResident.set(stableResidentKey, figure);
          out.push(figure);
        }
      }
    }
  }
  return out;
}

/**
 * Live interior-occupant layer. Re-flattens the occupant set only when the
 * loaded-chunk set changes; each mounted actor samples the fractional clock on
 * render frames. Members OUT this hour stay mounted but their group is hidden.
 */
const InteriorOccupants: React.FC<{
  loaded: LoadedChunk[];
  origin: SceneOrigin;
  ground?: GroundWorld | null;
  bodyOwners?: React.MutableRefObject<ReadonlySet<string>>;
  walkingSurfaces?: GroundWalkSurfaces;
}> = ({ loaded, origin, ground, bodyOwners, walkingSurfaces }) => {
  // The mutable clock drives both body-budget ownership and per-frame motion
  // without waiting for an integer-hour React context render.
  const clockRef = useInteriorClockRef();
  // Nearby people share a cooperative planning allowance for each render
  // frame. A separate allowance per person would multiply camera stalls.
  const planningBudget=useMemo(()=>createResidentPlanningFrameBudget(),[]);
  // Static-per-chunk-set figure list (no per-frame rebuild). The key changes
  // only when chunks stream in/out; origin is frozen for the session.
  const figures = useMemo(
    () => collectInteriorOccupants(loaded, origin),
    // A new immutable packet array can refresh a saved person without changing
    // chunk coordinates. Do not retain an older figure collection in that case.
    [loaded, origin],
  );
  const streetMotion = useMemo(() => createResidentStreetSampler(ground, loaded, origin), [ground, loaded, origin]);
  // A coarse humanoid-sized sphere is only a detail-budget hint. Real body
  // bounds, source motion, walls and contact admission remain authoritative.
  const bodyView = useMemo(() => ({frustum: new Frustum(), matrix: new Matrix4(),
    sphere: new Sphere(new Vector3(), 1.5)}), []);

  // Camera-distance gate, ticked at 2 Hz with enter/exit hysteresis. Keyed on
  // the BUILDING position (stable across hours) so the eligible set doesn't
  // churn as members move between stations.
  const [nearKeys, setNearKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  useLayoutEffect(() => {
    if (!bodyOwners) return;
    bodyOwners.current = nearKeys;
    return () => { if (bodyOwners.current === nearKeys) bodyOwners.current = new Set(); };
  }, [bodyOwners, nearKeys]);
  const sinceCheck = useRef(1);
  useFrame(({ camera }, delta) => {
    sinceCheck.current += delta;
    if (sinceCheck.current < 0.5) return;
    sinceCheck.current = 0;
    bodyView.frustum.setFromProjectionMatrix(
      bodyView.matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      camera.coordinateSystem, camera.reversedDepth,
    );
    setNearKeys((prev) => {
      // Resolve the current-hour station before spending a live-body slot. A
      // resident who is OUT should not crowd out someone actually visible in a
      // nearby room.
      const candidates: InteriorBodyCandidate[] = [];
      const sampledClock = readInteriorActorClock(clockRef);
      for (const f of figures) {
        const location = residentLocationAtClock(f, sampledClock);
        const motion = location ? occupantMotionAtClock(
          location.occ,
          sampledClock,
          location.frame,
          location.placement,
          location.surfaceY,
          location.doorPosition,
        ) : (bodyOwners ? streetMotion(f.key, sampledClock) : null);
        const pos = motion?.position ?? f.doorPosition;
        bodyView.sphere.center.set(pos.x, pos.y + 1, pos.z);
        // OUT actors stay mounted at their door for lifecycle continuity; the
        // per-frame owner decision still keeps their group invisible.
        candidates.push({
          key: f.key,
          ...pos,
          interiorOwned: motion !== null,
          moving: motion?.moving,
          inView: bodyView.frustum.intersectsSphere(bodyView.sphere),
        });
      }
      const next = selectInteriorBodyKeys(candidates, camera.position, prev);

      // Preserve the Set object when membership is unchanged. This prevents a
      // 2 Hz distance check from causing an otherwise identical React render.
      const changed =
        next.size !== prev.size || [...next].some((key) => !prev.has(key));
      return changed ? next : prev;
    });
  });

  if (figures.length === 0) return null;

  return (
    <>
      {figures.map((f) => {
        if (!nearKeys.has(f.key)) return null; // beyond body radius
        return (
          <InteriorOccupantActor key={f.key} figure={f} clockRef={clockRef} streetMotion={bodyOwners ? streetMotion : undefined} ground={ground} walkingSurfaces={walkingSurfaces} planningBudget={planningBudget} />
        );
      })}
    </>
  );
};

export default InteriorOccupants;
