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
| T1 | done | Create the religion living-project folder and seed documentation files. | Spark Worker | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md` | Completed. | Folder contains NORTH_STAR, TRACKER, GAPS with focused evidence. |
| T2 | done | Capture concrete implementation map and runtime wiring for religion systems. | Spark Worker | 2026-05-31 | `src/systems/religion`, `src/state/reducers/religionReducer.ts`, `src/components/layout/GameModals.tsx`, `src/utils/world/templeUtils.ts` | Completed. | NORTH_STAR file points to concrete file map and flow list. |
| T3 | done | Record prioritized implementation gaps with evidence and follow-up checks. | Spark Worker | 2026-05-31 | `src/systems/religion/TempleSystem.ts`, `src/systems/religion/CombatReligionAdapter.ts`, `src/systems/rituals/RitualManager.ts` | Completed. | GAPS rows include evidence and next proof checks. |
| T4 | done | Prepare a cold-start pass checklist for follow-up implementation. | Spark Worker | 2026-06-05 | `docs/projects/religion/NORTH_STAR.md`, `docs/projects/religion/TRACKER.md`, `docs/projects/religion/GAPS.md`, `docs/projects/religion/COLD_START_AGENT_PROMPT.md` | Completed. | Next agent starts from row G1, then G2, using the refreshed handoff. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Spark Worker | `src/state/reducers/religionReducer.ts`, `src/types/state.ts`, `src/state/initialState.ts` | NORTH_STAR rewrite | Dual-state favor compatibility is fenced in the reducer now. Canonical religion is the source of truth for writes, but legacy `state.divineFavor` is still hydrated and updated so older saves and partial loads stay readable. | Existing behavior can drift between canonical and legacy slices as handlers evolve. | Move to G2; keep the helper in place and treat the temple registry as a later compatibility follow-up unless a new gap proves otherwise. | Passed 2026-06-09: reducer and default-state compatibility tests. |
| G2 | done | support_needed_now | Spark Worker | `src/systems/religion/TempleSystem.ts`, `src/systems/religion/__tests__/TempleSystem.test.ts` | NORTH_STAR rewrite | Temple effect handling now uses a typed legacy-string union plus explicit structured effect branches, including a non-heal regression path. | The service effect seam is now safer because object-shaped temple services no longer default to heal handling. | Keep the adapter map and structured union in place while G3 moves to combat trigger coverage. | Passed 2026-06-09: focused TempleSystem regression tests, including structured heal and non-heal cases. |
| G3 | done | support_needed_now | Spark Worker | `src/systems/religion/CombatReligionAdapter.ts`, `src/data/deities/index.ts`, `src/types/religion.ts` | NORTH_STAR rewrite | Combat-to-religion trigger translation now uses deity-authored combat taxonomy labels plus legacy fallbacks (`DESTROY_UNDEAD`, `KILL_ELF`, `DEFEAT_ORC`, `HEAL_ALLY`, necromancy labels). | Faith response coverage is broader and handles case-variant / mixed-label combat logs without inventing a parallel trigger table. | Move to G4; keep the combat taxonomy map and legacy fallbacks in place while the ritual consequence seam is addressed next. | Passed 2026-06-09: focused CombatReligionAdapter regression tests and living-project docs audit. |
| G4 | waiting | blocked_external_state | Rituals owner (contract) / Spark Worker (Religion integration) | `src/state/reducers/ritualReducer.ts`, `src/systems/rituals/RitualManager.ts`, `docs/projects/rituals/GAPS.md` | NORTH_STAR rewrite | Ritual interruption failure path returns placeholder/empty backlash and TODO-heavy branches, but the consequence contract is also owned by the Rituals project. Decided 2026-06-10: Rituals owns the backlash contract; Religion consumes the normalized result (DECISION_BLITZ D12). | Religion-linked ritual outcomes can remain silent or misleading, and the same gap is already tracked in the Rituals project. | Wait for the Rituals backlash schema and consequence tests (RG-3/RG-4), then add Religion-side integration assertions on the normalized result. | Rituals consequence tests first, then Religion integration assertions. |
| G5 | active | support_needed_now | Spark Worker | `src/hooks/actions/actionHandlers.ts`, `src/components/Religion/TempleModal.tsx` | NORTH_STAR rewrite | Action and UI boundaries still contain loose payload casts (`as any`) for faith actions and fallback reads from legacy state fields. | Small contract drift here can cause runtime breakage without compile errors. | Tighten shared action/service interfaces and remove unnecessary legacy fallbacks where project boundaries are set. | Compile-relevant type checks over `src/components/Religion/*` and `src/hooks/actions/actionHandlers.ts` after cleanup. |

## Update Rules

- Update this tracker before starting a new slice.
- Update it when implementation changes the current state.
- Every active, waiting, or blocked row needs owner, last updated date, evidence or next proof, and next action.
- Record new gaps here or link the owning subsystem tracker.
- Keep raw process artifacts out unless a concise summary helps future work.
