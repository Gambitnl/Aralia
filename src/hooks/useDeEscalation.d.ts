/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 03:21:08
 * Dependents: components/ConversationPanel/ConversationPanel.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file src/hooks/useDeEscalation.ts
 * Orchestrates a hostile opening's resolution: intent → (roll) → route to
 * peaceful resolution or combat. `runDeEscalationFlow` is the pure, injectable
 * core; the hook binds it to useDice + the real encounter launcher.
 */
import type React from 'react';
import type { AppAction } from '../state/actionTypes';
import type { PlayerCharacter } from '../types';
import type { SituationThreat } from '../systems/gameEntry/types';
import type { IntentResolution } from '../systems/gameEntry/resolveDeEscalationIntent';
import { handleStartBattleMapEncounter } from './actions/handleEncounter';
import { prepareActiveGroundOpeningEncounter } from '../systems/combat/fightInPlace/activeGroundCombatSession';
/** A bonus die owed to the check by an active boost (Guidance's 1d4 etc.). */
export interface CheckDiceRequest {
    source: string;
    notation: string;
}
/** Everything the player physically rolled for one check. */
export interface CheckDiceResult {
    d20: number;
    bonuses: Array<{
        source: string;
        value: number;
    }>;
}
export interface DeEscalationFlowArgs {
    intent: IntentResolution;
    character: PlayerCharacter;
    threat: SituationThreat;
    dispatch: React.Dispatch<AppAction>;
    /**
     * Rolls the whole check: the d20 (best of two on advantage) plus any active
     * bonus dice, as ONE dice-tray sequence. Injected so the pure core stays
     * deterministic under test.
     */
    rollCheckDice: (advantage: boolean, bonusDice: CheckDiceRequest[]) => Promise<CheckDiceResult>;
    /** Injectable for tests; defaults to the real encounter launcher. */
    startEncounter?: typeof handleStartBattleMapEncounter;
    /** Injectable live-GroundWorld projector for deterministic source-path tests. */
    prepareOpeningEncounter?: typeof prepareActiveGroundOpeningEncounter;
}
export declare function runDeEscalationFlow(args: DeEscalationFlowArgs): Promise<void>;
export declare function useDeEscalation(): {
    runDeEscalationFlow: typeof runDeEscalationFlow;
    rollCheckDice: (advantage: boolean, bonusDice: CheckDiceRequest[]) => Promise<CheckDiceResult>;
};
