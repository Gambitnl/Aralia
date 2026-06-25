# Logbook Living Tracker

Status: active
Last updated: 2026-06-25

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
| T4 | done | Define follow-up UI strategy for long Logbook lists (G2) | Codex | 2026-06-25 | `src/components/Logbook/DiscoveryLogPane.tsx`, `src/components/Logbook/DossierPane.tsx`, focused pane tests, rendered screenshots in `.agent/scratch/` | Completed: both panes page long lists in 25-item chunks with pinned controls; discovery search/filter/sort resets to page 1 | `npm exec vitest run src/components/Logbook/DiscoveryLogPane.test.tsx src/components/Logbook/DossierPane.test.tsx` passed; Playwright rendered proof passed |
| T5 | done | Decide non-location discovery dedupe policy (G3) | Codex | 2026-06-25 | `src/state/reducers/logReducer.ts`, `src/state/reducers/__tests__/logReducer.test.ts`, GAPS.md G3 | Completed: stable discoveries dedupe by durable IDs while repeatable event categories stay append-only | `npm exec vitest run src/state/reducers/__tests__/logReducer.test.ts` passed 6/6 tests |
| T6 | done | Decide dossier retention lifecycle (G4) | Codex | 2026-06-25 | `src/components/Logbook/DossierPane.tsx`, `src/state/reducers/npcReducer.ts`, `src/hooks/actions/handleWorldEvents.ts`, GAPS.md G4 | Completed: dossier retention follows the NPC memory lifecycle; the pane remains a reader over `metNpcIds` and `npcMemory` | Source-backed policy packet recorded in GAPS.md and AUDIT_OR_PROOF.md |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Define retention policy for `discoveryLog` | `src/state/reducers/logReducer.ts`, `src/services/saveLoadService.ts` | Prevent unbounded growth and state bloat | Completed: cap at 200 retained entries during add and load | Focused reducer/save-load tests passed 2026-06-19 |
| G2 | done | adjacent_follow_up | Codex | `docs/projects/logbook/GAPS.md` | Logbook scan | Add pagination plan for long discovery and dossier lists | `src/components/Logbook/DiscoveryLogPane.tsx`, `DossierPane.tsx` | Maintain usability for long sessions | Completed 2026-06-25: 25-item client-side pages with visible pinned controls in both panes | Focused tests and Playwright rendered proof passed |
| G3 | done | support_needed_now | Codex | `docs/projects/logbook/GAPS.md` | Logbook scan | Clarify dedupe rules beyond `locationId` | `src/state/reducers/logReducer.ts` | Reduce duplicate stable discovery entries without collapsing repeatable events | Completed 2026-06-25: stable discovery identities dedupe centrally, repeatable events remain append-only | Focused reducer tests passed |
| G4 | done | ownership | Codex | `docs/projects/logbook/GAPS.md` | Logbook scan | Define whether dossier data has any retention/archival lifecycle | `DossierPane.tsx` reads `metNpcIds`/`npcMemory`; `npcReducer.ts` and `handleLongRestWorldEvents` own memory mutation/aging/caps | Keeps relationship memory lifecycle in one state owner instead of adding UI-level pruning | Completed 2026-06-25: dossier entries remain a view over NPC memory; retention belongs to NPC memory lifecycle | Source scan policy proof recorded; no code change required |
| G5 | done | in_scope_now | Current thread | `docs/projects/logbook/GAPS.md` | Iteration 2 (2026-06-10) | Fix unread count drift on quest updates | `src/state/reducers/logReducer.ts` UPDATE_QUEST_IN_DISCOVERY_LOG | Unread badge unreliable | Completed: quest updates recount unread discovery entries after mutation | Unit test confirms every read-to-unread quest entry is counted |
| G6 | done | adjacent_follow_up | Codex | `docs/projects/logbook/GAPS.md` | Iteration 2 (2026-06-10) | Quest update content accumulated without bounds | `src/state/reducers/logReducer.ts` | Save bloat and render perf | Completed 2026-06-25: kept base quest discovery content and capped appended update notes to the newest 10 | `npm exec vitest run src/state/reducers/__tests__/logReducer.test.ts` passes 4/4 tests |

## Update Rules

- Update this tracker before each Logbook slice.
- Keep rows current with owner, evidence, next action, and next check/proof.
- Keep durable unresolved items in `docs/projects/logbook/GAPS.md` with links back here.
