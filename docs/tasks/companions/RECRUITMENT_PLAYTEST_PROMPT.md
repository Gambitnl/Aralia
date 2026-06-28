# Agent Prompt — Investigate & Play-Test the Companions / Recruitment System

> Hand this to a fresh agent (Explore or general-purpose). It is self-contained.
> Authored 2026-06-27 from the Aralia repo (`F:\Repos\Aralia`).

## Your mission

Aralia (a D&D-flavored RPG, `F:\Repos\Aralia`) has a **companions** system, but it's
unclear how a player actually *gets* companions during normal play. Your job is to
**map it, play-test it in the running game, and design the missing recruitment layer** —
culminating in a vision where the player can attempt to recruit **almost any NPC**, and
NPCs without a predetermined class/subclass/level get **procedurally generated unique
traits and skills** when they join.

Work in three phases. Produce a written report (markdown) with findings + a concrete,
codebase-grounded design proposal. Do **not** ship gameplay changes unless explicitly
asked — this is investigation + design + a small optional spike.

## What you already know (don't re-derive — verify)

- **Two separate "party" concepts:**
  - `GameState.party: PlayerCharacter[]` — the player's adventuring party (full
    character objects with class/level/stats). Defined in `src/types/character.ts`.
  - `GameState.companions: Record<string, Companion>` — a richer relationship/banter
    system (approval, loyalty, memories, goals, reaction rules). `Companion` is in
    `src/types/companions.ts`; the roster is seeded from `src/data/companions` at init
    (`src/state/initialState.ts`). **These two are NOT unified** — a "companion" is not
    automatically a `PlayerCharacter` in the party, and vice-versa. Clarifying how (or
    whether) they connect is part of the task.
- **Companion state plumbing:** `src/state/reducers/companionReducer.ts` handles
  `UPDATE_COMPANION_APPROVAL` (relationship approval, −500..500, via
  `src/systems/companions/RelationshipManager.ts`), `ADD_COMPANION_MEMORY`,
  `ADD_COMPANION_REACTION`, banter actions, and (newly added by the travel-provisioning
  work) `ADJUST_COMPANION_LOYALTY` (loyalty 0–100) + `COMPANION_DESERT` (removes a
  companion from the roster). There is currently **no join/recruit action** — companions
  exist from game start and can only leave (desert). Confirm this.
- **NPCs:** general NPCs live in `src/data/world/npcs.ts` (`NPCS`) and the `NPC` type in
  `src/types`. Investigate what data an NPC carries vs. what a `Companion` /
  `PlayerCharacter` needs, and the gap between "an NPC in the world" and "a recruited
  party member."
- **Known design intent (from project memory):** an earlier "travel companions" design
  explicitly deferred *non-party NPC travel companions + consent* because "there is no
  interface for non-party NPCs yet." The desired end state (the user's words): per-NPC
  willingness → confirm prompt → recorded dialogue → negotiated terms (pay / loot share)
  → relationship-gated willingness → dynamic re-consent / desertion. Your design should
  aim at this.
- **Character generation exists:** `ADD_GENERATED_CHARACTER` action + char-creation /
  generation utilities under `src/utils/character/` and `src/systems/` build full
  `PlayerCharacter`s from templates. This is the likely lever for "generate unique
  traits/skills for a class-less NPC." Find the cleanest reuse path.

## Phase 1 — Map the current system (read-only)

Trace and document, with `file:line` citations:
1. How `Companion`, `PlayerCharacter`, and `NPC` differ (fields, identity, stats,
   skills, class/level). Where do they overlap? What would it take to promote an `NPC`
   into a party `PlayerCharacter` and/or a `Companion`?
2. Every code path that adds/removes a party member or companion today
   (`SET_PARTY_COMPOSITION`, `SET_FULL_PARTY`, `ADD_GENERATED_CHARACTER`,
   `COMPANION_DESERT`, any dialogue/quest hooks). Is there *any* in-game recruitment
   path, even a dev one? (Check `src/components/debug/`, dialogue reducers, quest
   reducers, and `src/hooks/`.)
