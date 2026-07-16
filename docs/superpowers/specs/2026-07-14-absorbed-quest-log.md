# Absorbed: Quest Log (docs/projects/quest-log)

Absorbed into the planmap topic `quest-log` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live boundary and evidence.

## What this project was

The shipped Quest Log: modal UI and rendering, visibility/dispatch wiring, quest
accept/update/complete and reward state transitions, and direct integrations with
movement/item triggers and journal surfaces. Quest-engine design decisions belong to the
broader Quests domain (formerly `docs/projects/quests`), not here.

## Done work on record

- T7/G3 NPC quest handoff implemented 2026-06-19 (Option A, decision D14 2026-06-10):
  `talk` payloads can carry a minimal `questOffer: { questId }`;
  `src/hooks/actions/handleNpcInteraction.ts` resolves the id through `INITIAL_QUESTS`,
  skips missing/duplicate offers, and dispatches the existing `ACCEPT_QUEST` action.
  Proof: `npm test -- src/hooks/actions/__tests__/handleNpcInteraction.test.ts`.
- Do NOT reopen T7/G3.

## Adjacent follow-ups (owned by the broader Quests domain)

| Gap | Summary | Evidence |
|---|---|---|
| G2 | Replace hardcoded item/location quest triggers with data-driven quest hooks | `src/hooks/actions/handleItemInteraction.ts`, `src/hooks/actions/handleMovement.ts` |
| G5 | Resolve schema mismatch between legacy `Quest` and richer staged `QuestDefinition` in runtime flow | `src/types/quests.ts`, `src/state/reducers/questReducer.ts` |
