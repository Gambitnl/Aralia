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

interface InWorldHUDProps {
  /** Whether dev mode is enabled (controls DebugHUD visibility). */
  isDevModeEnabled: boolean;
  /** Current chunk count loaded (for DebugHUD). */
  chunkCount?: number;
  /** FPS counter value (for DebugHUD). */
  fps?: number;
  /** Player world position (for DebugHUD). */
  playerPos?: { x: number; y: number; z: number } | null;
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
}

const InWorldHUD: React.FC<InWorldHUDProps> = ({
  isDevModeEnabled,
  chunkCount,
  fps,
  playerPos,
  streamerStats,
  onOpenMap,
  onExitToMenu,
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

      {/* Bottom right: view mode toggle */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          pointerEvents: 'auto',
        }}
      >
        <ViewModeToggle onOpenMap={onOpenMap} />
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
            playerPos={playerPos}
            streamerStats={streamerStats}
          />
        </div>
      )}
    </div>
  );
};

export default InWorldHUD;
