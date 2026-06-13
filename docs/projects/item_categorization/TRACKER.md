# Item Categorization Living Tracker
Status: review-required
Last updated: 2026-06-12

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Active Work
- `[review-required]` Decide whether and how to represent 5e `itemGroup`-style grouping in this pipeline; next proof is a taxonomy decision or migration note.

## Remaining Work
- `[open]` Verify semantic completeness of mechanical mapping in `scripts/generateItemRegistry.ts` (type heuristics and conversions).
- `[open]` Add or document a canonical `generateGlossaryIndex` run command path in project scripts.
- `[open]` Confirm whether the empty `public/data/glossary/entries/magic_items` directory is expected or stale.
- `[open]` Watch for divergence between `src/utils/itemAdapter.ts` and `scripts/generateItemRegistry.ts` as alternate item-conversion paths.

## Discovered Gaps
- See `GAPS.md` for the evidence-backed set tied to this project.

## Blockers
- Human/product taxonomy decision required for `itemGroup` semantics before any forward implementation path is chosen.

## Resume Notes
- Start with the Required Review Brief in `NORTH_STAR.md` and wait for the taxonomy decision.
- Use `GAPS.md` and `DECISIONS.md` for the current canonical stance and the blocked gap details.
- After the review lands, revisit the command-path gap and the remaining item-registry validation work only if the decision chooses a concrete implementation path.

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | review-required | Resolve itemGroup taxonomy decision before forward implementation | Human/product taxonomy owner | 2026-06-12 | `NORTH_STAR.md` Required Review Brief; `GAPS.md` IC-G2; `DECISIONS.md` item grouping taxonomy | Decide whether `itemGroup` becomes first-class grouping metadata or remains source-only. | Decision recorded in `DECISIONS.md`; update IC-G2 and choose/defer implementation path. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
