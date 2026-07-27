/**
 * @file src/components/World3D/DebugHUD.tsx
 * Dev-only overlay showing diagnostic information:
 * - Player world coordinates (X, Y, Z)
 * - Chunk count loaded
 * - FPS counter
 * - Streamer stats (chunks loaded/unloaded, pending requests)
 *
 * Only visible when gameState.isDevModeEnabled is true.
 * Flat design, CSS variable colors, monospace font for data.
 */
import React from 'react';
import type { WorldGenDiagnostics } from '../../types/world';
interface DebugHUDProps {
    /** Number of chunks currently loaded. */
    chunkCount: number;
    /** Current FPS value. */
    fps: number;
    /** Player world position (or null). */
    playerPos: {
        x: number;
        y: number;
        z: number;
    } | null;
    /** Streamer statistics. */
    streamerStats?: {
        chunksLoaded: number;
        chunksUnloaded: number;
        pendingRequests: number;
    };
    /** How the current world was generated (primary vs fallback). */
    worldGen?: WorldGenDiagnostics | null;
}
declare const DebugHUD: React.FC<DebugHUDProps>;
export default DebugHUD;
