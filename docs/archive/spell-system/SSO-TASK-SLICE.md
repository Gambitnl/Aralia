> **ARCHIVED 2026-07-01 — exhausted SSO slice log (formerly `docs/tasks/spell-system-overhaul/TASK_SLICE.md`).**
> The 2026-05-31 slice named in the header completed long ago and the 2026-06-25 tail already
> self-annotated this file as "not the current execution queue". Live obligations live in
> `docs/tasks/spell-system-overhaul/TRACKER.md` (historical index) and the child lanes under
> `docs/projects/spells/subprojects/`; start from `docs/projects/spells/SUBPROJECTS.md`.

# Structured Spell Execution Active Task Slice

Status: active
Owner: Worker D
Last updated: 2026-05-31
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Objective

Implement `SSO-AREA-MOVE-WITHIN-COVERAGE-001`: add focused tests for the existing `AreaEffectTracker.processMovementWithin` behavior before any broader area-trigger refactor.

## Why This Slice Exists

The active workflow is evidence-first. The previous investigation showed `on_move_in_area` runtime behavior already exists but lacked the TODO-listed Spike Growth-style test coverage. This slice adds those tests without changing runtime behavior.

## Acceptance Criteria

- Focused tests cover the documented `processMovementWithin` TODO cases.
- Runtime behavior remains unchanged.
- `TRACKER.md`, `GAPS.md`, and `AUDIT_OR_PROOF.md` record the investigation result.
- Verification remains explicit and pending until the focused test file is run.

## Allowed Boundaries

Files or systems this slice may touch:
- `docs/tasks/spell-system-overhaul/TRACKER.md`
- `docs/tasks/spell-system-overhaul/GAPS.md`
- `docs/tasks/spell-system-overhaul/TASK_SLICE.md`
- `docs/tasks/spell-system-overhaul/AUDIT_OR_PROOF.md`
- `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts`

Files this slice should not touch:
- Runtime implementation files
- Broad JSON schema generation or schema architecture repair
- Object targeting, repeat saves, concentration, or line-of-sight work
- Project registry rows unless a registry link or status is actually stale

## Stop Condition

Stop after movement-within coverage is added and the docs record verification as pending. Do not refactor area runtime paths or change spell JSON in this slice.

## Verification

| Check | Command or evidence source | Expected result |
|---|---|---|
| Movement-within coverage | `AreaEffectTracker.test.ts` | Multi-tile, diagonal, crossing, and `first_per_turn` cases are present |
| Runtime behavior | `AreaEffectTracker.ts` | Unchanged in this slice |
| Project docs | `TRACKER.md`, `GAPS.md`, `AUDIT_OR_PROOF.md` | Investigation state and next actions are recorded |

## Known Inputs

| Input | Location | Notes |
|---|---|---|
| Current surface | `docs/tasks/spell-system-overhaul/NORTH_STAR.md` | Starting point and evidence anchors |
| Project registry | `docs/projects/PROJECT_TRACKER.md` | Existing registry row should be updated rather than duplicated |
| Live backlog | `docs/projects/spells/SUBPROJECTS.md` plus the relevant Spells child `GAPS.md` file | High-priority and medium-priority implementation gaps migrated from the retired mixed TODO |
| Current tracker | `docs/tasks/spell-system-overhaul/TRACKER.md` and `GAPS.md` | Active rows and gap classifications |
| Runtime area path | `src/systems/spells/effects/AreaEffectTracker.ts` | Existing movement-through-zone implementation |
| Area tests | `AreaEffectTracker.test.ts` | Existing test file and explicit missing cases |

## Risks And Constraints

- Scope drift is likely if this coverage slice turns into a broad runtime rewrite; keep implementation to tests only.
- Existing historical task docs are noisy and partial; do not delete or collapse them.
- Existing entry/exit/end-turn support does not prove movement-through-zone behavior or geometry parity.
- Keep all additions additive and non-destructive.

## Completion Notes

`SSO-AREA-MOVE-WITHIN-COVERAGE-001` test coverage was added for existing runtime behavior. Automated verification was not run in this pass; the gap remains waiting until the focused test file is executed.

## Current bounded slice - repeat-save lifecycle - 2026-05-31

Active slice: repeat-save lifecycle gap investigation and first implementation target.

Decision from evidence:
- Do not build a parallel repeat-save system.
- Preserve the existing combat-engine repeat-save processor.
- Move the work toward typed, end-to-end propagation and proof.

Immediate implementation target:
- Confirm the spell application command path for status conditions.
- If metadata is dropped, preserve 
epeatSave, escapeCheck, and break-trigger metadata when constructing runtime status effects.
- Add focused tests around real spell/status application rather than only manually constructed status effects.

Non-goals for this slice:
- Do not redesign all condition state.
- Do not replace the combat engine repeat-save processor.
- Do not migrate every spell in one pass unless a single migration is required to prove the path.

## Slice result - repeat-save metadata propagation - 2026-05-31