3. The relationship/approval/loyalty model: how approval and loyalty are set, changed,
   and read; what gates they control; whether dialogue can move them.
4. How dialogue works (`src/components/Dialogue/`, `src/hooks/useDialogueSystem.ts`,
   `src/state/reducers/dialogueReducer.ts`) — because "convince an NPC to join" will most
   naturally live in dialogue outcomes.
5. How a class-less / generic NPC's combat capability (if any) is currently represented.

## Phase 2 — Play-test in the running game

Drive the real app and record what actually happens. Setup:
- Dev server config lives in `.claude/launch.json`. Use the **`dev:preview`** config
  (port **5176**) if another session holds the default `dev` (5174). Start it via the
  preview tool, then navigate the page to `http://localhost:5176/Aralia/`.
- Load a game: click **"Continue Journey"** (loads the autosave into `PLAYING`), or start
  a new game. The first bundle load is heavy — poll `document.getElementById('root')`
  child count until the app mounts.
- **Dev probes (dev-gated, already in `App.tsx`):** `window.__araliaState` is a read-only
  state summary; `window.__araliaDispatch` is the live reducer dispatch — use it to set
  up scenarios (e.g. `__araliaDispatch({type:'ADD_GENERATED_CHARACTER', payload: ...})`,
  approval/loyalty tweaks). `__araliaState` does NOT currently expose companions/party
  detail — read deeper state via the React DevTools hook fiber if needed, or extend the
  probe locally (revert after).
- Note `preview_screenshot` tends to hang on the heavy world-map SVG — verify via DOM
  `preview_eval` (querySelector + textContent) instead of screenshots.

Then answer, with evidence:
1. As a player starting fresh, **can you recruit anyone**? How? If not, what's the wall?
2. Do the seeded companions actually appear/interact? Can you talk to them, raise
   approval, see banter? What drives loyalty?
3. What breaks or is missing when you try to grow the party in-game?

## Phase 3 — Design the recruitment layer (the deliverable)

Propose a concrete, codebase-grounded design for:
1. **Finding / meeting recruitable NPCs** — where candidates come from (world NPCs,
   tavern encounters, quest rewards, rescued prisoners, etc.).
2. **Recruitment paths & motivation** — *why* an NPC joins or can be convinced: shared
   goals, gold/pay, loot share, debt/gratitude, faction alignment, charisma/persuasion
   checks, relationship threshold. Model this as data on the NPC ("what would make this
   one say yes") + a dialogue/decision flow that consumes it. Tie it to the existing
   approval/loyalty model and the deferred "consent → negotiated terms → re-consent"
   intent above.
3. **Recruit-any-NPC + procedural traits/skills** — when an NPC has **no predetermined
   class/subclass/level**, generate a unique kit on join: a fitting class/subclass or a
   class-less "skirmisher" stat block, level, ability scores, a few signature
   skills/traits seeded deterministically from the NPC's identity (so the same NPC is
   always the same). Identify the exact existing generators to reuse
   (`ADD_GENERATED_CHARACTER` path, `src/utils/character/`, any `SeededRandom` usage) and
   the minimal new code: an `NPC → PlayerCharacter`/`Companion` promotion function + a
   `RECRUIT_NPC` action.
4. **State model** — how a recruited NPC lands in `party` and/or `companions` (decide
   whether to unify them or bridge them), and how desertion/leaving already-built hooks
   (`COMPANION_DESERT`) fit.

## Deliverables

- A markdown report: Phase 1 system map (with `file:line`), Phase 2 play-test findings
  (what works / what's missing, with reproduction notes), Phase 3 design proposal with a
  task-sized implementation plan (files to add/modify, new actions, the NPC→party
  promotion + procedural-kit function, and a TDD-able pure core for the kit generation).
- Call out the biggest risks/unknowns and the smallest first slice that would let a
  player recruit one NPC end-to-end.

Keep it grounded in what the code actually does — verify every claim against the files.
