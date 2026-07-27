/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 17:36:31
 * Dependents: components/World3D/WebGPUProbe.tsx
 * Imports: 20 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file WebGPUProbeScene.tsx
 * @description PROBE-LOCAL copy of the streamed-world R3F scene, rendered through
 * three.js WebGPURenderer instead of the default WebGLRenderer. This exists to
 * prove the SAME full ground stack the game ships renders on WebGPU hardware.
 *
 * Why a copy (not a prop on World3DScene): the ONLY structural difference is the
 * renderer namespace. WebGPU R3F requires:
 *   1. THREE imported from `three/webgpu` (so WebGPURenderer + node materials exist),
 *   2. `extend(THREE)` so JSX intrinsics (<mesh>, <instancedMesh>, ...) resolve
 *      against the WebGPU namespace,
 *   3. an ASYNC `gl` factory that constructs + `await renderer.init()`s WebGPURenderer.
 * Doing that inside the live World3DScene would swap the renderer for the whole
 * game; keeping it here isolates the experiment (hot-file rule).
 *
 * ── FULL-STACK PARITY (2026-07-04) ──────────────────────────────────────────
 * Beyond terrain + building boxes, this probe now renders the live beautification
 * stack at the same pose:
 *   • procedural instanced TREES  (same treeMeshGenerator + partition as
 *     VegetationTrees.tsx; per-instance color via the instanceColor varying),
 *   • near-camera GRASS           (same buildGrassField as GrassLayer.tsx),
 *   • the full PROP set           (same placeAll routing as GroundProps.tsx —
 *     instanced boulders/logs/bushes/crates/barrels/sacks + composed town props),
 *   • per-chunk BUSHES, styled ROOFS, town WALLS / GATES / DECKS / ROADS.
 * All of it consumes the game's own data (chunk bundles + GroundWorld.props); only
 * the material path changed.
 *
 * PARITY FIX — why materials are hand-lit TSL node materials, not
 * `<meshStandardMaterial>` + scene `<directionalLight>`:
 *
 * On the WebGPU node path (three r0.170) `MeshStandardMaterial`'s lighting is
 * driven by a `LightsNode` built ONCE at first material-compile and never
 * re-detecting lights added afterwards (three.js #30044). With R3F v9's light
 * intrinsics (#2853, "not planned") the captured light set is effectively empty,
 * so every lit surface receives ZERO irradiance — `albedo × 0 = black`. That was
 * the original probe's near-black terrain. The fix (hardware-verified by Remy on
 * an RTX 2070S): bypass the scene-light pipeline — each material is an unlit
 * `MeshBasicNodeMaterial` whose `colorNode` bakes a hemisphere + directional
 * Lambert term against a constant sun. Deterministic, backend-independent, needs
 * no scene lights. Fog + tone mapping still wrap the unlit result.
 *
 * SHADOWS: real-time three.js shadow maps are NOT driven on the WebGPU node path
 * when lighting is baked into colorNode (there is no LightsNode consuming a shadow
 * map). Rather than fake it, the probe reports "Real-time shadows (node path)" as
 * an explicit on-screen MISSING line — see the sub-spec's status note.
 *
 * NO FALLBACK: if WebGPU is unavailable the renderer construction throws and the
 * probe fails loudly; the badge shows the real backend either way.
 */
import React from 'react';
import type { ChunkLoader } from '@/systems/world3d/types';
import { type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
import type { ProbeStatus } from './WebGPUProbe';
interface Props {
    loader: ChunkLoader;
    ground: GroundWorld;
    start: readonly [number, number, number];
    startSurfaceY: number;
    onStatus: (s: ProbeStatus) => void;
    /** FAIL-FAST: called when the renderer inits but is NOT a WebGPU backend, or
     *  init throws. The host tears the scene down to the error pane (no fallback). */
    onFatal: (reason: string) => void;
}
declare const _default: React.NamedExoticComponent<Props>;
export default _default;
