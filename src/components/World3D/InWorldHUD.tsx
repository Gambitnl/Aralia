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
 * - DebugHUD: dev-only technical readout (chunk count, FPS, coords, streamer
 *   stats) — hosted inside the "3D World View" title dropdown when dev mode is on
 */

import React, { useState, useRef, useEffect } from 'react';
import HUDControlPanel from './HUDControlPanel';
import ViewModeToggle from './ViewModeToggle';
import DebugHUD from './DebugHUD';
import World3DMinimap from './World3DMinimap';
import type { WorldData } from '../../services/worldSim/types';
import type { PlayerWorldPosition } from '../../types';
import type { WorldGenDiagnostics } from '../../types/world';
import type { CanonicalTownIdentity } from '../../systems/worldforge/artifacts';
import type { GroundFocus } from '../../systems/worldforge/leaf3d/atlasGroundDrilldown';

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
  /**
   * Open the 2D world map (modal over the 3D view) drilled straight to the
   * player's town PLAN — the detailed building/ward map of the town the player
   * is standing in. Only provided in ground mode (otherwise hides).
   */
  onOpenTownPlan?: () => void;
  /** Canonical retained-Local focus shown as the PLAYING place identity. */
  groundFocus?: GroundFocus | null;
  /** Atlas burg identity copied through Region and Local without renaming. */
  groundTownIdentity?: CanonicalTownIdentity | null;
}

/**
 * Top-left title pill. With dev mode off it is the plain "3D World View" label.
 * With dev mode on it becomes a disclosure button (same interaction pattern as
 * the Controls dropdown) whose panel hosts the DebugHUD technical readout —
 * the debug overlay no longer floats permanently over the scene.
 */
const WorldViewTitle: React.FC<{
  isDevModeEnabled: boolean;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ isDevModeEnabled, title, subtitle, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const pillStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    // D2: the title sat as light-gray text directly over the bright sky and
    // was nearly invisible. Dark translucent pill backing + text-shadow keep
    // it legible over any 3D background.
    color: '#ffffff',
    backgroundColor: 'rgba(15, 23, 33, 0.66)',
    padding: '4px 10px',
    borderRadius: '6px',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
    fontFamily: 'Outfit, sans-serif',
  };

  const titleContent = (
    <span
      data-testid="hud-ground-place"
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}
    >
      <span>{title}</span>
      {subtitle ? (
        <span style={{ fontSize: '10px', fontWeight: 500, color: '#cbd5e1' }}>
          {subtitle}
        </span>
      ) : null}
    </span>
  );

  if (!isDevModeEnabled) {
    return <div style={pillStyle}>{titleContent}</div>;
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-testid="hud-world-view-info"
        onClick={() => setIsOpen(!isOpen)}
        title="Technical details (dev mode)"
        style={{
          ...pillStyle,
          border: '1px solid var(--border-color, #3a4a5a)',
          cursor: 'pointer',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {titleContent}
          <span aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
        </span>
      </button>
      {isOpen && (
        <div
          data-testid="hud-world-view-info-panel"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            // Above canvas chrome, mirroring the Controls dropdown (D5).
            zIndex: 1000,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

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
  onOpenTownPlan,
  groundFocus,
  groundTownIdentity,
}) => {
  // Ground place identity comes from the retained Local receipt. Relationship
  // facts stay compact so the HUD names the place and its visual cues without
  // covering the scene with developer diagnostics.
  const groundRelationship = groundTownIdentity
    ? [
        groundTownIdentity.settlementType,
        groundTownIdentity.hasRoadAccess ? 'road-linked' : null,
        groundTownIdentity.hasRiverAccess ? 'river-linked' : null,
        groundTownIdentity.isCoastal ? 'coastal' : null,
      ].filter((label): label is string => label !== null).join(' / ')
    : null;
  const groundSubtitle = groundFocus
    ? groundTownIdentity
      ? `Ground / ${groundRelationship} / biome #${groundTownIdentity.biomeId} / ${groundTownIdentity.sourceKind} #${groundTownIdentity.sourceId}`
      : `Ground / ${groundFocus.kind} #${String(groundFocus.id)}`
    : undefined;

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
        <WorldViewTitle
          isDevModeEnabled={isDevModeEnabled}
          title={groundFocus?.label ?? '3D World View'}
          subtitle={groundSubtitle}
        >
          <DebugHUD
            chunkCount={chunkCount ?? 0}
            fps={fps ?? 0}
            playerPos={playerPos ?? null}
            streamerStats={streamerStats}
            worldGen={worldGen}
          />
        </WorldViewTitle>
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
        {isGroundMode && onOpenTownPlan && (
          <button
            type="button"
            data-testid="hud-open-town-plan"
            onClick={onOpenTownPlan}
            title="Open the detailed town plan — the building/ward map of the town you're standing in (overlays the 3D view)"
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
            🏘 Town Plan
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

    </div>
  );
};

export default InWorldHUD;
