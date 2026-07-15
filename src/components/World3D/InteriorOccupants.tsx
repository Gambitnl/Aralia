// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 16:55:45
 * Dependents: components/World3D/World3DScene.tsx
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
 * DATA vs RENDER: which member stands where at each hour is baked
 * deterministically as `stationsByHour` (plan feet, blueprint frame; null = OUT
 * that hour). This component is pure render-side selection against the live
 * hour — it re-resolves every occupant's scene position from that schedule and
 * draws a shared OccupantFigure. Nothing here re-meshes a chunk or touches the
 * streaming worker; the flattened figure list is memoized on the loaded-chunk
 * set and only the per-hour positions recompute as the clock advances.
 *
 * Generated soft bodies are deliberately a close-interior detail, not a whole-
 * town layer. The nearby selector keeps only the nearest bounded set alive so
 * an overview cannot accidentally polygonize dozens of unseen residents.
 *
 * Placement uses the SAME shared transform SiteBuilding and InteriorLights use
 * (planFeetToSiteLocal → siteLocalToScene), so a figure can never drift from the
 * shell it stands in. v1 SNAPS between stations — no walk lerp (a follow-up).
 */
import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { BuildingOccupantRender, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { siteLocalToScene, planFeetToSiteLocal, type SitePlacement } from './interiorPlacement';
import OccupantFigure from './OccupantFigure';
import { useInteriorHour } from './InteriorHourContext';

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
      const radius = previous.has(candidate.key) ? BODY_RADIUS_EXIT_M : BODY_RADIUS_M;
      return { candidate, distance, eligible: distance < radius };
    })
    .filter((entry) => entry.eligible)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, Math.max(0, limit));

  return new Set(eligible.map((entry) => entry.candidate.key));
}

/**
 * Meters per storey — matches the shell's `heightM = storeys * 3` baked in
 * groundChunkLoader, so `level * STOREY_M` lifts an upper-floor station onto the
 * right floor.
 */
const STOREY_M = 3;

/** The interior envelope, in PLAN FEET (blueprint frame) — the station frame. */
interface OccupantFrame {
  widthFt: number;
  depthFt: number;
  /** Stable plot origin when the current envelope grew asymmetrically. */
  originXFt?: number;
  originYFt?: number;
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

/** One flattened occupant plus everything needed to place and draw it. */
interface FlatFigure {
  key: string;
  occ: BuildingOccupantRender;
  placement: SitePlacement;
  frame: OccupantFrame;
  surfaceY: number;
}

/**
 * Flatten the loaded chunks into one entry per baked occupant, in scene space.
 * Mirrors InteriorLights.collectInteriorLighting: chunk origin → scene, then the
 * site's (localX, localZ) added to build each building group's placement.
 */
export function collectInteriorOccupants(loaded: LoadedChunk[], origin: SceneOrigin): FlatFigure[] {
  const out: FlatFigure[] = [];
  for (const chunk of loaded) {
    const o = chunkOriginWorld(chunk.cx, chunk.cy);
    const chunkScene = worldToScene(o.x, o.y, origin); // chunk-local frame origin
    for (const s of chunk.bundle.sites) {
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
        out.push({
          key: `${s.localX}:${s.localZ}:${occ.id}`,
          occ,
          placement,
          frame,
          surfaceY: s.surfaceY,
        });
      }
    }
  }
  return out;
}

/**
 * Live interior-occupant layer. Re-flattens the occupant set only when the
 * loaded-chunk set changes; each figure's position re-resolves from the live
 * `hour`. Members OUT this hour render nothing.
 */
const InteriorOccupants: React.FC<{
  loaded: LoadedChunk[];
  origin: SceneOrigin;
}> = ({ loaded, origin }) => {
  // The live game hour comes from the shared InteriorHour context — the same
  // clock source the windows and hearth lights read, honoring the
  // window.__wfAgentClock scrub override. Figures re-resolve when it ticks.
  const hour = useInteriorHour();
  // Static-per-chunk-set figure list (no per-frame rebuild). The key changes
  // only when chunks stream in/out; origin is frozen for the session.
  const loadedKey = loaded.map((c) => `${c.cx}|${c.cy}`).join(',');
  const figures = useMemo(
    () => collectInteriorOccupants(loaded, origin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loadedKey, origin],
  );

  // Camera-distance gate, ticked at 2 Hz with enter/exit hysteresis. Keyed on
  // the BUILDING position (stable across hours) so the eligible set doesn't
  // churn as members move between stations.
  const [nearKeys, setNearKeys] = useState<ReadonlySet<string>>(() => new Set());
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
      for (const f of figures) {
        const pos = occupantScenePosition(f.occ, hour, f.frame, f.placement, f.surfaceY);
        if (pos) candidates.push({ key: f.key, ...pos });
      }
      const next = selectInteriorBodyKeys(candidates, camera.position, prev);

      // Preserve the Set object when membership is unchanged. This prevents a
      // 2 Hz distance check from causing an otherwise identical React render.
      const changed = next.size !== prev.size || [...next].some((key) => !prev.has(key));
      return changed ? next : prev;
    });
  });

  if (figures.length === 0) return null;

  return (
    <>
      {figures.map((f) => {
        if (!nearKeys.has(f.key)) return null; // beyond body radius
        const pos = occupantScenePosition(f.occ, hour, f.frame, f.placement, f.surfaceY);
        if (!pos) return null; // OUT this hour — not rendered.
        return (
          <OccupantFigure
            key={f.key}
            occupantId={f.occ.id}
            ageBand={f.occ.ageBand}
            race={f.occ.race}
            position={[pos.x, pos.y, pos.z]}
            rotationY={f.placement.rotationY}
          />
        );
      })}
    </>
  );
};

export default InteriorOccupants;
