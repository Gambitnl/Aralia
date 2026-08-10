// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/08/2026, 17:24:52
 * Dependents: components/World3D/InWorldHUD.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/World3D/HUDControlPanel.tsx
 * Dropdown menu with "Open Map" (exits to atlas) and "Exit to Menu" buttons.
 *
 * MVP scope: simple dropdown, flat design, CSS variable colors.
 */

import React, { useState, useRef, useEffect } from 'react';

interface HUDControlPanelProps {
  /** Callback when "Open Map" is clicked. */
  onOpenMap: () => void;
  /** Callback when "Exit to Menu" is clicked. */
  onExitToMenu: () => void;
  /** Whether the walking-scale Locale map exists for this 3D session. */
  isLocaleMapAvailable?: boolean;
  /** Current Locale map visibility, used to label the toggle honestly. */
  isLocaleMapOpen?: boolean;
  /** Reveal or hide the lower-left Locale map. */
  onToggleLocaleMap?: () => void;
  /** Developer inspector launchers are omitted outside dev mode. */
  isDevModeEnabled?: boolean;
  /** Open the existing Agent sim inspector mounted by GameModals. */
  onOpenAgentSim?: () => void;
  /** Open the existing Town history inspector mounted by GameModals. */
  onOpenTownHistory?: () => void;
}

const HUDControlPanel: React.FC<HUDControlPanelProps> = ({
  onOpenMap,
  onExitToMenu,
  isLocaleMapAvailable = false,
  isLocaleMapOpen = false,
  onToggleLocaleMap,
  isDevModeEnabled = false,
  onOpenAgentSim,
  onOpenTownHistory,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside.
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

  const handleOpenMap = () => {
    setIsOpen(false);
    onOpenMap();
  };

  const handleExitToMenu = () => {
    setIsOpen(false);
    onExitToMenu();
  };

  // Every action closes the dropdown before revealing its panel. This leaves
  // one clear owner on screen and prevents the menu from covering the tool it
  // just opened.
  const runControlAction = (action?: () => void) => {
    setIsOpen(false);
    action?.();
  };

  const menuActionStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: 'Outfit, sans-serif',
    color: 'var(--text-primary, #e8e8e8)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-color, #3a4a5a)',
    textAlign: 'left',
    cursor: 'pointer',
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '6px 12px',
          fontSize: '13px',
          fontFamily: 'Outfit, sans-serif',
          color: 'var(--text-primary, #e8e8e8)',
          backgroundColor: isOpen ? 'var(--bg-surface, #2a3a4a)' : 'var(--bg-surface-alt, #1e2e3e)',
          border: '1px solid var(--border-color, #3a4a5a)',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Controls {isOpen ? '\u25B2' : '\u25BC'}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '240px',
            backgroundColor: 'var(--bg-surface, #2a3a4a)',
            border: '1px solid var(--border-color, #3a4a5a)',
            borderRadius: '4px',
            // D5: the open dropdown drops down toward the fixed right-edge "Party Chat"
            // tab (which uses a mid-tier overlay z-index). Raise the menu well above it
            // so the controls are never occluded by / colliding with the tab.
            zIndex: 1000,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Movement help — how to drive the map camera (MapControls bindings). */}
          <div
            data-testid="hud-movement-help"
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-color, #3a4a5a)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary, #8a9aaa)',
                marginBottom: '6px',
              }}
            >
              Move the Map
            </div>
            {[
              ['Pan', 'Left-click + drag'],
              ['Rotate / tilt', 'Right-click + drag'],
              ['Zoom', 'Mouse wheel / scroll'],
              ['Touch', 'One finger pan · two fingers zoom & rotate'],
            ].map(([label, hint]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '12px',
                  color: 'var(--text-primary, #e8e8e8)',
                  lineHeight: 1.6,
                }}
              >
                <span style={{ color: 'var(--text-secondary, #8a9aaa)' }}>{label}</span>
                <span style={{ textAlign: 'right' }}>{hint}</span>
              </div>
            ))}
          </div>

          {(isLocaleMapAvailable || (isDevModeEnabled && (onOpenAgentSim || onOpenTownHistory))) && (
            <>
              <div
                style={{
                  padding: '6px 12px 4px',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary, #8a9aaa)',
                  borderBottom: '1px solid var(--border-color, #3a4a5a)',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                View tools
              </div>
              {isLocaleMapAvailable && onToggleLocaleMap && (
                <button
                  type="button"
                  data-testid="hud-toggle-locale-map"
                  onClick={() => runControlAction(onToggleLocaleMap)}
                  style={menuActionStyle}
                >
                  <div style={{ fontWeight: 600 }}>{isLocaleMapOpen ? 'Hide Locale map' : 'Show Locale map'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary, #8a9aaa)', marginTop: '1px' }}>
                    Click-to-move view of the current Locale
                  </div>
                </button>
              )}
              {isDevModeEnabled && onOpenAgentSim && (
                <button
                  type="button"
                  data-testid="hud-open-agent-sim"
                  onClick={() => runControlAction(onOpenAgentSim)}
                  style={menuActionStyle}
                >
                  <div style={{ fontWeight: 600 }}>Agent sim</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary, #8a9aaa)', marginTop: '1px' }}>
                    Inspect the live town schedule
                  </div>
                </button>
              )}
              {isDevModeEnabled && onOpenTownHistory && (
                <button
                  type="button"
                  data-testid="hud-open-town-history"
                  onClick={() => runControlAction(onOpenTownHistory)}
                  style={menuActionStyle}
                >
                  <div style={{ fontWeight: 600 }}>Town history</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary, #8a9aaa)', marginTop: '1px' }}>
                    Inspect institutions and recent news
                  </div>
                </button>
              )}
            </>
          )}

          {/* D6: group the two exits under a clear header and give each a one-line
              subtitle + tooltip so a first-timer knows which returns to the 2D game
              (Return to Map) vs which quits the session (Exit to Menu). These are
              distinct from the "Ascend / Enter Village" toggle, which stays in 3D. */}
          <div
            style={{
              padding: '6px 12px 4px',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary, #8a9aaa)',
              borderBottom: '1px solid var(--border-color, #3a4a5a)',
              fontFamily: 'Outfit, sans-serif',
            }}
          >
            Leave 3D
          </div>
          <button
            type="button"
            data-testid="hud-open-map"
            onClick={handleOpenMap}
            title="Go back to the 2D world map and continue the game"
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--text-primary, #e8e8e8)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border-color, #3a4a5a)',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #3a4a5a)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ fontWeight: 600 }}>Return to Map (2D)</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #8a9aaa)', marginTop: '1px' }}>
              Back to the game world map
            </div>
          </button>
          <button
            onClick={handleExitToMenu}
            title="Quit to the main menu (leaves the game)"
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              fontFamily: 'Outfit, sans-serif',
              color: 'var(--text-danger, #e55)',
              backgroundColor: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #3a4a5a)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div style={{ fontWeight: 600 }}>Exit to Menu</div>
            <div style={{ fontSize: '11px', color: 'var(--text-danger, #e88)', marginTop: '1px' }}>
              Quit to the main menu
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

export default HUDControlPanel;
