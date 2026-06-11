# Economy System Gap Registry

Status: active
Last updated: 2026-06-08

Use this file for durable unresolved findings that are required to preserve meaningful continuity.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Economy docs owner | `docs/projects/economy/TRACKER.md` | Economy source pass | `activeEvents` was typed as `unknown[]` and route/event logic relied on event-name parsing for affected categories. | `src/types/economy.ts`, `src/systems/world/WorldEventManager.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/utils/economy/economyUtils.ts`, `src/utils/economy/marketEvents.ts` | Event contracts are now enforced as `MarketEvent` with explicit `affectedTags`/`affectedCategories` where available, and legacy name parsing is retained only as fallback. | Keep source-backed migration to `affectedTags` first-class usage and preserve event-factor parity across route/event projections. | Add/keep regression tests showing route events and pricing consume typed event tags consistently. |
| G2 | done | support_needed_now | Codex | `docs/projects/economy/TRACKER.md` | Economy source pass | `'booming'` status is now part of the canonical `TradeRoute['status']` union and local runtime/UI casts were removed. | `src/types/economy.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/components/Trade/TradeRouteDashboard.tsx`, `src/components/Trade/RouteCard.tsx`, `src/systems/economy/__tests__/TradeRouteManager.test.ts` | Route boom behavior is now visible to TypeScript consumers instead of surviving through string casts. | Keep future route states in the shared type before UI/system branches use them. | Regression proof: `npm exec vitest run src/systems/economy/__tests__/TradeRouteManager.test.ts`. |
| G3 | done | adjacent_follow_up | Economy docs owner | `docs/projects/economy/TRACKER.md` | Economy source pass | Initial seed routes were invalid against `REGIONAL_ECONOMIES`. | `src/data/tradeRoutes.ts`, `src/data/economy/regions.ts`, `src/systems/economy/__tests__/tradeRoutesData.test.ts` | Route scoring and regional modifier updates can dereference missing region records. | Seed route IDs were repaired in `tradeRoutes.ts`; keep a regression assertion on startup/CI. | `npm exec vitest run src/systems/economy/__tests__/tradeRoutesData.test.ts` |
| G4 | done | support_needed_now | Economy docs owner | `docs/projects/economy/AUDIT_OR_PROOF.md` | Economy source pass | Exchange/rule audit scope lacks a durable pass/fail ledger for pricing inputs, route transitions, and merchant outcomes. | `src/utils/economy/economyUtils.ts`, `src/systems/economy/TradeRouteManager.ts`, `src/hooks/actions/handleMerchantInteraction.ts`, `src/components/Trade/__tests__/MerchantModal.test.tsx`, `src/utils/economy/__tests__/economyUtils.test.ts`, `src/systems/economy/__tests__/TradeRouteManager.test.ts`, `src/hooks/actions/__tests__/handleMerchantInteraction.test.ts` | This was blocking meaningful continuation because pass criteria were not explicitly codified for T2 audit handoff. | Keep ledgered audit checks alive in `docs/projects/economy/AUDIT_OR_PROOF.md` and preserve failure notes there before moving to `G5`. | `docs/projects/economy/AUDIT_OR_PROOF.md` (2026-06-08) with `npm run projects:audit`, `npm exec vitest run src/utils/economy/__tests__/economyUtils.test.ts src/systems/economy/__tests__/TradeRouteManager.test.ts src/hooks/actions/__tests__/handleMerchantInteraction.test.ts src/components/Trade/__tests__/MerchantModal.test.tsx`. |
| G5 | done | adjacent_follow_up | Economy docs owner | `docs/projects/PROJECT_TRACKER.md` | Economy source pass | `marketEvents`, `activeEvents`, and `marketFactors` were maintained separately and route tags were derived heuristically from event names. | `src/systems/economy/TradeRouteManager.ts`, `src/systems/world/WorldEventManager.ts`, `src/utils/economy/marketEvents.ts` | Parallel representations risked drift if event-name formats changed across readers. | Keep one tag source by storing canonical route tags and deriving `marketFactors` through shared `calculateMarketFactors`. | `TradeRouteManager.test.ts` proves `activeEvents === marketEvents` and `marketFactors === calculateMarketFactors(marketEvents)`. |

## Classification

- support_needed_now: blocks reliable continuation or acceptance confidence.
- adjacent_follow_up: useful for quality, not required for first safe continuation.
- blocked_human_decision: needs an owner decision.
- blocked_external_state: blocked on external dependencies.

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
