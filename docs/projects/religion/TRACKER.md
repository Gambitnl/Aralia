# Religion System Living Tracker

Status: active (G4 decision recorded 2026-06-10; Religion consumes the Rituals-owned contract)
Last updated: 2026-06-10

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

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G4 | waiting | blocked_external_state | Rituals owner (contract) / Spark Worker (Religion integration) | `src/state/reducers/ritualReducer.ts`, `src/systems/rituals/RitualManager.ts`, `docs/projects/rituals/GAPS.md` | NORTH_STAR rewrite | Ritual interruption failure path returns placeholder/empty backlash and TODO-heavy branches, but the consequence contract is also owned by the Rituals project. Decided 2026-06-10: Rituals owns the backlash contract; Religion consumes the normalized result (DECISION_BLITZ D12). | Religion-linked ritual outcomes can remain silent or misleading, and the same gap is already tracked in the Rituals project. | Wait for the Rituals backlash schema and consequence tests (RG-3/RG-4), then add Religion-side integration assertions on the normalized result. | Rituals consequence tests first, then Religion integration assertions. |
| G5 | active | support_needed_now | Spark Worker | `src/hooks/actions/actionHandlers.ts`, `src/components/Religion/TempleModal.tsx` | NORTH_STAR rewrite | Action and UI boundaries still contain loose payload casts (`as any`) for faith actions and fallback reads from legacy state fields. | Small contract drift here can cause runtime breakage without compile errors. | Tighten shared action/service interfaces and remove unnecessary legacy fallbacks where project boundaries are set. | Compile-relevant type checks over `src/components/Religion/*` and `src/hooks/actions/actionHandlers.ts` after cleanup. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
