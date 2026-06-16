# Executor Brief — GAME-ENTRY-SITUATION: drop the player into a live, Ollama-generated opening situation

You are an executor agent working on Aralia in `F:\Repos\Aralia` (Windows). This
brief IS your directive — read it fully, then build the feature it describes.

## The feature (owner intent)

When the player finishes character creation, they should NOT spawn into a quiet
static "you are in a clearing" screen. They should land **in the middle of a
situation** — a predicament already in motion — and the game should open **as a
conversation** they're already part of. The situation is **truly generated**
(not picked from a list): a local Ollama model writes a fresh narrative
predicament grounded in who this character is and where they are, and the player
finds themselves inside it, able to respond in dialogue from the first frame.

"Truly random" is a hard requirement: the situation must be genuinely
non-deterministic per new game (fresh model generation, not seed-pinned, not
templated). Two new games with the same character/seed should produce different
openings.

## OWNER DIRECTIVE — no fallback systems (2026-06-15)

There is **no canned/templated fallback situation**. The opening is Ollama or
nothing:
- If the local model is unavailable, surface that honestly and block entry with
  a retry affordance (reuse `src/components/ui/OllamaDependencyModal.tsx`) —
  never substitute a hardcoded scene.
- Do NOT copy the fallback branch in `useConversation.startConversation`
  (`src/hooks/useConversation.ts:176`). The new path must not invent a line when
  the model is down.
See `docs/projects/worldforge/DECISIONS.md` D-NOFB.

## Context to read first (READ-ONLY)

- `src/hooks/useGameInitialization.ts` — `startGame` (~line 250) is THE game-
  entry point: it builds `StartGameSuccessPayload`, dispatches
  `START_GAME_SUCCESS`, and drops the player at `STARTING_LOCATION_ID`
  (`'clearing'`) with the static `initialLocationDescription`. This is where the
  situation hook belongs.
- `src/services/ollama/index.ts` — `OllamaService` facade; `getDefaultClient()`
  → `isAvailable()`, `getModel()`, `generateForTask()` / `chatForTask()`.
- `src/services/ollama/taskProfiles.ts` + `router.ts` + `src/types/ollama.ts` —
  the `TaskType` system; there is a PROSE profile for narrative. Add a new
  task type (e.g. `OPENING_SITUATION`) with a prose-leaning, higher-temperature
  profile, or justify reusing PROSE.
- `src/services/ollamaTextService.ts` — `generateSituationAnalysis`,
  `generateDynamicEvent`, and the `StandardizedResult<T>` wrapping pattern; copy
  the house style for a new generator.
- `src/types/conversation.ts`, `src/hooks/useConversation.ts`,
  `src/state/reducers/conversationReducer.ts`,
  `src/components/ConversationPanel/ConversationPanel.tsx` — the conversation
  surface. NOTE: `ActiveConversation.participants` is currently assumed to be
  COMPANION ids; a situational stranger-NPC must be reconciled (see Requirement 3).
- `src/types/core.ts` (`GamePhase`, `START_GAME_SUCCESS` payload),
  `src/App.tsx` (PLAYING render branch + how panels/modals mount).
- The player character shape (race/class/background/name) you'll feed the prompt.

## Scope (files you may create/edit)

- NEW `src/systems/gameEntry/**` (yours) + `__tests__` — the situation
  generator + types + the state machine for "generating → in-situation".
- NEW Ollama task profile entry (additive) in `taskProfiles.ts` /
  `src/types/ollama.ts` if you add `OPENING_SITUATION`.
- `src/hooks/useGameInitialization.ts` — minimal additive wiring in/after
  `startGame` to trigger situation generation. Do not change existing payload
  fields.
- Conversation system extension (`conversation.ts` types +
  `conversationReducer.ts`) to allow a non-companion situational participant —
  smallest additive change; keep companion conversations working unchanged.
- `src/App.tsx` and/or a NEW intro overlay component — the "generating your
  situation…" state and the conversation drop-in on PLAYING entry. Keep App.tsx
  edits surgical and additive (it is very hot).
- A report at `docs/tasks/game-entry-situation/REPORT.md`.

If a needed edit forces a non-additive change to a hot shared file, STOP and
write the proposal in the report instead of forcing it.

## Requirements

1. **Situation model** (`gameEntry/types.ts`): a structured `OpeningSituation`
   — setting (place/time/weather), the inciting predicament (1–2 sentences of
   narration), 1–3 present `SituationNPC`s (name, role, disposition, immediate
   goal), an opening NPC utterance, and optional 2–4 suggested player replies.
   Document the schema.
2. **Generator** (`gameEntry/generateOpeningSituation.ts`):
   `async generateOpeningSituation(character, locationContext): Promise<OpeningSituation>`.
   - Builds a prompt from the character (race/class/background/name) + location
     so the predicament is grounded in this specific PC.
   - Calls Ollama via the task-aware client; parses robustly
     (`parseJsonRobustly`). **Non-deterministic** (do not seed; prose-temp
     profile).
   - On unavailable model or unparseable output → **throw** (no fallback). The
     caller turns that into the honest "Ollama required" block.
3. **Drop into a conversation**: on PLAYING entry for a fresh new game, open an
   `activeConversation` seeded with the situation's opening narration + the NPC
   utterance, with the situational NPC as a participant. The player must be able
   to type a reply and get an in-situation Ollama response (reuse the
   `continueConversation` path, primed with the situation as context). Reconcile
   the companion-only participants assumption: register/resolve the situational
   NPC so the conversation system can address it, OR widen participants to
   general NPC ids — your call, documented.
4. **State machine**: `idle → generating → in-situation` (and
   `model-unavailable`). While generating, show a non-blocking "the world is
   taking shape…" state; never leave the player on a blank PLAYING frame. The
   situation generates ONCE per new game (not on load of an existing save).
5. **Tests** (Ollama STUBBED — you cannot golden a live LLM):
   - generator builds a character-grounded prompt; success maps to a valid
     `OpeningSituation`; model-unavailable and unparseable both **throw** (prove
     no fallback).
   - the entry state machine: fresh-new-game → generating → conversation opened
     with the NPC participant + opening messages; existing-save load does NOT
     trigger generation.
   - conversation extension keeps companion conversations green.
   - Aggregate-counter style; no `Math.random`/`Date.now` leaking into testable
     logic except the intended non-determinism (inject the clock/RNG/model call
     so tests are deterministic while production is not).

## Verification criteria

- [ ] `npx vitest run src/systems/gameEntry/` green
- [ ] `npx vitest run src/hooks/ src/state/` green (conversation + init, no
      regressions)
- [ ] `npx tsc --noEmit 2>&1 | grep -iE "gameEntry|useGameInitialization|conversation"` empty
- [ ] **Render-and-eyeball (standing owner rule)** with a real Ollama running:
      create a character → confirm you land inside a freshly-written situation
      presented as a conversation, can reply, and get a live response. Capture
      the opening screen + one exchange to `.agent/`. Run it twice to show the
      opening differs (truly random). Reference both in the report.
- [ ] Honest-failure proof: with Ollama stopped, entry shows the dependency
      block + retry, NOT a canned scene. Capture it.
- [ ] Add a tracked work-path entry: create
      `docs/tasks/game-entry-situation/TRACKER.md` (or append to an existing
      living tracker) with what/why/proof, and log any gaps.

## Hard rules

- No fallback / no canned situation. Ollama or an honest block.
- Truly non-deterministic opening (do not seed-pin it).
- No git commit/stage/push. Other agents share this checkout — touch ONLY your
  scope; additive-only in hot shared files.
- When fully finished, print the literal token `END_TURN` as your last line.
