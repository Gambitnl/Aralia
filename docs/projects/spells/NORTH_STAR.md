---
schema_version: 1
project: Spells
slug: spells
category: active project
main_category: "Content & Rules"
subcategory: "Rules, Spells & Source Data"
status: active
last_updated: 2026-06-20
iteration: 2
confidence: unknown
evidence: "docs/projects/spells/TRACKER.md; docs/projects/spells/GAPS.md"
gap_signal: 0 open gaps; G10-G13 are resolved; SUBPROJECTS.md routes broad spell lanes before gap import
protocol: living-project
next_step: Resume from TRACKER.md and keep the gap log aligned.
project_mode: parent_with_subprojects
subproject_tracker: docs/projects/spells/SUBPROJECTS.md
subproject_count: 8
subproject_signal: "8 tracked lanes; spell-system-overhaul, spell-completeness-audit, and docs/tasks/spells route under Spells; scripts-spell-runtime-template-audit is linked support"
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - SUBPROJECTS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
required_verification:
  - docs consistency
completed_verification:
  - docs refresh
  - SpellIntegrityValidator monolithic soft-hit proof
  - status docs inventory-runtime boundary refresh
last_proof: 2026-06-20
workflow_gaps_reviewed: ""
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Spells System North Star

Status: active
Last updated: 2026-06-20

## Dashboard Card Schema

| Field | Value |
|---|---|
| Project | Spells |
| Slug | spells |
| Category | active project |
| Status | active |
| Confidence | unknown |
| Evidence | docs/projects/spells/TRACKER.md; docs/projects/spells/GAPS.md |
| Gap signal | 0 open gaps; G10-G13 resolved; SUBPROJECTS.md routes broad spell lanes |
| Protocol | living-project |
| Next step | Resume from TRACKER.md and keep the gap log aligned. |
| Required verification | docs consistency |
| Completed verification | docs refresh; spell integrity proof; placeholder-description audit; concentration, duration progression, mode-choice, and action-cost validator gates |
| Last proof | 2026-06-20 concentration, ritual, duration progression, mode-choice, and action-cost validator gates |
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
- `SUBPROJECTS.md` now makes Spells a parent project with owned lanes for structured execution, completeness audit, mechanics-discovery packages, choice/mode execution, targeting/object/area behavior, summons/control, and validator integrity.
- Each subproject lane now has a nested full project packet under `docs/projects/spells/subprojects/<subproject-id>/`.
- `docs/spells/STATUS_LEVEL_*.md` files are inventory and orientation notes, not behavior-complete runtime proof; use validation scripts and focused runtime tests before claiming a level or spell is execution-ready.

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
| Spell references | `docs/spells/*`; `docs/spells/reference/*`; `docs/projects/PROJECT_TRACKER.md` | Operational guidance and per-level inventory/status context; not standalone runtime-readiness proof |

## Known Gaps And Follow-Ups

| Gap | Classification | Owner | Evidence | Next proof/action |
|---|---|---|---|---|
| G1 trigger ontology for `on_move_in_area` | done | Working agent | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` | Completed; focused trigger tests and spell validation passed on 2026-06-10 |
| G2 target allocation bridge | done | Working agent | `src/systems/spells/targeting/TargetAllocator.ts`; `src/systems/spells/targeting/TargetResolver.ts`; `src/hooks/useAbilitySystem.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/systems/spells/validation/__tests__/targetingAllocation.test.ts`; `docs/projects/spells/DECISIONS.md` D2 | Completed with no-current-row decision; reopen only when concrete canonical spell data requires `targeting.allocation` |
| G3 duplicate trigger paths | done | Working agent | `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` | Completed; tracker delegates entry/exit/end-turn effect selection to `triggerHandler` while keeping tracker-owned events |
| G4 processed source context | done | Working agent | `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/effects/__tests__/triggerHandler.test.ts` | Completed; processed trigger effects retain source context for downstream save/DC logic |
| G7 validator/type contract modularization | done | Working agent | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/spellValidator.d.ts`; `src/types/spells.ts`; `src/types/spells.d.ts`; `docs/projects/spells/AUDIT_OR_PROOF.md` | Ownership scorecard complete; future split work must preserve runtime-schema, public-type, and declaration provenance boundaries |
| G8 generic effect placeholder cleanup | done | Working agent | `public/data/spells/level-4/find-greater-steed.json`; `public/data/spells/level-4/galders-speedy-courier.json`; `public/data/spells/level-4/guardian-of-nature.json`; `public/data/spells/level-4/staggering-smite.json`; `public/data/spells/level-4/summon-greater-demon.json`; `public/data/spells/level-5/bigbys-hand.json`; `public/data/spells/level-5/circle-of-power.json`; `public/data/spells/level-5/conjure-volley.json`; `public/data/spells/level-5/control-winds.json` | Completed; corpus audit now reports 0 generic placeholders |
| G9 blank effect descriptions | done | Working agent | `public/data/spells/level-3/*.json`; `public/data/spells/level-4/*.json`; `public/data/spells/level-5/*.json`; `public/data/spells/level-6/*.json`; `public/data/spells/level-7/regenerate.json`; `public/data/spells/level-8/abi-dalzims-horrid-wilting.json` | Completed; final audit reports 0 blank descriptions and 0 generic placeholders, now hard-gated by SpellIntegrityValidator |