Completed in this slice:
- Preserve status-condition repeat-save metadata during runtime status application.
- Add typed metadata fields to combat runtime condition mirrors.
- Add a focused test case that protects metadata propagation.

Pending before this slice can be called verified:
- Execute the targeted status-condition command tests.
- Confirm no type errors from the added metadata imports and fields.

Next active target:
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001: prove the existing engine entry points for on_damage and on_action, especially with damage-triggered advantage and action-specific escape behavior.

## Slice result - repeat-save timing coverage - 2026-05-31

Completed in this slice:
- Added focused repeat-save timing coverage for combat engine entry points.
- Covered damage-triggered repeat saves with dvantageOnDamage.
- Covered action-triggered repeat saves with target effect id filtering.

Pending before this slice can be called verified:
- Run the targeted engine repeat-save test file.
- Run or otherwise confirm the related status-condition command metadata test still compiles.

Next active target:
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001: prove that a real spell with repeat-save metadata flows through validation/factory/application/runtime instead of only using manually constructed runtime status effects.

## Slice result - real spell repeat-save proof - 2026-05-31

Completed in this slice:
- Added real-data proof for Hold Person repeat-save propagation.
- The proof uses generated spell data from INGESTED_MONSTERS rather than a synthetic spell object.
- The proof crosses factory creation and status-condition command application.

Pending before this slice can be called verified:
- Run the focused factory status tests.
- Run the focused status-condition command metadata test.
- Run the focused combat-engine repeat-save timing test.

Next active target:
- Either verify the repeat-save slices if test execution is approved, or continue evidence-first investigation on the next tracked Structured Spell Execution gap.

## Slice result - repeat-save typed-state cleanup - 2026-05-31

Completed in this slice:
- Tightened combat-engine repeat-save typing.
- Removed the loose status-effect repeat-save cast from the engine path.
- Made unsupported check-style repeat saves visible and trackable.

Pending before this slice can be called verified:
- Run targeted repeat-save tests.
- Confirm the new guard compiles cleanly against 
ollSavingThrow parameter types.

Next active target:
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001: determine whether existing check-resolution infrastructure can resolve repeat-save check entries, or implement a bounded resolver bridge.

## Slice result - repeat-save check resolution - 2026-05-31

Completed in this slice:
- Investigated whether existing ability-check infrastructure could be reused for repeat-save check entries.
- Added a local repeat-save check bridge in the combat engine because no suitable combat resolver was found.
- Added focused coverage for strength_check repeat-save resolution.

Pending before this slice can be called verified:
- Run the focused combat-engine repeat-save test file.
- Confirm typecheck accepts the new repeat-save check resolver and metadata typing.

Next active target:
- Continue the evidence-first gap workflow on the next tracked non-repeat-save gap, or run targeted verification if approved.

## Slice result - turn-start repeat-save lifecycle - 2026-05-31

Completed in this slice:
- Wired turn-start repeat-save timing into useTurnManager.
- Added focused hook-level test coverage for turn-start repeat saves.

Pending before this slice can be called verified:
- Run the focused useTurnManager.repeatSaves.test.ts file.
- Run the related repeat-save engine tests if validating the full timing cluster.

Next active target:
- Continue evidence-first investigation on repeat-save progression/prerequisites, or move to another tracked project gap.

## Slice result - repeat-save prerequisite guard - 2026-05-31

Completed in this slice:
- Investigated repeat-save prerequisites and progression fields.
- Added a conservative guard for 
o_line_of_sight_to_caster prerequisites.
- Added focused coverage showing prerequisite-gated saves are skipped instead of incorrectly granted.

Pending before this slice can be called verified:
- Run the focused repeat-save engine test file.
- Confirm typecheck accepts the prerequisite helper and test shape.

Next active target:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001: determine whether existing line-of-sight infrastructure can be wired into repeat-save processing.

## Slice result - repeat-save line-of-sight prerequisite - 2026-05-31

Completed in this slice:
- Added caster-id preservation for applied spell status conditions.
- Wired 
o_line_of_sight_to_caster repeat-save prerequisites to existing map line-of-sight checks.
- Added focused repeat-save prerequisite tests for missing context and blocked line-of-sight.

Pending before this slice can be called verified:
- Run the focused combat-engine repeat-save test file.
- Confirm typecheck accepts the new sourceCasterId fields and line-of-sight import.

Next active target:
- Continue the broader gap workflow outside the repeat-save cluster unless verification is explicitly requested.

## Slice result - repeat-save source-caster backfill investigation - 2026-05-31

Completed in this slice:
- Investigated runtime repeat-save status construction outside StatusConditionCommand.
- Found no confirmed production path that applies repeat-save status metadata while dropping sourceCasterId.
- Reclassified the source-caster backfill gap as a persistence/manual-construction caveat.

Pending:
- Targeted tests remain unrun.
- Persisted combat-state migration remains unevaluated.

Next active target:
- Continue evidence-first investigation on another tracked project gap outside the repeat-save cluster.

## Slice result - object-target runtime resolver - 2026-05-31

