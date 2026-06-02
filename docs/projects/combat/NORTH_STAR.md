# Combat System North Star

Status: active
Last updated: 2026-06-02

## Why This Project Exists
Combat has a live implementation split across systems, hooks, and UI surfaces that were added in different slices. This project doc keeps ownership, execution paths, and unresolved behavior gaps visible for next agents so future work does not restart discovery or collapse unfinished intent.

## Intended Outcome
Preserve a working cold-start map for the Combat domain that stays implementation-safe:

- what exists in code today,
- what is partial,
- where open gaps are located,
- what to read next without scanning the full repo.

## Project Scope (Evidence-Bound)

Evidence-verified implementation homes:

- `src/systems/combat`: combat subsystems (riders, events, penalties, OA support, sustain actions)
- `src/hooks/combat/*`: orchestration and runtime state (`useTurnManager`, `useTurnOrder`, `useActionExecutor`, `useCombatEngine`, `useCombatAI`, etc.)
- `src/components/Combat`: active combat screen and encounter builder (`CombatView.tsx`, `ReactionPrompt.tsx`, `EncounterModal.tsx`, `MonsterPicker.tsx`)
- nearby tests in `src/systems/combat/__tests__`, `src/hooks/combat/**/__tests__`, and `src/components/Combat/__tests__` for these surfaces

Related architecture anchors:

- `docs/architecture/domains/combat.md`
- `docs/architecture/COMBAT_MAP_ENGINE.md`
- `docs/architecture/domains/battle-map.md`
- `docs/projects/PROJECT_TRACKER.md`

## Current State By Layer

### Combat orchestration (implemented)

The combat runtime is now clearly split:

- `useTurnManager.ts` coordinates initiative flow, round boundaries, end-of-turn processing, summon join points, and delegates execution/engine concerns.
- `useTurnOrder.ts` owns schedule math (initiative ordering, skipping dead entries, round wrap).
- `useCombatEngine.ts` owns damage/saving throw pipelines, tile effects, zones, repeat saves, and tick-like state transitions.
- `useActionExecutor.ts` owns action semantics including movement legality, dash/disengage handling, OA processing, and logging.
- `useCombatAI.ts` provides timer-driven AI state loops (`idle -> thinking -> acting -> done`) with a 3-action turn cap.
- `useCombatOutcome.ts` computes battle victory/defeat and rewards based on character HP state.

### Combat systems (implemented, partial)

- `AttackEventEmitter.ts`, `MovementEventEmitter.ts`: emit pre/post hooks for attack and movement events.
- `AttackRiderSystem.ts`, `SavePenaltySystem.ts`: rider/payload attachment and save-penalty logic.
- `OpportunityAttackSystem.ts`: OA trigger and validation for movement steps with LoS and reaction gating.
- `SustainActionSystem.ts`: tracked sustain prompts with singleton backing storage.

### Combat UI (implemented)

- `CombatView.tsx` wires map, logs, turn manager, AI hook, rich messaging bridge, victory/defeat hooks, and encounter simulation controls.
- `ReactionPrompt.tsx` provides ARIA dialog + spell selection UI for reaction prompts.
- `EncounterModal.tsx` and `MonsterPicker.tsx` support AI/custom/bestiary encounter building and live difficulty recalculation.

## Known Partial / Open Areas (Evidence-Backed)

These are direct code/docs observations, not guesses:

- `TODO(lint-intent)` comments indicate testability or typing debt in `AttackRiderSystem.ts`, `SustainActionSystem.ts`, `useCombatAI.ts`, `useActionExecutor.ts`, `useCombatEngine.ts`, and `useTurnManager.ts` (unused imports/parameters, stale-closure workaround notes, singleton extraction concerns, centralization opportunities).
- Event/sustain singletons are shared via `getInstance()` and may require explicit reset hooks for strict unit isolation (noted in file comments and `Combat_Ralph.md`).
- `docs/architecture/domains/combat.md` records known mechanics omissions (for example, death-save sequencing and some class feature conversions), so implementation behavior should be validated before assuming full D&D parity.
- `useCombatAI.ts` still has explicit TODOs to cover state-machine transition tests in test suite terms.

## Uncertain / Open Questions (Needs Follow-Up)

- Whether singleton-backed emitters/systems should be refactored to injectable instances before broad AI/automated combat test expansion.
- Whether reaction/OA edge cases are complete enough for non-combat-map movement paths and special conditions.
- Whether combat math and map-aware rules need a separate pass for one-to-one parity validation versus `BattleMap3D` rendering.

## What Must Not Be Lost

- Existing split contracts (`useTurnOrder`, `useCombatEngine`, `useActionExecutor`) are active dependencies.
- 3D/2D combat rendering logic is a separate layer under `src/components/BattleMap` and should not be treated as the rule owner.
- `GLOBAL_GAPS.md` contains historical logs of cross-project tracking gaps.

## Global Gap Imports

| Global ID | Target ID | Import Date | Status | Notes |
|---|---|---|---|---|
| GG-13 | G23 | 2026-06-02 | imported | Combat log state is transient and cleared upon page reload. |

## Active Task (Current Combat Mechanic Slice)

| Field | Value |
|---|---|
| Task | Unconscious or downed characters (at 0 HP) do not automatically drop concentration on active spells (G22). |
| Acceptance criteria | Update turn manager or combat engine to drop concentration immediately when a character is downed (hits 0 HP). |
| Allowed boundaries | `src/hooks/combat/`, `src/hooks/combat/engine/`, and nearby combat systems. |
| Stop condition | Verified with unit tests that downed characters lose active spell concentration automatically. |

## Resume Path for Cold Start

1. Read this file.
2. Read `docs/projects/combat/TRACKER.md`.
3. Read `docs/projects/combat/GAPS.md`.
4. Cross-check architecture boundaries in `docs/architecture/domains/combat.md` and `docs/architecture/COMBAT_MAP_ENGINE.md`.
5. Continue with the highest `not_started` gap row in `TRACKER.md` or `GAPS.md`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
