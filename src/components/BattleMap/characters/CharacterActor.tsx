/**
 * @file CharacterActor.tsx
 * 3D character representation for the combat map.
 *
 * Each CombatCharacter is rendered as a CharacterActor containing:
 * - Humanoid procedural model (placeholder until glTF models via Pixal3D pipeline)
 * - Animation state machine (idle sway, walk bob, attack, hit react, death)
 * - BG3-style selection decal (cyan/red ground ring)
 * - Active turn golden ring with pulse animation
 * - Enhanced nameplate with HP bar, name, and status
 * - Smooth position interpolation for movement
 *
 * Research references:
 * - BG3 character selection UI: screenshot analysis from design spec
 * - Three.js AnimationMixer: https://threejs.org/docs/#api/en/animation/AnimationMixer
 * - R3F useFrame for animation: https://r3f.docs.pmnd.rs/api/hooks#useframe
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Character System" section
 */
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CombatCharacter } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;
const ELEVATION_SCALE = 0.3;

// Animation states
type AnimationState = 'idle' | 'walk' | 'attack_melee' | 'attack_ranged' | 'cast_spell' | 'hit_react' | 'death';

// Team colors
const TEAM_COLORS = {
  player: {
    primary: 0x3b82f6,    // Blue
    selection: 0x22d3ee,   // Cyan
    nameAccent: '#3b82f6',
  },
  enemy: {
    primary: 0xdc2626,     // Red
    selection: 0xef4444,   // Light red
    nameAccent: '#ef4444',
  },
  neutral: {
    primary: 0xeab308,     // Yellow
    selection: 0xfbbf24,   // Light yellow
    nameAccent: '#eab308',
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CharacterActorProps {
  character: CombatCharacter;
  isSelected: boolean;
  isTurn: boolean;
  isTargetable: boolean;
  targetingMode: boolean;
  onClick: (character: CombatCharacter) => void;
}

// ---------------------------------------------------------------------------
// Procedural humanoid model (placeholder for glTF)
// ---------------------------------------------------------------------------

/** A simple humanoid shape built from primitives — much better than a capsule */
const HumanoidModel: React.FC<{
  teamColor: number;
  isAlive: boolean;
  animState: AnimationState;
  animTime: number;
}> = ({ teamColor, isAlive, animState, animTime }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Animation parameters
  const idleSway = Math.sin(animTime * 1.5) * 0.02;
  const idleBreathe = Math.sin(animTime * 2.0) * 0.01;
  const walkBob = animState === 'walk' ? Math.abs(Math.sin(animTime * 8)) * 0.05 : 0;
  const attackSwing = animState === 'attack_melee'
    ? Math.sin(Math.min(animTime * 4, Math.PI)) * 0.8 : 0;
  const hitRecoil = animState === 'hit_react'
    ? Math.sin(Math.min(animTime * 6, Math.PI)) * 0.15 : 0;
  const deathFall = animState === 'death'
    ? Math.min(animTime * 2, Math.PI / 2) : 0;

  // Skin tone (warm neutral — works for procedural placeholder)
  const skinColor = 0xd4a57b;
  const armorColor = teamColor;

  return (
    <group
      ref={groupRef}
      rotation={[
        deathFall > 0 ? -deathFall : 0,
        0,
        hitRecoil,
      ]}
      position={[0, walkBob + idleBreathe, 0]}
    >
      {/* Body / torso — armor colored with subtle emissive for visibility */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.22, 0.28, 0.14]} />
        <meshStandardMaterial
          color={armorColor}
          emissive={armorColor}
          emissiveIntensity={0.15}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial
          color={skinColor}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>

      {/* Helmet/hair — darker version of team color */}
      <mesh position={[0, 0.63, 0]}>
        <sphereGeometry args={[0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          color={new THREE.Color(armorColor).multiplyScalar(0.6)}
          roughness={0.4}
          metalness={0.4}
        />
      </mesh>

      {/* Left arm */}
      <group
        position={[-0.16, 0.38, 0]}
        rotation={[idleSway, 0, -0.1 + idleSway * 0.5]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.22, 0.06]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
      </group>

      {/* Right arm — weapon arm */}
      <group
        position={[0.16, 0.38, 0]}
        rotation={[attackSwing, 0, 0.1 - idleSway * 0.5]}
      >
        <mesh castShadow>
          <boxGeometry args={[0.06, 0.22, 0.06]} />
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </mesh>
        {/* Weapon (simple sword) */}
        <mesh position={[0, -0.18, 0.02]} castShadow>
          <boxGeometry args={[0.02, 0.2, 0.01]} />
          <meshStandardMaterial color={0x888888} roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* Left leg */}
      <group position={[-0.06, 0.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.2, 0.08]} />
          <meshStandardMaterial
            color={new THREE.Color(armorColor).multiplyScalar(0.7)}
            roughness={0.6}
            metalness={0.2}
          />
        </mesh>
      </group>

      {/* Right leg */}
      <group position={[0.06, 0.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.07, 0.2, 0.08]} />
          <meshStandardMaterial
            color={new THREE.Color(armorColor).multiplyScalar(0.7)}
            roughness={0.6}
            metalness={0.2}
          />
        </mesh>
      </group>

      {/* Shield (for player team) */}
      <mesh position={[-0.18, 0.32, 0.06]} rotation={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.02, 0.15, 0.12]} />
        <meshStandardMaterial
          color={new THREE.Color(armorColor).multiplyScalar(0.8)}
          roughness={0.4}
          metalness={0.5}
        />
      </mesh>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Selection decal (BG3-style ground ring)
// ---------------------------------------------------------------------------

const SelectionDecal: React.FC<{
  color: number;
  visible: boolean;
  pulse: boolean;
}> = ({ color, visible, pulse }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ringRef.current || !visible) return;
    if (pulse) {
      const scale = 1.0 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      ringRef.current.scale.setScalar(scale);
    }
    ringRef.current.visible = visible;
  });

  return (
    <mesh
      ref={ringRef}
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      visible={visible}
    >
      <ringGeometry args={[0.28, 0.35, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.8}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
};

// ---------------------------------------------------------------------------
// Active turn indicator (golden ring with rotation animation)
// ---------------------------------------------------------------------------

const TurnIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  const ringRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ringRef.current || !active) return;
    ringRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    // Gentle vertical bob
    ringRef.current.position.y = 0.03 + Math.sin(state.clock.elapsedTime * 2) * 0.01;
  });

  if (!active) return null;

  return (
    <group ref={ringRef} position={[0, 0.03, 0]}>
      {/* Inner ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.36, 0.39, 32]} />
        <meshStandardMaterial
          color={0xfbbf24}
          emissive={0xfbbf24}
          emissiveIntensity={1.2}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Outer glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.39, 0.44, 32]} />
        <meshStandardMaterial
          color={0xfbbf24}
          emissive={0xfbbf24}
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Directional arrows (4 small triangles pointing inward) */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(angle) * 0.42,
            0,
            Math.sin(angle) * 0.42,
          ]}
          rotation={[-Math.PI / 2, 0, -angle + Math.PI / 2]}
        >
          <coneGeometry args={[0.025, 0.05, 3]} />
          <meshStandardMaterial
            color={0xfbbf24}
            emissive={0xfbbf24}
            emissiveIntensity={1.0}
          />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const CharacterActor: React.FC<CharacterActorProps> = ({
  character,
  isSelected,
  isTurn,
  isTargetable,
  targetingMode,
  onClick,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const animTimeRef = useRef(0);
  const prevHPRef = useRef(character.currentHP);

  const { x, y } = character.position;
  const isPlayer = character.team === 'player';
  const isAlive = character.currentHP > 0;
  const teamKey = isPlayer ? 'player' : character.team === 'enemy' ? 'enemy' : 'neutral';
  const teamColors = TEAM_COLORS[teamKey];

  // Detect HP changes to trigger hit_react animation
  useEffect(() => {
    if (character.currentHP < prevHPRef.current && character.currentHP > 0) {
      setAnimState('hit_react');
      animTimeRef.current = 0;
    } else if (character.currentHP <= 0) {
      setAnimState('death');
      animTimeRef.current = 0;
    }
    prevHPRef.current = character.currentHP;
  }, [character.currentHP]);

  // Animation tick
  useFrame((_, delta) => {
    animTimeRef.current += delta;

    // Auto-return to idle after timed animations
    if (animState === 'hit_react' && animTimeRef.current > 0.5) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (animState === 'attack_melee' && animTimeRef.current > 0.8) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
    if (animState === 'cast_spell' && animTimeRef.current > 1.0) {
      setAnimState('idle');
      animTimeRef.current = 0;
    }
  });

  // Target highlight color
  const showTargetHighlight = isTargetable && targetingMode;

  // Elevation from tile data (approximate — terrain mesh handles exact positions)
  const elevation = 0; // Characters sit on terrain surface

  // HP percentage for health bar
  const hpPercent = Math.max(0, character.currentHP / character.maxHP);
  const hpColor = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#ef4444';

  return (
    <group
      ref={groupRef}
      position={[
        x * TILE_SIZE + TILE_SIZE / 2,
        elevation,
        y * TILE_SIZE + TILE_SIZE / 2,
      ]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onClick(character);
      }}
    >
      {/* Selection decal — BG3 style ground ring */}
      <SelectionDecal
        color={showTargetHighlight ? 0xef4444 : teamColors.selection}
        visible={isSelected || isTurn || showTargetHighlight}
        pulse={showTargetHighlight}
      />

      {/* Active turn golden ring */}
      <TurnIndicator active={isTurn} />

      {/* Character model — scaled up to be visible at tactical zoom */}
      <group scale={[2.5, 2.5, 2.5]}>
        <HumanoidModel
          teamColor={teamColors.primary}
          isAlive={isAlive}
          animState={isAlive ? animState : 'death'}
          animTime={animTimeRef.current}
        />
      </group>

      {/* Target reticle glow when targetable */}
      {showTargetHighlight && (
        <pointLight
          color={0xef4444}
          intensity={0.5}
          distance={2}
          position={[0, 0.5, 0]}
        />
      )}

      {/* Nameplate — HTML overlay (raised to clear scaled-up model) */}
      <Html
        position={[0, 1.85, 0]}
        center
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          padding: '3px 8px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          fontSize: '11px',
          color: '#e6edf3',
          textAlign: 'center',
          borderLeft: `3px solid ${teamColors.nameAccent}`,
          minWidth: '70px',
        }}>
          {/* Name */}
          <div style={{
            fontWeight: 600,
            fontSize: '10px',
            marginBottom: '2px',
            letterSpacing: '0.5px',
          }}>
            {character.name}
          </div>

          {/* HP bar */}
          <div style={{
            width: '65px',
            height: '5px',
            background: '#1a1a2e',
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <div style={{
              width: `${hpPercent * 100}%`,
              height: '100%',
              background: hpColor,
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {/* HP text */}
          <div style={{
            fontSize: '8px',
            color: '#9ca3af',
            marginTop: '1px',
          }}>
            {character.currentHP}/{character.maxHP}
          </div>
        </div>
      </Html>
    </group>
  );
};

export default CharacterActor;
