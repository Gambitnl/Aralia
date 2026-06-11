# DECISIONS: Glossary UI
Last updated: 2026-06-10

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

## 4. Generated item metadata contract
- **Decision:** Keep the current generated item metadata contract documented as
  glossary-local display data until a human/product owner decides whether the
  schema should be shared with item registry generation.
- **Status:** Pending review.
- **Evidence:** `docs/projects/glossary-ui/NORTH_STAR.md` now carries the
  required review brief, and `docs/projects/glossary-ui/AUDIT_OR_PROOF.md`
  records the source-backed field contract.
- **Next check:** Once the owner decides on shared schema vs local display
  contract, update the tracker and gaps before any source refactor.
- **Resolution (2026-06-10):** Decided — see entry 5 below.

## 5. Generated item metadata contract — decision recorded
- **Decision:** Item metadata stays a glossary-local, display-only contract
  (Required Review Brief Option A). The shared ingest/registry schema is
  deferred to a later product/schema decision.
- **Decider:** Remy (project owner), 2026-06-10 batched decision session.
- **Status:** Decided 2026-06-10; review gate cleared.
- **Evidence:** `docs/projects/DECISION_BLITZ_2026-06-10.md` (D18);
  `docs/projects/glossary-ui/NORTH_STAR.md` Required Review Brief + Decision
  (2026-06-10) subsection; `docs/projects/glossary-ui/AUDIT_OR_PROOF.md`
  source-backed field contract.
- **Next check:** Keep the documented allowed-fields contract current in
  NORTH_STAR; route any future shared-schema proposal back through a new
  review brief. G7 (optional typed builder/guard in ingest) remains the
  adjacent follow-up in `GAPS.md`.
