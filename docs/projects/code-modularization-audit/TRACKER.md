# Code Modularization Audit Living Tracker

Status: active
Last updated: 2026-06-12

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Current Queue

| ID | Status | Owner | Task | Evidence | Next proof |
|---|---|---|---|---|---|

## Status Notes

- This project is a routing and evidence project, not a cleanup mandate.
- No systems may be deleted or rewritten just because a file is large.
- Candidates tied to review-gated projects should be documented but not assigned for forward implementation until the review gate clears.
- Review-gated scope identified in this pass: CMA-G1 (Roadmap Maintenance path routing) and CMA-G4 (App/Providers/Layout/Combat split-surface cluster) are marked narrowed/routed, not assigned.
- CMA-T4 complete 2026-06-08: owner-local gap rows now exist for CMA-G1 through CMA-G7 routes. High-risk App/providers/layout/combat scope is review-gated in owner docs, not assigned for forward code movement.
- CMA-T5 complete 2026-06-08: second-tranche candidates CMA-G8 through CMA-G13 were added from the next largest human-maintained source files. Character-creator-facing scope stays review-only while that project is gated; central state/save/load scope is high-risk route-only until migration/load proof is explicit.
- CMA-T6 complete 2026-06-08: second-tranche candidates CMA-G8 through CMA-G13 are now owner-routed. These are still split-planning signals, not permission for implementation.
- CMA-T7 complete 2026-06-08: the next tranche of large human-maintained files was routed in CMA-G14 through CMA-G19. The new clusters cover `three-d-modal`, `battle-map`, `submap`, `layout`, `combat`, and `scripts-audits` and stay in routing-only posture until owners accept them.

## Next Assignment

Continue scoring new candidates only after owner projects have consumed these routes. Implementation should wait until an owning project has accepted the candidate, preserved behavior is explicit, and a focused test boundary exists. If fresh unscored large files appear before that acceptance, record them as routed candidates only; do not start source rewrites.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T2 | waiting | Monitor owner acceptance of CMA-G14..G19 candidate routes | future agent | 2026-06-10 | CMA-G14..G19 rows in GAPS.md; all six owner GAPS files now contain a stub row (not_started, adjacent_follow_up) as of iteration 6; no owner has changed status to accepted/active | Check each owner GAPS.md for a row whose status has changed from not_started to accepted/active; when one appears and the owner project is not review-gated, create a bounded owner-local split plan with preservation tests | Owner GAPS.md row status changes to accepted/active and that owner project is not review-gated |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
