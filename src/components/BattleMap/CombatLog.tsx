/**
 * @file CombatLog.tsx
 * @modified 2026-05-03
 *
 * Displays a scrollable log of combat events in the right sidebar of CombatView.
 *
 * Supports two display modes:
 *   1. Legacy mode (default fallback): Renders CombatLogEntry[] with basic color coding
 *      by entry type (damage=red, heal=green, status=purple, turn_start=amber).
 *   2. Rich mode: Renders CombatMessage[] with type-specific color coding from the
 *      messageFactory palette AND priority-based left borders (amber=critical, red=high,
 *      blue=medium, none=low).
 *
 * The mode is controlled by the `useRichDisplay` prop. When true AND richMessages are
 * available, rich mode is used. Otherwise it falls back to legacy mode automatically.
 *
 * FEATURES:
 *   - Inline resize: Drag the top edge to make the embedded panel taller or shorter.
 *     The height persists in localStorage so it survives page refreshes.
 *   - Pop-out window: Click the expand icon to open the log in a draggable, resizable
 *     WindowFrame modal. Click close to collapse it back into the sidebar.
 *
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
// CombatLogEntry: The simple log entry type from the existing combat system.
// Used in legacy display mode (fallback when rich messages aren't available).
import { CombatLogEntry } from '../../types/combat';

// CombatMessage: The rich message type from the combat messaging system.
// Imported as type-only since we only read its properties for rendering.
import type { CombatMessage } from '../../types/combatMessages';

// MessagePriority: Enum values (LOW, MEDIUM, HIGH, CRITICAL) imported as values (not type-only)
// because we use them as keys in the priorityBorder lookup object below.
import { MessagePriority } from '../../types/combatMessages';

// getMessageColor: Utility from messageFactory that maps a CombatMessageType to a Tailwind
// text color class (e.g. DAMAGE_DEALT → 'text-red-400', HEALING_RECEIVED → 'text-green-400').
// Provides more granular coloring than the legacy getEntryStyle which only distinguishes 4 types.
import { getMessageColor } from '../../utils/combat/messageFactory';

/**
 * CombatLogProps
 *
 * @property logEntries    - Required. The simple CombatLogEntry[] from useCombatLog.
 *                           Always passed for backward compatibility and used as the
 *                           fallback display when rich mode is off.
 * @property richMessages  - Optional. The CombatMessage[] from useCombatMessaging.
 *                           Only rendered when useRichDisplay is true AND this array is non-empty.
 * @property useRichDisplay - Optional. When true, enables the rich display mode.
 *                           Defaults to false (legacy mode) if omitted.
 */
interface CombatLogProps {
  logEntries: CombatLogEntry[];
  richMessages?: CombatMessage[];
  useRichDisplay?: boolean;
}

/**
 * priorityBorder — Maps MessagePriority enum values to Tailwind CSS border classes.
 *
 * Each message in rich mode gets a colored left border indicating its priority level.
 * This provides at-a-glance visual hierarchy:
 *   - CRITICAL (amber): Game-changing moments like level-ups or boss defeats.
 *   - HIGH (red): Significant events like kills or opportunity attack hits.
 *   - MEDIUM (blue): Standard combat events like normal hits or spell casts.
 *   - LOW (no border): Routine events like turn transitions or missed attacks.
 *
 * The border is applied via the `pl-2` padding-left class combined with these border classes.
 */
const priorityBorder: Record<string, string> = {
  [MessagePriority.CRITICAL]: 'border-l-2 border-amber-400',
  [MessagePriority.HIGH]: 'border-l-2 border-red-400',
  [MessagePriority.MEDIUM]: 'border-l-2 border-blue-400',
  [MessagePriority.LOW]: 'border-l-0',
};

/**
 * getEntryStyle — Legacy color mapping for CombatLogEntry types.
 *
 * Used only in fallback/legacy mode when rich messages are not available.
 * Maps the 6-value union type to Tailwind text color classes:
 *   - 'damage' → red (enemy/environmental damage)
 *   - 'heal' → green (HP restoration)
 *   - 'status' → purple (buffs, debuffs, conditions, saves)
 *   - 'turn_start' → amber with semibold (turn/round transitions)
 *   - 'action', 'turn_end', or any other → gray (general actions)
 *
 * @param type - The CombatLogEntry.type string literal.
 * @returns A Tailwind CSS class string for text coloring.
 */
