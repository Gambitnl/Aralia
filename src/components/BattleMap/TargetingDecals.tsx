/**
 * @file TargetingDecals.tsx — 3D ability-targeting tile decals (gap #29).
 *
 * The 2D battle map paints red "valid target" tiles and sky-blue teleport
 * destinations the moment an ability is selected; the 3D view computed the
 * same sets (BattleMap3D's useTargetSelection) but rendered nothing — at
 * tactical zoom there was no visible response to entering targeting mode
 * (verified live 2026-06-11, GOAL #14/#15). This layer projects those tile
 * sets onto the terrain as gently pulsing tile patches.
 *
 * The hovered-AoE template (aoeSet) is also drawn here (GOAL #15). It used
 * to live in VFXSystem's AoEPreview as flat per-tile planes at y=0.06 — the
 * same buried-on-hills / floating-over-banks class of bug tasks 78-80
 * eradicated — and it never appeared anyway because nothing in the 3D view
 * called previewAoE (no tile-hover path until task 81 wired one).
 *
 * Rendering approach: one merged BufferGeometry per tile category, each tile
 * a 4×4-subdivided quad whose vertices are displaced by the terrain ground
 * sampler. Flat instanced quads were tried first and FLOATED on dune slopes
 * (a max-corner-anchored pane slicing through the unit standing on the tile
 * — see target29c capture); per-vertex conformance hugs the surface instead.
 * Sets are small (single-target: enemy tiles; area: up to ~450 tiles ≈ 14k
 * tris) and change only on ability selection, so rebuild cost is negligible.
 *
 * Preserved: 2D color vocabulary (red targets / sky teleport) so mode
 * switching keeps one visual language.
 */
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const TILE_WORLD_SIZE = 1.0;
const DECAL_SIZE = 0.92; // slight inset so adjacent decals read as tiles
const DECAL_LIFT = 0.06; // above GridOverlay's 0.02 offset — no z-fighting
const SEGMENTS = 4; // per-tile subdivision so the patch follows slopes

interface TargetingDecalsProps {
  /** Tiles a selected ability may target, keys "x-y" (useTargetSelection). */
  validTargetSet: Set<string>;
  /** Teleport destination tiles, keys "x-y". */
  teleportDestinationSet: Set<string>;
  /** Hovered AoE template tiles, keys "x-y" (useTargetSelection aoeSet). */
  aoeSet: Set<string>;
  /** Whether ability targeting is active at all. */
  targetingMode: boolean;
  /** Terrain ground-height sampler (world X/Z → world Y), or null pre-load. */
  groundSampler: ((x: number, z: number) => number) | null;
}

function decodeTileCenters(tiles: Set<string>): Array<[number, number]> {
  const centers: Array<[number, number]> = [];
  for (const key of tiles) {
    const dash = key.indexOf("-");
    if (dash <= 0) continue;
    const x = Number(key.slice(0, dash));
    const y = Number(key.slice(dash + 1));
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    centers.push([(x + 0.5) * TILE_WORLD_SIZE, (y + 0.5) * TILE_WORLD_SIZE]);
  }
  return centers;
}

/**
 * Decode "x-y" tile keys into a terrain-conforming merged patch geometry.
 *
 * shape 'fill' — a subdivided quad covering the tile. Right for EMPTY tiles
 * (teleport destinations). shape 'frame' — a border ribbon around the tile
 * edge. Right for OCCUPIED valid-target tiles: a fill hides under the unit
 * standing on it (target29-final captures), while a frame sticks out past
 * the model's footprint on all sides.
 */
