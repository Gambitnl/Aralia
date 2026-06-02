// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:57:34
 * Dependents: components/BattleMap/vfx/index.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { BattleMapData, CombatCharacter, EnvironmentalEffect, LightLevel, LightSource, type DamageNumber as CombatDamageNumber, type Position, type SpellDeliveryVisual, type SpellMovementVisual } from '../../../types/combat';
import {
  isPositionInArea,
  type ActiveSpellZone,
  type MovementTriggerDebuff,
  type ScheduledSpellEffect
} from '../../../systems/spells/effects/triggerHandler';

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

const getSpellZoneEffectType = (zone: ActiveSpellZone): EnvironmentalEffect['type'] => {
  // Persistent spell zones keep their source effects. Convert that source data
  // into the existing 3D environmental-effect vocabulary so a fire zone glows
  // hot while web/fog/poison zones read differently on the 3D board.
  for (const effect of zone.effects) {
    if (effect.type === 'DAMAGE') {
      const damageType = effect.damage.type;
      if (damageType === 'fire') return 'fire';
      if (damageType === 'cold') return 'ice';
      if (damageType === 'poison' || damageType === 'acid') return 'poison';
    }

    if (effect.type === 'TERRAIN') {
      if (effect.terrainType === 'difficult') return 'difficult_terrain';
      if (effect.terrainType === 'obscuring') return 'fog';
      if (effect.terrainType === 'blocking' || effect.terrainType === 'wall') return 'web';
      if (effect.damage?.type === 'fire') return 'fire';
      if (effect.damage?.type === 'cold') return 'ice';
      if (effect.damage?.type === 'poison' || effect.damage?.type === 'acid') return 'poison';
    }

    if (effect.type === 'STATUS_CONDITION') {
      const statusName = effect.statusCondition.name.toLowerCase();
      if (statusName.includes('restrained') || statusName.includes('grappled')) return 'web';
      if (statusName.includes('blinded')) return 'fog';
      if (statusName.includes('poisoned')) return 'poison';
    }
  }

  return 'fog';
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

  // Use the same outcome language as the 2D overlay so the 3D map does not
  // quietly lose combat feedback when a spell heals, damages, or misses.
  const color = isCritical ? '#ff4444'
    : damageType === 'heal' ? '#22cc55'
    : damageType === 'miss' ? '#9ca3af'
    : damageType === 'save' ? '#60a5fa'
    : damageType === 'resist' ? '#facc15'
    : damageType === 'immune' ? '#c084fc'
    : '#ff6666';

  // Non-damaging spell outcomes are visible board events. Show them as words
  // rather than zero-value numbers so the 3D map can distinguish ordinary misses
  // from saves, resistance, and immunity.
  const label = damageType === 'miss' ? 'MISS'
    : damageType === 'save' ? 'SAVE'
    : damageType === 'resist' ? 'RESIST'
    : damageType === 'immune' ? 'IMMUNE'
    : `${damageType === 'heal' ? '+' : '-'}${amount}`;

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
        {label}
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

/**
 * Resolved spell movement cue for 3D combat.
 */
const SpellMovementVisualCue: React.FC<{ visual: SpellMovementVisual }> = ({ visual }) => {
  const isTeleport = visual.type === 'teleport';
  const color = isTeleport ? '#60a5fa' : '#fbbf24';
  const path = visual.path && visual.path.length > 1 ? visual.path : [visual.from, visual.to];
  const points = path.map((position): [number, number, number] => [
    position.x * TILE_SIZE + TILE_SIZE / 2,
    0.18,
    position.y * TILE_SIZE + TILE_SIZE / 2,
  ]);
  const to: [number, number, number] = [
    visual.to.x * TILE_SIZE + TILE_SIZE / 2,
    0.18,
    visual.to.y * TILE_SIZE + TILE_SIZE / 2,
  ];

  return (
    <group>
      {/* This line shows the actual resolved movement after command validation,
          not a speculative preview. Forced movement uses a routed path when the
          runtime provides one; teleports remain a jump from source to target. */}
      <Line
        points={points}
        color={color}
        lineWidth={isTeleport ? 2 : 3}
        transparent
        opacity={0.92}
      />
      <Html
        position={[to[0], 0.55, to[2]]}
        center
        distanceFactor={9}
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          padding: '2px 6px',
          borderRadius: 999,
          border: `1px solid ${color}`,
          background: 'rgba(2, 6, 23, 0.82)',
          color,
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: 0.6,
          whiteSpace: 'nowrap',
          boxShadow: `0 0 10px ${color}`,
        }}>
          {isTeleport ? 'BLINK' : 'PUSH'}
        </div>
      </Html>
    </group>
  );
};

