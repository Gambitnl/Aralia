/**
 * @file VFXSystem.tsx
 * Combat visual effects system for the 3D battle map.
 *
 * Manages all dynamic combat visuals:
 * - Spell zone ground effects (fire, ice, acid, etc.)
 * - Weapon trails during melee attacks
 * - Projectile particles for ranged attacks
 * - Impact effects (sparks, blood decals)
 * - Dynamic point lights during spell effects
 * - Damage number float-up overlays
 * - AoE targeting preview shapes
 *
 * Philosophy: "world-space drama, screen-space restraint" (BG3 style)
 * — dramatic in-world effects, no full-screen flashes or excessive shake.
 *
 * Research references:
 * - Three.js particle systems: https://threejs.org/examples/#webgl_points_sprites
 * - R3F trail/ribbon mesh: Three.js TubeGeometry from point history
 * - BG3 VFX reference: design spec screenshots
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "VFX System" section
 */
import React, { useMemo, useRef, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { BattleMapData, CombatCharacter, EnvironmentalEffect } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;

// Spell zone colors by element type
const ZONE_COLORS: Record<string, { color: number; emissive: number; lightColor: number }> = {
  fire: { color: 0xff4400, emissive: 0xff2200, lightColor: 0xff6600 },
  ice: { color: 0x44aaff, emissive: 0x2288ff, lightColor: 0x66ccff },
  poison: { color: 0x44ff22, emissive: 0x22cc00, lightColor: 0x66ff44 },
  difficult_terrain: { color: 0x886644, emissive: 0x443322, lightColor: 0x886644 },
  web: { color: 0xcccccc, emissive: 0x888888, lightColor: 0xdddddd },
  fog: { color: 0x888899, emissive: 0x444455, lightColor: 0x999999 },
};

// Damage type colors for weapon trails and impact effects
const DAMAGE_COLORS: Record<string, number> = {
  slashing: 0xcccccc,
  piercing: 0xaaaaaa,
  bludgeoning: 0x888888,
  fire: 0xff4400,
  cold: 0x44aaff,
  lightning: 0xffff44,
  thunder: 0x8844ff,
  acid: 0x44ff22,
  poison: 0x22cc44,
  necrotic: 0x8800aa,
  radiant: 0xffdd44,
  force: 0x4488ff,
  psychic: 0xff44aa,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Spell zone ground effect — emissive decal + particle emitter + dynamic light
 */
const SpellZoneEffect: React.FC<{
  tileX: number;
  tileY: number;
  effect: EnvironmentalEffect;
}> = ({ tileX, tileY, effect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const zoneStyle = ZONE_COLORS[effect.type] ?? ZONE_COLORS.fire;

  // Particle positions (pre-allocated, animated in useFrame)
  const particleCount = 30;
  const particlePositions = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * TILE_SIZE * 0.8;
      positions[i * 3 + 1] = Math.random() * 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * TILE_SIZE * 0.8;
    }
    return positions;
  }, []);

  const particleGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(particlePositions.slice(), 3));
    return geo;
  }, [particlePositions]);

  // Animate particles
  useFrame((state) => {
    if (!particlesRef.current) return;
    const positions = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < particleCount; i++) {
      // Rise and respawn
      let y = positions.getY(i) + 0.01;
      if (y > 0.8) {
        y = 0;
        positions.setX(i, (Math.random() - 0.5) * TILE_SIZE * 0.8);
        positions.setZ(i, (Math.random() - 0.5) * TILE_SIZE * 0.8);
      }
      positions.setY(i, y);

      // Slight horizontal drift
      const drift = Math.sin(time * 2 + i * 0.5) * 0.002;
      positions.setX(i, positions.getX(i) + drift);
    }
    positions.needsUpdate = true;
  });

  return (
    <group
      ref={groupRef}
      position={[
        tileX * TILE_SIZE + TILE_SIZE / 2,
        0.05,
        tileY * TILE_SIZE + TILE_SIZE / 2,
      ]}
    >
      {/* Ground decal */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[TILE_SIZE * 0.45, 24]} />
        <meshStandardMaterial
          color={zoneStyle.color}
          emissive={zoneStyle.emissive}
          emissiveIntensity={0.6 + Math.sin(Date.now() * 0.003) * 0.2}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Rising particles */}
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial
          color={zoneStyle.color}
          size={0.04}
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Dynamic point light */}
      <pointLight
        color={zoneStyle.lightColor}
        intensity={0.4}
        distance={3}
        position={[0, 0.3, 0]}
      />
    </group>
  );
};

