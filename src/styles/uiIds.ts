// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 09/08/2026, 17:31:26
 * Dependents: components/ActionPane/SystemMenu.tsx, components/ActionPane/index.tsx, components/BattleMap/AISpellInputModal.tsx, components/BattleMap/AbilityPalette.tsx, components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMapOverlay.tsx, components/BattleMap/CombatCharacterInspector.tsx, components/BattleMap/InitiativeTracker.tsx, components/BattleMap/PartyDisplay.tsx, components/CharacterCreator/CharacterCreator.tsx, components/CharacterCreator/Race/RaceDetailModal.tsx, components/CharacterSheet/CharacterSheetModal.tsx, components/CharacterSheet/LevelUpModal.tsx, components/CharacterSheet/Spellbook/SpellbookOverlay.tsx, components/Combat/CombatView.tsx, components/Combat/EncounterModal.tsx, components/Crafting/AlchemyBenchPanel.tsx, components/Crafting/RefiningEnchantingPanel.tsx, components/Crime/ThievesGuild/FenceInterface.tsx, components/Crime/ThievesGuild/ThievesGuildInterface.tsx, components/Dialogue/DialogueInterface.tsx, components/Economy/CommerceDesk.tsx, components/Economy/CourierPouch.tsx, components/Economy/InvestmentBoard.tsx, components/Economy/LedgerBook.tsx, components/Glossary/Glossary.tsx, components/Logbook/DiscoveryLogPane.tsx, components/Logbook/DossierPane.tsx, components/MapPane.tsx, components/Naval/ShipPane.tsx, components/Organization/OrganizationDashboard.tsx, components/Party/PartyEditorModal.tsx, components/Party/PartyOverlay.tsx, components/QuestLog/QuestLog.tsx, components/Religion/DivineFavorPanel.tsx, components/Religion/TempleModal.tsx, components/SaveLoad/LoadGameModal.tsx, components/SaveLoad/SaveSlotSelector.tsx, components/ThreeDModal/ThreeDModal.tsx, components/Town/Broadsheet.tsx, components/Town/NoticeBoard.tsx, components/Trade/MerchantModal.tsx, components/Trade/TradeRouteDashboard.tsx, components/WorldPane.tsx, components/debug/AgentSimDevOverlay.tsx, components/debug/DevMenu.tsx, components/debug/GeminiLogViewer.tsx, components/debug/NobleHouseList.tsx, components/debug/NpcInteractionTestModal.tsx, components/debug/TownHistoryDevOverlay.tsx, components/debug/UnifiedDebugLogViewer.tsx, components/dice/DiceOverlay.tsx, components/dice/DiceRollerModal.tsx, components/layout/GameLayout.tsx, components/layout/MainMenu.tsx, components/puzzles/LockpickingModal.tsx, components/puzzles/PuzzleRuntimeModal.tsx, components/ui/CollapsibleBanterPanel.tsx, components/ui/CompanionReaction.tsx, components/ui/ConfirmationModal.tsx, components/ui/GameGuideModal.tsx, components/ui/LoadingSpinner.tsx, components/ui/MissingChoiceModal.tsx, components/ui/NotificationSystem.tsx, components/ui/OllamaDependencyModal.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

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
  /** Compact world atlas strip with 3D player marker (W3DUI-23) */
  WORLD_ATLAS_STRIP: 'world-atlas-strip',

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
  PUZZLE_RUNTIME_MODAL: 'puzzle-runtime-window',
  DICE_ROLLER: 'dice-roller-window',
  THIEVES_GUILD_SAFEHOUSE: 'thieves-guild-window',
  CHARACTER_CREATOR: 'character-creator-window',
  ALCHEMY_BENCH: 'alchemy-bench-panel',
  COMBAT_INSPECTOR: 'combat-inspector-window',
  ABILITY_PALETTE: 'ability-palette-window',
  PARTY_DISPLAY: 'party-display-window',
  INITIATIVE_TRACKER: 'initiative-tracker-window',
  BATTLE_MAP_WINDOW: 'battle-map-window',
  DIALOGUE: 'dialogue-window',
  // Content panels migrated from bespoke overlays onto the shared WindowFrame.
  MERCHANT: 'merchant-window',
  QUEST_LOG: 'quest-log-window',
  LEDGER_BOOK: 'ledger-book-window',
  INVESTMENT_BOARD: 'investment-board-window',
  COURIER_POUCH: 'courier-pouch-window',
  COMMERCE_DESK: 'commerce-desk-window',
  REFINING_ENCHANTING: 'refining-enchanting-window',
  SPELLBOOK_OVERLAY: 'spellbook-window',
  LEVEL_UP: 'level-up-window',
  NOTICE_BOARD: 'notice-board-window',
  BROADSHEET: 'broadsheet-window',
  ORGANIZATION_DASHBOARD: 'organization-window',
  DIVINE_FAVOR: 'divine-favor-window',
  FENCE: 'fence-window',
  DOSSIER: 'dossier-window',
  RACE_DETAIL: 'race-detail-window',
  THREE_D_VIEW: 'three-d-view-window',
  LOAD_GAME: 'load-game-window',
  SAVE_SLOT: 'save-slot-window',
  AI_SPELL_INPUT: 'ai-spell-input-window',
  // World 3D developer inspectors use independent keys so each tool remembers
  // its own WindowFrame geometry instead of overwriting the other's layout.
  AGENT_SIM: 'agent-sim-window',
  TOWN_HISTORY: 'town-history-window',
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
