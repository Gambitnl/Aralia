# Spell validators and description-parsing fallbacks

Deepdive for Agora task agora-0a8d. Written 2026-09-20 by dd-spellval.
Planning surface: Plan Map topic `spells` (`public/planmap/topics.json`, campaign `world`, status `active`).
Project registry: `docs/projects/spells/GAPS.md`.

## 1. Verdict

Four spell validators exist, and three of them overlap. `spellValidator.ts` (Zod) is the only schema gate and must stay. `SpellIntegrityValidator.ts` holds 11 mechanical rules and is the only validator with a CI gate, but that gate runs through the test suite, not through `npm run validate`. `LegacySpellValidator.ts`, `spellAuditor.ts`, and `spellConsistencyValidator.ts` re-implement subsets of the same rules with weaker logic; retire all three and move their unique checks into `SpellIntegrityValidator`. The "silver standard" description-parsing fallback in `spellAbilityFactory.ts` is dead: exactly 1 of 473 spells (`counterspell`) has an empty `effects` array, and that spell returns zero inferred effects because its text has no dice. The real gap is not silver-standard prose parsing; it is that `createAbilityFromSpell` translates only 5 of the 9 effect types, so 23 spells build a combat `Ability` with an empty `effects` list.

## 2. Inventory

| File | Lines | What it does | Who calls it |
|---|---|---|---|
| `src/systems/spells/validation/spellValidator.ts` | 227 | Zod object schema for a spell JSON file, plus `.superRefine` checks for material-cost and material-consumption mismatch. Barrel for `./schemas/spellPrimitives` and `./schemas/spellEffectSchemas`. | `scripts/validate-data.ts:27`, `scripts/check-spell-integrity.ts:15`, `src/utils/validation/spellAuditor.ts:26`, `src/systems/spells/validation/__tests__/spellIntegrity/systematicAllSpellValidation.test.ts:3`, 12 Glossary spell-gate files. |
| `src/systems/spells/validation/SpellIntegrityValidator.ts` | 773 | 11 mechanical rules over a parsed spell: concentration sync, ritual sync, duration progression, mode choice, action cost, light metadata, enchantment targeting, upcast scaling, monolithic effect, effect-description completeness, effect target-filter completeness. Also exports a 14-row classified-exception list. | Tests only. 10 files under `src/systems/spells/validation/__tests__/spellIntegrity/`. No production or script caller. |
| `src/systems/spells/validation/LegacySpellValidator.ts` | 86 | Two hardcoded spell-ID sets (4 humanoid-only, 7 mental-immunity). Emits `missing_immunity_filter` warnings and `generic_targeting` errors. | `scripts/validate-data.ts:28` and `:73`. No test. |
| `src/utils/validation/spellAuditor.ts` | 131 | Runs `SpellValidator.safeParse`, then checks phantom scaling (higherLevels text without scaling logic) and non-standard `bonusPerLevel` strings. | `scripts/audit_spells.ts:13`, `src/utils/validation/__tests__/spellAuditor.test.ts:3`, barrel `src/utils/validation/index.ts:22`. |
| `src/utils/validation/spellConsistencyValidator.ts` | 122 | Enchantment-only description keyword checks: undead exclusion, charmed immunity (an empty block), break-on-damage. | `src/scripts/audit_enchantment_consistency.ts:5`, `src/utils/validation/__tests__/spellConsistency.test.ts:6`, barrel `src/utils/validation/index.ts:23`. |
| `src/utils/character/spellAbilityFactory.ts` | 675 | Converts a `Spell` into a combat `Ability`. Gold standard reads `spell.effects`; silver standard parses `spell.description`. | Production: `src/utils/combat/combatUtils.ts:1394`, 6 files under `src/systems/spells/mechanics/`, `src/systems/puzzles/arcaneGlyphSystem.ts:308`, 6 Design Preview scenario controls. Plus 9 test files. |

## 3. Findings

1. **`SpellIntegrityValidator` has no production or script caller.** Every non-test reference is inside the file itself (`SpellIntegrityValidator.ts:141`, `:710`). The only importers are the 10 test files in `src/systems/spells/validation/__tests__/spellIntegrity/`. Its rules therefore run only under `vitest`.

