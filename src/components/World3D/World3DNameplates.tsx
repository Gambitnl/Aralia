// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 08/06/2026, 17:58:48
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/World3D/World3DNameplates.tsx
 * In-3D HUD overlay for site nameplates.
 *
 * This helper renders a conservative, distance/LOD-gated set of labels over
 * World3D sites using React Three Drei Html overlays.
 */

import React from 'react';
import { Html } from '@react-three/drei';
import { chunkOriginWorld } from '@/systems/world3d/coords';
import { WORLD3D_CONFIG } from '@/systems/world3d/config';
import type { LoadedChunk, LodTier, ChunkSite } from '@/systems/world3d/types';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { PlayerWorldPosition } from '@/types';

/** --------------------------------------------------------------------- */
/** Section: label model and config defaults                               */
/** --------------------------------------------------------------------- */

/** Distance and density rules for HUD nameplates. */
interface NameplateConfig {
  /** Show only these LODs so distant chunks stay light. */
  allowedLods: LodTier[];
  /** Hide labels farther than this world distance in meters. */
  maxWorldDistance: number;
  /** Keep label count bounded for dense world passes. */
  maxVisible: number;
}

/** Normalized record for one projected label. */
interface SiteLabel {
  /** Stable React key so list updates stay deterministic. */
  key: string;
  /** Text shown in the overlay. */
  text: string;
  /** Label world position converted into scene coordinates. */
  position: [number, number, number];
  /** Cached squared distance used for stable nearest-first sorting. */
  distanceSq: number;
  /** Site type, also available for test/diagnostic selectors. */
  kind: ChunkSite['kind'];
}

/** Conservative defaults for an in-world label system. */
const NAMEPLATE_CONFIG: NameplateConfig = {
  allowedLods: ['full', 'mid'],
  maxWorldDistance: WORLD3D_CONFIG.CHUNK_WORLD_SIZE * WORLD3D_CONFIG.LOAD_RADIUS,
  maxVisible: 12,
};

interface World3DNameplatesProps {
  /** Loaded chunks owned by the streamer. */
  loaded: LoadedChunk[];
  /** Floating world origin so labels stay near the rendered local coordinate frame. */
  sceneOrigin: SceneOrigin;
  /** Player anchor used for distance culling and sorting. */
  playerWorldPos?: PlayerWorldPosition | null;
  /** Optional overrides for local testing and profiling. */
  maxWorldDistance?: number;
  /** Optional overrides for local testing and profiling. */
  maxVisible?: number;
}

/** --------------------------------------------------------------------- */
/** Section: pure site-labeling helpers                                     */
/** --------------------------------------------------------------------- */

function capitalizeKind(kind: ChunkSite['kind']): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function buildSiteLabelText(kind: ChunkSite['kind'], id: string): string {
  return `${capitalizeKind(kind)} - ${id}`;
}

function makeNameplates(
  loaded: LoadedChunk[],
  sceneOrigin: SceneOrigin,
  playerWorldPos: PlayerWorldPosition | null,
  config: NameplateConfig,
): SiteLabel[] {
  const refX = playerWorldPos?.x ?? sceneOrigin.x;
  const refZ = playerWorldPos?.z ?? sceneOrigin.z;
  const maxDistanceSq = config.maxWorldDistance * config.maxWorldDistance;

  const candidates: SiteLabel[] = [];
  for (const chunk of loaded) {
    if (!config.allowedLods.includes(chunk.lod)) {
      continue;
    }

    const chunkOrigin = chunkOriginWorld(chunk.cx, chunk.cy);
    for (const site of chunk.bundle.sites) {
      // Sites can opt out of labeling (e.g. town-plan building plots, which
      // would otherwise flood the HUD with one chip per house).
      if (site.unlabeled) continue;
      const worldPos = {
        x: chunkOrigin.x + site.localX,
        z: chunkOrigin.y + site.localZ,
      };

      const dx = worldPos.x - refX;
      const dz = worldPos.z - refZ;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > maxDistanceSq) continue;

      const sceneX = worldPos.x - sceneOrigin.x;
      const sceneZ = worldPos.z - sceneOrigin.z;
      candidates.push({
        key: `${chunk.cx}|${chunk.cy}|${site.id}`,
        text: buildSiteLabelText(site.kind, site.id),
        position: [sceneX, site.surfaceY + site.radius, sceneZ],
        distanceSq,
        kind: site.kind,
      });
    }
  }

  candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  return candidates.slice(0, config.maxVisible);
}

/** --------------------------------------------------------------------- */
/** Section: 3D nameplate component                                        */
/** --------------------------------------------------------------------- */

const World3DNameplates: React.FC<World3DNameplatesProps> = ({
  loaded,
  sceneOrigin,
  playerWorldPos = null,
  maxWorldDistance = NAMEPLATE_CONFIG.maxWorldDistance,
  maxVisible = NAMEPLATE_CONFIG.maxVisible,
}) => {
  const nameplates = React.useMemo(
    () =>
      makeNameplates(loaded, sceneOrigin, playerWorldPos, {
        ...NAMEPLATE_CONFIG,
        maxWorldDistance,
        maxVisible,
      }),
    [loaded, playerWorldPos, sceneOrigin.x, sceneOrigin.z, maxWorldDistance, maxVisible],
  );

  if (!nameplates.length) return null;

  return (
    <>
      {nameplates.map((site) => (
        <Html
          key={site.key}
          center
          position={site.position}
          transform
          distanceFactor={20}
        >
          {/* data-* attributes live on the INNER element: putting them on
              <Html> routes them through R3F's applyProps, which parses
              "data-testid" as a dashed pier path (data.testid) on the three
              object and throws — crashing the whole scene the first time a
              nameplate enters range (found via Worldforge ground mode). */}
          <div
            data-kind={site.kind}
            data-testid={`world-3d-site-label-${site.key}`}
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              color: 'white',
              fontSize: '12px',
              fontFamily: 'Outfit, sans-serif',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(9, 19, 28, 0.78)',
              border: '1px solid rgba(148, 163, 184, 0.45)',
            }}
          >
            {site.text}
          </div>
        </Html>
      ))}
    </>
  );
};

export default World3DNameplates;
export { makeNameplates };
