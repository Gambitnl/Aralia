// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:03:56
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
 * @file vfx/combatFeedback.tsx
 * Per-creature and per-hit combat feedback for the 3D battle map: floating
 * damage/heal/miss numbers, weapon trails, impact sparks, blood decals, and
 * the creature-attached status / concentration / rider / delayed-spell badges.
 *
 * Extracted from VFXSystem.tsx (task agora-b70d). This module answers "what
 * just happened to this creature" — the spell-area vocabulary lives in
 * ./spellEffects and the lighting/visibility vocabulary in
 * ./environmentEffects.
 *
 * PRESERVED, NOT DEAD: WeaponTrail, ImpactEffect, and BloodDecal are built and
 * exported but not yet mounted by VFXSystem. They were already unmounted in
 * the pre-split file — the melee/impact hookup is unfinished work, not
 * leftovers. They are kept (and given a shared, tested emitter in
 * ./particleEmitters) so that hookup stays a wiring job rather than a rewrite.
 *
 * Dependencies: react, @react-three/fiber (useFrame), @react-three/drei (Html),
 *               three, types/combat,
 *               systems/spells/effects/triggerHandler (trigger record types),
 *               ./vfxConstants, ./particleEmitters
 * Dependents: vfx/VFXSystem.tsx
 */

import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { CombatCharacter, Position } from '../../../types/combat';
import type {
  MovementTriggerDebuff,
  ScheduledSpellEffect,
} from '../../../systems/spells/effects/triggerHandler';
import { tileCenter } from './vfxConstants';
import {
  IMPACT_LIFETIME_SECONDS,
  IMPACT_PARTICLE_COUNT,
  createImpactBurst,
  impactBurstOpacity,
  stepImpactBurst,
} from './particleEmitters';

/** Damage type colors for weapon trails and impact effects. */
export const DAMAGE_COLORS: Record<string, number> = {
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
// Hit visuals
// ---------------------------------------------------------------------------

/**
 * Weapon trail ribbon effect during melee attacks
 */
export const WeaponTrail: React.FC<{
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
export const ImpactEffect: React.FC<{
  position: THREE.Vector3;
  damageType?: string;
  onComplete: () => void;
}> = ({ position, damageType = 'slashing', onComplete }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);
  const velocities = useRef<Float32Array | null>(null);

  const color = DAMAGE_COLORS[damageType] ?? DAMAGE_COLORS.slashing;

  const geometry = useMemo(() => {
    const burst = createImpactBurst(IMPACT_PARTICLE_COUNT);
    velocities.current = burst.velocities;
    return burst.geometry;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current || !velocities.current) return;
    timeRef.current += delta;

    const positions = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    stepImpactBurst(positions, velocities.current, delta, timeRef.current, IMPACT_PARTICLE_COUNT);

    // Fade and remove
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = impactBurstOpacity(timeRef.current);

    if (timeRef.current > IMPACT_LIFETIME_SECONDS) {
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
export const BloodDecal: React.FC<{
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

// ---------------------------------------------------------------------------
// Floating numbers
// ---------------------------------------------------------------------------

/**
 * Damage number float-up overlay (HTML for crisp text)
 */
export const DamageNumber: React.FC<{
  position: THREE.Vector3;
  amount: number;
  damageType?: string;
  isCritical?: boolean;
  durationMs?: number;
  onComplete: () => void;
}> = ({ position, amount, damageType, isCritical, durationMs = 1200, onComplete }) => {
  const timeRef = useRef(0);
  const [offsetY, setOffsetY] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const durationSeconds = Math.max(0.3, durationMs / 1000);

  useFrame((_, delta) => {
    timeRef.current += delta;
    // Slower rise + hold-then-fade (GOAL #16): the old linear fade meant a
    // number was already half-transparent halfway through its life, which at
    // tactical zoom read as a flicker. Hold full opacity for the first 40%,
    // then fade out over the remainder.
    setOffsetY(timeRef.current * 0.5);
    const holdSeconds = durationSeconds * 0.4;
    setOpacity(
      timeRef.current <= holdSeconds
        ? 1
        : Math.max(0, 1 - (timeRef.current - holdSeconds) / (durationSeconds - holdSeconds))
    );

    if (timeRef.current > durationSeconds) {
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

  // No distanceFactor: like the 2D overlay's fixed 24px numbers, combat
  // feedback keeps a constant screen size at every zoom. The old
  // distanceFactor={10} shrank a 13px number to ~4.6px at the 30u tactical
  // distance (scale = 10 / (2·tan(fov/2)·dist)) — invisible over foliage
  // (GOAL #16). Hard 4-way outline mirrors the 2D overlay's '2px 2px 0 #000'
  // language so the number survives any terrain color behind it.
  return (
    <Html
      position={[position.x, position.y + 0.5 + offsetY, position.z]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        color,
        fontSize: isCritical ? '22px' : '16px',
        fontWeight: 700,
        textShadow: '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 2px 2px 3px rgba(0,0,0,0.7)',
        opacity,
        transform: `scale(${isCritical ? 1.2 : 1})`,
        whiteSpace: 'nowrap',
      }}>
        {label}
        {isCritical && <span style={{ fontSize: '12px', marginLeft: '2px' }}>CRIT!</span>}
      </div>
    </Html>
  );
};

// ---------------------------------------------------------------------------
// Creature-attached state badges
// ---------------------------------------------------------------------------

/** A concentration / status / rider badge bound to a creature's tile. */
export interface CreatureStateMarker {
  id: string;
  position: Position;
  label: string;
  title: string;
  color: string;
  border: string;
  background: string;
  /** Stacking index; the renderer spreads badges over four height steps. */
  offset: number;
}

/**
 * Derive concentration, status-effect, and rider badges from character state.
 *
 * These creature-attached markers give the 3D map parity with 2D token/overlay
 * information. They are driven directly from character state, so concentration
 * cleanup removes the labels at the same time it clears statuses, riders, or
 * the caster's concentration pointer.
 */
export const buildCreatureStateMarkers = (characters: CombatCharacter[]): CreatureStateMarker[] => {
  const markers: CreatureStateMarker[] = [];

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
};

export const CreatureStateBadge: React.FC<{ marker: CreatureStateMarker }> = ({ marker }) => (
  <Html
    position={[
      tileCenter(marker.position.x),
      1.55 + (marker.offset % 4) * 0.14,
      tileCenter(marker.position.y),
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
);

/** A delayed or movement-triggered spell badge bound to a creature's tile. */
export interface TargetBoundSpellMarker {
  id: string;
  targetId: string;
  label: string;
  title: string;
  position: Position;
}

/**
 * Derive "this creature is carrying a trigger" badges.
 *
 * Delayed target-bound spell state needs a 3D affordance too. A compact Html
 * label above the actor's tile communicates the same information as the 2D
 * overlay. Markers whose target is no longer on the board are dropped.
 */
export const buildTargetBoundSpellMarkers = (
  characters: CombatCharacter[],
  scheduledSpellEffects: ScheduledSpellEffect[],
  movementDebuffs: MovementTriggerDebuff[]
): TargetBoundSpellMarker[] => {
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
};

export const TargetBoundSpellBadge: React.FC<{
  marker: TargetBoundSpellMarker;
  /** Stacking index; alternating rows keep two badges on one tile readable. */
  index: number;
}> = ({ marker, index }) => (
  <Html
    position={[
      tileCenter(marker.position.x),
      1.45 + (index % 2) * 0.16,
      tileCenter(marker.position.y),
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
);