const SpellDeliveryVisualCue: React.FC<{ visual: SpellDeliveryVisual }> = ({ visual }) => {
  const from: [number, number, number] = [
    visual.from.x * TILE_SIZE + TILE_SIZE / 2,
    0.42,
    visual.from.y * TILE_SIZE + TILE_SIZE / 2,
  ];
  const to: [number, number, number] = [
    visual.to.x * TILE_SIZE + TILE_SIZE / 2,
    0.42,
    visual.to.y * TILE_SIZE + TILE_SIZE / 2,
  ];

  return (
    <group>
      {/* Touch delivery is not forced movement. The dotted cyan line shows the
          spell's delivery origin through the familiar so the 3D map exposes
          the same tactical information as the 2D overlay. */}
      <Line
        points={[from, to]}
        color="#22d3ee"
        lineWidth={2}
        transparent
        opacity={0.92}
        dashed
      />
      <Html position={[from[0], 0.86, from[2]]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div style={{
          padding: '2px 6px',
          borderRadius: 999,
          border: '1px solid rgba(165, 243, 252, 0.92)',
          background: 'rgba(8, 47, 73, 0.86)',
          color: '#ecfeff',
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: 0.55,
          whiteSpace: 'nowrap',
          boxShadow: '0 0 10px rgba(34, 211, 238, 0.58)',
        }}>
          {visual.label}
        </div>
      </Html>
    </group>
  );
};

/**
 * Teleport destination preview for the 3D combat map.
 */
const TeleportDestinationPreview: React.FC<{ tiles: Set<string> }> = ({ tiles }) => {
  const meshRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const pulse = 0.7 + Math.sin(state.clock.elapsedTime * 5) * 0.25;
    meshRef.current.children.forEach(child => {
      if ((child as THREE.Mesh).material) {
        ((child as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = pulse * 0.42;
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
            0.075,
            pos.z * TILE_SIZE + TILE_SIZE / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {/* Blue destination pads communicate "blink here" separately from the
              red AoE preview used for damage or area effects. */}
          <ringGeometry args={[TILE_SIZE * 0.22, TILE_SIZE * 0.45, 24]} />
          <meshStandardMaterial
            color={0x38bdf8}
            emissive={0x0284c7}
            emissiveIntensity={0.75}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

export interface TileVisibilityOverlay {
  id: string;
  position: Position;
  color: string;
  opacity: number;
}

/**
 * Build the 3D tile masks that communicate tactical visibility.
 *
 * This helper is exported so tests can prove hidden/dim/dark tile decisions
 * without mounting a WebGL canvas. The renderer below only turns these plain
 * overlay records into Three.js meshes.
 */
export const buildTileVisibilityOverlays = (
  mapData: BattleMapData,
  lightLevels?: Map<string, LightLevel>,
  visibleTiles?: Set<string>
): TileVisibilityOverlay[] => {
  const overlays: TileVisibilityOverlay[] = [];

  for (const [, tile] of mapData.tiles) {
    const tileId = tile.id;
    const isVisible = visibleTiles ? visibleTiles.has(tileId) : true;
    const level = lightLevels?.get(tileId) ?? 'bright';

    if (!isVisible) {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#020617', opacity: 0.78 });
    } else if (level === 'darkness') {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#020617', opacity: 0.42 });
    } else if (level === 'dim') {
      overlays.push({ id: tileId, position: tile.coordinates, color: '#0f172a', opacity: 0.24 });
    }
  }

  return overlays;
};

/**
 * Live light-source glow for the 3D combat map.
 */
const LightSourceVisual: React.FC<{ source: LightSource; position: Position }> = ({ source, position }) => {
  const brightTiles = Math.max(0.25, source.brightRadius / 5);
  const totalTiles = Math.max(brightTiles, (source.brightRadius + source.dimRadius) / 5);
  const color = source.color === 'cold' ? '#93c5fd' : source.color === 'green' ? '#bef264' : '#fde68a';

  return (
    <group position={[position.x * TILE_SIZE + TILE_SIZE / 2, 0.08, position.y * TILE_SIZE + TILE_SIZE / 2]}>
      {/* The larger dim ring and smaller bright disk mirror the structured
          LightSource radii so light creation and concentration cleanup become
          visible in 3D instead of only affecting hidden visibility math. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[brightTiles * TILE_SIZE, totalTiles * TILE_SIZE, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.28}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[brightTiles * TILE_SIZE, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.38}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <pointLight color={color} intensity={0.7} distance={Math.max(2, totalTiles * 1.25)} position={[0, 0.8, 0]} />
      <Html position={[0, 0.72, 0]} center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div style={{
          padding: '2px 6px',
          borderRadius: 999,
          border: '1px solid rgba(253, 230, 138, 0.88)',
          background: 'rgba(69, 26, 3, 0.82)',
          color: '#fef3c7',
          fontSize: 8,
          fontWeight: 900,
          letterSpacing: 0.5,
          whiteSpace: 'nowrap',
        }}>
          LIGHT
        </div>
      </Html>
    </group>
  );
};

// ---------------------------------------------------------------------------
// Main VFX System component
// ---------------------------------------------------------------------------

interface VFXSystemProps {
  mapData: BattleMapData;
  characters: CombatCharacter[];
  /** Active structured spell zones shared with the 2D combat-map overlay. */
  spellZones?: ActiveSpellZone[];
  /** Target-bound delayed spell effects shared with the 2D combat-map overlay. */
  scheduledSpellEffects?: ScheduledSpellEffect[];
  /** Target-bound movement punishments shared with the 2D combat-map overlay. */
  movementDebuffs?: MovementTriggerDebuff[];
  /** Live light sources shared with visibility and the 2D combat-map overlay. */
  activeLightSources?: LightSource[];
  /** Tile light levels calculated from live light sources. */
  lightLevels?: Map<string, LightLevel>;
  /** Tiles currently visible to the chosen observer. */
  visibleTiles?: Set<string>;
  /** Floating damage/heal/miss feedback shared with the 2D combat-map overlay. */
  damageNumbers?: CombatDamageNumber[];
  /** Resolved forced-movement and teleport cues shared with the 2D combat-map overlay. */
  spellMovementVisuals?: SpellMovementVisual[];
  /** Familiar-origin touch delivery cues shared with the 2D combat-map overlay. */
  spellDeliveryVisuals?: SpellDeliveryVisual[];
  /** AoE preview tiles from targeting system */
  aoePreviewTiles?: Set<string>;
  /** Teleport destination candidates from the targeting system. */
  teleportDestinationPreviewTiles?: Set<string>;
  /** Current creature whose teleport destination is being assigned. */
  teleportDestinationPreviewTarget?: CombatCharacter;
  /** Current teleport spell name for active assignment labels. */
  teleportDestinationPreviewAbilityName?: string;
  /** Destinations already chosen during a multi-target teleport assignment. */
  assignedTeleportDestinations?: Array<{ targetId: string; targetName: string; destination: Position; abilityName: string }>;
  /** Whether currently in targeting mode */
  targetingMode?: boolean;
}

const VFXSystem: React.FC<VFXSystemProps> = ({
  mapData,
  characters,
  spellZones = [],
  scheduledSpellEffects = [],
  movementDebuffs = [],
  activeLightSources = [],
  lightLevels,
  visibleTiles,
  damageNumbers = [],
  spellMovementVisuals = [],
  spellDeliveryVisuals = [],
  aoePreviewTiles,
  teleportDestinationPreviewTiles,
  teleportDestinationPreviewTarget,
  teleportDestinationPreviewAbilityName,
  assignedTeleportDestinations = [],
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

  // Structured spell zones are not stored as tile environmental effects. Convert
  // them into the same per-tile visual payload used by existing 3D ground VFX so
  // the 3D view can show the same active areas as the 2D map without duplicating
  // the actual spell execution state.
  const activeSpellZoneEffects = useMemo(() => {
    const effects: { tileX: number; tileY: number; effect: EnvironmentalEffect }[] = [];

    for (const zone of spellZones) {
      if (!zone.areaOfEffect) continue;
      const effectType = getSpellZoneEffectType(zone);

      for (const [, tile] of mapData.tiles) {
        if (!isPositionInArea(tile.coordinates, zone.position, zone.areaOfEffect, zone.direction)) {
          continue;
        }

        effects.push({
          tileX: tile.coordinates.x,
          tileY: tile.coordinates.y,
          effect: {
            id: `spell-zone-${zone.id}`,
            type: effectType,
            duration: zone.expiresAtRound ?? 1,
            sourceSpellId: zone.spellId,
            casterId: zone.casterId,
            effect: {
              id: `spell-zone-status-${zone.id}`,
              name: zone.spellId,
              type: 'neutral',
              duration: 1
            }
          }
        });
      }
    }

    return effects;
  }, [mapData, spellZones]);

  // Delayed target-bound spell state needs a 3D affordance too. Use a compact
  // Html label above the actor's tile so the 3D view communicates the same
  // "this creature is carrying a trigger" information as the 2D overlay.
  const targetBoundSpellMarkers = useMemo(() => {
    const markers = [
      ...scheduledSpellEffects.map(effect => ({
        id: `scheduled-${effect.id}`,
        targetId: effect.targetId,
        label: 'DELAY',
        title: `${effect.spellId} resolves on ${effect.timing.replace('_', ' ')}`
      })),
      ...movementDebuffs.map(debuff => ({
        id: `movement-${debuff.id}`,
        targetId: debuff.targetId,
        label: 'MOVE',
        title: `${debuff.spellId} triggers if this target moves`
      }))
    ];

    return markers.flatMap(marker => {
      const target = characters.find(character => character.id === marker.targetId);
      return target ? [{ ...marker, position: target.position }] : [];
    });
  }, [characters, movementDebuffs, scheduledSpellEffects]);

  // These creature-attached markers give the 3D map parity with 2D token/overlay
  // information. They are driven directly from character state, so concentration
  // cleanup removes the labels at the same time it clears statuses, riders, or
  // the caster's concentration pointer.
  const creatureStateMarkers = useMemo(() => {
    const markers: Array<{
      id: string;
      position: Position;
      label: string;
      title: string;
      color: string;
      border: string;
      background: string;
      offset: number;
    }> = [];

    characters.forEach(character => {
      if (character.concentratingOn) {
        markers.push({
          id: `concentration-${character.id}`,
          position: character.position,
          label: 'CONC',
          title: `${character.name} is concentrating on ${character.concentratingOn.spellName}`,
          color: '#f5d0fe',
          border: 'rgba(240, 171, 252, 0.9)',
          background: 'rgba(88, 28, 135, 0.86)',
          offset: markers.length
        });
      }

      (character.statusEffects || []).forEach(effect => {
        markers.push({
          id: `status-${character.id}-${effect.id}`,
          position: character.position,
          label: effect.type === 'buff' ? 'BUFF' : effect.type === 'debuff' ? 'DEBUFF' : 'STATUS',
          title: `${character.name}: ${effect.name}`,
          color: effect.type === 'buff' ? '#bbf7d0' : effect.type === 'debuff' ? '#fecaca' : '#e5e7eb',
          border: effect.type === 'buff' ? 'rgba(134, 239, 172, 0.82)' : effect.type === 'debuff' ? 'rgba(252, 165, 165, 0.82)' : 'rgba(229, 231, 235, 0.72)',
          background: 'rgba(2, 6, 23, 0.84)',
          offset: markers.length
        });
      });

      (character.riders || []).forEach(rider => {
        const target = rider.targetId
          ? characters.find(candidate => candidate.id === rider.targetId)
          : null;
        const markerOwner = target ?? character;

        markers.push({
          id: `rider-${character.id}-${rider.id}`,
          position: markerOwner.position,
          label: 'RIDER',
          title: `${rider.sourceName} rider from ${character.name}`,
          color: '#f5d0fe',
          border: 'rgba(245, 208, 254, 0.82)',
          background: 'rgba(74, 4, 78, 0.84)',
          offset: markers.length
        });
      });
    });

    return markers;
  }, [characters]);

  // Resolve structured light sources to world positions. Attached lights follow
  // their caster/target; point lights use their stored tile position.
  const lightSourceMarkers = useMemo(() => (
    activeLightSources.flatMap(source => {
      const attachedCharacter = source.attachedToCharacterId
        ? characters.find(character => character.id === source.attachedToCharacterId)
        : null;
      const caster = characters.find(character => character.id === source.casterId);
      const position = attachedCharacter?.position || source.position || caster?.position;
      return position ? [{ source, position }] : [];
    })
  ), [activeLightSources, characters]);

  // Tile visibility overlays are deliberately separate from light-source glows.
  // Glows show where light originates; these masks show what the active viewer
  // can actually see after visibility rules are applied.
  const tileVisibilityOverlays = useMemo(
    () => buildTileVisibilityOverlays(mapData, lightLevels, visibleTiles),
    [lightLevels, mapData, visibleTiles]
  );

  return (
    <group>
      {/* Spell zone ground effects */}
      {[...activeEffects, ...activeSpellZoneEffects].map((ae, i) => (
        <SpellZoneEffect
          key={`zone-${ae.tileX}-${ae.tileY}-${ae.effect.id}`}
          tileX={ae.tileX}
          tileY={ae.tileY}
          effect={ae.effect}
        />
      ))}

      {/* Live light-source glows */}
      {lightSourceMarkers.map(({ source, position }) => (
        <LightSourceVisual key={`light-${source.id}`} source={source} position={position} />
      ))}

      {/* Tactical visibility masks */}
      {tileVisibilityOverlays.map(overlay => (
        <mesh
          key={`visibility-${overlay.id}`}
          position={[
            overlay.position.x * TILE_SIZE + TILE_SIZE / 2,
            0.085,
            overlay.position.y * TILE_SIZE + TILE_SIZE / 2,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[TILE_SIZE, TILE_SIZE]} />
          <meshBasicMaterial
            color={overlay.color}
            transparent
            opacity={overlay.opacity}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* AoE targeting preview */}
      {targetingMode && aoePreviewTiles && aoePreviewTiles.size > 0 && (
        <AoEPreview tiles={aoePreviewTiles} type="circle" />
      )}

      {/* Teleport destination preview */}
      {targetingMode && teleportDestinationPreviewTiles && teleportDestinationPreviewTiles.size > 0 && (
        <TeleportDestinationPreview tiles={teleportDestinationPreviewTiles} />
      )}

      {/* Active teleport assignment label */}
      {targetingMode && teleportDestinationPreviewTarget && teleportDestinationPreviewAbilityName && (
        <Html
          position={[
            teleportDestinationPreviewTarget.position.x * TILE_SIZE + TILE_SIZE / 2,
            1.72,
            teleportDestinationPreviewTarget.position.y * TILE_SIZE + TILE_SIZE / 2,
          ]}
          center
          distanceFactor={9}
          style={{ pointerEvents: 'none' }}
        >
          {/* This label keeps the 3D map explicit about which creature owns the
              current blue teleport destination rings. */}
          <div style={{
            padding: '3px 7px',
            borderRadius: 999,
            border: '1px solid rgba(186, 230, 253, 0.9)',
            background: 'rgba(8, 47, 73, 0.86)',
            color: '#e0f2fe',
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: 0.6,
            whiteSpace: 'nowrap',
            boxShadow: '0 0 12px rgba(56, 189, 248, 0.55)',
          }}>
            DEST: {teleportDestinationPreviewTarget.name}
          </div>
        </Html>
      )}

      {/* Chosen teleport destinations during multi-target assignment */}
      {assignedTeleportDestinations.map((assignment) => (
        <Html
          key={`assigned-teleport-${assignment.targetId}`}
          position={[
            assignment.destination.x * TILE_SIZE + TILE_SIZE / 2,
            0.62,
            assignment.destination.y * TILE_SIZE + TILE_SIZE / 2,
          ]}
          center
          distanceFactor={9}
          style={{ pointerEvents: 'none' }}
        >
          {/* These markers persist after a destination is chosen but before the
              whole multi-target teleport resolves, giving the 3D map parity
              with the 2D assignment view. */}
          <div
            title={`${assignment.abilityName} destination chosen for ${assignment.targetName}`}
            style={{
              padding: '2px 6px',
              borderRadius: 999,
              border: '1px solid rgba(224, 242, 254, 0.92)',
              background: 'rgba(3, 105, 161, 0.86)',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.55,
              whiteSpace: 'nowrap',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
            }}
          >
            SET: {assignment.targetName}
          </div>
        </Html>
      ))}

      {/* Floating combat feedback from the shared turn manager. This keeps the
          3D view at parity with the 2D overlay for spell damage, healing, and
          miss-style outcomes without creating a separate visual state model. */}
      {damageNumbers.map(damageNumber => (
        <DamageNumber
          key={damageNumber.id}
          position={new THREE.Vector3(
            damageNumber.position.x * TILE_SIZE + TILE_SIZE / 2,
            1.4,
            damageNumber.position.y * TILE_SIZE + TILE_SIZE / 2
          )}
          amount={damageNumber.value}
          damageType={damageNumber.type}
          onComplete={() => undefined}
        />
      ))}

      {/* Familiar touch-delivery origin cues */}
      {spellDeliveryVisuals.map(visual => (
        <SpellDeliveryVisualCue key={visual.id} visual={visual} />
      ))}

      {/* Resolved forced-movement and teleport cues */}
      {spellMovementVisuals.map(visual => (
        <SpellMovementVisualCue key={visual.id} visual={visual} />
      ))}

      {/* Creature-attached status, concentration, and rider markers */}
      {creatureStateMarkers.map(marker => (
        <Html
          key={marker.id}
          position={[
            marker.position.x * TILE_SIZE + TILE_SIZE / 2,
            1.55 + (marker.offset % 4) * 0.14,
            marker.position.y * TILE_SIZE + TILE_SIZE / 2,
          ]}
          center
          distanceFactor={9}
        >
          <div
            title={marker.title}
            style={{
              padding: '2px 5px',
              borderRadius: 999,
              border: `1px solid ${marker.border}`,
              background: marker.background,
              color: marker.color,
              fontSize: 8,
              fontWeight: 900,
              letterSpacing: 0.55,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: `0 0 8px ${marker.border}`,
            }}
          >
            {marker.label}
          </div>
        </Html>
      ))}

      {/* Target-bound delayed and movement-triggered spell markers */}
      {targetBoundSpellMarkers.map((marker, index) => (
        <Html
          key={marker.id}
          position={[
            marker.position.x * TILE_SIZE + TILE_SIZE / 2,
            1.45 + (index % 2) * 0.16,
            marker.position.y * TILE_SIZE + TILE_SIZE / 2,
          ]}
          center
          distanceFactor={9}
        >
          <div
            title={marker.title}
            style={{
              padding: '2px 5px',
              borderRadius: 4,
              border: '1px solid rgba(253, 230, 138, 0.75)',
              background: 'rgba(2, 6, 23, 0.82)',
              color: '#fef3c7',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.6,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {marker.label}
          </div>
        </Html>
      ))}
    </group>
  );
};

export default VFXSystem;
