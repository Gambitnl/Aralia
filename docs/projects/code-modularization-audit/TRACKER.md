# Code Modularization Audit Tracker

Status: active
Last updated: 2026-06-08

## Current Queue

| ID | Status | Owner | Task | Evidence | Next proof |
|---|---|---|---|---|---|
| CMA-T1 | done | Codex coordinator | Create the living project and seed the initial line-count candidate list. | `NORTH_STAR.md`; `GAPS.md`; line-count scan 2026-06-08 | `npm run projects:audit` prompt/schema summary |
| CMA-T2 | done | next agent | Score the top human-maintained candidates by coupling, owner, test boundary, and split safety. | `GAPS.md` rows CMA-G1 through CMA-G6 | Scored owner-routing matrix captured in `GAPS.md` |
| CMA-T3 | done | next agent | Decide whether generated/corpus-heavy files need generator sharding gaps rather than modularization rows. | `src/data/monsters.generated.ts`; `src/data/items/generatedGlossaryItems.ts` | Generated-data policy note and routing decision captured in `GAPS.md` |
| CMA-T4 | done | Codex coordinator | Refresh owning project trackers/gaps with routing outcomes and keep this project in scoring-only posture until owners own implementation. | Routes recorded 2026-06-08 in `roadmap-maintenance`, `glossary-ui`, `design-preview`, `battle-map`, `submap`, `creatures`, `item_categorization`, `providers`, `layout`, and `combat`. | Owner-local gap rows exist before any forward code movement |
| CMA-T5 | done | Codex coordinator | Add second-tranche source-size candidates after the initial routes were propagated. | `rg --files src` line-count scan 2026-06-08; `GAPS.md` rows CMA-G8 through CMA-G13 | Second tranche is recorded as candidates/routing signals, not implementation approval |
| CMA-T6 | done | Codex coordinator | Propagate second-tranche candidates into owner-local project gaps. | CMA-G8 through CMA-G13 rows plus owner docs: character-creator, character-sheet, spells, saveload, party-ui, glossary-ui, companions, dialogue, conversation-panel, crafting, crafting-ui | Owner-local gap rows exist before any code movement |
| CMA-T7 | done | Codex coordinator | Scan the next tranche of large human-maintained source files and route the best modularization candidates without source edits. | `GAPS.md` rows CMA-G14 through CMA-G19; line-count scan 2026-06-08 | Owner acceptance and future split plans for the new clusters |

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
