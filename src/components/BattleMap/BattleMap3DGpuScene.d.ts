/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 13:09:49
 * Dependents: components/BattleMap/BattleMap3D.tsx
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file BattleMap3DGpuScene.tsx
 * @description EXPERIMENTAL WebGPU render path for the 3D tactical battle map
 * (beautification wave, WebGPU migration — spec
 * docs/superpowers/specs/2026-07-02-world-beautification-wave.md §8; sub-spec
 * docs/superpowers/specs/subspecs/beautification--prop-schema-placement-engine.md).
 *
 * Selected only when the WebGPU battle-map flag is on (`?gpu=1`, see
 * webgpuBattleMapFlag.ts). WebGL BattleMap3D remains the default.
 *
 * WHY A SIBLING SCENE (not a prop on BattleMap3D):
 * The live BattleMap3D tree is built on classic WebGL constructs that do NOT
 * survive the WebGPU node path:
 *   - every surface is `<meshStandardMaterial>` lit by scene `<directionalLight>`
 *     / `<hemisphereLight>` — which render BLACK on WebGPU because the node-path
 *     `LightsNode` never detects R3F-added lights (three #30044 / r3f #2853),
 *   - the terrain's procedural texturing is injected via `onBeforeCompile` GLSL
 *     (no node-path equivalent),
 *   - `@react-three/postprocessing` (Bloom/Vignette) and drei `<Sky>`/`<Html>`
 *     helpers are WebGL `EffectComposer`/shader based.
 * So — exactly as the validated probe did (WebGPUProbeScene.tsx) — this is a
 * trimmed, self-contained scene that renders the SAME shared `mapData` /
 * `characters` through the proven baked-TSL pattern: an unlit
 * `MeshBasicNodeMaterial` whose `colorNode` bakes a hemisphere + directional
 * Lambert term against a constant sun, needing no scene lights.
 *
 * GAME LOGIC IS UNTOUCHED: this file only renders. BattleMap3D owns the combat
 * hooks and passes resolved data (map, characters, valid moves, active path,
 * AoE set) in.
 *
 * ── PORTED RUNGS (wave spec §8, this slice) ──────────────────────────────────
 *   1. Procedural terrain texturing — the WebGL `onBeforeCompile` GLSL (per-type
 *      palettes, organic edge blend, slope-rock, wet banks, canopy dapple) is
 *      TRANSLATED to a TSL node graph (`gpu/terrainColorNode.ts`), NOT a flat
 *      per-tile palette. Baked-lighting multiply on top.
 *   2. Vegetation + props — instanced grass (GrassLayer placement) + ground
 *      scatter (GroundScatter placement) rendered as instanced baked-TSL meshes.
 *   3. Grid + movement/path/AoE overlay — TSL translation of GridOverlay's
 *      tile-state shader (`gpu/gridOverlayNodes.ts`), terrain-conforming,
 *      fade-lerped like the WebGL overlay.
 *   4. Character/enemy actors — lit tokens with team color, HP fade, selection +
 *      active-turn rings. (The full 1,491-line animated `CharacterActor` rig —
 *      drei `<Html>` nameplates, AnimationMixer state machine, fresnel rim — is
 *      a documented deferral: its drei/`useFrame`/MeshStandard stack does not
 *      translate 1:1 and would balloon this slice. Listed on-screen as MISSING.)
 *   5. Post-processing — three's node `PostProcessing` bloom + a TSL vignette
 *      (matches the WebGL EffectComposer look), driven manually with a
 *      `frameloop="never"` render loop.
 *
 * EXPLICIT MISSING (shown on-screen, honest — NO faking, NO silent fallback):
 *   - Real-time shadows: baked colorNode lighting has no `LightsNode` to consume
 *     a shadow map on the node path (three 0.170).
 *   - Animated CharacterActor rig + drei nameplates (see rung 4).
 *   - GPU wind sway on grass (WebGL animates blades in the vertex shader; here
 *     the blades are static — the meadow reads, the sway does not).
 */
import React from 'react';
import type { BattleMapData, CombatCharacter } from '../../types/combat';
interface Props {
    mapData: BattleMapData;
    characters: CombatCharacter[];
    activeCharacter: CombatCharacter | null;
    selectedCharacter: CombatCharacter | null;
    validMoves?: Set<string>;
    activePath?: {
        id: string;
    }[];
    actionMode?: 'move' | 'ability' | null;
    aoeSet?: Set<string>;
    onCameraSelectCharacter?: (id: string) => void;
    /**
     * Called when the user clicks "Use WebGL instead" on the WebGPU-unavailable
     * error panel. The host (BattleMap3D) remounts the normal WebGL scene. The
     * system itself never auto-falls-back — this is an explicit USER action.
     */
    onUseWebGL?: () => void;
}
declare const BattleMap3DGpuScene: React.FC<Props>;
export default BattleMap3DGpuScene;
