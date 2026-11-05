/**
 * @file FreeRoamCameraController.tsx
 * @description Free-roam orbit/pan camera for the streamed 3D world. Reports its look-at
 * world position to the parent (throttled) so chunk streaming can follow it.
 *
 * Why this is built this way:
 * - A map-style orbit/pan camera gives a natural "divine overview" suitable for inspecting
 *   infinite procedural terrain without character physical constraints.
 * - Throttling position reporting at ~10 Hz (REPORT_INTERVAL = 0.1s) is critical for performance;
 *   re-evaluating sliding-window loading logic on every single frame would cause CPU overhead
 *   and degrade framerates.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 31/10/2026, 03:47:23
 * Dependents: components/Combat/InPlaceCombatScene.tsx, components/World3D/WebGPUProbeScene.tsx, components/World3D/World3DScene.tsx, components/World3D/playerCameraFrame.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useRef } from 'react';
import { getCameraHold } from './cameraHold';
import { useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';
import {cameraBeforeBuilding, createPlayerCameraProjection, type CameraPoint, type PlayerCameraSightline} from './playerCameraVisibility';
import {createPlayerCameraSelfVisibility} from './playerCameraSelfVisibility';
import { sceneToWorld, type SceneOrigin } from '@/systems/world3d/sceneOrigin';

/**
 * One-shot camera framing command. Town requests create an overhead view;
 * player and party requests return to a source-checked view inside the scene.
 * Bumping `nonce` applies a new request without changing world or actor state.
 */
export interface CameraFrameRequest {
  nonce: number;
  /** A party frame is a bounded one-shot checked against every included body; it is not live group follow. */
  kind?: 'town' | 'player' | 'party';
  /** Optional scene-local camera position for a source-checked street view. */
  position?: readonly [number, number, number];
  target: readonly [number, number, number];
  height: number;
  /** Town inspection shows facades; callers omitting this retain overhead views. */
  oblique?: boolean;
}

interface FreeRoamCameraControllerProps {
  /** Initial look-at target in SCENE-LOCAL coords (typically [0,0,0]). */
  initialTarget: readonly [number, number, number];
  /** Scene origin used to convert the scene-local camera target back to world coords. */
  sceneOrigin: SceneOrigin;
  /** Called (throttled) with the controls' current target in ABSOLUTE WORLD coords. */
  onPositionChange: (worldX: number, worldZ: number) => void;
  /** Dolly floor in meters — walking-scale scenes want ~2, map scale ~20. */
  minDistance?: number;
  /** Dolly ceiling in meters. */
  maxDistance?: number;
  /** Optional one-shot overhead framing command (see CameraFrameRequest). */
  frameRequest?: CameraFrameRequest | null;
  /** Ground-only rendered structure query; other camera consumers retain free orbit. */
  playerSightline?: PlayerCameraSightline;
  /** Actual accepted body focus, never a requested destination. */
  getPlayerTarget?: () => CameraPoint | null;
}

const REPORT_INTERVAL = 0.1; // seconds (~10 Hz)

