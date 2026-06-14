/**
 * @file src/components/World3D/InWorldHUD.tsx
 * HUD container that overlays the 3D canvas without blocking R3F interaction.
 *
 * Mounts as a sibling of World3DScene inside World3DWrapper.
 * Uses position: absolute; pointer-events: auto to overlay the canvas.
 *
 * Sub-components:
 * - HUDControlPanel: dropdown menu with "Open Map", "Exit to Menu"
 * - ViewModeToggle: switch between 3D/Atlas modes
 * - DebugHUD: dev-only overlays (chunk count, FPS, coords, streamer stats)
 */

import React from 'react';
import HUDControlPanel from './HUDControlPanel';
import ViewModeToggle from './ViewModeToggle';
import DebugHUD from './DebugHUD';
import World3DMinimap from './World3DMinimap';
import type { WorldData } from '../../services/worldSim/types';
import type { PlayerWorldPosition } from '../../types';
import type { WorldGenDiagnostics } from '../../types/world';

interface InWorldHUDProps {
  /** Whether dev mode is enabled (controls DebugHUD visibility). */
  isDevModeEnabled: boolean;
  /** World source for the in-3D minimap (null hides it). */
  worldData?: WorldData | null;
  /** World generation provenance (primary vs fallback) for the DebugHUD. */
  worldGen?: WorldGenDiagnostics | null;
  /** Current chunk count loaded (for DebugHUD). */
  chunkCount?: number;
  /** FPS counter value (for DebugHUD). */
  fps?: number;
  /** Player world position (for DebugHUD and minimap). */
  playerPos?: PlayerWorldPosition | null;
  /** Streamer stats (for DebugHUD). */
  streamerStats?: {
    chunksLoaded: number;
    chunksUnloaded: number;
    pendingRequests: number;
  };
  /** Callback when "Open Map" is clicked — returns to atlas mode. */
  onOpenMap: () => void;
  /** Callback when "Exit to Menu" is clicked — returns to main menu. */
  onExitToMenu: () => void;
  /** Whether we are currently in Ground/Village mode (vs Continent mode). */
  isGroundMode?: boolean;
  /** Callback to toggle between Ground and Continent views. */
  onToggleGroundMode?: () => void;
}

const InWorldHUD: React.FC<InWorldHUDProps> = ({
  isDevModeEnabled,
  worldData,
  worldGen,
  chunkCount,
  fps,
  playerPos,
  streamerStats,
  onOpenMap,
  onExitToMenu,
  isGroundMode = false,
  onToggleGroundMode,
}) => {
  return (
    <div
      data-testid="world-3d-hud"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 10,
        pointerEvents: 'none', // Let clicks pass through to canvas by default
      }}
    >
      {/* Top bar: location name + control panel */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          pointerEvents: 'auto', // Re-enable pointer events for interactive elements
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--text-primary, #e8e8e8)',
            fontFamily: 'Outfit, sans-serif',
          }}
        >
          3D World View
        </div>
        <HUDControlPanel onOpenMap={onOpenMap} onExitToMenu={onExitToMenu} />
      </div>

      {/* Bottom right: Enter Village / Ascend toggle + View Mode toggle */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          pointerEvents: 'auto',
        }}
      >
        {onToggleGroundMode && (
          <button
            type="button"
            data-testid="hud-toggle-ground-mode"
            onClick={onToggleGroundMode}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontFamily: 'Outfit, sans-serif',
              fontWeight: 600,
              color: 'var(--text-primary, #e8e8e8)',
              backgroundColor: 'var(--bg-surface-alt, #1e2e3e)',
              border: '1px solid var(--border-color, #3a4a5a)',
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-active, #3a5a7a)';
              e.currentTarget.style.borderColor = 'var(--text-secondary, #8a9aaa)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-surface-alt, #1e2e3e)';
              e.currentTarget.style.borderColor = 'var(--border-color, #3a4a5a)';
            }}
          >
            {isGroundMode ? 'Ascend to Continent' : 'Enter Village'}
          </button>
        )}
        <ViewModeToggle onOpenMap={onOpenMap} />
      </div>

      {/* Bottom left: in-3D minimap (deferred Plan 4 UX) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          pointerEvents: 'none',
        }}
      >
        <World3DMinimap worldData={worldData ?? null} playerWorldPos={playerPos ?? null} />
      </div>

      {/* Debug overlay (dev-only) */}
      {isDevModeEnabled && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '12px',
            pointerEvents: 'auto',
          }}
        >
          <DebugHUD
            chunkCount={chunkCount ?? 0}
            fps={fps ?? 0}
            playerPos={playerPos ?? null}
            streamerStats={streamerStats}
            worldGen={worldGen}
          />
        </div>
      )}
    </div>
  );
};

export default InWorldHUD;
