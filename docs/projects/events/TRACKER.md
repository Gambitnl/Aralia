# Events System Living Tracker

Status: active
Last updated: 2026-05-31

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Capture source-backed events-system map and ownership boundary in this living folder. | Worker A | 2026-05-31 | `docs/projects/events/NORTH_STAR.md`, `docs/projects/PROJECT_TRACKER.md` | Populate concrete gap rows from implementation evidence. | Confirm file map and integration points in this folder are complete. |
| T2 | active | Define and document replay/scheduling gaps for `src/systems/events` and adjacent combat event lanes. | Worker A | 2026-05-31 | `src/systems/events/CombatEvents.ts`, `src/hooks/combat/useActionExecutor.ts`, `src/systems/spells/effects/AreaEffectTracker.ts`, `src/systems/world/WorldEventManager.ts`, `src/state/reducers/worldReducer.ts` | Add 3-5 evidence-backed gap rows in `docs/projects/events/GAPS.md` and a sequence-aware next check list. | Confirm gaps include event priority, dispatch ordering, and replay persistence scope. |
| T3 | active | Add implementation-ready test plan for event semantics verification. | Worker A | 2026-05-31 | `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`, `src/systems/world/__tests__/WorldEventManager.test.ts`, `src/state/reducers/__tests__/worldReducer.test.ts` | Add next-check checklist in TRACKER and map each check to test files or new test files. | Add explicit proofs for event order, replay trace, and consumer registration behavior. |

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | support_needed_now | Worker A | `docs/projects/events/GAPS.md` | Source scan | No explicit event priority/phase model in `combatEvents`. | `src/systems/events/CombatEvents.ts` | Producer ordering is ambiguous for future deterministic replays and deterministic UI sequencing. | Define event priority and phase semantics before feature work changes event flow. | Add unit tests for deterministic listener ordering and stable dispatch order. |
| G2 | not_started | support_needed_now | Worker A | `docs/projects/events/GAPS.md` | Source scan | No replay persistence for combat/zone events. | `src/hooks/combat/useActionExecutor.ts`, `src/systems/spells/effects/AreaEffectTracker.ts` | Without persisted event traces, combat replay and bug-forensics lack deterministic reconstruction. | Define `event_trace` schema, serialization, and capture boundary before replay tooling. | Add round-trip replay test using fixed seed and known trace fixture. |
| G3 | not_started | in_scope_now | Worker A | `docs/projects/events/GAPS.md` | Source scan + integration map | Event systems are split across `CombatEvents`, `MovementEventEmitter`, and `AttackEventEmitter` with different lifecycles. | `src/systems/events/CombatEvents.ts`, `src/systems/combat/MovementEventEmitter.ts`, `src/systems/combat/AttackEventEmitter.ts` | Parallel event buses increase coordination risk for order, duplicates, and maintenance drift. | Decide if cross-lane unification is required and define migration path. | Update architecture note and add compatibility tests for all lanes. |
| G4 | not_started | adjacent_follow_up | Worker A | `docs/projects/events/GAPS.md` | Source scan | `useTurnOrder` lacks replay capture for turn transitions, and world simulation has its own day scheduler. | `src/hooks/combat/useTurnOrder.ts`, `src/systems/world/WorldEventManager.ts`, `src/state/reducers/worldReducer.ts` | Turn sequencing and day-event sequencing are separate with no shared event schedule contract. | Decide ownership boundary for scheduling before adding cross-system scheduler work. | Add test linking turn transition event stream with daily simulation checkpoints. |
| G5 | not_started | support_needed_now | Worker A | `docs/projects/events/GAPS.md` | Test scan | `unit_attack` payload drops hit/critical fidelity in emitted event path. | `src/hooks/combat/useActionExecutor.ts`, `src/utils/combat/combatLogToMessageAdapter.ts` | Downstream logging/messaging cannot infer critical outcomes from bus events. | Update bus event payload contracts and adapt downstream consumers. | Add regression test for critical-hit metadata flow end-to-end. |
