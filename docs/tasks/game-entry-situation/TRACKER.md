# TRACKER — GAME-ENTRY-SITUATION

Living work-path log for the Ollama-generated opening situation. What / why / proof.

## What was built (2026-06-16)

| Slice | Files | Why |
|-------|-------|-----|
| Situation schema | `src/systems/gameEntry/types.ts` | Structured `OpeningSituation` (setting, predicament, 1–3 `SituationNPC`, opening line, optional replies) + `GameEntryState` machine state. No fallback shape. |
| Generator | `src/systems/gameEntry/generateOpeningSituation.ts` | Builds a character-grounded prompt (race/class/background/name + place), calls Ollama via the task-aware client, parses with `parseJsonRobustly`. **Throws** on unavailable/unparseable — never invents a scene. Injectable client + id factory for tests; non-deterministic in prod. |
| Task profile | `src/types/ollama.ts`, `src/services/ollama/taskProfiles.ts` | New `opening_situation` TaskType: PROSE models, temp 0.95 / topP 0.95, json, 420 num_predict for genuine per-run variety. |
| Entry state machine | `src/systems/gameEntry/entryStateMachine.ts` | Pure `idle → generating → in-situation` (+ `model-unavailable`, RETRY, RESET). Side-effect free → deterministic tests. `shouldGenerateOpening` = new-game only. |
| State slice | `src/state/reducers/gameEntryReducer.ts`, registered in `appState.ts` pipeline; `gameEntry` field on `state.ts`/`state.d.ts`/`initialState.ts` | Drives the machine via 4 entry actions in `actionTypes.ts`. Additive/optional so existing saves + factories load unchanged. |
| Conversation extension | `src/types/conversation.ts`, `conversationReducer.ts`, `useConversation.ts`, `ConversationPanel.tsx` | `ActiveConversation` gains optional `kind` + `npcParticipants` (non-companion strangers). `START_CONVERSATION` accepts `initialMessages[]`. Companion path untouched when the new fields are absent. |
| Orchestration | `src/hooks/useOpeningSituation.ts`, `src/components/gameEntry/OpeningSituationGate.tsx` | On `generating`, runs the generator (once, ref-guarded), seeds narration + NPC utterance into an `activeConversation`, moves to `in-situation`. On throw → `model-unavailable` → `OllamaDependencyModal` block + Retry. Mounted additively in `App.tsx` PLAYING branch. |
| Trigger | `src/hooks/useGameInitialization.ts` `startGame` | Dispatches `BEGIN_OPENING_SITUATION` right after `START_GAME_SUCCESS`. Load/dummy flows do NOT → no generation on resume. |

## Proof

- **Unit tests (Ollama stubbed):** `npx vitest run src/systems/gameEntry/ src/state/reducers/__tests__/gameEntryReducer.test.ts` → 21 passed.
  - generator: prompt grounded in character; good response → valid situation; model-unavailable throws; unparseable throws; missing structure throws.
  - state machine: all transitions + invalid no-ops + double-fire guard.
  - reducer: BEGIN→RESOLVE→in-situation; FAIL→model-unavailable; retry; unrelated actions don't trigger.
  - conversation: situation seed (multi-message + npcParticipants) AND legacy companion conversation both green.
- **No regressions:** `npx vitest run src/hooks/ src/state/` → 314 passed / 8 skipped.
- **Typecheck (scope clean):** `npx tsc --noEmit | grep -iE "gameEntry|useGameInitialization|conversation"` → empty. (One pre-existing unrelated error `isLongRestModalVisible` in appState.ts:784 — confirmed present without this change via `git stash`.)
- **Live render-and-eyeball (real Ollama, model gemma4:12b):**
  - `.agent/game-entry-situation/openings-capture.txt` — same character/place run TWICE → two distinct, character-grounded predicaments (Run B explicitly leverages warlock powers + charlatan background). `Predicaments differ: true`. Proves truly non-deterministic.
  - Script: `.agent/game-entry-situation/capture-openings.mjs`.
- **Honest-failure proof:** `.agent/game-entry-situation/honest-failure.txt` — client pointed at a dead port → `OpeningSituationUnavailableError` thrown, NO situation returned. Script: `capture-failure.mjs`. Gate turns this into the dependency block + Retry.
- **App health:** dev server (port 5174) loads main menu with zero console errors; entry wiring did not break the menu.

## Gaps / follow-ups

- **Full in-browser click-through** (New Game → character wizard → land inside the generated conversation → type a reply → live response) not screenshotted end-to-end here; the generation slice is proven headlessly against the live model and the conversation drop-in is covered by reducer/hook unit tests. Recommended as the owner's final eyeball — artifacts above stand as the generation proof.
- The `opening_situation` profile's `PROSE_MODELS` list does not yet include `gemma4`; the router correctly falls back to the installed model. Consider adding preferred narrative models to the list when standardised.
