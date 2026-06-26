# Crime UI Living Tracker

Status: complete_for_current_gap_set
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

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T2 | done | Convert docs from scaffold-only to implementation state snapshot. | Qoder | 2026-06-15 | `src/components/Crime/**`, `src/state/reducers/{crimeReducer,uiReducer}.ts`, `src/components/layout/GameModals.tsx`, `src/types/crime/index.ts`, `src/systems/crime/ThievesGuildSystem.ts` | Docs converted to evidence-backed project state. | Historical proof retained in `AUDIT_OR_PROOF.md`. |
| T3 | done | Validate future UI work against `docs/projects/crime` for core contract changes. | Gemini CLI | 2026-06-17 | `docs/projects/crime/TRACKER.md`, `docs/projects/crime/GAPS.md` | Core dependencies were validated at the time. | Superseded by the 2026-06-25 Crime core closeout. |
| T4 | done | Resolve Crime UI G1-G5 against current source and core Crime decisions. | Codex | 2026-06-25 | `docs/projects/crime/GAPS.md`, `docs/projects/crime-ui/GAPS.md`, `FenceInterface.tsx`, `HeistPlanningModal.tsx`, `ThievesGuildSafehouse.tsx`, `uiReducer.ts`, `GameModals.tsx`, `crimeReducer.ts` | Current gap set closed; no active Crime UI-owned gap remains. | Run a fresh source-backed Crime UI scan before assigning more work. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | design_decision_deferred | Codex | `docs/projects/crime/GAPS.md` G6 | 2026-06-25 reconciliation | No dedicated suspect/report UI flow exists. | Crime G6 documents that structured suspect/report types are intentionally deferred until a real caller needs them. | Future UI work should not assume a missing report model exists. | Closed for this gap set. | Crime proof log records G6. |
| G2 | done | support_needed_now | Codex | `docs/projects/crime-ui/GAPS.md` | 2026-06-25 reconciliation | Fence sale used generic merchant semantics. | `FenceInterface.tsx` dispatches `SELL_FENCED_ITEM`; character and crime reducers handle item/gold and heat. | Fence UI now reaches the crime consequence contract. | Closed for this gap set. | Focused reducer tests pass in Crime core. |
| G3 | done | in_scope_now | Gemini CLI | `docs/projects/crime-ui/GAPS.md` | Iteration 4 + 2026-06-25 recheck | Heist modal local cast bypassed null-safety. | `HeistPlanningModal.tsx` uses required `HeistPlan` arrays directly. | Heist UI no longer depends on a local non-optionality cast. | Closed for this gap set. | Existing component test remains the relevant UI check. |
| G4 | done | support_needed_now | Gemini CLI | `docs/projects/crime-ui/GAPS.md` | Iteration 4 + 2026-06-25 recheck | Safehouse service list was hardcoded. | `ThievesGuildSafehouse.tsx` calls `ThievesGuildSystem.getAvailableServices(membership.rank)`. | Safehouse service data now uses the shared system source. | Closed for this gap set. | Existing component test remains the relevant UI check. |
| G5 | done | workflow | Codex | `docs/projects/crime-ui/GAPS.md` | 2026-06-25 lifecycle readout | Modal visibility and heist phase lifecycle rules were implicit. | `GAPS.md` now records explicit rules for guild, safehouse, and heist planning modals using `uiReducer`, `GameModals.tsx`, and `crimeReducer.ts`. | Future UI slices can compose with the modal lifecycle deliberately. | Closed for this gap set. | Project audit and focused heist/crime reducer tests pass. |

## Regression Test Notes

- Fence sales should keep `SELL_FENCED_ITEM` coverage in reducer tests whenever the UI transaction changes.
- Heist planning UI changes should preserve `activeHeist.phase === 'Planning'` as the render gate unless the lifecycle rules are intentionally changed.
- Safehouse UI changes should continue using `ThievesGuildSystem.getAvailableServices()` as the service source of truth.

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
