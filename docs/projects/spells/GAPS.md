# Spells System Gap Registry

Status: active
Last updated: 2026-06-05

Use this file for durable unresolved findings that are in-scope for this project.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | in_scope_now | Working agent | `docs/projects/spells/TRACKER.md` | Baseline mapping | Align trigger ontology between validator schema and runtime by adding `on_move_in_area` enum support where runtime already emits that trigger. | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts` | Real trigger families cannot be schema-valid when they exist in runtime. | Update validator enum and trigger comments. | `npx tsx scripts/validateSpellJsons.ts` and focused spell test update |
| G2 | not_started | support_needed_now | Working agent | `docs/projects/spells/TRACKER.md` | Baseline mapping | Wire `TargetAllocator` into target flow for pool-based spells (`TargetAllocation` in targeting schema). | `src/systems/spells/targeting/TargetAllocator.ts`; `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts` | Sleep/Color Spray style effects can drift from declared allocation rules. | Add resolver-level allocation integration and tests. | Resolver+spell command tests covering pool allocation scenarios |
| G3 | not_started | support_needed_now | Working agent | `docs/projects/spells/TRACKER.md` | Baseline mapping | Consolidate duplicate trigger processing paths between `triggerHandler.ts` and `AreaEffectTracker.ts`. | `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/AreaEffectTracker.ts` | Duplicated logic creates drift risk for entry/exit/in-movement trigger behavior. | Choose a single authoritative implementation and remove duplication. | Trigger tests for all area flow families |
| G4 | not_started | support_needed_now | Working agent | `docs/projects/spells/TRACKER.md` | Baseline mapping | Add source context (`spellId`, `casterId`, `saveDC` where possible) to processed trigger effects. | `src/systems/spells/effects/triggerHandler.ts` | Downstream systems recompute or guess source IDs for save/DC calculations. | Extend `ProcessedEffect`/creation path and update dependent handlers. | Combat tests where save-dependent zone/reaction effects resolve correctly |
| G5 | in_progress | support_needed_now | Working agent | `docs/projects/spells/TRACKER.md` | Baseline mapping | Spell integrity coverage still emits warnings for monolithic-effect structures that need staged refactor. | `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` | Long-tail data behavior can remain structurally valid but mechanically ambiguous. | Continue reducing warning set and document per-spell clearances. | Soft-hit list should shrink per-level; review script output |
| G6 | in_progress | adjacent_follow_up | Working agent | `docs/projects/spells/TRACKER.md` | Baseline mapping | `docs/spells/STATUS_LEVEL_*.md` remain inventory-oriented and do not replace full runtime verification. | `docs/spells/STATUS_LEVEL_1.md`; `docs/tasks/spell-system-overhaul/*` | Project can overestimate readiness if status docs are treated as execution truth. | Keep status docs linked as inventory only and add explicit runtime check references. | Update `NORTH_STAR` next-check section when deeper checks are added |
| G7 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G9 | Code modularization audit routing | Spell validator/type contract files are large split candidates and mix runtime validation with generated/hand-authored type surfaces. | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/spellValidator.d.ts`; `src/types/spells.ts`; `src/types/spells.d.ts` | A mechanical split can desync structured spell contracts or generated declaration surfaces. | Score validator/type ownership before physical split work; keep generator/type provenance explicit. | Spell validation tests and spell gate audit checks named in the split plan |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | Essential to proceed with the current slice. |
| `support_needed_now` | Not the direct slice goal, but needed for safe continuation. |
| `adjacent_follow_up` | Useful context that informs future slices. |
| `out_of_scope` | Relevant to planning but not this project. |

## Update Rules

- Keep this file aligned with `docs/projects/spells/TRACKER.md`.
- Do not move cross-project gaps here; route them through `docs/projects/GLOBAL_GAPS.md`.
- Do not close a gap without evidence in the proof/check column.
