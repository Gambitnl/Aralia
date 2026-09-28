// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/09/2026, 08:38:06
 * Dependents: components/BattleMap/CombatLog.tsx, components/Combat/index.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/components/Combat/CombatLog.tsx
 *
 * This component renders the combat log panel during battle.
 *
 * Players and spectators use this log to see what just happened in combat: attacks, damage,
 * healing, conditions, spells, and turn transitions. It supports channel tabs (All, Damage,
 * Healing, Conditions, Spells, System) to easily focus on specific combat events, and renders
 * structured resistance/vulnerability/immunity tags as colorful visual badges.
 *
 * Features:
 *   1. Channel Filtering: Switch between 'All', 'Damage', 'Healing', 'Conditions', 'Spells', 'System'.
 *   2. Rich Defense Badges: Automatically parses and renders tags like [Resisted: Fire (-50%)] and [Immune: Poison].
 *   3. Dual-Mode Display: Renders either rich CombatMessage objects or simple CombatLogEntry objects.
 *   4. Inline Resize & Popout: Drag top edge to resize or pop out into a floating window.
 *
 * Called by: CombatView.tsx and BattleMap panels.
 * Depends on: src/services/combatLogService.ts, src/types/combat.ts, src/types/combatMessages.ts
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { WindowFrame } from '../ui/WindowFrame';
import type { CombatLogEntry } from '../../types/combat';
import {
  type CombatMessage,
  type DamageMessageData,
  MessagePriority,
} from '../../types/combatMessages';
import { getMessageColor } from '../../utils/combat/messageFactory';
import {
  type CombatLogChannel,
  COMBAT_LOG_CHANNELS,
  filterLogEntriesByChannel,
  filterMessagesByChannel,
  tokenizeMessageWithTags,
  type ParsedMessageToken,
} from '../../services/combatLogService';

// ============================================================================
// Props and Styles
// ============================================================================
// Props interface and visual styling configurations for priorities, channels, and badges.
// ============================================================================

export interface CombatLogProps {
  /** Simple combat log entries from the combat hooks (fallback and legacy stream). */
  logEntries: CombatLogEntry[];
  /** Rich message stream with priorities, channels, and structured payloads. */
  richMessages?: CombatMessage[];
  /** When true and richMessages is non-empty, renders in rich mode. */
  useRichDisplay?: boolean;
  /** Optional initial channel filter tab (defaults to 'all'). */
  defaultChannel?: CombatLogChannel;
  /** Optional callback fired when the active channel tab changes. */
  onChannelChange?: (channel: CombatLogChannel) => void;
}

/**
 * Maps message priority levels to Tailwind left border classes for visual emphasis.
 */
const priorityBorder: Record<string, string> = {
  [MessagePriority.CRITICAL]: 'border-l-2 border-amber-400',
  [MessagePriority.HIGH]: 'border-l-2 border-red-400',
  [MessagePriority.MEDIUM]: 'border-l-2 border-blue-400',
  [MessagePriority.LOW]: 'border-l-0',
};

/**
 * Maps legacy CombatLogEntry types to Tailwind text color classes.
 */
const getLegacyEntryStyle = (type: CombatLogEntry['type']) => {
  switch (type) {
    case 'damage': return 'text-red-400';
    case 'heal': return 'text-green-400';
    case 'status': return 'text-purple-400';
    case 'turn_start': return 'text-amber-300 font-semibold';
    default: return 'text-gray-300';
  }
};

/**
 * Returns the CSS styling for structured pill tags (resistance, vulnerability, immunity, crit, save).
 */
const getTagBadgeStyle = (kind: string): string => {
  switch (kind) {
    case 'resisted':
      return 'bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 shadow-sm';
    case 'vulnerable':
      return 'bg-purple-950/80 border border-purple-500/60 text-purple-300 shadow-sm';
    case 'immune':
      return 'bg-amber-950/80 border border-amber-500/60 text-amber-300 shadow-sm';
    case 'crit':
      return 'bg-red-950/80 border border-red-500/60 text-red-300 shadow-sm';
    case 'save':
      return 'bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 shadow-sm';
    default:
      return 'bg-slate-800 border border-slate-600 text-slate-300 shadow-sm';
  }
};

