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
  playerPos: { x: number; y: number; z: number } | null;
  /** Streamer statistics. */
  streamerStats?: {
    chunksLoaded: number;
    chunksUnloaded: number;
    pendingRequests: number;
  };
  /** How the current world was generated (primary vs fallback). */
  worldGen?: WorldGenDiagnostics | null;
}

/** Maps a generation source to a label + color (amber/red for degraded paths). */
const WORLD_SOURCE_META: Record<
  WorldGenDiagnostics['source'],
  { label: string; color: string; isFallback: boolean }
> = {
  'azgaar-derived': { label: 'Azgaar-derived', color: '#5bd66f', isFallback: false },
  'legacy-fallback': { label: 'LEGACY FALLBACK', color: '#ff6b6b', isFallback: true },
  'biome-derived': { label: 'BIOME-DERIVED', color: '#f0ad4e', isFallback: true },
};

const DebugHUD: React.FC<DebugHUDProps> = ({ chunkCount, fps, playerPos, streamerStats, worldGen }) => {
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

      {/* World generation provenance — surfaces silent fallback/flat worlds (WSS-004). */}
      {worldGen && (() => {
        const meta = WORLD_SOURCE_META[worldGen.source];
        return (
          <div
            data-testid="debug-world-gen"
            style={{
              marginTop: '4px',
              borderTop: '1px solid var(--border-color, #3a4a5a)',
              paddingTop: '4px',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>World:</span>{' '}
              <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
            </div>
            {meta.isFallback && (
              <div
                data-testid="debug-world-gen-reason"
                style={{
                  marginTop: '2px',
                  color: meta.color,
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  maxWidth: '260px',
                }}
              >
                ⚠ {worldGen.reason ?? 'Fallback generator active (reason not recorded).'}
              </div>
            )}
          </div>
        );
      })()}

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
