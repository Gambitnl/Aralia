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
 * Placement uses the SAME shared transform SiteBuilding and InteriorLights use
 * (planFeetToSiteLocal → siteLocalToScene), so a figure can never drift from the
 * shell it stands in. v1 SNAPS between stations — no walk lerp (a follow-up).
 */
import React, { useMemo } from 'react';
import type { BuildingOccupantRender, LoadedChunk } from '@/systems/world3d/types';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { worldToScene, type SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { siteLocalToScene, planFeetToSiteLocal, type SitePlacement } from './interiorPlacement';
import OccupantFigure from './OccupantFigure';
import { useInteriorHour } from './InteriorHourContext';

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
  const local = planFeetToSiteLocal(st.xFt, st.yFt, frame.widthFt, frame.depthFt);
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

  if (figures.length === 0) return null;

  return (
    <>
      {figures.map((f) => {
        const pos = occupantScenePosition(f.occ, hour, f.frame, f.placement, f.surfaceY);
        if (!pos) return null; // OUT this hour — not rendered.
        return (
          <OccupantFigure
            key={f.key}
            body={f.occ.body}
            ageBand={f.occ.ageBand}
            position={[pos.x, pos.y, pos.z]}
            rotationY={f.placement.rotationY}
          />
        );
      })}
    </>
  );
};

export default InteriorOccupants;
