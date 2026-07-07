/**
 * @file DungeonEntrances.tsx — Pillar 2, Task 6 render rung for world-grown
 * dungeon ENTRANCES. `GroundWorld.dungeonEntrances` carries a sealed-door site
 * per dungeon whose mouth falls in the window; this draws a simple but READABLE
 * marker per `entranceKind` so a player can spot and walk up to one.
 *
 * Approach (matches GroundProps' flat-shaded primitive look):
 *  - Each entrance is a small per-instance <group> of a few boxes/cylinders —
 *    entrances are low-count (a handful per window), so no instancing needed.
 *  - Position: xM/zM are window-local ground meters; Y is sampled from the
 *    heightfield via `groundSurfaceY` (exactly like GroundProps/PlayerAvatar),
 *    then rebased into scene space by subtracting the scene origin.
 *  - NO lights (hard rule) — pure geometry + flat materials.
 *
 * The four kinds:
 *  - ruin-door:   a stone doorframe slab (two jambs + a lintel) with a dark leaf.
 *  - cave-mouth:  a dark arch set against a low rock mound.
 *  - temple-stair: a stair-down block (descending step slabs into a dark shaft).
 *  - sewer-grate: a flat grate disc set in a stone rim.
 */
import React, { useMemo } from 'react';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { groundSurfaceY, type GroundWorld, type GroundDungeonEntrance } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { EntranceKind } from '@/systems/worldforge/dungeon/world/dungeonSites';

// Flat stone/earth tones consistent with the styled-town / props look.
const STONE = '#8d8d86';
const STONE_DARK = '#6f6f69';
const ROCK = '#7d7a72';
const DARK = '#14110f'; // the "way down is dark" void
const IRON = '#4a4a4a';

const flatMat = (color: string) => (
  <meshStandardMaterial color={color} roughness={0.95} flatShading />
);

/** An entrance resolved to scene space (meters, origin-rebased). */
interface Placed {
  x: number;
  y: number;
  z: number;
  kind: EntranceKind;
  id: string;
}

/** A stone doorframe slab with a dark leaf — ruin-door. */
const RuinDoor: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} data-testid="dungeon-entrance-ruin-door">
    {/* dark doorway void behind the leaf */}
    <mesh position={[0, 1.1, -0.05]}><boxGeometry args={[1.3, 2.2, 0.2]} />{flatMat(DARK)}</mesh>
    {/* two jambs */}
    <mesh position={[-0.85, 1.2, 0]} castShadow><boxGeometry args={[0.4, 2.4, 0.5]} />{flatMat(STONE)}</mesh>
    <mesh position={[0.85, 1.2, 0]} castShadow><boxGeometry args={[0.4, 2.4, 0.5]} />{flatMat(STONE)}</mesh>
    {/* lintel */}
    <mesh position={[0, 2.5, 0]} castShadow><boxGeometry args={[2.3, 0.45, 0.55]} />{flatMat(STONE_DARK)}</mesh>
  </group>
);

/** A dark arch against a low rock mound — cave-mouth. */
const CaveMouth: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} data-testid="dungeon-entrance-cave-mouth">
    {/* rock mound: a couple of squat boxes */}
    <mesh position={[0, 1.0, -0.6]} castShadow><boxGeometry args={[4.2, 2.0, 2.4]} />{flatMat(ROCK)}</mesh>
    <mesh position={[-1.4, 0.7, 0.3]} rotation={[0, 0.3, 0]} castShadow><boxGeometry args={[1.6, 1.4, 1.4]} />{flatMat(ROCK)}</mesh>
    <mesh position={[1.5, 0.6, 0.2]} rotation={[0, -0.4, 0]} castShadow><boxGeometry args={[1.4, 1.2, 1.3]} />{flatMat(ROCK)}</mesh>
    {/* the dark mouth — a half-cylinder void carved into the mound face */}
    <mesh position={[0, 0.9, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1.0, 1.0, 1.2, 12, 1, false, 0, Math.PI]} />
      {flatMat(DARK)}
    </mesh>
    <mesh position={[0, 0.02, 0.55]}><boxGeometry args={[2.0, 0.04, 1.0]} />{flatMat(DARK)}</mesh>
  </group>
);

