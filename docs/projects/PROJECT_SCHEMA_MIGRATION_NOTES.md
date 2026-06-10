# Project Schema Migration Notes

Status: active
Last updated: 2026-06-10

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

## Future Promotion Candidates

| Candidate | Promote when | Proposed field |
|---|---|---|
| Parity checklist | Multiple renderer or parity-sensitive projects need the same visible dashboard signal. | `parity_checklist` or `parity_status` |
| Dependency contract | Multiple projects maintain formal dependency contracts that should be visible in the project card. | `dependency_contract` |
| Performance proof | Multiple projects maintain performance budgets or proof docs that need dashboard sorting/filtering. | `performance_status` or `performance_proof` |
| Technical spec | Multiple project folders use a spec document as a required dispatch artifact. | Add `TECHNICAL_SPEC.md` to `required_docs` only after confirming it is universal. |

## Pending Verification

The migration still needs an explicit audit run before the project-schema goal
can be considered complete:

```powershell
npm run projects:audit
```

Do not mark the schema migration complete until that audit proves every
schema-governed project folder has valid frontmatter and no unexpected required
document gaps.
