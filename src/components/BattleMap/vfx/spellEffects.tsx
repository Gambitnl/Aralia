// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:02:35
 * Dependents: components/BattleMap/vfx/VFXSystem.tsx
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file vfx/spellEffects.tsx
 * Spell-specific visuals for the 3D combat map: persistent zone ground
 * effects, resolved forced-movement and touch-delivery cues, and the teleport
 * destination vocabulary (candidate pads, active assignment label, chosen
 * destination markers).
 *
 * Extracted from VFXSystem.tsx (task agora-b70d). Everything here is driven by
 * spell state that the 2D combat-map overlay also reads, so the 3D board shows
 * the same tactical information without owning a second copy of spell state.
 * The components are presentational: they take resolved records and render
 * meshes/labels. The two builder functions above them are pure and are what
 * VFXSystem memoizes.
 *
 * Dependencies: react, @react-three/fiber (useFrame), @react-three/drei
 *               (Html, Line), three, types/combat,
 *               systems/spells/effects/triggerHandler (isPositionInArea),
 *               ./vfxConstants, ./particleEmitters
 * Dependents: vfx/VFXSystem.tsx
 */

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import type {
  BattleMapData,
  CombatCharacter,
  EnvironmentalEffect,
  Position,
  SpellDeliveryVisual,
  SpellMovementVisual,
} from '../../../types/combat';
import { isPositionInArea, type ActiveSpellZone } from '../../../systems/spells/effects/triggerHandler';
import { TILE_SIZE, tileCenter } from './vfxConstants';
import {
  ZONE_PARTICLE_COUNT,
  createRisingParticleGeometry,
  createRisingParticlePositions,
  stepRisingParticles,
} from './particleEmitters';

// ---------------------------------------------------------------------------
// Zone styling and classification
// ---------------------------------------------------------------------------

/** Spell zone colors by element type. */
export const ZONE_COLORS: Record<string, { color: number; emissive: number; lightColor: number }> = {
  fire: { color: 0xff4400, emissive: 0xff2200, lightColor: 0xff6600 },
  ice: { color: 0x44aaff, emissive: 0x2288ff, lightColor: 0x66ccff },
  poison: { color: 0x44ff22, emissive: 0x22cc00, lightColor: 0x66ff44 },
  difficult_terrain: { color: 0x886644, emissive: 0x443322, lightColor: 0x886644 },
  web: { color: 0xcccccc, emissive: 0x888888, lightColor: 0xdddddd },
  fog: { color: 0x888899, emissive: 0x444455, lightColor: 0x999999 },
  hazard: { color: 0xee3355, emissive: 0x771122, lightColor: 0xee5577 },
};

/** A per-tile visual payload: which tile, and which environmental effect to draw there. */
export interface TileEffectPlacement {
  tileX: number;
  tileY: number;
  effect: EnvironmentalEffect;
}

export const getSpellZoneEffectType = (zone: ActiveSpellZone): EnvironmentalEffect['type'] => {
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
      if (effect.terrainType === 'damaging') return 'hazard';
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

// ---------------------------------------------------------------------------
// Pure builders (memoized by VFXSystem)
// ---------------------------------------------------------------------------

/** Collect the environmental effects that map tiles already carry. */
export const collectTileEnvironmentalEffects = (mapData: BattleMapData): TileEffectPlacement[] => {
  const effects: TileEffectPlacement[] = [];
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
};

/**
 * Convert structured spell zones into the same per-tile visual payload used by
 * tile environmental effects.
 *
 * Structured zones are not stored as tile environmental effects, so without
 * this the 3D view would silently lose every active spell area. Producing the
 * SAME payload shape (rather than a second renderer) is what keeps the 3D and
 * 2D views showing the same areas without duplicating spell execution state.
 */
export const buildSpellZoneTileEffects = (
  mapData: BattleMapData,
  spellZones: ActiveSpellZone[]
): TileEffectPlacement[] => {
  const effects: TileEffectPlacement[] = [];

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
};

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Spell zone ground effect — emissive decal + particle emitter + dynamic light
 */
export const SpellZoneEffect: React.FC<{
  tileX: number;
  tileY: number;
  effect: EnvironmentalEffect;
}> = ({ tileX, tileY, effect }) => {
  const groupRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const zoneStyle = ZONE_COLORS[effect.type] ?? ZONE_COLORS.fire;

  // Particle positions (pre-allocated, animated in useFrame)
  const particlePositions = useMemo(() => createRisingParticlePositions(ZONE_PARTICLE_COUNT), []);
  const particleGeo = useMemo(
    () => createRisingParticleGeometry(particlePositions),
    [particlePositions]
  );

  // Animate particles
  useFrame((state) => {
    if (!particlesRef.current) return;
    const positions = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
    stepRisingParticles(positions, state.clock.elapsedTime, ZONE_PARTICLE_COUNT);
  });

  return (
    <group
      ref={groupRef}
      position={[tileCenter(tileX), 0.05, tileCenter(tileY)]}
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
 * AoE targeting preview — ground-projected shape
 */
// The hovered-AoE template preview moved to TargetingDecals (task 81): its
// flat per-tile planes at y=0.06 were the buried-on-hills / floating-over-
// banks class of bug (tasks 78-80), and terrain-conforming decals already
// live there with the rest of the targeting vocabulary.

/**
 * Resolved spell movement cue for 3D combat.
 */
export const SpellMovementVisualCue: React.FC<{ visual: SpellMovementVisual }> = ({ visual }) => {
  const isTeleport = visual.type === 'teleport';
  const color = isTeleport ? '#60a5fa' : '#fbbf24';
  const path = visual.path && visual.path.length > 1 ? visual.path : [visual.from, visual.to];
  const points = path.map((position): [number, number, number] => [
    tileCenter(position.x),
    0.18,
    tileCenter(position.y),
  ]);
  const to: [number, number, number] = [
    tileCenter(visual.to.x),
    0.18,
    tileCenter(visual.to.y),
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

export const SpellDeliveryVisualCue: React.FC<{ visual: SpellDeliveryVisual }> = ({ visual }) => {
  const from: [number, number, number] = [
    tileCenter(visual.from.x),
    0.42,
    tileCenter(visual.from.y),
  ];
  const to: [number, number, number] = [
    tileCenter(visual.to.x),
    0.42,
    tileCenter(visual.to.y),
  ];

  return (
    <group>
      {/* Touch delivery is not forced movement. The dotted cyan line shows the
          spell's delivery origin through the permissioned actor so the 3D map
          exposes the same tactical information as the 2D overlay. */}
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
export const TeleportDestinationPreview: React.FC<{ tiles: Set<string> }> = ({ tiles }) => {
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
          position={[tileCenter(pos.x), 0.075, tileCenter(pos.z)]}
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

/**
 * Label naming the creature that currently owns the blue destination pads.
 */
export const TeleportAssignmentLabel: React.FC<{ target: CombatCharacter }> = ({ target }) => (
  <Html
    position={[tileCenter(target.position.x), 1.72, tileCenter(target.position.y)]}
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
      DEST: {target.name}
    </div>
  </Html>
);

/** One destination already chosen during a multi-target teleport assignment. */
export interface AssignedTeleportDestination {
  targetId: string;
  targetName: string;
  destination: Position;
  abilityName: string;
}

export const AssignedTeleportDestinationMarker: React.FC<{
  assignment: AssignedTeleportDestination;
}> = ({ assignment }) => (
  <Html
    position={[
      tileCenter(assignment.destination.x),
      0.62,
      tileCenter(assignment.destination.y),
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
);
