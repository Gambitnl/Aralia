# Spells Living Tracker

Status: active
Last updated: 2026-06-11

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
| T2 | active | Track unresolved spell runtime gaps in this living project (ontology, triggers, targeting allocation, typed effect flow). | Working agent | 2026-05-31 | `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/targeting/TargetAllocator.ts`; `src/systems/spells/effects/triggerHandler.ts` | Keep `TRACKER` and `GAPS` aligned as gap evidence matures. | Run spell validation and targeted integration checks before each gap transition. |
| T3 | active | Preserve integration map to `docs/tasks/spell-system-overhaul` for implementation continuity. | Working agent | 2026-05-31 | `docs/tasks/spell-system-overhaul/README.md`; `docs/tasks/spell-system-overhaul/GAPS.md` | Add/refresh "relationship" notes in `NORTH_STAR` and this tracker. | Confirm that future edits only reference this project. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|




## Update Rules

- Update this tracker before any project continuation slice.
- Keep active rows tied to explicit evidence.
- Record in-scope runtime gaps in `docs/projects/spells/GAPS.md` and link back.
- Keep this file focused on active continuity, not raw command logs.