/** A stair-down block descending into a dark shaft — temple-stair. */
const TempleStair: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} data-testid="dungeon-entrance-temple-stair">
    {/* stone surround framing the descent */}
    <mesh position={[-1.1, 0.35, 0]} castShadow><boxGeometry args={[0.5, 0.7, 2.6]} />{flatMat(STONE)}</mesh>
    <mesh position={[1.1, 0.35, 0]} castShadow><boxGeometry args={[0.5, 0.7, 2.6]} />{flatMat(STONE)}</mesh>
    <mesh position={[0, 0.35, -1.35]} castShadow><boxGeometry args={[2.7, 0.7, 0.5]} />{flatMat(STONE_DARK)}</mesh>
    {/* dark shaft the steps drop into */}
    <mesh position={[0, -0.4, 0.2]}><boxGeometry args={[1.7, 1.0, 2.0]} />{flatMat(DARK)}</mesh>
    {/* three descending step slabs */}
    {[0, 1, 2].map((i) => (
      <mesh key={i} position={[0, 0.15 - i * 0.22, 0.6 - i * 0.45]} castShadow>
        <boxGeometry args={[1.6, 0.16, 0.5]} />{flatMat(STONE)}
      </mesh>
    ))}
  </group>
);

/** A flat grate disc set in a stone rim — sewer-grate. */
const SewerGrate: React.FC<{ p: Placed }> = ({ p }) => (
  <group position={[p.x, p.y, p.z]} data-testid="dungeon-entrance-sewer-grate">
    {/* dark void below the grate */}
    <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.9, 0.9, 0.1, 12]} />{flatMat(DARK)}</mesh>
    {/* stone rim ring */}
    <mesh position={[0, 0.06, 0]} castShadow><cylinderGeometry args={[1.15, 1.2, 0.18, 12]} />{flatMat(STONE)}</mesh>
    {/* iron grate bars (three flat slats) */}
    {[-0.5, 0, 0.5].map((ox, i) => (
      <mesh key={i} position={[ox, 0.12, 0]}><boxGeometry args={[0.14, 0.06, 1.7]} />{flatMat(IRON)}</mesh>
    ))}
    {[-0.5, 0, 0.5].map((oz, i) => (
      <mesh key={`c${i}`} position={[0, 0.12, oz]}><boxGeometry args={[1.7, 0.06, 0.14]} />{flatMat(IRON)}</mesh>
    ))}
  </group>
);

const KIND_COMPONENT: Record<EntranceKind, React.FC<{ p: Placed }>> = {
  'ruin-door': RuinDoor,
  'cave-mouth': CaveMouth,
  'temple-stair': TempleStair,
  'sewer-grate': SewerGrate,
};

interface DungeonEntrancesProps {
  ground?: GroundWorld | null;
  sceneOrigin: SceneOrigin;
}

const DungeonEntrances: React.FC<DungeonEntrancesProps> = ({ ground, sceneOrigin }) => {
  const placed = useMemo<Placed[]>(() => {
    if (!ground?.dungeonEntrances?.length) return [];
    return ground.dungeonEntrances.map((e: GroundDungeonEntrance) => ({
      x: e.xM - sceneOrigin.x,
      y: groundSurfaceY(ground, e.xM, e.zM),
      z: e.zM - sceneOrigin.z,
      kind: e.entranceKind,
      id: e.id,
    }));
  }, [ground, sceneOrigin]);

  if (placed.length === 0) return null;

  return (
    <group name="dungeon-entrances" data-testid="dungeon-entrances">
      {placed.map((p) => {
        const Comp = KIND_COMPONENT[p.kind];
        return <Comp key={p.id} p={p} />;
      })}
    </group>
  );
};

export default DungeonEntrances;
