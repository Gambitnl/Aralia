---
schema_version: 1
project: Combat System
slug: combat
category: Gameplay Systems
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
confidence: medium
evidence: docs/projects/combat
gap_signal: "G30 decision recorded 2026-06-10; implementation lane open — Code Modularization Audit owns the split plan, Combat contributes invariants/tests"
protocol: living project doc set
next_step: Contribute the Combat invariants and focused regression tests (combat rules, action sequencing, reaction behavior, combat log semantics) required by the Code Modularization Audit split plan before any code movement.
agent_comments: "G30 Required Review Brief resolved 2026-06-10 (Option B): Code Modularization Audit owns the split plan; Combat's lane is invariants and preservation tests. See docs/projects/DECISION_BLITZ_2026-06-10.md D6."
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
  - scoped_tests
  - docs_consistency
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Combat System North Star

Status: active (G30 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Why This Project Exists
Combat has a live implementation split across systems, hooks, and UI surfaces that were added in different slices. This project doc keeps ownership, execution paths, and unresolved behavior gaps visible for next agents so future work does not restart discovery or collapse unfinished intent.

## Intended Outcome
Preserve a working cold-start map for the Combat domain that stays implementation-safe:

- what exists in code today,
- what is partial,
- where open gaps are located,
- what to read next without scanning the full repo.

## Dashboard Card Schema

Project: Combat System
Slug: combat
Category: Gameplay Systems
Status: active (G30 decision recorded 2026-06-10; implementation lane open)
Confidence: medium
Evidence: docs/projects/combat
Gap signal: G30 decision recorded 2026-06-10; Code Modularization Audit owns the split plan, Combat contributes invariants and tests
Protocol: living project doc set
Next step: Contribute the Combat invariants and focused regression tests required by the Code Modularization Audit split plan before any code movement.
Required verification: scoped_tests, docs_consistency
Completed verification: scoped_tests, docs_consistency
Last proof: 2026-06-09
Workflow gaps reviewed: 2026-06-09

## Project Scope (Evidence-Bound)

Evidence-verified implementation homes:

- `src/systems/combat`: combat subsystems (riders, events, penalties, OA support, sustain actions)
- `src/hooks/combat/*`: orchestration and runtime state (`useTurnManager`, `useTurnOrder`, `useActionExecutor`, `useCombatEngine`, `useCombatAI`, etc.)
- `src/utils/combat/*`: combat conversion and rules utilities (`combatUtils.ts`, `createEnemyFromMonster.ts`, `resistanceUtils.ts`, `combatAI.ts`)
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
- `useActionExecutor.ts` owns action semantics including movement legality, dash/disengage handling, OA processing, War Caster spell-option selection, Sentinel stop-in-place handling, and logging.
- `useCombatAI.ts` provides timer-driven AI state loops (`idle -> thinking -> acting -> done`) with an explicit 3-action turn cap and supports auto-controlled allies through the same turn path.
- `useCombatOutcome.ts` computes battle victory/defeat and rewards based on character HP state.
- `useTurnManager.ts`, `deathSaveUtils.ts`, and `DamageCommand.ts` now cover the death-save, unconscious, revive, and concentration-drop path that G4 used to describe as missing; the old architecture note is stale on that point.

### Combat systems (implemented, partial)

- `AttackEventEmitter.ts`, `MovementEventEmitter.ts`: emit pre/post hooks for attack and movement events.
- `AttackRiderSystem.ts`, `SavePenaltySystem.ts`: rider/payload attachment and save-penalty logic.
- `OpportunityAttackSystem.ts`: OA trigger and validation for movement steps with LoS and reaction gating.
- `SustainActionSystem.ts`: tracked sustain prompts with singleton backing storage.

### Combat UI (implemented)

- `CombatView.tsx` wires map, logs, turn manager, AI hook, rich messaging bridge, victory/defeat hooks, and encounter simulation controls.
- `useCombatLog.ts` keeps the simple combat log bounded, mirrors it to localStorage under an encounter-scoped key, and restores the same fight's history after a refresh while leaving unrelated encounters isolated.
- `ReactionPrompt.tsx` provides ARIA dialog + spell/weapon selection UI for reaction prompts, including War Caster OA spell choices.
- `EncounterModal.tsx` and `MonsterPicker.tsx` support AI/custom/bestiary encounter building and live difficulty recalculation.
- `src/components/BattleMap/CharacterToken.tsx` now exposes compact resistance, vulnerability, and immunity badges with tooltips on the 2D token perimeter, and `src/components/BattleMap/characters/CharacterActor.tsx` mirrors the same facts as a compact always-on 3D actor badge row. This slice stays intentionally scoped to the combat token/actor layers rather than widening into a renderer rewrite.

### Combat utilities (implemented, partial)

- `src/utils/combat/combatUtils.ts` converts player and monster state into combat-facing data; G11 added combat-palette generation for Barbarian Rage, Monk Flurry of Blows, Bardic Inspiration, Divine Smite, and Pact Magic.
- `src/utils/combat/actionEconomyUtils.ts` now recalculates `movement.total` from live speed modifiers at turn reset, and `src/hooks/combat/useTurnManager.ts` re-syncs that movement pool when status or active-effect updates land so temporary slows and haste-like speed changes do not drift out of date.
- `src/utils/combat/createEnemyFromMonster.ts`, `src/utils/combat/resistanceUtils.ts`, and `src/utils/combat/combatAI.ts` remain supporting utility surfaces with their own open gaps in `GAPS.md`.
- `src/utils/combat/resistanceUtils.ts` now threads live spell-zone context through damage calculation so area auras and similar map-bound defenses can affect the current hit while the target remains inside the zone.

## Known Partial / Open Areas (Evidence-Backed)

These are direct code/docs observations, not guesses:

- `TODO(lint-intent)` comments indicate testability or typing debt in `AttackRiderSystem.ts`, `SustainActionSystem.ts`, `useActionExecutor.ts`, `useCombatEngine.ts`, and `useTurnManager.ts` (unused imports/parameters, stale-closure workaround notes, singleton extraction concerns, centralization opportunities).
- Event/sustain singletons are shared via `getInstance()` and may require explicit reset hooks for strict unit isolation (noted in file comments and `Combat_Ralph.md`).
- `docs/architecture/domains/combat.md` still carries some historical omission text, so implementation behavior should be validated against code/tests rather than the stale note alone.
- `useCombatAI.ts` now has focused regression coverage for the move/ability loop cap and auto-controlled ally turns; any future per-creature AI budget tuning should be tracked as a separate follow-up.
- G11 class-feature palette generation is complete for the named classes, but downstream execution semantics may still need feature-specific command/effect work in later combat slices.

## Uncertain / Open Questions (Needs Follow-Up)

- Whether singleton-backed emitters/systems should be refactored to injectable instances before broad AI/automated combat test expansion.
- Whether reaction/OA edge cases are complete enough for non-combat-map movement paths and special conditions.
- Whether any future renderer-only defense cue should go denser than the current token/actor badge language.

## What Must Not Be Lost

- Existing split contracts (`useTurnOrder`, `useCombatEngine`, `useActionExecutor`) are active dependencies.
- 3D/2D combat rendering logic is a separate layer under `src/components/BattleMap` and should not be treated as the rule owner.
- `GLOBAL_GAPS.md` contains historical logs of cross-project tracking gaps.

## Required Review Brief

Title: Combat modularization ownership and preservation boundary
Question: Which owner should define the safe split plan for `useAbilitySystem.ts`, `useCombatEngine.ts`, and any App-shell/provider movement before G30 can proceed?

### Decision Panel

```text
G30 modularization candidate
          |
          v
large orchestration surfaces
          |
          v
ownership + test boundary needed
      /                         \
     v                           v
Combat owns                 Code Modularization
combat-engine split         Audit/Layout owns shell
     |                           |
     v                           v
Combat tests protect        Cross-project plan names
rules semantics             App/provider invariants
```

| Decision point | Option A: Combat-owned split | Option B: Cross-project modularization plan |
|---|---|---|
| Source of truth | Combat owns `useCombatEngine` split plan and names required behavior tests | Code Modularization Audit owns the split plan, with Layout owning App/provider shell movement |
| Combat responsibility | Preserve combat rules, action sequencing, reaction behavior, and combat log semantics | Provide invariants and focused regression tests before another owner moves code |
| Main risk | Combat may accidentally absorb App/spell/provider work outside its boundary | Modularization may proceed without enough combat-specific behavior protection |
| First proof after decision | Focused combat engine tests plus a small no-behavior-change extraction plan | Cross-project plan with App/provider invariants and combat regression tests named before edits |

Issue: G30 identifies `useAbilitySystem.ts`, `useCombatEngine.ts`, and `App.tsx` as large modularization candidates, but these surfaces bridge combat rules, spell/command execution, and app shell wiring.
Current behavior: All current Combat behavior gaps are closed or already verified, and G30 is the only remaining blocker.
Why blocked: Moving code before the owner boundary and test invariants are explicit could silently change combat semantics or turn a Combat pass into a broad App/Layout refactor.
Option A: Combat owns the engine split only, with `useAbilitySystem.ts` and `App.tsx` left to their owning projects.
Option B: Code Modularization Audit owns the whole split plan, with Combat contributing required invariants and tests before any movement.
Evidence: `docs/projects/combat/GAPS.md` G30; `docs/projects/code-modularization-audit/GAPS.md` CMA-G4; `src/hooks/useAbilitySystem.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/App.tsx`.
Decision owner: Human/product owner with Combat, Layout, and Code Modularization Audit owners.
Proof after decision: A named split plan that lists files allowed to move, files not allowed to move, required tests, and behavior-preservation notes before code movement starts.

### Decision (2026-06-10)

Outcome: **Option B — Code Modularization Audit owns the split plan** for `useAbilitySystem.ts` / `useCombatEngine.ts` (and any App-shell/provider movement routes through its cross-project plan). Combat's responsibility is to contribute the required invariants and focused regression tests (combat rules, action sequencing, reaction behavior, combat log semantics) before any code movement. Owner rationale: modularization is not Combat's directive.
Decider: Remy (project owner), batched decision session.
Record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D6).
Effect: the G30 review gate is lifted; Combat's implementation lane is open for the invariants/tests contribution. Code movement itself still waits for the Code Modularization Audit split plan that names files allowed to move, files not allowed to move, and the preservation tests.