const getEntryStyle = (type: CombatLogEntry['type']) => {
  switch (type) {
    case 'damage': return 'text-red-400';
    case 'heal': return 'text-green-400';
    case 'status': return 'text-purple-400';
    case 'turn_start': return 'text-amber-300 font-semibold';
    default: return 'text-gray-300';
  }
};

// ============================================================================
// Inline Resize Constraints
// ============================================================================
// These constants define the min/max height for the embedded combat log panel.
// The user can drag the top edge to resize between these bounds. The height is
// saved to localStorage so it persists across page refreshes and sessions.
// ============================================================================
const MIN_LOG_HEIGHT = 120;
const MAX_LOG_HEIGHT = 600;
const DEFAULT_LOG_HEIGHT = 192; // ~h-48 equivalent
const STORAGE_KEY = 'aralia-combat-log-height';

/**
 * Loads the saved log height from localStorage, falling back to the default.
 * Returns a clamped value to prevent stale saved values from going out of range.
 */
const loadSavedHeight = (): number => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) {
        return Math.max(MIN_LOG_HEIGHT, Math.min(MAX_LOG_HEIGHT, parsed));
      }
    }
  } catch {
    // localStorage unavailable (e.g. SSR) — use default silently
  }
  return DEFAULT_LOG_HEIGHT;
};

/**
 * CombatLog — The combat log display component.
 *
 * Renders inside a resizable container in the right sidebar of CombatView.
 * Features:
 *   - Inline resize: Drag the top edge to make the panel taller or shorter.
 *     Height persists to localStorage across sessions.
 *   - Pop-out mode: Click the expand button to open the log in a WindowFrame
 *     modal that can be dragged, resized, and maximized independently.
 *   - Auto-scrolls to the newest entry when new messages arrive.
 *   - Sticky header ("Combat Log") that stays visible during scroll.
 *   - Conditionally renders in rich or legacy mode based on props.
 *
 * In rich mode, each message line shows:
 *   - A colored left border indicating priority (via priorityBorder lookup).
 *   - Text colored by message type (via getMessageColor from messageFactory).
 *   - The full description text, truncated with CSS ellipsis if it overflows.
 *   - A title attribute (tooltip on hover) showing the full untruncated description.
 *
 * In legacy mode, each entry shows:
 *   - Text colored by entry type (via getEntryStyle).
 *   - The raw message string.
 */
