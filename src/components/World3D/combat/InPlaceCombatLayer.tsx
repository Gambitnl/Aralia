/**
 * @file InPlaceCombatLayer.tsx — the in-scene combat surface (R3F).
 *
 * Fight-in-place slice 2 ("kill the teleport"): drawn INSIDE World3DScene's
 * Canvas (via its `combatLayer` prop), this renders the fight on the same
 * streamed terrain the player was walking — no phase-swap diorama:
 *
 *  - combatant TOKENS at their tile positions, planted on the real ground
 *    (reuses the PlayerAvatar body recipe + `groundSurfaceYM` height sampler);
 *  - a soft REACHABLE-AREA disc under the active player token (BG3-style, no
 *    visible grid — locked decision #2, gridless presentation);
 *  - an active-turn RING under the current actor;
 *  - an invisible GROUND-PICK plane spanning the patch: a click raycasts to a
 *    world-meters position and calls `onGroundPick`, which the combat surface
 *    routes through the invisible referee (`validateInSceneMove`).
 *
 * It is purely presentational: positions and the reachable radius come in as
 * props (CombatView owns the turn manager / ability system). Tokens interpolate
 * (lerp) toward their target scene position so a committed move glides.
 */
import React, { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { worldToScene } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { groundSurfaceYM } from '../PlayerAvatar';
import {
  GROUND_METERS_PER_CELL_FIP,
} from '@/systems/combat/fightInPlace/inSceneMovement';

const FT_TO_M = 0.3048;

/** One combatant to draw in the scene. */
export interface InPlaceToken {
  id: string;
  name: string;
  /** World-meters position (tile center → world, done by the caller). */
  xM: number;
  zM: number;
  /** 'player' | 'enemy' | 'neutral' — drives the token color. */
  team: 'player' | 'enemy' | 'neutral';
  /** Whether this is the active actor this turn (ring + reachable disc). */
  isActive: boolean;
  /** Approximate body height in meters (defaults to a 6-ft adult). */
  heightM?: number;
}

const TEAM_COLOR: Record<InPlaceToken['team'], string> = {
  player: '#3b82f6', // steel blue (matches the ground PlayerAvatar)
  enemy: '#cc1111',
  neutral: '#eab308',
};

interface TokenBodyProps {
  token: InPlaceToken;
  ground: GroundWorld;
  sceneOrigin: SceneOrigin;
}

/** A single combatant body — the tapered cylinder + head + nameplate silhouette. */
const TokenBody: React.FC<TokenBodyProps> = ({ token, ground, sceneOrigin }) => {
  const groupRef = useRef<THREE.Group>(null);
  const heightM = token.heightM ?? 6 * FT_TO_M * 1.8; // ~1.8 m adult default
  const radiusM = heightM * 0.16;
  const headM = heightM * 0.12;
  const bodyH = heightM - headM * 2;

  // Target scene-space position; lerp the group toward it each frame so a
  // committed move glides instead of snapping (locked decision #2 — actors glide).
  const target = useMemo(() => {
    const s = worldToScene(token.xM, token.zM, sceneOrigin);
    const y = groundSurfaceYM(ground, token.xM, token.zM);
    return new THREE.Vector3(s.x, y, s.z);
  }, [token.xM, token.zM, ground, sceneOrigin]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    // First placement snaps; subsequent moves ease in.
    if (g.position.lengthSq() === 0) g.position.copy(target);
    else g.position.lerp(target, Math.min(1, delta * 6));
  });

  const color = TEAM_COLOR[token.team];
  return (
    <group ref={groupRef} data-testid={`fip-token-${token.id}`}>
      {/* active-turn ground ring */}
      {token.isActive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[radiusM * 1.6, radiusM * 2.2, 40]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      <mesh position={[0, bodyH / 2, 0]} castShadow>
        <cylinderGeometry args={[radiusM * 0.65, radiusM, bodyH, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, bodyH + headM * 0.9, 0]} castShadow>
        <sphereGeometry args={[headM, 14, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <Html center position={[0, heightM + 0.5, 0]} distanceFactor={12}>
        <div
          data-testid={`fip-token-label-${token.id}`}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'Outfit, sans-serif',
            padding: '2px 7px',
            borderRadius: '4px',
            background: token.team === 'enemy' ? 'rgba(190,17,17,0.82)' : 'rgba(37,99,235,0.82)',
            border: '1px solid rgba(148,163,184,0.5)',
          }}
        >
          {token.name}
        </div>
      </Html>
    </group>
  );
};

interface ReachableDiscProps {
  ground: GroundWorld;
  sceneOrigin: SceneOrigin;
  centerXM: number;
  centerZM: number;
  /** Movement budget in feet → disc radius. */
  movementFeet: number;
}

/**
 * The soft reachable-area disc under the active player (BG3 movement ring). A
 * flat translucent circle, radius = movement feet in meters, gently pulsing.
 * No visible grid squares — the tile lattice stays invisible per the spec.
 */
const ReachableDisc: React.FC<ReachableDiscProps> = ({ ground, sceneOrigin, centerXM, centerZM, movementFeet }) => {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const s = worldToScene(centerXM, centerZM, sceneOrigin);
  const y = groundSurfaceYM(ground, centerXM, centerZM) + 0.08;
  const radiusM = movementFeet * FT_TO_M;

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.14 + Math.sin(clock.elapsedTime * 2.2) * 0.05;
    }
  });

  return (
    <mesh
      position={[s.x, y, s.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      data-testid="fip-reachable-disc"
    >
      <circleGeometry args={[radiusM, 48]} />
      <meshBasicMaterial ref={matRef} color="#60a5fa" transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
};

export interface InPlaceCombatLayerProps {
  ground: GroundWorld;
  sceneOrigin: SceneOrigin;
  tokens: InPlaceToken[];
  /** World-meters center of the active player's reachable disc (null = hide). */
  reachable: { centerXM: number; centerZM: number; movementFeet: number } | null;
  /** Patch dimensions (cells) — sizes the invisible ground-pick plane. */
  patchDims: { width: number; height: number };
  /** The extraction anchor world-meters — the plane centers here. */
  anchorXM: number;
  anchorZM: number;
  /** Fired when the player clicks the ground; carries world meters. */
  onGroundPick?: (worldXM: number, worldZM: number) => void;
}

/** The full in-scene combat layer mounted inside World3DScene's Canvas. */
const InPlaceCombatLayer: React.FC<InPlaceCombatLayerProps> = ({
  ground,
  sceneOrigin,
  tokens,
  reachable,
  patchDims,
  anchorXM,
  anchorZM,
  onGroundPick,
}) => {
  // Invisible ground-pick plane covering the patch. Centered on the anchor at a
  // representative surface height; a click raycasts to a scene point we convert
  // back to world meters for the referee.
  const planeW = patchDims.width * GROUND_METERS_PER_CELL_FIP;
  const planeH = patchDims.height * GROUND_METERS_PER_CELL_FIP;
  const anchorScene = worldToScene(anchorXM, anchorZM, sceneOrigin);
  const anchorY = groundSurfaceYM(ground, anchorXM, anchorZM);

  const handlePick = (e: ThreeEvent<PointerEvent>) => {
    if (!onGroundPick) return;
    e.stopPropagation();
    // e.point is scene-space; convert back to world meters.
    const worldXM = e.point.x + sceneOrigin.x;
    const worldZM = e.point.z + sceneOrigin.z;
    onGroundPick(worldXM, worldZM);
  };

  return (
    <group data-testid="fip-combat-layer">
      <mesh
        position={[anchorScene.x, anchorY + 0.02, anchorScene.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePick}
        data-testid="fip-ground-pick-plane"
      >
        <planeGeometry args={[planeW, planeH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {reachable && (
        <ReachableDisc
          ground={ground}
          sceneOrigin={sceneOrigin}
          centerXM={reachable.centerXM}
          centerZM={reachable.centerZM}
          movementFeet={reachable.movementFeet}
        />
      )}
      {tokens.map((t) => (
        <TokenBody key={t.id} token={t} ground={ground} sceneOrigin={sceneOrigin} />
      ))}
    </group>
  );
};

export default InPlaceCombatLayer;
