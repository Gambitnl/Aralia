import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Action } from '../../types';
import { canUseDevTools } from '../../utils/permissions';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { ActionButton } from './ActionButton';
import { UI_ID } from '../../styles/uiIds';

interface SystemMenuProps {
  onAction: (action: Action) => void;
  disabled: boolean;
  unreadDiscoveryCount: number;
  hasNewRateLimitError: boolean;
  isDevDummyActive: boolean; // Retained prop for completeness, though specific usage might be implicitly handled by permissions
  isDevModeEnabled: boolean;
}

export const SystemMenu: React.FC<SystemMenuProps> = ({
  onAction,
  disabled,
  unreadDiscoveryCount,
  hasNewRateLimitError,
  isDevDummyActive: _isDevDummyActive,
  isDevModeEnabled
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    // Restore focus to trigger button
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  };

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isMenuOpen, handleCloseMenu);

  // RALPH: Logic Extraction.
  // Uses the centralized keyboard nav hook to handle ArrowUp/ArrowDown within the menu.
  const { handleKeyDown: handleMenuKeyDown } = useKeyboardNavigation({
    containerRef: focusTrapRef,
    orientation: 'vertical',
    onClose: handleCloseMenu
  });

  const systemMenuActions = useMemo(
    () => [
      // RALPH: Functional Grouping.
      // Top section: Gameplay Logs & Journaling.
      { action: { type: 'TOGGLE_DISCOVERY_LOG', label: 'Discoveries' }, badgeCount: unreadDiscoveryCount },
      { action: { type: 'TOGGLE_QUEST_LOG', label: 'Quests' } },
      { action: { type: 'TOGGLE_LOGBOOK', label: 'Dossiers' } },
      { action: { type: 'TOGGLE_GLOSSARY_VISIBILITY', label: 'Glossary' } },
      { action: { type: 'toggle_party_overlay', label: 'Party' } },
      { action: { type: 'TOGGLE_GAME_GUIDE', label: 'Game Guide' } },

      // Middle section: Persistence (Save/Quit).
      { action: { type: 'save_game', label: 'Save Game' } },
      { action: { type: 'go_to_main_menu', label: 'Main Menu' } },

      // RALPH: Dev-Only Guard.
      // Logic-gated options that only appear for internal builds or dev mode.
      // Developer Mode Toggle
      canUseDevTools()
        ? { action: { type: 'SET_DEV_MODE_ENABLED', label: isDevModeEnabled ? 'Disable Dev Mode' : 'Enable Dev Mode', payload: { enabled: !isDevModeEnabled } } }
        : null,

      // Dev Feature Buttons
      isDevModeEnabled
        ? { action: { type: 'toggle_dev_menu', label: 'Dev Menu' }, hasNotification: hasNewRateLimitError }
        : null,
    ].filter(Boolean) as { action: Action; badgeCount?: number; hasNotification?: boolean }[],
    [unreadDiscoveryCount, hasNewRateLimitError, isDevModeEnabled],
  );

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is outside the entire menu container (trigger + dropdown)
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    // Only attach listener when menu is open
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div id={UI_ID.SYSTEM_MENU} data-testid={UI_ID.SYSTEM_MENU} className="mt-6 pt-4 border-t border-gray-700 flex justify-end relative" ref={menuContainerRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg shadow transition-colors"
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
      >
        {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        <span>Menu</span>
        {(unreadDiscoveryCount > 0 || hasNewRateLimitError) && (
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-gray-800 animate-pulse"></span>
        )}
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            ref={focusTrapRef}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-56 bg-gray-800 border border-gray-600 rounded-lg shadow-xl overflow-hidden z-[var(--z-index-submap-overlay)] flex flex-col p-2 gap-2"
            role="menu"
            onKeyDown={handleMenuKeyDown}
          >
            {systemMenuActions.map(({ action, badgeCount, hasNotification }, idx) => (
              <React.Fragment key={`${action.type}-${idx}`}>
                {idx === 6 && <div className="h-px bg-gray-600 my-1" aria-hidden="true"></div>}
                <ActionButton
                  className="w-full text-left"
                  action={action}
                  onClick={(a) => {
                    onAction(a);
                    handleCloseMenu();
                  }}
                  disabled={disabled}
                  badgeCount={badgeCount}
                  hasNotification={hasNotification}
                  role="menuitem"
                  tabIndex={0}
                />
              </React.Fragment>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
