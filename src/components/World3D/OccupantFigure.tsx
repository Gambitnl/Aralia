// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 18/07/2026, 18:30:27
 * Dependents: components/World3D/InteriorOccupants.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// One villager figure: a generated entity (src/systems/entities3d) standing at
// its station — ancestry group, age band, and per-member seed shape the body,
// so an elf household looks elven and children are small. Replaced the clothed
// box + head box (v0) when the entity generator shipped (2026-07-11).
//
// This is the single figure renderer shared by the static roster path and the
// live InteriorOccupants layer. Villagers are commoners: no gear. They idle at
// stations unless the parent supplies a live movement ref, which turns on the
// generated walk gait while that parent changes position. Interiors can hold
// many figures across loaded chunks, so bodies rebuild their metaball fields at
// a low rate and reduced resolution (anchored parts and eyes still track every
// frame).
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { recipeFromOccupant } from '@/systems/entities3d/recipeFromOccupant';
import { assembleEntity } from '@/systems/entities3d/three/assembleEntity';
import type { LocomotionState } from '@/systems/entities3d/three/gaits';

registerAllParts();

export interface OccupantFigureProps {
  /** Stable per-member id — seeds the deterministic body. */
  occupantId: number;
  /** Age band ('child' | 'adult' | 'elder'). */
  ageBand?: string;
  /** Ancestry group name (raceGroups display name); absent on older bakes. */
  race?: string;
  /** Scene-space position of the figure's FEET (floor surface). */
  position: [number, number, number];
  /** Facing yaw about +Y, radians. */
  rotationY?: number;
  /**
   * Optional live movement signal owned by the placement layer. A ref keeps
   * the generated body's gait in sync with per-frame travel without asking
   * React to rebuild the expensive figure on every clock tick.
   */
  motionRef?: React.MutableRefObject<{ moving: boolean }>;
}

/**
 * Render one occupant. The entity's feet are at the group origin so `position`
 * places it directly on the floor (surfaceY + storey elevation).
 */
const OccupantFigure: React.FC<OccupantFigureProps> = ({
  occupantId,
  ageBand = 'adult',
  race,
  position,
  rotationY = 0,
  motionRef,
}) => {
  const blueprint = useMemo(
    () => generateEntityBlueprint(recipeFromOccupant({ id: occupantId, ageBand, race })),
    [occupantId, ageBand, race],
  );
  // Residents stand or perform small station activities rather than sprinting
  // across the foreground. A half-resolution field refreshed three times per
  // second keeps breathing/idle silhouettes alive while the per-frame anchors,
  // eyes, and facing remain smooth. The parent also caps how many can exist.
  const handle = useMemo(
    () => assembleEntity(blueprint, { resolutionScale: 0.5, fieldUpdateHz: 3 }),
    [blueprint],
  );
  useEffect(() => {
    handle.retain();
    return () => handle.release();
  }, [handle]);
  const loco = useRef<LocomotionState>({
    position: new Vector3(),
    heading: new Vector3(0, 0, 1),
    speed: 0,
  });
  useFrame((state, delta) => {
    // The outer placement layer moves and turns the figure. Supplying a
    // positive gait speed here makes the generated legs and body actually
    // walk during that travel instead of sliding in the idle pose.
    loco.current.speed = motionRef?.current.moving ? 1 : 0;
    handle.update(state.clock.elapsedTime, delta, loco.current);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]} userData={{ isOccupant: true }}>
      <primitive object={handle.group} />
    </group>
  );
};

export default OccupantFigure;
