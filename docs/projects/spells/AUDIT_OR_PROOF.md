# Spells Audit / Proof

Status: active
Last updated: 2026-06-11

Use this file for durable proof summaries, scoped verification notes, and acceptance evidence. Do not paste raw logs unless a short excerpt is required for later agents to understand the result.

## Proof Log

| Date | Check | Result | Evidence |
|---|---|---|---|
| 2026-06-10 | Required-doc surface initialized | pass | `docs/projects/spells/NORTH_STAR.md` declares this file in `required_docs`; schema migration created the file for audit-clean doc coverage. |
| 2026-06-10 | G2 target allocation no-current-row closure | pass | Corpus scan found 0 `targeting.allocation` rows; Sleep and Color Spray are not HP-pool allocation rows in current data; `npm run validate:spells -- --spell public/data/spells/level-1/color-spray.json` reported 459 valid / 0 invalid; focused allocation/integrity tests passed 23/23. |
| 2026-06-11 | G8 generic placeholder cleanup | pass | Cleared 9 `See description.` style effect placeholders across level-4 and level-5 spells; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit corpus audit reported 0 generic placeholders and 148 blank descriptions remaining. |
| 2026-06-11 | G9 level-0 blank-description batch | pass | Filled 27 blank level-0 effect descriptions without changing modeled dice, saves, targeting, or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit audit reported blankDescriptionCount 121, level0BlankDescriptionCount 0, and genericDescriptionCount 0. |
| 2026-06-11 | G9 level-1 first blank-description batch | pass | Filled 24 blank level-1 effect descriptions from Absorb Elements through Fog Cloud without changing modeled dice, saves, targeting, or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit audit reported blankDescriptionCount 97, level1BlankDescriptionCount 26, and genericDescriptionCount 0. |
| 2026-06-11 | G9 level-1 remaining blank-description batch | pass | Filled the remaining 26 blank level-1 effect descriptions from Grease through Wrathful Smite without changing modeled dice, saves, targeting, or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit audit reported blankDescriptionCount 71, level1BlankDescriptionCount 0, and genericDescriptionCount 0. |
| 2026-06-11 | G9 level-2 blank-description batch | pass | Filled the 6 remaining blank level-2 effect descriptions across Find Steed, Mind Spike, Shatter, Warding Bond, and Web without changing modeled dice, saves, targeting, duration, scaling, or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit audit reported blankDescriptionCount 65, level2BlankDescriptionCount 0, and genericDescriptionCount 0. |
| 2026-06-11 | G9 impact-first DAMAGE blank-description batch | pass | Filled all 37 remaining blank DAMAGE effect descriptions across levels 3-8 from existing damage dice, save outcome, hit/always condition, and slot-scaling fields without changing modeled mechanics or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit audit reported blankDescriptionCount 28, damageBlankDescriptionCount 0, and genericDescriptionCount 0. |
| 2026-06-11 | G9 impact-first STATUS_CONDITION blank-description batch | pass | Filled all 26 remaining blank STATUS_CONDITION effect descriptions from current statusCondition, save, duration, repeat-save, escape-check, and save-modifier fields without changing modeled mechanics or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; post-edit audit reported blankDescriptionCount 2, statusBlankDescriptionCount 0, genericDescriptionCount 0, and grammarHitCount 0. |
| 2026-06-11 | G9 final blank-description closure | pass | Filled the final SUMMONING and HEALING blank descriptions for Conjure Animals and Regenerate without changing modeled mechanics or runtime schema; validator reported 459 valid / 0 invalid; SpellIntegrityValidator passed 4 tests; final audit reported blankDescriptionCount 0, genericDescriptionCount 0, and grammarHitCount 0. |
| 2026-06-11 | G9 blank/generic description regression gate | pass | Added SpellIntegrityValidator Rule 5 and focused regression tests so blank effect descriptions and generic placeholders now fail the validator/test suite; `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 7 tests and `npm run validate:spells -- --spell public/data/spells/level-7/regenerate.json` reported 459 valid / 0 invalid. |

| 2026-06-11 | G5 monolithic-effect regression gate | pass | Promoted the all-spell monolithic-effect scan in SpellIntegrityValidator.test.ts from soft warning to hard zero-hit assertion after G5 cleared the corpus hit list; `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 7 tests. |

| 2026-06-11 | Choice ability-bridge parity verification | pass | Ran focused verification for the mode-choice ability bridge and command factory: `npm run test -- src/utils/character/__tests__/spellAbilityFactory.test.ts` passed 6 tests and `npm run test -- src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` passed 6 tests. Closed `SSO-ABILITY-BRIDGE-PARITY-001`; broader UI/per-target choice rows remain open. |

