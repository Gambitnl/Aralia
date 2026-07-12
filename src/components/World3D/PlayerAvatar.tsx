// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 12/07/2026, 00:33:16
 * Dependents: components/World3D/GroundMovePlane.tsx, components/World3D/World3DScene.tsx, components/World3D/World3DWrapper.tsx, components/World3D/combat/InPlaceCombatLayer.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/World3D/PlayerAvatar.tsx
 *
 * The player's own visible body in the streamed ground world — a REAL
 * generated entity (src/systems/entities3d): the character's race sets the
 * body, the class and equipped items set the visible gear, and the blobfolk
 * gait walks the legs. This replaced the tapered-cylinder placeholder when
 * the entity generator shipped (2026-07-11).
 *
 * Anchoring: the body stands at the LOGICAL player position
 * (`playerGroundPos` — tile-local ground meters), NOT the camera. Camera walk
 * and Locale-map click-to-move both dispatch SET_PLAYER_GROUND_POS, so both
 * move this body. Ground elevation is resampled from the ground-world
 * heightfield each move so the figure stays planted on the terrain. The gait
 * driver takes its speed and heading from the same glide, so the legs stride
 * exactly as fast as the body actually moves.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { heightToMeters } from '@/systems/world3d/config';
import type { PlayerCharacter } from '@/types/character';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { recipeFromCharacter } from '@/systems/entities3d/recipeFromCharacter';
import { heightM } from '@/systems/entities3d/types';
import { assembleEntity } from '@/systems/entities3d/three/assembleEntity';
import type { LocomotionState } from '@/systems/entities3d/three/gaits';

registerAllParts();

/**
 * Cheap race scale, kept for legacy callers: small folk get a visibly smaller
 * body. The avatar itself no longer uses this — race frames come from the
 * entity generator's species profiles.
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
  /** The real character — race, class, and equipped gear shape the body.
   * Null (pre-party states) renders no figure: there is no character yet. */
  character?: PlayerCharacter | null;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  groundPos,
  ground,
  sceneOrigin,
  startSurfaceY,
  character,
}) => {
  const blueprint = useMemo(
    () => (character ? generateEntityBlueprint(recipeFromCharacter(character)) : null),
    [character],
  );
  // The marching-cubes body is attractive but expensive to polygonize. A
  // player needs responsive gear, eyes, turning, and movement every frame, but
  // the soft body surface itself does not need to be rebuilt at monitor speed.
  // A smaller field updated ten times per second preserves the animated body
  // while leaving enough frame budget for terrain, buildings, and townsfolk.
  const handle = useMemo(
    () => (blueprint ? assembleEntity(blueprint, { resolutionScale: 0.7, fieldUpdateHz: 10 }) : null),
    [blueprint],
  );
  useEffect(() => {
    handle?.retain();
    return () => handle?.release();
  }, [handle]);

  const groupRef = useRef<THREE.Group>(null);
  const loco = useRef<LocomotionState>({
    position: new THREE.Vector3(),
    heading: new THREE.Vector3(0, 0, 1),
    speed: 0,
  });
  const yawRef = useRef(0);

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
  // while crossing relief. The per-frame displacement drives the gait: speed =
  // how fast the body really moves, heading = which way, so strides match the
  // glide and the figure turns into its direction of travel.
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g || !ground || !handle) return;
    const a = Math.min(1, delta * 6);
    const dx = (sx - g.position.x) * a;
    const dz = (sz - g.position.z) * a;
    g.position.x += dx;
    g.position.z += dz;
    const curXM = g.position.x + sceneOrigin.x;
    const curZM = g.position.z + sceneOrigin.z;
    g.position.y = groundPos ? groundSurfaceYM(ground, curXM, curZM) : startSurfaceY;

    // locomotion from the actual glide (smoothed so strides don't stutter)
    const rawSpeed = delta > 0 ? Math.hypot(dx, dz) / delta : 0;
    const l = loco.current;
    l.speed += (rawSpeed - l.speed) * Math.min(1, delta * 8);
    if (rawSpeed > 0.05) {
      l.heading.set(dx, 0, dz).normalize();
      const targetYaw = Math.atan2(l.heading.x, l.heading.z);
      // shortest-arc turn toward travel direction
      let dYaw = targetYaw - yawRef.current;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      yawRef.current += dYaw * Math.min(1, delta * 8);
    }
    handle.group.rotation.y = yawRef.current;
    handle.update(state.clock.elapsedTime, delta, l);
  });

  if (!ground || !handle || !blueprint || !character) return null;

  return (
    <group ref={groupRef} position={[sx, targetSurfaceY, sz]} data-testid="player-avatar">
      <primitive object={handle.group} />
      {/* Nameplate riding just above the head, same styling as SceneCast. */}
      {character.name ? (
        <Html center position={[0, heightM(blueprint.frame) + 0.5, 0]} distanceFactor={12}>
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
            {character.name}
          </div>
        </Html>
      ) : null}
    </group>
  );
};

export default PlayerAvatar;
