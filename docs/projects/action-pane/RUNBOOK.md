# Action Pane Runbook

Status: active
Last updated: 2026-06-08

This runbook gives the next agent the shortest safe path for this project slice.

## Routine Checks

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `COLD_START_AGENT_PROMPT.md`.
2. Run the focused contract test:
   `npm test -- --run src/components/ActionPane/__tests__/ActionPane.test.tsx`
3. Run the living-project docs audit:
   `node scripts/audit-living-project-docs.cjs`
4. If the contract changes, update the proof summary in `AUDIT_OR_PROOF.md`.

## Current Work

- T3 remains the next safe implementation slice.
- Do not delete legacy action surfaces unless a source-backed decision is recorded first.
- If a product decision is required, add a Required Review Brief and stop forward iteration until the decision is recorded.

## Resume Notes

- The system-menu and quick-command coverage gap is resolved.
- The next concrete question is whether `isDevDummyActive` still belongs on the ActionPane path.
- Keep `move.targetId` normalization tracked until the generator layer is proven strict enough.
