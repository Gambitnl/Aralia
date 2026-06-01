# Logbook Tracker

Status: active
Last updated: 2026-05-31

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
| T2 | active | Carry forward Logbook gaps before implementation | Current thread | 2026-05-31 | `docs/projects/logbook/GAPS.md` | Clarify retention and pagination ownership and acceptance criteria | Review implementation slice scope |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Define retention policy for `discoveryLog` | src/state/logReducer, save/load pipeline | Prevent unbounded growth and state bloat | Define policy and implement truncation or archival path | Test load/save + clear/read behavior |
| G2 | not_started | adjacent_follow_up | Current thread | `docs/projects/logbook/GAPS.md` | Logbook scan | Add pagination plan for long discovery and dossier lists | src/components/Logbook/DiscoveryLogPane.tsx, DossierPane.tsx | Maintain usability for long sessions and low-end hardware scrolling | Define list strategy and state requirements | Inspect UX for modal list behavior under large data |

## Update Rules

- Update this tracker before each Logbook slice.
- Keep rows current with owner, evidence, next action, and next check/proof.
- Keep durable unresolved items in `docs/projects/logbook/GAPS.md` with links back here.
