/**
 * @file CameraController.tsx
 * BG3-style camera controller for the 3D combat map.
 *
 * Features:
 * - Free 360° orbit with MapControls (zoom, pan, rotate)
 * - Auto-pan to active character on turn start
 * - Snap-to-character on selection (smooth lerp)
 * - Cinematic close-up during attacks (toggleable)
 * - Keyboard shortcuts: Tab (next character), 1-4 (party members)
 * - Double-click character to center camera
 * - Smooth lerp/slerp transitions (no hard cuts)
 *
 * Research references:
 * - drei MapControls: https://drei.docs.pmnd.rs/controls/map-controls
 * - Three.js camera lerp: standard Vector3.lerp pattern
 * - BG3 camera behavior: design spec reference screenshots
 *
 * @see docs/superpowers/specs/2026-05-21-3d-combat-map-design.md — "Camera System" section
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { MapControls } from '@react-three/drei';
import * as THREE from 'three';
import { CombatCharacter } from '../../../types/combat';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 1.0;

// Camera smoothing
const PAN_LERP_SPEED = 3.0;       // Speed of camera pan transitions
const CINEMATIC_LERP_SPEED = 2.0;  // Speed of cinematic camera transitions
const RETURN_LERP_SPEED = 2.5;     // Speed of returning from cinematic

// Cinematic camera offsets
const CINEMATIC_DISTANCE = 3.5;
const CINEMATIC_HEIGHT = 2.0;
const CINEMATIC_DURATION = 1.5;     // Seconds to hold close-up

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CameraControllerProps {
  /** Center of the map for initial camera positioning */
  mapCenter: readonly [number, number, number];
  /** Currently active character (whose turn it is) */
  activeCharacter: CombatCharacter | null;
  /** Currently selected character (clicked by player) */
  selectedCharacter: CombatCharacter | null;
  /** All characters for keyboard navigation */
  characters: CombatCharacter[];
  /** Whether cinematic attack camera is enabled */
  cinematicEnabled?: boolean;
  /** Callback when camera wants to select a character (Tab/1-4 keys) */
  onCameraSelectCharacter?: (characterId: string) => void;
  /** Max orbit zoom-out distance — derived from map size (fixed 35 could not
   *  overview anything larger than the original 40×30 battlefield). */
  maxDistance?: number;
}

