# Environment System Runbook

Status: active
Last updated: 2026-06-09

This runbook gives the next agent the shortest safe path for this project slice.

## Routine Checks

1. Read `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, and `COLD_START_AGENT_PROMPT.md`.
2. Review `DECISIONS.md` and `AUDIT_OR_PROOF.md` before changing policy or proof text.
3. Run the focused replay and reducer tests:
   `npx vitest run src/systems/environment/__tests__/WeatherSystem.test.ts src/systems/naval/__tests__/VoyageManager.test.ts src/state/reducers/__tests__/worldReducer.test.ts src/state/reducers/__tests__/navalReducer.test.ts`
4. Run the living-project docs audit:
   `node scripts/audit-living-project-docs.cjs`
5. If the docs audit or proof changes, update the relevant proof row instead of appending a new narrative.

## Current Work

- `T4`, `T5`, and `T6` are complete, and `G2` through `G5` are resolved.
- Keep the seeded replay policy in place for weather, voyage, and crew.
- Do not expand into adjacent terrain or travel coverage unless the task is explicitly re-routed.

## Resume Notes

- The runtime scheduler boundary remains the day-boundary `ADVANCE_TIME` path in `worldReducer.ts`.
- The fallback deterministic seeds in helper paths are intentional and preserve direct-call behavior.
- No Environment gap is currently open; the next safe slice should begin only after a fresh source-backed gap is opened or an adjacent slice is explicitly re-routed here.
