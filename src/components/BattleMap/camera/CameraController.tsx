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
}) => {
  const { camera } = useThree();
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
      maxDistance={35}
      minPolarAngle={Math.PI * 0.15}   // ~27° from horizon
      maxPolarAngle={Math.PI * 0.42}    // ~75° from horizon
      enableDamping
      dampingFactor={0.08}
      screenSpacePanning={false}
    />
  );
};

export default CameraController;
