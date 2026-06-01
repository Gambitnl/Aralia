# GAPS: Scripts: Workflows

Status: active
Last updated: 2026-05-31

## Summary

No execution code gaps are claimed as fixed here, but the workflow docs scan exposed durable documentation gaps that can block cold-start continuation if left unmanaged.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | Worker C | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | docs refresh | Workflow command examples are distributed across `package.json`, `run` .cmd files, handoff docs, and this project surface, with no single canonical table. | package scripts, `scripts/run-image-regen.cmd`, `scripts/run-portrait-regen.cmd`, `docs/portraits/race_portrait_regen_handoff.md` | Operators can use stale or duplicate launch patterns and hit avoidable runtime confusion. | Create one canonical command matrix entry point in project-owned docs and point legacy docs to it. | `Get-Content` check across project docs and `package.json` |
| G2 | not_started | support_needed_now | Worker C | [docs/projects/scripts-workflows/TRACKER.md](docs/projects/scripts-workflows/TRACKER.md) | docs refresh | Runtime env-var tuning for image generation/research (timeouts, CDP flags, cooldown, strict chat mode) is not normalized into one list. | `scripts/workflows/gemini/image-gen/*.ts`, `scripts/workflows/gemini/core/image-gen-mcp.ts` | Small env mistakes can cause brittle CDP runs and silent fallback behavior. | Add one environment-variable matrix in project doc and include defaults from runbooks. | `Get-Content` check against latest header comments + package scripts |
| G3 | not_started | out_of_scope | Worker C | [docs/projects/scripts-tooling/NORTH_STAR.md](docs/projects/scripts-tooling/NORTH_STAR.md) | docs refresh | `docs/portraits/race_portrait_regen_handoff.md` contains dated status snapshots not intended as live source of truth. | `docs/portraits/race_portrait_regen_handoff.md` | Snapshot drift misleads status reviews and can hide current operational risk. | Leave historical snapshots in place but gate usage with a date and stale-data note in runbook owners' docs. | no direct project-level completion required; confirm handoff note is respected |