/**
 * Weapon trail ribbon effect during melee attacks
 */
const WeaponTrail: React.FC<{
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  damageType?: string;
  active: boolean;
}> = ({ startPos, endPos, damageType = 'slashing', active }) => {
  const trailRef = useRef<THREE.Mesh>(null);
  const opacityRef = useRef(1.0);

  const trailColor = DAMAGE_COLORS[damageType] ?? DAMAGE_COLORS.slashing;

  // Fade out effect
  useFrame((_, delta) => {
    if (!trailRef.current) return;
    if (!active) {
      opacityRef.current = Math.max(0, opacityRef.current - delta * 3.3); // ~300ms fade
    } else {
      opacityRef.current = 1.0;
    }
    (trailRef.current.material as THREE.MeshBasicMaterial).opacity = opacityRef.current;
    trailRef.current.visible = opacityRef.current > 0.01;
  });

  // Trail geometry: thin ribbon from start to end
  const geometry = useMemo(() => {
    const curve = new THREE.LineCurve3(startPos, endPos);
    const geo = new THREE.TubeGeometry(curve, 8, 0.02, 4, false);
    return geo;
  }, [startPos, endPos]);

  return (
    <mesh ref={trailRef} geometry={geometry}>
      <meshBasicMaterial
        color={trailColor}
        transparent
        opacity={1.0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

/**
 * Impact burst particles (sparks for physical, element-colored for magical)
 */
const ImpactEffect: React.FC<{
  position: THREE.Vector3;
  damageType?: string;
  onComplete: () => void;
}> = ({ position, damageType = 'slashing', onComplete }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const velocities = useRef<Float32Array | null>(null);

  const color = DAMAGE_COLORS[damageType] ?? DAMAGE_COLORS.slashing;
  const particleCount = 20;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const vels = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0.3;
      positions[i * 3 + 2] = 0;

      // Random velocity directions
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5;
      const speed = 1 + Math.random() * 2;
      vels[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      vels[i * 3 + 1] = Math.cos(phi) * speed;
      vels[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }

    velocities.current = vels;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !velocities.current) return;
    timeRef.current += delta;

    const positions = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < particleCount; i++) {
      positions.setX(i, positions.getX(i) + velocities.current[i * 3] * delta);
      positions.setY(i, positions.getY(i) + velocities.current[i * 3 + 1] * delta - 4 * delta * timeRef.current); // Gravity
      positions.setZ(i, positions.getZ(i) + velocities.current[i * 3 + 2] * delta);
    }
    positions.needsUpdate = true;

    // Fade and remove
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - timeRef.current * 2);

    if (timeRef.current > 0.5) {
      onComplete();
    }
  });

  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry attach="geometry" {...geometry} />
      <pointsMaterial
        color={color}
        size={0.05}
        transparent
        opacity={1}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

/**
 * Blood decal projected onto terrain
 */
const BloodDecal: React.FC<{
  position: THREE.Vector3;
  age: number; // Seconds since creation
}> = ({ position, age }) => {
  const opacity = Math.max(0, 1 - age * 0.05); // Slow fade over 20 seconds

  if (opacity <= 0) return null;

  return (
    <mesh
      position={[position.x, 0.03, position.z]}
      rotation={[-Math.PI / 2, 0, Math.random() * Math.PI * 2]}
    >
      <circleGeometry args={[0.08 + Math.random() * 0.06, 8]} />
      <meshStandardMaterial
        color={0x880000}
        transparent
        opacity={opacity * 0.6}
        depthWrite={false}
      />
    </mesh>
  );
};

/**
 * Damage number float-up overlay (HTML for crisp text)
 */
