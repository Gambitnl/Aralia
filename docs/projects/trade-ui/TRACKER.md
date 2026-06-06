# Trade UI Tracker

Status: active
Last updated: 2026-06-05

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
| T1 | done | Create trade-ui project docs scaffold and map from registry evidence | worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Keep updates scoped to trade-ui docs only | `docs/projects/trade-ui/NORTH_STAR.md` |
| T2 | done | Refresh docs with implementation scan of Trade UI and direct refs | worker | 2026-05-31 | `src/components/Trade`, `src/hooks/actions/handleMerchantInteraction.ts` | Review gaps and keep project intent stable | `docs/projects/trade-ui/GAPS.md` |
| T3 | active | Run next-check pass for relation points and unresolved gaps before next implementation slice | worker | 2026-05-31 | `docs/projects/trade-ui/NORTH_STAR.md` | Confirm integration assumptions with economy/economy-ui docs | Open `src/components/Trade` and `src/utils/economy/economyUtils.ts` |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | worker | `docs/projects/trade-ui/GAPS.md` | docs-only scan refresh | Normalize pricing and offer format | `docs/projects/PROJECT_TRACKER.md` | Preserves design signal from original registry row | Add concrete payload contract before buy/sell/bargain expansion | future trade pass acceptance criteria |
| G2 | active | support_needed_now | worker | `docs/projects/trade-ui/GAPS.md` | direct ref scan | HAGGLE_ITEM not reachable from merchant UI controls | `src/hooks/actions/handleMerchantInteraction.ts`, `src/components/Trade/MerchantModal.tsx` | Avoid dead capability and missing UX expectation | Add modal trigger or de-scope as explicit future work | UI behavior review before implementation |
| G3 | not_started | adjacent_follow_up | worker | `docs/projects/trade-ui/GAPS.md` | implementation review | `activeEvents` and route status union still mixed with legacy types | `src/types/economy.ts`, `src/components/Trade/MerchantModal.tsx`, `src/components/Trade/TradeRouteDashboard.tsx` | Reduces typing fragility and avoids hidden runtime assumptions | Keep compatibility mapping in one pass if touched in implementation | alignment review between economy and trade-ui owners |

## Update Rules

- Update tracker rows before starting a new implementation slice.
- Keep active rows current with owner, last updated date, next action, and proof.
- Long-lived gaps stay here only if they are owned by this project.
