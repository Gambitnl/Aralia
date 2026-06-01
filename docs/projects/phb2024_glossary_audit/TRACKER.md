# TRACKER: PHB 2024 Glossary Audit

Status: complete implementation scope
Last updated: 2026-05-31

## Completed Work

- `[done]` PHB 2024 core rules migration documented in `docs/tasks/2024_phb_rules_migration.md`.
- `[done]` Added in-scope category ingestion (`skills`, `senses`, `languages`, `trapsHazards`, `feats`, `backgrounds`, `items`).
- `[done]` Preserved item metadata fields in glossary entry generation.
- `[done]` Wired new top-level category folders into glossary UI mapping (`src/components/Glossary/glossaryUIUtils.tsx`).
- `[done]` Recorded project docs in `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `DECISIONS.md`.

## Active Work

- `[done]` No active implementation work remains.

## Blockers

- No hard blockers.

## Open Items to Track

- Cross-project type-contract parity for `itemMetadata`.
- Standardized non-dev index rebuild workflow for glossary regeneration.
- Ongoing consistency checks on PHB-specific content surfaced through rules glossary UI.

## Gaps Register

- See `GAPS.md` for the durable gap log and uncertainty tags.

## Next Checks

1. Re-run `node scripts/generateGlossaryIndex.js` after any data or mapping edits.
2. Verify glossary index loading path in `GlossaryContext` and sidebar display for new categories.
3. Reconcile unresolved type/build contract gaps with owning project owners before touching shared item pipelines.
