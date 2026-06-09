# DECISIONS: Glossary UI
Last updated: 2026-06-09

## 1. Full glossary rebuild entry point
- **Decision:** Expose `npm run glossary:rebuild` as the named glossary-specific
  non-dev pipeline for ingest -> index -> bundle.
- **Status:** Implemented.
- **Evidence:** `package.json` now defines `glossary:rebuild`, and
  `docs/projects/glossary-ui/RUNBOOK.md` documents it as the canonical rebuild
  command.
- **Next check:** Keep the script, runbook, and proof notes aligned if the
  pipeline stages change again.

## 2. Broader data build behavior
- **Decision:** Keep `npm run build:data` as the broader data build entry point
  and delegate the glossary rebuild through it after item registry generation.
- **Status:** Implemented.
- **Evidence:** `package.json` chains `generateItemRegistry.ts` into
  `npm run glossary:rebuild`.
- **Next check:** Revisit this order only if item-registry output begins feeding
  glossary index inputs.

## 3. Item categorization ownership boundary
- **Decision:** Leave the item taxonomy / `itemGroup` stance owned by
  `docs/projects/item_categorization`.
- **Status:** Unchanged this iteration.
- **Evidence:** `docs/projects/item_categorization/NORTH_STAR.md` still carries
  the taxonomy review gate, and this project continues to treat it as a
  dependency rather than a glossary-local implementation detail.
- **Next check:** Continue routing grouping questions to the item-categorization
  project instead of duplicating the decision here.
