# Action Pane Runbook

Status: active
Last updated: 2026-06-10

This runbook gives the next agent the shortest safe path for this project slice.

## Routine Checks

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `COLD_START_AGENT_PROMPT.md`.
2. Run the focused contract test:
   `npm test -- --run src/components/ActionPane/__tests__/ActionPane.test.tsx`
3. Run the living-project docs audit:
   `node scripts/audit-living-project-docs.cjs`
4. If the contract changes, update the proof summary in `AUDIT_OR_PROOF.md`.

## Current Work

- All initial gaps (G1-G4) are complete. The move target contract is source-backed, dev-dummy is removed, and town action ownership decision has been recorded.
- Do not widen beyond the ActionPane contract unless a new gap is explicitly logged.

## Resume Notes

- Action Pane slice is fully resolved and verified.
- Revisit only if new action contracts are proposed.
