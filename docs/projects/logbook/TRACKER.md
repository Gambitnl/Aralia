# Logbook Living Tracker

Status: active
Last updated: 2026-06-19

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
| T3 | done | Implement discovery log retention policy (G1) and fix unread count drift (G5) | Current thread | 2026-06-19 | `src/state/reducers/logReducer.ts`, `src/state/reducers/__tests__/logReducer.test.ts`, `src/services/saveLoadService.ts`, `src/services/__tests__/saveLoadService.test.ts` | Completed: added `MAX_DISCOVERY_LOG_ENTRIES = 200`, runtime prune, load-time prune, and quest unread recount | `npm test -- --run src/state/reducers/__tests__/logReducer.test.ts src/services/__tests__/saveLoadService.test.ts` passed 28 tests |
| T4 | not_started | Define follow-up UI strategy for long Logbook lists (G2) | Future thread | 2026-06-19 | `src/components/Logbook/DiscoveryLogPane.tsx`, `src/components/Logbook/DossierPane.tsx` | Decide pagination/windowing model without changing retention behavior | Validate sort/filter/read workflows against a large retained list |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Define retention policy for `discoveryLog` | `src/state/reducers/logReducer.ts`, `src/services/saveLoadService.ts` | Prevent unbounded growth and state bloat | Completed: cap at 200 retained entries during add and load | Focused reducer/save-load tests passed 2026-06-19 |
| G2 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Add pagination plan for long discovery and dossier lists | `src/components/Logbook/DiscoveryLogPane.tsx`, `DossierPane.tsx` | Maintain usability for long sessions | Define list strategy and state requirements | Inspect UX for modal list behavior under large data |
| G5 | done | in_scope_now | Current thread | `docs/projects/logbook/GAPS.md` | Iteration 2 (2026-06-10) | Fix unread count drift on quest updates | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG | Unread badge unreliable | Completed: quest updates recount unread discovery entries after mutation | Unit test confirms every read-to-unread quest entry is counted |
| G6 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/GAPS.md` | Iteration 2 (2026-06-10) | Quest update content accumulates without bounds | `src/state/reducers/logReducer.ts` | Save bloat and render perf | Define cap or structured update log | Verify save size for 50+ updates |

## Update Rules

- Update this tracker before each Logbook slice.
- Keep rows current with owner, evidence, next action, and next check/proof.
- Keep durable unresolved items in `docs/projects/logbook/GAPS.md` with links back here.
