// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * RE-EXPORT BRIDGE / MIDDLEMAN: Forwards exports to another file.
 *
 * Last Sync: 05/04/2026, 00:55:31
 * Dependents: components/Logbook/DiscoveryLogPane.tsx, components/QuestLog/questUtils.ts, components/Submap/useDayNightOverlay.ts, components/Submap/useQuickTravel.ts, components/Town/PassTimeModal.tsx, components/WorldPane.tsx, components/ui/TimeWidget.tsx, hooks/actions/actionHandlers.ts, hooks/actions/handleMerchantInteraction.ts, hooks/actions/handleMovement.ts, hooks/actions/handleResourceActions.ts, hooks/actions/handleWorldEvents.ts, services/dialogueService.ts, services/saveLoadService.ts, state/appState.ts, state/initialState.ts, state/reducers/economyReducer.ts, state/reducers/worldReducer.ts, systems/environment/WeatherSystem.ts, systems/history/HistoryService.ts, systems/intrigue/TavernGossipSystem.ts, systems/planar/FeywildMechanics.ts, systems/planar/PortalSystem.ts, systems/quests/QuestManager.ts, systems/rituals/RitualManager.ts, systems/time/CalendarSystem.ts, systems/time/SeasonalSystem.ts, systems/world/FactionManager.ts, systems/world/NobleIntrigueManager.ts, systems/world/WorldEventManager.ts, utils/index.ts
 * Imports: 11 files
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
export * from './spellTimeUtils';
export * from './timeUtils';
export * from './logger';
export * from './storageUtils';
export * from './securityUtils';
export * from './permissions';
export * from './hashUtils';
export * from './i18n';
export * from './testUtils';
