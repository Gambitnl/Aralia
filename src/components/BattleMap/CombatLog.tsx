/**
 * @file CombatLog.tsx
 * @modified 2026-02-10
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
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */
import React, { useRef, useEffect } from 'react';
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

/**
 * CombatLog — The combat log display component.
 *
 * Renders inside a fixed-height (h-48) scrollable container in the right sidebar of CombatView.
 * Features:
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

  // Auto-scroll effect: fires whenever either message source changes.
  // Both logEntries and richMessages are in the dependency array so scrolling works
  // regardless of which display mode is active.
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logEntries, richMessages]);

  return (
    // Container: semi-transparent dark background with blur, rounded corners,
    // subtle border, fixed height (h-48 = 12rem), scrollable overflow.
    // The 'scrollable-content' class is a project convention for custom scrollbar styling.
    <div className="bg-gray-800/80 p-3 rounded-lg backdrop-blur-sm shadow-lg border border-gray-700 h-48 overflow-y-auto scrollable-content">
      {/* Sticky header that stays pinned at the top of the scroll container.
          bg-gray-800/90 ensures text beneath doesn't bleed through. */}
      <h3 className="text-center text-sm font-bold text-amber-300 mb-2 sticky top-0 bg-gray-800/90 py-1">Combat Log</h3>

      {/* Message list: space-y-1 adds 0.25rem vertical gap between entries. */}
      <div className="space-y-1 text-sm">
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
    </div>
  );
};

export default CombatLog;