| 2026-06-11 | Choice hook collection verification | pass | Ran `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts`; 15 tests passed with 2 skipped. The covered tests prove mode-choice `playerInput`, single-target per-target choice handoff, and multi-target `perTargetChoicesByTargetId` handoff into `SpellCommandFactory`; rendered modal proof and Enhance Ability command/runtime application remain separate open rows. |

| 2026-06-11 | Enhance Ability per-target runtime verification | pass | Verified the remaining per-target choice runtime path: `npm run test -- src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` passed 6 tests and proves each target receives its selected Enhance Ability advantage/status; added `src/utils/character/__tests__/checkUtils.test.ts` and `npm run test -- src/utils/character/__tests__/checkUtils.test.ts` passed 1 test proving ability-specific advantage text does not leak globally; dependency sync ran for `src/utils/character/checkUtils.ts`. Rendered status visibility remains under combat-map visualization rows. |

| 2026-06-11 | Repeat-save family verification | pass | Ran focused repeat-save/status verification: `StatusConditionCommand.test.ts` passed 4 tests, `useCombatEngine.repeatSaves.test.ts` passed 9 tests, `SpellCommandFactoryStatus.test.ts` passed 3 tests, `useTurnManager.repeatSaves.test.ts` passed 1 test, and `useCombatEngine.scheduledEffects.test.ts` passed 5 tests. Together with prior `useAbilitySystem.test.ts` hook proof, current known repeat-save metadata families are verified; persistence/manual-state caveats and rendered visibility remain separate follow-ups. |

| 2026-06-11 | Target resolver and LoS policy verification | pass | Ran focused targeting proof: `npm run test -- src/systems/spells/targeting/__tests__/TargetResolver.test.ts` passed 13 tests, `npm run test -- src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts` passed 8 tests, and `npm run test -- src/utils/spatial/__tests__/lineOfSight.test.ts` passed 10 tests. Closed resolver-level `validTargets`, mixed supplied-object aggregation, and LoS mapless policy parity rows; object registry/selection/command-envelope and cover/visual proof rows remain open. |

| 2026-06-11 | Spell trigger schema/type drift verification | pass | Verified `on_move_in_area` trigger/schema/type drift closure: `npm run test -- src/systems/spells/validation/__tests__/effectTriggers.test.ts` passed 1 test, `npm run test:types` passed after refreshing stale tsd fixtures and restoring `RacialRestChoiceData`, and `npm run validate:spells -- --spell public/data/spells/level-1/grease.json` reported 459 valid / 0 invalid. Dependency sync ran for `src/types/character.ts`. |

## G7 Spell Validator/Type Contract Ownership Scorecard

Date: 2026-06-10
Status: routed / scorecard complete

### Evidence Snapshot

| Surface | Current evidence | Ownership score | Split guidance |
|---|---|---|---|
| `src/systems/spells/validation/spellValidator.ts` | 994 lines; hand-authored Zod schema/enums with dependency header and runtime validation exports. | high runtime-contract ownership | Do not split by file size alone. Extract only by schema domain after a validation test names the moved contract. |
| `src/systems/spells/validation/spellValidator.d.ts` | 1553 lines; declaration surface for `SpellValidator` and generated/type-facing schema shape. | generated/declaration-risk ownership | Treat as declaration/provenance surface. Do not manually shard without knowing the declaration generation path. |
| `src/types/spells.ts` | 1152 lines; broad spell contract/barrel with many dependents and imports from existing modular spell type files, including `spellTargeting`. | high public-type ownership | Prefer moving ownership into existing modular type files only when import compatibility and dependent tests are named. |
| `src/types/spells.d.ts` | 710 lines; declaration surface with broad spell interfaces and dependents. | generated/declaration-risk ownership | Keep in sync with the source type contract; avoid direct edits unless declaration provenance requires it. |

### Routing Decision

G7 is a scoring/routing gap, not authorization for a physical split. The safe next implementation shape is a proof-first extraction plan:

1. Choose one schema/type subdomain, such as targeting, lifecycle, status, or spell metadata.
2. Identify the source-of-truth file and declaration-generation path before moving code.
3. Preserve existing exports from `src/types/spells.ts` and `src/systems/spells/validation/spellValidator.ts` unless a caller audit proves the break is safe.
4. Run `npm run validate:spells -- --spell <path>` plus focused spell validation tests after any split.
5. If exported signatures move, run the Aralia dependency sync required by `AGENTS.md` for `types` or `state` changes.

### Proof Boundary

This scorecard satisfies the G7 prerequisite from code-modularization audit CMA-G9: validator/type ownership has been scored before physical split work. It does not claim that a split has been implemented.

## Standing Verification Notes

- Project folder: `docs/projects/spells`
- Schema source: `docs/projects/PROJECT_CARD_SCHEMA.md`
- North Star last updated date during initialization: `2026-06-05`
- Future agents should extend this file with scoped proof from the active tracker task. G7 now has a validator/type ownership scorecard; any future physical split must preserve declaration provenance and run the named spell validation checks.
