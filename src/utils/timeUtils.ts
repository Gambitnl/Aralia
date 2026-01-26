// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file is part of a complex dependency web.
 * 
 * Last Sync: 26/01/2026, 01:37:21
 * Dependents: CalendarSystem.ts, DiscoveryLogPane.tsx, FactionManager.ts, FeywildMechanics.ts, HistoryService.ts, NobleIntrigueManager.ts, PassTimeModal.tsx, PortalSystem.ts, QuestManager.ts, RitualManager.ts, SeasonalSystem.ts, TavernGossipSystem.ts, TimeWidget.tsx, WeatherSystem.ts, WorldEventManager.ts, WorldPane.tsx, actionHandlers.ts, appState.ts, dialogueService.ts, factories.ts, handleMovement.ts, handleResourceActions.ts, handleWorldEvents.ts, initialState.ts, questUtils.ts, saveLoadService.ts, useDayNightOverlay.ts, useQuickTravel.ts, worldReducer.ts
 * Imports: 1 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @deprecated Import from '@/utils/core' or '@/utils/core/timeUtils' instead.
 * This file will be removed in a future version.
 *
 * Example migration:
 *   Old: import { GAME_EPOCH } from '@/utils/timeUtils'
 *   New: import { GAME_EPOCH } from '@/utils/core'
 */
export * from './core/timeUtils';