// ============================================================================
// Structured Defense Badges (CMB-GAP-002)
// ============================================================================
// Rich mode previously rendered only `msg.description`, so the resistance /
// vulnerability / immunity flags the adapter puts on `msg.data` were carried
// all the way to the UI and then dropped. These helpers surface those flags as
// icon badges. They are additive: the inline `[Resisted: Fire (-50%)]` text
// pills still render for messages whose text carries tags, and a structured
// badge is suppressed when the text already says the same thing so a player
// never sees the same fact twice on one line.
// ============================================================================

/** The three defense outcomes a damage payload can report. */
type DefenseBadgeKind = 'resisted' | 'vulnerable' | 'immune';

/** One badge to render: its kind, its visible label, and its accessible title. */
interface StructuredDefenseBadge {
  kind: DefenseBadgeKind;
  label: string;
  title: string;
}

/**
 * Narrowing guard for damage payloads. CombatMessageData is a union and only
 * the damage member carries defense flags, so we probe for the discriminating
 * `damageType` field rather than trusting the message type alone (killing
 * blows, crits, and environmental damage all share the damage payload).
 */
const isDamagePayload = (data: unknown): data is DamageMessageData =>
  typeof data === 'object' && data !== null && 'damageType' in data;

/**
 * Reads the structured defense flags off a rich message and turns them into
 * badge descriptors. Immunity, resistance, and vulnerability are reported
 * independently because the XGtE cancel-out rule leaves a target both resistant
 * and vulnerable, and players should see both halves of that interaction.
 *
 * `description` is used only to suppress duplicates: emitters that already bake
 * `[Resisted: Fire (-50%)]` into the message text get their inline pill instead.
 */
const getStructuredDefenseBadges = (
  data: unknown,
  description: string
): StructuredDefenseBadge[] => {
  if (!isDamagePayload(data)) return [];

  const badges: StructuredDefenseBadge[] = [];
  const text = description.toLowerCase();

  if ((data.isImmune || data.immunityApplied) && !text.includes('[immune:')) {
    const type = data.immuneDamageType ?? data.damageType;
    badges.push({
      kind: 'immune',
      label: 'Immune',
      title: type ? `Immune: ${type}` : 'Immune',
    });
  }
  if ((data.isResisted || data.resistanceApplied) && !text.includes('[resisted:')) {
    const type = data.resistedDamageType ?? data.damageType;
    badges.push({
      kind: 'resisted',
      label: 'Resisted',
      title: type ? `Resisted: ${type} (-50%)` : 'Resisted',
    });
  }
  if ((data.isVulnerable || data.vulnerabilityApplied) && !text.includes('[vulnerable:')) {
    const type = data.vulnerableDamageType ?? data.damageType;
    badges.push({
      kind: 'vulnerable',
      label: 'Vulnerable',
      title: type ? `Vulnerable: ${type} (+100%)` : 'Vulnerable',
    });
  }

  return badges;
};

/**
 * Inline icons for the structured badges. Resisted and immune use an intact
 * shield (immune is the filled variant, reading as "nothing gets through");
 * vulnerable uses a shield split by a crack.
 */
const DefenseBadgeIcon: React.FC<{ kind: DefenseBadgeKind }> = ({ kind }) => {
  const shared = { className: 'h-2.5 w-2.5 shrink-0', viewBox: '0 0 24 24', 'aria-hidden': true } as const;

  if (kind === 'immune') {
    return (
      <svg {...shared} fill="currentColor">
        <path d="M12 2l7 3v6c0 5-3 8.5-7 11-4-2.5-7-6-7-11V5l7-3z" />
      </svg>
    );
  }
  if (kind === 'vulnerable') {
    // Shield outline plus a zig-zag crack running through it.
    return (
      <svg {...shared} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l7 3v6c0 5-3 8.5-7 11-4-2.5-7-6-7-11V5l7-3z" />
        <path d="M13 5l-3 6h4l-3 6" />
      </svg>
    );
  }
  return (
    <svg {...shared} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l7 3v6c0 5-3 8.5-7 11-4-2.5-7-6-7-11V5l7-3z" />
    </svg>
  );
};

// ============================================================================
// Layout and Persistence Constants
// ============================================================================
// Bounds and storage keys for the panel's resizable height.
// ============================================================================

const MIN_LOG_HEIGHT = 120;
const MAX_LOG_HEIGHT = 600;
const DEFAULT_LOG_HEIGHT = 220;
const STORAGE_KEY = 'aralia-combat-log-height';

