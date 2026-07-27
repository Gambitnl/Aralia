// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 21:38:14
 * Dependents: components/World3D/GroundAgents.tsx, components/World3D/World3DScene.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
 * shared OccupantFigure with a matching walk gait. Nothing here re-meshes a
 * chunk or touches the streaming worker; the flattened figure list is memoized
 * on the loaded-chunk set and only lightweight group transforms update per frame.
 *
 * Generated soft bodies are deliberately a close-interior detail, not a whole-
 * town layer. The nearby selector keeps only the nearest bounded set alive so
 * an overview cannot accidentally polygonize dozens of unseen residents.
 *
 * Placement uses the SAME shared transform SiteBuilding and InteriorLights use
 * (planFeetToSiteLocal → siteLocalToScene), so a figure can never drift from the
 * shell it stands in. Consecutive in-house stations now use the same first-
 * half-hour travel convention as street agents, so a clock scrub shows a real
 * walk instead of the original v1 station snap.
 */
import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Group } from "three";
import type {
  BuildingOccupantRender,
  LoadedChunk,
} from "@/systems/world3d/types";
import { chunkOriginWorld } from "@/systems/world3d/coords";
import { worldToScene, type SceneOrigin } from "@/systems/world3d/sceneOrigin";
import {
  siteLocalToScene,
  planFeetToSiteLocal,
  type SitePlacement,
} from "./interiorPlacement";
import OccupantFigure from "./OccupantFigure";
import { useInteriorClockRef } from "./InteriorHourContext";

/**
 * Only villagers near the camera get a full generated body. Interior figures
 * read only through nearby doors and windows, and a whole town holds hundreds
 * of at-home members — mounting them all would cost gigabytes of geometry.
 * Re-evaluated at a slow tick with hysteresis so figures don't pop at the rim.
 */
const BODY_RADIUS_M = 18;
const BODY_RADIUS_EXIT_M = 24;

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
        if (previous.has(entry.candidate.key)) return 0;
        return entry.candidate.interiorOwned !== false ? 1 : 2;
      };
      return priority(a) - priority(b) || a.distance - b.distance;
    })
    .slice(0, Math.max(0, limit));

  return new Set(eligible.map((entry) => entry.candidate.key));
}

/**
 * Meters per storey — matches the shell's `heightM = storeys * 3` baked in
 * groundChunkLoader, so `level * STOREY_M` lifts an upper-floor station onto the
 * right floor.
 */
const STOREY_M = 3;

/**
 * Match the street-agent schedule convention: after an hourly station change,
 * the resident spends the first half of the new hour traveling and the second
 * half settled at the destination. Sharing this rhythm keeps indoor and
 * outdoor schedule motion readable under the same clock scrub.
 */
export const INTERIOR_WALK_FRACTION = 0.5;

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

/** Exactly one layer owns a joined resident at any clock value. */
export type ResidentRenderOwner = "interior" | "street";

/** Resolve ownership from the canonical integer occupancy slot. */
export function residentRenderOwnerAtClock(
  occupant: BuildingOccupantRender,
  clock: number,
): ResidentRenderOwner {
  const hour = ((Math.floor(clock) % 24) + 24) % 24;
  const interiorOwned =
    occupant.interiorOwnedByHour?.[hour] ??
    Boolean(occupant.stationsByHour[hour]);
  return interiorOwned ? "interior" : "street";
}

/** One canonical body packet indexed for the street/interior ownership join. */
export interface ResidentHandoffRecord {
  stableKey: string;
  renderKey: string;
  occupant: BuildingOccupantRender;
}

/**
 * Collect loaded canonical resident packets once. Duplicate building packets
 * keep the first stable member owner rather than multiplying the population.
 */
export function collectResidentHandoffIndex(
  loaded: LoadedChunk[],
): ReadonlyMap<string, ResidentHandoffRecord> {
  const byRenderKey = new Map<string, ResidentHandoffRecord>();
  const claimedStableKeys = new Set<string>();
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
        if (claimedStableKeys.has(stableKey)) continue;
        claimedStableKeys.add(stableKey);
        const renderKey = residentRenderKey(occupant.burgId, occupant.id);
        byRenderKey.set(renderKey, { stableKey, renderKey, occupant });
      }
    }
  }
  return byRenderKey;
}

/** The interior envelope, in PLAN FEET (blueprint frame) — the station frame. */
interface OccupantFrame {
  widthFt: number;
  depthFt: number;
  /** Stable plot origin when the current envelope grew asymmetrically. */
  originXFt?: number;
  originYFt?: number;
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
 * and lift by storey. Units are meters throughout.
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
  return { x, y: surfaceY + st.level * STOREY_M, z };
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
 * straight line from the old in-house station during the first half-hour,
 * then holds at the destination. The final/first half-hour around an OUT slot
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
  const destination = occupantScenePosition(
    occ,
    hour,
    frame,
    placement,
    surfaceY,
  );
  if (!destination) return null;

