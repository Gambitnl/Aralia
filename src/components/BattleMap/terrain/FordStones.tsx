/**
 * @file FordStones.tsx
 * Stepping stones along the upstream edge of a ford crossing — the 3D twin of
 * the 2D painter's stone line. Placement mirrors the painter's rules exactly:
 * single file on the upstream side, irregular sizes, drunk spacing, ~1 in 5
 * missing, occasional doubled stone. Stones sit on the shallow ford bed and
 * poke just above the water film so a walker can read the dry path.
 *
 * Source-fact discipline: geometry derives ONLY from the tile grid's ford
 * crossing receipt (roadDirection, world-meter center, span/width) — the same
 * receipt the referee and the 2D painter consume. No invented placement.
 */
import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { BattleMapData } from '../../../types/combat';

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;
const WATER_SURFACE_OFFSET = 0.04;
const METERS_PER_TILE = 1.524;

/** Deterministic hash → [0,1), matching the painter's rand() role. */
const hash = (a: number, b: number, salt: number): number => {
  let h = Math.imul(a * 374761393 + b * 668265263 + salt * 2246822519, 1103515245) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

interface Stone {
  x: number;
  z: number;
  y: number;
  r: number;
  squash: number;
  rot: number;
}

const FordStones: React.FC<{ mapData: BattleMapData }> = ({ mapData }) => {
  const stones = useMemo<Stone[]>(() => {
    const anchor = mapData.provenance?.anchorWorldMeters;
    if (!anchor) return [];
    let crossing: NonNullable<
      ReturnType<typeof mapData.tiles.get>
    >['crossing'];
    for (const [, tile] of mapData.tiles) {
      if (tile.crossing?.kind === 'ford') {
        crossing = tile.crossing;
        break;
      }
    }
    if (!crossing) return [];

    const { width: W, height: H } = mapData.dimensions;
    const dirLen =
      Math.hypot(crossing.roadDirection.x, crossing.roadDirection.y) || 1;
    const dir = {
      x: crossing.roadDirection.x / dirLen,
      y: crossing.roadDirection.y / dirLen,
    };
    // Upstream unit: local -y of the painter's rotated frame → world space.
    const up = { x: dir.y, y: -dir.x };
    const centerX =
      Math.floor(W / 2) + (crossing.centerWorldMeters.x - anchor.x) / METERS_PER_TILE;
    const centerZ =
      Math.floor(H / 2) + (crossing.centerWorldMeters.z - anchor.z) / METERS_PER_TILE;
    const spanT = crossing.spanMeters / METERS_PER_TILE;
    const widthT = crossing.widthMeters / METERS_PER_TILE;
    const barHalf = Math.max((widthT / 2) * 0.85, 0.9);

    const out: Stone[] = [];
    let s = -spanT / 2 + 0.5;
    let idx = 0;
    while (s < spanT / 2) {
      idx++;
      const skip = hash(idx, 6, 632) < 0.2;
      const step = 0.65 + hash(idx, 7, 633) * 0.75;
      if (!skip) {
        const count = hash(idx, 8, 634) < 0.18 ? 2 : 1;
        for (let st = 0; st < count; st++) {
          const along = s + st * 0.28;
          const off = barHalf + 0.5 + (hash(idx + st, 9, 635) - 0.5) * 0.45;
          const tx = centerX + dir.x * along + up.x * off;
          const tz = centerZ + dir.y * along + up.y * off;
          const tile = mapData.tiles.get(
            `${Math.round(tx - 0.5)}-${Math.round(tz - 0.5)}`,
          );
          // Stones only stand in water — a stone "on" the bank is road litter.
          if (!tile || tile.terrain !== 'water') continue;
          const surfaceY =
            tile.elevation * ELEVATION_SCALE + WATER_SURFACE_OFFSET;
          const r = 0.11 + hash(idx + st, 10, 636) * 0.1;
          out.push({
            x: tx * TILE_SIZE,
            z: tz * TILE_SIZE,
            // Center slightly below the surface: the flattened stone's top
            // breaks the film, its base stays drowned.
            y: surfaceY - r * 0.25,
            r,
            squash: 0.55 + hash(idx, 11, 637) * 0.25,
            rot: hash(idx + st, 12, 638) * Math.PI,
          });
        }
      }
      s += step;
    }
    return out;
  }, [mapData]);

  if (typeof window !== 'undefined') {
    (window as unknown as { __fordStonesCount?: number }).__fordStonesCount =
      stones.length;
  }
  if (stones.length === 0) return null;
  return (
    <group name="ford-stepping-stones-3d">
      {stones.map((stone, i) => (
        <mesh
          key={i}
          position={[stone.x, stone.y, stone.z]}
          rotation={[0, stone.rot, 0]}
          scale={[stone.r, stone.r * stone.squash, stone.r * 0.8]}
          castShadow
        >
          <dodecahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#6d675c" roughness={0.95} metalness={0} />
        </mesh>
      ))}
    </group>
  );
};

export default FordStones;
