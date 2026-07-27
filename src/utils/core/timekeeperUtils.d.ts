/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:44:59
 * Dependents: App.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file decides when Aralia's passive exploration clock is allowed to tick.
 *
 * It does not own or mutate world time. App.tsx asks this helper whether the
 * one-second exploration timer should run, then the app still advances time by
 * dispatching ADVANCE_TIME into the normal worldReducer pipeline.
 *
 * Called by: App.tsx passive clock effect
 * Depends on: GamePhase so combat, menus, and exploration can be distinguished
 */
import { GamePhase } from '../../types';
export interface PassiveGameClockState {
    phase: GamePhase;
    isLoading: boolean;
    isImageLoading: boolean;
    isCharacterSheetOpen: boolean;
    isMapVisible: boolean;
    isDevMenuVisible: boolean;
    isGeminiLogViewerVisible: boolean;
    isDiscoveryLogVisible: boolean;
    isGlossaryVisible: boolean;
    isEncounterModalVisible: boolean;
    isNpcTestModalVisible: boolean;
    isLogbookVisible: boolean;
    isGameGuideVisible: boolean;
    isInvestmentBoardVisible: boolean;
    isMerchantModalOpen: boolean;
    isMissingChoiceModalOpen: boolean;
}
export declare const shouldPassiveGameClockRun: (state: PassiveGameClockState) => boolean;
