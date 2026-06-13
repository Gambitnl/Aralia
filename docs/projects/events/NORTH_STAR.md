---
schema_version: 1
project: Events System
slug: events
category: Gameplay Systems
main_category: "Game & Simulation"
subcategory: Core Sim Systems
status: active
last_updated: 2026-06-12
iteration: 4
confidence: medium
evidence: docs/projects/events
gap_signal: "2 open gaps; G3 and G4 remain open after split-lane bridge decision"
protocol: living project doc set
next_step: Write the explicit compatibility envelope for the split event lanes with documented combat_turn / world_day markers (no shared scheduler this cycle), then add ordering/marker proof tests.
agent_comments: "G3/G4 Required Review Brief resolved 2026-06-10: keep the split lanes and document the bridge. See docs/projects/DECISION_BLITZ_2026-06-10.md D8."
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs_consistency
completed_verification:
  - docs_consistency
last_proof: 2026-06-08
workflow_gaps_reviewed: 2026-06-08
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Events System North Star

Status: active (G3/G4 decision recorded 2026-06-10; implementation lane open)
Last updated: 2026-06-12

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
- `on`, `off`, and `emit` support explicit phase and priority ordering, and the bus now captures a canonical replay trace with snapshot/restore helpers.
- `useTurnOrder`, `MovementEventEmitter`, `AttackEventEmitter`, and the world day scheduler still live on separate lanes, so any shared compatibility contract remains a review decision rather than an implementation detail.
- `WorldEventManager` returns richer daily-simulation state than `worldReducer`, and the reducer now preserves that full output at the boundary instead of forwarding only a subset.
- The current project docs now carry a compact dashboard card schema, and the open gap set remains
  evidence-backed rather than speculative.

## Dashboard Card Schema

Project: Events System
Slug: events
Category: Gameplay Systems
Status: active (G3/G4 decision recorded 2026-06-10; implementation lane open)
Confidence: medium
Evidence: docs/projects/events
Gap signal: G3/G4 decided 2026-06-10 (keep split lanes; document the bridge); G1/G2/G5/G6 resolved 2026-06-08
Protocol: living project doc set
Next step: Write the explicit compatibility envelope for the split event lanes with documented `combat_turn` / `world_day` markers (no shared scheduler this cycle), then add ordering/marker proof tests.
Required verification: docs_consistency
Completed verification: docs_consistency
Last proof: 2026-06-08
Workflow gaps reviewed: 2026-06-08

## Required Review Brief

Decision needed: choose the event-lane contract before assigning forward implementation work.

Issue: G3 and G4 are blocked on whether `CombatEvents`, movement/attack emitters, turn sequencing, and world-day scheduling remain separate lanes with an explicit bridge or converge on a shared scheduler/marker contract.

Why agents stop: implementation would otherwise encode a cross-system ordering policy without owner approval.

Decision owner: human/product owner with combat and world-system owners.

Options:
- Keep the split lanes and document the compatibility envelope.
- Build a shared scheduler bridge with explicit `combat_turn` and `world_day` markers.

Evidence: `src/systems/events/CombatEvents.ts`, `src/systems/combat/MovementEventEmitter.ts`, `src/systems/combat/AttackEventEmitter.ts`, `src/hooks/combat/useTurnOrder.ts`, `src/systems/world/WorldEventManager.ts`, and `src/state/reducers/worldReducer.ts`.

After decision: update G3/G4 with the selected contract, then add ordering and marker proof tests before assigning implementation.

### Decision (2026-06-10)

Outcome: **Keep the split lanes; document the bridge.** `CombatEvents`, `MovementEventEmitter`, `AttackEventEmitter`, turn sequencing, and world-day scheduling stay separate lanes. The project writes an explicit compatibility envelope with documented `combat_turn` / `world_day` markers. No shared scheduler is built this cycle.
Decider: Remy (project owner) with combat and world-system context, batched decision session.
Record: `docs/projects/DECISION_BLITZ_2026-06-10.md` (D8).
Effect: the G3/G4 review gate is lifted. Next slice: write the compatibility-envelope documentation (lane boundaries, ordering assumptions, and the `combat_turn` / `world_day` marker contract), then add the ordering and marker proof tests named in the brief.

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
| `src/state/reducers/worldReducer.ts` | Integration point | daily world-event call site via `ADVANCE_TIME`, now preserving the full daily simulation result |
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
- `worldReducer` now preserves the full daily world result and still appends those logs to `state.messages` when `ADVANCE_TIME` crosses day boundary.

## Known Gaps

- Replay traces now have a canonical in-memory snapshot/restore contract, but durable storage and retention policy still live outside this bus.
- Event lanes are split across `CombatEvents`, `MovementEventEmitter`, and `AttackEventEmitter`, and the split still needs an owner-approved compatibility contract.
- Turn sequencing and day-event sequencing still lack an explicit marker contract.
- Future non-opportunity attack producers still need to avoid fake hit/crit metadata unless their roll source is structured.

## Next Checks for Future Agents

1. Keep the explicit envelope idea (`type`, `priority`, `phase`, `source`, `seq`, `tick`) as a review-only candidate until the owner decides whether the split lanes stay split.
2. Decide whether combat events should flow through one centralized scheduler or remain split with an explicit bridge to daily world events and turn-order transitions.
3. Add tests that prove event order, replay snapshot round-tripping, consumer correctness across producers, and keep the daily-world merge regression in place.
4. Update (2026-06-10): items 1 and 2 are decided â€” the lanes stay split and the explicit envelope is now the approved documentation target, including `combat_turn` / `world_day` markers (DECISION_BLITZ D8). Item 3's ordering/marker proof tests are the follow-on slice.

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
3. Confirm the remaining open gap rows still match source evidence and global-gap routing rules.
4. Continue from G3/G4 review work; G6 reducer merge proof is complete, so do not assign G3/G4 implementation until the split-lane and turn/day marker decisions are approved.
5. Update (2026-06-10): the split-lane and marker decisions are approved (keep split lanes; document the bridge â€” DECISION_BLITZ D8). G3/G4 are open for the compatibility-envelope documentation and marker proof tests.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
