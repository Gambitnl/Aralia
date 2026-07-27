/**
 * @file EntityModel.tsx — the combat actor's body: a generated entity
 * (src/systems/entities3d) breathing in place, with combat action overlays
 * (lunge / recoil / cast rise / death fall) applied to its root.
 *
 * Replaces the box-primitive Humanoid/Beast/Dragon/Ooze/Aberration models.
 * The combat chrome (rings, badges, pips, nameplate) stays in CharacterActor;
 * this component owns only the body.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { EntityBlueprint } from '@/systems/entities3d/types';
import { assembleEntity } from '@/systems/entities3d/three/assembleEntity';
import type { LocomotionState } from '@/systems/entities3d/three/gaits';
import type { AnimationState } from './models';
import { combatOverlayPose } from './entityOverlays';
import {
  easeActorPose,
  type AppliedActorPose,
  type ControlPose,
} from '../../controlOptionPose';

interface EntityModelProps {
  blueprint: EntityBlueprint;
  animState: AnimationState;
  /** Live animation clock — a ref so per-frame time never goes stale. */
  animTimeRef: React.MutableRefObject<number>;
  /** G7 shared contract: sustained control-option pose (grovel/halt/…), eased
   * on per frame and eased back off when the directive expires. Null = base. */
  controlPose?: ControlPose | null;
}

export const EntityModel: React.FC<EntityModelProps> = ({ blueprint, animState, animTimeRef, controlPose = null }) => {
  // Tactical camera distance affords chunkier fields, and stationary tokens
  // don't need 60 Hz body rebuilds — a whole encounter must stay cheap.
  const handle = useMemo(
    () => assembleEntity(blueprint, { resolutionScale: 0.7, fieldUpdateHz: 10 }),
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
  const settledRef = useRef(false);
  // G7: the eased control-option pose lives in a ref so per-frame updates
  // allocate nothing; easeActorPose walks it toward the target (or back to
  // zero on expiry — the restore half of the contract).
  const appliedControlRef = useRef<AppliedActorPose>({ pitch: 0, yOffset: 0 });

  useEffect(() => {
    // leaving death (revive) unfreezes the corpse
    if (animState !== 'death') settledRef.current = false;
  }, [animState]);

  useFrame((state, delta) => {
    const pose = combatOverlayPose(animState, animTimeRef.current);
    // Death overrides any standing directive — a corpse does not grovel.
    const control = easeActorPose(
      appliedControlRef.current,
      animState === 'death' ? null : controlPose,
      delta,
    );
    handle.group.rotation.x = pose.pitch + control.pitch;
    handle.group.position.y = pose.yOffset + control.yOffset;
    if (pose.settled) {
      settledRef.current = true;
      return; // corpse is down — keep the last body frame, skip field rebuilds
    }
    if (!settledRef.current) {
      handle.update(state.clock.elapsedTime, delta, loco.current);
    }
  });

  return <primitive object={handle.group} />;
};