function buildConformingGeometry(
  tiles: Set<string>,
  groundSampler: ((x: number, z: number) => number) | null,
  shape: "fill" | "frame",
  lift: number = DECAL_LIFT,
): THREE.BufferGeometry | null {
  const centers = decodeTileCenters(tiles);
  if (centers.length === 0) return null;

  const positions: number[] = [];
  const indices: number[] = [];

  // Emit a subdivided rectangle [x0..x1]×[z0..z1] with nx×nz cells,
  // each vertex dropped onto the terrain surface.
  const emitGrid = (x0: number, x1: number, z0: number, z1: number, nx: number, nz: number) => {
    const base = positions.length / 3;
    for (let iz = 0; iz <= nz; iz++) {
      for (let ix = 0; ix <= nx; ix++) {
        const vx = x0 + (x1 - x0) * (ix / nx);
        const vz = z0 + (z1 - z0) * (iz / nz);
        const vy = (groundSampler ? groundSampler(vx, vz) : 0) + lift;
        positions.push(vx, vy, vz);
      }
    }
    for (let iz = 0; iz < nz; iz++) {
      for (let ix = 0; ix < nx; ix++) {
        const a = base + iz * (nx + 1) + ix;
        const b = a + 1;
        const c = a + (nx + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  };

  const FRAME_SIZE = 0.98; // frame hugs the tile edge so it clears the unit
  const FRAME_BORDER = 0.12;
  for (const [cx, cz] of centers) {
    if (shape === "fill") {
      const h = DECAL_SIZE / 2;
      emitGrid(cx - h, cx + h, cz - h, cz + h, SEGMENTS, SEGMENTS);
    } else {
      const h = FRAME_SIZE / 2;
      const b = FRAME_BORDER;
      emitGrid(cx - h, cx + h, cz - h, cz - h + b, SEGMENTS, 1); // north strip
      emitGrid(cx - h, cx + h, cz + h - b, cz + h, SEGMENTS, 1); // south strip
      emitGrid(cx - h, cx - h + b, cz - h + b, cz + h - b, 1, SEGMENTS); // west
      emitGrid(cx + h - b, cx + h, cz - h + b, cz + h - b, 1, SEGMENTS); // east
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}

/** One category of terrain-conforming tile decals with a soft opacity pulse. */
const DecalLayer: React.FC<{
  tiles: Set<string>;
  groundSampler: ((x: number, z: number) => number) | null;
  color: string;
  baseOpacity: number;
  shape: "fill" | "frame";
  lift?: number;
}> = ({ tiles, groundSampler, color, baseOpacity, shape, lift }) => {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  const geometry = useMemo(
    () => buildConformingGeometry(tiles, groundSampler, shape, lift),
    [tiles, groundSampler, shape, lift],
  );

  // Geometry is passed as a prop (not declared as JSX), so R3F will not
  // auto-dispose it — release the GPU buffers when the set changes.
  React.useEffect(() => () => { geometry?.dispose(); }, [geometry]);

  // Dev probe (gap #29 verification): report what this layer actually drew.
  React.useLayoutEffect(() => {
    if (typeof window === "undefined" || !import.meta.env?.DEV) return;
    const w = window as unknown as { __bm3dDecalDebug?: Record<string, unknown> };
    w.__bm3dDecalDebug = w.__bm3dDecalDebug ?? {};
    const p = geometry?.getAttribute("position");
    // Key by color+shape: the AoE fill shares the valid-target red.
    w.__bm3dDecalDebug[`${color}/${shape}`] = {
      tiles: tiles.size,
      verts: p ? p.count : 0,
      first: p ? { x: p.getX(0), y: p.getY(0), z: p.getZ(0) } : null,
    };
  }, [geometry, tiles, color, shape]);

  // Gentle pulse — unmissable that targeting is live, without strobing
  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.opacity =
        baseOpacity + Math.sin(clock.elapsedTime * 2.5) * baseOpacity * 0.25;
    }
  });

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={2} frustumCulled={false}>
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={baseOpacity}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

const TargetingDecals: React.FC<TargetingDecalsProps> = ({
  validTargetSet,
  teleportDestinationSet,
  aoeSet,
  targetingMode,
  groundSampler,
}) => {
  if (!targetingMode) return null;

  return (
    <group name="targeting-decals">
      {/* Red = "this tile is attackable/targetable" — 2D parity (bg-red-500/40).
          Frame, not fill: target tiles are occupied, and a fill hides under
          the unit standing on them. */}
      <DecalLayer
        tiles={validTargetSet}
        groundSampler={groundSampler}
        color="#ef4444"
        baseOpacity={0.85}
        shape="frame"
      />
      {/* Sky = "you may blink here" — 2D parity (bg-sky-400/55). Destinations
          are empty tiles, so a fill reads cleanly. */}
      <DecalLayer
        tiles={teleportDestinationSet}
        groundSampler={groundSampler}
        color="#38bdf8"
        baseOpacity={0.5}
        shape="fill"
      />
      {/* Hovered AoE template — 2D parity (bg-red-500/60: same hue as valid
          targets, stronger fill). Mostly-empty area tiles, so a fill reads;
          lifted slightly above the frame layer so an AoE tile that is also a
          valid target doesn't z-fight along the frame border. */}
      <DecalLayer
        tiles={aoeSet}
        groundSampler={groundSampler}
        color="#ef4444"
        baseOpacity={0.6}
        shape="fill"
        lift={DECAL_LIFT + 0.03}
      />
    </group>
  );
};

export default TargetingDecals;