/**
 * Loads the saved height from local storage, safely clamped between min and max bounds.
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
    // Local storage unavailable (SSR or restricted environment)
  }
  return DEFAULT_LOG_HEIGHT;
};

// ============================================================================
// Main CombatLog Component
// ============================================================================
// Renders the combat log with channel filtering tabs, tag token rendering,
// and resizable / expandable window containers.
// ============================================================================

export const CombatLog: React.FC<CombatLogProps> = ({
  logEntries,
  richMessages,
  useRichDisplay,
  defaultChannel = 'all',
  onChannelChange,
}) => {
  // Reference to the bottom anchor for auto-scrolling to newest entries
  const logEndRef = useRef<HTMLDivElement>(null);

  // Active channel tab state
  const [activeChannel, setActiveChannel] = useState<CombatLogChannel>(defaultChannel);

  // Expanded pop-out window state
  const [isExpanded, setIsExpanded] = useState(false);

  // Height state for the embedded panel
  const [logHeight, setLogHeight] = useState(loadSavedHeight);
  const isResizingRef = useRef(false);
  const resizeStartYRef = useRef(0);
  const resizeStartHeightRef = useRef(0);

  // Determine whether rich mode is active
  const displayRich = useRichDisplay && richMessages && richMessages.length > 0;

  // Filter entries according to the selected channel tab
  const visibleLogEntries = useMemo(() => {
    return filterLogEntriesByChannel(logEntries, activeChannel);
  }, [logEntries, activeChannel]);

  const visibleRichMessages = useMemo(() => {
    return richMessages ? filterMessagesByChannel(richMessages, activeChannel) : [];
  }, [richMessages, activeChannel]);

  /**
   * Switches the active channel and notifies parent callbacks if provided.
   */
  const handleSelectChannel = useCallback((channel: CombatLogChannel) => {
    setActiveChannel(channel);
    onChannelChange?.(channel);
  }, [onChannelChange]);

  /**
   * Initiates inline vertical drag resizing on mousedown.
   */
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartYRef.current = e.clientY;
    resizeStartHeightRef.current = logHeight;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const deltaY = resizeStartYRef.current - moveEvent.clientY;
      const newHeight = Math.max(
        MIN_LOG_HEIGHT,
        Math.min(MAX_LOG_HEIGHT, resizeStartHeightRef.current + deltaY)
      );
      setLogHeight(newHeight);
    };

    const handleResizeEnd = () => {
      isResizingRef.current = false;
      try {
        localStorage.setItem(STORAGE_KEY, String(logHeight));
      } catch {
        // Non-critical persistence failure
      }
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [logHeight]);

  // Persist height when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(logHeight));
    } catch {
      // Ignore storage errors
    }
  }, [logHeight]);

  // Auto-scroll to the newest event when messages update or channel tab changes
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleLogEntries, visibleRichMessages, isExpanded, activeChannel]);

  /**
   * Helper function to render a message text string with rich tag pills.
   */
  const renderMessageContent = (text: string) => {
    const tokens: ParsedMessageToken[] = tokenizeMessageWithTags(text);
    // If there are no tags, render raw text directly
    if (tokens.length === 1 && !tokens[0].isTag) {
      return text;
    }

    return (
      <span>
        {tokens.map((token, idx) => {
          if (!token.isTag || !token.tagInfo) {
            return <span key={idx}>{token.text}</span>;
          }

          return (
            <span
              key={idx}
              className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-semibold tracking-wide ${getTagBadgeStyle(token.tagInfo.kind)}`}
              title={token.text}
            >
              {token.text}
            </span>
          );
        })}
      </span>
    );
  };

  /**
   * Renders the channel selection tab bar.
   */
  const channelTabsBar = (
    <div
      className="flex items-center gap-1 overflow-x-auto py-1 border-b border-amber-900/30 text-xs no-scrollbar"
      role="tablist"
      aria-label="Combat log channels"
    >
      {COMBAT_LOG_CHANNELS.map(tab => {
        const isActive = activeChannel === tab.id || (tab.id === 'narrative/system' && activeChannel === 'system');
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelectChannel(tab.id)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-200'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-800/60'
            }`}
            title={tab.description}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  /**
   * Renders the scrollable log contents.
   */
  const logContent = (
    <div className="space-y-1 text-sm pb-2">
      {displayRich ? (
        // --- RICH DISPLAY MODE ---
        visibleRichMessages.length > 0 ? (
          visibleRichMessages.map(msg => {
            // CMB-GAP-002: pull the defense flags off the structured payload so
            // resisted / vulnerable / immune damage is visible even when the
            // emitter did not bake tags into the message text.
            const defenseBadges = getStructuredDefenseBadges(msg.data, msg.description);
            return (
              <p
                key={msg.id}
                className={`pl-2 ${priorityBorder[msg.priority] || ''} ${getMessageColor(msg.type)} text-xs leading-relaxed`}
                title={msg.description}
              >
                {renderMessageContent(msg.description)}
                {defenseBadges.map(badge => (
                  <span
                    key={badge.kind}
                    data-testid={`defense-badge-${badge.kind}`}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-semibold tracking-wide ${getTagBadgeStyle(badge.kind)}`}
                    title={badge.title}
                  >
                    <DefenseBadgeIcon kind={badge.kind} />
                    {badge.label}
                  </span>
                ))}
              </p>
            );
          })
        ) : (
          <div className="text-gray-400 text-xs italic py-3 text-center">
            No {activeChannel === 'all' ? 'combat' : activeChannel} events recorded yet.
          </div>
        )
      ) : (
        // --- LEGACY DISPLAY MODE ---
        visibleLogEntries.length > 0 ? (
          visibleLogEntries.map(entry => {
            // Render round dividers prominently
            const roundMatch = /^Round (\d+) begins!/.exec(entry.message);
            if (roundMatch) {
              return (
                <div key={entry.id} className="my-1.5 flex items-center gap-2" role="separator" aria-label={`Round ${roundMatch[1]}`}>
                  <span className="h-px flex-1 bg-amber-700/40" />
                  <span className="rounded-full border border-amber-700/50 bg-slate-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-amber-300">
                    Round {roundMatch[1]}
                  </span>
                  <span className="h-px flex-1 bg-amber-700/40" />
                </div>
              );
            }

            return (
              <p key={entry.id} className={`${getLegacyEntryStyle(entry.type)} text-xs leading-relaxed`}>
                {renderMessageContent(entry.message)}
              </p>
            );
          })
        ) : (
          <div className="text-gray-400 text-xs italic py-3 text-center">
            No {activeChannel === 'all' ? 'combat' : activeChannel} events recorded yet.
          </div>
        )
      )}
      <div ref={logEndRef} />
    </div>
  );

  return (
    <>
      <div
        className="rounded-xl border border-amber-900/40 bg-slate-900/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_30px_rgba(0,0,0,0.45)] p-3 backdrop-blur-sm flex flex-col overflow-hidden relative"
        style={{ height: isExpanded ? 64 : logHeight }}
      >
        {/* Resize handle at top edge */}
        {!isExpanded && (
          <div
            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize group z-20 flex items-center justify-center"
            onMouseDown={handleResizeStart}
            title="Drag to resize"
          >
            <div className="w-8 h-0.5 bg-gray-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        )}

        {/* Header toolbar */}
        <div className="flex justify-between items-center mb-1 sticky top-0 bg-slate-900/90 py-1 z-10 border-b border-amber-900/40">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-400/90">Combat Log</h3>
          {!isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="flex h-11 w-11 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
              title="Pop out into resizable window"
              aria-label="Pop out Combat Log into resizable window"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
        </div>

        {/* Channel filtering tabs */}
        {!isExpanded && channelTabsBar}

        {/* Scrollable message panel */}
        {!isExpanded ? (
          <div className="flex-1 overflow-y-auto scrollable-content pt-2">
            {logContent}
          </div>
        ) : (
          <div className="text-gray-400 text-xs italic text-center mt-1">Log is popped out.</div>
        )}
      </div>

      {/* Pop-out floating modal window */}
      {isExpanded && (
        <WindowFrame
          title="Combat Log"
          onClose={() => setIsExpanded(false)}
          storageKey="combat-log-window"
          initialMaximized={false}
        >
          <div className="p-4 h-full flex flex-col bg-gray-900">
            <div className="mb-2">
              {channelTabsBar}
            </div>
            <div className="flex-1 overflow-y-auto scrollable-content pt-2">
              {logContent}
            </div>
          </div>
        </WindowFrame>
      )}
    </>
  );
};

export default CombatLog;
