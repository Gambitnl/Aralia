/**
 * @file src/components/World3D/PlayerAvatar.tsx
 *
 * The player's own visible body in the streamed ground world. Before this,
 * the player existed only as a floating nameplate — no figure under it.
 *
 * Deliberately REUSES the existing character-body approach rather than
 * inventing a new humanoid system:
 *  - the tapered-cylinder + head silhouette from `SceneCast` (the staged
 *    opening-scene figures), in the same player steel-blue;
 *  - `generateBody` proportions (the same parametric generator the instanced
 *    townsfolk in `GroundAgents` use) for a deterministic height/build, with
 *    a cheap race scale on top (a Forest Gnome should be small).
 *
 * Anchoring: the body stands at the LOGICAL player position
 * (`playerGroundPos` — tile-local ground meters), NOT the camera. Camera walk
 * and Locale-map click-to-move both dispatch SET_PLAYER_GROUND_POS, so both
 * move this body. Ground elevation is resampled from the ground-world
 * heightfield each move so the figure stays planted on the terrain.
 */
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { heightToMeters } from '@/systems/world3d/config';
import { generateBody } from '@/systems/worldforge/body/generateBody';
import { rootSeedPath, streamPath } from '@/systems/worldforge/seedPath';
import type { Occupant } from '@/systems/worldforge/roster/types';

const FT_TO_M = 0.3048;
const PLAYER_COLOR = '#3b82f6'; // steel blue — matches the SceneCast player figure

/**
 * Cheap race scale: small folk get a visibly smaller body. Keyword match on
 * the race name — generateBody is human-banded, so this is the lightweight
 * way to honor "a Forest Gnome should be small" without touching it.
 */
export function raceScale(raceName: string | undefined): number {
  const n = (raceName ?? '').toLowerCase();
  if (/gnome|halfling|goblin|kobold|fairy/.test(n)) return 0.55;
  if (/dwarf|duergar/.test(n)) return 0.8;
  return 1;
}

/** Sample the ground-world surface height (meters) at tile-local meters. */
export function groundSurfaceYM(ground: GroundWorld, xM: number, zM: number): number {
  const gx = Math.max(0, Math.min(ground.cols - 1, Math.round(xM / GROUND_METERS_PER_CELL)));
  const gy = Math.max(0, Math.min(ground.rows - 1, Math.round(zM / GROUND_METERS_PER_CELL)));
  return heightToMeters(ground.heights[gy * ground.cols + gx] ?? 0);
}

interface PlayerAvatarProps {
  /** The ONE movement state — tile-local ground meters. Null = stand at spawn. */
  groundPos: { xM: number; zM: number } | null;
  /** Ground world (heights for terrain planting). Renders nothing without it. */
  ground: GroundWorld | null;
  sceneOrigin: SceneOrigin;
  /** Spawn surface Y (m) — fallback elevation when groundPos is null. */
  startSurfaceY: number;
  playerName?: string;
  /** Player id — seeds the deterministic body build. */
  playerId?: string;
  raceName?: string;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  groundPos,
  ground,
  sceneOrigin,
  startSurfaceY,
  playerName,
  playerId,
  raceName,
}) => {
  // Deterministic body proportions via the townsfolk generator. The player is
  // not a roster Occupant, so present a minimal adult-resident identity to it.
  const dims = useMemo(() => {
    const pseudo: Occupant = {
      id: 1,
      name: playerName ?? 'Player',
      ageBand: 'adult',
      homePlotId: 0,
      occupation: 'resident',
    };
    // Seed off the player id so the build is stable per character.
    let hash = 0;
    for (const ch of playerId ?? 'pc') hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const p = generateBody(pseudo, streamPath(rootSeedPath(hash), 'player')).proportions;
    const scale = raceScale(raceName);
    return {
      heightM: p.height * FT_TO_M * scale,
      radiusM: (p.shoulderWidth / 2) * FT_TO_M * scale,
      headM: (p.headSize / 2) * FT_TO_M * scale,
    };
  }, [playerId, raceName, playerName]);

  const groupRef = useRef<THREE.Group>(null);

  // Logical position → scene space (scene origin sits on the spawn point). This
  // is the TARGET; the body glides toward it (below) so a click-to-move walks
  // rather than teleports, and a camera walk stays smooth.
  const xM = groundPos?.xM ?? sceneOrigin.x;
  const zM = groundPos?.zM ?? sceneOrigin.z;
  const targetSurfaceY = groundPos && ground ? groundSurfaceYM(ground, xM, zM) : startSurfaceY;
  const sx = xM - sceneOrigin.x;
  const sz = zM - sceneOrigin.z;

  // Ease the visible body toward the logical position each frame, resampling the
  // terrain height under the CURRENT (interpolated) footfall so it stays planted
  // while crossing relief. Distance-proportional alpha eases in and arrives
  // promptly regardless of how far the click was. `ground` is captured here; the
  // hook order is stable because this runs before the early `!ground` return.
  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g || !ground) return;
    const a = Math.min(1, delta * 6);
    g.position.x += (sx - g.position.x) * a;
    g.position.z += (sz - g.position.z) * a;
    const curXM = g.position.x + sceneOrigin.x;
    const curZM = g.position.z + sceneOrigin.z;
    g.position.y = groundPos ? groundSurfaceYM(ground, curXM, curZM) : startSurfaceY;
  });

  if (!ground) return null;

  const bodyH = dims.heightM - dims.headM * 2; // body carries the frame, head tops it up
  return (
    <group ref={groupRef} position={[sx, targetSurfaceY, sz]} data-testid="player-avatar">
      {/* Body — the SceneCast tapered-cylinder silhouette, sized by generateBody. */}
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[dims.radiusM * 0.65, dims.radiusM, bodyH, 10]} />
        <meshStandardMaterial color={PLAYER_COLOR} roughness={0.8} />
      </mesh>
      {/* Head. */}
      <mesh position={[0, bodyH + dims.headM * 0.9, 0]} castShadow>
        <sphereGeometry args={[dims.headM, 14, 12]} />
        <meshStandardMaterial color={PLAYER_COLOR} roughness={0.7} />
      </mesh>
      {/* Nameplate riding just above the head, same styling as SceneCast. */}
      {playerName ? (
        <Html center position={[0, dims.heightM + 0.5, 0]} distanceFactor={12}>
          <div
            data-testid="player-avatar-label"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              color: 'white',
              fontSize: '12px',
              fontFamily: 'Outfit, sans-serif',
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'rgba(37, 99, 235, 0.82)',
              border: '1px solid rgba(148, 163, 184, 0.5)',
            }}
          >
            {playerName}
          </div>
        </Html>
      ) : null}
    </group>
  );
};

export default PlayerAvatar;
