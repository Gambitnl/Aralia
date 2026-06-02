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
            zIndex: 20,
          }}
        >
          <button
            type="button"
            data-testid="hud-open-map"
            onClick={handleOpenMap}
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
            Open Map
          </button>
          <button
            onClick={handleExitToMenu}
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
            Exit to Menu
          </button>
        </div>
      )}
    </div>
  );
};

export default HUDControlPanel;
