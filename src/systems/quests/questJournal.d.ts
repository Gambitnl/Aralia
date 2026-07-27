/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 09/06/2026, 02:06:39
 * Dependents: state/reducers/questReducer.ts, systems/quests/QuestManager.ts
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * This file turns quest transitions into journal events.
 *
 * Quest reducers and deadline checks both need the same queueing behavior, but
 * the journal entry merge flow still lives elsewhere. Keeping the bridge here
 * lets the quest system write consistent pending events without duplicating the
 * state-plumbing in multiple files.
 *
 * Called by: questReducer.ts, QuestManager.ts
 * Depends on: the shared journal state shape and the quest ID generator
 */
import { GameState, Quest } from '../../types';
import { JournalEvent } from '../../types/journal';
type QuestJournalEventType = Extract<JournalEvent['type'], 'quest_accepted' | 'quest_completed' | 'quest_failed'>;
interface QuestJournalEventInput {
    type: QuestJournalEventType;
    title: string;
    description: string;
    quest: Quest;
}
export declare const createQuestJournalEvent: (state: GameState, input: QuestJournalEventInput) => JournalEvent;
export declare const appendQuestJournalEvents: (state: GameState, events: JournalEvent[]) => Partial<GameState>;
export declare const appendQuestJournalEvent: (state: GameState, event: JournalEvent) => Partial<GameState>;
export {};
