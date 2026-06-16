# REPORT — GAME-ENTRY-SITUATION

**Date:** 2026-06-16 · **Status:** Implemented, tested, live-verified (headless). One recommended owner final click-through (see Gaps).

## Summary

When a brand-new game finishes character creation, the player no longer spawns into
the static "you are in a clearing" description. Instead a local Ollama model writes a
**fresh, character-grounded predicament already in motion**, and the player lands
inside it presented **as a conversation** they can immediately reply to. The opening is
truly non-deterministic (high-temp, unseeded) and there is **no canned fallback** — if
the model is down, entry shows an honest dependency block + Retry and never invents a
scene (D-NOFB).

## How it works (flow)

1. `startGame` (`useGameInitialization.ts`) dispatches `START_GAME_SUCCESS` then
   `BEGIN_OPENING_SITUATION`. Load/dummy flows skip the second dispatch.
2. `gameEntryReducer` moves the pure state machine `idle → generating`.
3. `OpeningSituationGate` (mounted in `App.tsx` PLAYING branch) runs
   `useOpeningSituation`, which on the `generating` edge calls
   `generateOpeningSituation(character, location)` exactly once.
4. The generator builds a prompt grounded in the PC's race/class/background/name +
   spawn location, calls Ollama via the `opening_situation` task profile, and parses
   the JSON into an `OpeningSituation`. On unavailable/unparseable it **throws**.
5. On success the hook seeds an `activeConversation` (kind `situation`) with two
   messages — the narration (predicament) and the NPC's opening line — plus the
   situational NPCs as `npcParticipants`, then moves the machine to `in-situation`.
   The existing `ConversationPanel` + `useConversation.continueConversation` path
   carries the dialogue; situational NPC names/voices resolve from `npcParticipants`.
6. On throw the machine moves to `model-unavailable`; the gate renders the
   `OllamaDependencyModal` block + a Retry button (re-fires `BEGIN_OPENING_SITUATION`).

## Key decisions

- **Reconciling companion-only participants (Req 3):** chose to *widen* the
  conversation, not fake a companion. `ActiveConversation` gained optional `kind` and
  `npcParticipants: ConversationNpcParticipant[]`. `useConversation` and
  `ConversationPanel` fall back to `npcParticipants` when an id isn't a companion.
  Absent those fields, companion conversations behave exactly as before (proven by a
  regression test).
- **Trigger placement:** in `startGame` (in-scope, additive) rather than mutating the
  hot `START_GAME_SUCCESS` reducer. Keeps load/resume paths from ever generating.
- **State on GameState:** `gameEntry` is optional and defaulted to `idle`, so factories
  and existing saves need no migration; the reducer treats `undefined` as initial.
- **New task type** `opening_situation` (additive) with a prose-leaning, high-temp,
  json profile — justified over reusing PROSE because the opening needs higher variance
  and more tokens than atmospheric description.

## Verification (evidence)

- `npx vitest run src/systems/gameEntry/ src/state/reducers/__tests__/gameEntryReducer.test.ts` → **21 passed**.
- `npx vitest run src/hooks/ src/state/` → **314 passed / 8 skipped** (no regressions).
- `npx tsc --noEmit | grep -iE "gameEntry|useGameInitialization|conversation"` → **empty**.
  (Pre-existing unrelated `isLongRestModalVisible` error in `appState.ts:784`, confirmed via `git stash`.)
- **Live, real Ollama (gemma4:12b):** two runs of the same character/place produced two
  distinct, grounded openings → `.agent/game-entry-situation/openings-capture.txt`
  (`Predicaments differ: true`). Proves truly random.
- **Honest failure:** dead-port client throws `OpeningSituationUnavailableError`, returns
  no scene → `.agent/game-entry-situation/honest-failure.txt`.
- App boots clean to the main menu with zero console errors (entry wiring intact).

See `TRACKER.md` for the file-by-file map and the gap note on the full UI click-through.

## Scope honoured

No git commit/stage/push. Hot shared files (`App.tsx`, `appState.ts`,
`useGameInitialization.ts`, `useConversation.ts`, `ConversationPanel.tsx`,
`actionTypes.ts`, state types) touched additively only. New code lives under
`src/systems/gameEntry/**`, `src/hooks/useOpeningSituation.ts`,
`src/components/gameEntry/**`, and tests.
