# Logbook Living Tracker

Status: active
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh Logbook project docs (NORTH_STAR/TRACKER/GAPS) after implementation scan | Current thread | 2026-05-31 | `docs/projects/logbook/*.md` | None for this docs pass | Confirm new docs include scope, file map, state, integrations, gaps |
| T2 | done | Carry forward Logbook gaps before implementation | Current thread | 2026-06-10 | `docs/projects/logbook/GAPS.md` (G1-G6), `docs/projects/logbook/NORTH_STAR.md` | Implementation slice for G1 defined; G5 identified as co-priority bug | Implement G1 retention policy in logReducer + saveLoadService | Unit test for cap + unread count adjustment |
| T3 | active | Implement discovery log retention policy (G1) and fix unread count drift (G5) | Current thread | 2026-06-10 | `src/state/reducers/logReducer.ts`, `src/services/saveLoadService.ts` | Add MAX_DISCOVERY_LOG_ENTRIES constant, slice after prepend, fix unread drift in UPDATE_QUEST_IN_DISCOVERY_LOG | Run unit tests for retention cap, unread accuracy, and save/load round-trip |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Define retention policy for `discoveryLog` | `src/state/reducers/logReducer.ts`, `src/services/saveLoadService.ts` | Prevent unbounded growth and state bloat | Implementation slice defined in GAPS.md; implement next | Test load/save + clear/read behavior |
| G2 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Add pagination plan for long discovery and dossier lists | `src/components/Logbook/DiscoveryLogPane.tsx`, `DossierPane.tsx` | Maintain usability for long sessions | Define list strategy and state requirements | Inspect UX for modal list behavior under large data |
| G5 | not_started | in_scope_now | Current thread | `docs/projects/logbook/GAPS.md` | Iteration 2 (2026-06-10) | Fix unread count drift on quest updates | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG | Unread badge unreliable | Fix increment logic | Unit test for quest update unread accuracy |
| G6 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/GAPS.md` | Iteration 2 (2026-06-10) | Quest update content accumulates without bounds | `src/state/reducers/logReducer.ts` | Save bloat and render perf | Define cap or structured update log | Verify save size for 50+ updates |

## Update Rules

- Update this tracker before each Logbook slice.
- Keep rows current with owner, evidence, next action, and next check/proof.
- Keep durable unresolved items in `docs/projects/logbook/GAPS.md` with links back here.
