// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 17:45:59
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
 * Loaded residents keep their live body label; an older roster marker remains
 * a fallback only when no matching resident packet owns that person's label.
 * Ground-mode range follows the rendered walking body, not the frozen floating
 * origin or a requested destination. Explicit continent anchors keep their path.
 */

import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Object3D } from 'three';
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
  /** Distance-fade opacity in [0, 1] (1 = fully visible, fades near range edge). */
  opacity: number;
  /** Site type, also available for test/diagnostic selectors. */
  kind: ChunkSite['kind'];
  /**
   * Occupant/hostile plates exist to be read up close — they skip the near-hide
   * gate and the cluster declutter (a keeper standing by their shop must label).
   */
  declutterExempt: boolean;
}

/** Conservative defaults for an in-world label system. */
const NAMEPLATE_CONFIG: NameplateConfig = {
  allowedLods: ['full', 'mid'],
  maxWorldDistance: WORLD3D_CONFIG.CHUNK_WORLD_SIZE * WORLD3D_CONFIG.LOAD_RADIUS,
  maxVisible: 12,
};

/**
 * Hide a plate when the player is essentially AT the site: inside this range
 * the building itself is identification enough, and a world-anchored label
 * this close fills the frame.
 */
export const NAMEPLATE_MIN_DISTANCE_M = 15;

/**
 * Screen-space declutter: when several labeled sites cluster (a business row),
 * only the nearest label within this world separation shows. Prevents plate
 * pile-ups where 4-5 chips stack over one block.
 */
export const NAMEPLATE_MIN_SEPARATION_M = 18;

/** Distance fade: plates fade out over the last fraction of their range. */
const FADE_START_FRACTION = 0.75;