2. **`npm run validate` is not in CI.** `package.json:41` defines `validate` as charset + class-spell-lists + `scripts/validate-data.ts`. `.github/workflows/ci.yml` runs only `npx tsc --noEmit`, `npm run build`, `npm run lint`, `npm run scan`, `npm run test:types`, and `npm run test:bounded` (lines 96-196). The Zod schema gate and `LegacySpellValidator` never run on a pull request.

3. **`npm run validate` fails today.** `LegacySpellValidator.ts:51-67` raises a `generic_targeting` error for `friends`, because `public/data/spells/level-0/friends.json` sets `targeting.validTargets: ["creatures"]` and `filter.creatureTypes: []`. `scripts/validate-data.ts:77-80` counts that as an error and line 102 throws. Three more spells (`command`, `tashas-hideous-laughter`, `suggestion`) raise `missing_immunity_filter` warnings.

4. **The script name `validate:spell-integrity` does not run `SpellIntegrityValidator`.** `package.json:42` maps it to `scripts/check-spell-integrity.ts`, which imports `SpellValidator` and `CLASSES_DATA` only (`check-spell-integrity.ts:14-15`). The name is misleading.

5. **Three validators check enchantment targeting with three different methods.** `SpellIntegrityValidator.ts:727-760` uses the structured filter. `LegacySpellValidator.ts:20-30` uses two hardcoded ID sets. `spellConsistencyValidator.ts:40-60` greps the description text. No file references the other two.

6. **Two validators check upcast scaling.** `SpellIntegrityValidator.ts:520-534` ("Upcast Gap") fires when `higherLevels.length > 20`, the value is not `'None'`, no effect carries `bonusPerLevel` or `customFormula`, and the text does not contain "target". `spellAuditor.ts:78-103` ("phantom_scaling") fires on any non-empty `higherLevels` with no `bonusPerLevel`, `customFormula`, or `scalingTiers`. The second rule is broader and also reads `scalingTiers`, which the first rule ignores.

7. **The corpus holds 20 live "Enchantment Gap" rows and 23 live "Upcast Gap" rows, and no gate catches them.** The only hard enchantment gate is level 2 (`level2Regression.test.ts:44-45`), and level 2 is clean. `systematicAllSpellValidation.test.ts` hard-gates concentration, ritual, duration progression, mode choice, action cost, light metadata, monolithic effects, and effect descriptions, but neither enchantment targeting nor upcast scaling. Enchantment Gap rows: `friends`, `mind-sliver`, `vicious-mockery`, `command`, `compelled-duel`, `dissonant-whispers`, `hex`, `tashas-hideous-laughter`, `enemies-abound`, `charm-monster`, `hold-monster`, `modify-memory`, `ottos-irresistible-dance`, `power-word-pain`, `antipathy-sympathy`, `dominate-monster`, `feeblemind`, `power-word-stun`, `power-word-heal`, `power-word-kill`. Some of those are correct data: `power-word-kill` and `vicious-mockery` legally target any creature, so the rule is over-strict.

8. **`spellAuditor.ts` and `spellConsistencyValidator.ts` are unreachable from the application.** Nothing imports the `src/utils/validation` barrel (`index.ts:22-23`) except `src/utils/index.ts`. Their only real callers are two hand-run scripts, `scripts/audit_spells.ts` and `src/scripts/audit_enchantment_consistency.ts`, and neither has an npm script entry.

9. **The charmed-immunity rule in `spellConsistencyValidator.ts` is an empty block.** Lines 64-80 compute `appliesCharmed`, then push no issue. The block is a comment that describes a missing schema field.

10. **The test suite copies validator logic instead of importing it.** `systematicAllSpellValidation.test.ts:90-115` re-declares `normalizeFilterValues` and `sameFilterValues`, duplicating `SpellIntegrityValidator.ts:669-700`. The two copies can drift.

11. **`SpellIntegrityValidator` numbers its rules twice.** Rules 1-7 run in order, then the next four comment headers restart at "Rule 3: Upcast Scaling Sync" (`:507`), "Rule 4: Monolithic Effect Formulation" (`:536`), "Rule 5: Effect Description Completeness" (`:595`), "Rule 6: Effect Target Filter Completeness" (`:686`). Six numbers name two rules each.

