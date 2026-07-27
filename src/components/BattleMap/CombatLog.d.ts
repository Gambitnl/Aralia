/**
 * @file CombatLog.tsx
 * @modified 2026-07-05
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
 *     WindowFrame modal. The sidebar trigger keeps a full touch-sized hit target so
 *     the combat rail remains usable in narrow 2D layouts.
 *
 * IMPORTANT: Do not remove inline comments from this file unless the associated code is modified.
 * If code changes, update the comment with the new date and a description of the change.
 */
import React from 'react';
import { CombatLogEntry } from '../../types/combat';
import type { CombatMessage } from '../../types/combatMessages';
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
declare const CombatLog: React.FC<CombatLogProps>;
export default CombatLog;