## Runtime Proof Boundary For Status Docs

The `docs/spells/STATUS_LEVEL_*.md` files are useful for inventory and migration orientation, but they do not prove that every spell in a level has been re-exercised through character creation, spellbook/resource flow, command execution, combat effects, glossary display, and current validator/runtime contracts. Before claiming runtime readiness, use the status docs only as starting maps, then prove the claim with `npm run validate:spells -- --spell <path>`, `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`, and any mechanic-specific tests named by the active gap row.

## Relationship To `docs/tasks/spell-system-overhaul`

- `docs/tasks/spell-system-overhaul` is the active implementation roadmap and contains planning,
  TODOs, and historical batch notes.
- This project folder is the durable handoff layer: current state, file map, and unresolved
  follow-ups that should survive handoff and context shifts.

## Relationship To Subprojects

- `docs/projects/spells/SUBPROJECTS.md` is the routing map for broad spell lanes.
- Existing task surfaces that belong under Spells are `docs/tasks/spell-system-overhaul`, `docs/tasks/spell-completeness-audit`, and `docs/tasks/spells`.
- `docs/projects/scripts-spell-runtime-template-audit` is linked support, not a child runtime lane, unless it exposes a product behavior gap that should be imported here.
- Command runtime, Combat, Battle Map, Visibility, Glossary UI, and 3D Combat Map are adjacent dependencies, not Spells children.

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
| Status-doc boundary | Per-level status notes are inventory/orientation inputs and require validation plus targeted runtime tests before behavior-readiness claims | `docs/spells/STATUS_LEVEL_1.md`; `docs/projects/spells/GAPS.md` G6 |
| Active debt markers | Runtime and architecture debt are explicit and intentional | `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/systems/spells/targeting/TargetAllocator.ts` |
| Validator/type modularization boundary | G7 scorecard records why validator/type splitting must be proof-first and declaration-aware | `docs/projects/spells/AUDIT_OR_PROOF.md`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G9 |
| Effect-description completeness | G8 and G9 cleared generic and blank effect descriptions; SpellIntegrityValidator now hard-gates future blank/generic regressions | `docs/projects/spells/GAPS.md` G8-G9; `src/systems/spells/validation/SpellIntegrityValidator.ts` |
| Metadata parity gates | G10-G13 lock concentration tags, ritual tags, duration progression metadata, mode-choice menus, and action-cost metadata into corpus-wide validator proof | `docs/projects/spells/GAPS.md`; `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` |

## Supporting Files

| File | Purpose | Status |
|---|---|---|
| docs/projects/PROJECT_TRACKER.md | Repo-level registration | active |
| docs/projects/GLOBAL_GAPS.md | Cross-project routing surface | active |
| docs/spells/* | Current spell references and status notes | active |
| docs/projects/spells/TRACKER.md | Queue + gap workflow for this project | active |
| docs/projects/spells/GAPS.md | Durable unresolved findings | active |
| docs/projects/spells/SUBPROJECTS.md | Parent-project lane routing and existing-project classification | active |
| docs/projects/spells/subprojects/* | Full nested setup packets for each Spells subproject lane | active |

## Resume Path For A Cold Agent

1. Read this file.
2. Read `docs/projects/spells/TRACKER.md`.
3. Read `docs/projects/spells/GAPS.md`.
4. Read `docs/projects/spells/SUBPROJECTS.md` before importing broad task or audit findings into `GAPS.md`.
5. Re-run `npm run validate:spells -- --spell <path>` or the relevant corpus validation command, then run `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` plus any mechanic-specific tests named by the active gap row.
6. Treat `docs/spells/STATUS_LEVEL_*.md` as inventory/orientation only, not runtime proof.
7. Continue with the first in-project gap that has external verification, or use `SUBPROJECTS.md` to choose the next high-impact lane when `GAPS.md` has no open rows.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md`, `GAPS.md`, and `SUBPROJECTS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
