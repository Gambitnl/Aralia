/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 18:24:08
 * Dependents: components/BattleMap/camera/index.ts
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
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
import React from 'react';
import { CombatCharacter } from '../../../types/combat';
interface CameraControllerProps {
    /** Center of the map for initial camera positioning */
    mapCenter: readonly [number, number, number];
    /**
     * Samples the rendered terrain surface. Flat callers can omit it, but
     * WorldForge maps provide it so the camera never focuses through raised land.
     */
    groundYAt?: (worldX: number, worldZ: number) => number;
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
declare const CameraController: React.FC<CameraControllerProps>;
export default CameraController;
