# Religion System Gap Registry

Status: active (G4 decision recorded 2026-06-10; Religion consumes the Rituals-owned contract)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | support_needed_now | Spark Worker | `src/state/reducers/religionReducer.ts`, `src/types/state.ts`, `src/state/initialState.ts` | NORTH_STAR rewrite | Dual-state favor compatibility is now fenced: the reducer reads canonical `state.religion` first, backfills missing favor entries from legacy `state.divineFavor`, and writes updates back to both maps. The temple registry remains a legacy seed/read path and is not mutated by this reducer. | `src/state/reducers/religionReducer.ts`, `src/state/reducers/__tests__/religionReducer.test.ts`, `src/state/__tests__/initialState.religion.test.ts` | The canonical-vs-legacy seam is now explicit, reducing drift risk while preserving old save compatibility. | Resume from G2; keep the compatibility helper in place and treat temple ownership as a later follow-up unless a new reducer gap appears. | Passed 2026-06-09: focused reducer tests and default-state compatibility test. |
| G2 | done | in_scope_now | Spark Worker | `src/systems/religion/TempleSystem.ts` | NORTH_STAR rewrite | Service effect handling now uses a typed legacy-string union plus explicit structured effect branches. `TempleService.effect` no longer collapses object-shaped services into the heal path. | `src/systems/religion/TempleSystem.ts`, `src/types/religion.ts`, `src/systems/religion/__tests__/TempleSystem.test.ts` | Future services are easier to reason about because heal and non-heal object services now take different paths, while legacy temple strings still work. | Keep the adapter map and structured union in place while G3 moves to combat trigger coverage. | Passed 2026-06-09: focused TempleSystem regression tests and living-project docs audit. |
| G3 | done | support_needed_now | Spark Worker | `src/systems/religion/CombatReligionAdapter.ts`, `src/data/deities/index.ts`, `src/types/religion.ts` | NORTH_STAR rewrite | Combat trigger mapping now uses deity-authored combat taxonomy labels plus legacy heuristics for the fixed set. | `src/systems/religion/CombatReligionAdapter.ts`, `src/data/deities/index.ts`, `src/types/religion.ts`, `src/systems/religion/__tests__/CombatReligionAdapter.test.ts` | Deity doctrines can now trigger from structured combat tags without losing the existing DESTROY_UNDEAD, KILL_ELF, HEAL_ALLY, and necromancy behavior. | Move to G4; keep the combat taxonomy map and legacy fallbacks in place. | Passed 2026-06-09: focused CombatReligionAdapter regression tests and living-project docs audit. |
| G4 | waiting | blocked_external_state | Rituals owner (contract) / Spark Worker (Religion integration) | `src/systems/rituals/RitualManager.ts`, `src/state/reducers/ritualReducer.ts`, `docs/projects/rituals/GAPS.md` | NORTH_STAR rewrite | Ritual backlash and interruption consequence paths are placeholder-first, but the consequence schema is also tracked as an active Rituals-system gap. Decided 2026-06-10 (DECISION_BLITZ D12): Rituals owns the backlash schema and effect math; Religion consumes the normalized result. | `src/systems/rituals/RitualManager.ts`, `src/state/reducers/ritualReducer.ts`, `docs/projects/rituals/GAPS.md` RG-3/RG-4, `docs/projects/DECISION_BLITZ_2026-06-10.md` D12 | Interrupts can still resolve without clear feedback, and Religion should not define the contract twice while Rituals owns the same consequence math. | Wait for the Rituals backlash schema and consequence tests (RG-3/RG-4), then add Religion-side integration assertions consuming the normalized result. | Rituals consequence tests first, then Religion integration assertions on the normalized output. |
| G5 | active | support_needed_now | Spark Worker | `src/hooks/actions/actionHandlers.ts`, `src/components/Religion/TempleModal.tsx` | NORTH_STAR rewrite | Several faith action payloads remain broadly typed in handlers and UI dispatch paths. | `src/hooks/actions/actionHandlers.ts`, `src/components/Religion/TempleModal.tsx`, `src/state/actionTypes.ts` | Loose casting can hide contract drift across UI, handlers, and reducers. | Replace `as any` paths with shared payload interfaces and explicit parse/validation where needed. | Run a focused type/build check on religion flow files and assert action round-trips in tests. |
| G6 | active | adjacent_follow_up | Spark Worker | `src/components/layout/GameModals.tsx`, `src/components/Religion/DivineFavorPanel.tsx` | NORTH_STAR rewrite | Divine favor panel and modal integration is complete, but blessing history/active blessings lifecycle is weakly represented in UI and state docs. | `src/components/Religion/DivineFavorPanel.tsx`, `src/types/religion.ts` | Users can gain blessings without clear long-term lifecycle visibility in the project. | Decide whether blessing lifecycle belongs to Rituals or Religion owner and document active duration/expiration ownership. | Add explicit active-blessing display or defer via gap routing decision with owning subsystem. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.
