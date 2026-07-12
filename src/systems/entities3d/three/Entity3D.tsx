// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/07/2026, 00:33:51
 * Dependents: components/DesignPreview/steps/EntityForgeScene.tsx, components/World3D/SceneCast.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file Entity3D.tsx — thin React Three Fiber wrapper around assembleEntity.
 *
 * Keeps all real logic in the framework-agnostic assembler; this component
 * just owns the handle's lifecycle and feeds it the frame clock.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { EntityBlueprint } from '../types';
import type { LocomotionState } from './gaits';
import { assembleEntity } from './assembleEntity';

export interface Entity3DProps {
  blueprint: EntityBlueprint;
  /** Walk in place (or along `walkCircleRadius`) instead of idling. */
  walking?: boolean;
  /** Ground speed while walking, m/s. */
  speed?: number;
  /** When set, the entity strolls a circle of this radius (showcase mode). */
  walkCircleRadius?: number;
  position?: [number, number, number];
  /** Face direction (radians around Y) when not circling. */
  yaw?: number;
  /**
   * Scale the soft-body field resolution for the camera distance where this
   * figure appears. Values below one keep groups of characters affordable.
   */
  resolutionScale?: number;
  /**
   * Rebuild the expensive soft-body surface at most this many times a second.
   * Gear, eyes, facing, and group movement still update every rendered frame.
   */
  fieldUpdateHz?: number;
}

export function Entity3D({
  blueprint,
  walking = false,
  speed = 1.1,
  walkCircleRadius,
  position = [0, 0, 0],
  yaw = 0,
  resolutionScale,
  fieldUpdateHz,
}: Entity3DProps) {
  // Keep the numeric performance settings as explicit dependencies. Callers
  // can tune a foreground hero differently from a conversational crowd
  // without rebuilding the handle merely because an options object changed.
  const handle = useMemo(
    () => assembleEntity(blueprint, { resolutionScale, fieldUpdateHz }),
    [blueprint, fieldUpdateHz, resolutionScale],
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
  const angle = useRef(Math.random() * Math.PI * 2);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const l = loco.current;
    l.speed = walking ? speed : 0;
    if (walking && walkCircleRadius && walkCircleRadius > 0) {
      angle.current += (speed / walkCircleRadius) * dt;
      const a = angle.current;
      handle.group.position.set(
        position[0] + Math.cos(a) * walkCircleRadius,
        position[1],
        position[2] + Math.sin(a) * walkCircleRadius,
      );
      // face the direction of travel
      handle.group.rotation.y = -a;
      l.heading.set(-Math.sin(a), 0, Math.cos(a));
    } else {
      handle.group.position.set(position[0], position[1], position[2]);
      handle.group.rotation.y = yaw;
      l.heading.set(Math.sin(yaw), 0, Math.cos(yaw));
    }
    handle.update(t, dt, l);
  });

  return <primitive object={handle.group} />;
}
