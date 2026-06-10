// @dependencies-start
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
// @dependencies-end

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
import { JournalEvent, createInitialJournalState } from '../../types/journal';
import { generateId } from '../../utils/core/idGenerator';

type QuestJournalEventType = Extract<JournalEvent['type'], 'quest_accepted' | 'quest_completed' | 'quest_failed'>;

interface QuestJournalEventInput {
  type: QuestJournalEventType;
  title: string;
  description: string;
  quest: Quest;
}

// -----------------------------------------------------------------------------
// Event Construction
// -----------------------------------------------------------------------------
// Build a stable journal event for quest acceptance, completion, or failure.
// The queue stores these separately from the visible journal entries so the
// later merge step can decide how and when to publish them.
// -----------------------------------------------------------------------------
export const createQuestJournalEvent = (
  state: GameState,
  input: QuestJournalEventInput
): JournalEvent => ({
  id: generateId(),
  type: input.type,
  timestamp: state.gameTime.getTime(),
  gameTime: state.gameTime.toISOString(),
  title: input.title,
  description: input.description,
  questId: input.quest.id,
});

// -----------------------------------------------------------------------------
// Journal Queue Updates
// -----------------------------------------------------------------------------
// Append quest events to the pending journal queue while preserving any events
// that were already waiting to be written out by the wider journal flow.
// -----------------------------------------------------------------------------
export const appendQuestJournalEvents = (
  state: GameState,
  events: JournalEvent[]
): Partial<GameState> => {
  if (events.length === 0) {
    return {};
  }

  const journal = state.journal ?? createInitialJournalState();

  return {
    journal: {
      ...journal,
      pendingEvents: [...journal.pendingEvents, ...events],
    },
  };
};

export const appendQuestJournalEvent = (
  state: GameState,
  event: JournalEvent
): Partial<GameState> => appendQuestJournalEvents(state, [event]);
