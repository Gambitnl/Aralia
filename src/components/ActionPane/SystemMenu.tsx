import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Action } from '../../types';
import { canUseDevTools } from '../../utils/permissions';
import { ENV } from '../../config/env';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { ActionButton } from './ActionButton';
import { UI_ID } from '../../styles/uiIds';

// MENU1 — Semantic menu-item coloring.
// The shared ActionButton color-codes by action.type, producing an unrelated
// "rainbow" inside this dropdown (Discoveries=lime, Quests=blue, Dossiers=amber,
// Glossary=indigo, Party=green, Save=yellow…). In a vertical system menu those
// hues carry no meaning and compete for attention. We override them here with a
// consistent semantic system WITHOUT touching the shared ActionButton:
//   - navigation / neutral items  -> muted slate (btn-secondary look)
//   - persistence (Save/Auto-save) -> a single subtle "utility" accent
//   - destructive exit (Main Menu) -> red, the ONLY saturated color
//   - dev-only items               -> muted, clearly de-emphasised
// Tailwind utilities (passed via className) sit in the `utilities` layer, which
// wins over the `btn-*` `@layer components` classes ActionButton applies, so the
// last-applied className here re-colors the button without editing ActionButton.
const MENU_ITEM_NEUTRAL =
  'bg-gray-700 hover:bg-gray-600 text-gray-100 border border-gray-600 focus:ring-gray-500';
const MENU_ITEM_UTILITY =
  'bg-slate-600 hover:bg-slate-500 text-white border border-slate-500 focus:ring-slate-400';
const MENU_ITEM_DANGER =
  'bg-red-700 hover:bg-red-600 text-white border border-red-600 focus:ring-red-400';
const MENU_ITEM_DEV =
  'bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 focus:ring-gray-600';

/** Map an action to its semantic menu-item color classes. */
const menuItemColorFor = (action: Action): string => {
  switch (action.type) {
    case 'go_to_main_menu':
      return MENU_ITEM_DANGER; // destructive / exit — the only saturated hue
    case 'save_game':
    case 'toggle_auto_save':
      return MENU_ITEM_UTILITY; // persistence cluster
    case 'SET_DEV_MODE_ENABLED':
    case 'toggle_dev_menu':
      return MENU_ITEM_DEV; // de-emphasised dev affordances
    default:
      return MENU_ITEM_NEUTRAL; // navigation / journals — neutral
  }
};

interface SystemMenuProps {
  onAction: (action: Action) => void;
  disabled: boolean;
  unreadDiscoveryCount: number;
  hasNewRateLimitError: boolean;
  isDevModeEnabled: boolean;
  autoSaveEnabled: boolean;
}

export const SystemMenu: React.FC<SystemMenuProps> = ({
  onAction,
  disabled,
  unreadDiscoveryCount,
  hasNewRateLimitError,
  isDevModeEnabled,
  autoSaveEnabled,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  // MENU3 — captured scroll positions of scrollable ancestors at open time, so
  // we can undo the browser's "scroll focused element into view" jump that
  // useFocusTrap triggers when it focuses the first dropdown item.
  const scrollSnapshotRef = useRef<{ el: Element; top: number; left: number }[]>([]);

  // Record the scrollTop/Left of every scrollable ancestor of the menu trigger.
  // Called right before the menu opens (and thus before the focus trap fires).
  const snapshotAncestorScroll = useCallback(() => {
    const snap: { el: Element; top: number; left: number }[] = [];
    let node: HTMLElement | null = triggerRef.current?.parentElement ?? null;
    while (node) {
      const style = window.getComputedStyle(node);
      const oy = style.overflowY;
      const ox = style.overflowX;
      const scrollable =
        /(auto|scroll|overlay)/.test(oy) || /(auto|scroll|overlay)/.test(ox);
      if (scrollable && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) {
        snap.push({ el: node, top: node.scrollTop, left: node.scrollLeft });
      }
      node = node.parentElement;
    }
    scrollSnapshotRef.current = snap;
  }, []);

  // After the dropdown mounts and the focus trap has moved focus (which can
  // scroll the left HUD column and push the date/weather header out of view),
  // restore the captured scroll positions so the header stays put and the
  // dropdown stays anchored to its button.
  useLayoutEffect(() => {
    if (!isMenuOpen) return;
    const restore = () => {
      for (const { el, top, left } of scrollSnapshotRef.current) {
        if (el.scrollTop !== top) el.scrollTop = top;
        if (el.scrollLeft !== left) el.scrollLeft = left;
      }
    };
    // Restore now and once more next frame: useFocusTrap focuses on its own
    // effect (synchronously) and the browser may also adjust scroll async.
    restore();
    const raf = requestAnimationFrame(restore);
    return () => cancelAnimationFrame(raf);
  }, [isMenuOpen]);

  const handleToggleMenu = useCallback(() => {
    setIsMenuOpen((open) => {
      if (!open) snapshotAncestorScroll();
      return !open;
    });
  }, [snapshotAncestorScroll]);

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
      { action: { type: 'toggle_auto_save', label: `Auto-save: ${autoSaveEnabled ? 'On' : 'Off'}` } },
      { action: { type: 'go_to_main_menu', label: 'Main Menu' } },

      // MENU2 — Hide the player-facing "Enable Dev Mode" item.
      // `canUseDevTools()` is hardcoded to `true` (permissions.ts forces it on
      // "for testing"), so it leaked into the shipped player menu. Gate on the
      // build-time dev flag `ENV.VITE_ENABLE_DEV_TOOLS` (falls back to
      // `import.meta.env.DEV`, i.e. false in a production build) so the toggle
      // only appears in dev/internal builds — and keep the permission check too.
      ENV.VITE_ENABLE_DEV_TOOLS && canUseDevTools()
        ? { action: { type: 'SET_DEV_MODE_ENABLED', label: isDevModeEnabled ? 'Disable Dev Mode' : 'Enable Dev Mode', payload: { enabled: !isDevModeEnabled } } }
        : null,

      // Dev Feature Buttons
      isDevModeEnabled
        ? { action: { type: 'toggle_dev_menu', label: 'Dev Menu' }, hasNotification: hasNewRateLimitError }
        : null,
    ].filter(Boolean) as { action: Action; badgeCount?: number; hasNotification?: boolean }[],
    [unreadDiscoveryCount, hasNewRateLimitError, isDevModeEnabled, autoSaveEnabled],
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
        onClick={handleToggleMenu}
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
                  className={`w-full text-left ${menuItemColorFor(action)}`}
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
