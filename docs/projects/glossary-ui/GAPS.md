# Glossary UI Gaps

Status: active  
Last updated: 2026-06-05

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Worker | TRACKER.md | Docs update pass | Non-dev glossary rebuild and index refresh contract is not standardized for non-dev flows. | `vite.config.ts`, `scripts/bundle-static-data.ts`, `scripts/generateGlossaryIndex.js` | Without a stable contract, manual source updates can leave stale index state in non-dev workflows. | Document the stable refresh command in `NORTH_STAR.md` and keep the bundle proof path named in `TRACKER.md`. | Run the documented command sequence and verify generated `public/data/glossary_bundle.json` hash changes. |
| G2 | not_started | adjacent_follow_up | Worker | `docs/projects/item_categorization` | docs/tasks scan | Equipment taxonomy uses source `itemType` labels directly, while category wording and normalization are still implementation-derived. | `scripts/generateGlossaryIndex.js`, `scripts/ingestPhbGlossary.ts`, `docs/projects/item_categorization/GAPS.md` | UX and search consistency can drift if taxonomy labels change in ingestion without glossary UI updates. | Sync wording rules with item-categorization owners before changing grouping behavior. | Confirm a shared canonical group naming decision and migration note. |
| G3 | not_started | support_needed_now | Worker | `scripts/generateItemRegistry.ts`, `src/types/ui.ts` | Runtime docs scan | `itemMetadata` and item-derived fields can diverge between source ingestion, generated artifacts, and runtime consumers. | `scripts/ingestPhbGlossary.ts`, `scripts/generateItemRegistry.ts`, `src/components/Glossary/GlossaryItemStatBlock.tsx` | Type-driven rendering may miss or misrender metadata when upstream output shape changes. | Decide contract owner and close the validation gap in the owning project tracker. | Verify a generated sample item passes through ingestion, registry, and stat block render without field loss. |

## Classification Reference

- `in_scope_now`: required to complete a reliable handoff for current implemented behavior.
- `support_needed_now`: required dependency for safe continuation but owned partly outside this folder.
- `adjacent_follow_up`: useful for future work, but not required for this project to remain stable.
- `out_of_scope`: explicitly outside this project.
- `blocked_human_decision`: blocked by explicit owner choice.
- `blocked_external_state`: blocked by another team, build, or service dependency.
