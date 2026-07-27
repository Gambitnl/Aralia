/**
 * @file src/components/World3D/TransitionController.tsx
 * Orchestrates the mount/unmount handoff between the 2D atlas and 3D scene.
 *
 * Entry sequence (atlas → 3D):
 * 1. Fade-out atlas (~300ms)
 * 2. Mount World3DScene with correct start position
 * 3. Camera dive animation (~1500ms)
 * 4. Player gains control, onComplete fires
 *
 * Exit sequence (3D → atlas):
 * 1. Camera lerp up (~800ms) — handled by scene unmount animation
 * 2. Fade-in atlas (~400ms)
 * 3. Scene unmounts (or pauses, depending on perf strategy)
 *
 * This component owns the transition timing and visibility logic only.
 * Entry world coordinates live on World3DWrapper (sceneContent), not here — W3DUI-24.
 * It does not reach into R3F internals.
 */
import React from 'react';
export interface TransitionControllerProps {
    /** Current view mode: 'atlas' shows the 2D map, '3d' shows the 3D world. */
    mode: 'atlas' | '3d';
    /** Called when the entry transition completes and player gains control. */
    onComplete: () => void;
    /** Called after the 3D scene fully unmounts and Atlas owns its retained state. */
    onAtlasRestored?: () => void;
    /** The 2D atlas content (MapPane + GameLayout). */
    atlasContent: React.ReactNode;
    /** The 3D scene content (World3DScene + InWorldHUD). */
    sceneContent: React.ReactNode;
}
declare const TransitionController: React.FC<TransitionControllerProps>;
export default TransitionController;