const FreeRoamCameraController: React.FC<FreeRoamCameraControllerProps> = ({
  initialTarget,
  sceneOrigin,
  onPositionChange,
  minDistance = 20,
  maxDistance = 2000,
  frameRequest = null,
  playerSightline,
  getPlayerTarget,
}) => {
  const controlsRef = useRef<any>(null);
  const selfVisibility = React.useMemo(() => createPlayerCameraSelfVisibility(), []);
  const closeProjection = React.useMemo(() => createPlayerCameraProjection(), []);
  React.useEffect(() => () => {selfVisibility.restore(); closeProjection.restore();}, [selfVisibility, closeProjection]);
  const sinceReport = useRef(0);
  const lastReported = useRef(new THREE.Vector2(NaN, NaN));
  // Keep the explicit command distinct from its later streamed geometry result.
  // A loading-time view may be refined until the person moves or takes control.
  const appliedFrameNonce = useRef<string | null>(null);
  const appliedFrameRequest = useRef<CameraFrameRequest | null>(null);
  // A validated party view is deliberately stationary until the camera or
  // accepted footing actually changes. Keep its real focus and arm so later
  // wall checks protect the chosen party framing without following the leader.
  const partyCameraPose = useRef<{key: string; focus: CameraPoint; eye: CameraPoint;
    player: CameraPoint | null; playerOffset: number} | null>(null);
  const mayRefinePlayerFrame = useRef(false);
  const heldViewKeys = useRef(new Set<string>());
  const cancelPlayerRefinement = React.useCallback(() => { mayRefinePlayerFrame.current = false; }, []);
  React.useEffect(() => {
    const down = (event: KeyboardEvent) => { heldViewKeys.current.add(event.code || event.key); cancelPlayerRefinement(); };
    const up = (event: KeyboardEvent) => { heldViewKeys.current.delete(event.code || event.key); };
    const blur = () => { heldViewKeys.current.clear(); cancelPlayerRefinement(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [cancelPlayerRefinement]);
  // A wall shortens the visible camera arm, not the player's chosen zoom.
  // Retain that choice so leaving a doorway restores the view automatically.
  const requestedPlayerDistance = useRef<number | null>(null);
  const lastPlayerDistance = useRef<number | null>(null);
  // A low porch can block a steep arm while a shallower view stays outside the
  // figure. Remember the chosen elevation separately from that temporary view.
  const requestedPlayerElevation = useRef<number | null>(null);
  const lastPlayerElevation = useRef<number | null>(null);
  // A rejected orbit must not leave the eye behind the obstruction. Remember
  // only a geometry-checked pose; a door or a new footfall can invalidate it.
  const lastClearPlayerView = useRef<{focus: CameraPoint; eye: CameraPoint} | null>(null);
  // True while a camera hold switched the controls off (so release turns them on again).
  const holdDisabledControls = useRef(false);
  // Keep the initial target prop stable while controls pan or frame a town.
  // Streamer rerenders must not reapply the spawn target over that live pose.
  const controlsInitialTarget = React.useMemo<[number, number, number]>(
    () => [initialTarget[0], initialTarget[1], initialTarget[2]],
    [initialTarget[0], initialTarget[1], initialTarget[2]],
  );

  useFrame((three, delta) => {
    const controls = controlsRef.current;
    if (!controls?.target) { selfVisibility.restore(); closeProjection.restore(); return; }
    controls.minDistance = minDistance;

    // THE CAMERA HOLD (2026-10-30, `cameraHold.ts`): while a probe holds the
    // camera, it stands at the held pose every frame and the player's camera
    // input is off; the HUD shows a "Camera held" badge with a Release button.
    // On release the controls come back on from the held pose.
    const held = getCameraHold();
    if (held) {
      if (controls.enabled) { controls.enabled = false; holdDisabledControls.current = true; }
      three.camera.position.set(held.cam[0], held.cam[1], held.cam[2]);
      controls.target.set(held.target[0], held.target[1], held.target[2]);
      controls.update();
      return;
    }
    if (holdDisabledControls.current) { controls.enabled = true; holdDisabledControls.current = false; }

    // One-shot overhead framing (HUD "Town Cell"): apply when the nonce changes.
    // Done in useFrame so the controls ref is guaranteed live; a steep angle (12%
    // of height) keeps MapControls out of its gimbal-locked straight-down pole.
    const frameKey = frameRequest ? `${frameRequest.kind ?? 'frame'}:${frameRequest.nonce}` : null;
    const previousRequest = appliedFrameRequest.current;
    const bodyAtRequest = getPlayerTarget?.();
    if (mayRefinePlayerFrame.current && previousRequest && bodyAtRequest
      && Math.hypot(...bodyAtRequest.map((value, i) => value - previousRequest.target[i])) > .01) {
      mayRefinePlayerFrame.current = false;
    }
    // The first request can precede the inn meshes. Once they arrive, accept
    // the newly checked view of the SAME stationary feet, without a second click.
    // Orbit/pan/zoom or keyboard input owns the view from then on; a streamed
    // rerender must never redirect held movement or snap back a deliberate view.
    const refinedPlayerFrame = frameRequest?.kind === 'player' && frameKey === appliedFrameNonce.current
      && mayRefinePlayerFrame.current && heldViewKeys.current.size === 0 && previousRequest && bodyAtRequest
      && frameRequest.position && previousRequest.position
      && frameRequest.target.every((value, i) => Math.abs(value - previousRequest.target[i]) <= .01)
      && frameRequest.position.some((value, i) => Math.abs(value - previousRequest.position![i]) > 1e-6)
      && (!playerSightline || playerSightline(frameRequest.target, frameRequest.position) === null);
    let partyFrameApplied = false;
    if (frameRequest && (frameKey !== appliedFrameNonce.current || refinedPlayerFrame)) {
      if (frameKey !== appliedFrameNonce.current) mayRefinePlayerFrame.current = frameRequest.kind === 'player';
      appliedFrameNonce.current = frameKey;
      appliedFrameRequest.current = frameRequest;
      const [tx, ty, tz] = frameRequest.target;
      const off = frameRequest.height * (frameRequest.oblique ? 0.8 : 0.12);
      if (frameRequest.position) three.camera.position.set(...frameRequest.position);
      else three.camera.position.set(tx + off, ty + frameRequest.height, tz + off);
      controls.target.set(tx, ty, tz);
      requestedPlayerDistance.current = frameRequest.kind === 'player'
        ? three.camera.position.distanceTo(controls.target) : null;
      lastPlayerDistance.current = null;
      requestedPlayerElevation.current = null;
      lastPlayerElevation.current = null;
      lastClearPlayerView.current = null;
      controls.update();
      if (frameRequest.kind === 'party' && frameRequest.position && frameKey !== null) {
        const focus: CameraPoint = [controls.target.x, controls.target.y, controls.target.z];
        const eye: CameraPoint = [three.camera.position.x, three.camera.position.y, three.camera.position.z];
        const player = getPlayerTarget?.() ?? null;
        const playerOffset = player ? Math.hypot(focus[0] - player[0], focus[2] - player[2]) : Infinity;
        partyCameraPose.current = {key: frameKey, focus, eye, player, playerOffset};
        // The explicit party selector has already checked every included body.
        // Retain that pose as the first safe heading for a later changed view.
        if (!playerSightline || playerSightline(focus, eye) === null) lastClearPlayerView.current = {focus, eye};
        partyFrameApplied = true;
      } else partyCameraPose.current = null;
    }

    const partyState = frameRequest?.kind === 'party' && partyCameraPose.current?.key === frameKey
      ? partyCameraPose.current : null;
    const partyFocus: CameraPoint = [controls.target.x, controls.target.y, controls.target.z];
    const partyEye: CameraPoint = [three.camera.position.x, three.camera.position.y, three.camera.position.z];
    const partyPlayer = getPlayerTarget?.() ?? null;
    const partyFocusMove = partyState ? Math.hypot(partyFocus[0] - partyState.focus[0], partyFocus[2] - partyState.focus[2]) : 0;
    const partyPlayerMove = partyState && partyPlayer && partyState.player
      ? Math.hypot(partyPlayer[0] - partyState.player[0], partyPlayer[2] - partyState.player[2]) : 0;
    const partyMoveFollowsFeet = partyFocusMove > .02 && partyPlayerMove > .02 && partyState && partyPlayer && partyState.player
      && Math.hypot((partyFocus[0] - partyState.focus[0]) - (partyPlayer[0] - partyState.player[0]),
        (partyFocus[2] - partyState.focus[2]) - (partyPlayer[2] - partyState.player[2])) < .08;
    const partyArmChanged = partyState && Math.hypot(
      (partyEye[0] - partyFocus[0]) - (partyState.eye[0] - partyState.focus[0]),
      (partyEye[1] - partyFocus[1]) - (partyState.eye[1] - partyState.focus[1]),
      (partyEye[2] - partyFocus[2]) - (partyState.eye[2] - partyState.focus[2])) > .02;
    const nearPartyFocus = partyState && partyPlayer
      && Math.hypot(partyFocus[0] - partyPlayer[0], partyFocus[2] - partyPlayer[2]) <= Math.max(1, partyState.playerOffset + .75);
    const checkChangedPartyView = Boolean(partyState && !partyFrameApplied && nearPartyFocus
      && (partyArmChanged || partyMoveFollowsFeet));

    // The keyboard translates the arm before this pass. Check changed party
    // views at their current focus and retract before opaque rendered walls.
    // Panning away and town/combat overview commands retain their own framing.
    let wallShortenedCamera = false;
    let partyViewCheckedClear = false;
    if (frameRequest?.kind === 'player' || checkChangedPartyView) {
      const body = getPlayerTarget?.();
      const focusNearPlayer = body && Math.hypot(controls.target.x - body[0], controls.target.z - body[2])
        < (frameRequest?.kind === 'party' && partyState ? Math.max(1, partyState.playerOffset + .75) : 1);
      if (frameRequest?.kind === 'player' && body && focusNearPlayer) {
        const rise = body[1] - controls.target.y;
        three.camera.position.y += rise;
        controls.target.y = body[1];
      }
      if (playerSightline && (frameRequest?.kind === 'party' ? focusNearPlayer : !body || focusNearPlayer)) {
        const focus: CameraPoint = [controls.target.x, controls.target.y, controls.target.z];
        const eye: CameraPoint = [three.camera.position.x, three.camera.position.y, three.camera.position.z];
        const currentDistance = Math.hypot(eye[0] - focus[0], eye[1] - focus[1], eye[2] - focus[2]);
        // Keyboard following translates eye and focus together. A changed arm
        // length between our writes is an orbit zoom, which takes precedence.
        if (requestedPlayerDistance.current === null || (lastPlayerDistance.current !== null
          && Math.abs(currentDistance - lastPlayerDistance.current) > .02)) {
          requestedPlayerDistance.current = currentDistance;
        }
        const horizontal = Math.hypot(eye[0] - focus[0], eye[2] - focus[2]);
        const elevation = Math.atan2(eye[1] - focus[1], horizontal);
        if (requestedPlayerElevation.current === null || (lastPlayerElevation.current !== null
          && Math.abs(elevation - lastPlayerElevation.current) > .005)) {
          requestedPlayerElevation.current = elevation;
        }
        const eyeAt = (angle: number): CameraPoint => {
          const radius = requestedPlayerDistance.current!;
          const scale = horizontal > 0 ? radius * Math.cos(angle) / horizontal : 0;
          return [focus[0] + (eye[0] - focus[0]) * scale,
            focus[1] + radius * Math.sin(angle), focus[2] + (eye[2] - focus[2]) * scale];
        };
        let clearEye = cameraBeforeBuilding(focus, eyeAt(requestedPlayerElevation.current), playerSightline);
        const armLength = (point: CameraPoint | null) => point
          ? Math.hypot(point[0] - focus[0], point[1] - focus[1], point[2] - focus[2]) : 0;
        // A low porch may need a shallower eye; a rising outdoor bank may need
        // a higher one. Recover the longest legal arm before accepting a short
        // view that fades the body. Every candidate checks the same mounted
        // walls, ceilings and ground. Keep yaw fixed so held keys retain their
        // direction, and never extend beyond the player's requested zoom.
        if (body && horizontal > 1e-6 && armLength(clearEye) < requestedPlayerDistance.current - .02) {
          const lower = [Math.PI / 10, Math.PI / 20, Math.PI / 50]
            .filter(angle => angle < requestedPlayerElevation.current!);
          const higher = [Math.PI / 10, Math.PI / 6, Math.PI / 4, Math.PI / 3]
            .filter(angle => angle > requestedPlayerElevation.current!);
          for (const angle of [...lower, ...higher]) {
            const candidate = cameraBeforeBuilding(focus, eyeAt(angle), playerSightline);
            if (armLength(candidate) > armLength(clearEye) + .02) clearEye = candidate;
            if (armLength(clearEye) >= requestedPlayerDistance.current - .02) break;
          }
        }
        if (clearEye) {
          const clearDistance = Math.hypot(clearEye[0] - focus[0], clearEye[1] - focus[1], clearEye[2] - focus[2]);
          // Retract immediately for walls; recover gradually along the same
          // heading. Changing the yaw here would redirect held walking keys.
          const distance = Math.min(clearDistance, currentDistance + 3 * Math.min(Math.max(delta, 0), .1));
          wallShortenedCamera = distance < currentDistance - .02;
          const fraction = clearDistance > 0 ? distance / clearDistance : 1;
          controls.minDistance = Math.min(minDistance, distance);
          three.camera.position.set(focus[0] + (clearEye[0] - focus[0]) * fraction,
            focus[1] + (clearEye[1] - focus[1]) * fraction, focus[2] + (clearEye[2] - focus[2]) * fraction);
        }
      }
      if (wallShortenedCamera) {
        // A rejected turn still needs its leftover damping checked against the wall.
        // Ordinary clear orbit/pan input gets only MapControls’ one normal update.
        controls.update();
      }
      if (playerSightline && (!body || Math.hypot(controls.target.x - body[0], controls.target.z - body[2]) < 1)) {
        const focus: CameraPoint = [controls.target.x, controls.target.y, controls.target.z];
        let eye: CameraPoint = [three.camera.position.x, three.camera.position.y, three.camera.position.z];
        // MapControls applies damping during update, after the first wall check.
        // Validate the pose that will actually render, including that last turn.
        let finalClear = playerSightline(focus, eye) === null;
        if (!finalClear) {
          // A deliberate turn may fit on a shorter arm. Keep that new heading
          // before recalling an older view; otherwise doorways can pin orbit.
          // Drain damping before applying the checked eye so leftover rotation
          // cannot carry it through the wall. Feet and focus never move here.
          const turnedEye = cameraBeforeBuilding(focus, eye, playerSightline);
          if (turnedEye) {
            const damping = controls.enableDamping;
            controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
            three.camera.position.set(...turnedEye);
            controls.minDistance = Math.min(minDistance, three.camera.position.distanceTo(controls.target));
            controls.update();
            eye = [three.camera.position.x, three.camera.position.y, three.camera.position.z];
            finalClear = playerSightline(focus, eye) === null;
          }
        }
        if (!finalClear) {
          const previous = lastClearPlayerView.current;
          if (previous) {
            const oldX = previous.eye[0] - previous.focus[0], oldZ = previous.eye[2] - previous.focus[2];
            const newX = eye[0] - focus[0], newZ = eye[2] - focus[2];
            const sameFocus = Math.hypot(...focus.map((value, i) => value - previous.focus[i])) < 1e-6;
            const horizontalLengths = Math.hypot(oldX, oldZ) * Math.hypot(newX, newZ);
            const sameHeading = horizontalLengths > 1e-12 && (oldX * newX + oldZ * newZ) / horizontalLengths > 1 - 1e-8;
            // Reject a turn at stationary feet, or reuse a shorter arm on the
            // same heading while walking. Never redirect held movement keys.
            if (sameFocus || sameHeading) {
              const recalled: CameraPoint = [focus[0] + oldX,
                focus[1] + previous.eye[1] - previous.focus[1], focus[2] + oldZ];
              const fallback = cameraBeforeBuilding(focus, recalled, playerSightline);
              if (fallback) {
                // Flush the rejected orbit's remaining damping once, then put
                // the eye back on the rechecked side of the real obstruction.
                const damping = controls.enableDamping;
                controls.enableDamping = false; controls.update(); controls.enableDamping = damping;
                three.camera.position.set(...fallback);
                controls.minDistance = Math.min(minDistance, three.camera.position.distanceTo(controls.target));
                controls.update();
                eye = [three.camera.position.x, three.camera.position.y, three.camera.position.z];
                finalClear = playerSightline(focus, eye) === null;
              }
            }
          }
        }
        if (finalClear) {
          lastClearPlayerView.current = {focus, eye};
          if (frameRequest?.kind === 'party') partyViewCheckedClear = true;
        }
        lastPlayerDistance.current = three.camera.position.distanceTo(controls.target);
        lastPlayerElevation.current = Math.atan2(three.camera.position.y - controls.target.y,
          Math.hypot(three.camera.position.x - controls.target.x, three.camera.position.z - controls.target.z));
      }
    }

    // A town command or deliberate pan starts a different view. Do not carry
    // its orbit history back into player follow after inspection.
    const followedBody = getPlayerTarget?.();
    if ((frameRequest?.kind !== 'player' && frameRequest?.kind !== 'party')
      || (frameRequest?.kind === 'player' && followedBody
        && Math.hypot(controls.target.x - followedBody[0], controls.target.z - followedBody[2]) >= 1)
      || (frameRequest?.kind === 'party' && !nearPartyFocus)) {
      lastClearPlayerView.current = null;
    }

    const deliberatePartyPan = Boolean(partyState && partyFocusMove > .02 && !partyMoveFollowsFeet && !partyArmChanged);
    if (partyState && (partyViewCheckedClear || deliberatePartyPan)) {
      // Compare future changes with the actual checked pose, not a new center
      // around Bram. A pan that moves focus away from the frozen party center
      // remains the player's choice and is outside these wall-follow checks.
      partyCameraPose.current = { ...partyState,
        focus: [controls.target.x, controls.target.y, controls.target.z],
        eye: [three.camera.position.x, three.camera.position.y, three.camera.position.z],
        player: getPlayerTarget?.() ?? null };
    }

    // When real walls compress the arm against the figure, keep the room
    // readable through a lead-only silhouette. This never moves the camera,
    // body or a collider, and restores source materials outside player follow.
    const followingPlayer = Boolean(
      frameRequest?.kind === 'player' && playerSightline && followedBody
      && Math.hypot(controls.target.x - followedBody[0], controls.target.z - followedBody[2]) < 1,
    );
    selfVisibility.update(three.scene, three.camera.position, followingPlayer, three.camera);
    closeProjection.update(three.camera, followingPlayer, three.camera.position.distanceTo(controls.target));

    // Dev hooks: expose the live camera pose (read every frame) and a pose
    // SETTER so external tooling (headless capture replication, orchestrator
    // screenshot review) can mirror the user's exact framing.
    const w = window as unknown as {
      __wf3dPose?: object;
      __wf3dSetPose?: (cam: number[], target: number[]) => void;
    };
    w.__wf3dPose = {
      cam: three.camera.position.toArray(),
      target: controls.target.toArray(),
    };
    if (!w.__wf3dSetPose) {
      w.__wf3dSetPose = (cam: number[], target: number[]) => {
        three.camera.position.set(cam[0], cam[1], cam[2]);
        controls.target.set(target[0], target[1], target[2]);
        controls.update();
      };
    }

    sinceReport.current += delta;
    if (sinceReport.current < REPORT_INTERVAL) return;

    sinceReport.current = 0;
    const t = controls.target as THREE.Vector3;

    if (lastReported.current.x !== t.x || lastReported.current.y !== t.z) {
      lastReported.current.set(t.x, t.z);
      // Controls operate in scene-local space; the streamer needs absolute world coords.
      const w = sceneToWorld(t.x, t.z, sceneOrigin);
      onPositionChange(w.x, w.z);
    }
  });

  // Keyboard walking reads Canvas.controls to move this target with the
  // camera. Without registration, MapControls pulls the view back toward the
  // old doorway while the player continues walking.
  return (
    <MapControls
      makeDefault
      ref={controlsRef}
      onStart={cancelPlayerRefinement}
      target={controlsInitialTarget}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={Math.PI * 0.1}
      maxPolarAngle={Math.PI * 0.48}
      enableDamping
      dampingFactor={0.08}
    />
  );
};

export default FreeRoamCameraController;
