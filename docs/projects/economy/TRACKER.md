# Economy System Living Tracker

Status: active
Last updated: 2026-06-05

## Status vocabulary

- not_started
- active
- waiting
- blocked
- done
- superseded
- out_of_scope

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Last updated | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh all economy docs as a concrete cold-start handoff with evidence-backed scope. | Economy docs owner | `src/systems/economy/*`, `src/state/reducers/*`, `src/components/{Economy,Trade}/*` | 2026-05-31 | Start from G1 when implementation resumes. | Confirm this update stays aligned with `PROJECT_TRACKER.md` and future implementation notes. |
| T2 | not_started | Add explicit exchange/rule audit check list for price, route, and trade outcomes. | Economy docs owner | `docs/projects/PROJECT_TRACKER.md` | 2026-05-31 | Add one small audit slice in `TRACKER.md` and `GAPS.md` with pass criteria. | Run target test and evidence checks documented in G4. |
| T3 | active | Verify route-region id validity (seed routes vs region catalog) before major gameplay tuning. | Economy docs owner | `src/data/tradeRoutes.ts`, `src/data/economy/regions.ts` | 2026-06-05 | Resume with deterministic route-region validation and repair invalid seed mappings. | Keep a CI-safe assertion in a unit or startup test that every seed route id resolves to a region entry. |
| T4 | active | Decide route status model for `'booming'` and remove runtime casts where possible. | Economy docs owner | `src/systems/economy/TradeRouteSystem.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/types/economy.ts` | 2026-06-05 | Add shared status union and update UI/system consumers together. | Add regression test for route status transitions in existing route manager/system tests. |

## Tracking rules

- Update row status when proof/check status changes.
- Add only durable decisions here if they block or materially alter the implementation path.
- Raw logs and local run outputs belong to transient workflow records unless condensed into a durable proof note.
