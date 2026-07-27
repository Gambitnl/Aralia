/**
 * @file GroundProps.tsx
 * @description Render rung for the WAVE-1 beautification props. `GroundWorld`
 * already carries a deterministic `props: PropInstance[]` layer (market stalls,
 * dock crates, smithy woodpiles, farm fences, wilderness boulders/logs/bushes —
 * see src/systems/worldforge/props/); NOTHING rendered them until this file.
 *
 * Approach (matches the flat-shaded primitive look of the streamed world):
 *  - High-count S-class props (crate, barrel, sack, bush, boulder, haystack)
 *    render as ONE InstancedMesh per form — wilderness scatter can be large.
 *  - Low-count composed props (stall, woodpile, fence run, well, trough,
 *    fallen log, cart, crate-stack) render as per-instance <group>s of a few
 *    primitives each.
 *  - Position: xM/zM are tile-local ground meters (the GroundFeature
 *    convention); Y is sampled from the ground heightfield exactly the way
 *    PlayerAvatar plants itself (groundSurfaceYM), then shifted into scene
 *    space by subtracting the scene origin — the same rebase every other
 *    ground-mode piece uses.
 *  - All variation (rotation, scale jitter, variant index) is seed-derived on
 *    the instance, so the render is deterministic per world+window.
 */
import React from 'react';
import type { SceneOrigin } from '@/systems/world3d/sceneOrigin';
import { type GroundWorld } from '@/systems/worldforge/bridge/groundChunkLoader';
interface GroundPropsProps {
    ground?: GroundWorld | null;
    sceneOrigin: SceneOrigin;
}
declare const GroundProps: React.FC<GroundPropsProps>;
export default GroundProps;
