# Spells System Living Tracker

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
| T1 | done | Capture project-level living baseline for broad spells-system behavior and evidence points. | Worker | 2026-05-31 | `docs/projects/spells/NORTH_STAR.md` | Begin gap-first queue based on debt markers. | North star and gap file have concrete entries. |
| T2 | active | Track unresolved spell runtime gaps in this living project (ontology, triggers, targeting allocation, typed effect flow). | Working agent | 2026-05-31 | `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/targeting/TargetAllocator.ts`; `src/systems/spells/effects/triggerHandler.ts` | Keep `TRACKER` and `GAPS` aligned as gap evidence matures. | Run spell validation and targeted integration checks before each gap transition. |
| T3 | active | Preserve integration map to `docs/tasks/spell-system-overhaul` for implementation continuity. | Working agent | 2026-05-31 | `docs/tasks/spell-system-overhaul/README.md`; `docs/tasks/spell-system-overhaul/GAPS.md` | Add/refresh "relationship" notes in `NORTH_STAR` and this tracker. | Confirm that future edits only reference this project. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | active | in_scope_now | Working agent | `docs/projects/spells/GAPS.md` | Baseline mapping | Validator enum and runtime mismatch for `on_move_in_area` triggers. | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/effects/AreaEffectTracker.ts` | Runtime cannot reliably validate schema for implemented move-in-area spells. | Update enum in schema/validator and run spell schema scan. | `npx tsx scripts/validateSpellJsons.ts` |
| G2 | active | in_scope_now | Working agent | `docs/projects/spells/GAPS.md` | Baseline mapping | Target allocation module exists but not connected to resolver flow. | `src/systems/spells/targeting/TargetAllocator.ts`; `src/systems/spells/targeting/TargetResolver.ts` | Sleep/Color Spray-like pool mechanics are not using declared allocation rules. | Wire allocation path and add targeted resolver test. | New allocation regression test plus spell command integration test |
| G3 | active | support_needed_now | Working agent | `docs/projects/spells/GAPS.md` | Baseline mapping | Duplicate trigger logic between standalone and tracker implementations. | `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/AreaEffectTracker.ts` | Duplicate execution paths risk trigger drift across area effects. | Choose one path and align event handling. | Run `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` and trigger tests |
| G4 | active | support_needed_now | Working agent | `docs/projects/spells/GAPS.md` | Baseline mapping | Missing source context in processed effects for downstream DC/save logic. | `src/systems/spells/effects/triggerHandler.ts` | Save DC, caster attribution, and auditability depend on explicit source context. | Add typed `sourceContext` and verify consumers. | Combat-focused integration tests for triggered saves and zone effects |
| G5 | active | support_needed_now | Working agent | `docs/projects/spells/GAPS.md` | Baseline mapping | Manifest-level and runtime tests do not fully prove all spell behavior families. | `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `src/systems/spells/validation/SpellIntegrityValidator.ts` | Schema pass can mask runtime behavior gaps in mode-choice and area-trigger families. | Add targeted spell-level integration checks for families. | Focused `Spell` command + end-to-end combat slices |

## Update Rules

- Update this tracker before any project continuation slice.
- Keep active rows tied to explicit evidence.
- Record in-scope runtime gaps in `docs/projects/spells/GAPS.md` and link back.
- Keep this file focused on active continuity, not raw command logs.
