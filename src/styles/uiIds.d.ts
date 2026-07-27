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
export declare const UI_ID: {
    /** Root game layout wrapper */
    readonly GAME_LAYOUT: "game-layout";
    /** Left column (compass + actions) */
    readonly LEFT_COLUMN: "left-column";
    /** Right column (log + minimap) */
    readonly RIGHT_COLUMN: "right-column";
    /** Compass and navigation controls */
    readonly COMPASS_PANE: "compass-pane";
    /** Action buttons panel */
    readonly ACTION_PANE: "action-pane";
    /** Hamburger / system menu */
    readonly SYSTEM_MENU: "system-menu";
    /** Narrative message log */
    readonly WORLD_PANE: "world-pane";
    /** Tactical minimap canvas */
    readonly MINIMAP: "minimap";
    /** Compact world atlas strip with 3D player marker (W3DUI-23) */
    readonly WORLD_ATLAS_STRIP: "world-atlas-strip";
    /** Main menu screen */
    readonly MAIN_MENU: "main-menu";
    /** Full-screen combat view */
    readonly COMBAT_VIEW: "combat-view";
    /** Tactical battle grid */
    readonly BATTLE_MAP: "battle-map";
    /** Spell/effect overlay on the battle map */
    readonly BATTLE_MAP_OVERLAY: "battle-map-overlay";
    /** Developer tools menu */
    readonly DEV_MENU: "dev-menu";
    /** NPC journal / dossier */
    readonly DOSSIER_PANE: "dossier-pane";
    /** Exploration discovery journal */
    readonly DISCOVERY_LOG: "discovery-log";
    /** Quest tracker */
    readonly QUEST_LOG: "quest-log";
    /** Trading interface */
    readonly MERCHANT_MODAL: "merchant-modal";
    /** Ollama server dependency warning */
    readonly OLLAMA_DEPENDENCY_MODAL: "ollama-dependency-modal";
    /** AI game guide assistant */
    readonly GAME_GUIDE_MODAL: "game-guide-modal";
    /** Level-up / missing choice picker */
    readonly MISSING_CHOICE_MODAL: "missing-choice-modal";
    /** NPC conversation system */
    readonly DIALOGUE_INTERFACE: "dialogue-interface";
    /** 3D exploration view */
    readonly THREE_D_MODAL: "three-d-modal";
    /** Thieves guild (non-member state) */
    readonly THIEVES_GUILD: "thieves-guild";
    /** Load game slot picker */
    readonly LOAD_GAME_MODAL: "load-game-modal";
    /** Save game slot picker */
    readonly SAVE_SLOT_SELECTOR: "save-slot-selector";
    /** Generic yes/no confirmation */
    readonly CONFIRMATION_MODAL: "confirmation-modal";
    /** Toast notification container */
    readonly NOTIFICATION_SYSTEM: "notification-system";
    /** Full-screen loading spinner */
    readonly LOADING_SPINNER: "loading-spinner";
    /** 3D dice roll overlay */
    readonly DICE_OVERLAY: "dice-overlay";
    /** Companion speech bubble */
    readonly COMPANION_REACTION: "companion-reaction";
    /** Banter panel (docked side panel) */
    readonly BANTER_PANEL_EXPANDED: "banter-panel-expanded";
    /** Banter panel (collapsed tab) */
    readonly BANTER_PANEL_COLLAPSED: "banter-panel-collapsed";
};
export declare const WINDOW_KEYS: {
    readonly WORLD_MAP: "world-map-window";
    readonly SUBMAP: "submap-window";
    readonly CHARACTER_SHEET: "character-sheet";
    readonly PARTY_OVERLAY: "party-overlay-window";
    readonly GLOSSARY: "glossary-modal-size";
    readonly GEMINI_LOG: "gemini-log-window";
    readonly UNIFIED_DEBUG_LOG: "unified-log-viewer";
    readonly NPC_TEST_PLAN: "npc-test-window";
    readonly ENCOUNTER_MODAL: "encounter-gen-window";
    readonly TEMPLE_MODAL: "temple-window";
    readonly TRADE_ROUTE_DASHBOARD: "trade-route-dashboard";
    readonly NOBLE_HOUSE_LIST: "noble-house-list";
    readonly PARTY_EDITOR: "party-editor-window";
    readonly SHIP_PANE: "ship-pane-window";
    readonly LOCKPICKING_MODAL: "lockpicking-window";
    readonly PUZZLE_RUNTIME_MODAL: "puzzle-runtime-window";
    readonly DICE_ROLLER: "dice-roller-window";
    readonly THIEVES_GUILD_SAFEHOUSE: "thieves-guild-window";
    readonly CHARACTER_CREATOR: "character-creator-window";
    readonly ALCHEMY_BENCH: "alchemy-bench-panel";
    readonly COMBAT_INSPECTOR: "combat-inspector-window";
    readonly ABILITY_PALETTE: "ability-palette-window";
    readonly PARTY_DISPLAY: "party-display-window";
    readonly INITIATIVE_TRACKER: "initiative-tracker-window";
    readonly BATTLE_MAP_WINDOW: "battle-map-window";
    readonly DIALOGUE: "dialogue-window";
    readonly MERCHANT: "merchant-window";
    readonly QUEST_LOG: "quest-log-window";
    readonly LEDGER_BOOK: "ledger-book-window";
    readonly INVESTMENT_BOARD: "investment-board-window";
    readonly COURIER_POUCH: "courier-pouch-window";
    readonly COMMERCE_DESK: "commerce-desk-window";
    readonly REFINING_ENCHANTING: "refining-enchanting-window";
    readonly SPELLBOOK_OVERLAY: "spellbook-window";
    readonly LEVEL_UP: "level-up-window";
    readonly NOTICE_BOARD: "notice-board-window";
    readonly BROADSHEET: "broadsheet-window";
    readonly ORGANIZATION_DASHBOARD: "organization-window";
    readonly DIVINE_FAVOR: "divine-favor-window";
    readonly FENCE: "fence-window";
    readonly DOSSIER: "dossier-window";
    readonly RACE_DETAIL: "race-detail-window";
    readonly THREE_D_VIEW: "three-d-view-window";
    readonly LOAD_GAME: "load-game-window";
    readonly SAVE_SLOT: "save-slot-window";
    readonly AI_SPELL_INPUT: "ai-spell-input-window";
};
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
export declare function windowId(storageKey: WindowKey): string;