type CameraMode = 'tactical' | 'panning' | 'cinematic' | 'returning';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CameraController: React.FC<CameraControllerProps> = ({
  mapCenter,
  activeCharacter,
  selectedCharacter,
  characters,
  cinematicEnabled = true,
  onCameraSelectCharacter,
  maxDistance = 35,
}) => {
  const { camera, gl, scene } = useThree();
  const controlsRef = useRef<any>(null);

  // Camera state
  const modeRef = useRef<CameraMode>('tactical');
  const targetPositionRef = useRef(new THREE.Vector3(mapCenter[0], 0, mapCenter[2]));
  const savedCameraPositionRef = useRef(new THREE.Vector3());
  const savedTargetRef = useRef(new THREE.Vector3());
  const cinematicTimerRef = useRef(0);
  const cinematicTargetPosRef = useRef(new THREE.Vector3());
  const cinematicCamPosRef = useRef(new THREE.Vector3());
  const lastActiveCharIdRef = useRef<string | null>(null);

  // Track previous active character ID for turn-start auto-pan
  const prevActiveId = useRef<string | null>(null);

  /**
   * Get world position for a character
   */
  const getCharacterWorldPos = useCallback((char: CombatCharacter): THREE.Vector3 => {
    return new THREE.Vector3(
      char.position.x * TILE_SIZE + TILE_SIZE / 2,
      0,
      char.position.y * TILE_SIZE + TILE_SIZE / 2,
    );
  }, []);

  /**
   * Smoothly pan camera target to a world position
   */
  const panToPosition = useCallback((pos: THREE.Vector3) => {
    targetPositionRef.current.copy(pos);
    modeRef.current = 'panning';
  }, []);

  /**
   * Snap camera to look at a character (smooth pan)
   */
  const snapToCharacter = useCallback((char: CombatCharacter) => {
    const pos = getCharacterWorldPos(char);
    panToPosition(pos);
  }, [getCharacterWorldPos, panToPosition]);

  // Auto-pan to active character on turn change
  useEffect(() => {
    if (!activeCharacter) return;
    if (activeCharacter.id !== prevActiveId.current) {
      prevActiveId.current = activeCharacter.id;
      snapToCharacter(activeCharacter);
    }
  }, [activeCharacter, snapToCharacter]);

  // Pan to selected character when selection changes
  useEffect(() => {
    if (!selectedCharacter) return;
    snapToCharacter(selectedCharacter);
  }, [selectedCharacter, snapToCharacter]);

  /**
   * Start cinematic attack camera
   */
  const startCinematic = useCallback((attacker: CombatCharacter, target: CombatCharacter) => {
    if (!cinematicEnabled) return;

    // Save current camera state
    savedCameraPositionRef.current.copy(camera.position);
    if (controlsRef.current?.target) {
      savedTargetRef.current.copy(controlsRef.current.target);
    }

    // Calculate cinematic camera position (behind attacker, looking toward target)
    const attackerPos = getCharacterWorldPos(attacker);
    const targetPos = getCharacterWorldPos(target);

    // Direction from attacker to target
    const dir = new THREE.Vector3().subVectors(targetPos, attackerPos).normalize();
    // Camera position: behind and above attacker
    const camOffset = dir.clone().multiplyScalar(-CINEMATIC_DISTANCE);
    camOffset.y = CINEMATIC_HEIGHT;

    cinematicCamPosRef.current.copy(attackerPos).add(camOffset);
    cinematicTargetPosRef.current.copy(
      new THREE.Vector3().lerpVectors(attackerPos, targetPos, 0.4), // Look between attacker and target
    );
    cinematicTargetPosRef.current.y = 0.5; // Slightly above ground

    cinematicTimerRef.current = 0;
    modeRef.current = 'cinematic';
  }, [cinematicEnabled, camera, getCharacterWorldPos]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab: cycle to next player character
      if (e.key === 'Tab') {
        e.preventDefault();
        const playerChars = characters.filter(c => c.team === 'player' && c.currentHP > 0);
        if (playerChars.length === 0) return;

        const currentIdx = playerChars.findIndex(c => c.id === lastActiveCharIdRef.current);
        const nextIdx = (currentIdx + 1) % playerChars.length;
        const nextChar = playerChars[nextIdx];
        lastActiveCharIdRef.current = nextChar.id;
        snapToCharacter(nextChar);
        onCameraSelectCharacter?.(nextChar.id);
      }

      // 1-4: select party member by index
      if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key) - 1;
        const playerChars = characters.filter(c => c.team === 'player' && c.currentHP > 0);
        if (idx < playerChars.length) {
          const char = playerChars[idx];
          lastActiveCharIdRef.current = char.id;
          snapToCharacter(char);
          onCameraSelectCharacter?.(char.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [characters, snapToCharacter, onCameraSelectCharacter]);

  // Dev-only deterministic camera posing for headless capture/verification.
  // The visual-quality capture rig (.agent/3d-visual-quality/captures) can only
  // dolly via wheel events and cannot tilt the camera, so it could never frame
  // the horizon — which blocked verifying distant-terrain / silhouette work.
  // This exposes a `pose(distance, polarDeg, azimuthDeg)` helper on window that
  // positions the camera on a sphere around the map center. No effect in prod.
  useEffect(() => {
    if (!import.meta.env?.DEV) return;
    const w = window as unknown as { __bm3dCam?: unknown };
    const poseAround = (tx: number, tz: number, distance: number, polarDeg: number, azimuthDeg: number) => {
      const controls = controlsRef.current;
      if (!controls) return false;
      const polar = THREE.MathUtils.degToRad(polarDeg);
      const azim = THREE.MathUtils.degToRad(azimuthDeg);
      controls.target.set(tx, 0, tz);
      const sinP = Math.sin(polar);
      camera.position.set(
        tx + distance * sinP * Math.sin(azim),
        distance * Math.cos(polar),
        tz + distance * sinP * Math.cos(azim),
      );
      // Stop the smooth-pan state machine from yanking the camera back.
      modeRef.current = 'tactical';
      controls.update();
      return true;
    };
    w.__bm3dCam = {
      pose(distance: number, polarDeg: number, azimuthDeg: number) {
        return poseAround(mapCenter[0], mapCenter[2], distance, polarDeg, azimuthDeg);
      },
      // Frame the centroid of a team (e.g. 'player') — used to reliably capture
      // the dev race-lineup regardless of which side it spawns on.
      poseTeam(team: string, distance: number, polarDeg: number, azimuthDeg: number) {
        const members = characters.filter(c => c.team === team);
        if (members.length === 0) return poseAround(mapCenter[0], mapCenter[2], distance, polarDeg, azimuthDeg);
        const tx = members.reduce((s, c) => s + c.position.x + 0.5, 0) / members.length;
        const tz = members.reduce((s, c) => s + c.position.y + 0.5, 0) / members.length;
        return poseAround(tx, tz, distance, polarDeg, azimuthDeg);
      },
      // Frame an arbitrary world-space point (e.g. a specific tile) — lets the
      // rig verify tile-anchored effects like targeting decals deterministically.
      poseAt(tx: number, tz: number, distance: number, polarDeg: number, azimuthDeg: number) {
        return poseAround(tx, tz, distance, polarDeg, azimuthDeg);
      },
      // Dev profiling: renderer.info snapshot for headless FPS/draw-call capture.
      // render.calls/triangles reset each frame, so force one explicit render
      // with autoReset off to read a full, stable frame's draw stats.
      info() {
        const r = gl.info;
        const prevAuto = r.autoReset;
        r.autoReset = false;
        r.reset();
        gl.render(scene, camera);
        const snap = {
          calls: r.render?.calls ?? null,
          triangles: r.render?.triangles ?? null,
          textures: r.memory?.textures ?? null,
          geometries: r.memory?.geometries ?? null,
          programs: r.programs?.length ?? null,
        };
        r.autoReset = prevAuto;
        return snap;
      },
      // Dev profiling: attribute draw calls by counting renderable objects in
      // the scene graph, grouped by constructor type. Helps pin what emits the
      // most draw calls (instanced vs plain meshes vs points).
      sceneBreakdown() {
        const byType: Record<string, number> = {};
        let instanced = 0;
        let plainMeshes = 0;
        let points = 0;
        scene.traverse((o) => {
          const anyO = o as unknown as { isMesh?: boolean; isInstancedMesh?: boolean; isPoints?: boolean; visible?: boolean; count?: number };
          if (!anyO.visible) return;
          if (anyO.isInstancedMesh) { instanced++; byType['InstancedMesh(' + (anyO.count ?? 0) + ')'] = (byType['InstancedMesh'] ?? 0) + 1; }
          else if (anyO.isMesh) { plainMeshes++; }
          else if (anyO.isPoints) { points++; }
          const t = o.constructor?.name ?? 'unknown';
          byType[t] = (byType[t] ?? 0) + 1;
        });
        // Attribute plain meshes to their nearest named ancestor / top-level child.
        const perRoot: Record<string, number> = {};
        const rootOf = (o: THREE.Object3D): string => {
          let cur: THREE.Object3D | null = o;
          let last = o;
          while (cur && cur.parent && !(cur.parent as unknown as { isScene?: boolean }).isScene) {
            last = cur; cur = cur.parent;
          }
          return (last.name || last.type || 'unnamed') + '#' + (last.uuid?.slice(0, 4) ?? '');
        };
        scene.traverse((o) => {
          const anyO = o as unknown as { isMesh?: boolean; isInstancedMesh?: boolean; visible?: boolean };
          if (anyO.isMesh && !anyO.isInstancedMesh && anyO.visible) {
            const rk = rootOf(o);
            perRoot[rk] = (perRoot[rk] ?? 0) + 1;
          }
        });
        const topRoots = Object.entries(perRoot).sort((a, b) => b[1] - a[1]).slice(0, 12);
        return { plainMeshes, instanced, points, byType, topRoots };
      },
      // Dev profiling: force a render and read the canvas immediately (same tick,
      // before the drawing buffer is cleared) so the headless rig can capture the
      // always-loop R3F scene, which Playwright's screenshot cannot.
      capture() {
        gl.render(scene, camera);
        try { return gl.domElement.toDataURL('image/png'); } catch { return null; }
      },
      // Dev profiling: swap the sun's shadow-map resolution at runtime so the rig
      // can A/B two resolutions against the SAME generated scene (page reloads
      // regenerate the battlefield, defeating a pixel-diff). Disposes the old
      // shadow render target so the new size takes effect on the next render.
      setSunShadowMapSize(n: number) {
        let done = false;
        scene.traverse((o) => {
          const light = o as unknown as THREE.DirectionalLight;
          if (light.isDirectionalLight && light.castShadow && !done) {
            light.shadow.mapSize.set(n, n);
            light.shadow.map?.dispose();
            (light.shadow as unknown as { map: unknown }).map = null;
            done = true;
          }
        });
        gl.render(scene, camera);
        return done;
      },
      // Dev profiling: average wall-time of N explicit gl.render() calls. Under
      // software raster the absolute ms is inflated, but the BEFORE/AFTER RATIO
      // (e.g. static-shadow win) is meaningful since both share the same rasterizer.
      renderTiming(n = 40) {
        const times: number[] = [];
        for (let i = 0; i < n; i++) {
          const t0 = performance.now();
          gl.render(scene, camera);
          times.push(performance.now() - t0);
        }
        times.sort((a, b) => a - b);
        const drop = times.slice(2, n - 2); // trim outliers
        const mean = drop.reduce((s, x) => s + x, 0) / drop.length;
        return { n, meanMs: mean, medianMs: times[Math.floor(n / 2)], minMs: times[0] };
      },
    };
    return () => { delete (window as unknown as { __bm3dCam?: unknown }).__bm3dCam; };
  }, [camera, gl, scene, mapCenter, characters]);

  // Frame update: smooth camera transitions
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const controls = controlsRef.current;
    const mode = modeRef.current;

    if (mode === 'panning') {
      // Smooth lerp camera target to desired position
      const currentTarget = controls.target as THREE.Vector3;
      currentTarget.lerp(targetPositionRef.current, 1 - Math.exp(-PAN_LERP_SPEED * delta));

      // Check if close enough to stop
      if (currentTarget.distanceTo(targetPositionRef.current) < 0.05) {
        currentTarget.copy(targetPositionRef.current);
        modeRef.current = 'tactical';
      }

      controls.update();
    }

    if (mode === 'cinematic') {
      cinematicTimerRef.current += delta;

      // Lerp camera position to cinematic position
      camera.position.lerp(cinematicCamPosRef.current, 1 - Math.exp(-CINEMATIC_LERP_SPEED * delta));

      // Update controls target to look at the action
      const target = controls.target as THREE.Vector3;
      target.lerp(cinematicTargetPosRef.current, 1 - Math.exp(-CINEMATIC_LERP_SPEED * delta));
      controls.update();

      // After duration, return to tactical view
      if (cinematicTimerRef.current > CINEMATIC_DURATION) {
        modeRef.current = 'returning';
      }
    }

    if (mode === 'returning') {
      // Lerp back to saved position
      camera.position.lerp(savedCameraPositionRef.current, 1 - Math.exp(-RETURN_LERP_SPEED * delta));

      const target = controls.target as THREE.Vector3;
      target.lerp(savedTargetRef.current, 1 - Math.exp(-RETURN_LERP_SPEED * delta));
      controls.update();

      // Check if close enough to stop
      if (camera.position.distanceTo(savedCameraPositionRef.current) < 0.1) {
        camera.position.copy(savedCameraPositionRef.current);
        target.copy(savedTargetRef.current);
        modeRef.current = 'tactical';
        controls.update();
      }
    }
  });

  return (
    <MapControls
      ref={controlsRef}
      target={[mapCenter[0], 0, mapCenter[2]]}
      minDistance={5}
      maxDistance={maxDistance}
      minPolarAngle={Math.PI * 0.15}   // ~27° from horizon
      maxPolarAngle={Math.PI * 0.42}    // ~75° from horizon
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
    />
  );
};

export default CameraController;
