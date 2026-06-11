# Quest Log Decisions

Status: active
Last updated: 2026-06-10

## D1: Quest transitions queue journal events before any journal entry materialization

Decision: quest acceptance, quest completion, and deadline failures that actually change quest status now append `JournalEvent` records to `journal.pendingEvents`, and `journalReducer` materializes that queue into `autoLoggedEvents` when `ADD_JOURNAL_ENTRY` is dispatched.

Why: the Quest Log and Journal already share the same `GameState`, so this keeps the quest trail durable without inventing a new storage model for the bridge itself.

What stayed unchanged: quest notifications, reward handling, and `log_only` deadline handling still behave the same way from the player perspective.

Resolution: the runtime flow is now wired in `src/hooks/actions/handleResourceActions.ts`; `LONG_REST` dispatches `ADD_JOURNAL_ENTRY` after `ADVANCE_TIME` so the quest queue can flush into a visible page in play.

Evidence: `src/state/reducers/questReducer.ts`, `src/systems/quests/QuestManager.ts`, `src/systems/quests/questJournal.ts`, `src/state/reducers/journalReducer.ts`, `src/state/reducers/__tests__/questReducer.test.ts`, `src/systems/quests/__tests__/QuestManager.test.ts`, `src/state/reducers/__tests__/journalReducer.test.ts`.

## D2: `log_only` deadlines remain system-log only

Decision: a missed deadline with `deadlineConsequence.action === 'log_only'` keeps the quest active and only emits the system message.

Why: this preserves the existing distinction between a deadline that changes quest state and a deadline that merely reports the miss.

What stayed unchanged: the quest log still tracks the quest as active, and no `quest_failed` journal event is queued for this branch.

Evidence: `src/systems/quests/QuestManager.ts`, `src/systems/quests/__tests__/QuestManager.test.ts`.

## D3: Long rest is the runtime producer for journal entry materialization

Decision: the long-rest gameplay flow now dispatches `ADD_JOURNAL_ENTRY` after `ADVANCE_TIME`, and the journal reducer fills the entry from live state before merging queued quest events.

Why: long rest is already the existing session boundary in play, so it is the least arbitrary place to open a new journal page without inventing a second queue or a separate journal-authoring mode.

What stayed unchanged: the quest-event bridge still queues accepted/completed/failed transitions first, and the journal reducer still remains the only place that turns that queue into visible `autoLoggedEvents`.

Evidence: `src/hooks/actions/handleResourceActions.ts`, `src/hooks/actions/__tests__/handleResourceActions.test.ts`, `src/state/reducers/journalReducer.ts`, `src/state/reducers/__tests__/journalReducer.test.ts`.

## D4: `fail_with_note` deadlines surface the note trail in Quest Log history

Decision: when a deadline misses with `deadlineConsequence.action === 'fail_with_note'`, the quest records the deadline message in `notes`, and the failed-history card renders that note trail.

Why: the system log already carries the immediate deadline message, but the quest history also needs a stable player-facing breadcrumb for the failure itself.

What stayed unchanged: `log_only` deadlines still keep the quest active, remain system-log only, and do not queue a failed quest journal event.

Evidence: `src/systems/quests/QuestManager.ts`, `src/components/QuestLog/QuestHistoryRow.tsx`, `src/systems/quests/__tests__/QuestManager.test.ts`, `src/components/QuestLog/__tests__/QuestLog.test.tsx`.

## D5: `handleNpcInteraction.ts` owns the quest-giver bridge (G3, 2026-06-10)

Decision: wire the NPC quest handoff now (Required Review Brief Option A). `handleNpcInteraction.ts` owns the quest-giver bridge that dispatches quest acceptance from dialogue outcomes, with focused source-backed test coverage. The bridge implementation defines a minimal quest-offer payload as it goes instead of waiting for a broader dialogue/quest contract.

Why: the owner (Remy, 2026-06-10 batched decision session) chose immediate wiring over deferring for a domain-wide dialogue/quest contract; the minimal payload keeps the slice narrow while giving the dialogue layer a concrete shape that the broader quests lane can later widen.

What stayed unchanged: item/location quest triggers, the quest/journal bridge, and `docs/projects/quests` ownership of the broader quest-schema migration all remain as documented.

Evidence: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D14), `docs/projects/quest-log/NORTH_STAR.md` Required Review Brief + Decision (2026-06-10), `src/hooks/actions/handleNpcInteraction.ts`.
