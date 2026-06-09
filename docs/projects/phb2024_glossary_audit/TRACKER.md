# TRACKER: PHB 2024 Glossary Audit

Status: review-required; implementation scope complete
Last updated: 2026-06-08

## Completed Work

- `[done]` PHB 2024 core rules migration documented in `docs/tasks/2024_phb_rules_migration.md`.
- `[done]` Added in-scope category ingestion for `skills`, `senses`, `languages`, `trapsHazards`, `feats`, `backgrounds`, and `items`.
- `[done]` Preserved item metadata fields in glossary entry generation.
- `[done]` Wired the new top-level category folders into glossary UI mapping in `src/components/Glossary/glossaryUIUtils.tsx`.
- `[done]` Refreshed the living-project docs for the current dashboard state.

## Review-Gated Work

- `[blocked_human_decision]` Decide whether this audit project should become
  reference-only after routing item metadata parity to Item Categorization and
  rebuild workflow to Glossary maintenance.

## Blockers

- Human review is required before assigning forward iteration agents to this
  project. The remaining gaps are routed to adjacent owners rather than this
  audit surface.

## Open Items to Track

- `itemMetadata` contract parity is still owned by adjacent item work.
- The non-dev glossary rebuild workflow still needs a durable command-level contract.
- Glossary scope overlap should continue to route mixed-priority rule-surface questions to `docs/tasks/glossary`.

## Gaps Register

- See `GAPS.md` for the durable gap log and uncertainty tags.

## Next Checks

1. Re-run `node scripts/generateGlossaryIndex.js` after any data or mapping edits.
2. Verify glossary index loading path in `GlossaryContext` and sidebar display for new categories.
3. Do not assign this project to a worker until the merge-candidate review is
   cleared; route work through the owning Item Categorization or Glossary
   surfaces instead.
