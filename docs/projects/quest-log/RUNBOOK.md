# Quest Log Runbook

Status: review-required
Last updated: 2026-06-09

## Fast Verification

1. Run the focused quest/journal tests:
   `npm test -- src/systems/quests/__tests__/QuestManager.test.ts src/components/QuestLog/__tests__/QuestLog.test.tsx`
2. If you change the reducer or deadline checker again, refresh the dependency headers:
   `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/state/reducers/questReducer.ts`
   `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/systems/quests/QuestManager.ts`
   `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/systems/quests/questJournal.ts`
   `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/hooks/actions/handleResourceActions.ts`
3. If the journal queue needs to become visible in UI, inspect the quest journal bridge, the long-rest producer, and the journal tab files together:
   `src/systems/quests/questJournal.ts`
   `src/hooks/actions/handleResourceActions.ts`
   `src/components/CharacterSheet/Journal/JournalTab.tsx`
   `src/components/CharacterSheet/Journal/JournalSpread.tsx`

## Current Behavior Contract

- `ACCEPT_QUEST` appends a `quest_accepted` journal event.
- `COMPLETE_QUEST` and auto-completion append a `quest_completed` journal event.
- Deadline failures that actually fail the quest append a `quest_failed` journal event.
- `fail_with_note` deadlines keep the deadline note in the quest history card, while the system log still records the miss and the journal queue still captures the failed quest event.
- `log_only` deadlines stay active and only emit the system message.
- Pending quest journal events are queued in `journal.pendingEvents`; `ADD_JOURNAL_ENTRY` materializes them into the new entry's `autoLoggedEvents` and clears the queue.
- `LONG_REST` is the in-play journal producer: it advances time, then opens a new entry so the queued quest events have a visible page to land on.
- NPC quest handoff remains review-required until the Required Review Brief in `NORTH_STAR.md` resolves the ownership boundary.
