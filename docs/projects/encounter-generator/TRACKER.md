# Encounter Generator Tracker

Status: active
Last updated: 2026-05-31

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh encounter-generator docs with runtime evidence map | Worker B | 2026-05-31 | NORTH_STAR.md | Keep updates limited to project docs | Confirm all three files are consistent and ASCII only |
| T2 | active | Track implemented state and integration points for cold-start handoff | Worker B | 2026-05-31 | `src/components/Combat/EncounterModal.tsx` | Update GAPS and next checks with deterministic-seed gap | Verify cross-references in NORTH_STAR.md match reality |
| T3 | not_started | Define deterministic encounter generation scope with owner sign-off | Worker B | 2026-05-31 | `src/utils/world/bestiaryEncounterGenerator.ts` | Add implementation design when feature work starts | Manual encounter run reproducibility smoke test |

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Update Rules

- Update this file when scope, owner, or proof path changes.
- Keep links to evidence files current so a cold agent can validate claims quickly.

