# Economy System Living Tracker

Status: active
Last updated: 2026-06-08

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Status vocabulary

- not_started
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Evidence | Last updated | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh all economy docs as a concrete cold-start handoff with evidence-backed scope. | Economy docs owner | `src/systems/economy/*`, `src/state/reducers/*`, `src/components/{Economy,Trade}/*` | 2026-05-31 | Start from G1 when implementation resumes. | Confirm this update stays aligned with `PROJECT_TRACKER.md` and future implementation notes. |
| T2 | done | Add explicit exchange/rule audit check list for price, route, and trade outcomes. | Economy docs owner | `docs/projects/economy/AUDIT_OR_PROOF.md` | 2026-06-08 | Audit lane remains complete; G1 and G5 are now closed as verified. | Ledgered run set in `docs/projects/economy/AUDIT_OR_PROOF.md`: `npm exec vitest run src/utils/economy/__tests__/economyUtils.test.ts src/systems/economy/__tests__/TradeRouteManager.test.ts src/hooks/actions/__tests__/handleMerchantInteraction.test.ts src/components/Trade/__tests__/MerchantModal.test.tsx`. |
| T3 | done | Verify route-region id validity (seed routes vs region catalog) before major gameplay tuning. | Economy docs owner | `src/data/tradeRoutes.ts`, `src/data/economy/regions.ts`, `src/systems/economy/__tests__/tradeRoutesData.test.ts` | 2026-06-08 | Preserved as historical validation checkpoint; no follow-up slice added. | CI-safe validation is in `tradeRoutesData.test.ts`: `npm exec vitest run src/systems/economy/__tests__/tradeRoutesData.test.ts`. |
| T4 | done | Decide route status model for `'booming'` and remove runtime casts where possible. | Codex | `src/types/economy.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/components/Trade/TradeRouteDashboard.tsx`, `src/components/Trade/RouteCard.tsx`, `src/systems/economy/__tests__/TradeRouteManager.test.ts` | 2026-06-08 | Keep any future route status in the shared `TradeRoute` model before UI/system branches consume it. | `TradeRouteManager.test.ts` covers active->booming, booming->active, active->blockaded, and blockaded->active transitions. |
| T5 | done | Add explicit market-event representation fidelity checks for route-driven events. | Codex | `src/systems/economy/TradeRouteManager.ts`, `src/systems/economy/__tests__/TradeRouteManager.test.ts` | 2026-06-08 | G1 typing contract cleanup is done; keep contract parity checks in active economy slices. | `npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts` validates active/event/tag parity and factor derivation. |
| T6 | done | Finish G1 economy event typing contract cleanup and close event tag projection drift. | Codex | `src/types/economy.ts`, `src/systems/world/WorldEventManager.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/utils/economy/marketEvents.ts`, `src/utils/economy/economyUtils.ts`, `src/components/Trade/MerchantModal.tsx` | 2026-06-08 | Continue maintaining parity when new economy event sources are added. | `npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts src/utils/economy/__tests__/economyUtils.test.ts` |

## Tracking rules

- Update row status when proof/check status changes.
- Add only durable decisions here if they block or materially alter the implementation path.
- Raw logs and local run outputs belong to transient workflow records unless condensed into a durable proof note.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
