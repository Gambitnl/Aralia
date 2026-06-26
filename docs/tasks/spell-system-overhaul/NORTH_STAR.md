# Structured Spell Execution North Star

Status: active
Last updated: 2026-05-31
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Why This Project Exists

Preserve and advance Aralia's structured spell execution surface so future agents can resume work without re-deriving current architecture, validation gates, runtime seams, and unresolved mechanic gaps.

This project used to be called "Spell System Overhaul." That name is preserved as the folder slug and historical alias, but the active project purpose is narrower and clearer: make spell data structurally valid, mechanically executable, and provably connected to targeting, effects, command execution, loading, and combat behavior.

## Intended Outcome

Keep the project actionable by separating **what is currently implemented** from **what is still partial**, while preserving explicit uncertainties and reading order for a cold-start resume.

## Current State Snapshot (as of 2026-05-31)

- This project is in-scope from `docs/projects/PROJECT_TRACKER.md` and should be treated as an active, partially-complete overhaul lane.
- `public/data/spells` is levelized:
  - level-0: 43
  - level-1: 68
  - level-2: 65
  - level-3: 67
  - level-4: 46
  - level-5: 58
  - level-6: 44
  - level-7: 26
  - level-8: 22
  - level-9: 20
- `public/data/spells_manifest.json` currently contains 459 entries.
- Validation/type surfaces are implemented:
  - `src/systems/spells/validation/spellValidator.ts`
  - `src/systems/spells/validation/SpellIntegrityValidator.ts`
  - `src/systems/spells/schema/spell.schema.json`
  - `src/types/spells.ts`
- Runtime execution and loading are present but split:
  - `src/commands/factory/SpellCommandFactory.ts` (structured command execution)
  - `src/utils/character/spellAbilityFactory.ts` (spell-to-ability bridge path)
  - `src/hooks/useAbilitySystem.ts` (execution integration edge)
  - `src/services/SpellService.ts` (manifest + lazy spell fetch)
  - `src/context/SpellContext.tsx` (bundle-based eager spell load from `spells_bundle.json`)
- Targeting/effects coverage is in `src/systems/spells` and test-backed, but includes open implementation TODOs in target filters, area logic, and area-trigger handling.
- Existing docs repeatedly confirm migration-era percentages are no longer reliable; treat status documents as evidence buckets, not runtime truth tables.
- Protocol support docs now exist and are linked; the protocol-conversion slice is complete, not the active engineering task.
- The current forward lane is implementation-gap follow-through, starting from the highest-priority schema/trigger/targeting gaps recorded in `TRACKER.md` and `GAPS.md`.
- This refresh expanded the active gap inventory from the first six known rows into a broader high-priority backlog covering area entry/exit behavior, repeat saves, line-of-sight/cover, concentration cleanup, stale validation proof, and Level 0 status synchronization.

## Active Project Task

| Field | Value |
|---|---|
| Task | Move the protocol-complete project surface into first implementation follow-through by tracking the current status, expanding source-backed gaps, and selecting the next bounded engine slice. |
| Allowed scope | This refresh is docs/tracker only: `NORTH_STAR.md`, `TRACKER.md`, `TASK_SLICE.md`, and `GAPS.md`. The next slice may touch runtime/schema/source files only after the selected gap row is accepted. |
| Current owner | Worker D |
| Next action | Start with `SSO-ONMOVEINAREA-001` because it is the smallest high-leverage schema/runtime alignment gap; then continue into `SSO-AREA-ENTRY-EXIT-001` if the first-pass proof confirms trigger handling remains incomplete. |
| Verification done | Documentation evidence and bounded TODO/source marker search only; no runtime code or validation command was changed or executed in this pass. |

## Scope Boundaries

### In scope (this handoff)
- Evidence-based project memory.
- File-level anchors to current runtime/validation/command/data boundaries.
- Gap row creation for cross-session continuity.

### Adjacent but not in scope
- Editing source/runtime implementations.
- Fresh full-project refactors that exceed the active gap slice.

### Out of scope
- Non-spell-engine work not owned by this project.

## What Must Not Be Lost

- levelized spell file layout and manifest contract
- schema + validator + integrity layers
- evidence trail that the runtime is hybrid (`SpellService` + `SpellContext` bundle + command/ability bridge)
- explicit TODO-backed gaps (do not assume these are done because files exist)

## Critical Evidence Pointers

- `docs/projects/PROJECT_TRACKER.md`
- `docs/projects/GLOBAL_GAPS.md`
- `docs/spells/SPELL_INTEGRATION_CHECKLIST.md`
- `docs/spells/STATUS_LEVEL_0.md`, `docs/spells/STATUS_LEVEL_1.md`, `docs/spells/STATUS_LEVEL_2.md`, etc.
- `docs/projects/spells/SUBPROJECTS.md`
- `docs/projects/spells/subprojects/*/GAPS.md`
- `docs/projects/spells/NORTH_STAR.md`
- `docs/projects/spells/SUBPROJECTS.md`
- `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`
- `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`
- `docs/projects/spells/subprojects/targeting-object-area/GAPS.md`
- `docs/architecture/SPELL_SYSTEM_ARCHITECTURE.md`

## Resume Path For A Cold Agent

1. Read this file, then `TRACKER.md`, then `GAPS.md`.
2. Read `TASK_SLICE.md` for the currently bounded action.
3. Use `docs/projects/spells/SUBPROJECTS.md` and the relevant child `GAPS.md` file for the live priority surface.
3. Confirm current code anchors in:
   - `src/systems/spells/validation/spellValidator.ts`
   - `src/systems/spells/validation/SpellIntegrityValidator.ts`
   - `src/systems/spells/targeting/TargetResolver.ts`
   - `src/systems/spells/targeting/AoECalculator.ts`
   - `src/systems/spells/effects/triggerHandler.ts`
   - `src/commands/factory/SpellCommandFactory.ts`
4. Start from the first active row in `TRACKER.md` and use `GAPS.md` rows as source-backed acceptance criteria.

## Supporting Protocol Files

- `TRACKER.md` — active queue, blockers, and gap ownership.
- `TASK_SLICE.md` — bounded next action and stop condition.
- `GAPS.md` — durable unresolved findings.
- `DECISIONS.md` — key project-level choices and alternatives.
- `AUDIT_OR_PROOF.md` — verification notes and pass scope.
- `RUNBOOK.md` — repeatable operator workflow.
- `ARCHITECTURE_NOTE.md` — project-level architecture map for current ownership seams.
- `docs/projects/PROJECT_TRACKER.md` — registry row and cross-project routing.

## Uncertainties (Open, to verify before next engineering changes)

- The exact split and synchronization behavior between `spells_bundle.json` (used by `SpellContext`) and manifest-based `SpellService` loading has not been end-to-end proven in this pass.
- Several TODO notes in runtime files likely reflect intended behavior that is only partially wired; each should be validated with targeted tests before closure.
- Repeat-save behavior has tests and schema surface; use current child gap files and proof logs rather than the retired mixed TODO before treating timing or UI behavior as complete.
- Validation/data-status claims that once lived in `TODO.md` have been routed into Spells child lanes and still need fresh command proof before implementation priority is locked.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/NORTH_STAR.md","sha256WithoutMarker":"63b2407fbdc9a276321ea3072216ce1a4f452d0dd968bc14cce6fa9add4875e2","markedAtUtc":"2026-06-25T22:29:38.668Z"} -->
