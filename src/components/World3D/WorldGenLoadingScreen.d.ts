/**
 * @file WorldGenLoadingScreen.tsx
 * @description The loading view shown while the 3D world assembles off the main
 * thread (staged 3D world entry). Replaces the old error-looking "World data is
 * not ready" placeholder with honest, advancing stage text over a progress bar.
 *
 * The stages map to real work in the world-gen pipeline:
 *   land    — resolving the region (getWorldforgeLocalForCell)
 *   town    — assembling terrain + town (makeGroundWorld); begins on the worker's
 *             'town' progress signal
 *   details — placing props (Stage B), after terrain + town are already visible
 *
 * The parent (World3DWrapper) decides which stage to show from the world-gen
 * client's callbacks, and unmounts this screen once the scene can render.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import React from 'react';
export type WorldGenLoadingStage = 'land' | 'town' | 'details';
interface Props {
    stage: WorldGenLoadingStage;
}
declare const WorldGenLoadingScreen: React.FC<Props>;
export default WorldGenLoadingScreen;
