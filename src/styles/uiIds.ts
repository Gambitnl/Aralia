/**
 * Centralized UI Element ID Registry
 *
 * All `id` and `data-testid` attributes should reference these named constants
 * instead of inline magic strings. This makes refactoring, searching, and
 * test-targeting trivial.
 *
 * ## Naming Convention
 * - UPPER_SNAKE_CASE keys (matches Z_INDEX style)
 * - kebab-case values (matches HTML id convention)
 *
 * ## Usage
 * ```tsx
 * import { UI_ID } from '../styles/uiIds';
 *
 * <div id={UI_ID.GAME_LAYOUT} data-testid={UI_ID.GAME_LAYOUT}>
 * ```
 *
 * ## WindowFrame Components
 * WindowFrame auto-generates ids as `window-{storageKey}`.
 * Those storage keys are listed in WINDOW_KEYS for reference but
 * the actual ids are derived at runtime by WindowFrame.
 */

// =============================================================================
// MAIN LAYOUT
// =============================================================================

export const UI_ID = {
  // ── Layout Shell ──────────────────────────────────────────────────────
  /** Root game layout wrapper */
  GAME_LAYOUT: 'game-layout',
  /** Left column (compass + actions) */
  LEFT_COLUMN: 'left-column',
  /** Right column (log + minimap) */
  RIGHT_COLUMN: 'right-column',

  // ── Core Panes ────────────────────────────────────────────────────────
  /** Compass and navigation controls */
  COMPASS_PANE: 'compass-pane',
  /** Action buttons panel */
  ACTION_PANE: 'action-pane',
  /** Hamburger / system menu */
  SYSTEM_MENU: 'system-menu',
  /** Narrative message log */
  WORLD_PANE: 'world-pane',
  /** Tactical minimap canvas */
  MINIMAP: 'minimap',

  // ── Screens ───────────────────────────────────────────────────────────
  /** Main menu screen */
  MAIN_MENU: 'main-menu',
  /** Full-screen combat view */
  COMBAT_VIEW: 'combat-view',

  // ── Battle Map ────────────────────────────────────────────────────────
  /** Tactical battle grid */
  BATTLE_MAP: 'battle-map',
  /** Spell/effect overlay on the battle map */
  BATTLE_MAP_OVERLAY: 'battle-map-overlay',

  // ── Non-WindowFrame Modals ────────────────────────────────────────────
  /** Developer tools menu */
  DEV_MENU: 'dev-menu',
  /** NPC journal / dossier */
  DOSSIER_PANE: 'dossier-pane',
  /** Exploration discovery journal */
  DISCOVERY_LOG: 'discovery-log',
  /** Quest tracker */
  QUEST_LOG: 'quest-log',
  /** Trading interface */
  MERCHANT_MODAL: 'merchant-modal',
  /** Ollama server dependency warning */
  OLLAMA_DEPENDENCY_MODAL: 'ollama-dependency-modal',
  /** AI game guide assistant */
  GAME_GUIDE_MODAL: 'game-guide-modal',
  /** Level-up / missing choice picker */
  MISSING_CHOICE_MODAL: 'missing-choice-modal',
  /** NPC conversation system */
  DIALOGUE_INTERFACE: 'dialogue-interface',
  /** 3D exploration view */
  THREE_D_MODAL: 'three-d-modal',
  /** Thieves guild (non-member state) */
  THIEVES_GUILD: 'thieves-guild',
  /** Load game slot picker */
  LOAD_GAME_MODAL: 'load-game-modal',
  /** Save game slot picker */
  SAVE_SLOT_SELECTOR: 'save-slot-selector',
  /** Generic yes/no confirmation */
  CONFIRMATION_MODAL: 'confirmation-modal',

  // ── Overlays & Widgets ────────────────────────────────────────────────
  /** Toast notification container */
  NOTIFICATION_SYSTEM: 'notification-system',
  /** Full-screen loading spinner */
  LOADING_SPINNER: 'loading-spinner',
  /** 3D dice roll overlay */
  DICE_OVERLAY: 'dice-overlay',
  /** Companion speech bubble */
  COMPANION_REACTION: 'companion-reaction',
  /** Banter panel (docked side panel) */
  BANTER_PANEL_EXPANDED: 'banter-panel-expanded',
  /** Banter panel (collapsed tab) */
  BANTER_PANEL_COLLAPSED: 'banter-panel-collapsed',
} as const;

// =============================================================================
// WINDOW FRAME STORAGE KEYS
// =============================================================================
// WindowFrame generates ids as `window-${storageKey}`.
// Listed here for documentation / test helpers.

export const WINDOW_KEYS = {
  WORLD_MAP: 'world-map-window',
  SUBMAP: 'submap-window',
  CHARACTER_SHEET: 'character-sheet',
  PARTY_OVERLAY: 'party-overlay-window',
  GLOSSARY: 'glossary-modal-size',
  GEMINI_LOG: 'gemini-log-window',
  UNIFIED_DEBUG_LOG: 'unified-log-viewer',
  NPC_TEST_PLAN: 'npc-test-window',
  ENCOUNTER_MODAL: 'encounter-gen-window',
  TEMPLE_MODAL: 'temple-window',
  TRADE_ROUTE_DASHBOARD: 'trade-route-dashboard',
  NOBLE_HOUSE_LIST: 'noble-house-list',
  PARTY_EDITOR: 'party-editor-window',
  SHIP_PANE: 'ship-pane-window',
  LOCKPICKING_MODAL: 'lockpicking-window',
  DICE_ROLLER: 'dice-roller-window',
  THIEVES_GUILD_SAFEHOUSE: 'thieves-guild-window',
  CHARACTER_CREATOR: 'character-creator-window',
  ALCHEMY_BENCH: 'alchemy-bench-panel',
} as const;

// =============================================================================
// TYPES
// =============================================================================

/** Union of all direct element id values */
export type UiId = typeof UI_ID[keyof typeof UI_ID];

/** Union of all WindowFrame storage key values */
export type WindowKey = typeof WINDOW_KEYS[keyof typeof WINDOW_KEYS];

/**
 * Returns the runtime id that WindowFrame will produce for a given storage key.
 *
 * @example
 * ```ts
 * windowId(WINDOW_KEYS.GLOSSARY) // => 'window-glossary-modal-size'
 * ```
 */
export function windowId(storageKey: WindowKey): string {
  return `window-${storageKey}`;
}
