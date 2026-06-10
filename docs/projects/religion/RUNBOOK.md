# Religion System Runbook

Status: active
Last updated: 2026-06-09

This runbook gives the next agent the shortest safe path for Religion System work.

## Routine Checks

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `COLD_START_AGENT_PROMPT.md`.
2. Review `DECISIONS.md` and `AUDIT_OR_PROOF.md` before changing migration or proof claims.
3. Check whether the Required Review Brief is still unresolved before starting any implementation slice; if it is, stop forward work and wait for the ownership decision.
4. If source changes touch reducers, hooks, utils, or exported signatures, run the dependency sync command for those files.
5. Run the living-project docs audit before accepting a worker pass:
   `node scripts/audit-living-project-docs.cjs`

## Current Work

- G1 is resolved as a concrete compatibility slice and should stay fenced in place.
- G2 is resolved as a typed service-effect slice and should stay fenced in place.
- G3 is resolved as a combat taxonomy slice and should stay fenced in place.
- G4 is now review-required because the ritual consequence contract crosses the Religion and Rituals project boundary.
- G5-G6 remain open, but no forward Religion assignment should happen until the G4 decision is recorded.

## Resume Notes

- Do not delete legacy `divineFavor` or temple state paths during a gap pass.
- If a future pass discovers a true product decision instead of an implementation migration, add a Required Review Brief before assigning more Religion workers. G4 already reached that gate, so leave the project paused until it is answered.
