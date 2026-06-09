# 3D Combat Map Decisions

Status: active
Last updated: 2026-06-08

Use this file for durable choices that affect project scope, required documentation,
or protocol interpretation. Keep operational notes in `AUDIT_OR_PROOF.md` and
re-openable workflow deltas in `TRACKER.md`/`GAPS.md`.

## Decision Log

### D8: Close G8 required-doc accounting gap

Date: 2026-06-08

Owner: gpt-5.3-codex-spark / MCP-subagent

Decision point:
`NORTH_STAR.md` currently requires `DECISIONS.md` and `RUNBOOK.md` in
`required_docs`, but neither file was present in `docs/projects/3d-combat-map`.

Options considered:
- Remove both files from `required_docs`, which would keep the project compliant
  with its present docs but would lower the declared surface for durable evidence.
- Add concise stubs for both docs to preserve the declared contract and keep the
  living-project handoff surface complete.

Decision made:
- Add short `DECISIONS.md` and `RUNBOOK.md` stubs so required-doc accounting
  is explicit and audit-clean.

Rationale and evidence:
- `docs/projects/3d-combat-map/NORTH_STAR.md` `required_docs` currently includes
  both files.
- The folder did not contain either file, causing `missingDeclaredDocs` in the
  project audit.
- Preserving declared required docs is lower-risk than shrinking requirements in a
  live-facing project contract.

Mutation performed:
- Added `docs/projects/3d-combat-map/DECISIONS.md` and
  `docs/projects/3d-combat-map/RUNBOOK.md`.
- Updated `GAPS.md`, `TRACKER.md`, and `NORTH_STAR.md` to mark G8 as complete.

Resulting status:
- G8 required-doc accounting is now closed.

Follow-up:
- Keep `docs/projects/3d-combat-map/DECISIONS.md` and `RUNBOOK.md` present and
  in sync with `required_docs`.