const DamageNumber: React.FC<{
  position: THREE.Vector3;
  amount: number;
  damageType?: string;
  isCritical?: boolean;
  onComplete: () => void;
}> = ({ position, amount, damageType, isCritical, onComplete }) => {
  const timeRef = useRef(0);
  const [offsetY, setOffsetY] = useState(0);
  const [opacity, setOpacity] = useState(1);

  useFrame((_, delta) => {
    timeRef.current += delta;
    setOffsetY(timeRef.current * 0.8); // Float upward
    setOpacity(Math.max(0, 1 - timeRef.current * 0.8)); // Fade out over ~1.2s

    if (timeRef.current > 1.2) {
      onComplete();
    }
  });

  const color = isCritical ? '#ff4444'
    : damageType === 'heal' ? '#22cc55'
    : '#ffffff';

  return (
    <Html
      position={[position.x, position.y + 0.5 + offsetY, position.z]}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        color,
        fontSize: isCritical ? '16px' : '13px',
        fontWeight: 700,
        textShadow: '0 0 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.5)',
        opacity,
        transform: `scale(${isCritical ? 1.2 : 1})`,
        whiteSpace: 'nowrap',
      }}>
        {damageType === 'heal' ? '+' : '-'}{amount}
        {isCritical && <span style={{ fontSize: '10px', marginLeft: '2px' }}>CRIT!</span>}
      </div>
    </Html>
  );
};

/**
 * AoE targeting preview — ground-projected shape
 */
const AoEPreview: React.FC<{
  tiles: Set<string>;
  type: 'circle' | 'cone' | 'line' | 'square';
}> = ({ tiles, type }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    // Pulsing edge effect
    const pulse = 0.8 + Math.sin(state.clock.elapsedTime * 4) * 0.2;
    meshRef.current.children.forEach(child => {
      if ((child as THREE.Mesh).material) {
        ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = pulse * 0.35;
      }
    });
  });

  const tilePositions = useMemo(() => {
    const positions: { x: number; z: number }[] = [];
    tiles.forEach(tileId => {
      const [tx, tz] = tileId.split('-').map(Number);
      positions.push({ x: tx, z: tz });
    });
    return positions;
  }, [tiles]);

  return (
    <group ref={meshRef}>
      {tilePositions.map((pos, i) => (
        <mesh
          key={i}
          position={[
            pos.x * TILE_SIZE + TILE_SIZE / 2,
            0.06,
            pos.z * TILE_SIZE + TILE_SIZE / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[TILE_SIZE * 0.95, TILE_SIZE * 0.95]} />
          <meshStandardMaterial
            color={0xff4444}
            emissive={0xff2222}
            emissiveIntensity={0.5}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main VFX System component
// ---------------------------------------------------------------------------

interface VFXSystemProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  /** AoE preview tiles from targeting system */
  aoePreviewTiles?: Set<string>;
  /** Whether currently in targeting mode */
  targetingMode?: boolean;
}

const VFXSystem: React.FC<VFXSystemProps> = ({
  mapData,
  characters,
  aoePreviewTiles,
  targetingMode,
}) => {
  // Collect environmental effects from tiles
  const activeEffects = useMemo(() => {
    const effects: { tileX: number; tileY: number; effect: EnvironmentalEffect }[] = [];
    for (const [, tile] of mapData.tiles) {
      if (tile.environmentalEffects) {
        for (const effect of tile.environmentalEffects) {
          effects.push({
            tileX: tile.coordinates.x,
            tileY: tile.coordinates.y,
            effect,
          });
        }
      }
    }
    return effects;
  }, [mapData]);

  return (
    <group>
      {/* Spell zone ground effects */}
      {activeEffects.map((ae, i) => (
        <SpellZoneEffect
          key={`zone-${ae.tileX}-${ae.tileY}-${ae.effect.id}`}
          tileX={ae.tileX}
          tileY={ae.tileY}
          effect={ae.effect}
        />
      ))}

      {/* AoE targeting preview */}
      {targetingMode && aoePreviewTiles && aoePreviewTiles.size > 0 && (
        <AoEPreview tiles={aoePreviewTiles} type="circle" />
      )}
    </group>
  );
};

export default VFXSystem;
