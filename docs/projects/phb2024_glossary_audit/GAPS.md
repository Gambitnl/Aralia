# PHB 2024 Glossary Audit Gap Registry

Status: reference-only — archived 2026-06-10; open gaps remain routed to adjacent owners
Last updated: 2026-06-10

> Archive note (2026-06-10): the project was archived as reference-only by
> Remy (project owner) in the batched decision session
> (`docs/projects/DECISION_BLITZ_2026-06-10.md` D24). The open gaps below stay
> valid but are owned by their routed destinations — itemMetadata parity by
> Item Categorization (`docs/projects/item_categorization`), the rebuild
> contract and scope overlap by Glossary maintenance (`docs/tasks/glossary`).
> No iteration work is assigned through this registry.

*Categories: `in_scope_now`, `support_needed_now`, `adjacent_follow_up`, `out_of_scope`, `blocked_human_decision`, `blocked_external_state`.*

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Current Gaps

- **[resolved - in_scope_now] Item metadata extraction for 2024 items**
  - `scripts/ingestPhbGlossary.ts` now includes core mechanical fields (`type`, `value`, `weight`, `dmg1`, `ac`) in generated glossary content.
  - Impact: mechanical display and downstream mapping no longer depend on implicit parsing only.

- **[open - support_needed_now] Item metadata contract parity**
  - `itemMetadata` remains a runtime/data shape gap between glossary ingestion, declaration typing, and UI consumers.
  - Evidence: this project depends on item metadata from PHB item entries, while declaration typing and registry consumers are maintained in adjacent item work.
  - Next check: align `itemMetadata` ownership in one owning project and verify end-to-end through generated item registry output.
  - Last refreshed: 2026-06-05; still the highest-value gap for the next agent to route.

- **[open - adjacent_follow_up] Non-dev glossary rebuild contract**
  - Regeneration is validated in dev flows, but stable command-level evidence outside `node`/dev tasks is incomplete in this project.
  - Evidence: index generation is currently tied to explicit script and UI-triggered rebuild paths.
  - Next check: document and verify a repeatable non-interactive rebuild command chain for maintenance and CI usage.
  - Last refreshed: 2026-06-05; keep it adjacent unless the rebuild contract becomes a release blocker.

- **[open - adjacent_follow_up] Glossary scope overlap**
  - `docs/tasks/glossary/GLOSSARY_RELEVANT_RULES_TARGET_SET.md` treats some `Rules Glossary` entries as low-priority audit noise; this project scope only claims PHB 2024 feature families.
  - Next check: keep this project scoped to family completion and route mixed-priority rule-surface questions to `docs/tasks/glossary`.
  - Last refreshed: 2026-06-05; no routing change needed in this pass.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
