# Naval System North Star

Status: active
Last updated: 2026-06-05

## Why This Project Exists

Naval gameplay has a partial implementation across systems, components, actions, and UI, but no one document currently preserves the in-scope intent, implemented surface area, or unresolved wiring decisions. This project file exists as the cold-start map for future work to avoid losing working naval logic while finishing voyage and encounter coupling.

## Intended Outcome

Preserve the current naval implementation as the baseline, define verified file boundaries, and keep unfinished intent visible (especially voyage progression, crew simulation, combat model, and dashboard integration). The immediate next slice is to resolve missing integration points rather than rebuild already-working pieces.

## Current State

- Core systems exist and are runnable in isolation (reducer + utilities + tests).
- UI exists for ship inspection through `src/components/Naval/ShipPane.tsx`.
- Core gaps are in orchestration: voyage events do not consistently drive combat/encounter systems, and sea travel is not hooked into movement flows.
- The dashboard-facing project card now has an explicit schema in this file, so the next agent does not have to infer card fields from prose.

## Dashboard Card Schema

Project: Naval System
Slug: naval
Category: Gameplay / World Systems
Status: partial
Confidence: high
Evidence: docs/projects/naval/NORTH_STAR.md
Gap signal: 6 open gaps; voyage coupling, combat handoff, action wiring, and legacy ownership remain unresolved.
Protocol: living project doc set
Next step: Resolve T2 by wiring sea travel into movement, routing combat handoff, and closing NAVAL_REPAIR_SHIP handling.
Required verification: scoped_tests, docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Active Task

| Field | Value |
|---|---|
| Task | Add concrete project baseline and classify unresolved naval coupling and data/flow gaps. |
| Acceptance criteria | Navy docs contain file map, state map, integration points, and prioritized unresolved items with evidence paths. |
| Allowed boundaries | `docs/projects/naval/`, read-only scan of `src/systems/naval`, `src/components/Naval`, `src/state`, `src/types`, `src/utils`, `src/data`. |
| Stop condition | Documentation captures all current naval evidence and open gaps, without adding code changes. |
| Verification | File-level evidence checks in this pass against bounded scan paths. |
| Owner | Naval System Codex Spark worker |
| Next action | Resolve gaps listed in `docs/projects/naval/GAPS.md` in the next implementation slice, especially travel-coupling and combat handoff. |

## Scope Boundaries

In scope:
- `src/systems/naval/*`
- `src/components/Naval/*`
- `src/components/layout/GameModals.tsx`
- `src/state/reducers/navalReducer.ts`
- `src/state/reducers/uiReducer.ts`
- `src/state/actionTypes.ts`
- `src/types/naval.ts`, `src/types/navalCombat.ts`
- `src/types/state.ts`, `src/initialState.ts`
- `src/utils/naval/*`
- `src/data/naval/*`, `src/data/ships.ts`, `src/data/navalManeuvers.ts`

Adjacent but not in this slice:
- Trade, encounter, world, and travel system rewrites.
- Combat UI reuse for naval fights.
- Save/load serialization compatibility for full naval progression.

Out of scope:
- Adding or balancing new crew, ship, or encounter content.
- Reworking combat architecture outside the naval namespace.

## What Must Not Be Lost

- `VoyageManager`, `CrewManager`, and `NavalCombatSystem` are independently usable units with tests.
- `src/types/naval.ts` defines canonical ship/crew/voyage contracts used by reducers and UI.
- `GameState.naval` and `GameState.ship` coupling is live in UI flow.
- `src/components/debug/DevMenu.tsx` and `uiReducer` can force naval dashboard and mock ship in dev mode.
- `src/systems/naval/Naval_Ralph.md` has historical notes about resolved features; keep it as prior intent context.

## Implemented File Map

