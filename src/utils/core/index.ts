// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * CRITICAL CORE SYSTEM: Changes here ripple across the entire city.
 *
 * Last Sync: 27/02/2026, 09:31:55
 * Dependents: CalendarSystem.ts, DiscoveryLogPane.tsx, FactionManager.ts, FeywildMechanics.ts, HistoryService.ts, NobleIntrigueManager.ts, PassTimeModal.tsx, PortalSystem.ts, QuestManager.ts, RitualManager.ts, SeasonalSystem.ts, TavernGossipSystem.ts, TimeWidget.tsx, WeatherSystem.ts, WorldEventManager.ts, WorldPane.tsx, actionHandlers.ts, appState.ts, dialogueService.ts, economyReducer.ts, handleMerchantInteraction.ts, handleMovement.ts, handleResourceActions.ts, handleWorldEvents.ts, initialState.ts, questUtils.ts, saveLoadService.ts, useDayNightOverlay.ts, useQuickTravel.ts, utils/index.ts, worldReducer.ts
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file src/utils/core/index.ts
 * Core utilities - foundational functions used across the codebase.
 */

export * from './factories';
export * from './idGenerator';
export * from './timeUtils';
export * from './logger';
export * from './storageUtils';
export * from './securityUtils';
export * from './permissions';
export * from './hashUtils';
export * from './i18n';
export * from './testUtils';
