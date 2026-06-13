# PHB 2024 Glossary Audit Living Tracker

Status: reference-only â€” archived 2026-06-10; implementation scope complete
Last updated: 2026-06-12

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
## Review-Gated Work

- `[blocked_human_decision]` Decide whether this audit project should become
  reference-only after routing item metadata parity to Item Categorization and
  rebuild workflow to Glossary maintenance.

## Blockers

- Human review is required before assigning forward iteration agents to this
  project. The remaining gaps are routed to adjacent owners rather than this
  audit surface.
- *(Cleared 2026-06-10: the review is complete â€” the project is archived as
  reference-only; no forward iteration agents are assigned here.)*

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
   surfaces instead. *(Review cleared 2026-06-10: archived as reference-only â€”
   routing through the owning surfaces is now the permanent rule.)*

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
