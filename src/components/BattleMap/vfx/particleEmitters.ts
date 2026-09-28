// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 10:05:37
 * Dependents: components/BattleMap/vfx/combatFeedback.tsx, components/BattleMap/vfx/spellEffects.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file vfx/particleEmitters.ts
 * Pure particle-buffer creation and per-frame stepping for the 3D combat VFX.
 *
 * Extracted from VFXSystem.tsx (task agora-b70d). Two emitter shapes were
 * previously written inline inside the SpellZoneEffect and ImpactEffect
 * components, mixing Float32Array bookkeeping with JSX. They live here as
 * plain functions so the math can be read (and tested) without a WebGL canvas,
 * and so a future emitter reuses the buffers instead of copy-pasting them.
 *
 * No React, no hooks, no JSX: callers own the refs and call these from their
 * own useMemo/useFrame. Behavior is unchanged from the inline versions —
 * identical constants, identical update order, identical respawn thresholds.
 *
 * Dependencies: three, ./vfxConstants
 * Dependents: vfx/spellEffects.tsx (rising zone motes),
 *             vfx/combatFeedback.tsx (impact burst)
 */

import * as THREE from 'three';
import { TILE_SIZE } from './vfxConstants';

// ---------------------------------------------------------------------------
// Rising zone motes (spell zone ground effects)
// ---------------------------------------------------------------------------

/** Mote count for a single spell-zone tile. Was inline in SpellZoneEffect. */
export const ZONE_PARTICLE_COUNT = 30;

/**
 * Seed the starting positions for a tile's rising motes.
 *
 * Scattered across 80% of the tile footprint and up to half a world unit high,
 * so a freshly mounted zone does not start as a flat sheet of points.
 */
export const createRisingParticlePositions = (
  particleCount: number = ZONE_PARTICLE_COUNT
): Float32Array => {
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * TILE_SIZE * 0.8;
    positions[i * 3 + 1] = Math.random() * 0.5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * TILE_SIZE * 0.8;
  }
  return positions;
};

/**
 * Build the points geometry for a rising-mote emitter.
 *
 * Copies the seed positions so two zones sharing a seed array cannot animate
 * each other's buffer — the original code sliced for the same reason.
 */
export const createRisingParticleGeometry = (
  particlePositions: Float32Array
): THREE.BufferGeometry => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(particlePositions.slice(), 3));
  return geo;
};

/**
 * Advance rising motes by one frame: climb, respawn at the floor when past the
 * ceiling, and drift horizontally on a per-particle phase offset.
 *
 * @param positions live position attribute of the emitter's geometry
 * @param elapsedTime clock time in seconds, used only for the drift phase
 * @param particleCount how many motes the buffer holds
 */
export const stepRisingParticles = (
  positions: THREE.BufferAttribute,
  elapsedTime: number,
  particleCount: number = ZONE_PARTICLE_COUNT
): void => {
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
    const drift = Math.sin(elapsedTime * 2 + i * 0.5) * 0.002;
    positions.setX(i, positions.getX(i) + drift);
  }
  positions.needsUpdate = true;
};

// ---------------------------------------------------------------------------
// Impact burst (hit sparks)
// ---------------------------------------------------------------------------

/** Spark count for one impact burst. Was inline in ImpactEffect. */
export const IMPACT_PARTICLE_COUNT = 20;

/** Seconds a burst lives before it reports completion. */
export const IMPACT_LIFETIME_SECONDS = 0.5;

/**
 * Build an impact burst: all sparks start at the same point above the hit and
 * carry an outward hemisphere velocity.
 *
 * Returns the geometry AND the velocity buffer, because the caller needs the
 * velocities every frame and they are not a geometry attribute.
 */
export const createImpactBurst = (
  particleCount: number = IMPACT_PARTICLE_COUNT
): { geometry: THREE.BufferGeometry; velocities: Float32Array } => {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0.3;
    positions[i * 3 + 2] = 0;

    // Random velocity directions
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const speed = 1 + Math.random() * 2;
    velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
    velocities[i * 3 + 1] = Math.cos(phi) * speed;
    velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return { geometry: geo, velocities };
};

/**
 * Advance an impact burst by one frame.
 *
 * Gravity is applied as `-4 * delta * age`, which is the original (slightly
 * unusual) integration: acceleration scaled by elapsed age rather than a
 * velocity accumulator. Preserved exactly — changing it would change the arc
 * of every hit spark in the game, which is a look decision, not a refactor.
 */
export const stepImpactBurst = (
  positions: THREE.BufferAttribute,
  velocities: Float32Array,
  delta: number,
  age: number,
  particleCount: number = IMPACT_PARTICLE_COUNT
): void => {
  for (let i = 0; i < particleCount; i++) {
    positions.setX(i, positions.getX(i) + velocities[i * 3] * delta);
    positions.setY(i, positions.getY(i) + velocities[i * 3 + 1] * delta - 4 * delta * age); // Gravity
    positions.setZ(i, positions.getZ(i) + velocities[i * 3 + 2] * delta);
  }
  positions.needsUpdate = true;
};

/** Opacity curve for a burst: linear fade to nothing over half a second. */
export const impactBurstOpacity = (age: number): number => Math.max(0, 1 - age * 2);
