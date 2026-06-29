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
  /**
   * Pull the camera up to an overhead "Town Cell" framing of the whole town,
   * staying in 3D. Only provided in ground mode (otherwise the button hides).
   */
  onFrameTownCell?: () => void;
  /**
   * Open the 2D Voronoi world map (modal over the 3D view) centered on the
   * player's town cell. Only provided in ground mode (otherwise hides).
   */
  onOpenCellMap?: () => void;
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
  onFrameTownCell,
  onOpenCellMap,
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
          // D5: the Controls dropdown sat flush at the right edge where the fixed
          // "Party Chat" tab also lives, so they collided / the tab clipped over it.
          // Reserve extra right clearance so the Controls trigger never tucks under
          // the right-edge tab strip.
          padding: '8px 56px 8px 12px',
          // Give the interactive top bar its own stacking context above the HUD base
          // so its dropdown (raised further in HUDControlPanel) sits over canvas chrome.
          position: 'relative',
          zIndex: 30,
          pointerEvents: 'auto', // Re-enable pointer events for interactive elements
        }}
      >
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            // D2: the title sat as light-gray text directly over the bright sky and
            // was nearly invisible. Give it a dark translucent pill backing + a
            // text-shadow so it stays legible over any 3D background (light sky or
            // dark terrain), not just the dark surface the token assumes.
            color: '#ffffff',
            backgroundColor: 'rgba(15, 23, 33, 0.66)',
            padding: '4px 10px',
            borderRadius: '6px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
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
        {isGroundMode && onFrameTownCell && (
          <button
            type="button"
            data-testid="hud-frame-town-cell"
            onClick={onFrameTownCell}
            title="Zoom out to the town cell — overhead view of the whole town, stays in 3D"
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
            ⤢ Town Cell
          </button>
        )}
        {isGroundMode && onOpenCellMap && (
          <button
            type="button"
            data-testid="hud-open-cell-map"
            onClick={onOpenCellMap}
            title="Open the 2D world map centered on this town's cell — overlays the 3D view"
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
            🗺 Cell Map
          </button>
        )}
        {onToggleGroundMode && (
          <button
            type="button"
            data-testid="hud-toggle-ground-mode"
            onClick={onToggleGroundMode}
            // D6: distinguish this from the exit controls. This toggle changes the
            // 3D zoom level (walking village ↔ flying continent) — it does NOT leave
            // 3D. The tooltip spells that out so it isn't confused with "Open Map"
            // (returns to the 2D game) or "Exit to Menu" (quits).
            title={
              isGroundMode
                ? 'Zoom out to the continent view — stays in 3D'
                : 'Zoom in to the village on foot — stays in 3D'
            }
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