12. **The silver-standard fallback is dead.** Of 473 spell JSON files, only `public/data/spells/level-3/counterspell.json` has `effects: []`. `spellAbilityFactory.ts:614-618` therefore calls `inferEffectsFromDescription` for that one spell, and that function returns an empty array because counterspell's description contains no `NdM <type> damage`, no `regains ... NdM`, and no "bonus to ac". Counterspell already has a dedicated runtime in `src/hooks/ability/useReactionSystem.ts` and `src/hooks/ability/useAbilityExecution.ts`.

13. **The hardcoded magic-missile branch is unreachable.** `spellAbilityFactory.ts:240-243` fires only when `spell.effects` is empty and the description mentions "magic missile". `magic-missile.json` has structured effects, so the branch never runs.

14. **The real translation gap is effect-type coverage, not prose.** `createAbilityFromSpell` handles `DAMAGE`, `HEALING`, `DEFENSIVE`, `STATUS_CONDITION`, and `UTILITY` (`spellAbilityFactory.ts:572-616`). The corpus also uses `MOVEMENT` (58 rows), `TERRAIN` (33), `SUMMONING` (22), and `ATTACK_ROLL_MODIFIER` (15). 108 spells carry at least one untranslated row. 23 spells produce an `Ability` with `effects: []`: `blade-ward`, `frostbite`, `mold-earth`, `bane`, `bless`, `find-familiar`, `fog-cloud`, `tensers-floating-disk`, `blur`, `find-steed`, `levitate`, `misty-step`, `summon-beast`, `conjure-animals`, `phantom-steed`, `summon-fey`, `summon-undead`, `summon-aberration`, `summon-construct`, `summon-elemental`, `summon-celestial`, `summon-dragon`, `summon-fiend`.

15. **An empty ability effect list hides the spell from combat AI.** `src/utils/combat/combatAI.ts` scores abilities from `ability.effects` at lines 163, 722, 739, 791, 889, 911, 1046, 1120, 1121. A zero-effect ability scores as neither damage, heal, nor buff. `SpellCommandFactory.ts:2276-2306` reads `spell.effects` directly and does cover all 9 types, so execution is correct once the AI or the player picks the spell.

16. **`scripts/quality/orphan-triage.json` is wrong about both files.** It marks `LegacySpellValidator.ts` and `SpellIntegrityValidator.ts` as `SALVAGE-CANDIDATE` with evidence "no static importer". `scripts/validate-data.ts:28` imports the first and 10 test files import the second. Generated 2026-08-26.

17. **`SpellIntegrityValidator.ts` carries a stale advisory header.** Lines 3-8 say "ISOLATED UTILITY or ORPHAN / Dependents: None (Orphan)", synced 2026-07-15.

18. **`spellFixtures.ts` describes a suite state that no longer exists.** Lines 20-27 say the Monolithic Effect rule is a soft warning with a "commented-out expect()" to uncomment in Phase 3. `systematicAllSpellValidation.test.ts:2467-2485` already hard-fails monolithic effects.

19. **`effectDescriptionCompleteness.test.ts` is 2210 lines of exact-string assertions.** After line 143 the file stops testing the validator and asserts literal description strings for named spells (for example `:165-168` for `warding-bond`). Any copy edit to a spell description breaks CI.

20. **`docs/projects/spells/GAPS.md` points at two files that do not exist.** Its front matter names `docs/projects/spells/NORTH_STAR.md` and `docs/projects/spells/TRACKER.md`; the directory holds only `GAPS.md` and `subprojects/`.

21. **`scripts/audit_spells.ts` prints only one of its three issue types.** Lines 49-57 filter to `phantom_scaling`, so `invalid_schema` and `complex_scaling` issues are computed and discarded.

22. **`src/scripts/audit_enchantment_consistency.ts` tells the reader to run a command that does not exist.** Line 62 prints "Run `npm run fix-enchantments` (hypothetical)".

## 4. Decisions for Remy

**Q1. Which spell validator stays?**