## Global Gap Imports

| Global ID | Target ID | Import Date | Status | Notes |
|---|---|---|---|---|
| GG-13 | G23 | 2026-06-02 | done | Combat log state now persists per encounter through `useCombatLog.ts` and `CombatView.tsx`. |

## Active Task (Current Combat Mechanic Slice)

| Field | Value |
|---|---|
| Task | G30 decision recorded 2026-06-10 (D6): Code Modularization Audit owns the split plan; Combat's next slice is contributing the required invariants and focused regression tests before code movement. |
| Acceptance criteria | A named Combat invariants/tests contribution covering combat rules, action sequencing, reaction behavior, and combat log semantics, handed to the Code Modularization Audit split plan. |
| Allowed boundaries | Tests and invariant documentation only; do not split `useAbilitySystem.ts`, `useCombatEngine.ts`, or `App.tsx` during a normal Combat pass — code movement belongs to the Code Modularization Audit plan. |
| Stop condition | Stop after the invariants/tests contribution is recorded; do not move code until the Code Modularization Audit split plan names allowed files and preservation tests. |

## Resume Path for Cold Start

1. Read this file.
2. Read `docs/projects/combat/TRACKER.md`.
3. Read `docs/projects/combat/GAPS.md`.
4. Cross-check architecture boundaries in `docs/architecture/domains/combat.md` and `docs/architecture/COMBAT_MAP_ENGINE.md`.
5. Stop unless the Required Review Brief has been answered. Combat has no assignable implementation gap while G30 is review-required.
6. Update (2026-06-10): the Required Review Brief is answered (D6 in `docs/projects/DECISION_BLITZ_2026-06-10.md`). The assignable Combat lane is the invariants/tests contribution for the Code Modularization Audit split plan; code movement stays with that audit project.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
