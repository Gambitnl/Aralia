/**
 * @file src/components/World3D/PlayerAvatar.tsx
 *
 * The player's own visible body in the streamed ground world — a REAL
 * generated entity (src/systems/entities3d): the character's race sets the
 * body, the class and equipped items set the visible gear, and the blobfolk
 * gait walks the legs. This replaced the tapered-cylinder placeholder when
 * the entity generator shipped (2026-07-11).
 *
 * Anchoring: the body stands at the LOGICAL player position
 * (`playerGroundPos` — tile-local ground meters), NOT the camera. Camera walk
 * and Locale-map click-to-move both dispatch SET_PLAYER_GROUND_POS, so both
 * move this body. Ground elevation is resampled from the ground-world
 * heightfield each move so the figure stays planted on the terrain. The gait
 * driver takes its speed and heading from the same glide, so the legs stride
 * exactly as fast as the body actually moves.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 17:34:25
 * Dependents: components/World3D/PartyGroundActors.tsx, components/World3D/World3DScene.tsx
 * Imports: 22 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import type { GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import { GROUND_METERS_PER_CELL } from '@/systems/worldforge/bridge/groundWorldAdapter';
import { heightToMeters } from '@/systems/world3d/config';
import type { PlayerCharacter } from '@/types/character';
import { registerAllParts } from '@/systems/entities3d/parts';
import { generateEntityBlueprint } from '@/systems/entities3d/generateEntityBlueprint';
import { recipeFromCharacter } from '@/systems/entities3d/recipeFromCharacter';
import { heightM } from '@/systems/entities3d/types';
import { assembleEntity, gameBodyOptions } from '@/systems/entities3d/three/assembleEntity';
import { isWebGpuWorldEnabled } from './webgpuWorldFlag';
import { adaptWorldEntityForWebGpu } from './worldEntityGpu';
import type { LocomotionState } from '@/systems/entities3d/three/gaits';
import type { EntityRecipe } from '@/systems/entities3d/types';
import { SceneCastNameplate } from './SceneCastNameplate';
import GroundCarriedTorch from './GroundCarriedTorch';

registerAllParts();

/**
 * Cheap race scale, kept for legacy callers: small folk get a visibly smaller
 * body. The avatar itself no longer uses this — race frames come from the
 * entity generator's species profiles.
 */
import { standingBodyHeight, standingBodyFootprint } from './standingBodyHeight';
import { ActorPersonalSpaceContext } from './ActorPersonalSpaceContext';
import { clipActorStep, canActorTurn } from './actorPersonalSpace';
import { groundWalkHeight, isGroundFootingSupported, type GroundWalkSurfaces } from './groundBuildingMotion';
import { measurePlacementBody } from './groundPlacementInspection';
import { findSeatForUnsupportedFeet, footingSeatNotice } from './groundFootingRecovery';
import { resolveGroundWaterWalk, type GroundWaterProfile } from './groundWaterMovement';
import { resolveTerrainMovementPolicyFromTraits } from '@/utils/combat/movementUtils';
import { groundFrameSeconds, groundKeyboardHeading, groundSpeedMps, type GroundMovementIntent } from './groundLocomotion';

export function raceScale(raceName: string | undefined): number {
  const n = (raceName ?? '').toLowerCase();
  if (/gnome|halfling|goblin|kobold|fairy/.test(n)) return 0.55;
  if (/dwarf|duergar/.test(n)) return 0.8;
  return 1;
}