Options:
- A. Keep `spellValidator.ts` (schema) plus `SpellIntegrityValidator.ts` (rules). Retire `LegacySpellValidator.ts`, `spellAuditor.ts`, and `spellConsistencyValidator.ts` after moving their unique checks into `SpellIntegrityValidator`.
- B. Keep all five and document which one owns which rule.
- C. Merge everything into one file.

Recommendation: A. Option B keeps three re-implementations of the same enchantment rule alive. Option C loses the useful split between schema shape and mechanical rules. The unique checks worth moving are `spellAuditor`'s `scalingTiers` read and its `bonusPerLevel` format check.

**Q2. Should the enchantment-targeting rule stay as written?**

Options:
- A. Keep the rule and repair all 20 spells so each single-target enchantment declares a creature-type gate.
- B. Narrow the rule to enchantments whose 2024 text names a creature-type restriction, and clear the rest.
- C. Delete the rule.

Recommendation: B. `power-word-kill`, `power-word-heal`, `vicious-mockery`, and `hex` legally target any creature under 2024 rules, so option A would force false data. Option C loses a real gate on spells such as `charm-monster`.

**Q3. Where does the data gate run?**

Options:
- A. Add `npm run validate` to the CI workflow and repair `friends` first.
- B. Move the `LegacySpellValidator` checks into the vitest suite, which CI already runs, and leave `npm run validate` as a local command.
- C. Leave it out of CI.

Recommendation: B. The vitest suite already loads the whole corpus in `spellFixtures.ts`, CI already runs it, and it avoids a second full-corpus pass in the pipeline.

## 5. Follow-up work

1. **Retire `LegacySpellValidator.ts` into `SpellIntegrityValidator`.** Move its two ID sets behind the structural enchantment rule, repoint `scripts/validate-data.ts:28,73`, delete the file. Acceptance: no importer of `LegacySpellValidator` remains; `npm run validate` exits 0; the enchantment coverage is asserted in the vitest suite.
2. **Retire `spellAuditor.ts` and `spellConsistencyValidator.ts`.** Move the `scalingTiers` read and the `bonusPerLevel` format check into the Upcast rule. Delete the empty charmed-immunity block. Repoint `scripts/audit_spells.ts` and `src/scripts/audit_enchantment_consistency.ts` or delete them with their barrel exports. Acceptance: `src/utils/validation/index.ts` no longer exports either module; the moved checks have unit tests.
3. **Add all-level hard gates for Enchantment Gap and Upcast Gap.** Acceptance: `systematicAllSpellValidation.test.ts` gains two "hard-fails ... across all spells" tests; the corpus is either repaired or the rule is narrowed per Q2; the suite passes.
4. **Translate `MOVEMENT`, `TERRAIN`, `SUMMONING`, and `ATTACK_ROLL_MODIFIER` in `spellAbilityFactory.ts`.** Acceptance: no spell in `public/data/spells/**` produces an `Ability` with an empty `effects` array; a corpus test asserts that; `combatAI.ts` can score `bless`, `bane`, `blur`, and the summon family.
5. **Delete the silver-standard description parser.** Remove `inferEffectsFromDescription`, the magic-missile branch, and the text fallbacks in `inferAoE`. Give `counterspell` structured effects or an explicit empty-effects contract. Acceptance: `spellAbilityFactory.ts` reads only structured data; the file header no longer claims a silver standard.
6. **Rename `validate:spell-integrity` and repair the stale headers.** Acceptance: the npm script name matches what `scripts/check-spell-integrity.ts` does; `SpellIntegrityValidator.ts` no longer says "Orphan"; `spellFixtures.ts` no longer describes a soft-warning phase; the duplicate rule numbers are unique.
7. **Import the filter helpers in the test instead of copying them.** Acceptance: `systematicAllSpellValidation.test.ts` imports the normalization helpers from `SpellIntegrityValidator`; the local copies are gone.

## 6. Workflow gaps

Four gaps were found and filed: the stale `orphan-triage.json` dispositions, the CI gap for `npm run validate`, the missing `NORTH_STAR.md` and `TRACKER.md` named by `docs/projects/spells/GAPS.md`, and the misleading `validate:spell-integrity` script name. See the Agora gap registry for `workflow`.
