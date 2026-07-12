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

interface EntityModelProps {
  blueprint: EntityBlueprint;
  animState: AnimationState;
  /** Live animation clock — a ref so per-frame time never goes stale. */
  animTimeRef: React.MutableRefObject<number>;
}

export const EntityModel: React.FC<EntityModelProps> = ({ blueprint, animState, animTimeRef }) => {
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

  useEffect(() => {
    // leaving death (revive) unfreezes the corpse
    if (animState !== 'death') settledRef.current = false;
  }, [animState]);

  useFrame((state, delta) => {
    const pose = combatOverlayPose(animState, animTimeRef.current);
    handle.group.rotation.x = pose.pitch;
    handle.group.position.y = pose.yOffset;
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