- `src/systems/naval/CrewManager.ts`: crew generation, wage payment, morale updates, mutiny checks.
- `src/systems/naval/VoyageManager.ts`: voyage init and per-day advance simulation (distance, events, supplies, logs).
- `src/systems/naval/NavalCombatSystem.ts`: naval duel state and maneuver resolution.
- `src/systems/naval/NavalLogic.ts`: older monolithic implementation that overlaps with active voyage/crew utilities.
- `src/types/naval.ts`: canonical ship, crew, cargo, voyage types and status enums.
- `src/types/navalCombat.ts`: naval combat state, maneuver, and result types.
- `src/utils/naval/index.ts`, `src/utils/naval/navalUtils.ts`: createShip, ship stat derivation, mutiny checks, cargo/crew helpers.
- `src/utils/naval/navalCombatUtils.ts`: utility combat resolver variant.
- `src/data/ships.ts`: base ship templates.
- `src/data/naval/crewTraits.ts`: role/trait tables used by CrewManager.
- `src/data/naval/voyageEvents.ts` and `src/data/naval/voyageEvents/index.ts`: voyage random event catalogs.
- `src/state/reducers/navalReducer.ts`: action handlers for init, start/advance voyage, recruit crew, set active ship.
- `src/state/reducers/uiReducer.ts`: dashboard toggle behavior and dev injection of mock ship.
- `src/state/actionTypes.ts`: naval action type surface.
- `src/state/initialState.ts`: default `INITIAL_NAVAL_STATE`.
- `src/types/state.ts` / `src/types/state.d.ts`: `GameState.naval` plus optional `ship` pointer for dashboard display.
- `src/components/Naval/ShipPane.tsx` + `src/components/Naval/__tests__/ShipPane.test.tsx`: read-only ship dashboard UI.
- `src/components/layout/GameModals.tsx`: mounts `ShipPane` when `isNavalDashboardVisible`.
- `src/components/debug/DevMenu.tsx`: exposes `toggle_naval_dashboard`.
- Tests:
  - `src/state/reducers/__tests__/navalReducer.test.ts`
  - `src/systems/naval/__tests__/NavalCombatSystem.test.ts`
  - `src/systems/naval/__tests__/VoyageManager.test.ts`
  - `src/components/Naval/__tests__/ShipPane.test.tsx`
  - `src/utils/__tests__/navalCombatUtils.test.ts`
  - `src/utils/__tests__/navalUtils.test.ts`

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence/source | Next proof/check |
|---|---|---|---|---|
| `NAVAL_REPAIR_SHIP` action is declared in `actionTypes.ts` but not handled in `navalReducer.ts`. | support_needed_now | Worker A | `src/state/actionTypes.ts`, `src/state/reducers/navalReducer.ts` | Add reducer branch or remove contract intentionally. |
| Sea movement remains blocked by land movement logic, so voyages are not started from travel flow. | support_needed_now | Worker A | `src/hooks/actions/handleMovement.ts`, `src/state/actionTypes.ts`, `src/state/reducers/navalReducer.ts` | Dispatch naval start from transport/approach flow and define destination/route preconditions. |
| `VOYAGE_EVENTS` is duplicated in `src/data/naval/voyageEvents.ts` and `src/data/naval/voyageEvents/index.ts` with different payload behaviors. | support_needed_now | Worker A | `src/data/naval/voyageEvents.ts`, `src/data/naval/voyageEvents/index.ts` | Collapse to one source and preserve intended effects. |
| Voyage events can set `VoyageState.status` to `Combat` but no transition to combat/encounter systems exists yet. | support_needed_now | Worker A | `src/data/naval/voyageEvents/index.ts`, `src/systems/naval/VoyageManager.ts` | Wire encounter handoff to combat/relevant reducer path. |
| `NavalCombatSystem` is implemented but not invoked by active encounter or action pipeline. | adjacent_follow_up | Worker A | `src/systems/naval/NavalCombatSystem.ts`, `src/state`, `src/hooks` | Add integration path or define separate naval combat slice with explicit routing. |
| Dashboard is mostly read-only with no repair/recruit/start controls even though reducers/actions support recruit and active ship updates. | adjacent_follow_up | Worker A | `src/components/Naval/ShipPane.tsx`, `src/state/reducers/navalReducer.ts`, `src/state/actionTypes.ts` | Add command handlers or align UI to available actions. |

## Global Gap Imports

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| None yet | no | N/A | No `GLOBAL_GAPS.md` items were accepted into Naval as a direct owner item during this pass. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Fleet starts with starter ship on `NAVAL_INITIALIZE_FLEET`. | Baseline naval state bootstraps correctly when empty. | `src/state/reducers/navalReducer.ts` |
| Voyage advances update distance, supplies, crew morale, and arrival status. | Core simulation loop exists and is test covered. | `src/systems/naval/VoyageManager.ts`, `src/systems/naval/__tests__/VoyageManager.test.ts` |
| Combat resolution supports maneuver execution and cooldowns. | Naval combat engine exists but is isolated. | `src/systems/naval/NavalCombatSystem.ts`, `src/systems/naval/__tests__/NavalCombatSystem.test.ts` |
| Dashboard mounts on toggle and pulls active ship from `gameState.ship`. | Naval UI integration works for inspection. | `src/state/reducers/uiReducer.ts`, `src/components/layout/GameModals.tsx`, `src/components/Naval/ShipPane.tsx` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| `docs/projects/PROJECT_TRACKER.md` | Project registry row and global next-step signal. | active |
| `docs/projects/PROJECT_CARD_SCHEMA.md` | Shared dashboard card schema source. | active |
| `docs/projects/naval/TRACKER.md` | Active queue and bounded follow-up tracking. | active |
| `docs/projects/naval/GAPS.md` | Durable unresolved findings for this project. | active |
| `docs/projects/GLOBAL_GAPS.md` | Cross-project routing only. | active monitor |

## Artifact Boundary

Keep concrete gameplay intent and unresolved integration gaps in this project tracker. Keep raw run logs, temporary outputs, and transient debug traces outside project docs unless specifically useful for a future action.

## Open Questions

| Question | Why it matters | Owner | Needed by |
|---|---|---|---|
| Should `VOYAGE_EVENTS` be consolidated into a single catalog before adding new events? | Duplicate catalogs are still present and can drift across import paths. | Naval Worker | Before adding encounter-linked events. |
| Should voyage `Combat` status start full battle-map encounters or a dedicated naval combat reducer path? | This determines the combat handoff shape and the UI transition contract. | Naval Worker | Next implementation slice. |

## Resume Path For A Cold Agent

1. Read `docs/projects/naval/NORTH_STAR.md`.
2. Read `docs/projects/naval/TRACKER.md`.
3. Read `docs/projects/naval/GAPS.md`.
4. Read `docs/projects/PROJECT_TRACKER.md` row for naval for cross-project status.
5. Continue with T2: implement voyage + encounter coupling, then reconcile event catalog and dashboard action wiring.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- read the existing project gaps before choosing work
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
