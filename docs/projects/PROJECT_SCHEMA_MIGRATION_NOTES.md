# Project Schema Migration Notes

Status: active
Last updated: 2026-06-12

This file tracks schema-fit decisions made while migrating project dashboard
cards to the YAML frontmatter contract in `PROJECT_CARD_SCHEMA.md`.

The canonical dashboard schema lives in each project's `NORTH_STAR.md`
frontmatter. Project-specific supporting artifacts should be listed in
`optional_docs` unless the same artifact type appears across enough projects to
deserve a promoted schema field.

## Migration Rule

1. Keep canonical dashboard card fields in `NORTH_STAR.md` YAML frontmatter.
2. Keep canonical living-project docs in `required_docs`.
3. Put one-off or domain-specific project artifacts in `optional_docs`.
4. Promote a new schema field only when multiple projects need the same
   machine-readable signal and `optional_docs` is too vague for dashboard use.

## Current Non-Core Artifact Mapping

| Project | Artifact | Current schema home | Promotion decision |
|---|---|---|---|
| `battle-map` | `PARITY_CHECKLIST.md` | `optional_docs` | Keep optional; renderer parity is project-specific for now. |
| `racial-mechanics` | `traits-implementation-mapping.json` | `optional_docs` | Keep optional; structured mapping is domain-specific. |
| `racial-mechanics` | `traits-implementation-mapping.md` | `optional_docs` | Keep optional; human-readable companion to project-specific mapping. |
| `submap` | `DEPENDENCY_CONTRACT.md` | `optional_docs` | Keep optional unless dependency contracts become common across projects. |
| `tiered-autosave` | `ARCHITECTURE_NOTES.md` | `optional_docs` | Keep optional; architecture notes are already covered by optional docs. |
| `town-description-system` | `IMPLEMENTATION_PLAN.md` | `optional_docs` | Keep optional; plan docs are project-specific supporting material. |
| `town-description-system` | `QUICK_START.md` | `optional_docs` | Keep optional; operational helper, not a dashboard card field. |
| `town-description-system` | `README.md` | `optional_docs` | Keep optional; project-local index. |
| `town-description-system` | `TASKS.md` | `optional_docs` | Keep optional unless task docs become a required living-project surface. |
| `town-description-system` | `TECHNICAL_SPEC.md` | `optional_docs` | Keep optional; project-specific technical spec. |
| `world-3d-ui` | `PERF.md` | `optional_docs` | Keep optional unless performance proof becomes a repeated dashboard signal. |

## Schema Promotions Made During This Pass

No new field was promoted for the non-core artifacts above. The existing
`optional_docs` field is the correct schema home for them today.

The migration did standardize the richer dashboard contract across project
frontmatter, including taxonomy, verification, lifecycle, deprecation,
handoff-comment, and required/optional document fields.

## Gap Signal Parseability

`PROJECT_CARD_SCHEMA.md` now requires `gap_signal` to begin with a parseable
open-gap count such as `0 open gaps`, `1 open gap`, or `<N> open gaps`.

The 2026-06-12 pass normalized only project North Stars whose existing
`gap_signal` already gave an unambiguous count or said all gaps were resolved.
Remaining prose-only signals were intentionally left unchanged because deriving
counts from mixed `GAPS.md` tables, routed-gap prose, or gap-ID ranges could
silently mislead the dashboard. Those projects need a per-project semantic
review before their `gap_signal` is rewritten.

The placeholder `gap_signal: present` group was normalized on 2026-06-12.
`types-ui` initially required extra handling because its `GAPS.md` contained a
duplicate seeded `G1` row; that seeded row has been removed from active project
state and the North Star now reports `2 open gaps`.

A follow-up 2026-06-12 pass normalized five additional prose signals where the
existing text already gave a safe interpretation: `creatures`,
`gemini-service`, `saveload`, `submap-generation`, and `three-d-modal`. A later same-day row-count pass normalized `battle-map`, `combat`, `command-effects-runtime`, `companions`, `crafting`, `events`, `glossary-ui`, `layout`, `providers`, `quest-log`, `racial-mechanics`, `religion`, `scripts-audits`, `scripts-quality`, `scripts-spell-runtime-template-audit`, `submap`, `ui-primitives`, `world`, and `world3d`.

The final prose-only batch was normalized on 2026-06-12 after semantic review of `character-creator`, `code-modularization-audit`, `world-3d-ui`, and `worldsim-service`. Their new summaries preserve routed or inherited ownership context while starting with a parseable open-gap count. `code-modularization-audit` and `worldsim-service` also had leftover seeded schema-normalization `G1` rows removed from active project state.

## Future Promotion Candidates

| Candidate | Promote when | Proposed field |
|---|---|---|
| Parity checklist | Multiple renderer or parity-sensitive projects need the same visible dashboard signal. | `parity_checklist` or `parity_status` |
| Dependency contract | Multiple projects maintain formal dependency contracts that should be visible in the project card. | `dependency_contract` |
| Performance proof | Multiple projects maintain performance budgets or proof docs that need dashboard sorting/filtering. | `performance_status` or `performance_proof` |
| Technical spec | Multiple project folders use a spec document as a required dispatch artifact. | Add `TECHNICAL_SPEC.md` to `required_docs` only after confirming it is universal. |
| Gap signal detail | Prose-only `gap_signal` values continue to block reliable dashboard sorting or warnings. | Keep `gap_signal` as the summary field, but require future agents to start with a parseable count and migrate ambiguous projects during semantic review. |

## Pending Verification

The migration still needs an explicit audit run before the project-schema goal
can be considered complete:

```powershell
npm run projects:audit
```

Do not mark the schema migration complete until that audit proves every
schema-governed project folder has valid frontmatter and no unexpected required
document gaps.

## Seeded Schema-Normalization Row Cleanup

A 2026-06-12 cleanup pass removed stale seeded schema-normalization rows from tracker or gap files that already had real project rows. The seed-only `GAPS.md` files for `item_categorization`, `phb2024_glossary_audit`, and `tiered-autosave` were then semantically reviewed and replaced with structured rows derived from each file's existing prose gaps. No seed-only schema-normalization gap rows should remain in active project state.

The same 2026-06-12 review normalized remaining dashboard gap-count drift. North Star `gap_signal` fields were updated where they undercounted open rows, routed/reference projects now report routed open gaps honestly, and legacy no-status gap tables in `ollama-service` and `worldsim-service` were reshaped so open/remediated rows can be counted without inference. The follow-up structural scan found no missing required docs, missing preferred YAML fields, non-active projects without review briefs, high-iteration projects without compaction markers, unparseable gap signals, or gap-count mismatches after excluding non-gap explanatory tables.

A registry/lifecycle follow-up on 2026-06-12 confirmed that all 82 project folders are referenced by `PROJECT_TRACKER.md` and no `docs/projects/<slug>` registry references point at missing folders. It also normalized `three-d-modal` from `deprecation_confidence: confirmed` to the schema-supported `strong` value while preserving its merged-reference lifecycle and `world-3d-ui` canonical owner.
