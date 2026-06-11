# PHB 2024 Glossary Audit Living Tracker

Status: reference-only — archived 2026-06-10; implementation scope complete
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
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
  - `[done 2026-06-10]` Decided by Remy (project owner) in the batched decision
    session (`docs/projects/DECISION_BLITZ_2026-06-10.md` D24): **archive as
    reference-only**; remaining gaps stay routed to Item Categorization and
    Glossary maintenance. Recorded in `DECISIONS.md`.

## Blockers

- Human review is required before assigning forward iteration agents to this
  project. The remaining gaps are routed to adjacent owners rather than this
  audit surface.
- *(Cleared 2026-06-10: the review is complete — the project is archived as
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
   surfaces instead. *(Review cleared 2026-06-10: archived as reference-only —
   routing through the owning surfaces is now the permanent rule.)*

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
