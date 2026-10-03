/**
 * @file gaits.ts — the six locomotion drivers, generalized from the blobfolk
 * prototype's hardcoded critters to any Frame.
 *
 * A driver owns the per-frame skeleton math: it advances the gait cycle,
 * emits the body's bone segments (buildBody — body v2: rigid tapered segments
 * between the IK joints, not metaballs), and maintains the Pose — the named
 * anchor transforms that modular parts attach to. Locomotion (where the
 * entity is, which way it faces, how fast it moves) comes from the caller;
 * drivers only need `speed` (and expose `verticalOffsetM` for airborne body
 * lift, applied by the assembler to the body root).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 09/09/2026, 14:48:40
 * Dependents: components/BattleMap/characters/characterActor/EntityModel.tsx, components/DesignPreview/steps/EntityDebugScene.tsx, components/World3D/OccupantFigure.tsx, components/World3D/PlayerAvatar.tsx, react/Entity3D.tsx, systems/entities3d/three/assembleEntity.ts, systems/entities3d/three/crowdBake.ts, systems/entities3d/three/planSkeleton.ts, systems/entities3d/three/skinnedBody.ts, systems/entities3d/three/speciesSkeleton.ts
 * Imports: 7 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Module layout (MOD-3.8, 2026-09-09). This file was 3031 lines; the drivers
 * now live one per module under `gaits/` and this file is the entry barrel —
 * the import path and the export set are unchanged for all seven dependents.
 *
 *   gaits/poseUtils.ts      driver interfaces, makePose, shared math + scratch
 *   gaits/baseDriver.ts     BaseDriver (the shared contract)
 *   gaits/bipedDriver.ts    BipedDriver
 *   gaits/multiLegDriver.ts MultiLegDriver (quad + hexapod)
 *   gaits/hopperDriver.ts   HopperDriver
 *   gaits/airborneDriver.ts AirborneDriver (flyer + float)
 *   gaits/planDriver.ts     PlanDriver — kept WHOLE; its advance/buildBody
 *                           share private instance state, so the packet's
 *                           three-way cut is not a file move (see that file).
 *
 * The driver classes stay module-private to this barrel by convention: nothing
 * outside constructs one directly, and createGaitDriver below is still the only
 * way in.
 */
import type { Frame, Gait, PlanSpec } from '../types';
import { AirborneDriver } from './gaits/airborneDriver';
import { BipedDriver } from './gaits/bipedDriver';
import { HopperDriver } from './gaits/hopperDriver';
import { MultiLegDriver } from './gaits/multiLegDriver';
import { PlanDriver } from './gaits/planDriver';
import type { GaitDriver } from './gaits/poseUtils';

export type { GaitDriver, LocomotionState, PlanHeadSocket, Pose, PoseAnchor } from './gaits/poseUtils';

/* ------------------------------------------------------------------ entry */

export function createGaitDriver(
  gait: Gait,
  frame: Frame,
  planSpec?: PlanSpec,
  /** Body-level facts the driver cannot derive from a Frame. `winged`: the
   * blueprint carries wing mesh parts (garnish) — plan drivers need this to
   * beat wings that are not chain appendages. `crested`: the blueprint
   * carries a finRidge garnish — the plan driver emits the dorsal crest
   * along its live spine (round 9). `grips`: which hands hold a HAFT weapon
   * (real-finger update) — biped digits wrap the haft on those sides. */
  opts?: { winged?: boolean; crested?: boolean; grips?: { L?: boolean; R?: boolean } },
): GaitDriver {
  switch (gait) {
    case 'biped':
      return new BipedDriver(frame, opts?.grips);
    case 'quad':
      return new MultiLegDriver(frame, false);
    case 'hexapod':
      return new MultiLegDriver(frame, true);
    case 'hopper':
      return new HopperDriver(frame);
    case 'flyer':
      return new AirborneDriver(frame, true);
    case 'float':
      return new AirborneDriver(frame, false);
    case 'plan': {
      if (!planSpec) throw new Error('entities3d: plan gait needs a planSpec (compile a CreaturePlan first)');
      return new PlanDriver(frame, planSpec, opts?.winged, opts?.crested);
    }
    default: {
      const never: never = gait;
      throw new Error(`entities3d: unknown gait "${never as string}"`);
    }
  }
}

