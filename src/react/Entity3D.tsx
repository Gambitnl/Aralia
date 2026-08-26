/**
 * @file Entity3D.tsx — React Three Fiber wrapper around assembleEntity.
 *
 * Lives outside src/systems/entities3d on purpose (T15 / WP-REACT): the engine
 * tree must stay framework-free so it depends on three only. All real logic is
 * still in the framework-agnostic assembler; this component just owns the
 * handle's lifecycle and feeds it the frame clock.
 *
 * Called by: R3F scenes (Studio Forge screens, Aralia world/cast scenes)
 * Depends on: the engine assembler, gaits, toon, and blueprint types
 * @preservation Moved verbatim from src/systems/entities3d/three/Entity3D.tsx;
 * only the import specifiers changed. That path keeps a re-export shim.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { SkeletonHelper, Vector3 } from 'three';
import type { EntityBlueprint } from '@/systems/entities3d/types';
import type { LocomotionState } from '@/systems/entities3d/three/gaits';
import { assembleEntity } from '@/systems/entities3d/three/assembleEntity';
import type { BodyTech } from '@/systems/entities3d/three/assembleEntity';
import type { EntityRenderMode } from '@/systems/entities3d/three/toon';

export interface Entity3DProps {
  blueprint: EntityBlueprint;
  /** Walk in place (or along `walkCircleRadius`) instead of idling. */
  walking?: boolean;
  /** Gesture overlay (real-finger update): 'wave' raises the free hand,
   * extends the digits, and rocks it; 'wave_both' raises both hands.
   * Biped gaits only; others ignore it. */
  gesture?: 'wave' | 'wave_both';
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
  /** Draw solid (toon blob) or wireframe. Default: the global ENTITY_RENDER_MODE. */
  renderMode?: EntityRenderMode;
  /** Body construction (skeleton pivot slice 1): rigid segment meshes
   * (default) or the skinned skeleton body. Omitting it changes nothing. */
  bodyTech?: BodyTech;
  /** Skinned weight style (slice 3): 'rigid' segment-look default or
   * 'smooth' one-piece blended tubes. Only read when bodyTech is 'skinned'. */
  skinnedWeights?: 'rigid' | 'smooth';
  /** Draw a SkeletonHelper over the body. Only skinned bodies have bones;
   * on a segment body the helper finds none and nothing is drawn. */
  showBones?: boolean;
  /** PROTOTYPE (hero-style campaign slice A, 2026-08-18): hide every ink
   * shell so the forge can A/B the outline-free reference look against the
   * current look. Scene-level visibility only — the real outline opt-out is
   * slice B in the assembler. */
  heroStyle?: boolean;
  /** The painted ink outline (review toggle, 2026-08-22). Default on. */
  showOutline?: boolean;
}

export function Entity3D({
  blueprint,
  walking = false,
  gesture,
  speed = 1.1,
  walkCircleRadius,
  position = [0, 0, 0],
  yaw = 0,
  resolutionScale,
  fieldUpdateHz,
  renderMode,
  bodyTech,
  skinnedWeights,
  showBones = false,
  heroStyle = false,
  showOutline = true,
}: Entity3DProps) {
  // Keep the numeric performance settings as explicit dependencies. Callers
  // can tune a foreground hero differently from a conversational crowd
  // without rebuilding the handle merely because an options object changed.
  const handle = useMemo(
    () => assembleEntity(blueprint, { resolutionScale, fieldUpdateHz, renderMode, bodyTech, skinnedWeights }),
    [blueprint, fieldUpdateHz, resolutionScale, renderMode, bodyTech, skinnedWeights],
  );
  useEffect(() => {
    handle.retain();
    return () => handle.release();
  }, [handle]);

  // Bone overlay: the helper's line material depth-tests off by default, so
  // the skeleton reads through the flesh. It must ride the SCENE root — the
  // helper adopts its root's world matrix as its own local matrix, so a spot
  // under the entity group would apply the group transform twice.
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!showBones) return;
    const helper = new SkeletonHelper(handle.group);
    if (helper.bones.length === 0) {
      helper.dispose();
      return;
    }
    scene.add(helper);
    return () => {
      scene.remove(helper);
      helper.dispose();
    };
  }, [handle, showBones, scene]);

  // Hero-style prototype: every ink shell's name ends in 'Outline'
  // (segOutline, partOutline, headOutline, skinnedOutline, skinnedChainOutline).
  // The outline toggle (2026-08-22) hides the same shells.
  useEffect(() => {
    if (!heroStyle && showOutline) return;
    const hidden: import('three').Object3D[] = [];
    handle.group.traverse((o) => {
      if (o.name.endsWith('Outline') && o.visible) {
        o.visible = false;
        hidden.push(o);
      }
    });
    return () => {
      for (const o of hidden) o.visible = true;
    };
  }, [handle, heroStyle, showOutline]);

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
    l.gesture = gesture;
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
