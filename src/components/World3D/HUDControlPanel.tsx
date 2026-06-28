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
}

const HUDControlPanel: React.FC<HUDControlPanelProps> = ({ onOpenMap, onExitToMenu }) => {
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
            minWidth: '160px',
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
