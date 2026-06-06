# TRACKER: PHB 2024 Glossary Audit

Status: complete implementation scope
Last updated: 2026-06-05

## Completed Work

- `[done]` PHB 2024 core rules migration documented in `docs/tasks/2024_phb_rules_migration.md`.
- `[done]` Added in-scope category ingestion for `skills`, `senses`, `languages`, `trapsHazards`, `feats`, `backgrounds`, and `items`.
- `[done]` Preserved item metadata fields in glossary entry generation.
- `[done]` Wired the new top-level category folders into glossary UI mapping in `src/components/Glossary/glossaryUIUtils.tsx`.
- `[done]` Refreshed the living-project docs for the current dashboard state.

## Active Work

- `[active]` Doc-only iteration pass: keep the project handoff current and route the next real gap to the right owner.

## Blockers

- No hard blockers.

## Open Items to Track

- `itemMetadata` contract parity is still owned by adjacent item work.
- The non-dev glossary rebuild workflow still needs a durable command-level contract.
- Glossary scope overlap should continue to route mixed-priority rule-surface questions to `docs/tasks/glossary`.

## Gaps Register

- See `GAPS.md` for the durable gap log and uncertainty tags.

## Next Checks

1. Re-run `node scripts/generateGlossaryIndex.js` after any data or mapping edits.
2. Verify glossary index loading path in `GlossaryContext` and sidebar display for new categories.
3. Route the highest-value open gap in `GAPS.md` to the owning project before touching shared item pipelines.