interface PlayerAvatarProps {
  /** Party actors retain their observed appearance and own physical route. */
  recipe?: EntityRecipe;
  actorId?: string;
  trackCamera?: boolean;
  routeTarget?: Readonly<{ current: { xM: number; zM: number } | null }>;
  onTalk?: () => void;
  actorNotice?: string | null;
  /** Requested horizontal route plus actual saved spawn height. Null = spawn. */
  groundPos: { xM: number; zM: number; yM?: number } | null;
  /** Ground world (heights for terrain planting). Renders nothing without it. */
  ground: GroundWorld | null;
  sceneOrigin: SceneOrigin;
  /** Spawn surface Y (m) — fallback elevation when groundPos is null. */
  startSurfaceY: number;
  /** The real character — race, class, and equipped gear shape the body.
   * Null (pre-party states) renders no figure: there is no character yet. */
  character?: PlayerCharacter | null;
  /** Actual rendered footfall, for physical reach checks rather than destinations. */
  onPositionChange?: (position: { xM: number; zM: number; yM: number }) => void;
  /** Stop a blocked destination at the body's real arrival point. */
  onMovementBlocked?: (position: { xM: number; zM: number; yM: number }) => void;
  openDoors?: ReadonlySet<string>;
  /** Exact mounted deck surfaces; optional on older preview callers. */
  walkingSurfaces?: GroundWalkSurfaces;
  /** Same Scene-local Shift intent used by keyboard movement. */
  movementIntent?: GroundMovementIntent;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  groundPos,
  ground,
  sceneOrigin,
  startSurfaceY,
  character,
  onPositionChange,
  onMovementBlocked,
  openDoors,
  walkingSurfaces,
  movementIntent,
  recipe, actorId, trackCamera = true, routeTarget, onTalk, actorNotice,
}) => {
  const blueprint = useMemo(
    () => (character ? generateEntityBlueprint(recipe ?? recipeFromCharacter(character)) : null),
    [character, recipe],
  );
  // The marching-cubes body is attractive but expensive to polygonize. A
  // player needs responsive gear, eyes, turning, and movement every frame, but
  // the soft body surface itself does not need to be rebuilt at monitor speed.
  // A smaller field updated ten times per second preserves the animated body
  // while leaving enough frame budget for terrain, buildings, and townsfolk.
  // Skinned by default (skeleton pivot flip 2026-08-18): 2 draw calls per
  // figure instead of ~60, smooth one-piece look on bipeds.
  const handle = useMemo(
    () => {
      if (!blueprint) return null;
      const assembled = assembleEntity(blueprint, { resolutionScale: 0.7, fieldUpdateHz: 10, ...gameBodyOptions(blueprint) });
      // ADR 0009 step 2: the WebGPU world rebuilds the GLSL toon materials.
      if (isWebGpuWorldEnabled()) adaptWorldEntityForWebGpu(assembled.group);
      return assembled;
    },
    [blueprint],
  );
  // Read standing anatomy from this character's actual assembled model.
  // Gait bob does not rewrite its standing clearance, and a missing mouth
  // remains unknown rather than borrowing a collision proxy's height.
  const waterProfile = useMemo<GroundWaterProfile>(() => {
    const mouth = handle?.group.getObjectByName?.('mouthLine');
    let mouthHeightM: number | undefined;
    if (mouth && handle) {
      // Assembly has positioned the head bones before the first render, but
      // their world matrices may still be stale. Include every ancestor before
      // measuring the mouth, just as the renderer does for the standing body.
      handle.group.updateWorldMatrix(true, true);
      const rootY = handle.group.getWorldPosition(new THREE.Vector3()).y;
      const value = new THREE.Box3().setFromObject(mouth).min.y - rootY;
      if (Number.isFinite(value) && value > 0) mouthHeightM = value;
    }
    return { mouthHeightM, standingHeightM: standingBodyHeight(handle?.group), terrainPolicy: resolveTerrainMovementPolicyFromTraits(character?.race?.traits) };
  }, [handle, character?.race]);
  useEffect(() => {
    handle?.retain();
    return () => handle?.release();
  }, [handle]);

  const personalSpace=React.useContext(ActorPersonalSpaceContext);
  const bodyKey=actorId ? 'companion:'+actorId : 'player';
  const personalBody=useMemo(()=>{
    const footprint=standingBodyFootprint(handle?.group),heightM=waterProfile.standingHeightM;
    return footprint&&heightM?{radiusM:footprint.radiusM,heightM,footprint}:null;
  },[handle,waterProfile.standingHeightM]);
  useEffect(()=>()=>{personalSpace?.delete(bodyKey);},[personalSpace,bodyKey]);
  const personalBodyPrimed=useRef<typeof handle>(null),personalRadiusSample=useRef(0);
  const groupRef = useRef<THREE.Group>(null);
  const loco = useRef<LocomotionState>({
    position: new THREE.Vector3(),
    heading: new THREE.Vector3(0, 0, 1),
    speed: 0,
  });
  const yawRef = useRef(0);
  const keyboardForward = useRef(new THREE.Vector3());
  const [footingUnavailable, setFootingUnavailable] = useState(false);
  const lastFootingIssue = useRef(false);
  const [waterNotice, setWaterNotice] = useState<string | null>(null);
  const lastWaterNotice = useRef<string | null>(null);
  const [movementBlockedNotice, setMovementBlockedNotice] = useState<string | null>(null);
  const lastMovementBlockedNotice = useRef<string | null>(null);
  // GG-537 load step: which spawn was already checked, the notice it left,
  // and the seat to hold until the parent's stored target reaches it.
  const footingSeatChecked = useRef<object | null>(null);
  const [footingSeatNoticeText, setFootingSeatNoticeText] = useState<string | null>(null);
  const footingSeatHold = useRef<{ xM: number; zM: number; fromXM: number; fromZM: number } | null>(null);

  // Logical position → scene space (scene origin sits on the spawn point). This
  // is the TARGET; the body glides toward it (below) so a click-to-move walks
  // rather than teleports, and a camera walk stays smooth.
  const xM = groundPos?.xM ?? sceneOrigin.x;
  const zM = groundPos?.zM ?? sceneOrigin.z;
  // Null is a new arrival, not an accepted height from the camera's old datum.
  // Both null and height-less points resolve support; finite saved Y stays exact.
  const targetSurfaceY = ground
    ? groundWalkHeight(ground, groundPos ?? { xM, zM }, openDoors, walkingSurfaces)
    : startSurfaceY;
  const sx = xM - sceneOrigin.x;
  const sz = zM - sceneOrigin.z;
  // R3F reapplies a changed position prop immediately. Keep the mount/ground
  // anchor stable so destination updates reach the stride below rather than
  // teleporting the body before its first animation frame.
  const spawn = useRef({ ground, x: sceneOrigin.x, z: sceneOrigin.z,
    position: [sx, targetSurfaceY, sz] as [number, number, number] });
  if (spawn.current.ground !== ground || spawn.current.x !== sceneOrigin.x || spawn.current.z !== sceneOrigin.z) {
    spawn.current = { ground, x: sceneOrigin.x, z: sceneOrigin.z, position: [sx, targetSurfaceY, sz] };
  }

  // Ease the visible body toward the logical position each frame, resampling the
  // terrain height under the CURRENT (interpolated) footfall so it stays planted
  // while crossing relief. The per-frame displacement drives the gait: speed =
  // how fast the body really moves, heading = which way, so strides match the
  // glide and the figure turns into its direction of travel.
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g || !ground || !handle) return;
    // Assembly may still carry a narrower bind pose. Prime horizontal space
    // from the actual idle pose before admitting movement; existing vertical
    // and water anatomy keep their established measurement contract.
    if(personalSpace&&personalBody&&personalBodyPrimed.current!==handle){
      handle.update(state.clock.elapsedTime,0,loco.current);
      const footprint=standingBodyFootprint(handle.group,true);
      if(footprint){personalBody.radiusM=Math.max(personalBody.radiusM,footprint.radiusM);personalBody.footprint=footprint;}
      personalBodyPrimed.current=handle;
    }
    // GG-537 load step (Remy, 2026-10-31: move them on load, with a notice).
    // Saved feet whose ground, deck or water moved since the save are seated
    // ONCE per spawn at the nearest place this body can stand. It waits for the
    // full-detail chunk under the feet; until then, and when no seat exists,
    // the existing refusal below stays. Supported feet are never moved here.
    if (footingSeatChecked.current !== spawn.current) {
      const feet = { xM: g.position.x + sceneOrigin.x, zM: g.position.z + sceneOrigin.z, yM: g.position.y };
      if (walkingSurfaces?.supportReadyAt?.(feet.xM, feet.zM)) {
        footingSeatChecked.current = spawn.current;
        const body = isGroundFootingSupported(ground, feet, openDoors, walkingSurfaces) ? undefined : measurePlacementBody(handle.group);
        const seat = body ? findSeatForUnsupportedFeet(ground, feet, { ...body, terrainPolicy: waterProfile.terrainPolicy }, walkingSurfaces) : null;
        if (seat) {
          const mx = seat.xM - feet.xM, my = seat.yM - feet.yM, mz = seat.zM - feet.zM;
          g.position.set(seat.xM - sceneOrigin.x, seat.yM, seat.zM - sceneOrigin.z);
          // The view moves with the body, as it does for a climb.
          if (trackCamera) {
            state.camera.position.x += mx; state.camera.position.y += my; state.camera.position.z += mz;
            const seatControls = state.controls as unknown as { target?: { x: number; y: number; z: number }; update?: () => void } | null;
            if (seatControls?.target) { seatControls.target.x += mx; seatControls.target.y += my; seatControls.target.z += mz; seatControls.update?.(); }
          }
          // Hold the seat as the target until the parent stores it, so the body
          // does not walk back toward the unsupported point it came from.
          footingSeatHold.current = { xM: seat.xM, zM: seat.zM, fromXM: xM, fromZM: zM };
          onMovementBlocked?.({ xM: seat.xM, zM: seat.zM, yM: seat.yM });
          setFootingSeatNoticeText(footingSeatNotice(seat, actorId ? character?.name ?? null : null));
        }
      }
    }
    const hold = footingSeatHold.current;
    if (hold && (Math.abs(xM - hold.fromXM) > 1e-6 || Math.abs(zM - hold.fromZM) > 1e-6)) footingSeatHold.current = null;
    const targetX = footingSeatHold.current ? footingSeatHold.current.xM - sceneOrigin.x : sx;
    const targetZ = footingSeatHold.current ? footingSeatHold.current.zM - sceneOrigin.z : sz;
    const stepSeconds = groundFrameSeconds(delta);
    const a = Math.min(1, stepSeconds * 6);
    // A held companion route means stand at reached feet, not return to spawn.
    const route = routeTarget?.current;
    let remainingX = routeTarget ? (route ? route.xM - sceneOrigin.x - g.position.x : 0) : targetX - g.position.x;
    let remainingZ = routeTarget ? (route ? route.zM - sceneOrigin.z - g.position.z : 0) : targetZ - g.position.z;
    // Click travel uses the same character pace and Shift request as WASD.
    // Bounded frame time preserves precise arrival after a rendering stall.
    const speed = groundSpeedMps(character, movementIntent?.sprinting);
    if (movementIntent) movementIntent.waterProfile = waterProfile;
    // Native held keys drive these reached feet directly. Routing every tiny
    // keyboard step through click easing loses pace and adds release drift.
    // Click destinations retain their existing eased, collision-checked walk.
    const nativeKeyboard = movementIntent?.keyboardOwnsFeet === true;
    if (nativeKeyboard) {
      state.camera.getWorldDirection(keyboardForward.current);
      const heading = groundKeyboardHeading(movementIntent?.keyboard, keyboardForward.current);
      remainingX = heading.x * speed * stepSeconds;
      remainingZ = heading.z * speed * stepSeconds;
    }
    const distance = Math.hypot(remainingX, remainingZ);
    const fraction = nativeKeyboard ? 1 : distance > 0 ? Math.min(a, speed * stepSeconds / distance) : 0;
    const from = { xM: g.position.x + sceneOrigin.x, zM: g.position.z + sceneOrigin.z, yM: g.position.y };
    const unavailable = !isGroundFootingSupported(ground, from, openDoors, walkingSurfaces);
    if (unavailable !== lastFootingIssue.current) {
      lastFootingIssue.current = unavailable;
      setFootingUnavailable(unavailable);
    }
    let motion = resolveGroundWaterWalk(ground, from, { xM: from.xM + remainingX * fraction, zM: from.zM + remainingZ * fraction }, speed * stepSeconds, waterProfile, openDoors, walkingSurfaces);
    // Walking a tread takes time even for a distant click. Height comes only
    // from the reached support, never from the target or a floor-number jump.
    if (motion.onStairs && distance * fraction > 1.6 * stepSeconds) {
      const stairFraction = Math.min(fraction, 1.6 * stepSeconds / Math.max(distance, 1e-9));
      motion = resolveGroundWaterWalk(ground, from, { xM: from.xM + remainingX * stairFraction, zM: from.zM + remainingZ * stairFraction }, Math.min(speed, 1.6) * stepSeconds, waterProfile, openDoors, walkingSurfaces);
    }
    // Geometry/water admits the step first. Then sweep visible people along
    // that same segment; stopping early must resolve footing again.
    if(personalSpace&&personalBody){
      const body={...from,...personalBody};
      personalSpace.set(bodyKey,body);
      const admitted=clipActorStep(from,motion,bodyKey,body,personalSpace);
      if(admitted.blocked)motion={...resolveGroundWaterWalk(ground,from,admitted,speed*stepSeconds,waterProfile,openDoors,walkingSurfaces),blocked:true};
    }
    const dx = motion.xM - from.xM;
    const dz = motion.zM - from.zM;
    // A refused player request needs an explanation after key release too.
    // A new attempt updates it; specific footing/water failures keep their
    // existing messages. This never changes admission or companion behavior.
    if (distance > 1e-7 || unavailable || motion.water.mode === 'blocked') {
      // Name the confirmed grade or overhead contact. Clearance still includes
      // actual equipped gear; the notice cannot open a door or shrink the body.
      const blocked = !actorId && motion.blocked && !unavailable && motion.water.mode !== 'blocked'
        ? motion.blockedReason === 'steep-grade'
          ? 'This slope is too steep to walk. Try a gentler approach.'
          : motion.blockedReason === 'low-clearance'
            ? 'Not enough clearance for your height and carried gear. Stow tall gear or find a higher opening.'
          : 'That direction was blocked. Try another approach.'
        : null;
      if (blocked !== lastMovementBlockedNotice.current) {
        lastMovementBlockedNotice.current = blocked;
        setMovementBlockedNotice(blocked);
      }
    }
    if (movementIntent && (motion.water.reason || Math.hypot(dx, dz) > 1e-7)) movementIntent.waterIssue = motion.water.reason;
    const waterIssue = motion.water.reason ?? movementIntent?.waterIssue;
    const notice = waterIssue === 'deep-water'
      ? 'The water is too deep to wade. Find a shallower approach.'
      : waterIssue ? 'No safe wading passage is known here.'
      : motion.water.mode === 'wading' ? 'Wading uses extra movement.' : null;
    if (notice !== lastWaterNotice.current) { lastWaterNotice.current = notice; setWaterNotice(notice); }

    g.position.x += dx;
    g.position.z += dz;
    if (footingSeatNoticeText && !footingSeatHold.current && Math.hypot(dx, dz) > 1e-7) setFootingSeatNoticeText(null);
    const curXM = g.position.x + sceneOrigin.x;
    const curZM = g.position.z + sceneOrigin.z;
    const dy = motion.yM - g.position.y;
    g.position.y = motion.yM;
    // Keep the same view while the body climbs or descends; orbiting never
    // changes its support or stored arrival.
    if (trackCamera) state.camera.position.y += dy;
    const controls = state.controls as unknown as { target?: { y: number }; update?: () => void } | null;
    if (trackCamera && controls?.target && Math.abs(dy) > 1e-8) { controls.target.y += dy; controls.update?.(); }
    if(personalSpace&&personalBody)personalSpace.set(bodyKey,{xM:curXM,zM:curZM,yM:g.position.y,...personalBody});
    onPositionChange?.({ xM: curXM, zM: curZM, yM: g.position.y });
    // A wall cannot leave the saved position on its far side. Report the
    // stopped body, so the parent cancels this blocked movement request.
    if (motion.blocked && distance > 1e-7) onMovementBlocked?.({ xM: curXM, zM: curZM, yM: g.position.y });

    // locomotion from the actual glide (smoothed so strides don't stutter)
    const rawSpeed = delta > 0 ? Math.hypot(dx, dz) / delta : 0;
    const l = loco.current;
    l.speed += (rawSpeed - l.speed) * Math.min(1, delta * 8);
    if (rawSpeed > 0.05) {
      l.heading.set(dx, 0, dz).normalize();
      const targetYaw = Math.atan2(l.heading.x, l.heading.z);
      // shortest-arc turn toward travel direction
      let dYaw = targetYaw - yawRef.current;
      while (dYaw > Math.PI) dYaw -= Math.PI * 2;
      while (dYaw < -Math.PI) dYaw += Math.PI * 2;
      const nextYaw=yawRef.current+dYaw*Math.min(1,delta*8);
      // A close body may sidestep with its current facing. Turning cannot
      // swing a tail, shield or shoulder through an otherwise clear neighbor.
      const feet={xM:curXM,zM:curZM,yM:g.position.y};
      if(!personalSpace||!personalBody||canActorTurn(feet,bodyKey,{...feet,...personalBody},nextYaw,personalSpace))yawRef.current=nextYaw;
    }
    handle.group.rotation.y = yawRef.current;
    if(personalBody)personalBody.footprint={...personalBody.footprint,yawRad:yawRef.current};
    handle.update(state.clock.elapsedTime, delta, l);
    personalRadiusSample.current+=Number.isFinite(delta)?Math.max(0,delta):0;
    if(personalSpace&&personalBody&&personalRadiusSample.current>=.5){
      const measured=standingBodyFootprint(handle.group);
      if(measured){
        const old=personalBody.footprint;
        // Keep the moving pose's full sweep while striding. Once the visible
        // figure settles, measure its actual idle anatomy and carried gear
        // again: an earlier arm or wing extension must not remain an invisible
        // permanent body that traps the party between otherwise clear people.
        // This changes no feet, neighbor, door permission or terrain clearance.
        const settled=l.speed<=.05;
        personalBody.radiusM=settled?measured.radiusM:Math.max(personalBody.radiusM,measured.radiusM);
        personalBody.footprint=settled?measured:{...measured,minXM:Math.min(old.minXM,measured.minXM),maxXM:Math.max(old.maxXM,measured.maxXM),minZM:Math.min(old.minZM,measured.minZM),maxZM:Math.max(old.maxZM,measured.maxZM)};
      }
      personalSpace.set(bodyKey,{xM:curXM,zM:curZM,yM:g.position.y,...personalBody});
      personalRadiusSample.current=0;
    }
    // Residents run later in the frame and must see the accepted facing too.
    if(personalSpace&&personalBody)personalSpace.set(bodyKey,{xM:curXM,zM:curZM,yM:g.position.y,...personalBody});
  // Report real feet before keyboard camera follow (-0.5) and visibility (0).
  }, -0.75);

  if (!ground || !handle || !blueprint || !character) return null;

  return (
    <group ref={groupRef} name={actorId ? `world3d:companion:${actorId}` : 'world3d:player'} position={spawn.current.position} data-testid={actorId ? `companion-avatar-${actorId}` : 'player-avatar'}>
      <primitive object={handle.group} />
      <GroundCarriedTorch character={character} handle={handle} />
      {/* Keep the player's name readable at a fixed screen size above the head.
          Perspective scaling covered the movement/rest HUD in close door views. */}
      {character.name ? (
        <Html center wrapperClass="pointer-events-none" position={[0, heightM(blueprint.frame) + 0.5, 0]} style={{ textAlign: 'center' }}>
          <div
            data-testid="player-avatar-label"
            style={{
              pointerEvents: 'none',
              display: 'inline-block',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              color: 'white',
              fontSize: '12px',
              fontFamily: 'Outfit, sans-serif',
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'rgba(37, 99, 235, 0.82)',
              border: '1px solid rgba(148, 163, 184, 0.5)',
            }}
          >
            {actorId ? <SceneCastNameplate id={actorId} name={character.name} onTalk={onTalk} /> : character.name}
          </div>
          {actorNotice && <div role="status" style={{ maxWidth: '260px', whiteSpace: 'normal', background: '#142d3e', color: '#d9efff', padding: '6px 8px', fontSize: '12px' }}>{actorNotice}</div>}
          {!footingUnavailable && movementBlockedNotice && <div role="status" aria-label="Movement blocked" data-testid="ground-movement-blocked"
            style={{ width: '220px', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', whiteSpace: 'normal', marginTop: '4px', padding: '6px 8px',
              borderRadius: '4px', background: '#142d3e', color: '#d9efff', fontSize: '12px', lineHeight: 1.4 }}>
            {movementBlockedNotice}
          </div>}
          {!footingUnavailable && !movementBlockedNotice && waterNotice && <div role="status" data-testid="ground-water-notice"
            style={{ maxWidth: '220px', whiteSpace: 'normal', marginTop: '4px', padding: '6px 8px',
              borderRadius: '4px', background: '#142d3e', color: '#d9efff', fontSize: '12px', lineHeight: 1.4 }}>
            {waterNotice}
          </div>}
          {footingSeatNoticeText && <div role="status" data-testid="ground-footing-reseated"
            style={{ width: '220px', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box', whiteSpace: 'normal', marginTop: '4px', padding: '6px 8px',
              borderRadius: '4px', background: '#142d3e', color: '#d9efff', fontSize: '12px', lineHeight: 1.4 }}>
            {footingSeatNoticeText}
          </div>}
          {footingUnavailable && <div role="status" data-testid="ground-footing-unavailable"
            style={{ width: '220px', maxWidth: 'calc(100vw - 32px)', boxSizing: 'border-box',
              textAlign: 'left', whiteSpace: 'normal', padding: '6px 8px', marginTop: '4px', borderRadius: '4px',
              background: '#271d18', color: '#fde6ba', fontSize: '12px', lineHeight: 1.4 }}>
            {actorId ? `${character.name}'s footing is unavailable. Movement is paused.` : 'Your footing is unavailable. Movement is paused.'}
          </div>}
        </Html>
      ) : null}
    </group>
  );
};

export default PlayerAvatar;
