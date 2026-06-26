# Scripts: Workflows Living Tracker

Status: active
Last updated: 2026-06-25

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

T3 through T6 are the open docs tasks; keep the slice inside project-owned references.

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T3 | not_started | Consolidate the canonical command matrix into one project-owned reference | Worker C | 2026-06-05 | `G1` in [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md) | Draft a single command matrix in project-owned docs and replace duplicate examples with pointers | `Get-Content` across `package.json`, `scripts/run-image-regen.cmd`, `scripts/run-portrait-regen.cmd`, and the runbook docs |
| T4 | not_started | Normalize the environment-variable matrix for image-gen and research workflows | Worker C | 2026-06-05 | `G2` in [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md) | Capture the shared env knobs and defaults in one project-owned reference | `Get-Content` against the latest script headers and package scripts |
| T5 | not_started | Add a compact workflow-reconciliation checklist for ledgers, roadmap-local evidence, verification, and dependency-sync habits | Worker C | 2026-06-25 | `G3` in [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md); retired `docs/improvements/DEVELOPMENT_FLOW_ENHANCEMENT_PLAN.md` | Draft one project-owned reference that reinforces existing ledgers and roadmap-local ownership without adding a speculative automation layer | `Get-Content` check proves the checklist points to review/migration ledgers, Roadmap Maintenance G2, AGENTS dependency-sync rule, and human-judgment boundaries |
| T6 | not_started | Add lightweight version-bump guidance if release/version decisions become active | future workflow maintainer | 2026-06-25 | `G4` in [docs/projects/scripts-workflows/GAPS.md](docs/projects/scripts-workflows/GAPS.md); retired `docs/plans/tooling/VERSION_SIZING_REVIEW_AGENT_CONCEPT.md` | Keep this dormant until versioning inconsistency appears; then write simple patch/minor/major guidance before considering a specialized agent | Source/docs check proves the guidance exists and does not add a mandatory per-task AI review gate |

## Gap Log

- `G1` (adjacent_follow_up): Canonical workflow command matrix is still split across `docs/guides/MCP_INTEGRATION.md`, `docs/portraits/race_portrait_regen_handoff.md`, and package scripts.
- `G2` (support_needed_now): Shared workflow environment-variable matrix is documented in comments and scripts but not in one project-owned place.
- `G3` (adjacent_follow_up): Workflow reconciliation needs a compact checklist that reinforces existing ledgers, roadmap-local evidence, verification, and dependency-sync habits without becoming a second process layer.
- `G4` (adjacent_follow_up): Version-bump guidance is not yet formalized; start with simple human-readable patch/minor/major rules only if release/version decisions become active.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
