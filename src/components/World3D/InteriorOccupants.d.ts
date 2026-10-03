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
import React from "react";
import type { Group } from "three";
import type { BuildingOccupantRender, LoadedChunk } from "@/systems/world3d/types";
import { type SceneOrigin } from "@/systems/world3d/sceneOrigin";
import { type SitePlacement } from "./interiorPlacement";
/**
 * A dense block can put many households inside the same radius. Ten live soft
 * bodies still makes a room feel inhabited while bounding both CPU work and
 * geometry memory; farther residents remain represented by the simulation and
 * appear as the player approaches them.
 */
export declare const MAX_LIVE_INTERIOR_BODIES = 10;
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
export declare function selectInteriorBodyKeys(candidates: InteriorBodyCandidate[], camera: {
    x: number;
    y: number;
    z: number;
}, previous: ReadonlySet<string>, limit?: number): ReadonlySet<string>;
/**
 * Match the street-agent schedule convention: after an hourly station change,
 * the resident spends the first half of the new hour traveling and the second
 * half settled at the destination. Sharing this rhythm keeps indoor and
 * outdoor schedule motion readable under the same clock scrub.
 */
export declare const INTERIOR_WALK_FRACTION = 0.5;
/** A globally stable resident identity built from the landed household key. */
export declare function residentIdentityKey(burgId: number, householdMemberId: string): string;
/** The burg-scoped numeric id used to join a roster instance to its body packet. */
export declare function residentRenderKey(burgId: number, occupantId: number): string;
/** Exactly one layer owns a joined resident at any clock value. */
export type ResidentRenderOwner = "interior" | "street";
/** Resolve ownership from the canonical integer occupancy slot. */
export declare function residentRenderOwnerAtClock(occupant: BuildingOccupantRender, clock: number): ResidentRenderOwner;
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
export declare function collectResidentHandoffIndex(loaded: LoadedChunk[]): ReadonlyMap<string, ResidentHandoffRecord>;
/** The interior envelope, in PLAN FEET (blueprint frame) — the station frame. */
interface OccupantFrame {
    widthFt: number;
    depthFt: number;
    /** Stable plot origin when the current envelope grew asymmetrically. */
    originXFt?: number;
    originYFt?: number;
}
/**
 * Resolve the center of the canonical street-facing wall into scene space.
 * The street router uses the same wall-center door convention.
 */
export declare function occupantDoorScenePosition(frame: OccupantFrame, placement: SitePlacement, surfaceY: number): {
    x: number;
    y: number;
    z: number;
};
/**
 * Resolve one occupant's scene position at `hour`, or null when the member is
 * OUT that hour. The station is plan feet in the blueprint frame; map it to
 * site-local meters (centered), project through the shared placement transform,
 * and lift by storey. Units are meters throughout.
 */
export declare function occupantScenePosition(occ: BuildingOccupantRender, hour: number, frame: OccupantFrame, placement: SitePlacement, surfaceY: number): {
    x: number;
    y: number;
    z: number;
} | null;
/** The per-frame placement and gait state for one visible resident. */
export interface InteriorOccupantMotion {
    position: {
        x: number;
        y: number;
        z: number;
    };
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
export declare function occupantMotionAtClock(occ: BuildingOccupantRender, clock: number, frame: OccupantFrame, placement: SitePlacement, surfaceY: number, doorPosition?: {
    x: number;
    y: number;
    z: number;
}): InteriorOccupantMotion | null;
/** One flattened occupant plus everything needed to place and draw it. */
interface FlatFigure {
    key: string;
    occ: BuildingOccupantRender;
    placement: SitePlacement;
    frame: OccupantFrame;
    surfaceY: number;
    /** Shared street/interior transfer point at the frontage door. */
    doorPosition: {
        x: number;
        y: number;
        z: number;
    };
}
/**
 * A close-body name chip sourced directly from the baked render packet. It is
 * mounted inside the moving actor group, so the visible name follows the exact
 * body rather than hovering at the building center with every other resident.
 */
export declare const InteriorOccupantNameplate: React.FC<{
    occupant: BuildingOccupantRender;
}>;
/**
 * Apply one ownership frame to the persistent R3F group. Tests exercise this
 * exact mutation boundary to prove visibility, transforms, and gait reset.
 */
export declare function applyInteriorOccupantMotion(group: Pick<Group, "visible" | "position" | "rotation">, motionRef: React.MutableRefObject<{
    moving: boolean;
}>, motion: InteriorOccupantMotion | null): void;
/**
 * Apply one actor frame after consulting the canonical cross-layer owner. The
 * mounted group survives every hour, but only the owning layer may make its
 * resident body visible.
 */
export declare function applyInteriorResidentFrame(group: Pick<Group, "visible" | "position" | "rotation">, motionRef: React.MutableRefObject<{
    moving: boolean;
}>, occupant: BuildingOccupantRender, clock: number, motion: InteriorOccupantMotion | null): void;
/**
 * Read the same capture/scrub clock source as GroundAgents on every frame.
 * The shared ref remains the normal live-game channel, while the direct
 * override prevents React/context scheduling from leaving an interior body on
 * the previous hour after the street layer has already claimed that resident.
 */
export declare function readInteriorActorClock(clockRef: React.MutableRefObject<number>): number;
/**
 * One continuously moving resident. This small child component owns the R3F
 * frame hook that updates its outer group, while OccupantFigure keeps ownership
 * of the generated body and reads the shared gait signal.
 */
export declare const InteriorOccupantActor: React.FC<{
    figure: FlatFigure;
    clockRef: React.MutableRefObject<number>;
}>;
/**
 * Flatten the loaded chunks into one entry per baked occupant, in scene space.
 * Mirrors InteriorLights.collectInteriorLighting: chunk origin → scene, then the
 * site's (localX, localZ) added to build each building group's placement.
 */
export declare function collectInteriorOccupants(loaded: LoadedChunk[], origin: SceneOrigin): FlatFigure[];
/**
 * Live interior-occupant layer. Re-flattens the occupant set only when the
 * loaded-chunk set changes; each mounted actor samples the fractional clock on
 * render frames. Members OUT this hour stay mounted but their group is hidden.
 */
declare const InteriorOccupants: React.FC<{
    loaded: LoadedChunk[];
    origin: SceneOrigin;
}>;
export default InteriorOccupants;
