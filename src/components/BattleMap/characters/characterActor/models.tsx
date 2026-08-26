/**
 * @file characters/characterActor/models.tsx
 * The actor primitives that are STILL DRAWN: the animation-state union, the
 * BG3-style selection decal, and the active-turn indicator.
 *
 * RETIRED 2026-09-20 (task agora-b8b9): the box-primitive creature models
 * (HumanoidModel, BeastModel, DragonModel, OozeModel, AberrationModel) and
 * their archetype/race derivation (getArchetype, getRaceVisual, RaceVisual,
 * CharacterArchetype). They were the pre-EntityModel placeholders — the file
 * header and their section comment both called them "placeholder for glTF".
 * `./EntityModel` replaced them on the WebGL actor (mounted through
 * `./CharacterBody`) and BattleMap3DGpuScene.tsx replaced them on the WebGPU
 * actor, after which NOTHING in the repo imported any of them — proven by a
 * repo-wide grep that found only this file, its `.d.ts` twin and one
 * historical plan document. Keeping a second, unreachable body renderer
 * around would be exactly the fallback path the project forbids.
 *
 * The bodies themselves are not lost: `systems/entities3d` generates a
 * skinned body per creature type and size, which is what an actor draws now.
 * The deleted source is in git history at the commit before this change.
 */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Animation states
export type AnimationState = 'idle' | 'walk' | 'attack_melee' | 'attack_ranged' | 'cast_spell' | 'hit_react' | 'death';

// ---------------------------------------------------------------------------
// Selection decal (BG3-style ground ring)
// ---------------------------------------------------------------------------

export const SelectionDecal: React.FC<{
  color: number;
  visible: boolean;
  pulse: boolean;
  baseOpacity?: number;
}> = ({ color, visible, pulse, baseOpacity = 0.85 }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current) return;
    if (pulse && visible) {
      const scale = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.08;
      ringRef.current.scale.setScalar(scale);
    } else {
      ringRef.current.scale.setScalar(1.0);
    }
  });

  return (
    <mesh
      ref={ringRef}
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      {/* Thicker/brighter idle ring so EVERY unit has a clearly readable
          team-colored circle at tactical zoom (not just the selected one). */}
      <ringGeometry args={[0.32, 0.46, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={visible ? 1.4 : 1.0}
        transparent
        opacity={visible ? baseOpacity : 0.62}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Active turn indicator (golden ring with rotation animation)
// ---------------------------------------------------------------------------

export const TurnIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pillarMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const arrowMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (!groupRef.current || !active) return;
    // Pulse pillar opacity and emissive
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 2.5) * 0.3;
    if (pillarMatRef.current) {
      pillarMatRef.current.opacity = pulse;
      pillarMatRef.current.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 2.5) * 0.5;
    }
    // Bob the arrow indicator
    if (groupRef.current) {
      groupRef.current.children[1].position.y = 4.8 + Math.sin(state.clock.elapsedTime * 3) * 0.15;
    }
    if (arrowMatRef.current) {
      arrowMatRef.current.opacity = 0.8 + Math.sin(state.clock.elapsedTime * 2.5) * 0.2;
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {/* Tall vertical beam — visible at 20+ units */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 5.0, 8]} />
        <meshStandardMaterial
          ref={pillarMatRef}
          color={0xfbbf24}
          emissive={0xfbbf24}
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>

      {/* Downward-pointing chevron arrow — bobbing above pillar */}
      <group position={[0, 4.8, 0]}>
        {/* Main arrow cone pointing down */}
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 0.45, 8]} />
          <meshStandardMaterial
            ref={arrowMatRef}
            color={0xfbbf24}
            emissive={0xfbbf24}
            emissiveIntensity={2.0}
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        {/* Second arrow cone slightly above for chevron look */}
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.16, 0.32, 8]} />
          <meshStandardMaterial
            color={0xfbbf24}
            emissive={0xfbbf24}
            emissiveIntensity={2.0}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Wide ground ring — enhanced for visibility */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.43, 0.62, 32]} />
        <meshStandardMaterial
          color={0xfbbf24}
          emissive={0xfbbf24}
          emissiveIntensity={1.5}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
