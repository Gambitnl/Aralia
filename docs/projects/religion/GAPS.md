# Religion System Gap Registry

Status: active (G4 decision recorded 2026-06-10; Religion consumes the Rituals-owned contract)
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
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
