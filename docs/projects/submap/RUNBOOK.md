# Submap Runbook

Status: review-required
Last updated: 2026-06-09

## Before Any Future Work

1. Read `NORTH_STAR.md`, especially the Required Review Brief.
2. Read `DEPENDENCY_CONTRACT.md`.
3. Confirm the project is no longer `review-required` before accepting forward
   implementation work.

## Review-Gated Rule

Do not delete, replace, or bypass the DOM/tile Submap surface while renderer
authority is unresolved. The only safe work before the decision is
documentation, dependency inventory, or reviewer-facing proof capture.

## After The Decision

1. Record the chosen renderer authority in `DECISIONS.md`.
2. Update `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and
   `COLD_START_AGENT_PROMPT.md`.
3. Run a focused proof comparing:
   - one `QUICK_TRAVEL` payload from `SubmapPane` to `handleQuickTravel`
   - one `inspect_submap_tile` payload from `SubmapPane` to
     `handleInspectSubmapTile`
4. Keep world `MapData` and combat `BattleMapData` contracts separate unless a
   dedicated migration plan proves a replacement.
