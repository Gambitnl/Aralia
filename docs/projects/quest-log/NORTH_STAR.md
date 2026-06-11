---
schema_version: 1
project: Quest Log
slug: quest-log
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
confidence: medium
evidence: docs/projects/quest-log/AUDIT_OR_PROOF.md
gap_signal: "G3 decided 2026-06-10 (D14, Option A); implementation lane open"
protocol: living project doc set
next_step: "Implement the quest-giver bridge in handleNpcInteraction.ts (Option A): define a minimal quest-offer payload as part of the work and cover the handoff with focused source-backed tests."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - scoped_tests
  - docs_consistency
completed_verification:
  - docs_consistency
  - scoped_tests
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Quest Log North Star

Status: active (decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Purpose and Scope

This project documents the Quest Log implementation as currently shipped, not a planned placeholder.

What is in scope:
- Quest Log modal UI and rendering.
- Quest log visibility and dispatch wiring.
- Quest accept/update/complete and reward state transitions.
- Existing direct integrations with movement/item triggers and journal surfaces.

What is out of scope:
- Full quest-schema migration from legacy `Quest` to staged/braided quest definitions.
- New quest trigger architecture beyond current code.
- Debt cleanup that is not needed to preserve behavior and handoff context.

## Why This Project Exists

- The source already has Quest Log code spread across UI, actions, reducers, and quest systems.
- This folder captures the project boundary and keeps future work from re-inventing or shrinking the feature.
- It also preserves explicit links to `docs/projects/quests` so domain-wide decisions stay centralized.

## Dashboard Card Schema

Project: Quest Log
Slug: quest-log
Category: Feature/UI Projects
Status: active (decision recorded 2026-06-10; implementation lane open)
Confidence: medium
Evidence: docs/projects/quest-log/AUDIT_OR_PROOF.md
Gap signal: G3 decided 2026-06-10 (D14, Option A); implementation lane open
Protocol: living project doc set
Next step: Implement the quest-giver bridge in `handleNpcInteraction.ts` (Option A): define a minimal quest-offer payload as part of the work and cover the handoff with focused source-backed tests.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency, scoped_tests
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09
Agent comments:
Required docs: NORTH_STAR.md, TRACKER.md, GAPS.md, COLD_START_AGENT_PROMPT.md, DECISIONS.md, AUDIT_OR_PROOF.md, RUNBOOK.md
Optional docs: tasks/, architecture notes, migration notes
Compaction status: not_needed

## Implemented State Snapshot

- Quest Log modal exists and is rendered from `src/components/QuestLog/`:
  - `QuestLog.tsx`: shows active, completed, and failed sections.
  - `QuestCard.tsx`: progress, status badge, rewards, and objective list.
  - `QuestHistoryRow.tsx`: failed/completed history rows and deadline-note trail.
  - `questUtils.ts`: date formatting helper.
  - `__tests__/QuestLog.test.tsx`: open/close/render assertions.
  - `src/state/reducers/__tests__/journalReducer.test.ts`
- Modal is launched via:
  - `src/components/layout/GameModals.tsx`
  - `src/components/ActionPane/SystemMenu.tsx` and `handleSystemAndUi.ts`.
- `ACCEPT_QUEST`, `UPDATE_QUEST_OBJECTIVE`, `COMPLETE_QUEST` actions are handled by `src/state/reducers/questReducer.ts`.
- Visibility is handled by `isQuestLogVisible` in state and `TOGGLE_QUEST_LOG` in `src/state/reducers/uiReducer.ts`.
- Root reducer pipeline includes `questReducer`, `uiReducer`, and `journalReducer` in `src/state/appState.ts`.
- Quest transitions now queue `quest_accepted`, `quest_completed`, and `quest_failed` journal events through `src/systems/quests/questJournal.ts`, and `journalReducer` materializes them into `autoLoggedEvents` when a journal entry is added.
- Trigger flow includes:
  - item pickup: `old_map_fragment` in `src/hooks/actions/handleItemInteraction.ts`.
  - movement locations: `ancient_ruins_entrance`, `ruins_courtyard` in `src/hooks/actions/handleMovement.ts`.
- Deadline handling exists in `src/systems/quests/QuestManager.ts` and is checked by `processWorldEvents`.

## File Map (project-relevant)

- UI surface:
  - `src/components/QuestLog/QuestLog.tsx`
  - `src/components/QuestLog/QuestCard.tsx`
  - `src/components/QuestLog/QuestHistoryRow.tsx`
  - `src/components/QuestLog/questUtils.ts`
  - `src/components/QuestLog/__tests__/QuestLog.test.tsx`
  - `src/components/layout/GameModals.tsx`
  - `src/components/ActionPane/SystemMenu.tsx`
  - `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`
  - `src/components/CharacterSheet/Journal/JournalTab.tsx`
  - `src/components/CharacterSheet/CharacterSheetModal.tsx`
- Action/state flow:
  - `src/hooks/actions/actionHandlers.ts`
  - `src/hooks/actions/handleSystemAndUi.ts`
- `src/hooks/actions/handleItemInteraction.ts`
- `src/hooks/actions/handleMovement.ts`
- `src/hooks/actions/handleResourceActions.ts`
- `src/state/reducers/questReducer.ts`
- `src/state/reducers/uiReducer.ts`
- `src/state/reducers/journalReducer.ts`
  - `src/state/appState.ts`
  - `src/types/actions.ts`
  - `src/types/state.ts`
  - `src/systems/quests/questJournal.ts`
- Quest data and system:
  - `src/data/quests/index.ts`
  - `src/systems/quests/QuestManager.ts`
  - `src/types/quests.ts`
  - `src/types/journal.ts`

## Integrations and Cross-System Behavior

- Character sheet journal tab reuses `QuestLogSidebar` for quest browsing (`QuestLog`, `JournalTab`).
- World day progression can mark quests failed via `checkQuestDeadlines`.
- Quest reducer rewards update party gold, xp, and inventory and post notifications.
- Quest acceptance, completion, and deadline failure transitions now append pending journal events, while `log_only` deadline consequences remain system-log only.
- Long rest now dispatches `ADD_JOURNAL_ENTRY` after the time advance so queued quest events materialize into the visible chronicle in play.
- `fail_with_note` deadline misses now keep the deadline message in `quest.notes`, and `QuestHistoryRow` surfaces it in the history view.
- `log_only` deadline misses stay system-message only and keep the quest active.
- `SystemMenu` can open the modal alongside other overlay toggles.

## Relationship to `docs/projects/quests`

`docs/projects/quests` remains the owner for broader quest-system intent, design direction, and future schema migration.
`docs/projects/quest-log` is the implementation-owned slice for:
- concrete UI behavior,
- action routes currently in play,
- known implementation gaps in that surface.

## Known Gaps / Uncertainties

- Legacy `Quest` shape is active in runtime; richer staged `QuestDefinition` types are not yet wired through reducer/runtime flow.
- Quest acceptance and objective updates are hardcoded by IDs, not metadata-driven hooks.
- Quest transitions now queue journal events, and the journal reducer flushes that queue into visible entries when `ADD_JOURNAL_ENTRY` is dispatched.
- `handleResourceActions.ts` is the current gameplay producer for `ADD_JOURNAL_ENTRY`; long rest owns the visible journal-page boundary.
- `fail_with_note` deadline misses now surface their note in the Quest Log history row; `log_only` stays system-message only.
- NPC dialogue-based quest starts are incomplete and still marked as TODO in handler code.
- Some TODOs still point at richer typing cleanup and dead imports across touched files.

## Required Review Brief

Title: NPC Quest Handoff Ownership
Question: Should `handleNpcInteraction.ts` own the quest-giver bridge that can hand quests off through dialogue, or should quest offers stay routed through a broader dialogue/quest contract first?
Issue: The current handler only opens dialogue and leaves a TODO at the quest-giver boundary; the source scan did not find a quest-offer payload, topic contract, or NPC data path that can safely carry a quest give/accept flow by itself.
Current behavior: NPC interaction starts dialogue sessions, while actual quest starts still come from item and location triggers.
Why blocked: Wiring `ACCEPT_QUEST` here without a confirmed ownership contract would invent semantics across dialogue, NPC, and quest data at the same time and would widen into the broader quest schema migration.
Option A: Add a narrow quest-giver hook in `handleNpcInteraction.ts` that dispatches quest acceptance from dialogue outcomes and cover it with a focused source-backed test.
Option B: Keep quest handoff data-driven in the broader quests/dialogue lane and leave `handleNpcInteraction.ts` as dialogue-only until that contract is defined elsewhere.
Evidence: `src/hooks/actions/handleNpcInteraction.ts`, `src/hooks/actions/actionHandlers.ts`, `src/services/dialogueService.ts`, `src/data/dialogue/topics.ts`, `src/hooks/useDialogueSystem.ts`, `src/state/reducers/questReducer.ts`, `src/hooks/actions/handleItemInteraction.ts`.
Decision owner: Quest Log owner with dialogue/NPC and quests-schema owners if the contract crosses project boundaries.
Proof after decision: A focused source-backed test for the chosen handoff path plus `node scripts\audit-living-project-docs.cjs --project quest-log`.

### Decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D14 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **Option A — wire the quest-giver bridge now.** `handleNpcInteraction.ts` owns the NPC
  quest handoff; add the bridge that dispatches quest acceptance from dialogue outcomes,
  with focused source-backed test coverage.
- The owner chose this over deferring for a broader dialogue/quest contract. The bridge
  implementation should **define a minimal quest-offer payload as it goes** rather than
  waiting on the broader quests/dialogue schema lane.

Status: decision recorded 2026-06-10; implementation lane open.

## Next Checks

- Confirm quest-log behavior after any quest-state schema migration.
- Resolve the NPC quest handoff ownership decision in the Required Review Brief. (Done 2026-06-10 — see Decision subsection above; implement Option A with the minimal quest-offer payload and focused tests.)

## Resume Path

1. Read this file.
2. Read `docs/projects/quest-log/TRACKER.md`.
3. Read `docs/projects/quest-log/GAPS.md`.
4. Read `docs/projects/quest-log/AUDIT_OR_PROOF.md` for the last durable proof note.
5. Read `docs/projects/quests/NORTH_STAR.md` for domain context before scope decisions.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
