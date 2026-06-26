# TRACKER - GAME-ENTRY-SITUATION

Living work-path log for the Ollama-generated opening situation. What / why / proof.

## What Was Built (2026-06-16)

| Slice | Files | Why |
|---|---|---|
| Situation schema | `src/systems/gameEntry/types.ts` | Structured `OpeningSituation` with setting, predicament, 1-3 `SituationNPC`s, opening line, optional replies, and `GameEntryState`. |
| Generator | `src/systems/gameEntry/generateOpeningSituation.ts` | Builds a character-grounded prompt, calls Ollama through the task-aware client, parses with `parseJsonRobustly`, and throws on unavailable/unparseable output. |
| Task profile | `src/types/ollama.ts`, `src/services/ollama/taskProfiles.ts` | Adds the `opening_situation` task type with prose-leaning, high-temperature JSON output. |
| Entry state machine | `src/systems/gameEntry/entryStateMachine.ts` | Pure `idle -> generating -> in-situation` state machine, plus `model-unavailable`, retry, and reset. |
| State slice | `src/state/reducers/gameEntryReducer.ts`, `src/state/appState.ts`, `src/types/state.ts`, `src/state/initialState.ts` | Drives the opening state with additive actions and optional state for existing saves. |
| Conversation extension | `src/types/conversation.ts`, `src/state/reducers/conversationReducer.ts`, `src/hooks/useConversation.ts`, `src/components/ConversationPanel/ConversationPanel.tsx` | Allows situation conversations with non-companion NPC participants while preserving companion conversations. |
| Orchestration | `src/hooks/useOpeningSituation.ts`, `src/components/gameEntry/OpeningSituationGate.tsx`, `src/App.tsx` | Runs the generator once on fresh-game entry, seeds the conversation, and shows the Ollama dependency block on failure. |
| Trigger | `src/hooks/useGameInitialization.ts` | Dispatches `BEGIN_OPENING_SITUATION` after `START_GAME_SUCCESS`; load/dummy flows skip generation. |

## Proof

- Unit tests: `npx vitest run src/systems/gameEntry/ src/state/reducers/__tests__/gameEntryReducer.test.ts` passed with 21 tests.
- No regressions: `npx vitest run src/hooks/ src/state/` passed with 314 passed / 8 skipped.
- Scope typecheck: `npx tsc --noEmit | grep -iE "gameEntry|useGameInitialization|conversation"` was empty; one unrelated pre-existing `isLongRestModalVisible` error was noted.
- Live Ollama proof: `.agent/game-entry-situation/openings-capture.txt` captured two different same-character openings; `Predicaments differ: true`.
- Honest-failure proof: `.agent/game-entry-situation/honest-failure.txt` shows `OpeningSituationUnavailableError` and no generated scene.
- App health: dev server on port 5174 loaded the main menu with zero console errors.

## Addendum (2026-06-16): NPCs Placed In Scene

| Slice | Files | Why |
|---|---|---|
| Situation-to-RichNPC converter | `src/systems/gameEntry/situationNpcToRichNpc.ts` | Maps each generated `SituationNPC` into a full `RichNPC` while preserving role, disposition, goal, and opening line. |
| Placement action | `PLACE_SITUATION_NPCS` in `src/state/actionTypes.ts` and `src/state/reducers/gameEntryReducer.ts` | Registers generated NPCs and appends their ids to `currentLocationActiveDynamicNpcIds`. |
| Hook wiring | `src/hooks/useOpeningSituation.ts` | Places generated NPCs before opening the conversation. |
| Scene resolution | `src/App.tsx` | Resolves dynamic ids from static `NPCS` or `generatedNpcs` so generated NPCs can render in-scene. |

Proof: `.agent/game-entry-situation/npcs-in-scene-capture.txt` captured generated strangers appearing as in-world "Talk to" actions and conversation participants. Tests: `situationNpcToRichNpc.test.ts` plus placement reducer cases passed; `src/state/ src/hooks/` passed with 316 tests.

## Gaps / Follow-Ups

See `GAPS.md` for the remaining follow-up: full in-browser click-through proof.
The optional narrative-model preference cleanup is closed; `gemma4:12b` is now
listed in the prose model preference chain used by `opening_situation`.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/game-entry-situation/TRACKER.md","sha256WithoutMarker":"662e26cae9e7d0cf68cb170f2d3386ea9ca66fd6da1f37947fd6f5521fe9b80f","markedAtUtc":"2026-06-25T22:29:38.626Z"} -->
