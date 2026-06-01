# UI Features Tracker

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
| T1 | done | Document this folder as a continuity surface for UI initiatives | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/tasks/ui-features/NORTH_STAR.md` | Keep tracker as the short handoff point only | README-style continuity is present |
| T2 | active | Refresh feature-to-folder initiative mapping and cross-project boundary notes | Worker D | 2026-05-31 | `docs/projects/crafting-ui/*`; `docs/projects/economy-ui/*`; `docs/projects/glossary-ui/*`; `docs/projects/party-ui/*`; `docs/projects/ui-primitives/*` | Verify each initiative in this folder has a durable continuation pointer | Next check IDs in `GAPS.md` match active tracker evidence |
| T3 | active | Formalize salvage and backlog ownership drift in gaps | Worker D | 2026-05-31 | `docs/tasks/ui-features/TASK_SALVAGE_UI.md`; `docs/tasks/CRAFTING_UI_TODO.md` | Add one stable gap row for stale path/ownership uncertainty | Confirm owner signal is not mis-modeled as completed work |
| T4 | active | Route adjacent follow-ups to owning project trackers | Worker D | 2026-05-31 | `docs/projects/crafting-ui/GAPS.md`; `docs/projects/economy-ui/GAPS.md`; `docs/projects/glossary-ui/GAPS.md` | Cross-link each project owner decision path | Validate routing path in each owned tracker before widening scope |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Alchemist | `docs/tasks/ui-features/TASK_SALVAGE_UI.md` | `docs/tasks/ui-features` scan | Salvage entry path is still backlog-only, and the existing task note points to a stale item-list component shape | `docs/tasks/ui-features/TASK_SALVAGE_UI.md`; `src/systems/crafting/salvageSystem.ts` | Without a concrete target path and ownership handoff, salvage UI work can drift from live inventory surfaces | Keep this open until owner and file path for menu/action wiring are confirmed | Evidence added with owner decision and next code-touch target |
| G2 | active | support_needed_now | Economy UI docs owner | `docs/projects/economy-ui/TRACKER.md` | `docs/tasks/ui-features` scan | Economy modal mount and callback flow is incomplete compared to reducer state | `docs/projects/economy-ui/NORTH_STAR.md`; `docs/projects/economy-ui/TRACKER.md`; `src/components/Economy/*` | Missing action-to-modal wiring blocks user-facing economy continuity | Add explicit owner approval or scoped follow-up in `docs/projects/economy-ui/GAPS.md` | Confirmation proof in next tracker row and modal mount check |
| G3 | active | adjacent_follow_up | Worker D | `docs/projects/crafting-ui/TRACKER.md` | `docs/tasks/ui-features` scan | Current crafting UI documents use mixed owner/placeholder labels across trackers | `docs/projects/crafting-ui/TRACKER.md`; `docs/tasks/CRAFTING_UI_TODO.md`; `docs/tasks/ui-features/TASK_SALVAGE_UI.md` | Ambiguous owners increase restart risk across adjacent UI initiatives | Add a concise ownership handoff note in owning trackers when scope expands | No owner drift remains unrecorded before implementation |
