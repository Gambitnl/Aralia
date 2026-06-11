# Item Categorization Living Tracker
Status: review-required
Last updated: 2026-06-08

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

## Confirmed Completed
- `[done]` Category ingestion for Equipment adds `itemType` tags and `itemMetadata` in `scripts/ingestPhbGlossary.ts`.
- `[done]` `itemMetadata` type-surface drift between `src/types/ui.ts` and `src/types/ui.d.ts` is resolved.
- `[done]` Build-time Equipment hierarchy is emitted in `scripts/generateGlossaryIndex.js` as `subEntries` buckets.
- `[done]` Engine item data pipeline exists: `scripts/generateItemRegistry.ts` writes `src/data/items/generatedGlossaryItems.ts`.
- `[done]` Generated glossary items are merged into `ALL_ITEMS` in `src/data/items/index.ts`.
- `[done]` Existing glossary UI supports nested nodes and recursive searches (`src/components/Glossary/GlossarySidebar.tsx`, `src/components/Glossary/glossaryRuleChapters.ts`, `src/components/Glossary/hooks/useGlossarySearch.ts`).
- `[done]` Dev-mode glossary index rebuild trigger is wired in Vite and calls `node scripts/generateGlossaryIndex.js` (`vite.config.ts` + `Glossary.tsx`).

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
| T1 | active | Normalize this tracker to the living-project workflow contract | future agent | 2026-06-10 | docs/projects/PROJECT_CARD_SCHEMA.md; docs/agent-workflows/living-project-task-protocol/templates/LIVING_TRACKER.md | Replace this seeded row with the current real project task during the next iteration | Project tracker has at least one current active/waiting/done row with evidence and next proof |

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
