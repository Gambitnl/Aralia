# Crafting System Living Tracker

Status: active
Last updated: 2026-05-31

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create and populate the Crafting living-project docs from registry evidence. | Worker A | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Completed for this pass. | Confirm tracker/docs are internally consistent. |
| T2 | done | Expand NORTH_STAR with implementation map, state wiring, and uncertainty list. | Worker A | 2026-05-31 | `src/systems/crafting/craftingEngine.ts`, `src/components/Crafting/AlchemyBenchPanel.tsx`, `src/state/appState.ts` | Ensure doc can support a cold-start continuation with file-map fidelity. | Evidence-backed file coverage exists in the north-star sections. |
| T3 | active | Convert unresolved areas into explicit gap rows with owners and follow-on proof checks. | Worker A | 2026-05-31 | `src/systems/crafting/craftingService.ts`, `src/components/Crafting/GatheringPanel.tsx`, `src/components/Crafting/CreatureHarvestPanel.tsx`, `src/systems/crafting/experimentalAlchemy.ts` | Keep these as implementation-facing backlog items; no code edits in this pass. | Verify each row has status + evidence + next proof in GAPS.md. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | support_needed_now | Worker A | `docs/projects/crafting/GAPS.md` | Docs enrichment pass | Dual craft contracts are active (`craftingSystem.ts` vs `craftingEngine.ts`) with different quality enums and check flows. | `src/systems/crafting/craftingSystem.ts`, `src/systems/crafting/craftingEngine.ts`, `src/components/Crafting/AlchemyBenchPanel.tsx` | Inconsistent contracts can cause action payload and analytics behavior divergence. | Formalize migration/compatibility criteria before any future consolidation refactor. | Add explicit evidence row and acceptance criteria in GAPS.md. |
