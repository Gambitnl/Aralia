# GAP REGISTRY: PHB 2024 Glossary Audit

*Categories: `in_scope_now`, `support_needed_now`, `adjacent_follow_up`, `out_of_scope`, `blocked_human_decision`, `blocked_external_state`.*

## Current Gaps

- **[resolved - in_scope_now] Item metadata extraction for 2024 items**
  - `scripts/ingestPhbGlossary.ts` now includes core mechanical fields (`type`, `value`, `weight`, `dmg1`, `ac`) in generated glossary content.
  - Impact: mechanical display and downstream mapping no longer depend on implicit parsing only.

- **[open - support_needed_now] Item metadata contract parity**
  - `itemMetadata` remains a runtime/data shape gap between glossary ingestion, declaration typing, and UI consumers.
  - Evidence: this project depends on item metadata from PHB item entries, while declaration typing and registry consumers are maintained in adjacent item work.
  - Next check: align `itemMetadata` ownership in one owning project and verify end-to-end through generated item registry output.

- **[open - adjacent_follow_up] Non-dev glossary rebuild contract**
  - Regeneration is validated in dev flows, but stable command-level evidence outside `node`/dev tasks is incomplete in this project.
  - Evidence: index generation is currently tied to explicit script and UI-triggered rebuild paths.
  - Next check: document and verify a repeatable non-interactive rebuild command chain for maintenance and CI usage.

- **[open - adjacent_follow_up] Glossary scope overlap**
  - `docs/tasks/glossary/GLOSSARY_RELEVANT_RULES_TARGET_SET.md` treats some `Rules Glossary` entries as low-priority audit noise; this project scope only claims PHB 2024 feature families.
  - Next check: keep this project scoped to family completion and route mixed-priority rule-surface questions to `docs/tasks/glossary`.