const CombatLog: React.FC<CombatLogProps> = ({ logEntries, richMessages, useRichDisplay }) => {
  // Invisible div at the bottom of the log — scrollIntoView is called on this element
  // whenever the message list changes, ensuring the user always sees the latest entry.
  const logEndRef = useRef<HTMLDivElement>(null);

  // Determine which display mode to use. Rich mode requires BOTH:
  //   1. useRichDisplay prop is truthy (caller opted in), AND
  //   2. richMessages array exists and has at least one message.
  // This prevents rendering an empty container when combat hasn't started yet.
  const displayRich = useRichDisplay && richMessages && richMessages.length > 0;

  const [isExpanded, setIsExpanded] = useState(false);

  // ---- Inline Resize State ----
  // The panel height is stored in state and persisted to localStorage.
  // The user drags a handle at the top of the panel to resize it.
  const [logHeight, setLogHeight] = useState(loadSavedHeight);
  const isResizingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

  /**
   * Handles the mousedown event on the resize handle.
   * Captures the starting Y position and height, then attaches global
   * mousemove/mouseup listeners for the duration of the drag.
   */
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = logHeight;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      // Dragging UP increases height (negative deltaY = taller panel)
      const deltaY = resizeStartYRef.current - moveEvent.clientY;
      const newHeight = Math.max(
        MIN_LOG_HEIGHT,
        Math.min(MAX_LOG_HEIGHT, resizeStartHeightRef.current + deltaY)
      );
      setLogHeight(newHeight);
    };

    const handleResizeEnd = () => {
      isResizingRef.current = false;
      // Persist the final height so it survives page refreshes
      try {
        localStorage.setItem(STORAGE_KEY, String(logHeight));
      } catch {
        // localStorage write failed — non-critical, just lose persistence
      }
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [logHeight]);

  // Save height whenever it changes (covers both drag and programmatic updates)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(logHeight));
    } catch {
      // Non-critical
    }
  }, [logHeight]);

  // Auto-scroll effect: fires whenever either message source changes.
  // Both logEntries and richMessages are in the dependency array so scrolling works
  // regardless of which display mode is active.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries, richMessages, isExpanded]);

  const logContent = (
      <div className="space-y-1 text-sm pb-2">
        {displayRich
          // --- RICH MODE ---
          // Renders CombatMessage[] with enhanced styling.
          ? richMessages.map(msg => (
              <p
                key={msg.id}
                // Classes applied:
                //   pl-2: Left padding to make room for the priority border.
                //   priorityBorder[msg.priority]: Left border color based on message priority.
                //     Falls back to '' if the priority value isn't in the lookup (shouldn't happen).
                //   getMessageColor(msg.type): Text color based on the CombatMessageType enum.
                //     E.g. DAMAGE_DEALT → 'text-red-400', HEALING_RECEIVED → 'text-green-400'.
                //   truncate: Tailwind utility that adds overflow:hidden, text-overflow:ellipsis,
                //     and white-space:nowrap — prevents long messages from wrapping or expanding the container.
                className={`pl-2 ${priorityBorder[msg.priority] || ''} ${getMessageColor(msg.type)} truncate`}
                // title attribute provides a tooltip on hover with the full untruncated description,
                // so users can read long messages that got clipped by the truncate class.
                title={msg.description}
              >
                {/* Display the full description text (which is the original CombatLogEntry.message
                    preserved verbatim by the adapter). The truncate class handles overflow visually. */}
                {msg.description}
              </p>
            ))
          // --- LEGACY MODE ---
          // Renders CombatLogEntry[] with the original simple styling.
          // This path is used when useRichDisplay is false or richMessages is empty.
          : logEntries.map(entry => (
              <p key={entry.id} className={getEntryStyle(entry.type)}>
                {entry.message}
              </p>
            ))
        }
        {/* Invisible scroll anchor — scrollIntoView targets this element to auto-scroll
            to the bottom whenever new messages arrive. */}
        <div ref={logEndRef} />
      </div>
  );

  return (
    <>
      <div
        className={`bg-gray-800/80 p-3 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 flex flex-col overflow-hidden relative`}
        style={{ height: isExpanded ? 64 : logHeight }}
      >
        {/* Resize handle — a thin bar at the top edge that the user can drag
            to change the panel height. Shows a visible grip indicator on hover
            and changes cursor to indicate resizability. */}
        {!isExpanded && (
          <div
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize group z-20 flex items-center justify-center"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          >
            {/* Visual grip indicator — two thin lines that become visible on hover */}
            <div className="w-8 h-0.5 bg-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        <div className="flex justify-between items-center mb-2 sticky top-0 bg-gray-800/90 py-1 z-10 border-b border-gray-700/50">
            <h3 className="text-center text-sm font-bold text-amber-300">Combat Log</h3>
            {!isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
                    title="Pop out into resizable window"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                </button>
            )}
        </div>
        {!isExpanded ? (
            <div className="flex-1 overflow-y-auto scrollable-content">
                {logContent}
            </div>
        ) : (
            <div className="text-gray-400 text-xs italic text-center mt-1">Log is popped out.</div>
        )}
      </div>

      {isExpanded && (
        <WindowFrame
            title="Combat Log"
            onClose={() => setIsExpanded(false)}
            storageKey="combat-log-window"
            initialMaximized={false}
        >
            <div className="p-4 h-full overflow-y-auto bg-gray-900 scrollable-content">
                {logContent}
            </div>
        </WindowFrame>
      )}
    </>


  );
};

export default CombatLog;
