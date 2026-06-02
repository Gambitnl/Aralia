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

interface DebugHUDProps {
  /** Number of chunks currently loaded. */
  chunkCount: number;
  /** Current FPS value. */
  fps: number;
  /** Player world position (or null). */
  playerPos: { x: number; y: number; z: number } | null;
  /** Streamer statistics. */
  streamerStats?: {
    chunksLoaded: number;
    chunksUnloaded: number;
    pendingRequests: number;
  };
}

const DebugHUD: React.FC<DebugHUDProps> = ({ chunkCount, fps, playerPos, streamerStats }) => {
  const posStr = playerPos
    ? `X: ${playerPos.x.toFixed(1)}  Y: ${playerPos.y.toFixed(1)}  Z: ${playerPos.z.toFixed(1)}`
    : 'X: —  Y: —  Z: —';

  return (
    <div
      style={{
        padding: '8px 10px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: 'var(--text-primary, #e8e8e8)',
        backgroundColor: 'var(--bg-surface, rgba(20, 30, 40, 0.9))',
        border: '1px solid var(--border-color, #3a4a5a)',
        borderRadius: '4px',
        lineHeight: 1.6,
        minWidth: '220px',
      }}
    >
      <div style={{ marginBottom: '4px', fontWeight: 600, fontSize: '12px', fontFamily: 'Outfit, sans-serif' }}>
        Debug HUD
      </div>
      <div>
        <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>FPS:</span> {fps}
      </div>
      <div>
        <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>Chunks:</span> {chunkCount}
      </div>
      <div>
        <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>Pos:</span> {posStr}
      </div>
      {streamerStats && (
        <>
          <div style={{ marginTop: '4px', borderTop: '1px solid var(--border-color, #3a4a5a)', paddingTop: '4px' }}>
            <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>Loaded:</span> {streamerStats.chunksLoaded}
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>Unloaded:</span> {streamerStats.chunksUnloaded}
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>Pending:</span> {streamerStats.pendingRequests}
          </div>
        </>
      )}
    </div>
  );
};

export default DebugHUD;
