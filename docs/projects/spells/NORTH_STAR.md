# Spells System North Star

Status: active
Last updated: 2026-06-05

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Spells |
| Slug | spells |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/spells/TRACKER.md; docs/projects/spells/GAPS.md |
| Gap signal | present |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh |
| Last proof | 2026-06-05 docs refresh |
| Workflow gaps reviewed | yes |

## Why This Project Exists

This project keeps the broad spell system ownership from being lost as it remains partially
migrated in code but split across task docs, schemas, hooks, and gameplay integration.

## Intended Outcome

Preserve source-backed context for what is already implemented, what is still incomplete, and where to continue execution.

## Current State

- Spell core and validation surfaces are active in `src/systems/spells`.
- Combat integration exists through command and hook adapters.
- Manifest and schema checks are wired via focused spell scripts.
- Overhaul task docs provide implementation intent history, not the live runtime contract.

## Active Task

| Field | Value |
|---|---|
| Task | Build a concrete living snapshot of implemented spell runtime state and unresolved gaps. |
| Acceptance criteria | `NORTH_STAR.md`, `TRACKER.md`, and `GAPS.md` contain concrete file mapping, in-project gaps, integration points, and verification actions. |
| Allowed boundaries | Docs files under `docs/projects/spells`; read-only code/docs/scripts references. |
| Stop condition | Documentation is complete with evidence-backed gaps and next-check actions. |
| Verification | Confirm referenced source paths and validation scripts resolve; capture status in tracker/gap rows. |
| Owner | Working agent |
| Next action | Keep entries synchronized with next implementation slice. |

## Scope Boundaries

In scope:
- Spells command and combat integration points.
- Spell schema, validation, targeting, effects, and mechanics ownership.
- Documentation-facing verification and gap surfacing for this subsystem.

Adjacent but not in this slice:
- Making new gameplay changes.
- Cross-project migrations outside spell runtime ownership.

Out of scope:
- Full backlog reclassification unrelated to spell mechanics.
- New implementation code in `src` and `scripts`.

## What Must Not Be Lost

- Evidence of partial implementations such as command-level scaling, area triggers, and concentration tracking.
- Known debt markers where logic is duplicated or intentionally deferred.
- The difference between schema validity and full runtime behavior.

## Concrete File Map

| Area | Key paths | Purpose |
|---|---|---|
| Spell model and schema | `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/schema/spell.schema.json`; `src/systems/spells/validation/*` | Canonical spell model, zod contracts, and modular validators |
| Targeting | `src/systems/spells/targeting/{TargetResolver,TargetValidationUtils,TargetAllocator,AoECalculator}.*` ; `src/systems/spells/targeting/gridAlgorithms/*` | Target filters, spatial geometry, and allocation helpers |
| Effects and triggers | `src/systems/spells/effects/{triggerHandler,AreaEffectTracker}.ts`; `src/systems/spells/effects/index.ts` | Trigger routing, zone lifecycle, and processed effect conversion |
| Mechanics helpers | `src/systems/spells/mechanics/{ScalingEngine,ConcentrationTracker,SavingThrowResolver,DiceRoller}.*` | Scaling, concentration, saves, and dice helpers |
| AI-assisted branch | `src/systems/spells/ai/{AISpellArbitrator,MaterialTagService}.ts` | AI arbitration and material tag handling |
| Command bridge | `src/commands/factory/SpellCommandFactory.ts`, `src/commands/base/SpellCommand.ts` | Spell JSON -> combat command conversion |
| Combat integration | `src/hooks/combat/engine/useCombatEngine.ts`, `src/hooks/combat/useActionExecutor.ts` | Runtime spell zones, movement debuffs, and reactive trigger handling |
| Validation scripts/tests | `scripts/validateSpellJsons.ts`; `scripts/check-spell-integrity.ts`; `src/systems/spells/validation/__tests__/*`; `src/utils/validation/spellAuditor.ts` | Corpus validation and integrity checks |
| Spell references | `docs/spells/*`; `docs/spells/reference/*`; `docs/projects/PROJECT_TRACKER.md` | Operational guidance and per-level status context |

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| `on_move_in_area` path is implemented at runtime but not accepted in validator enum | in_scope_now | Working agent | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/effects/AreaEffectTracker.ts` | Update enum and run `npx tsx scripts/validateSpellJsons.ts` |
| Target allocation logic exists but is not integrated into resolver flow | support_needed_now | Working agent | `src/systems/spells/targeting/TargetAllocator.ts`; comments in `src/systems/spells/targeting/TargetResolver.ts` | Wire allocation for pool-style spells and add regression tests |
| Trigger handling is duplicated between `triggerHandler.ts` and `AreaEffectTracker.ts` | support_needed_now | Working agent | `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/AreaEffectTracker.ts` | Choose one execution path and add shared behavior tests |
| Processed effects lose source context (spellId/casterId) | support_needed_now | Working agent | `src/systems/spells/effects/triggerHandler.ts` | Add typed source context and validate save/DC dependent flows |
| Effect scale and mode-choice behavior are present but not consistently wired for all families | support_needed_now | Working agent | `src/commands/factory/SpellCommandFactory.ts` | Run focused combat/repeatability checks for mixed effects |

## Relationship To `docs/tasks/spell-system-overhaul`

- `docs/tasks/spell-system-overhaul` is the active implementation roadmap and contains planning,
  TODOs, and historical batch notes.
- This project folder is the durable handoff layer: current state, file map, and unresolved
  follow-ups that should survive handoff and context shifts.

## Global Gap Imports

Check global gaps first:
`docs/projects/GLOBAL_GAPS.md`.

| Global gap ID | Imported? | Project destination | Scope rationale |
|---|---|---|---|
| none | no | none | Current gaps are owned by spell system implementation and not cross-project. |

## Evidence And Proof

| Evidence | What it proves | Location |
|---|---|---|
| Command and hook integration path | Spells can flow from JSON to combat execution through concrete adapters | `src/commands/factory/SpellCommandFactory.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/useActionExecutor.ts` |
| Validation pipeline | Structural and corpus checks are already running and enforce manifest/schema consistency | `src/systems/spells/validation/spellValidator.ts`; `scripts/validateSpellJsons.ts`; `scripts/check-spell-integrity.ts` |
| Active debt markers | Runtime and architecture debt are explicit and intentional | `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/targeting/TargetAllocator.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| docs/projects/PROJECT_TRACKER.md | Repo-level registration | active |
| docs/projects/GLOBAL_GAPS.md | Cross-project routing surface | active |
| docs/spells/* | Current spell references and status notes | active |
| docs/projects/spells/TRACKER.md | Queue + gap workflow for this project | active |
| docs/projects/spells/GAPS.md | Durable unresolved findings | active |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/spells/TRACKER.md`.
3. Read `docs/projects/spells/GAPS.md`.
4. Re-run `npx tsx scripts/validateSpellJsons.ts` and targeted spell-related tests.
5. Continue with the first in-project gap that has external verification.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
