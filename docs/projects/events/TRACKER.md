# Events System Living Tracker

Status: active (G3/G4 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-10

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Capture source-backed events-system map and ownership boundary in this living folder. | Worker A | 2026-05-31 | `docs/projects/events/NORTH_STAR.md`, `docs/projects/PROJECT_TRACKER.md` | Populate concrete gap rows from implementation evidence. | Confirm file map and integration points in this folder are complete. |
| T2 | active | Define and document remaining cross-lane scheduling gaps for `src/systems/events` and adjacent combat event lanes. | Worker A | 2026-06-10 | `src/systems/events/CombatEvents.ts`, `src/systems/events/__tests__/CombatEvents.test.ts`, `src/hooks/combat/useActionExecutor.ts`, `src/systems/spells/effects/AreaEffectTracker.ts`, `src/systems/world/WorldEventManager.ts`, `src/state/reducers/worldReducer.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D8 | Lane-contract review resolved 2026-06-10 (keep split lanes; document the bridge). Write the compatibility envelope with `combat_turn` / `world_day` marker documentation, then add ordering/marker proof tests. | Compatibility-envelope doc exists and sequencing/marker proof tests cover the documented contract. |
| T3 | active | Add implementation-ready test plan for event semantics verification. | Worker A | 2026-06-05 | `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`, `src/systems/world/__tests__/WorldEventManager.test.ts`, `src/state/reducers/__tests__/worldReducer.test.ts`, `src/systems/events/__tests__/CombatEvents.test.ts` | Map each check to test files or new test files and keep the proof list tied to the reviewed event lanes only. | Add explicit proofs for event order, replay snapshot round-tripping, consumer registration behavior, and keep the daily-merge boundary regression in place. |

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
| G1 | done | support_needed_now | Worker A | `docs/projects/events/GAPS.md` | Source scan and implementation | Explicit listener phase/priority model now exists in `combatEvents`. | `src/systems/events/CombatEvents.ts`, `src/systems/events/__tests__/CombatEvents.test.ts` | Producer ordering is now explicit with deterministic ordering semantics by phase, priority, and registration order. | Keep the current ordering contract documented and monitor consumer callers for `phase`/`priority` usage. | `src/systems/events/__tests__/CombatEvents.test.ts` |
| G2 | done | support_needed_now | Worker A | `docs/projects/events/GAPS.md` | Source scan plus emitter round-trip implementation | Combat events lacked a replay snapshot/restore contract. | `src/systems/events/CombatEvents.ts`, `src/systems/events/__tests__/CombatEvents.test.ts` | Without a serializable event trace, combat replay and bug-forensics cannot bootstrap deterministically. | Keep the snapshot/restore contract documented and route remaining cross-lane scheduling work to G3/G4. | `npx vitest run src/systems/events/__tests__/CombatEvents.test.ts` (5 tests passed). |
| G3 | not_started | in_scope_now | events owner (decision: Remy 2026-06-10) | `docs/projects/events/GAPS.md` | Source scan + integration map | Event systems are split across `CombatEvents`, `MovementEventEmitter`, and `AttackEventEmitter` with different lifecycles and no shared compatibility envelope. Decided 2026-06-10: keep the split; document the bridge (DECISION_BLITZ D8). | `src/systems/events/CombatEvents.ts`, `src/systems/combat/MovementEventEmitter.ts`, `src/systems/combat/AttackEventEmitter.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D8 | Parallel event buses increase coordination risk for order, duplicates, and maintenance drift. | Write the explicit compatibility envelope documenting lane boundaries and ordering assumptions; no shared scheduler this cycle. | Compatibility-envelope contract note plus compatibility tests for all lanes. |
| G4 | not_started | in_scope_now | events owner (decision: Remy 2026-06-10) | `docs/projects/events/GAPS.md` | Source scan | `useTurnOrder` lacks replay capture for turn transitions, and world simulation has its own day scheduler. Decided 2026-06-10: keep the lanes separate with a documented bridge; standardize documented `combat_turn` / `world_day` markers (DECISION_BLITZ D8). | `src/hooks/combat/useTurnOrder.ts`, `src/systems/world/WorldEventManager.ts`, `src/state/reducers/worldReducer.ts`, `docs/projects/DECISION_BLITZ_2026-06-10.md` D8 | Turn sequencing and day-event sequencing are separate with no shared marker contract. | Document the `combat_turn` / `world_day` marker contract as part of the compatibility envelope. | Add a shared proof test linking a turn advance with `ADVANCE_TIME` under the documented marker contract. |
| G5 | done | support_needed_now | Worker A / Codex | `docs/projects/events/GAPS.md` | Test scan + implementation | `unit_attack` payload dropped hit/critical fidelity in emitted opportunity-attack path. | `src/hooks/combat/useActionExecutor.ts`, `src/systems/events/CombatEvents.ts`, `src/utils/combat/combatLogToMessageAdapter.ts`, `src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts` | Opportunity-attack event/log data now carries real hit/crit metadata, and the rich combat-message adapter maps structured crits to `CRITICAL_HIT`. | Keep future attack producers honest by omitting metadata unless it is real; cross-lane scheduling remains G3/G4. | `npx vitest run src/hooks/combat/__tests__/useActionExecutor.test.ts src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts src/systems/events/__tests__/CombatEvents.test.ts` (14 tests passed). |
| G6 | done | support_needed_now | Worker A | `docs/projects/events/GAPS.md` | Source scan of day scheduler merge path | `worldReducer` now preserves the full `processWorldEvents` state output at the reducer boundary, so economy, active rumors, dynamic NPCs, history, and courier outputs survive `ADVANCE_TIME`. | `src/systems/world/WorldEventManager.ts`, `src/state/reducers/worldReducer.ts`, `src/state/reducers/__tests__/worldReducer.test.ts` | Daily world-simulation output no longer disappears at the reducer boundary, so the world-day proof surface stays intact while G3/G4 remain review-blocked. | Keep the full daily merge contract documented and leave the split-lane marker decision to G3/G4. | `npx vitest run src/state/reducers/__tests__/worldReducer.test.ts src/systems/world/__tests__/WorldEventManager.test.ts` (9 tests passed). |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