  // During the final half-hour before an OUT slot, the interior owner walks
  // from its last room station to the shared frontage door. At the next exact
  // hour the street owner begins at that same door.
  const next = occupantScenePosition(
    occ,
    hour + 1,
    frame,
    placement,
    surfaceY,
  );
  if (!next && doorPosition && fraction >= 1 - INTERIOR_WALK_FRACTION) {
    const progress =
      (fraction - (1 - INTERIOR_WALK_FRACTION)) / INTERIOR_WALK_FRACTION;
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
  if (!previous && doorPosition && fraction < INTERIOR_WALK_FRACTION) {
    // The street owner ended at the frontage door. When HOME begins, the
    // interior owner starts there and walks to its actual room station.
    const progress = fraction / INTERIOR_WALK_FRACTION;
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
  if (!previous || fraction >= INTERIOR_WALK_FRACTION) {
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

  // Move at a constant schedule rate across the half-hour window. The baked
  // data has station points but no room-door or stair graph, so this is the
  // smallest honest interpolation and preserves future pathfinding optionality.
  const progress = fraction / INTERIOR_WALK_FRACTION;
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

/** One flattened occupant plus everything needed to place and draw it. */
interface FlatFigure {
  key: string;
  occ: BuildingOccupantRender;
  placement: SitePlacement;
  frame: OccupantFrame;
  surfaceY: number;
  /** Shared street/interior transfer point at the frontage door. */
  doorPosition: { x: number; y: number; z: number };
}

/**
 * A close-body name chip sourced directly from the baked render packet. It is
 * mounted inside the moving actor group, so the visible name follows the exact
 * body rather than hovering at the building center with every other resident.
 */
export const InteriorOccupantNameplate: React.FC<{
  occupant: BuildingOccupantRender;
}> = ({ occupant }) => (
  <Html center position={[0, 2.15, 0]} zIndexRange={[35, 0]}>
    <div
      data-testid={`interior-occupant-name-${occupant.id}`}
      data-household-member-id={occupant.householdMemberId}
      style={{
        pointerEvents: "none",
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
    </div>
  </Html>
);

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
}> = ({ figure, clockRef }) => {
  const groupRef = useRef<Group>(null);
  const motionRef = useRef({ moving: false });

  useFrame(() => {
    const sampledClock = readInteriorActorClock(clockRef);
    const motion = occupantMotionAtClock(
      figure.occ,
      sampledClock,
      figure.frame,
      figure.placement,
      figure.surfaceY,
      figure.doorPosition,
    );
    const group = groupRef.current;
    if (!group) return;
    // The group remains mounted across ownership changes. OUT hides it and
    // clears gait; HOME applies the shared door/room transform in place.
    applyInteriorResidentFrame(
      group,
      motionRef,
      figure.occ,
      sampledClock,
      motion,
    );
  });

  return (
    // Preserve the stable person key on the persistent Three group so scene
    // lifecycle checks can audit visibility without guessing body geometry.
    <group
      ref={groupRef}
      name={`residentInterior:${figure.key}`}
      visible={false}
    >
      <OccupantFigure
        occupantId={figure.occ.id}
        ageBand={figure.occ.ageBand}
        race={figure.occ.race}
        position={[0, 0, 0]}
        motionRef={motionRef}
      />
      <InteriorOccupantNameplate occupant={figure.occ} />
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
  const claimedResidentKeys = new Set<string>();
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
      };
      for (const occ of s.occupants) {
        const stableResidentKey =
          occ.burgId !== undefined && occ.householdMemberId !== undefined
            ? residentIdentityKey(occ.burgId, occ.householdMemberId)
            : undefined;
        // A household may be referenced by more than one building packet.
        // Keep one deterministic body for its stable person identity.
        if (stableResidentKey && claimedResidentKeys.has(stableResidentKey)) {
          continue;
        }
        if (stableResidentKey) claimedResidentKeys.add(stableResidentKey);
        out.push({
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
        });
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
}> = ({ loaded, origin }) => {
  // The mutable clock drives both body-budget ownership and per-frame motion
  // without waiting for an integer-hour React context render.
  const clockRef = useInteriorClockRef();
  // Static-per-chunk-set figure list (no per-frame rebuild). The key changes
  // only when chunks stream in/out; origin is frozen for the session.
  const loadedKey = loaded.map((c) => `${c.cx}|${c.cy}`).join(",");
  const figures = useMemo(
    () => collectInteriorOccupants(loaded, origin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey, origin],
  );

  // Camera-distance gate, ticked at 2 Hz with enter/exit hysteresis. Keyed on
  // the BUILDING position (stable across hours) so the eligible set doesn't
  // churn as members move between stations.
  const [nearKeys, setNearKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const sinceCheck = useRef(1);
  useFrame(({ camera }, delta) => {
    sinceCheck.current += delta;
    if (sinceCheck.current < 0.5) return;
    sinceCheck.current = 0;
    setNearKeys((prev) => {
      // Resolve the current-hour station before spending a live-body slot. A
      // resident who is OUT should not crowd out someone actually visible in a
      // nearby room.
      const candidates: InteriorBodyCandidate[] = [];
      const sampledClock = readInteriorActorClock(clockRef);
      for (const f of figures) {
        const pos = occupantScenePosition(
          f.occ,
          sampledClock,
          f.frame,
          f.placement,
          f.surfaceY,
        );
        // OUT actors stay mounted at their door for lifecycle continuity; the
        // per-frame owner decision still keeps their group invisible.
        candidates.push({
          key: f.key,
          ...(pos ?? f.doorPosition),
          interiorOwned:
            residentRenderOwnerAtClock(f.occ, sampledClock) === "interior",
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
          <InteriorOccupantActor key={f.key} figure={f} clockRef={clockRef} />
        );
      })}
    </>
  );
};

export default InteriorOccupants;
