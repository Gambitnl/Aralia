# Events System North Star

Status: active
Last updated: 2026-06-05

## Why This Project Exists

`src/systems/events` is used by combat and spell systems, but the owning context is sparse.
This document captures the concrete current implementation and unresolved event semantics for cold-start continuity.

## Intended Outcome

1. Preserve what is implemented today for the event system and adjacent event-driven lanes.
2. Capture integration points where event flow is already live.
3. Keep replay, priority, scheduling, and ordering gaps explicit before implementation work resumes.

## Scope

This project owns documented behavior in `src/systems/events` and first-order producers/consumers.
It does not own all simulation systems that call functions named "event" unless that coupling is needed for
event ordering or replay work.

## Current State

- Registry anchor exists in `docs/projects/PROJECT_TRACKER.md` with a gap signal for priority and replay.
- Live event bus code is small and concentrated in `src/systems/events/CombatEvents.ts`.
- `combatEvents.emit` is used by combat action flow and spell area transitions.
- `on`, `off`, and `emit` are available for runtime subscriptions, but there is no priority queue,
  pre/post phase model, or durable dispatch log in this bus.
- The current project docs now carry a compact dashboard card schema, and the open gap set remains
  evidence-backed rather than speculative.

## Dashboard Card Schema

Project: Events System
Slug: events
Category: Gameplay Systems
Status: active
Confidence: medium
Evidence: docs/projects/events
Gap signal: 5 open project gaps; 0 imported global gaps
Protocol: living project doc set
Next step: Keep the replay/scheduling gap set aligned with source evidence and preserve the proof map.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-05
Workflow gaps reviewed: 2026-06-05

## Concrete File Map

| File | Role | Evidence |
|---|---|---|
| `src/systems/events/CombatEvents.ts` | Event bus surface | singleton emitter, typed event union, listener storage |
| `src/hooks/combat/useActionExecutor.ts` | Event producers | emits move, attack, cast, and sustain events |
| `src/systems/spells/effects/AreaEffectTracker.ts` | Event producers | emits area enter/exit events |
| `src/commands/effects/ReactiveEffectCommand.ts` | Event consumer | registers listener for `unit_cast` |
| `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` | Event evidence | validates `unit_enter_area` and `unit_exit_area` emissions |
| `src/systems/combat/MovementEventEmitter.ts` | Adjacent lane | separate movement emitter with pre/post movement hooks |
| `src/systems/combat/AttackEventEmitter.ts` | Adjacent lane | separate attack emitter with pre/post attack hooks |
| `src/systems/world/WorldEventManager.ts` | Adjacent world scheduler | daily event pipeline and event logs |
| `src/state/reducers/worldReducer.ts` | Integration point | daily world-event call site via `ADVANCE_TIME` |
| `src/systems/world/__tests__/WorldEventManager.test.ts` | Event scheduling evidence | verifies daily progression and rumor spread |
| `src/state/reducers/__tests__/worldReducer.test.ts` | Integration evidence | verifies daily world event path is invoked |

## What Is Implemented Today

- `CombatEvents` defines six event types:
  - `unit_move`
  - `unit_attack`
  - `unit_cast`
  - `unit_sustain`
  - `unit_enter_area`
  - `unit_exit_area`
- `useActionExecutor` emits combat events after action resolution paths.
- `AreaEffectTracker` emits zone transition events even when zone effects are empty.
- `ReactiveEffectCommand` handles at least `on_target_cast` through `combatEvents.on('unit_cast', ...)`.
- World events are implemented separately under `src/systems/world/WorldEventManager.ts` as
  deterministic-seeded daily simulation (`processWorldEvents`) returning `{ state, logs }`.
- `worldReducer` appends those logs to `state.messages` when `ADVANCE_TIME` crosses day boundary.

## Known Gaps

- No explicit event priority or phase model; listener registration order is still the only ordering rule.
- No dispatch queue, replay log, or canonical persistence format for combat/zone event traces.
- Event lanes are split across `CombatEvents`, `MovementEventEmitter`, and `AttackEventEmitter`.
- Turn sequencing and day-event sequencing still lack a shared scheduling contract.
- Combat attack event payloads are under-specified (`unit_attack` hardcodes `isHit` and `isCrit` in action flow paths).

## Next Checks for Future Agents

1. Map event contracts in code to an explicit envelope (`type`, `priority`, `phase`, `source`, `seq`, `tick`) before any sequencing changes.
2. Decide whether combat events should flow through one centralized scheduler or remain split with an explicit bridge to daily world events and turn-order transitions.
3. Add tests that prove event order, event replay determinism, and consumer correctness across producers.

## Evidence and Proof

- `docs/projects/PROJECT_TRACKER.md` (Events System row)
- `src/systems/events/CombatEvents.ts`
- `src/hooks/combat/useActionExecutor.ts`
- `src/systems/spells/effects/AreaEffectTracker.ts`
- `src/commands/effects/ReactiveEffectCommand.ts`
- `src/systems/world/WorldEventManager.ts`
- `src/state/reducers/worldReducer.ts`
- `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`
- `src/systems/world/__tests__/WorldEventManager.test.ts`
- `src/state/reducers/__tests__/worldReducer.test.ts`

## Resume Path

1. Read this file.
2. Read `docs/projects/events/TRACKER.md` and `docs/projects/events/GAPS.md`.
3. Confirm the five existing gap rows still match source evidence and global-gap routing rules.
4. Continue from: keep the event ordering/replay contract explicit, or move to proof mapping if T3 becomes the next active slice.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