/** Keep building labels above the roof volume instead of buried in the slab. */
const ROOF_CLEAR = 3.5;

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
  // The loader's wf-occ marker is a bake-hour snapshot, while the resident
  // layer follows the person's actual home/work/OUT ownership. Showing both
  // suggests two people or leaves a stale "working" claim after they depart.
  // Match the producer's settlement + roster id, never a shared display name.
  // Keep fallback markers for older/unloaded packets without proven ownership.
  const liveResidentMarkers = new Set<string>();
  for (const chunk of loaded) {
    for (const site of chunk.bundle.sites) {
      for (const occupant of site.occupants ?? []) {
        if (occupant.burgId !== undefined && Number.isFinite(occupant.burgId) && Number.isFinite(occupant.id)) {
          liveResidentMarkers.add(`wf-occ-${occupant.burgId}-${occupant.id}`);
        }
      }
    }
  }
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
      if (site.markerOnly && liveResidentMarkers.has(site.id)) continue;
      // A named public building must remain identifiable at its doorway.
      // Use the existing canonical frontage; private/legacy sites keep their
      // roof/radius anchor and near-hide behavior, with no invented sign mesh.
      const frontage = Boolean(site.name?.trim()) && typeof site.boxHeight === 'number'
        && Number.isFinite(site.frontDoorOffsetX) && Number.isFinite(site.frontDoorOffsetZ);
      const worldPos = {
        x: chunkOrigin.x + site.localX + (frontage ? site.frontDoorOffsetX! : 0),
        z: chunkOrigin.y + site.localZ + (frontage ? site.frontDoorOffsetZ! : 0),
      };

      const dx = worldPos.x - refX;
      const dz = worldPos.z - refZ;
      const distanceSq = dx * dx + dz * dz;
      // Occupant labels can opt into a tighter walking-distance gate while
      // towns, dungeons, and older sites keep using the global nameplate range.
      const siteMaxDistance =
        typeof site.labelRangeM === 'number' && Number.isFinite(site.labelRangeM)
          ? Math.max(0, site.labelRangeM)
          : config.maxWorldDistance;
      const siteMaxDistanceSq = site.labelRangeM === undefined
        ? maxDistanceSq
        : siteMaxDistance * siteMaxDistance;
      if (distanceSq > siteMaxDistanceSq) continue;
      // Inside the near gate the building itself is identification enough —
      // and a plate this close would dominate the frame. Occupant markers and
      // hostiles are EXEMPT: those plates exist to be read at conversation range.
      const exempt = site.markerOnly === true || site.kind === 'monster';
      if (!exempt && !frontage && distanceSq < NAMEPLATE_MIN_DISTANCE_M * NAMEPLATE_MIN_DISTANCE_M) continue;

      const sceneX = worldPos.x - sceneOrigin.x;
      const sceneZ = worldPos.z - sceneOrigin.z;
      // Buildings report boxHeight in meters, so their label anchor can clear
      // the roof directly. Legacy radius-only sites keep the older center-cube
      // label height so continent markers do not move.
      const labelY = frontage ? site.surfaceY + 2.4
        : typeof site.boxHeight === 'number'
          ? site.surfaceY + site.boxHeight + ROOF_CLEAR
          : site.surfaceY + site.radius;
      // Fade out over the tail of the range so plates never pop in/out hard.
      const distance = Math.sqrt(distanceSq);
      const fadeStart = siteMaxDistance * FADE_START_FRACTION;
      const fadeSpan = Math.max(1, siteMaxDistance - fadeStart);
      const opacity = clamp01(1 - (distance - fadeStart) / fadeSpan);
      candidates.push({
        key: `${chunk.cx}|${chunk.cy}|${site.id}`,
        text: site.name ?? buildSiteLabelText(site.kind, site.id),
        position: [sceneX, labelY, sceneZ],
        distanceSq,
        opacity,
        kind: site.kind,
        declutterExempt: exempt,
      });
    }
  }

  candidates.sort((a, b) => a.distanceSq - b.distanceSq);
  // Declutter clustered sites (business rows): nearest-first, drop any label
  // within NAMEPLATE_MIN_SEPARATION_M of an already-accepted label.
  const minSepSq = NAMEPLATE_MIN_SEPARATION_M * NAMEPLATE_MIN_SEPARATION_M;
  const accepted: SiteLabel[] = [];
  for (const c of candidates) {
    if (accepted.length >= config.maxVisible) break;
    let crowded = false;
    if (!c.declutterExempt) {
      for (const a of accepted) {
        if (a.declutterExempt) continue;
        const dx = c.position[0] - a.position[0];
        const dz = c.position[2] - a.position[2];
        if (dx * dx + dz * dz < minSepSq) {
          crowded = true;
          break;
        }
      }
    }
    if (!crowded) accepted.push(c);
  }
  return accepted;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
  const scene = useThree(state => state.scene);
  const [bodyAnchor, setBodyAnchor] = React.useState<PlayerWorldPosition | null>(null);
  const body = React.useRef<{scene: typeof scene; player: Object3D | null}>({scene, player: null});
  const sampled = React.useRef<PlayerWorldPosition | null>(null);
  const sampleAfter = React.useRef(.25);
  const worldPoint = React.useMemo(() => new Vector3(), []);

  // Ground mode deliberately has no continent position. The floating origin
  // stays at entry, so using it for range left the old shop labeled over a
  // school reached 120 meters away. Read the existing physical player root;
  // a click's destination is intent, not arrival. Cache its identity, and look
  // again after replacement. This changes presentation only, never movement,
  // discoveries, resident ownership, names or the saved position.
  useFrame((_state, delta) => {
    if (playerWorldPos) return;
    sampleAfter.current += delta;
    if (sampleAfter.current < .25) return;
    sampleAfter.current = 0;
    const cache = body.current;
    if (cache.scene !== scene) { cache.scene = scene; cache.player = null; }
    if (!cache.player?.parent) cache.player = scene.getObjectByName('world3d:player') ?? null;
    if (!cache.player) {
      if (sampled.current) { sampled.current = null; setBodyAnchor(null); }
      return;
    }
    const foot = cache.player.getWorldPosition(worldPoint);
    const point = {x: foot.x + sceneOrigin.x, y: foot.y, z: foot.z + sceneOrigin.z};
    const prior = sampled.current;
    if (prior && Math.hypot(point.x - prior.x, point.z - prior.z) < .25) return;
    sampled.current = point;
    setBodyAnchor(point);
  });
  const rangeAnchor = playerWorldPos ?? bodyAnchor;

  const nameplates = React.useMemo(
    () =>
      makeNameplates(loaded, sceneOrigin, rangeAnchor, {
        ...NAMEPLATE_CONFIG,
        maxWorldDistance,
        maxVisible,
      }),
    [loaded, rangeAnchor, sceneOrigin.x, sceneOrigin.z, maxWorldDistance, maxVisible],
  );

  if (!nameplates.length) return null;

  return (
    <>
      {nameplates.map((site) => (
        // SIZE-BLOWUP FIX (2026-07-04): `transform` put the plate on a plane in
        // WORLD space (distanceFactor as world scale), so walking up to a
        // business scaled its plate without bound — screenshots showed one chip
        // covering ~30% of the frame. Screen-space Html (no transform, no
        // distanceFactor) renders at constant pixel size: a hard max, always sane.
        <Html key={site.key} center position={site.position} zIndexRange={[40, 0]}>
          {/* data-* attributes live on the INNER element: putting them on
              <Html> routes them through R3F's applyProps, which parses
              "data-testid" as a dashed pier path (data.testid) on the three
              object and throws — crashing the whole scene the first time a
              nameplate enters range (found via Worldforge ground mode). */}
          <div
            data-kind={site.kind}
            data-testid={`world-3d-site-label-${site.key}`}
            style={{
              pointerEvents: 'none',
              opacity: site.opacity,
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
