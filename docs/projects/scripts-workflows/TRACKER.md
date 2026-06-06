# TRACKER: Scripts: Workflows

Status: active
Last updated: 2026-06-05

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

T3 and T4 are the only open docs tasks; keep the slice inside project-owned references.

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Refresh `scripts/workflows` project docs with a cold-start command and integration map | Worker C | 2026-05-31 | [docs/projects/scripts-workflows/NORTH_STAR.md](docs/projects/scripts-workflows/NORTH_STAR.md) | Keep command entry points and wrapper migration notes aligned | `rg --files docs/projects/scripts-workflows` |
| T2 | done | Classify workflow-level gaps after command-surface scan | Worker C | 2026-05-31 | `scripts/workflows`, [docs/portraits/race_portrait_regen_handoff.md](docs/portraits/race_portrait_regen_handoff.md) | Update `docs/projects/scripts-workflows/GAPS.md` and validate next-check list | `Get-Content docs/projects/scripts-workflows/GAPS.md` |
| T3 | not_started | Consolidate the canonical command matrix into one project-owned reference | Worker C | 2026-06-05 | `G1` in [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md) | Draft a single command matrix in project-owned docs and replace duplicate examples with pointers | `Get-Content` across `package.json`, `scripts/run-image-regen.cmd`, `scripts/run-portrait-regen.cmd`, and the runbook docs |
| T4 | not_started | Normalize the environment-variable matrix for image-gen and research workflows | Worker C | 2026-06-05 | `G2` in [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md) | Capture the shared env knobs and defaults in one project-owned reference | `Get-Content` against the latest script headers and package scripts |

## Gap Log

- `G1` (adjacent_follow_up): Canonical workflow command matrix is still split across `docs/guides/MCP_INTEGRATION.md`, `docs/portraits/race_portrait_regen_handoff.md`, and package scripts.
- `G2` (support_needed_now): Shared workflow environment-variable matrix is documented in comments and scripts but not in one project-owned place.