Completed in this slice:
- Investigated object-target runtime support.
- Added a minimal object-target envelope and validation method to the targeting resolver.
- Added focused tests for object eligibility behavior.

Pending before this slice can be called verified:
- Run the focused TargetResolver tests.
- Confirm typecheck accepts the exported TargetableObject API and object eligibility helper.

Next active target:
- SSO-OBJECT-TARGET-REGISTRY-001: find or define the runtime source of targetable object candidates.

## Slice result - object-target candidate registry investigation - 2026-05-31

Completed in this slice:
- Investigated existing map decoration, battle-map tile rendering, and loot-drop systems as possible object target sources.
- Rejected them as unsafe candidates for spell object targeting.
- Routed the unresolved candidate-source problem to both project and global gap tracking.

Pending:
- No implementation change in this slice because no suitable existing object source was found.
- Object targeting remains validation-ready but not selection-ready.

Next active target:
- SSO-VALIDTARGETS-SEMANTICS-001: clarify and implement the caller-side semantics for creature-only, object-only, and mixed creature-or-object target requests.

## Slice result - validTargets mixed category semantics - 2026-05-31

Completed in this slice:
- Fixed resolver semantics for mixed creature/object valid-target categories.
- Added focused tests for mixed target behavior.

Pending before this slice can be called verified:
- Run focused TargetResolver tests.
- Confirm typecheck accepts the resolver updates.

Next active target:
- Either continue targeting with SSO-MIXED-TARGET-AGGREGATION-001, or move to the next tracked Structured Spell Execution gap outside object targeting.

## Slice result - mixed target aggregation API - 2026-05-31

Completed in this slice:
- Added a mixed target aggregation API to TargetResolver.
- Added focused resolver coverage for mixed creature/object aggregation with supplied object candidates.

Pending before this slice can be called verified:
- Run focused TargetResolver tests.
- Confirm typecheck accepts the new exported TargetCandidateSet API.

Next active target:
- Continue to the next non-object project gap, since object targeting now has validation and aggregation bridges but lacks an object registry.

## Slice result - JSON schema movement timing alignment - 2026-05-31

Completed in this slice:
- Confirmed on_move_in_area was present in TypeScript/Zod but missing from JSON schema files.
- Added the timing value to the JSON schema recurring timing definitions.

Pending before this slice can be called verified:
- Run a schema validation or targeted schema test if available.
- Confirm whether spell.schema.json is generated from parts/ and should be regenerated by tooling.

Next active target:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: investigate JSON schema source-of-truth and full trigger-object parity.

## Slice result - JSON schema recurring timing parity - 2026-05-31

Completed in this slice:
- Confirmed JSON schema parts are the intended source editing surface for schema definitions.
- Aligned RecurringMechanic.timing with on_move_in_area in TypeScript and Zod.
- Preserved the broader full-trigger-model gap instead of widening this slice into schema architecture work.

Pending before this slice can be called verified:
- Run schema registry check or regenerate aggregate from parts.
- Run targeted validator/schema tests if available.

Next active target:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: decide full trigger-model ownership/parity strategy.

## Slice result - JSON schema EffectTrigger parity - 2026-05-31

Completed in this slice:
- Confirmed full JSON-schema trigger model was absent.
- Added EffectTrigger to the schema part and aggregate schema.
- Updated schema registry tooling so the new definition remains assigned to a part.

Pending before this slice can be called verified:
- Run 
px tsx scripts/syncSpellJsonSchemaRegistry.ts --check.
- Run targeted schema/data validation if available.

Next active target:
- Continue the evidence-first workflow on another tracked project gap, unless verification is approved.

## Backlog-retirement review - 2026-06-25

This file is retained as a running slice log, not as the current execution
queue. Its last schema note was stale: the first 2026-06-25 schema check
failed because `targeting.allocation` existed in
`src/systems/spells/schema/parts/00-schema-root.json` but had not been
regenerated into `src/systems/spells/schema/spell.schema.json`. The aggregate
was regenerated from parts and the follow-up check passed.

Verified in this retirement pass:
- `npx tsx scripts\syncSpellJsonSchemaRegistry.ts --check` passes with 5
  schema parts after aggregate regeneration.
- `npm run test -- src\systems\spells\validation\__tests__\effectTriggers.test.ts --reporter=dot`
  passes 1 focused trigger test.

Do not restart `SSO-ONMOVEINAREA-001` or `SSO-JSON-SCHEMA-DRIFT-001` from this
old tail. Current executable work should start from `TRACKER.md`, `GAPS.md`,
and the owning Spells child project rows, especially
`SSO-AREA-MOVE-WITHIN-COVERAGE-001` when continuing movement-through-zone
behavior proof.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spell-system-overhaul/TASK_SLICE.md","sha256WithoutMarker":"ba368d500c0d65a09e36a3cd9ebf588c53f21bae3cbbe0bf9dc72963269ca454","markedAtUtc":"2026-06-25T22:29:38.334Z"} -->
