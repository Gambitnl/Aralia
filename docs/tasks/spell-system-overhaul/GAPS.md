# Structured Spell Execution Gaps

Status: active
Last updated: 2026-06-15
Project display name: Structured Spell Execution
Legacy name / folder slug: Spell System Overhaul (`docs/tasks/spell-system-overhaul`)

## Gap Log

### SSO-HIGH-IMPACT-SHINING-SMITE-DESCRIPTION-183 - Shining Smite rows expose hit rider scaling and visibility payoff

Status: verified 2026-06-15.

Evidence:
- Current short-row inspection found public/data/spells/level-2/shining-smite.json had a terse Radiant damage row and a light utility row.
- The damage row omitted that the rider belongs to the next triggering weapon hit and did not expose +1d6 per slot level above 2.
- The light row omitted attack-roll Advantage against the lit target and the rule that the target cannot benefit from the Invisible condition.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Shining Smite rows to keep hit timing, Radiant damage scaling, Bright Light, attack Advantage, and Invisible-benefit denial visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Shining Smite rows tied to hit rider light and visibility facts" --reporter=dot failed because both rows omitted scaling or visibility/Advantage riders.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Shining Smite rows tied to hit rider light and visibility facts" --reporter=dot passed with 1 test passed and 278 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-2/shining-smite.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 279 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for next-hit rider tracking, attack-roll Advantage, Invisible-benefit denial, light emission, higher-slot damage scaling, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-CATNAP-DESCRIPTION-182 - Catnap row exposes break rules, rest payoff, lockout, and scaling

Status: verified 2026-06-15.

Evidence:
- Current short-row inspection found public/data/spells/level-3/catnap.json had one STATUS_CONDITION row that only said up to three willing creatures fall Unconscious for the spell duration.
- The row omitted visible 30-foot target scope, 10-minute duration, damage and shake/slap-awake early breaks, Short Rest payoff after the full duration, Long Rest lockout, and higher-slot target scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Catnap's Unconscious row to carry those standalone status-tooltip facts.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Catnap unconscious row tied to breaks rest payoff and scaling" --reporter=dot failed because Catnap still used the terse duration-only Unconscious row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Catnap unconscious row tied to breaks rest payoff and scaling" --reporter=dot passed with 1 test passed and 277 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/catnap.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 278 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Short Rest application, Long Rest lockout tracking, early wake action routing, damage-break handling, higher-slot target routing, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-SPIKE-GROWTH-DESCRIPTION-181 - Spike Growth terrain rows expose concentration, placement, damage cadence, and hazard recognition

Status: verified 2026-06-15.

Evidence:
- Current inspection showed Spike Growth already had terrain-row coverage, but the damaging terrain row omitted concentration duration and exact 150-foot placement, while the Difficult Terrain row used generic "spell duration" wording and did not expose the Search action plus Perception or Survival recognition gate.
- public/data/spells/level-2/spike-growth.json has separate damaging terrain and Difficult Terrain rows. Both rows feed tactical map/tooltips, so they need to stand alone without relying on top-level prose.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Spike Growth rows to keep the 20-foot-radius Sphere, 150-foot placement, 10-minute concentration duration, 2d4 Piercing per 5 feet traveled, Difficult Terrain, and Search recognition facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps terrain rows tied to area size and terrain type" --reporter=dot failed because Spike Growth still omitted concentration duration, exact placement range, and full Search action recognition.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps terrain rows tied to area size and terrain type" --reporter=dot passed with 1 test passed and 276 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-2/spike-growth.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 277 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for terrain recognition checks, Search action routing, Difficult Terrain movement cost, per-5-foot damage accounting, camouflaged-area visibility, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-AURA-LIFE-DESCRIPTION-180 - Aura of Life payload rows expose aura scope and duration

Status: verified 2026-06-15.

Evidence:
- Current inspection showed Aura of Life already had a focused wrapper test, but the sibling Necrotic resistance, Hit Point maximum protection, and 0-HP recovery rows still used generic "the aura" wording and omitted concentration duration or exact 30-foot aura scope.
- public/data/spells/level-4/aura-of-life.json has separate utility, defensive, prevention, and healing rows. The wrapper row already names the 30-foot moving aura, but the payload rows need to stand alone in UI/runtime summaries.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Aura of Life payload rows to keep 10-minute concentration duration, nonhostile creature scope, 30-foot aura geometry, Necrotic Resistance, Hit Point maximum protection, and start-turn 0-HP healing visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Aura of Life wrapper separate from resistance, maximum, and healing payload rows" --reporter=dot failed because the payload rows still omitted exact duration and 30-foot aura scope.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Aura of Life wrapper separate from resistance, maximum, and healing payload rows" --reporter=dot passed with 1 test passed and 276 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-4/aura-of-life.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 277 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Necrotic Resistance, Hit Point maximum protection, 0-HP start-turn healing, aura membership tracking, concentration enforcement, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-MAELSTROM-DESCRIPTION-179 - Maelstrom rows expose water geometry, start-turn save, pull, and terrain facts

Status: verified 2026-06-15.

Evidence:
- A bounded gpt-5.4-mini helper recommended save-loop controls, but those were already covered by recent SSO focused tests. The main thread selected Maelstrom as a clearer uncovered water/terrain-control row split.
- public/data/spells/level-5/maelstrom.json had separate damage, pull, terrain, and creation rows, but the damage and pull rows referred only to "the maelstrom", the terrain row used generic "spell duration" phrasing, and the creation row omitted the ground/body-of-water placement and sibling-row relationship.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Maelstrom rows to keep 30-foot-radius, 5-foot-deep geometry, 120-foot placement, start-turn Strength save, 6d6 Bludgeoning damage, 10-foot pull, concentration duration, and Difficult Terrain visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Maelstrom rows tied to water geometry start-turn saves and pull" --reporter=dot failed because Maelstrom still used generic "maelstrom" shorthand and omitted full geometry/range context.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Maelstrom rows tied to water geometry start-turn saves and pull" --reporter=dot passed with 1 test passed and 276 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-5/maelstrom.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 277 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for ground/body-of-water placement checks, water creation, Difficult Terrain movement cost, start-turn Strength save resolution, Bludgeoning damage application, pull movement, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-MORALE-LIFE-SUPPORT-DESCRIPTION-178 - Beacon of Hope, Motivational Speech, and Heroism rows expose scope, duration, and cleanup

Status: verified 2026-06-15.

Evidence:
- A current-state short-row scan showed morale and life-support rows with terse target and duration phrasing across Beacon of Hope, Motivational Speech, and Heroism.
- public/data/spells/level-3/beacon-of-hope.json had three utility rows that said "Targets" and "for the duration" instead of exposing any-number creature scope, 30-foot range, concentration duration, Wisdom-save Advantage, Death Saving Throw Advantage, and maximum healing.
- public/data/spells/level-3/motivational-speech.json had Temporary Hit Point, Wisdom-save Advantage, and next-attack Advantage rows, but the Temporary Hit Point row omitted hearing/range/casting scope, higher-slot scaling, and loss-of-temp-HP cleanup from the row text.
- public/data/spells/level-1/heroism.json had a terse Frightened-immunity row and a broad utility row, but the row text did not cleanly expose touched willing targets, concentration duration, higher-slot target scaling, recurring Temporary Hit Points, and end cleanup.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these morale and life-support rows to keep target scope, duration, scaling, temporary-hit-point cleanup, and save/attack advantage facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps morale and life-support buffs tied to scope duration and cleanup" --reporter=dot failed because Beacon of Hope still used generic "targets" and "duration" phrasing.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps morale and life-support buffs tied to scope duration and cleanup" --reporter=dot passed with 1 test passed and 275 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/beacon-of-hope.json --spell public/data/spells/level-3/motivational-speech.json --spell public/data/spells/level-1/heroism.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 276 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Beacon of Hope max-healing enforcement, Death Saving Throw Advantage, Motivational Speech hearing gates, Temporary Hit Point cleanup, next-attack Advantage consumption, Heroism recurring Temporary Hit Points, Frightened immunity, higher-slot target routing, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-HUNGER-HADAR-DESCRIPTION-177 - Hunger of Hadar rows expose darkness, terrain, turn timing, and scaling

Status: verified 2026-06-15.

Evidence:
- A current-state scan found no remaining exact copied top-level effect descriptions and no placeholder effect descriptions, so the next local pass targeted short mechanics-rich rows.
- public/data/spells/level-3/hunger-of-hadar.json had four terse rows for Difficult Terrain, Blinded, start-turn Cold damage, and end-turn Dexterity-save Acid damage. Those rows used generic "sphere" and "area" wording, omitted the 20-foot-radius geometry, concentration duration, magical/nonmagical light suppression, and higher-slot Cold-or-Acid scaling from the row text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Hunger of Hadar rows to keep the magical darkness terrain rule, full-inside Blinded rule, start-turn Cold damage, end-turn Acid save, and higher-slot damage-choice scaling visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Hunger of Hadar rows tied to darkness terrain and turn timing" --reporter=dot failed because all four rows still used terse area shorthand.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps Hunger of Hadar rows tied to darkness terrain and turn timing" --reporter=dot passed with 1 test passed and 274 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/hunger-of-hadar.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 275 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for magical darkness illumination blocking, Blinded enforcement, Difficult Terrain movement cost, start-turn Cold damage, end-turn Acid save damage, higher-slot damage-choice routing, sound propagation, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-ELEMENTAL-INVESTITURE-DESCRIPTION-176 - Investiture of Flame, Ice, and Wind rows expose defenses, granted actions, and cleanup risks

Status: verified 2026-06-14.

Evidence:
- A current-state short-row scan found terse Investiture of Flame and Investiture of Ice defensive rows, and direct inspection showed the elemental investiture family has mechanics-rich self-transform rows that benefit from consistent standalone descriptions.
- public/data/spells/level-6/investiture-of-flame.json had damage, immunity, resistance, and light utility rows, but several rows used generic "for the duration" wording and the light utility row omitted the granted action to create the 15-foot line of fire.
- public/data/spells/level-6/investiture-of-ice.json had cold cone damage, immunity, resistance, terrain, movement slowdown, and ice/snow movement utility rows, but the action, duration, concentration, and granted freezing-wind action were not consistently visible in row text.
- public/data/spells/level-6/investiture-of-wind.json had swirling wind damage, ranged-attack Disadvantage, Fly Speed, push, and utility rows, but several rows omitted concentration duration or used weaker movement wording, and the utility row needed to preserve the fall cleanup risk.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep duration, concentration, immunity/resistance pairs, granted actions, terrain/movement facts, Fly Speed, and fall cleanup visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps elemental investiture rows tied to defenses actions and cleanup risks" --reporter=dot failed because Investiture of Flame still used generic duration wording and omitted the granted fire-line action from the light utility row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps elemental investiture rows tied to defenses actions and cleanup risks" --reporter=dot passed with 1 test passed and 273 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-6/investiture-of-flame.json --spell public/data/spells/level-6/investiture-of-ice.json --spell public/data/spells/level-6/investiture-of-wind.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 274 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Investiture immunity/resistance enforcement, adjacent fire damage triggers, light emission, granted action routing, icy terrain, freezing-wind speed halving, Fly Speed, push movement, fall cleanup, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-COPIED-HEALING-RESISTANCE-TELEPORT-DESCRIPTION-175 - Mass Healing Word, Protection from Energy, and Far Step rows stop copying top-level prose

Status: verified 2026-06-14.

Evidence:
- A local exact-copy scan found remaining effect rows whose descriptions exactly matched their top-level spell descriptions in public/data/spells/level-3/mass-healing-word.json, public/data/spells/level-3/protection-from-energy.json, and public/data/spells/level-5/far-step.json.
- A bounded gpt-5.4-mini helper recommended area hazards, but those rows were already covered by existing focused validator tests; the main agent selected this cleaner uncovered copied-top-level family instead.
- public/data/spells/level-3/mass-healing-word.json had a healing row copied from the top-level spell prose and omitted Bonus Action timing, exact 60-foot visible target scope, and +1d4 higher-slot scaling from the row.
- public/data/spells/level-3/protection-from-energy.json had a utility row copied from the top-level spell prose and a defensive row with generic "for the duration" wording instead of naming concentration duration and the chosen Acid, Cold, Fire, Lightning, or Thunder resistance.
- public/data/spells/level-5/far-step.json had a utility row copied from the top-level spell prose, while the movement row did not distinguish cast-time teleport from later-turn repeat teleports.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep healing, chosen resistance, concentration duration, cast-time teleport, and repeat Bonus Action teleport facts standalone.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps copied top-level healing resistance and teleport rows standalone" --reporter=dot failed because Mass Healing Word still copied its top-level healing prose and omitted scaling.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps copied top-level healing resistance and teleport rows standalone" --reporter=dot passed with 1 test passed and 272 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/mass-healing-word.json --spell public/data/spells/level-3/protection-from-energy.json --spell public/data/spells/level-5/far-step.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 273 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for healing application, higher-slot healing scaling, chosen resistance selection, concentration enforcement, cast-time teleport resolution, repeat Bonus Action teleport grants, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-DEFENSIVE-UTILITY-DESCRIPTION-174 - Protection from Poison, Intellect Fortress, and See Invisibility rows stop copying top-level prose

Status: verified 2026-06-14.

Evidence:
- A bounded gpt-5.4-mini helper scanned defensive/status-protection candidates and identified Protection from Poison, Intellect Fortress, and See Invisibility as high-visibility defensive or sensory spells whose effect rows duplicated or overcompressed top-level spell prose.
- public/data/spells/level-2/protection-from-poison.json had a utility row that repeated the whole top-level condition cleanup, save Advantage, and Poison resistance sentence, while the defensive row used generic "for the duration" wording.
- public/data/spells/level-3/intellect-fortress.json had a utility row that repeated the top-level Psychic resistance and mental-save Advantage prose while omitting explicit 30-foot range, concentration duration, higher-slot target scaling, and all-targets-within-30-feet cluster rule.
- public/data/spells/level-2/see-invisibility.json had a single utility row identical to the top-level spell description instead of a row-shaped sensory fact.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep condition cleanup, resistance, mental-save Advantage, target scaling, target cluster, and sensory access distinct from top-level spell prose.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps defensive utility rows distinct from top-level spell prose" --reporter=dot failed because Protection from Poison still copied the combined condition cleanup and resistance text into the utility row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps defensive utility rows distinct from top-level spell prose" --reporter=dot passed with 1 test passed and 271 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-2/protection-from-poison.json --spell public/data/spells/level-3/intellect-fortress.json --spell public/data/spells/level-2/see-invisibility.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 272 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Poisoned-condition cleanup automation, save Advantage enforcement, Poison or Psychic resistance application, Intellect Fortress target clustering or scaling, See Invisibility visibility handling, Ethereal Plane perception, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-BEAST-FORM-TRANSFORMATION-DESCRIPTION-173 - Gaseous Form, Animal Shapes, and Polymorph rows expose form limits and endings

Status: verified 2026-06-14.

Evidence:
- The previous bounded gpt-5.4-mini body-state scan identified Gaseous Form and Animal Shapes as already better-modeled but still overcompressed. The main agent selected Polymorph as the lower-level Beast-form counterpart from current JSON and validator evidence.
- public/data/spells/level-3/gaseous-form.json had defensive and utility rows with B/P/S Resistance, Prone immunity, 10-foot Fly Speed with hover, save Advantage, space sharing, narrow openings, liquid surfaces, speech/object/attack/spellcasting limits, and early endings, but the utility row omitted higher-slot target scaling and did not make "only movement mode" or object-drop limits explicit.
- public/data/spells/level-8/animal-shapes.json had utility and Temporary Hit Point rows with any-number willing visible targets, Beast CR/size cap, repeated Magic-action retransform, retained traits, spellcasting/anatomy/equipment limits, and Bonus Action ending, but the utility row omitted the 24-hour duration and self-ending phrasing.
- public/data/spells/level-4/polymorph.json had a Beast-form row with Wisdom save, CR or level cap, stat replacement, retained identity traits, Temporary Hit Points, speech/spell/equipment limits, and early ending, but omitted visible range, concentration duration, exact retained traits, anatomy limit, and temp-HP cleanup.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep target scope, retained traits, movement and anatomy limits, gear merging, Temporary Hit Point endings, self-ending actions, and scaling visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps gaseous animal and polymorph rows tied to form limits and ending rules" --reporter=dot failed because Gaseous Form still used older compressed movement, ending, and scaling wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps gaseous animal and polymorph rows tied to form limits and ending rules" --reporter=dot passed with 1 test passed and 270 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/gaseous-form.json --spell public/data/spells/level-8/animal-shapes.json --spell public/data/spells/level-4/polymorph.json passed with 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 271 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Gaseous Form target scaling, only-movement-mode enforcement, object-drop blocking, Animal Shapes repeated retransform routing, Bonus Action self-ending, Polymorph Beast-form stat replacement, Temporary Hit Point depletion cleanup, gear merge enforcement, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-STONE-ETHEREAL-BODY-STATE-DESCRIPTION-172 - Stone Shape, Meld into Stone, and Etherealness rows expose geometry and ejection rules

Status: verified.

Evidence:
- A bounded gpt-5.4-mini subagent inspected Gaseous Form, Meld into Stone, Stone Shape, Etherealness, and Animal Shapes and recommended Stone Shape, Meld into Stone, and Etherealness as the highest-impact body-state/material-interaction batch.
- public/data/spells/level-4/stone-shape.json had a compact utility row with touched stone object/section reshaping, simple passages, sealed doors, hinge/latch limits, and no fine mechanical detail, but the row did not spell out the 5-foot dimensional cap or concrete object examples cleanly.
- public/data/spells/level-3/meld-into-stone.json had a single merge row with hidden-from-senses, no movement except exit, self-only spells, and expulsion if reshaped/destroyed, but omitted perception penalties, 5-foot exit movement, Prone ejection, nearest-space placement, and exact Force damage branches from the visible row.
- public/data/spells/level-7/etherealness.json had movement, occupied-space shunt damage, and utility rows, but the utility row compressed movement cost, gray 60-foot origin-plane perception, Ethereal-only interaction, invalid-plane ending, and higher-slot target scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep geometry caps, movement limits, perception limits, ejection damage, plane-gated interaction, shunt damage, invalid-plane endings, and target scaling visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps stone meld and ethereal body-state rows tied to geometry movement and ejection rules" --reporter=dot failed because Stone Shape still used older condensed geometry wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps stone meld and ethereal body-state rows tied to geometry movement and ejection rules" --reporter=dot passed with 1 test passed and 269 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-4/stone-shape.json --spell public/data/spells/level-3/meld-into-stone.json --spell public/data/spells/level-7/etherealness.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 270 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Stone Shape geometry enforcement, hinge/latch object simulation, Meld into Stone perception penalties, self-only spell gating, ejection placement, Force damage application, Etherealness planar travel, shunt movement/damage, invalid-plane ending, higher-slot target routing, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-SERVICE-SUGGESTION-MEMORY-DESCRIPTION-171 - Planar Ally, Mass Suggestion, and Modify Memory rows expose consent, break, and scaling rules

Status: verified.

Evidence:
- A bounded gpt-5.4-mini subagent inspected Planar Ally, Suggestion, Mass Suggestion, and Modify Memory and recommended Planar Ally, Mass Suggestion, and Modify Memory as the strongest service/suggestion/memory batch.
- public/data/spells/level-6/planar-ally.json had separate summon and bargain rows, but the summon row compressed the non-compulsion boundary and the bargain row compressed payment bands, adjustment rules, suicidal-task refusal, and return-home endings.
- public/data/spells/level-6/mass-suggestion.json had Charmed and utility rows with hearing/understanding gates, 25-word achievable non-damaging suggestion, damage/completion breaks, and 24-hour duration, but omitted higher-slot duration scaling from the effect rows and used caster-centric wording.
- public/data/spells/level-5/modify-memory.json had utility, Charmed, and Incapacitated rows with Wisdom save Advantage while fighting, 1-minute concentration, 24-hour/10-minute memory window, damage/spell/early-ending blockers, and nested state, but omitted language-understanding, Remove Curse/Greater Restoration restoration, and higher-slot lookback scaling from the rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep service consent boundaries, payment rules, communication gates, damage/completion breaks, nested conditions, restoration exits, and duration/lookback scaling visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps service suggestion and memory rows tied to consent breaks and duration scaling" --reporter=dot failed because Planar Ally still compressed the non-compelled service/bargain boundary.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps service suggestion and memory rows tied to consent breaks and duration scaling" --reporter=dot passed with 1 test passed and 268 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-6/planar-ally.json --spell public/data/spells/level-6/mass-suggestion.json --spell public/data/spells/level-5/modify-memory.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 269 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Planar Ally negotiation, payment adjudication, service acceptance/refusal, return-home automation, Mass Suggestion duration scaling, suggestion validity adjudication, damage/completion break enforcement, Modify Memory language-understanding gates, memory rewrite execution, restoration cleanup, higher-slot lookback routing, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-UNDEAD-BINDING-CONTROL-DESCRIPTION-170 - Animate Dead, Create Undead, and Planar Binding rows expose long-control command and duration rules

Status: verified.

Evidence:
- A bounded gpt-5.4-mini subagent inspected Animate Dead, Planar Binding, Planar Ally, and Create Undead and recommended Animate Dead, Create Undead, and Planar Binding as the strongest long-running creature-control batch.
- public/data/spells/level-3/animate-dead.json had a command row with the corpse/bones gate, Skeleton/Zombie creation, 24-hour control, 60-foot Bonus Action commands, order persistence, and reassertion scaling, but omitted Dodge-only fallback, same-command multi-control phrasing, control stopping after 24 hours, and the animate-versus-reassert tradeoff.
- public/data/spells/level-6/create-undead.json had a very compressed row that omitted 24-hour control, Dodge-only fallback, order persistence, recast-before-expiry reassertion, and the slot table for Ghouls, Ghasts, Wights, and Mummies.
- public/data/spells/level-5/planar-binding.json had binding utility and Bound rows with the family gate, 1-hour casting, Charisma save, 24-hour service, source-duration extension, hostile twisting, and completion branches, but omitted higher-slot duration scaling and made hostile-service semantics less explicit.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep command cost, default behavior, control expiry, recast/reassert, hostile service, source-duration extension, and duration scaling visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps undead control and planar binding rows tied to command duration and reassertion facts" --reporter=dot failed because Animate Dead still used older compressed command/reassert wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps undead control and planar binding rows tied to command duration and reassertion facts" --reporter=dot passed with 1 test passed and 267 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/animate-dead.json --spell public/data/spells/level-6/create-undead.json --spell public/data/spells/level-5/planar-binding.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 268 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for undead command dispatch, same-command fanout, Dodge fallback AI, control-expiry enforcement, recast reassertion routing, Create Undead slot-table actor creation, Planar Binding source-duration extension, hostile instruction twisting, higher-slot duration enforcement, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-SUMMON-COMMAND-ECONOMY-DESCRIPTION-169 - Find Steed, Summon Beast, and Summon Greater Demon rows expose actor lifecycle and command cadence

Status: verified.

Evidence:
- A bounded gpt-5.4-mini subagent inspected Find Steed, Summon Beast, Animate Dead, and Summon Greater Demon and recommended Find Steed, Summon Beast, and Summon Greater Demon as the clearest command-economy contrast set.
- public/data/spells/level-2/find-steed.json had a persistent mount row with appearance, creature type, and slot-level stat scaling, but omitted allied status, shared Initiative, controlled-mount behavior, Incapacitated fallback behavior, 1-mile telepathy, disappearance, recast replacement, and explicit flight threshold.
- public/data/spells/level-2/summon-beast.json had a strong obedient-spirit row, but the command cadence and per-form hit-point/half-slot-level attack scaling could be clearer for compact actor UI.
- public/data/spells/level-4/summon-greater-demon.json had a generic constrained-command row despite top-level facts for own Initiative, no-action commands, end-turn Charisma control saves, true-name Disadvantage, uncommanded and uncontrolled hostility, 1d6-round lingering after early concentration loss, disappearance, blood-circle protection, and CR scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these summon rows to distinguish persistent controlled mounts, obedient allied spirits, and contested hostile demons.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps steed beast and demon summon rows tied to command economy and lifecycle facts" --reporter=dot failed because Find Steed still omitted command/mount lifecycle details.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps steed beast and demon summon rows tied to command economy and lifecycle facts" --reporter=dot passed with 1 test passed and 266 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-2/find-steed.json --spell public/data/spells/level-2/summon-beast.json --spell public/data/spells/level-4/summon-greater-demon.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 267 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for controlled-mount behavior, steed independent-protection AI, telepathy, recast replacement, slot-level steed stat mutation, Bestial Spirit command dispatch, form-specific movement or attack-count enforcement, demon initiative rolling, end-turn Charisma control saves, true-name Disadvantage, uncontrolled demon hostility, delayed disappearance, blood-circle constraints, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-FEAR-PATTERN-GEAS-DESCRIPTION-168 - Fear, Hypnotic Pattern, and Geas rows expose control breaks and duration branches

Status: verified.

Evidence:
- A bounded gpt-5.4-mini subagent inspected Fear, Hypnotic Pattern, and Geas and confirmed they form a compact status/control batch covering sight-gated repeat saves, break-condition cleanup, understanding gates, punishment, restoration exits, and long-duration command branches.
- public/data/spells/level-3/fear.json had a Frightened row with the Wisdom save and sight-gated repeat save, but omitted the failed-save dropped item, forced Dash action, safest-route movement, and per-target spell ending.
- public/data/spells/level-3/hypnotic-pattern.json had Charmed and Incapacitated rows with damage and shake-awake breaks, but duplicated the same targeting prose across both rows and did not make the Incapacitated/Speed-0 row clearly derived from Charmed.
- public/data/spells/level-5/geas.json had command, Charmed, once-per-day 5d10 Psychic punishment, suicidal-command ending, understanding auto-success, and restoration exits, but omitted higher-slot duration branches from the effect rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to keep forced movement, break triggers, understanding gates, punishment, restoration exits, and high-slot duration scaling visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps fear pattern and geas controls tied to movement breaks and duration scaling" --reporter=dot failed because Fear still omitted dropped-item and forced-movement facts.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps fear pattern and geas controls tied to movement breaks and duration scaling" --reporter=dot passed with 1 test passed and 265 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/fear.json --spell public/data/spells/level-3/hypnotic-pattern.json --spell public/data/spells/level-5/geas.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 266 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Fear item dropping, safest-route Dash movement, sight-gated repeat-save scheduling, Hypnotic Pattern damage or shake-awake cleanup, derived Incapacitated/Speed-0 synchronization, Geas higher-slot duration enforcement, once-per-day punishment tracking, restoration spell cleanup, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-COMMAND-PARALYSIS-CONFUSION-DESCRIPTION-167 - Command, Hold Person, and Confusion rows expose control outcomes

Status: verified.

Evidence:
- A bounded gpt-5.4-mini subagent inspected Command, Hold Person, and Confusion as the next status/control candidate family after SSO-166 and confirmed this is a good description-only batch.
- public/data/spells/level-1/command.json had a control row that named Approach, Drop, Flee, Grovel, and Halt but omitted the per-option outcomes that combat logs and compact UI need.
- public/data/spells/level-2/hold-person.json had a Paralyzed row with the Humanoid gate, Wisdom repeat save, and concentration duration, but omitted the higher-slot additional-Humanoid target scaling from the effect row.
- public/data/spells/level-4/confusion.json had a Confused row with the area, Wisdom save, Bonus Action and Reaction lockouts, turn-start 1d10 behavior roll, repeat save, and slot radius scaling, but the behavior-table wording was compressed.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these control rows to keep option outcomes, Humanoid scaling, turn-start behavior-table rolls, and repeat saves visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps command paralysis and confusion controls tied to option outcomes and repeat saves" --reporter=dot failed because Command still listed one-word options without their outcomes.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps command paralysis and confusion controls tied to option outcomes and repeat saves" --reporter=dot passed with 1 test passed and 264 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-1/command.json --spell public/data/spells/level-2/hold-person.json --spell public/data/spells/level-4/confusion.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 265 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Command option execution, shortest-route or fastest-route pathing, forced Prone application, Halt action-lock enforcement, Hold Person multi-target application, Paralyzed condition semantics, Confusion behavior-table automation, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-PSYCHIC-RADIANCE-SLOW-DESCRIPTION-166 - Synaptic Static, Sickening Radiance, and Slow rows expose riders and action limits

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Synaptic Static, Sickening Radiance, and Slow from damage/status, radiance-zone, and action-economy rows.
- public/data/spells/level-5/synaptic-static.json had DAMAGE and STATUS_CONDITION rows with the Intelligence threshold, 8d6 Psychic damage, Muddled Thoughts, 1-minute duration, attack/check/concentration subtraction, and turn-end Intelligence repeat save, but the effect descriptions split or omitted parts of the rider.
- public/data/spells/level-4/sickening-radiance.json had entry, turn-start, and light rows with 4d10 Radiant damage, one exhaustion level, 5-foot dim green light, Invisible-benefit denial, 30-foot-radius light, around-corner spread, concentration, and cleanup when the spell ends, but the damage rows only described damage.
- public/data/spells/level-3/slow.json had a single Slowed row with the Wisdom save, 1-minute concentration duration, Speed halving, AC and Dexterity-save penalty, Reaction lockout, action-or-Bonus-Action limit, one-attack cap, Somatic spell failure chance, and turn-end repeat save, but the row was too dense for logs.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these psychic burst, radiance, and slow rows to keep duration, rider penalties, exhaustion, light, invisibility denial, cleanup, and action-economy limits visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps psychic burst radiance and slow rows tied to riders and action limits" --reporter=dot failed because Synaptic Static still omitted the 1-minute Muddled Thoughts rider from its damage row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps psychic burst radiance and slow rows tied to riders and action limits" --reporter=dot passed with 1 test passed and 263 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-5/synaptic-static.json --spell public/data/spells/level-4/sickening-radiance.json --spell public/data/spells/level-3/slow.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 264 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Muddled Thoughts subtraction, exhaustion stacking or cleanup, invisibility-benefit denial, dim-light rendering on failed-save targets, Slow action-economy enforcement, Somatic spell failure automation, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-DOMINATE-FEEBLEMIND-DESCRIPTION-165 - Dominate and Feeblemind rows expose command links and lockouts

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Dominate Monster, Dominate Person, and Feeblemind from command-control and long-term lockout rows.
- public/data/spells/level-8/dominate-monster.json had utility and Charmed rows with telepathic link, no-action commands, Reaction command cost, combat Advantage, damage repeat saves, and self-protective behavior, but the descriptions used caster-centric wording.
- public/data/spells/level-5/dominate-person.json had a single utility row that compressed the Humanoid gate, Charmed state, telepathic command link, damage repeat save, Reaction command cost, and slot-duration scaling.
- public/data/spells/level-8/feeblemind.json had damage, utility, and Feebleminded rows with 4d6 Psychic damage, Intelligence/Charisma 1, spell and magic-item lockouts, language/communication lockout, 30-day repeat saves, and restoration endings, but the long rows were less direct for logs.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these dominate and Feeblemind rows to keep same-plane links, no-action commands, Reaction costs, repeat saves, lockouts, and restoration exits visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps dominate command links and feeblemind lockouts player-facing" --reporter=dot failed because Dominate Monster still used older caster-centric command-link wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps dominate command links and feeblemind lockouts player-facing" --reporter=dot passed with 1 test passed and 262 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-8/dominate-monster.json --spell public/data/spells/level-5/dominate-person.json --spell public/data/spells/level-8/feeblemind.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 263 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Dominate command dispatch, same-plane link tracking, Reaction command execution, precise-control action handling, damage-triggered repeat saves, Feeblemind ability-score mutation, spell or magic-item lockout enforcement, 30-day repeat-save scheduling, restoration endings, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-THRESHOLD-PAIN-HOSTILE-DESCRIPTION-164 - Power Word Stun, Power Word Pain, and Enemies Abound rows expose branch gates

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Power Word Stun, Power Word Pain, and Enemies Abound from threshold/status/control rows.
- public/data/spells/level-8/power-word-stun.json had wrapper, Stunned, and Speed-0 rows that carried the 150-HP threshold and repeat-save facts, but the descriptions used caster-centric next-turn wording and split target references unevenly.
- public/data/spells/level-7/power-word-pain.json had threshold, Charmed-immunity, spellcasting-save, speed-cap, disadvantage, and repeat-save rows, but the text was wrapper-heavy and inconsistent about Charmed and Constitution-save wording.
- public/data/spells/level-3/enemies-abound.json had the hostile-targeting row, but it compressed Frightened-immunity auto-success, random target selection, forced opportunity attacks, duration/concentration, and damage repeat-save cleanup.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these threshold, pain, and hostile-target rows to keep HP gates, immunity gates, speed caps, repeat saves, random target selection, and forced opportunity attacks visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps threshold pain stun and hostile-target rows tied to branch gates" --reporter=dot failed because Power Word Stun still used older branch wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps threshold pain stun and hostile-target rows tied to branch gates" --reporter=dot passed with 1 test passed and 261 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-8/power-word-stun.json --spell public/data/spells/level-7/power-word-pain.json --spell public/data/spells/level-3/enemies-abound.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 262 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Power Word Stun HP-threshold routing, Stunned repeat-save automation, Speed-0 cleanup, Power Word Pain spellcasting interception, Charmed-immunity gating, speed-cap enforcement, disadvantage application, Enemies Abound random target selection, forced opportunity attacks, damage-triggered repeat saves, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-RAY-THRESHOLD-DESCRIPTION-163 - Prismatic Spray, Divine Word, and Power Word Kill rows expose branch outcomes

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; both selected Prismatic Spray, Divine Word, and Power Word Kill from table/ray/threshold rows.
- public/data/spells/level-7/prismatic-spray.json had damage, indigo progression, violet follow-up, and ray-selection rows, but the rows mixed table wording, casing, and branch labels in ways that were harder to scan in UI summaries.
- public/data/spells/level-7/divine-word.json had HP-band and planar-return rows, but several rows omitted the explicit Charisma save phrase and the utility row compressed HP table routing with planar return and 24-hour return blocking.
- public/data/spells/level-9/power-word-kill.json had death threshold and fallback damage rows, but the fallback wording was editorial and less direct for runtime logs.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these ray table and threshold rows to keep rolled ray damage, indigo progression, violet follow-up, Divine Word HP bands, planar return, return blocking, and Power Word fallback damage visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps ray table and threshold rows tied to branch outcomes" --reporter=dot failed because Prismatic Spray still used older table wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps ray table and threshold rows tied to branch outcomes" --reporter=dot passed with 1 test passed and 260 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-7/prismatic-spray.json --spell public/data/spells/level-7/divine-word.json --spell public/data/spells/level-9/power-word-kill.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 261 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Prismatic Spray table rolling, double-ray rerolls, indigo save counters, violet planar teleport execution, Divine Word HP table automation, planar return blocking, Power Word Kill threshold routing, fallback damage application, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-STORM-CLOUD-CURSE-DESCRIPTION-162 - Call Lightning, Bestow Curse, and Cloudkill rows expose repeated triggers and mode choices

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Call Lightning, Bestow Curse, and Cloudkill from storm/cloud/modal rows.
- public/data/spells/level-3/call-lightning.json had DAMAGE and UTILITY rows that carried storm-bonus, slot-scaling, and repeat Magic-action facts, but the text used older caster-centric wording and did not foreground the reusable under-cloud point choice.
- public/data/spells/level-3/bestow-curse.json had the curse menu and scaling table facts, but the row still used caster-centric attack wording and less direct save-failure phrasing.
- public/data/spells/level-5/cloudkill.json had appearance, enter/move, end-turn, and fog-wrapper rows, but the damage rows did not carry slot scaling and the repeated trigger rows were less explicit about first-per-turn timing and fog movement.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these storm/cloud/curse rows to keep reusable Magic action, curse menu, repeated fog triggers, strong-wind ending, fog drift, and slot-scaling facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps storm cloud and curse rows tied to repeated triggers and mode choices" --reporter=dot failed because Call Lightning still used older caster-centric/reuse wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps storm cloud and curse rows tied to repeated triggers and mode choices" --reporter=dot passed with 1 test passed and 259 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-3/call-lightning.json --spell public/data/spells/level-3/bestow-curse.json --spell public/data/spells/level-5/cloudkill.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 260 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Call Lightning storm-cloud placement, outdoor storm detection, repeat strike targeting, Bestow Curse modal UI, curse option enforcement, Remove Curse automation, Cloudkill fog movement, strong-wind dispersal, once-per-turn trigger accounting, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-DISEASE-MODE-PLANT-DESCRIPTION-161 - Contagion, Eyebite, and Entangle rows expose progression, modes, and exits

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Contagion, Eyebite, and Entangle from disease progression, mode-branch, and plant-restraint rows.
- public/data/spells/level-5/contagion.json had DAMAGE, Poisoned progression, and chosen-ability rows that carried the key facts, but the text compressed three-success/three-failure progression and Poisoned-ending resistance.
- public/data/spells/level-6/eyebite.json had Asleep, Panicked, Sickened, and reusable action rows, but Panicked and wrapper text still used caster-centric wording and did not foreground the Magic-action repeat targeting lockout cleanly.
- public/data/spells/level-1/entangle.json had terrain plus repeated Restrained trigger rows, but the terrain row did not explicitly name Difficult Terrain and the repeated trigger rows hid the shared escape and listed repeat-save exits.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these disease, mode, and plant-restraint rows to keep progression thresholds, option exits, target lockout, terrain, and escape facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps disease mode and plant restraint rows tied to progression and exits" --reporter=dot failed because Contagion still used older compressed wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps disease mode and plant restraint rows tied to progression and exits" --reporter=dot passed with 1 test passed and 258 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-5/contagion.json --spell public/data/spells/level-6/eyebite.json --spell public/data/spells/level-1/entangle.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 259 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Contagion three-success/three-failure counters, Poisoned-ending interception, chosen-ability UI, Eyebite retarget tracking, Panicked pathfinding, Asleep wake actions, Sickened repeat saves, Entangle area painting, escape-action execution, listed end-turn save handling, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-CONTROL-PRISON-DESCRIPTION-160 - Confusion, Geas, and Mental Prison rows expose command and escape control

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Confusion, Geas, and Mental Prison from command/control/status rows.
- public/data/spells/level-4/confusion.json had a STATUS_CONDITION row with the right save and turn-loop facts, but the row compressed Confused state, action restrictions, start-turn behavior roll, end-turn repeat save, and slot-radius scaling into one long clause.
- public/data/spells/level-5/geas.json had UTILITY and Charmed rows that carried command, understanding, daily Psychic damage, suicidal-command ending, and removal-spell facts, but used caster-centric and less direct command wording.
- public/data/spells/level-6/mental-prison.json had DAMAGE, Restrained, escape-damage, and sensory utility rows, but the rows split Charmed-immunity auto-success, sight/hearing isolation, and leave/attack/reach escape triggers in ways that were harder for runtime summaries to present.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these command and prison-control rows to keep save, turn-loop, command-pressure, Charmed-immunity, sensory-blocking, and escape-trigger facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps command and prison control rows tied to saves turns and escape triggers" --reporter=dot failed because Confusion still used older compressed turn-loop wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps command and prison control rows tied to saves turns and escape triggers" --reporter=dot passed with 1 test passed and 257 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-4/confusion.json --spell public/data/spells/level-5/geas.json --spell public/data/spells/level-6/mental-prison.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 258 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Confusion behavior-table automation, Bonus Action or Reaction enforcement, Geas command adjudication, daily damage tracking, removal-spell automation, Mental Prison sensory blocking, forced-movement detection, escape-trigger execution, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-COMMAND-LOOP-DESCRIPTION-159 - Find Familiar, Tiny Servant, and Animate Objects rows expose command cadence

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Find Familiar, Tiny Servant, and Animate Objects from persistent companion and command-loop rows.
- public/data/spells/level-1/find-familiar.json had a SUMMONING row that named telepathy, shared senses, and touch delivery, but omitted one-familiar limit, independent action framing, dismissal/0-HP persistence, and player-facing command wording.
- public/data/spells/level-3/tiny-servant.json had a UTILITY row that compressed command range, repeated/simple orders, uncommanded behavior, and object reversion.
- public/data/spells/level-5/animate-objects.json had a UTILITY row with the main object-control facts, but still used caster-centric wording and did not foreground shared initiative, command cadence, default Dodge behavior, and object reversion in player-facing language.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these companion and object-control rows to keep command-loop facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps familiar servant and animated-object command loops player-facing" --reporter=dot failed because Find Familiar still used a shorter companion row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps familiar servant and animated-object command loops player-facing" --reporter=dot passed with 1 test passed and 256 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-1/find-familiar.json --spell public/data/spells/level-3/tiny-servant.json --spell public/data/spells/level-5/animate-objects.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 257 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for familiar initiative, dismissal/resummon, carried-item drop behavior, one-familiar enforcement, Tiny Servant multi-command execution, object reversion damage carryover, Animate Objects object-size accounting, shared initiative execution, command dispatch, default Dodge behavior, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-LOW-LEVEL-ZONE-DESCRIPTION-158 - Fog Cloud, Grease, and Web rows expose terrain and repeated trigger facts

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Fog Cloud, Grease, and Web from low-level terrain and zone-control rows.
- public/data/spells/level-1/fog-cloud.json had a TERRAIN row that omitted Heavily Obscured wording, concentration duration, strong-wind dispersal, and exact higher-slot radius scaling.
- public/data/spells/level-1/grease.json had TERRAIN and Prone rows with correct triggers, but the rows did not clearly foreground no-concentration terrain and repeated entry/end-turn Dexterity saves.
- public/data/spells/level-2/web.json had TERRAIN, Restrained, DAMAGE, and Difficult Terrain rows that compressed sticky-web anchoring, enter/start restraint timing, burning-web destruction, and burning-area fire damage.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these low-level zone rows to keep obscuring, terrain, repeated-trigger, restraint, and burning-web facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps low-level zone rows tied to obscuring terrain and repeated trigger facts" --reporter=dot failed because Fog Cloud still used terse obscuring-fog wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps low-level zone rows tied to obscuring terrain and repeated trigger facts" --reporter=dot passed with 1 test passed and 255 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-1/fog-cloud.json --spell public/data/spells/level-1/grease.json --spell public/data/spells/level-2/web.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 256 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for fog rendering, wind dispersal, slot-radius scaling, Grease area painting, repeated Prone trigger enforcement, Web anchoring, web ignition/destruction timing, restraint escape handling, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-LOWER-TRANSFORMATION-DESCRIPTION-157 - Alter Self, Enlarge/Reduce, and Polymorph rows expose active form rules

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Alter Self, Enlarge/Reduce, and Polymorph from lower-level transformation rows.
- public/data/spells/level-2/alter-self.json had three UTILITY rows that used caster-centric wording and did not consistently expose active mode, voice/body-shape limits, and spellcasting-ability Unarmed Strike facts in player-facing language.
- public/data/spells/level-2/enlarge-reduce.json had Enlarge and Reduce rows that carried size, Strength, and damage facts, but omitted worn/carried gear context and used less direct size-state wording.
- public/data/spells/level-4/polymorph.json had a UTILITY row that compressed Beast stat-block replacement, retained identity, merged equipment, speech/spellcasting limits, Beast-form Temporary Hit Points, and early-ending behavior.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those lower-level transformation rows to keep active mode and form-limit facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps lower-level transformation rows tied to active modes and form limits" --reporter=dot failed because Alter Self still used caster-centric mode wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps lower-level transformation rows tied to active modes and form limits" --reporter=dot passed with 1 test passed and 254 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-2/alter-self.json --spell public/data/spells/level-2/enlarge-reduce.json --spell public/data/spells/level-4/polymorph.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 255 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Alter Self mode switching, disguise inspection, natural-weapon attack substitution, Enlarge/Reduce token resizing, carried-gear resizing, Polymorph Beast stat-block lookup, equipment merging, temporary-HP depletion cleanup, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-TRANSFORMATION-DESCRIPTION-156 - Mass Polymorph, Shapechange, and True Polymorph rows expose form and temporary-hit-point rules

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Mass Polymorph, Shapechange, and True Polymorph from high-level transformation rows.
- public/data/spells/level-9/mass-polymorph.json had UTILITY and DEFENSIVE rows that carried the form-selection and temporary-hit-point rules, but still used caster-centric wording and did not make the chosen Beast form's temporary-HP rule explicit enough for UI summaries.
- public/data/spells/level-9/shapechange.json had UTILITY and DEFENSIVE rows that compressed stat replacement, retained traits, Magic-action form switching, equipment handling, and first-form temporary hit points.
- public/data/spells/level-9/true-polymorph.json had UTILITY and DEFENSIVE rows that compressed three transformation modes, full-hour persistence, object/creature limits, control handoff, retained creature traits, and creature-to-creature temporary hit points.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those high-level transformation rows to keep form and temporary-hit-point rules visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level transformation rows tied to form and temporary-hit-point rules" --reporter=dot failed because Mass Polymorph still used caster-centric form wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level transformation rows tied to form and temporary-hit-point rules" --reporter=dot passed with 1 test passed and 253 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-9/mass-polymorph.json --spell public/data/spells/level-9/shapechange.json --spell public/data/spells/level-9/true-polymorph.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 254 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for Beast stat-block lookup, CR validation, temporary-HP replacement enforcement, Shapechange form switching, equipment state transitions, True Polymorph mode execution, object-creature control handoff, full-hour persistence, dispel cleanup, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-RUNTIME-DEBT-DESCRIPTION-155 - Investiture of Stone and Otto's Irresistible Dance rows remove runtime-debt wording

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Investiture of Stone and Otto's Irresistible Dance because their public effect rows still exposed explicit runtime-debt wording.
- public/data/spells/level-6/investiture-of-stone.json had a MOVEMENT row that mentioned the missing first-class ignore-terrain-cost field instead of staying player-facing.
- public/data/spells/level-6/ottos-irresistible-dance.json had a DEFENSIVE row that mentioned the missing first-class attacker-advantage-against-target field instead of summarizing the dance's attack, Dexterity-save, and incoming-attack modifiers.
- public/data/spells/level-6/blade-barrier.json was included as a regression-locked control row because the current public terrain row is already player-facing after earlier cleanup.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these terrain, movement, and dance rows to remain free of runtime-debt wording.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps terrain and dance rows free of runtime-debt wording" --reporter=dot failed because Investiture of Stone still exposed runtime-debt wording in the movement row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps terrain and dance rows free of runtime-debt wording" --reporter=dot passed with 1 test passed and 252 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-6/investiture-of-stone.json --spell public/data/spells/level-6/ottos-irresistible-dance.json --spell public/data/spells/level-6/blade-barrier.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 253 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for first-class ignore-terrain-cost modeling, solid-stone movement collision/ejection, Otto's attacker-advantage targeting field, dance movement enforcement, repeat-save handling, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-PORTAL-SUMMON-TERRAIN-DESCRIPTION-154 - Arcane Gate, Conjure Fey, and Plant Growth rows expose runtime choices

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Arcane Gate, Conjure Fey, and Plant Growth from portal, summon-flow, and casting-mode candidates.
- public/data/spells/level-6/arcane-gate.json had a UTILITY row that carried portal range, occupied-space failure, one-sided facing, opaque mist, adjacency traversal, and Bonus Action facing changes, but still used caster-centric shorthand that was harder to read in UI summaries.
- public/data/spells/level-6/conjure-fey.json had split SUMMONING, DAMAGE, Frightened, MOVEMENT, and UTILITY rows, but those rows did not consistently expose the repeatable teleport-attack loop in player-facing language.
- public/data/spells/level-3/plant-growth.json had separate Overgrowth and Enrichment rows, but the row text omitted the 150-foot point range, action-vs-8-hour casting distinction, optional excluded areas, and one-benefit-per-year harvest constraint.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those portal, summon-flow, and plant-mode rows to keep runtime choices visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps portal summon-flow and plant-mode rows tied to their runtime choices" --reporter=dot failed because Arcane Gate still used caster-centric portal wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps portal summon-flow and plant-mode rows tied to their runtime choices" --reporter=dot passed with 1 test passed and 251 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-6/arcane-gate.json --spell public/data/spells/level-6/conjure-fey.json --spell public/data/spells/level-3/plant-growth.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 252 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for portal placement, occupied-space failure, portal facing toggles, opaque sight blocking, Conjure Fey summon ownership, teleport timing, attack execution, Frightened source tracking, Plant Growth terrain rendering, excluded-area painting, harvest simulation, or rendered UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-REACTION-DESCRIPTION-153 - Shield, Counterspell, and Silence rows use player-facing reaction/control text

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked remaining live public spell JSON candidates; the main agent selected Shield, Counterspell, and Silence from the common reaction/control candidates.
- public/data/spells/level-1/shield.json had DEFENSIVE rows that exposed caster/reaction implementation phrasing instead of player-facing AC and Magic Missile protection facts.
- public/data/spells/level-3/counterspell.json had a UTILITY row that read like runtime shorthand for an interrupt attempt instead of the visible casting, Constitution save, wasted action, and slot-preservation rules.
- public/data/spells/level-2/silence.json had UTILITY, Deafened, and Thunder-immunity rows that compressed the 20-foot sphere, 120-foot range, sound blocking, verbal-component lockout, and inside-sphere scope.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those common reaction and silence-control rows to remain player-facing.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps common reaction and silence-control rows player-facing" --reporter=dot failed because Shield still used caster/reaction implementation wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps common reaction and silence-control rows player-facing" --reporter=dot passed with 1 test passed and 250 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-1/shield.json --spell public/data/spells/level-3/counterspell.json --spell public/data/spells/level-2/silence.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 251 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a description-only cleanup. It does not claim new runtime support for reaction timing, Counterspell interrupt resolution, spell-slot accounting, Silence zone rendering, verbal-component enforcement, Thunder damage prevention, concentration cleanup, or full UI proof beyond current structured data and validator text.

### SSO-HIGH-IMPACT-MODE-DESCRIPTION-152 - Wind Walk, Control Water, and Invulnerability rows expose mode and defense facts

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked live public spell JSON candidates; the main agent selected Wind Walk, Control Water, and Invulnerability from valid live-data results.
- public/data/spells/level-6/wind-walk.json had a MOVEMENT row that exposed runtime-debt wording instead of player-facing cloud-form movement, action restriction, and safe-descent facts, and a Stunned row that omitted the Magic action and return-to-cloud timing loop.
- public/data/spells/level-4/control-water.json had a UTILITY row for mode selection, but the row text omitted 300-foot range, mode consequences, and vehicle/pull/damage/escape details that matter for UI previews.
- public/data/spells/level-9/invulnerability.json had a DEFENSIVE row for all-damage immunity, but the row text omitted self-targeting and 10-minute concentration context.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those cloud-form, water-control, and invulnerability rows to keep mode and defense facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps cloud-form water-control and invulnerability rows tied to mode and defense facts" --reporter=dot failed because Wind Walk still exposed runtime-debt wording in the movement row.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps cloud-form water-control and invulnerability rows tied to mode and defense facts" --reporter=dot passed with 1 test passed and 249 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-6/wind-walk.json --spell public/data/spells/level-4/control-water.json --spell public/data/spells/level-9/invulnerability.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 250 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for first-class cloud movement modes, Wind Walk transformation scheduling, safe descent/fall handling, Control Water mode execution, whirlpool pull/escape enforcement, vehicle capsize handling, Invulnerability damage-prevention enforcement, concentration cleanup, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-TERRAIN-DESCRIPTION-151 - Move Earth, Freedom of Movement, and Passwall rows expose runtime constraints

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked levels 4-6 terrain/control candidates; the main agent selected Move Earth, Freedom of Movement, and Passwall from live public spell JSON.
- public/data/spells/level-6/move-earth.json had a TERRAIN row for earth reshaping, but the row text omitted range, 40-foot-square runtime scope, 10-minute completion timing, slow-transformation safety, and natural-stone exclusion.
- public/data/spells/level-4/freedom-of-movement.json had a UTILITY row for movement protection, but the row text compressed the 1-hour touched willing target, Difficult Terrain immunity, magical speed/Paralyzed/Restrained protection, Swim Speed, and 5-foot nonmagical-restraint escape into a terse list.
- public/data/spells/level-5/passwall.json had a UTILITY row for a temporary passage, but the row text omitted 1-hour duration, 30-foot visible surface placement, safe ejection, and nearest-unoccupied-space cleanup when the passage closes.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those terrain, passage, and movement-protection rows to keep runtime constraints visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps terrain passage and movement-protection rows tied to runtime constraints" --reporter=dot failed because Move Earth still used the old terse terrain row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps terrain passage and movement-protection rows tied to runtime constraints" --reporter=dot passed with 1 test passed and 248 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-6/move-earth.json --spell public/data/spells/level-4/freedom-of-movement.json --spell public/data/spells/level-5/passwall.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 249 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for terrain reshaping execution, structure instability simulation, magical-vs-nonmagical restraint enforcement, swim-speed application, nonmagical escape spending, Passwall pathfinding, safe ejection placement, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-150 - Mind Blank, Power Word Stun, and Telekinesis rows expose branch facts

Status: verified.

Evidence:
- Bounded gpt-5.4-mini subagents ranked levels 8-9 and 4-6 candidate rows; the main agent selected Mind Blank, Power Word Stun, and Telekinesis as the best combined high-impact defensive/control batch.
- public/data/spells/level-8/mind-blank.json had a DEFENSIVE row for Psychic and Charmed immunity, but the row text omitted the 24-hour touched willing target, anti-emotion/alignment sensing, thought-reading block, magical-location block, remote-observation block, mind-control block, and Wish information boundary.
- public/data/spells/level-8/power-word-stun.json had Stunned and Speed-0 rows, but the row text omitted visible target selection, 60-foot range, threshold branch handoff, repeat-save success cleanup, and same-target over-threshold routing.
- public/data/spells/level-5/telekinesis.json had one creature-control STATUS_CONDITION row, but the row text omitted the object branch, unattended object movement, worn/carried object save, simple-object manipulation, and target-per-turn branch breadth.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those mental shield, threshold stun, and telekinetic control rows to keep branch facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps mental shield threshold stun and telekinetic control rows tied to branch facts" --reporter=dot failed because Mind Blank still used the old terse defensive row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps mental shield threshold stun and telekinetic control rows tied to branch facts" --reporter=dot passed with 1 test passed and 247 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-8/mind-blank.json --spell public/data/spells/level-8/power-word-stun.json --spell public/data/spells/level-5/telekinesis.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 248 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Mind Blank anti-divination enforcement, Wish information blocking, Power Word Stun threshold dispatch, repeat-save scheduling, Speed-0 application, Telekinesis object manipulation, worn/carried object contests, fine-control UI, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-MODIFIER-DESCRIPTION-149 - Foresight, Holy Aura, and Illusory Dragon rows expose duration and trigger facts

Status: verified.

Evidence:
- public/data/spells/level-9/foresight.json had outgoing Advantage and incoming Disadvantage ATTACK_ROLL_MODIFIER rows, but the row text omitted the touched willing target, 8-hour duration, broad D20-test relationship, and recast-ending boundary.
- public/data/spells/level-8/holy-aura.json had incoming attack Disadvantage and Fiend/Undead Blinded retaliation rows, but the row text omitted the 1-minute concentration aura, chosen-creature scope, 30-foot Emanation location, and affected chosen creature melee-hit trigger.
- public/data/spells/level-8/illusory-dragon.json had Frightened and movement rows, but the row text omitted the Huge shadow-dragon placement, 120-foot visible-space context, line-of-sight repeat-save cleanup, 1-minute concentration duration, and move-then-breath coupling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those high-level modifier, aura, and illusion rows to keep duration and trigger facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level foresight aura and illusion rows tied to duration and trigger facts" --reporter=dot failed because Foresight still used the old terse attack-Advantage row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level foresight aura and illusion rows tied to duration and trigger facts" --reporter=dot passed with 1 test passed and 246 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-9/foresight.json --spell public/data/spells/level-8/holy-aura.json --spell public/data/spells/level-8/illusory-dragon.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 247 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Foresight D20-test breadth, recast cleanup, Holy Aura chosen-creature aura membership, Fiend/Undead reactive filtering, Illusory Dragon physical illusion targeting, line-of-sight repeat-save scheduling, breath timing during movement, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-MECHANIC-DESCRIPTION-148 - Power Word Pain, Fire Storm, and Draconic Transformation rows expose gates and map facts

Status: verified.

Evidence:
- public/data/spells/level-7/power-word-pain.json had Crippling Pain and speed-cap rows, but the row text omitted 60-foot visible target selection, 100 HP threshold, Charmed-immunity bypass, spellcasting Constitution save gate, repeat-save cleanup, and the fact that the speed cap lasts only while the pain persists.
- public/data/spells/level-7/fire-storm.json had an ignition TERRAIN row, but the row text omitted the caster-arranged area of up to ten contiguous 10-foot Cubes.
- public/data/spells/level-7/draconic-transformation.json had a flight MOVEMENT row, but the row text omitted the 1-minute concentration duration and the fact that flight is part of the same transformation package as blindsight and repeatable breath weapon use.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those rows to keep threshold, terrain, and flight facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level pain fire and transformation rows tied to threshold, terrain, and flight facts" --reporter=dot failed because Power Word Pain still used the old terse Crippling Pain row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level pain fire and transformation rows tied to threshold, terrain, and flight facts" --reporter=dot passed with 1 test passed and 245 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-7/power-word-pain.json --spell public/data/spells/level-7/fire-storm.json --spell public/data/spells/level-7/draconic-transformation.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 246 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Power Word Pain charm-immunity filtering, spellcasting interruption, end-turn repeat-save scheduling, speed-cap enforcement, Fire Storm contiguous-cube placement, object ignition persistence, Draconic Transformation flight mode handling, breath-weapon reuse, blindsight/invisibility perception, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-147 - Sequester, Reverse Gravity, and Prismatic Spray rows expose ending and progression facts

Status: verified.

Evidence:
- public/data/spells/level-7/sequester.json had Invisible and Unconscious rows with divination shielding, magic detection blocking, remote-view blocking, suspended animation, no-aging/no-needs, damage ending, and caster-defined ending condition facts in surrounding data/prose, but the rows only named the bare conditions.
- public/data/spells/level-7/reverse-gravity.json had an end/downward-fall MOVEMENT row, but the row text omitted the 50-foot-radius, 100-foot-high cylinder context and hovering-at-top fall consequence.
- public/data/spells/level-7/prismatic-spray.json had indigo Petrified and violet teleport rows with progression and follow-up save facts, but the rows hid the three-failed-Constitution-save progression, Greater Restoration-style release, Blinded handoff, and start-of-next-turn Wisdom save timing.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those high-level suspension, gravity, and prism rows to keep ending and progression facts visible.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level suspension gravity and prism rows tied to ending and progression facts" --reporter=dot failed because Sequester still used the old terse Invisible row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level suspension gravity and prism rows tied to ending and progression facts" --reporter=dot passed with 1 test passed and 244 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-7/sequester.json --spell public/data/spells/level-7/reverse-gravity.json --spell public/data/spells/level-7/prismatic-spray.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 245 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Sequester component consumption, Divination blocking, remote-view prevention, damage/end-condition cleanup, Reverse Gravity vertical cylinder physics, fall-damage application, Prismatic Spray ray randomization, indigo progression counters, violet planar destination choice, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-146 - Storm and burst rows expose area, timing, and repeat-save facts

Status: verified.

Evidence:
- public/data/spells/level-9/storm-of-vengeance.json had Deafened, Difficult Terrain, and Heavily Obscured rows, but the row text omitted the 300-foot-radius cloud scale, initial Constitution save timing, staged-turn context, ranged-weapon block, and strong-wind rider.
- public/data/spells/level-9/psychic-scream.json had a Stunned row with Intelligence save, up-to-ten visible target selection, Intelligence 2-or-lower exclusion, and end-turn repeat-save metadata, but the row text only said the target was Stunned and repeated the save.
- public/data/spells/level-8/sunburst.json had a Blinded row with 60-foot sunlight sphere context and end-turn repeat-save metadata, but the row text omitted the area and success cleanup.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those rows to keep area, timing, and repeat-save facts visible for combat logs and map overlays.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level storm and burst status rows tied to area, timing, and repeat-save facts" --reporter=dot failed because Storm of Vengeance still used the old terse Deafened row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level storm and burst status rows tied to area, timing, and repeat-save facts" --reporter=dot passed with 1 test passed and 243 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-9/storm-of-vengeance.json --spell public/data/spells/level-9/psychic-scream.json --spell public/data/spells/level-8/sunburst.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 244 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Storm of Vengeance staged scheduling, large-radius map rendering, ranged-weapon prevention, strong-wind movement effects, Psychic Scream Intelligence-floor filtering, repeat-save scheduling, Sunburst darkness dispel execution, or rendered map proof beyond current structured data and row text.

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-145 - Divine Word, Dominate Monster, and Imprisonment rows expose high-level control gates

Status: verified.

Evidence:
- public/data/spells/level-7/divine-word.json had threshold STATUS_CONDITION rows for Dead and Stunned, but those rows hid chosen-target range context, the Charisma save gate, and the relationship between the 30 HP Stunned band and its sibling Blinded/Deafened rows.
- public/data/spells/level-8/dominate-monster.json had a Charmed STATUS_CONDITION row with Wisdom save, combat-advantage save modifier, concentration duration, telepathic command wrapper, and on-damage repeat save metadata, but the row text only said the target was Charmed for the duration.
- public/data/spells/level-9/imprisonment.json had Imprisoned, Restrained, and Unconscious STATUS_CONDITION rows, but those rows omitted the success immunity, no-breath/no-age/divination/no-teleport prison state, Chaining immobility, Slumber no-wake clause, and ending/Dispel route.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those high-level control and imprisonment rows to keep their save, option, repeat-save, and ending facts readable without reopening the full spell card.

Validation:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level control and imprisonment status rows tied to save, option, and repeat-save facts" --reporter=dot failed because Divine Word still used the old terse Dead row wording.
- Green run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "keeps high-level control and imprisonment status rows tied to save, option, and repeat-save facts" --reporter=dot passed with 1 test passed and 242 skipped.
- Changed-spell validation: npm run validate:spells -- --spell public/data/spells/level-7/divine-word.json --spell public/data/spells/level-8/dominate-monster.json --spell public/data/spells/level-9/imprisonment.json reported 459 valid and 0 invalid.
- Full validator: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -- --reporter=dot passed with 243 tests.
- Type proof: npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for multi-target Divine Word creature choice, HP-threshold dispatch, planar banishment, Dominate Monster command enforcement, caster-Reaction spending, on-damage repeat-save scheduling, Imprisonment option selection, ending-trigger evaluation, ninth-level Dispel Magic routing, Divination blocking, no-teleport enforcement, or visual combat-map representation beyond current structured data and row text.

## 2026-06-14 - Strike prison and feeblemind rows name target selection and lockout facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-144 - Steel Wind Strike, Mental Prison, and Feeblemind rows now expose follow-up consequences

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/steel-wind-strike.json had DAMAGE and MOVEMENT rows with 30-foot visible multi-targeting, maxTargets 5 metadata, melee spell hit metadata, 6d10 Force payload, after-primary teleport row, unoccupied visible destination prose, and instantaneous duration, but its damage row hid target count/range and post-attack teleport context.
- public/data/spells/level-6/mental-prison.json had DAMAGE, STATUS_CONDITION, DAMAGE, and UTILITY rows with 60-foot visible targeting, Intelligence save metadata, Charmed-immunity auto-success override, 5d10 and 10d10 Psychic payloads, Restrained payload, on-target-move trigger metadata, 1-minute concentration duration, sensory-cell utility prose, and escape-ending prose, but its status row did not expose the sensory lockout or escape-trigger damage.
- public/data/spells/level-8/feeblemind.json had DAMAGE, UTILITY, and STATUS_CONDITION rows with 150-foot visible-creature targeting, Intelligence save metadata, 4d6 Psychic payload, Feebleminded payload, Intelligence/Charisma reduction prose, long-term lockout utility prose, 30-day repeat-save prose, and Greater Restoration/Heal/Wish ending prose, but its damage row hid the failed-save lockout contract.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name selected visible target limits, post-attack teleport, Charmed-immunity auto-success, successful-save ending, illusory-cell sensory lockout, escape-trigger damage, Intelligence/Charisma reduction, spell/magic-item/language/communication lockout, and 30-day repeat-save cadence.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "strike prison" --reporter=dot failed because Steel Wind Strike still used terse selected-target damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/steel-wind-strike.json --spell public/data/spells/level-6/mental-prison.json --spell public/data/spells/level-8/feeblemind.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for multi-target attack selection, melee spell attack execution, post-attack teleport placement, Charmed-immunity save override, successful-save ending, illusory-cell sensory blocking, escape trigger detection, 10d10 escape damage, Intelligence/Charisma score mutation, spellcasting/magic-item/language/communication lockout enforcement, 30-day save scheduling, Greater Restoration/Heal/Wish ending, Intelligence save execution, damage/status application, immunity/resistance handling, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Tracking spike, blade wall, and flame investiture rows name timing and rider facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-143 - Mind Spike, Blade Barrier, and Investiture of Flame rows now expose timing and rider context

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/mind-spike.json had DAMAGE and UTILITY rows with 120-foot visible-creature targeting, Wisdom save-half metadata, 3d8 Psychic payload, +1d8 slot scaling, 1-hour concentration duration, same-plane tracking utility row, hidden-prevention prose, and Invisible-benefit denial prose, but its damage row said only "Deals 3d8."
- public/data/spells/level-6/blade-barrier.json had three DAMAGE rows plus TERRAIN and UTILITY rows with 90-foot placement, straight wall and ring spatial options, 100-foot/60-foot by 20-foot by 5-foot geometry, Dexterity save-half metadata, 6d10 Force payloads, first-per-turn entry and end-turn triggers, Difficult Terrain row, Three-Quarters Cover utility row, and 10-minute concentration duration, but its initial damage row hid geometry, terrain, and cover context.
- public/data/spells/level-6/investiture-of-flame.json had three DAMAGE rows plus DEFENSIVE/DEFENSIVE/UTILITY rows with self targeting, 10-minute concentration duration, Dexterity save-half metadata, 4d8 and 1d10 Fire payloads, on-caster-action line trigger, on-enter-area and end-turn proximity triggers, Fire immunity, Cold resistance, bright/dim light text, and top-level harmless-flames prose, but its line damage row used generic save-damage wording.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name Mind Spike's tracking rider, Blade Barrier wall/ring geometry, Three-Quarters Cover, Difficult Terrain, entry/end-turn once-per-turn timing, Investiture action line, proximity aura, harmless-to-caster flames, and defensive/light context.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "tracking spike" --reporter=dot failed because Mind Spike still used generic save-damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/mind-spike.json --spell public/data/spells/level-6/blade-barrier.json --spell public/data/spells/level-6/investiture-of-flame.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for same-plane tracking, hidden-state suppression, Invisible-benefit denial, wall/ring placement, cover application, Difficult Terrain enforcement, entry/end-turn trigger scheduling, once-per-turn damage enforcement, line direction UI, close-range aura detection, Fire immunity, Cold resistance, light rendering, Dexterity/Wisdom save execution, damage application, immunity/resistance handling, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Forced-control and sphere restraint rows name saves and movement consequences

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-142 - Compulsion, Confusion, and Watery Sphere rows now expose turn-control facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/compulsion.json had STATUS_CONDITION and MOVEMENT rows with 30-foot visible multi-targeting, 1-minute concentration duration, Wisdom save metadata, Charmed payload, after-forced-movement repeat-save metadata, Bonus Action sustain cost, and forcedMovement metadata, but its condition row hid the Bonus Action direction and safest-route movement consequence.
- public/data/spells/level-4/confusion.json had one STATUS_CONDITION row with 90-foot placement, 10-foot-radius Sphere metadata, Wisdom save metadata, Confused payload, turn-end repeat-save metadata, +5-foot per higher slot radius prose, and top-level d10 behavior table prose, but its row hid action economy suppression and start-turn behavior rolling.
- public/data/spells/level-4/watery-sphere.json had one STATUS_CONDITION row with 90-foot point placement, 5-foot-radius Sphere metadata, Strength save metadata, Restrained payload, turn-end repeat-save metadata, 1-minute concentration duration, choice-to-fail prose, Huge auto-success prose, capacity prose, action movement prose, ram prose, flame-extinguishing prose, end-fall Prone prose, and vanish prose, but its row hid size gates, engulfed movement, and end-fall outcome.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name chosen visible target scope, Bonus Action direction choice, safest-route forced movement, after-movement repeat save, Confusion no Bonus Action/Reactions rider, d10 behavior table trigger, higher-slot radius scaling, Watery Sphere size gates, choice-to-fail and auto-success rules, movement with sphere, escape save, and end-of-spell Prone fall.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "forced-control" --reporter=dot failed because Compulsion still used generic Charmed wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/compulsion.json --spell public/data/spells/level-4/confusion.json --spell public/data/spells/level-4/watery-sphere.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for multi-target selection, Bonus Action direction UI, safest-route forced movement, after-movement repeat-save scheduling, Confusion behavior table execution, Bonus Action/Reaction suppression, higher-slot radius scaling execution, Watery Sphere hover and capacity tracking, random overflow ejection, action movement, ram targeting, drop-off descent, engulfed movement, end-of-spell fall and Prone placement, flame extinguishing, Wisdom/Strength save execution, status application, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Deathlike disease and harm rows name protection and progression facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-141 - Feign Death, Contagion, and Harm rows now expose protection and progression contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/feign-death.json had Blinded, Incapacitated, and DEFENSIVE rows with willing touch targeting, 1-hour non-concentration duration, Resistance to all non-Psychic damage, Poisoned immunity, Speed 0 and deathlike top-level prose, but the status rows said only "Applies Blinded/Incapacitated."
- public/data/spells/level-5/contagion.json had DAMAGE, STATUS_CONDITION, and UTILITY rows with touch targeting, Constitution save metadata, 11d8 Necrotic payload, Poisoned payload, turn-end repeat-save progression metadata, chosen-ability Disadvantage utility row, 7-day duration, and Poisoned-ending save prose, but the damage row hid the Poisoned pairing and the status row needed clearer progression wording.
- public/data/spells/level-6/harm.json had DAMAGE and STATUS_CONDITION rows with 60-foot visible-creature targeting, Constitution save-half metadata, 14d6 Necrotic payload, Hit Point maximum reduction payload, minimum-1 top-level prose, and instantaneous duration, but its rows did not make the damage-to-maximum-reduction dependency visible.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name willing-touch scope, deathlike masking, Speed 0, Resistance, Poisoned immunity, contagion damage/status pairing, three-success/three-failure progression, seven-day duration, Poisoned-ending resistance, visible target range, and damage-tied Hit Point maximum reduction.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "deathlike disease" --reporter=dot failed because Feign Death still used generic Blinded wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/feign-death.json --spell public/data/spells/level-5/contagion.json --spell public/data/spells/level-6/harm.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for willing touch validation, deathlike detection masking, Speed 0 enforcement, resistance/immunity enforcement, contagion disease progression counters, chosen ability selection, Poisoned-ending prevention saves, Hit Point maximum reduction calculation, maximum floor enforcement, Constitution save execution, damage/status application, immunity/resistance handling, or cleanup beyond current structured data and row text.

## 2026-06-14 - Area burst rows name geometry, object gates, and riders

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-140 - Circle of Death, Tidal Wave, and Shatter rows now expose area rider context

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/circle-of-death.json had one DAMAGE row with 150-foot point placement, 60-foot-radius Sphere metadata, Constitution save-half metadata, 8d8 Necrotic payload, +2d8 slot scaling, instantaneous duration, material component, and top-level negative-energy prose, but its row said only "Deals 8d8."
- public/data/spells/level-3/tidal-wave.json had DAMAGE and STATUS_CONDITION rows with 120-foot placement, 30-foot by 10-foot by 10-foot wave prose, Dexterity save-half metadata, 4d8 Bludgeoning payload, Prone payload, unprotected-flame extinguishing prose, and instantaneous vanish prose, but its damage row hid the wave dimensions and riders.
- public/data/spells/level-2/shatter.json had one DAMAGE row with 60-foot point placement, 10-foot-radius Sphere metadata, creature/object targeting, Constitution save-half metadata, Construct Disadvantage save modifier metadata, 3d8 Thunder payload, +1d8 slot scaling, nonmagical-object damage prose, and worn-or-carried exclusion prose, but its row hid the object gate and exact geometry.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name Sphere or wave geometry, placement range, save-half damage, Prone rider, flame-extinguishing rider, Construct save Disadvantage, nonmagical object damage, worn-or-carried exclusion, and slot scaling facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "area burst" --reporter=dot failed because Circle of Death still used generic save-damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/circle-of-death.json --spell public/data/spells/level-3/tidal-wave.json --spell public/data/spells/level-2/shatter.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Sphere/wave target collection, custom wave dimension placement, Prone application, unprotected-flame detection, flame extinguishing, object registry targeting, nonmagical/worn-or-carried object filtering, Construct save Disadvantage routing, Constitution/Dexterity save execution, Necrotic/Bludgeoning/Thunder damage application, slot scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Nature emanation, wilting, and death rows name family and trigger facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-139 - Conjure Woodland Beings, Horrid Wilting, and Finger of Death rows now expose family and follow-up branches

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/conjure-woodland-beings.json had DAMAGE and UTILITY rows with self-centered 10-foot following Emanation metadata, 10-minute concentration duration, Wisdom save-half metadata, 5d8 Force payload, +1d8 slot scaling, visible-creature trigger prose for Emanation entering a space, creature entry, and end-turn, once-per-turn prose, and Bonus Action Disengage utility text, but its damage row said only "Deals 5d8."
- public/data/spells/level-8/abi-dalzims-horrid-wilting.json had one DAMAGE row with 150-foot point placement, 30-foot Cube metadata, Construct and Undead exclusions, Constitution save-half metadata, Plant and Water Elemental Disadvantage save modifier metadata, 12d8 Necrotic payload, and top-level moisture-drawing prose, but its row hid the exclusions and save modifier.
- public/data/spells/level-7/finger-of-death.json had DAMAGE, SUMMONING, and UTILITY rows with 60-foot visible-creature targeting, Constitution save-half metadata, 7d8 + 30 Necrotic payload, Humanoid target filters on follow-up rows, after-primary trigger metadata, zombie creation prose, and verbal-orders prose, but its damage row hid the kill-to-zombie branch.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name following Emanation timing, visible-creature gates, once-per-turn forcing, Construct/Undead exclusions, Plant/Water Elemental save Disadvantage, visible target range, and Humanoid kill-to-zombie facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "nature emanation" --reporter=dot failed because Conjure Woodland Beings still used generic save-damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/conjure-woodland-beings.json --spell public/data/spells/level-8/abi-dalzims-horrid-wilting.json --spell public/data/spells/level-7/finger-of-death.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for following Emanation tracking, visible-creature filtering, once-per-turn damage enforcement, Bonus Action Disengage availability, Construct/Undead exclusion enforcement, Plant/Water Elemental save Disadvantage routing, Humanoid death detection, zombie stat creation and placement, verbal-order control, Constitution/Wisdom save execution, damage application, slot scaling execution, immunity/resistance handling, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Charm cloud and chained lightning rows name gates, triggers, and branching targets

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-138 - Fast Friends, Stinking Cloud, and Chain Lightning rows now expose target and trigger context

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/fast-friends.json had one STATUS_CONDITION row with 30-foot visible/audible/understandable Humanoid targeting, Wisdom save metadata, Charmed payload, 1-hour concentration duration, harmful/conflicting task repeat-save prose, fighting Advantage prose, certain-death conditional ending, higher-slot target scaling prose, and post-charm awareness prose, but its row said only "Applies Charmed."
- public/data/spells/level-3/stinking-cloud.json had one STATUS_CONDITION row with 90-foot point placement, 20-foot-radius Sphere metadata, turn-start trigger, Constitution save metadata, Poisoned payload, 1-minute concentration duration, top-level Heavily Obscured prose, action/Bonus Action denial prose, and strong-wind dispersal prose, but its row hid the start-turn trigger and action-denial consequence.
- public/data/spells/level-6/chain-lightning.json had one DAMAGE row with 150-foot visible creature/object targeting, maxTargets 4 metadata, Dexterity save-half metadata, 10d8 Lightning payload, instantaneous duration, top-level primary-to-secondary bolt prose, unique-target prose, and higher-slot extra-bolt prose, but its row said only "Deals 10d8."
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name Humanoid and communication gates, task service behavior, harmful-task repeat saves, certain-death ending, post-charm awareness, start-turn cloud trigger, gas geometry, action/Bonus Action denial, strong-wind dispersal, primary and secondary chain targets, unique target limits, object targeting, and higher-slot extra bolts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "charm cloud" --reporter=dot failed because Fast Friends still used generic Charmed wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/fast-friends.json --spell public/data/spells/level-3/stinking-cloud.json --spell public/data/spells/level-6/chain-lightning.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Humanoid and communication validation, friendly task adjudication, harmful/conflicting task classification, repeat-save scheduling, fighting-state Advantage routing, certain-death ending, post-charm awareness UI, gas cloud placement, heavy obscurement rendering, strong-wind dispersal, turn-start trigger scheduling, action/Bonus Action denial enforcement, primary/secondary chain target UI, unique-target validation, higher-slot target count execution, Constitution/Dexterity/Wisdom save execution, damage/status application, immunity/resistance handling, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Wall and banishment rows name geometry, side triggers, and return rules

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-137 - Wall of Fire, Banishment, and Wall of Ice rows now expose runtime branches

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/wall-of-fire.json had three DAMAGE rows with 120-foot point placement, straight-wall and ring shape options, 60-foot by 20-foot by 1-foot wall metadata, 20-foot-diameter ring metadata, a 10-foot selected-side trigger zone, immediate Dexterity save-half damage, on-enter-area first-per-turn damage, end-turn damage, 5d8 Fire payloads, +1d8 slot scaling, and 1-minute concentration duration, but its first row said only "Deals 5d8" and its ongoing rows hid the full geometry and scaling.
- public/data/spells/level-4/banishment.json had two STATUS_CONDITION rows with 30-foot visible-creature targeting, Charisma save metadata, Incapacitated and Banished payloads, 1-minute concentration duration, higher-slot target scaling prose, and top-level harmless-demiplane, return-placement, and extraplanar permanent-banish prose, but its rows said only that they applied conditions unless the save succeeded.
- public/data/spells/level-6/wall-of-ice.json had DAMAGE, MOVEMENT, TERRAIN, DAMAGE, and UTILITY rows with 120-foot placement, hemisphere/globe/panel spatial options, 1-foot wall thickness, Dexterity and Constitution save-half metadata, forced side-push metadata, 10d6 and 5d6 Cold payloads, higher-slot appearance/frigid-air scaling prose, section AC/Hit Point data, damage immunity/vulnerability prose, and destroyed-section frigid-air prose, but key rows hid the full shape, durability, and scaling context.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name wall/ring geometry, caster-selected side triggers, demiplane transport and return rules, extraplanar creature-family branch, ice-wall push choice, section durability, immunity/vulnerability, destroyed-section frigid air, and slot scaling facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "wall and banishment" --reporter=dot failed because Wall of Fire still used generic save-damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/wall-of-fire.json --spell public/data/spells/level-4/banishment.json --spell public/data/spells/level-6/wall-of-ice.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for wall/ring placement, side selection UI, selected-side proximity detection, opaque line-of-sight blocking, entry/end-turn trigger scheduling, demiplane transport, return placement, extraplanar creature-family routing, full-minute concentration completion checks, ice-wall section object tracking, section damage and breach handling, vulnerability/immunity enforcement, frigid-air area creation, Constitution or Dexterity save execution, damage application, slot scaling execution, immunity/resistance handling, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Level-five light, mud, and burning rows name triggers and geometry

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-136 - Immolation, Transmute Rock, and Wall of Light rows now expose lifecycle and area facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/immolation.json had 90-foot visible-creature targeting, 1-minute concentration duration, initial Dexterity save-half damage, Burning status with turn-end Dexterity repeat save, separate 4d6 turn-end damage, target-attached bright/dim light metadata, and top-level ash/nonmagical-extinguishing prose, but its damage rows used generic save wording and its status row did not carry the visible range, light, or success-ending context.
- public/data/spells/level-5/transmute-rock.json had 120-foot visible 40-foot Cube targeting, a current DAMAGE row with Dexterity save-half metadata and 4d8 Bludgeoning payload, plus top-level rock-to-mud, mud-to-rock, falling-ceiling, Restrained, escape, rock AC, and rock Hit Point prose, but its row said only "Deals 4d8" and hid the falling-ceiling trigger.
- public/data/spells/level-5/wall-of-light.json had DAMAGE and STATUS_CONDITION rows with 120-foot point placement, 60-foot by 10-foot by 5-foot Wall metadata, 10-minute concentration duration, Constitution save-half metadata, 4d8 Radiant payload, +1d8 slot scaling, Blinded repeat-save metadata, bright/dim light spatial details, beam range and length-reduction details, and top-level beam prose, but its rows hid the wall geometry and Blinded repeat-save rider behind generic save wording.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name visible target range, repeated burning lifecycle, light emission, falling mud trigger, wall geometry, Blinded repeat save, and slot scaling facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "level-five light" --reporter=dot failed because Immolation still used generic initial save-damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/immolation.json --spell public/data/spells/level-5/transmute-rock.json --spell public/data/spells/level-5/wall-of-light.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target validation, Burning application, repeat-save scheduling, light rendering, ash conversion, nonmagical extinguishing prevention, Transmute Rock mode selection, mud movement cost, rock/mud terrain conversion, ceiling collapse collection, Restrained application and escape, rock object durability, wall placement/orientation, line-of-sight blocking, pass-through behavior, Blinded application, wall turn-end damage, beam action routing, wall-length reduction, Constitution or Dexterity save execution, damage application, slot scaling execution, immunity/resistance handling, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Necrotic and psychic save rows name ongoing, threshold, and creature-family facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-135 - Enervation, Synaptic Static, and Negative Energy Flood rows now expose branching riders

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/enervation.json had one DAMAGE row with 60-foot visible creature targeting, Dexterity save-half metadata, 4d8 Necrotic payload, +1d8 slot scaling, 1-minute concentration, and top-level ongoing action damage, success-ending, range/cover ending, and half-damage healing prose, but its row used generic save-damage wording.
- public/data/spells/level-5/synaptic-static.json had DAMAGE and STATUS_CONDITION rows with 120-foot point placement, 20-foot-radius Sphere targeting, Intelligence 3+ filtering, Intelligence save-half metadata, 8d6 Psychic payload, and Muddled Thoughts rider, but its damage row omitted the threshold and condition rider.
- public/data/spells/level-5/negative-energy-flood.json had DAMAGE and HEALING rows with 60-foot visible targeting, non-Undead Constitution save damage, Undead no-save temporary Hit Points, and top-level zombie-rise rider for creatures killed by the damage, but its rows omitted visible range and the zombie branch.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name ongoing drain/healing, Intelligence threshold and Muddled Thoughts, non-Undead damage, Undead temporary Hit Points, and zombie creation facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "necrotic and psychic save" --reporter=dot failed because Enervation still used generic save-damage wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/enervation.json --spell public/data/spells/level-5/synaptic-static.json --spell public/data/spells/level-5/negative-energy-flood.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ongoing action scheduling, action-spend ending, range/cover ending, half-damage healing calculation, concentration upkeep, Intelligence threshold filtering, Muddled Thoughts penalties, repeat saves, Undead/non-Undead branching, zombie creation and AI targeting, temporary Hit Point calculation, save execution, damage/healing application, immunity/resistance handling, or cleanup beyond current structured data and row text.

## 2026-06-14 - Glyph, life transfer, and lightning arrow rows name trigger and payload facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-134 - Delayed rune, self-cost healing, and transformed-ammunition rows now expose execution context

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/glyph-of-warding.json had a DAMAGE row with 20-foot-radius Sphere spatial details, Dexterity save-half metadata, chosen Acid/Cold/Fire/Lightning/Thunder payload, moved-beyond-10-feet break ending, triggered-glyph ending, consumed 200 GP powdered diamond component, and top-level explosive-rune/spell-glyph prose, but its row said only "Deals 5d8" and omitted the delayed trigger and break boundary.
- public/data/spells/level-3/life-transference.json had one DAMAGE row with 4d8 Necrotic self-damage, mitigation bypass metadata, +1d8 slot scaling, 30-foot visible creature targeting, and top-level healing equal to twice the Necrotic damage taken, but its row omitted the unreduced-damage and healing handoff.
- public/data/spells/level-3/lightning-arrow.json had primary and secondary DAMAGE rows with transformed weapon/ammunition top-level prose, hit-or-miss primary damage, secondary 10-foot Dexterity save burst, +1d8 scaling on both rows, and an existing pending-attack trigger caveat on the primary row, but the secondary row used generic burst wording and the primary row needed fuller hit/miss context.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name delayed trigger, movement break, self-cost healing, transformed-ammunition hit/miss, secondary burst, and existing pending-trigger caveat facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "glyph cost" --reporter=dot failed because Glyph of Warding still used generic "Deals 5d8" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/glyph-of-warding.json --spell public/data/spells/level-3/life-transference.json --spell public/data/spells/level-3/lightning-arrow.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for glyph inscription, trigger authoring, password/type exclusions, hidden glyph discovery, moved-object break detection, explosive-rune choice routing, stored-spell glyph execution, consumed component accounting, unreduced self-damage enforcement, healing calculation, transformed weapon/ammunition trigger routing, hit/miss primary damage, secondary burst collection, Dexterity save execution, slot scaling execution, damage/healing application, immunity/resistance handling, or cleanup beyond current structured data and row text.

## 2026-06-14 - Broad save-damage rows name target gates, geometry, and special riders

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-133 - Blight, Ice Storm, and Cone of Cold rows now expose visible targets and area riders

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/blight.json had a DAMAGE row with 30-foot visible targeting, Constitution save-half metadata, Plant-creature auto-failure metadata, 8d8 Necrotic payload, +1d8 slot scaling, and a sibling nonmagical-plant wither row, but its damage row said only "Deals 8d8 Necrotic damage."
- public/data/spells/level-4/ice-storm.json had Bludgeoning and Cold damage rows plus a terrain row, with 300-foot placement, a 20-foot-radius/40-foot-high Cylinder, Dexterity save-half metadata, 2d10 Bludgeoning payload, 4d6 Cold payload, +1d10 Bludgeoning slot scaling, and Difficult Terrain, but both damage rows hid the Cylinder and shared save context.
- public/data/spells/level-5/cone-of-cold.json had one DAMAGE row with self-originating 60-foot Cone targeting, Constitution save-half metadata, 8d8 Cold payload, +1d8 slot scaling, and top-level frozen-statue rider for killed creatures, but its row omitted Cone geometry and the kill rider.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name target gates, geometry, save-half damage, special riders, and slot scaling.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "broad save-damage" --reporter=dot failed because Blight still used generic "Deals 8d8 Necrotic damage" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/blight.json --spell public/data/spells/level-4/ice-storm.json --spell public/data/spells/level-5/cone-of-cold.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target validation, plant/object classification, Plant auto-failure, nonmagical plant withering, Cylinder/Cone target collection, Difficult Terrain application, terrain expiry, frozen-statue creation, thawing, Constitution or Dexterity save execution, Necrotic/Bludgeoning/Cold damage application, slot scaling execution, immunity/resistance handling, or cleanup beyond current structured data and row text.

## 2026-06-14 - Hit-rider damage rows name target, healing, and aura facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-132 - Guiding Bolt, Vampiric Touch, and Conjure Minor Elementals rows now expose hit riders

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/guiding-bolt.json had DAMAGE and UTILITY rows with 120-foot creature targeting, ranged-hit Radiant damage, +1d6 slot scaling, and a same-hit next-attack Advantage rider, but its damage row said only "one target" and omitted the Advantage rider.
- public/data/spells/level-3/vampiric-touch.json had DAMAGE and HEALING rows with melee spell hit metadata, 3d6 Necrotic payload, +1d6 slot scaling, half-damage healing metadata, 1-minute concentration, and top-level repeat Magic action prose, but its damage row exposed "hit-based melee spell attack resolves" plumbing and omitted healing.
- public/data/spells/level-4/conjure-minor-elementals.json had DAMAGE and TERRAIN rows with 15-foot following Emanation metadata, on-attack-hit trigger, 2d8 chosen Acid/Cold/Fire/Lightning payload, +1d8 slot scaling, 10-minute concentration, and enemy Difficult Terrain, but its damage row exposed "hit-based elemental aura damage resolves" plumbing and omitted the creature-in-Emanation gate.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these hit-rider damage rows to name target gates, hit riders, healing handoff, aura gate, chosen damage type, and slot scaling.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "hit-rider damage" --reporter=dot failed because Guiding Bolt still used vague "one target" wording and omitted the same-hit Advantage rider.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/guiding-bolt.json --spell public/data/spells/level-3/vampiric-touch.json --spell public/data/spells/level-4/conjure-minor-elementals.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack construction, melee spell attack construction, target validation, next-attack Advantage consumption, repeated Magic action scheduling, half-damage healing calculation, concentration upkeep, following Emanation tracking, chosen elemental damage type routing, enemy Difficult Terrain, slot scaling execution, damage/healing application, immunity/resistance handling, or cleanup beyond current structured data and row text.

## 2026-06-14 - Level-three generic damage rows name placement, geometry, and teleport context

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-131 - Conjure Barrage, Erupting Earth, and Thunder Step rows now expose why save damage happens

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/conjure-barrage.json had one DAMAGE row with self-originating 60-foot Cone targeting, Dexterity save-half metadata, 5d8 Force payload, +1d8 slot scaling, and top-level prose limiting affected targets to chosen visible creatures, but its row said only "Deals 5d8 Force damage."
- public/data/spells/level-3/erupting-earth.json had a DAMAGE row with visible ground-point placement within 120 feet, 20-foot Cube targeting, Dexterity save-half metadata, 3d12 Bludgeoning payload, +1d12 slot scaling, and a sibling terrain row for Difficult Terrain, but its damage row omitted placement and geometry.
- public/data/spells/level-3/thunder-step.json had one DAMAGE row with Constitution save-half metadata, 3d10 Thunder payload, +1d10 slot scaling, soundEmission metadata for a 300-foot boom from the origin space after teleport, and top-level teleport/companion prose, but its row omitted the post-teleport origin-space context and audible boom.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these level-three damage rows to name placement, geometry, save-half damage, slot scaling, and Thunder Step's teleport-origin sound context.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "level-three generic damage" --reporter=dot failed because Conjure Barrage still used generic "Deals 5d8 Force damage" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/conjure-barrage.json --spell public/data/spells/level-3/erupting-earth.json --spell public/data/spells/level-3/thunder-step.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for chosen visible creature filtering, Cone/Cube/ground-point target collection, terrain persistence, terrain clearing, teleport placement, willing companion handling, carried-object limits, origin-space area collection, Constitution or Dexterity save execution, Force/Bludgeoning/Thunder damage application, sound propagation, slot scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Otiluke's Resilient Sphere defensive row names Disintegrate exception

### SSO-HIGH-IMPACT-DEFENSIVE-DESCRIPTION-130 - Resilient Sphere immunity row no longer reads as absolute

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/otilukes-resilient-sphere.json had a UTILITY wrapper row that named the Large-or-smaller target, Dexterity save for unwilling creatures, two-way barrier blocking, weightless movement, and Disintegrate destruction exception.
- The DEFENSIVE row had all-damage immunity metadata and the same `disintegrate_targets_effect` conditional ending, but its description said only "The sphere itself is immune to all damage."
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the DEFENSIVE row to name both all-damage immunity and the Disintegrate exception so the row does not display as unconditional immunity.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Otiluke resilient sphere" --reporter=dot failed because the defensive row omitted the Disintegrate exception.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-4/otilukes-resilient-sphere.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Large-or-smaller eligibility, object eligibility, unwilling-target Dexterity saves, barrier creation, two-way blocking, breathing permission, weightless movement, sphere pushing, pickup movement, Disintegrate targeting, sphere destruction, concentration upkeep, duration cleanup, or inside/outside damage prevention beyond current structured data and row text.

## 2026-06-14 - High-level full-heal rows name restoration scope and condition cleanup

### SSO-HIGH-IMPACT-HEALING-DESCRIPTION-129 - True Resurrection and Power Word Heal healing rows now expose full restoration contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/true-resurrection.json had a HEALING row with `all_hit_points`, a UTILITY row with death eligibility and restoration control options, a MOVEMENT row for new-body placement, consumed 25,000 GP diamonds, and top-level prose covering the 200-year/not-old-age gate, wounds, poison, magical contagions, curses, organ/limb restoration, Undead restoration, and new-body fallback. The HEALING row said only "The dead creature is revived with all Hit Points."
- public/data/spells/level-9/power-word-heal.json had a HEALING row with `all_hit_points`, a UTILITY row with condition removal and Prone reaction-stand facts, a MOVEMENT row for ending Prone, and 60-foot visible creature targeting. The HEALING row said only "The target regains all of its Hit Points."
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both high-level HEALING rows to carry the primary restoration/condition-cleanup contract visible in effect lists.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "high-level full-heal" --reporter=dot failed because True Resurrection's HEALING row only said the dead creature is revived with all Hit Points.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/true-resurrection.json --spell public/data/spells/level-9/power-word-heal.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for death-age validation, old-age exclusion, consumed diamond accounting, corpse/body existence checks, spoken-name new-body creation, unoccupied-space placement, poison/contagion/curse cleanup, organ/limb restoration, Undead form restoration, full Hit Point restoration, condition removal, Prone reaction standing, reaction availability, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Level-three area lightning and fire rows name geometry, saves, and reuse facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-128 - Fireball, Lightning Bolt, and Call Lightning rows now expose area mechanics

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/fireball.json had one DAMAGE row with 150-foot placement range, 20-foot-radius Sphere targeting, Dexterity save-half metadata, 8d6 Fire payload, +1d6 slot scaling, and top-level flammable-object ignition prose, but its row said only "Deals 8d6 Fire damage" and omitted geometry, range, ignition, and worn-or-carried exclusion.
- public/data/spells/level-3/lightning-bolt.json had one DAMAGE row with self-originating 100-foot Line targeting, Dexterity save-half metadata, 8d6 Lightning payload, and +1d6 slot scaling, but its row omitted Line geometry and caster origin.
- public/data/spells/level-3/call-lightning.json had a DAMAGE row with 120-foot cloud placement, 60-foot Cylinder cloud targeting, Dexterity save-half metadata, 3d10 Lightning payload, +1d10 slot scaling, and top-level storm bonus prose; its UTILITY row had a granted each-turn Magic action to call lightning again on the same or different point, but both rows used generic wording.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these level-three rows to name geometry, save-half damage, slot scaling, Fireball ignition, Call Lightning storm bonus, and reusable Magic action facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "level-three area lightning and fire" --reporter=dot failed because Fireball still used generic "Deals 8d6 Fire damage" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/fireball.json --spell public/data/spells/level-3/lightning-bolt.json --spell public/data/spells/level-3/call-lightning.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for point placement, Sphere/Line/Cylinder target collection, storm-cloud creation, outdoor-storm detection, same-or-different point retargeting, Magic action scheduling, Dexterity save execution, Fire/Lightning damage application, flammable-object detection, worn-or-carried exclusion, ignition state creation, slot scaling execution, concentration upkeep, or cleanup beyond current structured data and row text.

## 2026-06-14 - Magic Stone, Thorn Whip, and True Strike rows name attack wrappers and ability substitutions

### SSO-HIGH-IMPACT-MECHANICS-DESCRIPTION-127 - Cantrip weapon and pull wrappers now expose attacker, ability, and hit-type facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/magic-stone.json had a UTILITY row with projectile instance allocation, attackAugments, caster spellcasting ability substitution, 1d6 Bludgeoning payload, hit-or-miss pebble ending, and recast ending metadata, but its row used shorthand "60ft", "1d6 + Mod", and "Spell Attack Roll" wording while omitting that another creature can attack with the pebble and still uses the caster's spellcasting ability.
- public/data/spells/level-0/thorn-whip.json had DAMAGE and MOVEMENT rows for a melee spell attack, 30-foot creature targeting, 1d6 Piercing payload, exact cantrip scaling metadata, and Large-or-smaller pull metadata, but its rows said "ranged spell hit" and vague cantrip-tier scaling.
- public/data/spells/level-0/true-strike.json had a UTILITY row with casting-weapon attack metadata, spellcasting ability substitution for attack and damage rolls, Strength/Dexterity replacement metadata, damage type choice metadata, and exact Radiant scaling metadata, but its row used compact weapon-attack wording and omitted the casting weapon, replacement ability, damage-type choice timing, and scaling tiers.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name attacker identity, attack type, ability substitution, target/pull gates, ending facts, and exact scaling where modeled.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "cantrip weapon and pull wrappers" --reporter=dot failed because Magic Stone still used shorthand attacker, range, ability, damage, and ending wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes and the older Thorn Whip proof expectation/comment were updated to the same melee-hit wording.
- npm run validate:spells -- --spell public/data/spells/level-0/magic-stone.json --spell public/data/spells/level-0/thorn-whip.json --spell public/data/spells/level-0/true-strike.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for pebble object selection, projectile allocation, alternate-attacker permission, caster ability substitution, sling range handling, hit-or-miss pebble depletion, recast ending, melee spell attack construction, Thorn Whip pull pathing, weapon component validation, True Strike weapon attack execution, Strength/Dexterity replacement, Radiant-vs-normal damage choice, cantrip-tier scaling execution, damage application, immunity/resistance handling, or cleanup beyond current structured data and row text.

## 2026-06-14 - Primal Savagery and Produce Flame rows name attack gates and exact scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-126 - Primal Savagery and Produce Flame rows now expose cantrip attack context

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/primal-savagery.json had one DAMAGE row with melee hit metadata, 5-foot creature targeting, 1d10 Acid payload, and exact character-level scaling metadata, but its row said only "one target" and used vague cantrip-tier scaling wording.
- public/data/spells/level-0/produce-flame.json had a UTILITY light row with Bright Light, Dim Light, no-heat, no-ignition, and end-on-recast metadata, but its row used lowercase light terms, omitted the no-heat/no-ignition facts, and omitted the recast ending.
- Produce Flame's DAMAGE row had on-caster-action hit metadata, 1d8 Fire payload, exact character-level scaling metadata, and top-level prose naming a Magic action, creature/object target, and 60-foot hurl range, but its row used vague spell-attack and cantrip-tier wording.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Primal Savagery and Produce Flame rows to name the attack target gates, light facts, recast ending, Magic action hurl, and exact cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "primal and produced flame" --reporter=dot failed because Primal Savagery still used vague "one target" and cantrip-tier scaling wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/primal-savagery.json --spell public/data/spells/level-0/produce-flame.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for melee spell attack construction, ranged spell attack construction, creature/object target validation, Magic action scheduling, held-flame lifecycle, light rendering, no-heat/no-ignition enforcement, recast ending, Acid or Fire damage application, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous/timed cleanup beyond current structured data and row text.

## 2026-06-14 - Hit-chained smite and vine rows name their triggering attacks

### SSO-HIGH-IMPACT-MECHANICS-DESCRIPTION-125 - Blinding Smite and Grasping Vine rows no longer hide behind generic hit wording

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/blinding-smite.json had a DAMAGE row with hit condition metadata and 3d8 Radiant payload, but its row said "hit-based smite damage effect resolves," exposing importer/runtime plumbing instead of the strike that hit.
- public/data/spells/level-4/grasping-vine.json had a MOVEMENT row with hit condition metadata, spell attack filter, pull movement type, 30-foot distance, and forcedMovement text toward the vine, but its row said only "On a hit" instead of naming the vine's melee spell attack hit.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Blinding Smite's damage row and Grasping Vine's movement row to name the player-facing triggering attacks.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "hit-chained smite and vine" --reporter=dot failed because Blinding Smite still exposed "hit-based smite damage effect" plumbing.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes and the older Grasping Vine proof expectation was updated to the same clearer vine-hit wording.
- npm run validate:spells -- --spell public/data/spells/level-3/blinding-smite.json --spell public/data/spells/level-4/grasping-vine.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for smite arming, weapon-hit detection, Radiant damage application, Blinded application, turn-end Constitution saves, vine object creation, later-turn Bonus Action attack scheduling, melee spell attack construction, Grappled application, forced pull pathing, escape checks, concentration upkeep, duration cleanup, or higher-slot grapple scaling beyond current structured data and row text.

## 2026-06-14 - Melf's Minute Meteors rows name meteor expenditure and explosion damage

### SSO-HIGH-IMPACT-MECHANICS-DESCRIPTION-124 - Melf's Minute Meteors rows now expose delayed meteor flow

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/melfs-minute-meteors.json had a DAMAGE row with Dexterity save-half metadata and 2d6 Fire payload, but its row omitted the expended meteor, destination or solid-surface impact trigger, and 5-foot explosion point context.
- The same spell had a UTILITY row with an `Expend Meteors` granted Bonus Action, each-turn frequency, and 120-foot point-selection notes, but its row said only "You can expend one or two of the meteors."
- The top-level prose establishes six orbiting meteors, cast-time and later-turn Bonus Action expenditure, one-or-two meteor spending, one-or-two 120-foot points, destination or solid-surface explosion, and 5-foot Dexterity save damage.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Melf's Minute Meteors's damage and utility rows to keep the delayed meteor expenditure and explosion damage facts visible.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Melf's Minute Meteors" --reporter=dot failed because the damage row omitted the expended meteor trigger, explosion point, and impact/destination context.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/melfs-minute-meteors.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for six-meteor state creation, orbiting display, cast-time expenditure, later-turn Bonus Action scheduling, point targeting, meteor count depletion, solid-surface collision detection, explosion placement, Dexterity save execution, Fire damage application, concentration upkeep, duration cleanup, or unused-meteor expiry beyond current structured data and row text.

## 2026-06-14 - Self-centered cantrip area rows name save gates, riders, and exact scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-123 - Sword Burst, Thunderclap, and Word of Radiance rows now expose area cantrip facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/sword-burst.json had one DAMAGE row with self-centered 5-foot area targeting, Dexterity save metadata, 1d6 Force payload, and exact character-level scaling metadata, but its row said "Creatures in the 5-foot burst" and used vague cantrip-tier scaling instead of naming other creatures around the caster and 2d6, 3d6, and 4d6 tiers.
- public/data/spells/level-0/thunderclap.json had one DAMAGE row with self-centered 5-foot area targeting, Constitution save metadata, 1d6 Thunder payload, 100-foot soundEmission metadata, and higher-level scaling prose, but its row omitted the Emanation origin, failed-save outcome, audible thunder rider, and exact scaling tiers.
- public/data/spells/level-0/word-of-radiance.json had one DAMAGE row with self-centered 5-foot area targeting, caster-choice visible-creature selection metadata, Constitution save metadata, 1d6 Radiant payload, and higher-level scaling prose, but its row used vague cantrip-tier scaling and did not make the failed-save outcome explicit.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these three self-centered cantrip rows to name their save gates, runtime/UI differentiators, failed-save damage, and exact cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "self-centered cantrip area" --reporter=dot failed because Sword Burst still used generic 5-foot burst and vague cantrip-tier scaling wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/sword-burst.json --spell public/data/spells/level-0/thunderclap.json --spell public/data/spells/level-0/word-of-radiance.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for self-centered area collection, other-creature exclusion, Emanation geometry, caster-choice visible-creature selection, Dexterity or Constitution save execution, Force/Thunder/Radiant damage application, thunder sound propagation, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Sacred Flame row names visible target, cover bypass, radiant damage, and cantrip scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-122 - Sacred Flame row now exposes its cover-bypass save

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/sacred-flame.json had one DAMAGE row with Dexterity save metadata, 1d8 Radiant payload, and cover_bypass metadata for Half Cover and Three-Quarters Cover.
- The row said only "one target within 60 feet" and used vague cantrip-tier scaling language, omitting the visible creature target gate, Half Cover / Three-Quarters Cover bypass, failed-save outcome, and exact 2d8, 3d8, and 4d8 scaling tiers.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Sacred Flame's row to name the visible 60-foot creature target, Dexterity save, cover-bypass exception, 1d8 Radiant damage, failed-save outcome, and cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Sacred Flame row" --reporter=dot failed because the row omitted the visible target gate, cover-bypass exception, failed-save outcome, and exact scaling tiers.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/sacred-flame.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target selection, cover classification, Half Cover / Three-Quarters Cover bypass execution, Dexterity save execution, Radiant damage application, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Starry Wisp rows name ranged hit damage, reveal light, invisibility denial, and scaling

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-121 - Starry Wisp rows now expose the reveal rider alongside cantrip damage

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/starry-wisp.json had a DAMAGE row that said "one target" and used vague cantrip-tier scaling language instead of naming the 60-foot creature/object target and 2d8, 3d8, and 4d8 tiers.
- The UTILITY reveal row said only "Target sheds dim light" and "cannot benefit from invisibility," omitting the shared ranged spell hit context and the `Invisible` condition wording already used by the rest of the spell data.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Starry Wisp's rows to keep ranged-hit Radiant damage, Dim Light reveal, Invisible benefit denial, end-of-next-turn expiry, and scaling facts visible as separate rows.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Starry Wisp rows" --reporter=dot failed because the damage row used vague target/scaling wording; the reveal row also needed shared hit context and Invisible condition wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/starry-wisp.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for creature/object targeting, ranged spell attack construction, hit detection, Radiant damage application, Dim Light rendering, Invisible benefit denial, expiry timing, cantrip-tier scaling execution, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Toll the Dead row names visible target, bell sound, wounded dice, and scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-120 - Toll the Dead row now exposes wounded-target dice switch

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/toll-the-dead.json had one DAMAGE row with Wisdom save metadata, Necrotic damage, soundEmission metadata, and custom cantrip scaling.
- The row used vague "d8s or d12s based on the target's injury state" and "scales at cantrip tiers" wording instead of naming 1d8 base damage, 1d12 wounded-target damage, and the 2/3/4-dice scaling tiers.
- The row also omitted the visible creature target gate and the 10-foot audible bell rider, even though there is no sibling utility row for sound/log feedback.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Toll the Dead's row to name the visible 60-foot target, bell sound, Wisdom save, base and wounded Necrotic dice, and cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Toll the Dead row" --reporter=dot failed because the row used vague injury/scaling wording and omitted the bell rider.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/toll-the-dead.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target selection, Wisdom save execution, Hit Point missing detection, Necrotic damage application, bell sound propagation, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Mind Sliver damage row names visible target, Intelligence save, psychic damage, and scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-119 - Mind Sliver damage row now complements the save-penalty proof

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/mind-sliver.json already had durable proof for the UTILITY row naming the failed Intelligence save gate on the next-save penalty.
- The DAMAGE row still said "one target within 60 feet" and used vague cantrip-tier scaling language instead of naming the visible creature gate and 2d6, 3d6, and 4d6 tiers.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Mind Sliver's damage row to name the visible 60-foot creature target, Intelligence save, 1d6 Psychic damage, failed-save outcome, and cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Mind Sliver damage row" --reporter=dot failed because the damage row omitted the visible creature gate and exact scaling tiers.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/mind-sliver.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target selection, Intelligence save execution, Psychic damage application, 1d4 next-save penalty consumption, cantrip-tier scaling execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Acid Splash row names point placement, sphere damage, save, and cantrip scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-118 - Acid Splash row now exposes point placement and exact scaling tiers

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/acid-splash.json had one DAMAGE row that named a 5-foot sphere, Dexterity save, 1d6 Acid payload, and cantrip scaling metadata.
- The row omitted the 60-foot point placement and used vague cantrip-tier scaling language instead of naming the 2d6, 3d6, and 4d6 tiers.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Acid Splash's row to name point placement, 5-foot-radius Sphere geometry, Dexterity save, 1d6 Acid damage, failed-save outcome, and cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Acid Splash row" --reporter=dot failed because the row omitted point range and exact scaling tiers.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/acid-splash.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for point placement, Sphere target collection, Dexterity save execution, Acid damage application, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Fire Bolt row names ranged hit, object ignition, and cantrip scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-117 - Fire Bolt row now exposes creature/object targeting and ignition

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/fire-bolt.json had one DAMAGE row with correct 1d10 Fire payload and character-level scaling metadata.
- The row omitted the 120-foot range, flammable-object ignition rider, and worn-or-carried exclusion even though Fire Bolt has no sibling utility row for object state.
- The row also used vague cantrip-tier scaling language instead of naming the 2d10, 3d10, and 4d10 tiers already present in scaling metadata and higherLevels.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Fire Bolt's row to name the creature/object target, 120-foot range, ranged spell hit, Fire damage dice, object ignition rider, worn-or-carried exclusion, and cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Fire Bolt row" --reporter=dot failed because the row omitted range, object ignition, worn/carried exclusion, and explicit scaling tiers.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/fire-bolt.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for creature/object targeting, ranged spell attack construction, hit detection, Fire damage application, flammable-object detection, worn-or-carried exclusion, ignition state creation, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Poison Spray row names ranged spell hit, poison damage, and cantrip scaling

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-116 - Poison Spray row no longer exposes hit-effect plumbing

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/poison-spray.json had one DAMAGE row with correct 1d12 Poison payload and cantrip scaling metadata.
- The row said the damage happened when the "hit-based damage effect resolves," which describes importer/runtime plumbing rather than the player-facing ranged spell hit.
- The row also used vague scaling language instead of naming the 2d12, 3d12, and 4d12 cantrip tiers already present in higherLevels and scaling metadata.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Poison Spray's row to name the 30-foot creature target, ranged spell hit, 1d12 Poison damage, and cantrip scaling tiers.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Poison Spray row" --reporter=dot failed because the row still used "hit-based damage effect" wording and vague scaling.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/poison-spray.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack construction, hit detection, Poison damage application, cantrip-tier scaling execution, immunity/resistance handling, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Frostbite row names visible target, cold damage, weapon-attack penalty, and cantrip scaling

### SSO-HIGH-IMPACT-DEBUFF-DESCRIPTION-115 - Frostbite row now exposes its damage dice and next-attack penalty

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/frostbite.json had one ATTACK_ROLL_MODIFIER row that combined Cold damage and next-weapon-attack Disadvantage.
- The row said only "cold damage" instead of naming the modeled 1d6 Cold payload and cantrip scaling to 2d6, 3d6, and 4d6.
- The row also omitted the visible 60-foot target gate and used lowercase disadvantage wording despite the structured attackRollModifier payload.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Frostbite's row to name the visible target, Constitution save, Cold damage dice, next weapon attack Disadvantage, expiry timing, and cantrip scaling.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Frostbite row" --reporter=dot failed because the row omitted exact dice, visible range, and cantrip scaling.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/frostbite.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target selection, Constitution save execution, Cold damage application, cantrip-tier scaling execution, next-weapon-attack Disadvantage routing, attack-modifier consumption, expiry timing, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Burning Hands row names cone damage and flammable-object ignition

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-114 - Burning Hands single row now exposes its object ignition rider

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/burning-hands.json had a single DAMAGE row that named the 15-foot cone, Dexterity save, 3d6 Fire damage, save-half outcome, and +1d6 slot scaling.
- The row omitted the flammable-object ignition rider even though Burning Hands has no sibling utility row to surface objects in the Cone that are not worn or carried starting to burn.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Burning Hands's single row to carry both the creature damage contract and the flammable-object ignition consequence.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Burning Hands row" --reporter=dot failed because the row omitted the flammable-object ignition rider.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/burning-hands.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Cone placement, Dexterity save execution, Fire damage application, save-half damage, flammable-object detection, worn-or-carried exclusion, ignition state creation, slot scaling execution, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Hellish Rebuke row names visible damage-triggering creature and save-half fire facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-113 - Hellish Rebuke reaction row now exposes its trigger gate

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/hellish-rebuke.json had a single DAMAGE row that named 60-foot range, Dexterity save, 2d10 Fire damage, save-half outcome, and +1d10 slot scaling.
- The row still used "triggering target" shorthand instead of naming the reaction gate: a visible creature within 60 feet that damages the caster.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Hellish Rebuke's single row to name the visible damage-triggering creature, Dexterity save, Fire damage, save-half outcome, and slot scaling.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Hellish Rebuke row" --reporter=dot failed because the row still used "triggering target" shorthand.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/hellish-rebuke.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Reaction availability, visible-trigger validation, damage-trigger attribution, 60-foot range checks, Dexterity save execution, Fire damage application, save-half damage, slot scaling execution, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Arms of Hadar row names emanation damage and reaction suppression facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-112 - Arms of Hadar reaction-suppression row now exposes its failed-save rider

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/arms-of-hadar.json already had a DAMAGE row naming the 10-foot Emanation, Strength save, 2d6 Necrotic damage, save-half outcome, and +1d6 slot scaling.
- The STATUS_CONDITION row still said creatures that fail the Strength save have reactions suppressed for 1 round, omitting the 10-foot Emanation context and the spell-card timing of "until the start of its next turn."
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Arms of Hadar's rows to keep the save-half damage and failed-save Reaction denial rider readable as separate rows.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Arms of Hadar rows" --reporter=dot failed because the reaction-suppression row omitted Emanation context and start-of-next-turn timing.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/arms-of-hadar.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 10-foot Emanation target collection, Strength save execution, Necrotic damage application, save-half damage, Reaction suppression application, start-of-next-turn expiry, slot scaling execution, or instantaneous cleanup beyond current structured data and row text. The existing status payload's generic duration/repeat-save shape remains a possible later modeling cleanup; this pass only fixes the player-facing row text.

## 2026-06-14 - Catapult row names object eligibility, line travel, collision, and damage handoff

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-111 - Catapult utility row now exposes object-control facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/catapult.json already had a DAMAGE row naming the 90-foot line, Dexterity save, 3d8 Bludgeoning damage, and +1d8 slot scaling.
- The UTILITY row still used shorthand "unattended object 1-5 lb" and "90 ft", omitting the 60-foot selection range, worn-or-carried exclusion, +5-pound-per-slot target-weight scaling, fall-to-ground behavior, creature impact requiring failed Dexterity save, and object-plus-impact-target damage handoff.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Catapult's rows to keep object eligibility, line travel, collision stopping, save-gated creature impact, and damage handoff visible for runtime/UI text.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Catapult rows" --reporter=dot failed because the utility row used shorthand and omitted range, scaling, fall, save-gated creature impact, and collision damage handoff.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/catapult.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for object registry targeting, worn-or-carried validation, object weight scaling, line path selection, collision detection, solid-surface impact, Dexterity save execution, object and target damage application, falling placement, slot scaling execution, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Ensnaring Strike row names save advantage, restraint, escape, and vine damage

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-110 - Ensnaring Strike restraint row now exposes its full control contract

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/ensnaring-strike.json already had a damage row naming 1d6 Piercing vine damage and +1d6 slot scaling.
- The STATUS_CONDITION row only said the struck target makes a Strength save or is Restrained, omitting the Large-or-larger save Advantage, successful-save vines-shrivel spell ending, and Strength (Athletics) escape action available to the target or a creature within reach.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Ensnaring Strike's rows to keep the failed-save Restrained rider and start-turn vine damage facts standalone.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Ensnaring Strike rows" --reporter=dot failed because the Restrained row omitted size-based save Advantage, successful-save ending, and escape-action details.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/ensnaring-strike.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for smite arming, triggering weapon-hit detection, Strength save execution, size-based Advantage routing, Restrained application, successful-save spell ending, start-turn Piercing damage, reachable-helper escape checks, Strength (Athletics) check execution, slot scaling execution, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Dissonant Whispers movement row names reaction movement limits

### SSO-HIGH-IMPACT-MOVEMENT-DESCRIPTION-109 - Dissonant Whispers reaction movement now exposes its failed-save contract

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/dissonant-whispers.json already had a focused DAMAGE row naming the 60-foot target, Wisdom save, 3d6 Psychic damage, save-half outcome, and +1d6 slot scaling.
- The MOVEMENT row still said only that the target uses its reaction to move away by the safest route, omitting the visible 60-foot target gate, immediate timing, Reaction availability caveat, as-far-as-possible instruction, and up-to-Speed limit.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Dissonant Whispers's rows to keep the Psychic damage and failed-save Reaction movement contracts readable without reopening the full spell card.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Dissonant Whispers rows" --reporter=dot failed because the movement row omitted immediate timing, visibility/range, Reaction availability, and max-distance details.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/dissonant-whispers.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible target selection, Wisdom save execution, Psychic damage application, save-half damage, forced Reaction availability checks, safest-route pathing, up-to-Speed distance measurement, opportunity attack interactions, slot scaling execution, or instantaneous cleanup beyond current structured data and row text.

## 2026-06-14 - Calm Emotions rows name area, mode choice, suppression, and indifference endings

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-108 - Calm Emotions mode rows now expose their separate contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/calm-emotions.json already had Humanoid filters on both direct effect rows, but the DEFENSIVE mode row omitted the 20-foot Sphere, 60-foot placement range, and explicit 1-minute concentration duration.
- The UTILITY mode row still used compact "On failed save" wording and collapsed suppression and indifference options together even though suppression already belongs to the sibling DEFENSIVE row.
- The indifference row also needed the damage / witness-allies-damaged ending fact visible in the row instead of relying on conditionalEndings alone.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Calm Emotions's rows to keep defensive suppression and social indifference separated while naming area, Humanoid gate, Charisma save, duration, concentration, and mode-specific endings.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Calm Emotions rows" --reporter=dot failed because the defensive row omitted area, range, and explicit duration facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/calm-emotions.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Sphere placement, Humanoid collection, per-target mode selection, Charisma save execution, Charmed/Frightened immunity application, existing-condition suppression and restoration, hostility/indifference attitude mutation, damage or witnessed-ally-damage ending, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Tasha's Hideous Laughter Incapacitated row names repeat saves and scaling

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-107 - Tasha's Hideous Laughter Incapacitated row now exposes its repeat-save loop

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/tashas-hideous-laughter.json already had a verified Prone row that named the failed Wisdom save directly.
- The Incapacitated row still used compact "Target is incapacitated on a failed save" wording and omitted the 30-foot visible target gate, 1-minute concentration duration, and higher-slot extra-target scaling.
- The row did mention end-turn and damage-triggered repeat saves, but the wording was shorthand and did not make the damage-triggered Advantage branch or success-ending loop fully standalone for runtime/UI rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Tasha's Hideous Laughter's Incapacitated row to name the visible target range, Wisdom save, duration, concentration, end-turn and damage repeat saves, damage-triggered Advantage, and higher-slot target scaling.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Tashas Hideous Laughter Incapacitated row" --reporter=dot failed because the Incapacitated row still used compact failed-save shorthand and omitted duration / scaling facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/tashas-hideous-laughter.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for target selection, Wisdom save execution, Incapacitated application, Prone application, laughter capability display, damage-triggered repeat saves with Advantage, end-turn repeat saves, self-ending Prone prevention, higher-slot target scaling execution, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Crown of Madness rows name forced attack, sustain, and repeat-save facts

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-106 - Crown of Madness control rows now expose the forced-action loop

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/crown-of-madness.json already carried the Humanoid filter on its direct utility row, but the visible control description still used generic "On failed save, target is charmed" wording.
- The control row also omitted the visible 120-foot target range, Humanoid gate, 1-minute concentration duration, no-chosen-or-reachable-target normal-action exception, and later-turn Magic-action sustain requirement.
- The Charmed status row described only "the spell's duration" instead of naming the 1-minute concentration window and end-turn Wisdom repeat-save success ending.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Crown of Madness's control and status rows to expose the forced melee-action loop, normal-action exception, sustain action, and repeat-save ending directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Crown of Madness rows" --reporter=dot failed because the control row still used generic failed-save wording and omitted sustain / exception facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/crown-of-madness.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Humanoid target selection, Wisdom save execution, Charmed application, spectral crown rendering, caster-chosen attack target UI, forced melee action scheduling, no-valid-target fallback, repeat-save scheduling, sustain Magic-action enforcement, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Compelled Duel secondary rows separate attack pressure from movement leash

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-105 - Compelled Duel secondary rows now expose their local trigger facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/compelled-duel.json already had a verified primary taunt row naming the Wisdom save, Disadvantage rider, 30-foot leash, 1-minute concentration duration, and early-ending conditions.
- The secondary attack-trigger row still described a Wisdom save and attack loss, while the spell-card contract and primary row describe Disadvantage on attacks against creatures other than the caster.
- The secondary movement-trigger row repeated partial early-ending text instead of naming the willing-movement restriction that its trigger exists to surface.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the secondary rows to stay scoped to off-target attack pressure and the 30-foot willing-movement leash.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Compelled Duel secondary rows" --reporter=dot failed because the attack row still described a Wisdom save and attack loss.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/compelled-duel.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Compelled Duel target selection, Wisdom save execution, disadvantage routing, attack-pressure enforcement, willing-movement leash enforcement, attack/spell/ally-damage/end-turn break detection, concentration upkeep, or duration cleanup beyond current structured data and row text. The secondary attack row still carries save-trigger metadata that may need a later modeling pass; this change does not silently rewrite that schema behavior.

## 2026-06-14 - Leomund's Tiny Hut row names shelter boundary, entry, spell-blocking, and comfort facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-104 - Leomund's Tiny Hut row now exposes shelter boundary rules

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/leomunds-tiny-hut.json had a single UTILITY row that named the shelter shell but omitted the 8-hour duration and dry-atmosphere comfort fact.
- The row also used shorthand "initial occupants", "outsiders", and "low-level spells" instead of naming creatures and objects inside when cast, barred later entrants/objects, and spells of 3rd level or lower.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Leomund's Tiny Hut's row to name the stationary 10-foot-radius shelter, 8-hour duration, pass-through group, barred outsiders/objects, spell-level boundary, and dim-light/darkness comfort facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Leomund Tiny Hut row" --reporter=dot failed because the row still used shorthand shelter text and omitted duration / dry comfort facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/leomunds-tiny-hut.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for shelter placement, creature/object membership tracking at cast time, pass-through enforcement, later-entry blocking, object blocking, spell-level boundary checks, atmosphere/weather protection, interior light selection, 8-hour duration cleanup, or dome rendering beyond current structured data and row text.

## 2026-06-14 - Create Food and Water row names quantities, range, capacity, and spoilage

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-103 - Create Food and Water row now exposes provisioning facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/create-food-and-water.json had a single UTILITY row that used second-person prose and vague "within range" wording instead of naming the 30-foot placement range.
- The row also split quantity, capacity, food spoilage, and water persistence across copied-style sentences rather than one compact provisioning row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Create Food and Water's row to name 45 pounds of food, 30 gallons of water, 30-foot placement, fifteen Humanoids or five steeds, 24-hour sustainment, food spoilage, and water persistence.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Create Food and Water row" --reporter=dot failed because the row still used vague range and second-person wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/create-food-and-water.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ground/container placement, food object creation, water object creation, carrying/storage capacity, Humanoid/steed consumption accounting, spoilage timers, or survival-resource integration beyond current structured data and row text.

## 2026-06-14 - Dispel Magic row names target range, spell-level gate, and higher-slot auto-end

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-102 - Dispel Magic row now includes its higher-slot ending rule

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/dispel-magic.json had a single UTILITY row that used vague "within range" wording and omitted the higher-slot automatic ending rule already present in higherLevels.
- The row also split the 4th-level-or-higher spell check across multiple copied-style sentences rather than a compact runtime/UI rule.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Dispel Magic's row to name creature/object/magical-effect targets, 120-foot range, automatic 3rd-level-or-lower ending, DC 10 + spell level check for 4th-level-or-higher spells, and higher-slot auto-ending.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Dispel Magic row" --reporter=dot failed because the row still used vague range wording and omitted higher-slot auto-ending.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/dispel-magic.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for magical-effect target selection, ongoing-spell discovery, spell-level comparison, spellcasting-ability check execution, higher-slot scaling execution, target cleanup, or interaction with special non-dispellable effects beyond current structured data and row text.

## 2026-06-14 - Aura of Life wrapper stays separate from resistance, maximum, and healing rows

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-101 - Aura of Life utility row now describes only the moving aura shell

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/aura-of-life.json already had separate DEFENSIVE rows for Necrotic resistance and Hit Point maximum protection plus a HEALING row for start-turn 0-HP recovery.
- The UTILITY row duplicated all three sibling payloads instead of describing only the 30-foot moving aura shell, duration, concentration, and nonhostile-creature scope.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Aura of Life's four rows to keep wrapper, resistance, maximum protection, and healing facts distinct.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Aura of Life wrapper" --reporter=dot failed because the utility row still duplicated the sibling payload facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-4/aura-of-life.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for moving aura tracking, nonhostile filtering, Necrotic resistance application, Hit Point maximum reduction prevention, living-creature detection, 0-HP start-turn healing, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Daylight row names range, duration, object origin, and darkness dispel facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-100 - Daylight row now exposes range and duration with its light rules

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/daylight.json had a single UTILITY row that already named bright/dim sunlight, object origin, opaque-cover blocking, and level-3-or-lower magical Darkness dispel, but it used vague "within range" wording and omitted the 1-hour duration.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Daylight's light-control row to name the 60-foot placement range, 1-hour duration, object-origin option, opaque-cover block, and lower-level Darkness dispel in one player-facing row.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Daylight row" --reporter=dot failed because Daylight still used vague range wording and omitted the duration.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/daylight.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for point placement, unattended-object validation, object-origin movement, opaque-cover state detection, Bright/Dim Light rendering, magical Darkness overlap detection, spell-level comparison, dispel execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Primordial Ward rows separate resistance, reaction immunity, and ending facts

### SSO-HIGH-IMPACT-DEFENSIVE-DESCRIPTION-099 - Primordial Ward rows now avoid duplicated wrapper prose

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/primordial-ward.json already had separate DEFENSIVE rows for broad elemental resistance and reaction immunity, but the UTILITY row repeated the full spell-card prose instead of carrying only the resistance-ending and spell-ending transition.
- The resistance row used vague "for the duration" wording instead of naming the 1-minute concentration duration.
- The reaction immunity row used "one of the listed damage types" instead of naming Acid, Cold, Fire, Lightning, and Thunder directly.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the three rows to separate base resistance, reaction immunity, and reaction-triggered ending facts.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Primordial Ward rows" --reporter=dot failed because Primordial Ward still used vague duration/listed-type text and duplicated full wrapper prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/primordial-ward.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for resistance application, reaction timing, triggering-damage immunity retroactivity, ending resistance state, chosen-immunity duration cleanup, concentration upkeep, or spell-ending cleanup beyond current structured data and row text.

## 2026-06-14 - Word of Recall rows separate sanctuary teleport and preparation rules

### SSO-HIGH-IMPACT-MOVEMENT-DESCRIPTION-098 - Word of Recall teleport rows now avoid copied sanctuary prose

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/word-of-recall.json had a MOVEMENT row that omitted the 5-foot willing-creature range and prepared-spot placement detail.
- The UTILITY row repeated the full spell-card teleport prose instead of focusing on the sanctuary precondition and preparation rule.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Word of Recall rows to keep the teleport payload separate from sanctuary-preparation behavior.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Word of Recall rows" --reporter=dot failed because the movement row was underspecified and the utility row still repeated full spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/word-of-recall.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for willing-target confirmation, 5-foot target collection, sanctuary registration, nearest-unoccupied-space placement, no-sanctuary failure handling, teleport execution, or destination persistence beyond current structured data and row text.

## 2026-06-14 - Clairvoyance row names sensor placement, sense choice, and visibility exception

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-097 - Clairvoyance row now avoids copied sensor prose

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/clairvoyance.json had a copied-style UTILITY row that used vague "within range" and repeated spell-card setup around the invisible sensor, sense choice, Bonus Action switching, and See Invisibility or Truesight visibility exception.
- The current structured data already stores the 1-mile range, 10-minute concentration duration, point targeting, material focus, and single utility row, so the row can be concise without losing the sensor facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the row to name sensor placement, sight/hearing mode choice, Bonus Action switching, and the fist-sized luminous-orb exception directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Clairvoyance row" --reporter=dot failed because Clairvoyance still used copied-style sensor prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/clairvoyance.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for familiar-location validation, obvious-location validation, sensor placement, sight/hearing mode UI, Bonus Action sense switching, See Invisibility or Truesight visibility checks, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Rary's Telepathic Bond row names target gate and same-plane communication

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-096 - Rary's Telepathic Bond row now matches its Intelligence gate

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/rarys-telepathic-bond.json had a copied-style UTILITY row that said creatures unable to communicate in any languages were unaffected, while the current structured targeting gate and top-level prose use an Intelligence greater than 2 threshold.
- The row also used vague "within range" and "for the duration" wording instead of naming the 30-foot selection range and 1-hour duration.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the single communication row to name up to eight willing creatures, 30-foot selection, 1-hour duration, Intelligence 2-or-lower exclusion, same-plane reach, and no shared-language requirement.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Rary Telepathic Bond" --reporter=dot failed because the row still used copied-style prose and the stale language-communication exclusion.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/rarys-telepathic-bond.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for willing-target confirmation, Intelligence threshold enforcement, telepathic-network membership tracking, same-plane checks, cross-language communication UI, ritual casting handling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Wind Wall rows name wall damage and projectile barrier facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-095 - Wind Wall rows now expose area damage and barrier exceptions

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/wind-wall.json had a DAMAGE row that only said it dealt 4d8 Bludgeoning damage on a failed Strength save, omitting the 50-foot-long, 15-foot-high, 1-foot-thick wall and area-on-appearance trigger.
- The UTILITY row repeated long spell-card prose for gases, flying creatures or objects, lightweight materials, projectile deflection, heavy-projectile exceptions, and gaseous-form blocking instead of a compact runtime/UI row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Wind Wall rows to name the wall damage trigger and barrier/projectile exceptions directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Wind Wall rows" --reporter=dot failed because Wind Wall still used the short damage row and long spell-card barrier row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/wind-wall.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for continuous-path wall placement, Strength save execution, Bludgeoning damage application, fog/smoke/gas movement blocking, Small-or-smaller flying creature/object blocking, lightweight-material updraft behavior, ordinary projectile miss routing, heavy-projectile exception handling, gaseous-form blocking, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Investiture of Wind flight row avoids movement-mode runtime debt

### SSO-HIGH-IMPACT-MOVEMENT-DESCRIPTION-094 - Investiture of Wind flight row now stays player-facing

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/investiture-of-wind.json had a MOVEMENT speed-change row that exposed implementation debt: "the runtime still needs a first-class movement-mode field to distinguish flying speed from walking speed changes."
- The same effect already carries endCleanup metadata for falling when the spell ends, so the row can name the 10-minute concentration flight benefit and fall boundary without exposing runtime modeling debt to logs or UI.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the flight row to stay player-facing while preserving the current five-row model.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Investiture of Wind flight row" --reporter=dot failed because the flight row still exposed missing movement-mode infrastructure.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-6/investiture-of-wind.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for first-class flight-vs-walk speed modeling, ranged-weapon Disadvantage execution, 15-foot Cube action targeting, Constitution save execution, Bludgeoning damage application, Large-or-smaller push filtering, flying-speed cleanup, fall prevention checks, concentration upkeep, or duration cleanup beyond current structured data and row text. The missing movement-mode modeling concern remains a runtime gap; this pass only removes that implementation note from player-facing effect text.

## 2026-06-14 - Telekinesis creature-control row names repeat action, movement, and suspension facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-093 - Telekinesis row now exposes its creature-control loop

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/telekinesis.json currently models Telekinesis as one STATUS_CONDITION row for the creature-control branch, but the row only said a Huge or smaller creature that failed the Strength save was Restrained until the caster's next turn.
- The row did not surface the 10-minute concentration duration, Magic-action repeat loop, 60-foot target range, 30-foot forced movement, lifted-target suspension, or need to use the option again to keep a lifted target suspended.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the current row to carry those creature-control facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Telekinesis creature-control" --reporter=dot failed because Telekinesis still used the short Restrained-only row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/telekinesis.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for target switching, object manipulation, worn-or-carried object contests, fine object control, forced movement pathing, airborne suspension physics, fall timing, repeated Magic-action scheduling, concentration upkeep, or duration cleanup beyond current structured data and row text. Telekinesis still needs a future modeling decision if object-control behavior should become first-class structured effects instead of top-level prose.

## 2026-06-14 - Sunbeam rows name reusable line damage, blindness, and sunlight facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-092 - Sunbeam rows now separate line damage, Blinded pressure, and sunlight reuse

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/sunbeam.json already had separate DAMAGE, STATUS_CONDITION, and UTILITY rows, but the damage row used implementation-flavored launch/recreate wording and the utility row did not keep the 1-minute concentration, sunlight radius, and later-turn line reuse contract together.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Sunbeam rows to name the 5-foot-wide 60-foot line, Constitution save, 6d8 Radiant damage, half-on-success result, failed-save Blinded duration, sunlight radii, and repeat action directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Sunbeam rows" --reporter=dot failed because Sunbeam still used launch/recreate wording and less-specific status/light rows.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/sunbeam.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for line placement, Constitution save execution, Radiant damage application, Blinded application, sunlight rendering, later-turn action scheduling, concentration upkeep, repeat-line projection, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Gentle Repose row names corpse protection and resurrection timing

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-091 - Gentle Repose single utility row now avoids copied spell-card prose

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/gentle-repose.json intentionally remains a single corpse/remains protection utility row, but the row used copied second-person spell-card prose and a loose "such as Raise Dead" example instead of concise player-facing mechanics.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the row to name the corpse/remains gate, 10-day duration, decay prevention, Undead prevention, and resurrection time-limit pause directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Gentle Repose" --reporter=dot failed because Gentle Repose still used copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-2/gentle-repose.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for corpse/remains target validation, decay prevention, Undead transformation blocking, resurrection-clock accounting, duration expiry, or cleanup beyond current structured data and row text. The spell remains on the monolithic allowlist because it is one legitimate corpse/remains protection utility, not because its previous prose was acceptable.

## 2026-06-14 - Heroes' Feast rows avoid runtime debt and second-person setup prose

### SSO-HIGH-IMPACT-HEALING-DESCRIPTION-090 - Heroes' Feast benefit rows now stay player-facing

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/heroes-feast.json had a HEALING row that exposed implementation debt: "The runtime still needs a first-class hit-point-maximum-increase field."
- The feast setup UTILITY row used copied second-person prose instead of a compact row that names the unoccupied 10-foot Cube, twelve-creature limit, 1-hour eating window, feast disappearance, and delayed benefit timing.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Heroes' Feast rows to keep healing, Poison resistance, condition immunity, and feast setup benefits player-facing.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Heroes Feast" --reporter=dot failed because Heroes' Feast still exposed runtime debt and copied setup prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/heroes-feast.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for feast placement, unoccupied Cube validation, participant tracking, 1-hour consumption timing, delayed benefit application, Hit Point maximum mutation, healing execution, Poison resistance, Frightened/Poisoned immunity, 24-hour expiry, or duration cleanup beyond current structured data and row text. The missing first-class hit-point-maximum field remains a runtime modeling gap; this pass only removes that implementation note from player-facing spell rows.

## 2026-06-14 - Darkness row names origin mode, light blocking, and dispel facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-089 - Darkness visibility row now exposes object-origin and magical-light contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/darkness.json had a compact UTILITY row that named magical Darkness, point-or-object origin, Darkvision blocking, and nonmagical-light blocking, but omitted the 60-foot placement range, 10-minute concentration duration, opaque-cover shutoff for object-origin Darkness, and level-2-or-lower magical light dispel.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the single Darkness row to name origin mode, visibility/light behavior, object-cover behavior, and lower-level magical-light suppression directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Darkness row" --reporter=dot failed because Darkness still used the compact row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-2/darkness.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for magical Darkness rendering, point placement, unattended-object validation, object-origin Emanation movement, opaque-cover state detection, Darkvision blocking, nonmagical-light blocking, magical-light spell-level comparison, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Weird fear rows name repeat-save exit and ongoing psychic pressure

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-088 - Weird Frightened row now exposes its end-turn escape contract

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/weird.json had a STATUS_CONDITION row that said the target had Frightened "for the duration" without naming the end-turn Wisdom repeat save and success exit already present in repeat-save metadata.
- The failed-repeat DAMAGE row said "A Frightened target" instead of tying the 5d10 Psychic pressure specifically to a target still Frightened by Weird after failing its repeat save.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Weird's four row descriptions to keep initial damage, Frightened repeat-save cleanup, failed-repeat damage, and illusion wrapper facts distinct.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Weird fear rows" --reporter=dot failed because Weird still used the compact Frightened row and less-specific repeat-damage row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/weird.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Weird area rendering, chosen-creature filtering, Wisdom save execution, Psychic damage application, Frightened application, end-turn repeat-save scheduling, per-target ending, repeat Psychic damage routing, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Slow status row names each action-economy and defense penalty

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-087 - Slow row now exposes all visible status restrictions

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/slow.json had a compact STATUS_CONDITION row that collapsed Speed halving, -2 AC and Dexterity-save penalty, no Reactions, action-or-Bonus-Action restriction, one-attack cap, Somatic spell failure chance, and end-turn repeat save into shorthand phrases.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the row to name each player-facing restriction directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Slow status row" --reporter=dot failed because Slow still used the compact shorthand status row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/slow.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for multi-target selection inside a 40-foot Cube, Wisdom save execution, Speed mutation, AC/Dexterity-save penalty application, Reaction blocking, action-economy enforcement, one-attack cap enforcement, Somatic component spell-failure routing, concentration upkeep, repeat-save scheduling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Eyebite option rows name target gates and repeat use facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-086 - Eyebite option rows now expose Asleep, Panicked, and Sickened contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/eyebite.json had compact option rows and a copied utility wrapper that hid the visible 60-foot target gate, 1-minute concentration duration, Wisdom save, option menu, action retarget loop, successful-save retarget immunity, Asleep wake conditions, Panicked Dash and 60-foot no-see exit, and Sickened repeat-save exit.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name option, target, save, retarget, and exit facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Eyebite options" --reporter=dot failed because Eyebite still used the old compact option rows and copied spell wrapper.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/eyebite.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for target collection, Wisdom save execution, option selection UI, successful-save retarget immunity, action retarget loop, Unconscious/Frightened/Sickened application, wake/shake action routing, Dash pathing, 60-foot no-see exit detection, repeat-save scheduling, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Phase, barrier, and plant portal wrappers name timing and travel facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-085 - Blink, Globe of Invulnerability, and Transport via Plants rows now expose timing and travel contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/blink.json had a copied phase-shift row that hid 1-minute duration, end-turn 1d6 timing, 4-6 threshold, already-Ethereal ending, Ethereal perception range, interaction boundary, start-next-turn return, visible unoccupied return space, and nearest-space fallback.
- public/data/spells/level-6/globe-of-invulnerability.json had a compact defensive row and copied barrier wrapper that needed visible 1-minute concentration duration, 10-foot-radius barrier, outside-cast spell-level gate, target-but-no-effect behavior, area exclusion, and higher-slot blocked-level scaling.
- public/data/spells/level-6/transport-via-plants.json had movement and utility rows that needed visible 1-minute duration, 5-foot movement cost, Large-or-larger inanimate source plant, 10-foot source range, same-plane destination, seen-or-touched destination prerequisite, and any-creature access.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name phase, barrier, plant portal, timing, travel, and cleanup facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "phase barrier and plant portal wrappers" --reporter=dot failed because Blink still used copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/blink.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/globe-of-invulnerability.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/transport-via-plants.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Blink end-turn roll scheduling, Ethereal Plane state, perception filtering, cross-plane targeting rules, return placement, nearest-space fallback, Globe of Invulnerability barrier placement, immobility enforcement, spell-origin classification, spell-level comparison, higher-slot blocked-level scaling execution, area exclusion routing, Transport via Plants plant validation, destination-memory validation, same-plane checks, movement-cost spending, portal traversal, shared access, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Forbiddance ward damage row names area and creature families

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-084 - Forbiddance damage row now exposes ward scope and 5d10 Radiant payload

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/forbiddance.json had a DAMAGE row that said "always-applied ward damage effect", which exposed importer/modeling language instead of player-visible ward facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the row to name the 40,000-square-foot ward, 1-day duration, affected creature families, entry/start-turn timing, and 5d10 Radiant payload directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "Forbiddance ward damage" --reporter=dot failed because Forbiddance still used internal "always-applied ward damage effect" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-6/forbiddance.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Forbiddance area tracing, teleport/planar-travel blocking, password/exemption handling, creature-family filtering, entry/start-turn trigger scheduling, Radiant damage application, repeated-cast permanence, material component handling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Illusion, soul, and minor-effect wrappers name mode and cleanup facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-083 - Mislead, Soul Cage, and Prestidigitation rows now expose mode menus and lifecycle contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/mislead.json had a copied illusion wrapper that hid the 1-hour concentration duration, self-Invisible state, double creation, attack/cast ending, Magic-action double movement, twice-Speed limit, sensory projection, Bonus Action sense switching, and self Blinded/Deafened tradeoff.
- public/data/spells/level-6/soul-cage.json had a compact healing row and copied soul-trap wrapper that needed visible Bonus Action use cost, 2d8 healing payload, 60-foot dying-Humanoid trigger, tiny-cage component, 8-hour duration, cage-destruction cleanup, six-use limit, sixth-use release, and revive blocking.
- public/data/spells/level-0/prestidigitation.json had a numbered compact option menu that needed visible 10-foot range, harmless sensory effect, fire-light/snuff option, 1-cubic-foot clean/soil and chill/warm/flavor limits, 1-hour mark and material durations, and hand-sized trinket/illusion end-of-next-turn cleanup.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name illusion, soul-use, minor-effect, action-cost, mode, and cleanup facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "illusion soul and minor-effect wrappers" --reporter=dot failed because Mislead still used copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/mislead.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/soul-cage.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/prestidigitation.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Mislead Invisible application, double rendering, attack/cast ending detection, Magic-action double movement, gesture/speech/behavior control, sense projection, Bonus Action sense switching, Blinded/Deafened tradeoff, Soul Cage death-trigger reaction timing, Humanoid validation, cage component handling, trapped-soul use counting, Steal Life healing execution, other soul exploitation modes, revival blocking, cage destruction cleanup, Prestidigitation option selection UI, sensory effect rendering, fire object validation, object volume validation, nonliving-material validation, mark/symbol placement, trinket/image cleanup, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Route, command, ward, and access wrappers name failure and exception facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-082 - Find the Path, Geas, Guards and Wards, and Knock rows now expose routing and exception contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/find-the-path.json had a copied route-finding row that hid the 1-day concentration duration, familiar/specific/fixed/same-plane destination gate, another-plane/moving/nonspecific failure cases, distance/direction maintenance, path-branch choice, and not-necessarily-safe boundary.
- public/data/spells/level-5/geas.json had a copied command row and compact Charmed row that needed visible 60-foot visible-creature target, understand-command auto-success, 30-day duration, Wisdom save, Charmed state, once-per-day 5d10 Psychic disobedience damage, suicidal-command ending, and Remove Curse/Greater Restoration/Wish cleanup.
- public/data/spells/level-6/guards-and-wards.json had a copied ward wrapper that hid 24-hour duration, 2,500-square-foot floor area, 20-foot height, contiguous walk-through casting constraint, specified-individual exemptions, password immunity, and internal effect-package routing.
- public/data/spells/level-2/knock.json had a copied access row that needed visible object categories, 60-foot visibility gate, mundane lock/stuck/barred outcomes, one-lock limit, Arcane Lock 10-minute suppression, and 300-foot sound emission.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name route, command, ward, access, failure, and exception facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "route command ward and access wrappers" --reporter=dot failed because Find the Path still used copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/find-the-path.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/geas.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/guards-and-wards.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/knock.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Find the Path destination familiarity validation, same-plane checks, route graph search, moving/nonspecific destination failure routing, distance/direction UI, safety scoring, Geas command text entry, language/understanding validation, Wisdom save execution, Charmed application, disobedience detection, once-per-day Psychic damage tracking, suicidal-command adjudication, cleanup spell routing, Guards and Wards area tracing, contiguous traversal validation, multi-story warding, individual exemption selection, password immunity, individual ward-effect execution, Knock object-category validation, lock count detection, stuck/barred state mutation, Arcane Lock suppression timer, sound emission propagation, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Access, knowledge, and tree movement wrappers name visibility and exit facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-081 - Illusory Script, Rope Trick, Commune with Nature, and Tree Stride rows now expose access and movement contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/illusory-script.json had a copied writing illusion row that hid the 10-day duration, designated-reader split, unknown-script or alternate-message mode, known-language limit, Dispel Magic cleanup, and Truesight reveal.
- public/data/spells/level-2/rope-trick.json had a copied extradimensional-space row that needed visible 60-foot rope eligibility, 1-hour duration, invisible entrance, climbing access, eight Medium-or-smaller capacity, rope-hiding option, attack/spell crossing block, 3-foot-by-5-foot viewing window, and end-of-spell drop.
- public/data/spells/level-5/commune-with-nature.json had a copied knowledge row that hid the 3-mile outdoor radius, 300-foot underground radius, construction replacement failure, three-fact selection, settlement/portal/CR 10+ creature/prevalent nature/water options, and DM choice boundary.
- public/data/spells/level-5/tree-stride.json had utility and movement rows that needed visible 1-minute concentration duration, 5-foot movement cost, once-per-turn limit, same-kind living-tree and size gates, 500-foot destination search, no-movement fallback, and must-end-outside-tree rule.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name access, knowledge, movement, visibility, and exit facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "access knowledge and tree movement wrappers" --reporter=dot failed because Illusory Script still used copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/illusory-script.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/rope-trick.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/commune-with-nature.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/tree-stride.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Illusory Script writing-surface validation, designated-reader selection, alternate-message authoring, known-language validation, Dispel Magic cleanup, Truesight reveal UI, Rope Trick rope-length validation, entrance placement, climbing access, extradimensional capacity, rope-hiding state, attack/spell crossing prevention, window rendering, end-of-spell drop placement, Commune with Nature natural-area detection, construction-failure routing, fact menu UI, portal/settlement/body-of-water lookup, CR 10+ creature selection, prevalent nature summarization, Tree Stride living-tree detection, same-kind tree matching, size comparison, per-turn use tracking, movement-cost spending, destination placement, no-movement fallback, end-turn outside-tree enforcement, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Creation, petrification, portal, and reincarnation wrappers name lifecycle facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-080 - Create Homunculus, Flesh to Stone, Arcane Gate, and Reincarnate rows now expose lifecycle and failure contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/create-homunculus.json had a copied homunculus utility row and a compact damage row that hid the irreducible dagger damage, Monster Manual stat dependency, companion death link, one-homunculus limit, recast failure, same-plane Hit Dice transfer, hit point maximum reduction, long-rest expiry, and homunculus-death cleanup.
- public/data/spells/level-6/flesh-to-stone.json had focused Restrained and Petrified rows but a copied utility wrapper that needed visible flesh-bodied target eligibility, 60-foot visibility gate, 1-minute concentration duration, three-success/three-failure tracking, breakage deformity consequence, and full-duration permanence.
- public/data/spells/level-6/arcane-gate.json had a copied portal row that hid the two ground-point choices, 10-foot and 500-foot placement limits, 10-foot portal diameter, occupied-space failure, one-sided portal direction, opaque mist, adjacent-exit behavior, and Bonus Action rotation.
- public/data/spells/level-5/reincarnate.json had a copied table-heavy resurrection row that needed visible dead-Humanoid or body-piece eligibility, 10-day limit, new-body creation, soul return, 1d10 or DM species assignment, species choices, memory preservation, capability preservation, and species-trait replacement.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name lifecycle, failure, portal, and reincarnation facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "creation petrification portal and reincarnation wrappers" --reporter=dot failed because Create Homunculus still used copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/create-homunculus.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/flesh-to-stone.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/arcane-gate.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/reincarnate.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Create Homunculus component validation, dagger damage routing, irreducible damage enforcement, homunculus stat generation, companion ownership, death-link cleanup, one-homunculus tracking, recast failure routing, Hit Dice spending UI, same-plane validation, hit point maximum mutation, long-rest expiry, Flesh to Stone flesh-bodied target validation, Constitution save execution, Restrained application, repeat-save scheduling, three-success/three-failure counters, Petrified application, breakage/deformity persistence, full-duration permanence, Arcane Gate portal placement, occupied-space failure execution, one-sided portal facing, opacity rendering, portal travel pathing, Bonus Action rotation, Reincarnate dead-Humanoid validation, 10-day death timer, soul willingness or availability, new-body generation, species table rolling, species choice UI, trait replacement, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Transformation, object, and terrain wrappers name limits and cleanup facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-079 - Gaseous Form, Awaken, Drawmij's Instant Summons, and Mirage Arcane rows now expose transformation and object contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/gaseous-form.json had compact defensive rows and a copied utility row that hid the willing-touch gate, 1-hour concentration duration, 0-Hit-Point and Magic-action exits, 10-foot Fly Speed with hover, save Advantage, shared-space movement, narrow-opening movement, liquid boundary, and speech/object/action prohibitions.
- public/data/spells/level-5/awaken.json had Charmed and utility rows that hid the 8-hour consumed-gemstone setup, Beast/Plant and Intelligence eligibility, natural-plant conversion, Intelligence 10, known-language grant, movement and senses, DM-chosen statistics, 30-day Charmed duration, damage break, and attitude choice.
- public/data/spells/level-6/drawmijs-instant-summons.json had a copied object-binding row that needed visible 10-pound and 6-foot limits, unique-sapphire naming, cross-distance or cross-plane summoning, held-or-carried exception, identity/location fallback, and sapphire Dispel Magic cleanup.
- public/data/spells/level-7/mirage-arcane.json had terrain and utility rows that needed visible 10-day duration, 1-square-mile visible terrain limit, sensory illusion scope, structure alteration, creature exclusion, Difficult Terrain toggle, removed-piece cleanup, and Truesight interaction facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name transformation, eligibility, object, terrain, and cleanup facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "transformation object and terrain wrappers" --reporter=dot failed because Gaseous Form still used compact and copied row text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/gaseous-form.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/awaken.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/drawmijs-instant-summons.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/mirage-arcane.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Gaseous Form willing-target validation, transformation lifecycle, equipment locking, Fly Speed mutation, hover movement, save Advantage routing, space sharing, narrow-opening traversal, liquid-surface behavior, speech/object/action prohibitions, Awaken casting-time orchestration, consumed component handling, Beast/Plant and Intelligence validation, language assignment, plant stat generation, Charmed application, damage-break routing, attitude adjudication, Drawmij's Instant Summons object eligibility, unique-sapphire inventory tracking, item-name entry, sapphire crushing action, cross-plane transport, held-or-carried possession checks, identity/location lookup, dispel cleanup, Mirage Arcane area placement, terrain rendering, structure illusion authoring, creature exclusion, Difficult Terrain enforcement, removed-piece cleanup, Truesight reveal handling, physical interaction adjudication, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Bargain, memory, and binding wrappers name service and ending facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-078 - Planar Ally, Modify Memory, Animate Dead, and Planar Binding rows now expose service contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/planar-ally.json had a compact summoning row and a monolithic bargain row that hid the known-cosmic-power requirement, named-creature request, no-compulsion boundary, communication requirement, payment schedule, refusal risk, and home-plane return conditions.
- public/data/spells/level-5/modify-memory.json had a monolithic memory utility row and compact Charmed/Incapacitated rows that needed visible target range, Wisdom save Advantage, 1-minute concentration, 24-hour / 10-minute memory window, damage/targeted-spell interruption, language description requirement, Charmed, and Incapacitated facts.
- public/data/spells/level-3/animate-dead.json had a long command-control row that hid bones/corpse choice, Skeleton/Zombie outcome, 24-hour control, 60-foot Bonus Action command loop, uncommanded fallback, persistent orders, and recast reassert-control scaling.
- public/data/spells/level-5/planar-binding.json had a monolithic binding utility row and compact Bound row that needed visible creature-family eligibility, full-casting range requirement, Charisma save, 24-hour base duration, source-duration extension, hostile instruction-twisting, and report/wait ending facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name eligibility, bargain/control/memory/binding state, save gates, command loops, interruptions, and ending facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "bargain memory and binding wrappers" --reporter=dot failed because Planar Ally still used long prose in the utility row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/planar-ally.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/modify-memory.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/animate-dead.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/planar-binding.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Planar Ally cosmic-power lookup, named-creature fulfillment, ally selection, bargain UI, payment enforcement, refusal adjudication, home-plane travel, Modify Memory save execution, Charmed/Incapacitated application, interruption detection, memory-edit authoring, language validation, altered-memory persistence, Remove Curse/Greater Restoration cleanup, Animate Dead corpse/bone validation, Skeleton/Zombie stat generation, Bonus Action command scheduling, order persistence, 24-hour control expiry, reassert-control targeting and scaling, Planar Binding full-casting range tracking, creature-family validation, Charisma save execution, Bound enforcement, hostile instruction twisting, source-spell duration extension, reporting/waiting behavior, higher-slot duration scaling execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Complex control wrappers name command, access, and cleanup facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-077 - Animate Objects, Mass Suggestion, and Mordenkainen's Magnificent Mansion rows now expose command and access contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/animate-objects.json had a compact control row that omitted the 120-foot selection, Huge-or-smaller object eligibility, 1-minute concentration duration, shared initiative, Bonus Action command loop, Dodge fallback, and excess-damage reversion details.
- public/data/spells/level-6/mass-suggestion.json had Charmed and utility rows that hid the can-hear/can-understand gates, 25-word limit, up-to-twelve visible targets, 60-foot range, achievable non-damaging suggestion constraint, 24-hour duration, completion ending, and caster-or-ally damage break.
- public/data/spells/level-7/mordenkainens-magnificent-mansion.json had movement, summoning, and utility rows that needed clearer extradimensional-expulsion, servant-limit, access-control, door, floor-plan, banquet, and removed-object cleanup facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name command loops, eligibility, break conditions, access rules, servant limits, and cleanup facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "complex control wrappers" --reporter=dot failed because Animate Objects still used a compact control summary.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/animate-objects.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/mass-suggestion.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/mordenkainens-magnificent-mansion.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Animate Objects object selection, size-count budgeting, Construct stat generation, shared initiative scheduling, Bonus Action command routing, Dodge fallback, 0-Hit-Point reversion, excess-damage carryover, Slam scaling execution, Mass Suggestion target collection, hearing/understanding validation, 25-word validation, harmful-suggestion rejection, Wisdom save execution, Charmed application, suggested-activity adjudication, completion detection, damage-ending routing, higher-slot duration scaling execution, Mordenkainen's Magnificent Mansion door placement, designated-entrant access control, imperceptible-door rendering, extradimensional floor-plan validation, servant task routing, servant harm prevention, object-removal smoke cleanup, end-of-spell expulsion placement, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Prose-heavy utility wrappers name mode and area facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-076 - Magic Circle, Speak with Plants, Wall of Sand, and Elemental Bane rows now expose wrapper contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/magic-circle.json had a single utility row that copied long spell-card prose instead of concisely naming the Cylinder geometry, creature-family choices, inward/reversed mode, Charisma save teleport/interplanar gate, attack Disadvantage, and Charmed/Frightened/Possessed protection facts.
- public/data/spells/level-3/speak-with-plants.json had a monolithic utility row that hid the 30-foot Emanation, 10-minute duration, communication, past-day question, simple-command, terrain-toggle, non-uprooting movement, Plant creature communication, and Entangle-release facts.
- public/data/spells/level-3/wall-of-sand.json had a Blinded row that omitted the wall dimensions, concentration duration, line-of-sight blocking, non-blocking movement, and 3-foot movement-cost facts.
- public/data/spells/level-4/elemental-bane.json had a utility row that named chosen damage types but compressed the 90-foot target, Constitution save, concentration duration, resistance loss, first-per-turn timing, and 2d6 same-type damage rider.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these wrapper rows to name mode choices, area dimensions, creature-family filters, terrain toggles, wall consequences, and chosen-damage-type riders directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "prose-heavy utility wrappers" --reporter=dot failed because Magic Circle still used monolithic copied prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/magic-circle.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/speak-with-plants.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/wall-of-sand.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/elemental-bane.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Magic Circle placement, consumed component handling, creature-family selection UI, inward/reversed mode execution, entry/exit blocking, teleport/interplanar attempt interruption, Charisma save execution, Disadvantage enforcement, Charmed/Frightened/Possessed prevention, duration scaling execution, Speak with Plants plant detection, plant-command adjudication, past-day question answering, terrain conversion, Entangle-release routing, Wall of Sand wall placement, line-of-sight blocking, movement-cost enforcement, Blinded application, concentration upkeep, Elemental Bane target selection, Constitution save execution, chosen damage-type selection UI, resistance suppression, first-per-turn damage tracking, extra damage application, higher-slot target scaling execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Ward, trap, and smite rows name saves and exits

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-075 - Sanctuary, Snare, Thunderous Smite, and Wrathful Smite rows now expose control contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/sanctuary.json had ward rows that compressed target scope, 1-minute non-concentration duration, attack-roll/damaging-spell scope, Wisdom save redirect, area-effect bypass, and early-ending facts.
- public/data/spells/level-1/snare.json had trap rows that named the Dexterity save and Restrained condition but omitted the 5-foot-radius geometry, upside-down hanging state, repeated end-turn Dexterity save, and Intelligence (Investigation)/(Arcana) discovery and escape checks from one row-visible contract.
- public/data/spells/level-1/thunderous-smite.json had Prone and push rows that said "smite rider" instead of naming the first melee weapon hit, Strength save, Prone condition, 10-foot push, and 300-foot thunder sound alongside the damage row.
- public/data/spells/level-1/wrathful-smite.json had a Frightened row that named the Wisdom save and duration but omitted the first melee weapon hit and repeated end-turn Wisdom save exit.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these control rows to name targeting scope, save gates, condition names, forced movement, escape checks, repeat saves, and early exits directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "ward trap and smite control rows" --reporter=dot failed because Sanctuary still used compact ward text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/sanctuary.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/snare.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/thunderous-smite.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/wrathful-smite.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Sanctuary ward target selection, attacker retarget prompting, attack or damaging-spell classification, area-effect bypass routing, early-ending detection, Snare rope/material consumption, trap placement, trap discovery, trigger detection, Dexterity save execution, upside-down positioning, Restrained application, repeat-save scheduling, Intelligence (Arcana) escape action routing, Thunderous Smite first-hit consumption, Thunder damage application, audible sound emission, Strength save execution, Prone application, 10-foot push pathing, Wrathful Smite first-hit consumption, Necrotic damage application, Wisdom save execution, Frightened application, repeat-save scheduling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Cantrip support and pull rows name target, duration, and gates

### SSO-HIGH-IMPACT-CANTRIP-DESCRIPTION-074 - Blade Ward, Resistance, and Lightning Lure rows now expose support and pull contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/blade-ward.json had an attack-roll modifier row that named the 1d4 penalty but omitted the self-only scope, 1-minute concentration duration, incoming-attack direction, and while-active boundary from row-visible text.
- public/data/spells/level-0/resistance.json had utility and defensive rows that compressed chosen damage-type setup and once-per-turn 1d4 damage reduction without listing the eligible damage types, touch target, 1-minute concentration duration, or one-instance boundary consistently.
- public/data/spells/level-0/lightning-lure.json had a MOVEMENT row that said "movement-control pull" instead of naming the 10-foot straight-line pull, plus a DAMAGE row that needed the failed-save and 5-foot proximity gate tied to character-level scaling in one row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these cantrip rows to name target scope, duration, chosen-type setup, once-per-turn reduction, pull distance, proximity-gated damage, and scaling facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "cantrip support and pull rows" --reporter=dot failed because Blade Ward still used shorthand incoming-attack wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/blade-ward.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/resistance.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/lightning-lure.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Blade Ward attack-roll interception, incoming attack prompt routing, concentration upkeep, Resistance willing-touch validation, eligible damage-type selection UI, once-per-turn damage-reduction tracking, damage-type matching, Lightning Lure target selection, Strength save execution, straight-line pull pathing, final-distance checking, Lightning damage application, character-level scaling execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Area trigger rows name geometry, saves, and exits

### SSO-HIGH-IMPACT-AREA-DESCRIPTION-073 - Create Bonfire, Grease, and Hypnotic Pattern rows now expose area trigger contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/create-bonfire.json had three DAMAGE rows that named Dexterity saves and 1d8 Fire damage but omitted the 5-foot Cube geometry and character-level damage scaling from row-visible text.
- public/data/spells/level-1/grease.json had terrain and Prone rows that referred to "grease" or "affected" areas without consistently naming the 10-foot Square, Difficult Terrain, 1-minute non-concentration duration, Dexterity save, and Prone condition.
- public/data/spells/level-3/hypnotic-pattern.json had Charmed and Incapacitated rows that used implementation-ish "break triggers" shorthand instead of naming the 30-foot Cube, sight gate, Wisdom save, 1-minute concentration duration, Speed 0 rider, and damage/shake-awake exit facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these area rows to name trigger timing, geometry, save branches, condition names, scaling, and per-target exit facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "area trigger rows" --reporter=dot failed because Create Bonfire still used shorthand bonfire-space descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/create-bonfire.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/grease.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/hypnotic-pattern.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Create Bonfire ground placement, creature collection, Dexterity save execution, Fire damage application, character-level scaling execution, object ignition, concentration upkeep, Grease point placement, Difficult Terrain enforcement, creature entry/end-turn detection, Prone application, Hypnotic Pattern visibility filtering, Wisdom save execution, Charmed and Incapacitated application, Speed 0 enforcement, per-target damage-ending, shake-awake action routing, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Invisibility and Entangle rows name ending and escape facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-072 - Invisibility and Entangle rows now expose early-ending and escape contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/invisibility.json had a utility row that compressed Invisible duration, early endings, and higher-slot target scaling into shorthand, plus a STATUS_CONDITION row that did not name the attack/damage/cast early-ending contract.
- public/data/spells/level-1/entangle.json had Restrained rows that named the Strength save but omitted the 20-foot Square context, Strength (Athletics) escape action, and end-turn Wisdom save escape route.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name early endings, target scaling, area geometry, Restrained, escape checks, and repeat-save facts directly.

Verification:
- Red run: npx vitest run src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts -t "invisibility and entangle rows" --reporter=dot failed because Invisibility still used shorthand Invisible descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/invisibility.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/entangle.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Invisibility target selection, Invisible application, attack/damage/cast early-ending detection, higher-slot target scaling execution, concentration upkeep, Entangle area placement, Difficult Terrain enforcement, Strength save execution, Restrained application, Strength (Athletics) escape action execution, end-turn Wisdom save execution, first-entry and end-turn trigger scheduling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Status gates and protective filters name condition and target facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-071 - Chill Touch, Mind Sliver, Spare the Dying, and Protection from Evil and Good rows now expose status gates

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/chill-touch.json had No Healing and Undead-only Disadvantage status rows that used "you" shorthand and did not name the No Healing condition or Undead target gate as row-visible facts.
- public/data/spells/level-0/mind-sliver.json had a utility row that described the 1d4 save penalty but omitted the failed Intelligence save gate.
- public/data/spells/level-0/spare-the-dying.json had utility/status rows that stabilized a target but did not name the 15-foot range, 0-Hit-Point and not-dead eligibility, or Stable condition consistently.
- public/data/spells/level-1/protection-from-evil-and-good.json had defensive rows that referred to "specified" or "listed" creature types instead of naming Aberration, Celestial, Elemental, Fey, Fiend, and Undead, and omitted the 10-minute concentration/touch target context.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name condition names, save gates, target filters, duration, and protection families directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Chill Touch still used shorthand No Healing and Undead Disadvantage descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/chill-touch.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/mind-sliver.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/spare-the-dying.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/protection-from-evil-and-good.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Chill Touch melee spell attack resolution, No Healing enforcement, Undead target filtering, Disadvantage rider enforcement, Mind Sliver Intelligence save execution, 1d4 next-save penalty consumption, Spare the Dying target eligibility, Stable application, death-state cleanup, Protection from Evil and Good touch target validation, consumed Holy Water component handling, protected creature-family filtering, Disadvantage enforcement, Charmed/Frightened prevention, existing possession/condition advantage handling, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Damage timing and area rows name once-per-turn and geometry facts

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-070 - Cloud of Daggers, Spirit Guardians, Vitriolic Sphere, and Ice Knife rows now expose timing and geometry facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/cloud-of-daggers.json had an entry/moved-into-space DAMAGE row that named the 4d4 Slashing payload but omitted the once-per-turn cap and +2d4 slot scaling.
- public/data/spells/level-3/spirit-guardians.json had a DAMAGE row that named the Wisdom save and 3d8 Radiant/Necrotic payload but omitted the 15-foot caster-following Emanation and +1d8 slot scaling boundary.
- public/data/spells/level-4/vitriolic-sphere.json had an initial DAMAGE row that named the 20-foot acid explosion but omitted the modeled 1-foot acid orb, 150-foot range, Sphere geometry, and +2d4 slot scaling.
- public/data/spells/level-1/ice-knife.json had an after-primary DAMAGE row that named the target and 5-foot burst but described the Dexterity save as "against" damage instead of the failed-save damage branch.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these damage rows to name timing, area geometry, save branches, once-per-turn caps, and scaling facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Cloud of Daggers still omitted the once-per-turn cap and scaling fact.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/cloud-of-daggers.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/spirit-guardians.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/vitriolic-sphere.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/ice-knife.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Cloud of Daggers cube placement, cube teleporting, creature entry detection, once-per-turn enforcement, Slashing damage application, slot scaling execution, Spirit Guardians caster-following emanation movement, designated unaffected creature filtering, Speed halving, Wisdom save execution, Radiant/Necrotic alignment choice, Vitriolic Sphere projectile travel, explosion placement, Dexterity save execution, delayed Acid damage application, Ice Knife ranged spell attack resolution, burst target collection, Dexterity save execution, Cold damage application, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Benefit and defensive rows name target scope, duration, and scaling facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-069 - Longstrider, Shield of Faith, Aid, and Barkskin rows now expose benefit contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/longstrider.json had a utility row that named the +10-foot Speed benefit but omitted the 1-hour duration and higher-slot additional-target scaling.
- public/data/spells/level-1/shield-of-faith.json had a defensive row that named the +2 AC benefit but omitted Bonus Action casting, 60-foot target scope, 10-minute concentration duration, and one-creature target contract.
- public/data/spells/level-2/aid.json had a defensive row that named the Hit Point increase but omitted the up-to-three target scope, 30-foot range, 8-hour duration, and +5 per slot level above 2 scaling.
- public/data/spells/level-2/barkskin.json had a defensive row that named the AC floor but omitted willing touch targeting and 1-hour duration.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these benefit rows to name target scope, duration, and scaling facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Longstrider still used shorthand touch/speed wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/longstrider.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/shield-of-faith.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/aid.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/barkskin.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Longstrider target selection, Speed modification, higher-slot target scaling execution, Shield of Faith Bonus Action UI routing, AC bonus persistence, concentration upkeep, Aid target selection, current and maximum Hit Point modification, higher-slot Hit Point scaling execution, Barkskin willing-target selection, AC floor persistence, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Modifier, cantrip-save, and invisibility rows name target and duration facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-068 - Bless, Bane, Vicious Mockery, and Greater Invisibility rows now expose target and duration contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/bless.json had an ATTACK_ROLL_MODIFIER row that named the 1d4 bonus but omitted the up-to-three target scope, 30-foot range, Blessed modifier name, 1-minute concentration duration, and higher-slot target scaling.
- public/data/spells/level-1/bane.json had an ATTACK_ROLL_MODIFIER row that named the 1d4 penalty but omitted the visible up-to-three target scope, 30-foot range, Charisma save gate, Bane modifier name, 1-minute concentration duration, and higher-slot target scaling.
- public/data/spells/level-0/vicious-mockery.json had a DAMAGE row that compressed the Wisdom-save damage branch and cantrip scaling, plus a utility row that omitted the failed-save gate for the attack Disadvantage rider.
- public/data/spells/level-4/greater-invisibility.json had a STATUS_CONDITION row that applied Invisible for 1 minute but omitted touch targeting, concentration, spell-end duration, and the attack-does-not-end boundary.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to name target scope, save gates, dice, duration, scaling, and condition facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Bless still used shorthand 1d4 modifier wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/bless.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/bane.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/vicious-mockery.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/greater-invisibility.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Bless target selection, 1d4 attack/save bonus application, higher-slot target scaling execution, Bane target selection, Charisma save execution, 1d4 attack/save penalty application, Vicious Mockery hearing/visibility eligibility, Wisdom save execution, Psychic damage application, Disadvantage rider application, cantrip scaling execution, Greater Invisibility touch targeting, Invisible application, attack visibility handling, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Reaction defense and detection rows name trigger and blocker facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-067 - Shield and Detect Magic rows now expose reaction and material-blocking facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/shield.json had separate DEFENSIVE rows for +5 AC and Magic Missile immunity, but the row text omitted the triggering attack, Magic Missile targeting trigger, Reaction cost, and start-of-next-turn duration context.
- public/data/spells/level-1/detect-magic.json had a sensory UTILITY row that named the 30-foot sense and Magic action aura readout but collapsed its material-blocking limits into "as noted."
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these reaction defense and detection rows to name trigger, duration, action, area, and blocker facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Shield still used shorthand +5 AC and Magic Missile immunity descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/shield.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/detect-magic.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Shield reaction prompting, triggering attack retroactive AC comparison, Magic Missile targeting interception, AC bonus persistence, Magic Missile immunity persistence, Detect Magic concentration upkeep, 30-foot aura sensing, Magic action aura reveal, spell-school classification, material-blocking ray checks, or UI prompts beyond current structured data and row text.

## 2026-06-14 - Mode and truth-zone rows name save and area facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-066 - Pyrotechnics and Zone of Truth rows now expose mode, save, and area facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/pyrotechnics.json had Fireworks and Smoke utility rows that used shorthand save/status wording and did not name the extinguished 5-foot Cube flame, plus a Blinded status row that did not name the 10-foot Fireworks radius.
- public/data/spells/level-2/zone-of-truth.json had a utility row that named the Charisma save and truth restriction but omitted the 15-foot-radius Sphere, 60-foot range, 10-minute duration, and first-entry/start-turn timing.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these mode and truth-zone rows to name save, status, area, duration, and known-save-result facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Pyrotechnics still used abbreviated Fireworks wording and Zone of Truth still omitted the focused area/duration facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/pyrotechnics.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/zone-of-truth.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Pyrotechnics flame eligibility, flame extinguishing, Fireworks radius target collection, Constitution save execution, Blinded application, Smoke cube placement, Heavily Obscured rendering, strong-wind dispersal, Zone of Truth sphere placement, entry/start-turn detection, Charisma save execution, lie-prevention enforcement, caster result knowledge routing, duration cleanup, or UI prompts beyond current structured data and row text.

## 2026-06-14 - Movement utility rows expose granted actions and end states

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-065 - Expeditious Retreat, Fly, and Water Walk rows now expose movement action contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/expeditious-retreat.json had a utility row that described moving quickly but did not make the sustained Bonus Action Dash loop the visible row contract.
- public/data/spells/level-3/fly.json had a utility row that granted flying speed but did not expose higher-slot target scaling in the same visible row.
- public/data/spells/level-3/water-walk.json had a utility row that summarized liquid walking but did not name the 30-foot target boundary or the exact Bonus Action surface/liquid transition permission.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these movement permission rows to name granted actions, target bounds, duration, scaling, and ending/transition facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Expeditious Retreat still used generic action-summary wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/expeditious-retreat.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/fly.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/water-walk.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Expeditious Retreat Bonus Action grant scheduling, Dash execution, concentration upkeep, Fly willing-target selection, flying-speed application, higher-slot target scaling execution, fall-on-end cleanup, Water Walk target selection, liquid-surface walking, Bonus Action surface/liquid transition, fall-through exception handling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Mechanics-rich utility rows expose lifecycle facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-064 - Incendiary Cloud, Sleet Storm, and Shapechange rows now expose control lifecycle facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/incendiary-cloud.json had a utility row that named cloud area, duration, dispersal, and once-per-turn damage gating but omitted the modeled 10-foot start-turn cloud movement.
- public/data/spells/level-3/sleet-storm.json had a Prone row and terrain row that omitted the 20-foot-radius, 40-foot-high Cylinder geometry, the enter/start-turn trigger, the Concentration-loss consequence, and 1-minute concentration duration.
- public/data/spells/level-9/shapechange.json had a transformation utility row that named eligible forms, repeat Magic-action form changes, and retained identity facts but omitted the stat-block replacement boundary.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those mechanics-rich utility/status/terrain rows to name their lifecycle and control facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Incendiary Cloud, Sleet Storm, and Shapechange still omitted the focused lifecycle/control facts.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-8/incendiary-cloud.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/sleet-storm.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/shapechange.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Incendiary Cloud area placement, Heavily Obscured rendering, strong-wind dispersal, once-per-turn damage gating, cloud movement pathing, Dexterity save execution, Fire damage application, Sleet Storm cylinder placement, Heavily Obscured rendering, flame dousing, Dexterity save execution, Prone application, Concentration-loss enforcement, Difficult Terrain enforcement, Shapechange form eligibility selection, stat-block replacement, retained-feature merging, Magic-action re-forming, equipment handling, temporary Hit Point application, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Terrain rows name area size and terrain type

### SSO-HIGH-IMPACT-TERRAIN-DESCRIPTION-063 - Spike Growth, Web, and Wall of Thorns terrain rows now expose geometry

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/spike-growth.json had terrain rows that said only "within the area" or "The area" despite modeled 20-foot-radius Sphere geometry, Difficult Terrain, and 2d4 Piercing travel damage.
- public/data/spells/level-2/web.json had terrain rows that said only "webbed terrain area" and "webbed area" despite modeled 20-foot Cube geometry and Difficult Terrain.
- public/data/spells/level-6/wall-of-thorns.json had a sight-blocking TERRAIN row that omitted the modeled 60-foot length, 10-foot height, and 5-foot thickness already visible in sibling wrapper text and area metadata.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these terrain rows to name area size and terrain type directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wall of Thorns and Spike Growth still omitted the focused terrain geometry.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/spike-growth.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/web.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/wall-of-thorns.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Spike Growth area placement, camouflage discovery, movement-distance accounting, Piercing damage application, difficult-terrain enforcement, Web placement, anchoring support, Dexterity save execution, Restrained application, Strength escape checks, burning-web tracking, Difficult Terrain enforcement, Wall of Thorns shape selection, solid-surface validation, line-of-sight blocking, wall movement-cost enforcement, Dexterity save execution, Piercing/Slashing damage application, slot scaling execution, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Repeat-save status rows name ending facts

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-062 - Ray of Enfeeblement, Fear, and Incite Greed rows now expose repeat-save endings

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/ray-of-enfeeblement.json had an Enfeebled STATUS_CONDITION row that named the initial Constitution save and repeat save but omitted the 1-minute duration and the repeated-save success ending.
- public/data/spells/level-3/fear.json had a Frightened STATUS_CONDITION row that used generic "applies unless" wording and omitted the no-line-of-sight prerequisite for the repeated Wisdom save.
- public/data/spells/level-3/incite-greed.json had a Charmed STATUS_CONDITION row that used generic "applies unless" wording and omitted the explicit success-ending rule for the repeated Wisdom save.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these repeat-save status rows to name condition, duration, repeated save type, and ending facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Ray of Enfeeblement still omitted the 1-minute duration and repeated-save success ending.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/ray-of-enfeeblement.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/fear.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/incite-greed.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Ray of Enfeeblement target selection, Constitution save execution, Enfeebled damage subtraction, Strength-test disadvantage routing, successful-save fallback disadvantage routing, repeated-save scheduling, concentration upkeep, Fear cone target collection, Wisdom save execution, Frightened application, forced Dash/drop behavior, line-of-sight prerequisite checks, Incite Greed visible-target collection, Wisdom save execution, Charmed application, compelled movement, action loss, repeat-save scheduling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Unusual damage rows name explicit payloads

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-061 - Phantasmal Force, Create Homunculus, and Reverse Gravity special damage rows now expose payloads

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/phantasmal-force.json had a hazard DAMAGE row that named Psychic damage but omitted the modeled 2d8 payload.
- public/data/spells/level-6/create-homunculus.json had an irreducible self-harm DAMAGE row that named Piercing damage but omitted the modeled 2d4 payload.
- public/data/spells/level-7/reverse-gravity.json had an upward-collision DAMAGE row that referenced downward falling rules but omitted the modeled falling damage / Bludgeoning payload.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these unusual damage rows to name their concrete payloads directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Phantasmal Force still omitted the 2d8 Psychic payload.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/phantasmal-force.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/create-homunculus.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/reverse-gravity.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Phantasmal Force illusion authoring, Intelligence save execution, Investigation end checks, illusion hazard adjudication, Psychic damage application, Create Homunculus component validation, casting-time handling, self-damage application, mitigation bypass execution, homunculus creation, hit-dice transfer, Hit Point maximum transfer, death/failure cleanup, Reverse Gravity cylinder placement, Dexterity grab-save execution, upward-fall pathing, collision detection, falling-damage calculation, Bludgeoning damage application, hovering, end-of-spell downward fall, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Omitted area damage dice made visible

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-060 - Web, Conjure Volley, and Flame Strike rows now expose their damage dice

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/web.json had an ignited-web DAMAGE row that said only "fire damage" despite modeled 2d4 Fire damage.
- public/data/spells/level-5/conjure-volley.json had a Dexterity-save area DAMAGE row that named the variable ammunition/thrown-weapon damage type but omitted the modeled 8d8 payload.
- public/data/spells/level-5/flame-strike.json had split Fire and Radiant DAMAGE rows that named half-damage success branches but omitted the modeled 5d6 payloads and +1d6 slot scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these burn, volley, and split-cylinder rows to name their visible damage dice directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Web still described ignited-web damage without the 2d4 Fire payload.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/web.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/conjure-volley.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/flame-strike.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Web placement, anchoring support, difficult-terrain enforcement, Dexterity save execution, Restrained application, Strength escape checks, burning-cube tracking, Fire damage application, Conjure Volley ammunition/weapon-source selection, cylinder target collection, Dexterity save execution, variable damage-type routing, Flame Strike cylinder target collection, Dexterity save execution, Fire and Radiant damage application, slot scaling execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Lingering radiant and spirit attack rows name payload dice

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-059 - Sickening Radiance and Conjure Fey damage rows now expose dice and damage type

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/sickening-radiance.json had entry and start-turn DAMAGE rows that named Constitution save timing and no-damage success but omitted the 4d10 Radiant failed-save payload.
- public/data/spells/level-6/conjure-fey.json had a spirit attack DAMAGE row that named appearance/later-teleport attack timing but omitted the 3d12 plus spellcasting ability modifier Psychic payload and +1d12 slot scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those lingering area and spirit-origin attack rows to name their damage dice and type directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Sickening Radiance still omitted the focused damage payloads.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/sickening-radiance.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/conjure-fey.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Sickening Radiance area placement, entry detection, start-turn scheduling, Constitution save execution, Radiant damage application, Exhaustion application, light rendering, Invisible-benefit suppression, concentration upkeep, Conjure Fey spirit placement, Bonus Action teleport scheduling, melee spell attack construction, Psychic damage application, Frightened application, slot scaling execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Repeated attack damage rows name payload dice

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-058 - Spiritual Weapon, Faithful Hound, and Storm Sphere repeated attacks now expose damage payloads

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/spiritual-weapon.json had a later-turn DAMAGE row that described moving and repeating the melee spell attack but omitted the 1d8 plus spellcasting modifier Force payload and higher-slot scaling.
- public/data/spells/level-4/mordenkainens-faithful-hound.json had a bite DAMAGE row that named only the successful Dexterity save no-damage branch and omitted the 4d8 Force failed-save payload and 300-foot ending.
- public/data/spells/level-4/storm-sphere.json had a Bonus Action lightning DAMAGE row that named the ranged spell attack and advantage condition but omitted the 4d6 Lightning hit payload.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these repeated or created-entity attack rows to name their damage dice/type directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Spiritual Weapon, Mordenkainen's Faithful Hound, and Storm Sphere still omitted the focused damage payloads.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/spiritual-weapon.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/mordenkainens-faithful-hound.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/storm-sphere.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Spiritual Weapon creation, Bonus Action grant scheduling, spectral weapon movement, melee spell attack construction, Force damage application, slot scaling execution, Mordenkainen's Faithful Hound password filtering, barking, Truesight sensing, enemy selection, Dexterity save execution, Force damage application, 300-foot ending, hound movement, Storm Sphere area placement, Strength save execution, Bludgeoning damage application, difficult terrain, listening disadvantage, Bonus Action lightning target selection, ranged spell attack construction, Lightning damage application, advantage routing, slot scaling, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Control and forced-movement rows name saves and riders

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-057 - Compelled Duel, Mind Spike, and Thunderwave rows now expose save-gated riders

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/compelled-duel.json had a UTILITY row that said only "failed save" and "listed break conditions" instead of naming the Wisdom save, disadvantage/leash riders, concentration duration, and concrete ending conditions.
- public/data/spells/level-2/mind-spike.json had an information UTILITY row that said only "failed save" and omitted the Wisdom save, 1-hour concentration duration, hidden-prevention rider, and Invisible no-benefit rider.
- public/data/spells/level-1/thunderwave.json had a forced-movement UTILITY row that said only "failed save" and omitted the Constitution save, 15-foot Cube scope, caster-relative push direction, object push, and 300-foot audible boom as one player-facing row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to expose save gates, control/forced-movement riders, and ending facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Compelled Duel still used bare "failed save" and "listed break conditions" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/compelled-duel.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/mind-spike.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/thunderwave.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Compelled Duel target selection, Wisdom save execution, disadvantage routing, willing-movement leash enforcement, attack/spell/ally-damage/end-turn break detection, concentration upkeep, Mind Spike Wisdom save execution, Psychic damage application, location tracking, hidden-state prevention, Invisible benefit suppression, plane separation cleanup, Thunderwave area placement, Constitution save execution, Thunder damage application, creature push pathing, object push pathing, audible-boom propagation, slot scaling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Common control rows name saves and endings

### SSO-HIGH-IMPACT-CONTROL-DESCRIPTION-056 - Command, Hold Person, and Suggestion rows now expose save and control boundaries

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/command.json had a UTILITY row that said only "failed save" and did not name the Wisdom save, command menu, or higher-slot target scaling.
- public/data/spells/level-2/hold-person.json had a Paralyzed STATUS_CONDITION row that omitted the Wisdom save name, Humanoid target gate, concentration duration, and repeat-save ending.
- public/data/spells/level-2/suggestion.json had a UTILITY row that omitted the Wisdom save name, hear/understand prerequisite, concentration duration, and completion/damage early endings.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these common low-level control rows to carry their save, status/control, and ending facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Command still used bare "failed save" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/command.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/hold-person.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/suggestion.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Command target scaling, one-word command selection, command legality adjudication, Prone application from Grovel, turn-behavior enforcement, Hold Person Humanoid filtering, Wisdom save execution, Paralyzed application, repeat-save scheduling, concentration upkeep, Suggestion AI adjudication, hear/understand validation, Charmed application, reasonable-suggestion enforcement, damage-ending cleanup, completed-task ending, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Complex utility rows expose mode and boundary facts

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-055 - Bigby's Hand and Telepathy utility rows now summarize concrete modes and limits

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/bigbys-hand.json had a single UTILITY row that said the hand could be directed into broad protective/forceful/grasping/striking options without naming the Large force hand, 120-foot placement, 1-minute concentration duration, 60-foot Bonus Action movement, four mode names, AC/Hit Point/stat payloads, or 0-HP ending.
- public/data/spells/level-8/telepathy.json had a single UTILITY row that named the 24-hour same-plane link but omitted the plane-leaving ending, target recognition, and meaning-comprehension facts present in the spell card and control options.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those single-row utility summaries to preserve their concrete modes and communication boundaries.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Bigby's Hand still used generic mode-summary wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/bigbys-hand.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/telepathy.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Bigby's Hand object creation, space occupancy, AC/Hit Point/stat materialization, Bonus Action command scheduling, Clenched Fist attack construction, Forceful Hand contested checks, Grasping Hand grapple/crush execution, Interposing Hand cover and movement blocking, higher-slot damage scaling, 0-HP cleanup, concentration upkeep, Telepathy familiar-target validation, willing-target confirmation, same-plane enforcement, plane-leaving cleanup, message transport, target recognition, meaning comprehension, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Mechanics-rich wrapper rows expose actionable payloads

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-054 - Conjure Fey and Holy Weapon wrapper rows now name turn actions and burst damage

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/conjure-fey.json had a UTILITY row that summarized the later-turn teleport and melee spell attack without naming the 60-foot placement, 10-minute concentration duration, 30-foot teleport limit, 5-foot attack reach, Psychic hit damage, or Frightened rider.
- public/data/spells/level-5/holy-weapon.json had a UTILITY row that referred to "separate damage and Blinded effects" and a DAMAGE row that omitted the 4d8 Radiant failed-save payload.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those mechanics-rich rows to expose the actionable Bonus Action loop, dismiss burst, save, and damage facts directly.
- A bounded gpt-5.4-mini explorer ranked Conjure Fey and Holy Weapon as high-impact mechanics-rich candidates for runtime/UI interpretability.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Conjure Fey still used the vague wrapper text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/conjure-fey.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/holy-weapon.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Conjure Fey spirit placement, stat-block materialization, initiative scheduling, Bonus Action spending, teleport pathing, melee spell attack construction, Psychic damage application, Frightened source handling, slot scaling, concentration upkeep, Holy Weapon object eligibility, magic-weapon mutation, light rendering, 2d8 weapon-damage augmentation, dismiss-burst target selection, Constitution save execution, 4d8 Radiant damage application, Blinded application, repeat-save scheduling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Table-driven status rows name save and condition

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-053 - Prismatic Spray and Symbol table rows now expose initial save and status payloads

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/prismatic-spray.json had indigo and violet STATUS_CONDITION rows that said only "failed save" and used verb shorthand instead of naming the Dexterity save and Restrained / Blinded conditions.
- public/data/spells/level-7/symbol.json had Fear, Pain, Sleep, and Stunning STATUS_CONDITION rows that said only "failed save" and omitted the Wisdom or Constitution save names.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those ray and glyph status rows to name the initial save and condition payload directly.
- A bounded gpt-5.4-mini explorer also surfaced mechanics-rich later candidates, but this pass chose the tighter table-status family because it had stronger immediate validator and combat-log interpretability value.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Prismatic Spray still used bare indigo/violet "failed save" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/prismatic-spray.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/symbol.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Prismatic Spray cone target collection, Dexterity save execution, ray rolling, two-ray reroll routing, damage ray application, Restrained application, end-turn Constitution save progression, Petrified transition, Violet Wisdom save scheduling, planar teleport execution, Symbol glyph placement, trigger authoring, target exclusions, password exclusions, once-per-turn activation throttling, Death damage, Discord disadvantage, Fear forced movement, Pain incapacitation, Sleep wakeup triggers, Stunning application, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Threshold status rows name save and condition

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-052 - Divine Word and Harm threshold rows now expose save and condition names

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/divine-word.json had a Dead STATUS_CONDITION row that said only "failed save" and "dies" instead of naming the Charisma save and Dead condition.
- public/data/spells/level-6/harm.json had a Hit Point Maximum Reduced row that said only "failed save" instead of naming the Constitution save and condition.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those threshold status rows to name the save and condition payload directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Divine Word still used bare "failed save" death wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/divine-word.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/harm.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Divine Word target choice, Charisma save execution, Hit Point bucket routing, death application, Blinded/Deafened/Stunned duration routing, planar return, 24-hour return blocking, Harm target selection, Constitution save execution, Necrotic damage application, Hit Point maximum reduction application, minimum max-HP floor, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Green-Flame Blade primary fire row names scaling dice

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-051 - Green-Flame Blade no longer hides primary-target Fire scaling behind generic text

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/green-flame-blade.json had a primary-target DAMAGE row that said "Extra fire damage to the primary target scales with level" without naming the melee hit trigger or the 1d8/2d8/3d8 Fire scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both Green-Flame Blade damage rows to expose their primary-hit and secondary-leap scaling facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Green-Flame Blade still used generic primary-target scaling wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/green-flame-blade.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for melee weapon attack construction, hit detection, weapon damage application, primary Fire scaling execution, secondary target selection, secondary line-of-sight checking, spellcasting ability modifier damage, secondary Fire scaling execution, or cantrip level scaling beyond current structured data and row text.

## 2026-06-14 - Large-area damage rows name dice and save outcomes

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-050 - Illusory Dragon and Tsunami damage rows now expose high-level area payloads

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/illusory-dragon.json had a DAMAGE row that described the 60-foot cone timing but omitted the Intelligence save, 7d6 chosen damage payload, half-success branch, and discerned-illusion Advantage modifier.
- public/data/spells/level-8/tsunami.json had an ongoing DAMAGE row that said creatures saved against ongoing Bludgeoning damage without naming the Strength save, 5d10 payload, half-success branch, once-per-round throttle, or later-round 1d10 reduction.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these high-level area damage rows to expose dice, save outcomes, timing, and special modifiers directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Illusory Dragon still omitted the damage and save payload from its breath row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-8/illusory-dragon.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/tsunami.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Illusory Dragon creation, breath damage-type choice UI, bonus-action movement scheduling, cone target collection, Intelligence save execution, discerned-illusion Advantage routing, chosen damage application, concentration upkeep, Tsunami wall placement, initial Strength save execution, ongoing wall movement, Huge-or-smaller filtering, once-per-round damage throttling, later-round damage reduction, wall-height reduction, swim restriction, fall-out handling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Conditional damage rows name dice and save context

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-049 - Hail of Thorns and Lightning Lure conditional damage rows now expose payloads

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/hail-of-thorns.json had a second DAMAGE row that said only "AoE damage to creatures within 5ft of target" instead of naming the triggering ranged weapon hit, Dexterity save, 1d10 Piercing payload, half-success branch, and +1d10 slot scaling.
- public/data/spells/level-0/lightning-lure.json had a DAMAGE row that said damage applied only after the pull, but omitted the 1d8 Lightning payload, Strength save dependency, 5-foot post-pull condition, and cantrip scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects those conditional damage rows to expose dice, save context, trigger context, and scaling directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Hail of Thorns still used vague "AoE damage" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/hail-of-thorns.json passed.
- npm run validate:spells -- --spell public/data/spells/level-0/lightning-lure.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged weapon hit detection, Hail of Thorns first-hit consumption, burst target collection, Dexterity save execution, Piercing damage application, slot scaling, Lightning Lure target selection, Strength save execution, pull pathing, final-distance checking, Lightning damage application, character-level scaling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Creation row focuses on object limits and scaling

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-048 - Creation no longer copies the full object-creation card prose into its utility row

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/creation.json had one UTILITY row that copied the top-level object-creation prose instead of summarizing the visible point, 5-foot Cube base limit, material restrictions, material-duration dependency, component-failure rule, and higher-slot cube scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Creation utility row to expose those object-limit and scaling facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Creation still carried copied full-card object-creation prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/creation.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for visible-point placement, nonliving object validation, seen-form/material validation, vegetable/mineral material classification, cube-size scaling execution, material-duration table lookup, mixed-material duration minimization, material-component failure enforcement, object lifecycle cleanup, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Bestow Curse row summarizes curse menu and slot scaling

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-047 - Bestow Curse no longer copies the full curse option prose into one effect row

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/bestow-curse.json had one UTILITY row that copied the full curse option prose and ended with "this effect" wording instead of summarizing the Wisdom save, curse menu, Remove Curse ending, and higher-slot duration/concentration scaling already present in structured data.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Bestow Curse utility row to expose the curse choices and slot-scaling contract as a focused row description.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Bestow Curse still carried copied full-card curse prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/bestow-curse.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for touch targeting, Wisdom save execution, curse option UI, ability-score selection, disadvantage routing, start-turn save scheduling, action-waste enforcement, +1d8 Necrotic damage routing, DM-approved custom curse authoring, Remove Curse cleanup, higher-slot concentration removal, longer duration execution, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Summoned mount and spirit rows focus on runtime facts

### SSO-HIGH-IMPACT-SUMMONING-DESCRIPTION-046 - Phantom Steed and Summon Beast rows now summarize visible summoned entities

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/phantom-steed.json had a SUMMONING row that copied most of the top-level card text instead of summarizing the mount's placement, ride permissions, Riding Horse stats, equipment limit, damage ending, and fade-out behavior.
- public/data/spells/level-2/summon-beast.json had a SUMMONING row that copied broad spell prose and omitted the slot-level stat and attack scaling facts already present in structured scaling and summon metadata.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects summoned mount and spirit rows to describe the created entity, control rules, lifecycle, and stat/scaling facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Phantom Steed still carried copied full-card summoning prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-3/phantom-steed.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/summon-beast.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Phantom Steed ritual timing, mount placement validation, appearance choice UI, Riding Horse stat materialization, ride assignment, equipment-distance cleanup, damage-ending enforcement, fade-out dismount handling, Summon Beast component validation, form-choice UI, Bestial Spirit stat generation, slot-level AC/Hit Point/Rend scaling execution, movement trait selection, shared-initiative scheduling, verbal-command routing, Dodge fallback, 0-HP disappearance, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Granted-action and long-save rows avoid importer shorthand

### SSO-HIGH-IMPACT-DESCRIPTION-045 - Contact Other Plane, Contagion, and Dragon's Breath rows now expose player-facing save and damage flow

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/contact-other-plane.json had a STATUS_CONDITION row that ended with "Greater Restoration ends this effect" and a UTILITY row that copied the full spell card instead of focusing on the successful-save question flow.
- public/data/spells/level-5/contagion.json had a STATUS_CONDITION row that said the three-success/three-failure progression and Poisoned-removal save were "canonical" and "prose-only" despite repeat-save progression metadata being present.
- public/data/spells/level-2/dragons-breath.json had a DAMAGE row that said it "represents" the granted breath weapon damage instead of naming the Magic action trigger, 15-foot Cone, Dexterity save, chosen damage types, and +1d6 slot scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these rows to describe the visible save, condition, question, granted-action, damage, and scaling facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Contact Other Plane still used implementation-facing status wording and copied full-card utility prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/contact-other-plane.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/contagion.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/dragons-breath.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Contact Other Plane ritual timing, Intelligence save execution, five-question UI, DM answer routing, Psychic damage application, Incapacitated application, Greater Restoration cleanup, Contagion touch targeting, Constitution save execution, Necrotic damage application, Poisoned application, repeat-save progression counting, Poisoned-removal resistance, chosen ability disadvantage routing, Dragon's Breath target selection, chosen damage type UI, granted Magic action scheduling, cone target collection, Dexterity save execution, chosen damage application, slot scaling, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Save-based status rows avoid implementation shorthand

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-044 - Charm Monster, Dominate Beast, and Tidal Wave rows now name save outcomes directly

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/charm-monster.json had a STATUS_CONDITION row that said "configured save modifiers still apply" instead of naming the Wisdom save Advantage branch and early damage ending.
- public/data/spells/level-4/dominate-beast.json had a STATUS_CONDITION row that said damage could trigger the "configured repeat save" instead of naming the repeated Wisdom save and success ending.
- public/data/spells/level-3/tidal-wave.json had a STATUS_CONDITION row that said Prone used a "special duration encoded on this effect" instead of naming the failed-save Prone outcome and successful-save non-Prone branch.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects these status rows to expose the visible target, save, duration, repeat-save, early-ending, and save-success facts directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Charm Monster still exposed implementation-facing "configured save modifiers" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/charm-monster.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/dominate-beast.json passed.
- npm run validate:spells -- --spell public/data/spells/level-3/tidal-wave.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Charm Monster target selection, Wisdom save execution, Advantage routing, Charmed application, early damage-ending enforcement, end-of-spell awareness, Dominate Beast Beast filtering, telepathic command routing, commanded Reaction spending, damage-triggered repeat-save scheduling, concentration upkeep, Tidal Wave area placement, Dexterity save execution, Bludgeoning damage application, Prone application, flame extinguishing, water spread, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Social and chosen-damage rows avoid implementation shorthand

### SSO-HIGH-IMPACT-DESCRIPTION-043 - Friends and Destructive Wave rows now expose player-facing eligibility and damage

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/friends.json had a STATUS_CONDITION row that said "auto-success overrides preserved", exposing implementation language instead of the Humanoid, not-fighting, and 24-hour recast eligibility rules.
- public/data/spells/level-5/destructive-wave.json had DAMAGE rows that omitted the failed-save Thunder payload and referred to "this damage" for the caster-chosen Radiant or Necrotic payload.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Friends and Destructive Wave rows to name player-facing eligibility, save type, condition/damage payloads, and chosen damage type directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Friends still exposed implementation-facing auto-success override wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/friends.json passed.
- npm run validate:spells -- --spell public/data/spells/level-5/destructive-wave.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Friends Humanoid checking, combat-state checking, 24-hour recast memory, Wisdom save execution, Charmed application, early-ending triggers, target awareness after the spell ends, Destructive Wave chosen-creature selection, Constitution save execution, Thunder damage application, Radiant/Necrotic choice UI, chosen damage application, Prone application, or save-success branching beyond current structured data and row text.

## 2026-06-14 - Prismatic Wall rows expose layer and blinding state

### SSO-HIGH-IMPACT-TERRAIN-DESCRIPTION-042 - Blinded and terrain rows now carry save and layer rules

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/prismatic-wall.json had a Blinded STATUS_CONDITION row that said creatures "must save" without naming the Constitution save or designated-safe-creature exception.
- The same spell had a TERRAIN row that only said the wall was opaque and had seven layers, omitting AC 10, ordered layer destruction, Antimagic Field immunity, and violet-only Dispel Magic interaction already represented in the wrapper/control data.
- A bounded gpt-5.4-mini explorer ranked Prismatic Wall as the strongest next candidate because its layered wall rules are central to row-based UI and runtime interpretability.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Prismatic Wall's wrapper, Blinded row, and terrain row to expose wall/globe form, safe-passage, light, near-wall Constitution save, seven-layer AC/order state, and magic-interaction constraints.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Prismatic Wall still used generic Blinded and terrain row descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/prismatic-wall.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for wall/globe placement, occupied-space failure, safe-creature designation, light emission, near-wall trigger scheduling, Constitution save execution, Blinded application, seven-layer damage/effect table execution, layer-specific destruction methods, AC tracking, ordered layer removal, Antimagic Field immunity, violet-only Dispel Magic interaction, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Repeated damage rows name their dice

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-041 - Wall of Fire and Tasha's Caustic Brew no longer say only "this damage"

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/wall-of-fire.json had repeated DAMAGE rows that said creatures take "this damage" when entering or ending near the wall instead of naming the 5d8 Fire payload.
- public/data/spells/level-1/tashas-caustic-brew.json had a recurring DAMAGE row that said a creature covered in acid takes "this damage" instead of naming the 2d4 Acid payload and +2d4 slot scaling.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects repeated damage rows for both spells to name the trigger, dice, damage type, and scaling where applicable.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wall of Fire still used "this damage" on repeated wall DAMAGE rows.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/wall-of-fire.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/tashas-caustic-brew.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for wall shape placement, selected-side tracking, wall entry detection, end-turn proximity detection, Fire damage application, slot scaling, acid line target collection, Dexterity save execution, Covered in Acid application, recurring start-turn damage scheduling, scrape/wash removal, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Wrath of Nature rows name natural feature triggers

### SSO-HIGH-IMPACT-MECHANICS-DESCRIPTION-040 - trees, roots, and rocks rows now carry their own trigger context

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/wrath-of-nature.json had a tree DAMAGE row that named 4d6 Slashing damage and Dexterity save outcome but omitted the start-of-caster-turn tree proximity trigger.
- The same spell had a rock Prone STATUS_CONDITION row that said only "Applies Prone unless the target succeeds on a Strength save" and omitted the Bonus Action loose-rock launch, visible target in the 60-foot Cube, ranged spell attack hit, and 3d8 Bludgeoning damage context.
- A bounded gpt-5.4-mini explorer ranked Wrath of Nature as the strongest next mechanics-rich cleanup candidate because the spell's tree, root, and rock rows need to show which natural feature and timing each row represents.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Wrath of Nature's three rows to distinguish the tree Slashing damage, tree-root Restrained escape, and loose-rock Prone rider with their triggers and payloads.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wrath of Nature still omitted the tree trigger and rock-launch damage context from its row descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/wrath-of-nature.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for grass difficult-terrain setup, tree selection, start-turn scheduling, enemy filtering, Dexterity save execution, Slashing damage application, root target selection, Strength save execution, Restrained application, Athletics escape execution, Bonus Action rock launch, ranged spell attack construction, Bludgeoning damage application, Prone application, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Persistent area damage rows name save payloads

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-039 - Moonbeam and Guardian of Faith rows no longer hide damage behind "this save"

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/moonbeam.json had persistent area DAMAGE rows that named the Constitution save and Shapechanger rider but omitted the 2d10 Radiant damage and half-damage success branch.
- public/data/spells/level-4/guardian-of-faith.json had two DAMAGE rows that said enemies make "this saving throw" without naming the Dexterity save, 20 Radiant damage, or half-damage success branch.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Moonbeam and Guardian of Faith persistent area rows to name their timing, save type, damage payload, half-damage success branch, and Shapechanger rider where applicable.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Moonbeam still omitted its 2d10 Radiant damage payload from the persistent area rows.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-2/moonbeam.json passed.
- npm run validate:spells -- --spell public/data/spells/level-4/guardian-of-faith.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Moonbeam area movement, creature entry detection, end-turn timing, Constitution save execution, Shapechanger detection, forced reversion, Radiant damage application, slot scaling, Guardian of Faith placement, enemy detection, 10-foot proximity checks, Dexterity save execution, cumulative 60-damage disappearance, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Leap and burst damage rows expose targeting rules

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-038 - Chromatic Orb and Ice Knife rows name their secondary targeting contracts

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/chromatic-orb.json had a single DAMAGE row that mentioned chosen elemental damage and slot scaling but omitted the duplicate-damage-die leap rule stored in secondaryTargeting.
- public/data/spells/level-1/ice-knife.json had a Cold burst DAMAGE row that named the 5-foot burst and Dexterity save but omitted the hit-or-miss explosion trigger and that the primary target is included in the burst.
- A bounded gpt-5.4-mini explorer ranked Chromatic Orb and Ice Knife as high-impact mechanics-rich damage candidates because their current row text hid secondary targeting or two-stage attack behavior from row-based UI.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Chromatic Orb and Ice Knife damage rows to expose chosen damage, ranged attack targeting, duplicate-die leap targeting, higher-slot leap scaling, hit-or-miss burst timing, included target scope, Dexterity save, and Cold damage scaling.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Chromatic Orb still omitted the leap-on-duplicate-dice rule from its DAMAGE row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/chromatic-orb.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/ice-knife.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for chosen damage-type UI, attack construction, duplicate-die detection, leap target selection, per-leap attack and damage rerolls, unique-target enforcement, higher-slot leap caps, Ice Knife hit detection, hit-or-miss burst scheduling, burst target collection, Dexterity save execution, Cold damage application, or slot scaling beyond current structured data and row text.

## 2026-06-14 - Haste visible row carries full spell contract

### SSO-HIGH-IMPACT-DEFENSIVE-DESCRIPTION-037 - Haste no longer exposes only its +2 AC fragment

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/haste.json had a single DEFENSIVE row whose visible description only said the target gains +2 Armor Class, hiding the spell's speed, Dexterity-save, limited extra-action, concentration duration, and lethargy-ending contract from row-based UI.
- A bounded gpt-5.4-mini explorer ranked Haste as the strongest next cleanup candidate because the spell has one visible row and that row omitted most of the play-decision context.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Haste's defensive row to act as a wrapper-style summary that names the willing target, 30-foot range, 1-minute concentration duration, doubled Speed, +2 Armor Class, Advantage on Dexterity saves, limited extra action, and Incapacitated/Speed-0 ending.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Haste still exposed only the +2 Armor Class text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-3/haste.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Speed doubling, Dexterity-save Advantage, extra-action menu enforcement, one-attack-only Attack restriction, concentration upkeep, lethargy application, Incapacitated enforcement, Speed-0 enforcement, or duration cleanup beyond current structured data, top-level prose, and row text.

## 2026-06-14 - Mode-choice rows name selected payloads

### SSO-HIGH-IMPACT-MODE-DESCRIPTION-036 - Alarm and Blindness/Deafness rows no longer repeat mixed-mode text

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/alarm.json had two UTILITY rows with identical "mental or audible alarm" descriptions even though the mode-choice data splits Audible Alarm and Mental Alarm.
- public/data/spells/level-2/blindness-deafness.json had two STATUS_CONDITION rows that each described "either Blinded or Deafened" instead of naming the selected condition stored in that row.
- A bounded gpt-5.4-mini explorer ranked these rows as high-impact UI/runtime interpretability candidates because mode-choice rows should expose the chosen mode payload directly.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Alarm's audible and mental rows plus Blindness/Deafness's Blinded and Deafened rows to describe their selected payloads directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Alarm still had duplicated mixed-mode row text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-1/alarm.json passed.
- npm run validate:spells -- --spell public/data/spells/level-2/blindness-deafness.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Alarm ward placement, creature exclusion, audible sound propagation, mental ping range, sleep waking, mode selection execution, Blindness/Deafness target scaling, Constitution save execution, condition application, repeated save scheduling, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Area save rows name their failed-save payloads

### SSO-HIGH-IMPACT-SAVE-DESCRIPTION-035 - Create Bonfire and Grease no longer say only "this saving throw"

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/create-bonfire.json had later area-trigger DAMAGE rows that said a creature must make "this saving throw" without naming the Dexterity save or 1d8 Fire damage payload.
- public/data/spells/level-1/grease.json had area-trigger STATUS_CONDITION rows that said a creature must make "this saving throw" without naming the Dexterity save or Prone payload.
- A bounded gpt-5.4-mini explorer ranked these rows as high-impact UI/runtime interpretability candidates because entering-area and end-turn rows depended on sibling rows for their actual failure outcome.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Create Bonfire and Grease area-save rows to name their trigger, Dexterity save, and failed-save damage or Prone outcome directly.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Create Bonfire still used "must make this saving throw" wording on its repeated area DAMAGE rows.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-0/create-bonfire.json passed.
- npm run validate:spells -- --spell public/data/spells/level-1/grease.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for bonfire placement, area occupancy detection, entry-trigger scheduling, end-turn scheduling, Dexterity save execution, Fire damage application, character-level damage scaling, Grease terrain placement, Prone application, duration cleanup, or object ignition beyond current structured data and row text.

## 2026-06-14 - Arcane Sword repeated damage row self-contained

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-034 - repeated sword attack row now carries its hit damage

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/arcane-sword.json had a later-turn DAMAGE row that described repeating the sword's melee spell attack but did not state the 3d10 Force damage on hit.
- The row already stores the later-turn Bonus Action trigger, spell attack filter, hit condition, and 3d10 Force payload, so the visible damage row should summarize those play facts directly instead of relying on the utility wrapper or initial damage row for damage context.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Arcane Sword's two DAMAGE rows to distinguish the initial appearance attack from the later Bonus Action repeat attack while keeping both rows self-contained with 3d10 Force damage on hit.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Arcane Sword's repeated damage row omitted the 3d10 Force damage sentence.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/arcane-sword.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for sword creation, melee spell attack construction, hit detection, Force damage application, Bonus Action spending, sword movement, target selection, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Tenser's Floating Disk limit-focused summoning description

### SSO-HIGH-IMPACT-SUMMONING-DESCRIPTION-033 - disk row no longer claims slot scaling is unmodeled

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/tensers-floating-disk.json had a SUMMONING row that said "no slot-scaling changes are modeled", exposing implementation language instead of the disk's carrying, following, terrain, and ending rules.
- The row already stores the force disk payload, 3-foot diameter, 3-foot hover height, 20-foot follow distance, 500-pound weight limit, 10-foot elevation and pit limits, and 100-foot break distance, so the visible text should summarize those play facts directly.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Tenser's Floating Disk's summoning row to mention the temporary 3-foot-diameter force disk, 30-foot placement, 3-foot hover, 500-pound carrying limit, 20-foot following behavior, 10-foot terrain limits, and overload or 100-foot distance endings.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Tenser's Floating Disk still used "no slot-scaling changes are modeled" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/tensers-floating-disk.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for disk creation, physical placement validation, carried-weight accounting, following/pathing, terrain-crossing checks, overload cleanup, break-distance cleanup, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Unseen Servant command-focused summoning description

### SSO-HIGH-IMPACT-SUMMONING-DESCRIPTION-032 - servant row no longer claims slot scaling is unmodeled

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/unseen-servant.json had a SUMMONING row that said "no slot-scaling changes are modeled", exposing implementation language instead of the servant's limits and command behavior.
- The row already stores the invisible servant payload, ground-space placement, Bonus Action command cost, and ending conditions, so the visible text should summarize those play facts directly.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Unseen Servant's summoning row to mention the temporary invisible servant, AC, Hit Point, Strength, Speed, no-attack limit, Bonus Action commands, and 0-HP or distance ending.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Unseen Servant still used "no slot-scaling changes are modeled" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/unseen-servant.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for servant creation, task validation, object manipulation, carrying limits, movement/pathing, Bonus Action command scheduling, distance-ending enforcement, 0-HP cleanup, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Find Familiar control-focused summoning description

### SSO-HIGH-IMPACT-SUMMONING-DESCRIPTION-031 - familiar row no longer claims slot scaling is unmodeled

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/find-familiar.json had a SUMMONING row that said "no slot-scaling changes are modeled", exposing implementation language instead of the familiar's control facts.
- The row already stores persistent familiar data, animal form choices, 100-foot telepathy, shared senses, and touch-spell delivery, so the visible text should summarize those play facts directly.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Find Familiar's summoning row to mention the persistent familiar spirit, listed forms, telepathy, shared senses Bonus Action, and Reaction-based touch-spell delivery.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Find Familiar still used "no slot-scaling changes are modeled" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/find-familiar.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for familiar form stat selection, dismissal/replacement lifecycle, telepathy enforcement, shared-senses view switching, touch-spell delivery timing, Reaction spending, combat initiative behavior, or death/disappearance cleanup beyond current structured data and row text.

## 2026-06-14 - Find Steed slot-level summoning description

### SSO-HIGH-IMPACT-SUMMONING-DESCRIPTION-030 - steed row no longer claims slot scaling is unmodeled

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/find-steed.json had a SUMMONING row that said "no slot-scaling changes are modeled" even though the spell's higher-level text makes the slot level central to the Otherworldly Steed stat block.
- The row already stores the persistent mount summon and form/type choices, so the visible text should explain the loyal steed, appearance and creature-type choices, and slot-level stat-block scaling instead of exposing importer-facing "modeled" language.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Find Steed's summoning row to mention the companion, Horse/Camel/Dire Wolf/Elk appearance choices, Celestial/Fey/Fiend type choice, and slot-level stat facts.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Find Steed still used "no slot-scaling changes are modeled" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-2/find-steed.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for stat-block generation, spell-slot-to-stat conversion, higher-level flight gating, creature-type trait selection, controlled-mount behavior, independent action when the caster is Incapacitated, replacement behavior, disappearance cleanup, or companion AI beyond current structured data and row text.

## 2026-06-14 - Wrath of Nature tree-root restraint description

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-029 - restrained row no longer exposes modeled escape wording

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/wrath-of-nature.json had a STATUS_CONDITION row for Restrained that said "modeled Athletics escape check", exposing implementation wording in a player-facing row.
- The row already stores the Restrained condition and Athletics escape payload, so the visible text should state the turn-end Strength save, tree-root source, Restrained duration, action cost, and Athletics escape check directly.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Wrath of Nature's tree-root Restrained row to use player-facing escape-check wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wrath of Nature still used "modeled Athletics escape check" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/wrath-of-nature.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for area tree selection, turn-end Strength-save scheduling, Restrained application, Athletics escape execution, plant/rock/grass behaviors, repeated effect timing, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Grasping Vine Grappled trigger description

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-028 - grappled row no longer uses same-hit shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/grasping-vine.json had a STATUS_CONDITION row for Grappled that said "same hit", making the row depend on its sibling Bludgeoning damage row for trigger context.
- The spell already splits vine-hit damage, Grappled, and forced pull into separate rows, so the Grappled row should explicitly name the triggering melee spell attack hit from the vine while preserving the Huge-or-smaller filter, 1-minute duration, and spell-save-DC escape action.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Grasping Vine's Grappled row to use "triggering melee spell attack hit from the vine" wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Grasping Vine still used "same hit" on the Grappled row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-4/grasping-vine.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for vine placement, melee spell attack construction, hit detection, Bludgeoning damage application, Huge-or-smaller filtering, Grappled application, escape-check execution, forced-pull pathing, concentration upkeep, or higher-slot grapple-count execution beyond current structured data and row text.

## 2026-06-14 - Thorn Whip pull trigger description

### SSO-HIGH-IMPACT-MOVEMENT-DESCRIPTION-027 - pull row no longer uses same-hit shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/thorn-whip.json had a MOVEMENT row for the pull rider that said "same hit" and "spell's pull movement rider", making the row depend on its sibling Piercing damage row for trigger context and hiding the actual 10-foot pull.
- The current structured data models the hit as a ranged spell hit; this pass preserved that existing attack model and only made the movement row state the triggering hit, Large-or-smaller filter, pull distance, and direction.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Thorn Whip's movement row to use "triggering ranged spell hit" wording and a direct 10-foot pull description.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Thorn Whip still used "same hit" pull-rider wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/thorn-whip.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for attack construction, hit detection, Piercing damage application, Large-or-smaller filtering, forced-pull pathing, collision handling, cantrip-tier scaling, or whether Thorn Whip's current ranged-hit model should be revised later beyond current structured data and row text.

## 2026-06-14 - Ray of Sickness Poisoned trigger description

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-026 - poisoned row no longer uses same-hit shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/ray-of-sickness.json had a STATUS_CONDITION row for Poisoned that said "same ranged spell attack hit", making the row depend on its sibling Poison damage row for trigger context.
- The spell already splits ranged-hit Poison damage from the Poisoned rider, so the status row should explicitly name the triggering ranged spell attack hit while preserving the end-of-next-turn duration.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Ray of Sickness's Poisoned row to use "triggering ranged spell attack hit" wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Ray of Sickness still used "same ranged spell attack hit" on the Poisoned row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/ray-of-sickness.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack construction, hit detection, Poison damage application, Poisoned condition application, expiry timing, slot scaling, or immunity/resistance handling beyond current structured data and row text.

## 2026-06-14 - Shocking Grasp reaction-control trigger description

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-025 - opportunity-attack row no longer uses same-hit shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/shocking-grasp.json had a STATUS_CONDITION row for Opportunity Attacks Suppressed that said "same hit", making the row depend on its sibling Lightning damage row for trigger context.
- The spell already splits melee-hit Lightning damage from the reaction-control rider, so the status row should explicitly name the triggering melee spell hit while preserving the 1-round opportunity-attack suppression.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Shocking Grasp's reaction-control row to use "triggering melee spell hit" wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Shocking Grasp still used "same hit" on the reaction-control row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/shocking-grasp.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for melee spell attack construction, hit detection, Lightning damage application, Opportunity Attack suppression enforcement, expiry timing, cantrip-tier scaling, or immunity/resistance handling beyond current structured data and row text.

## 2026-06-14 - Ray of Frost speed rider trigger description

### SSO-HIGH-IMPACT-MOVEMENT-DESCRIPTION-024 - speed row no longer uses same-hit shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/ray-of-frost.json had a MOVEMENT row for the Speed reduction rider that said "same ranged spell hit", making the row depend on its sibling Cold damage row for trigger context.
- The spell already splits ranged-hit Cold damage from the Speed reduction rider, so the movement row should explicitly name the triggering ranged spell hit while preserving the 10-foot Speed reduction and start-of-next-turn expiry.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Ray of Frost's movement row to use "triggering ranged spell hit" wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Ray of Frost still used "same ranged spell hit" on the movement row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-0/ray-of-frost.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack construction, hit detection, Cold damage application, Speed mutation, expiry timing, cantrip-tier scaling, immunity/resistance handling, or movement-control UI rendering beyond current structured data and row text.

## 2026-06-14 - Searing Smite Ignited trigger description

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-023 - ignited row no longer uses same-hit shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/searing-smite.json had a STATUS_CONDITION row for Ignited that said "same melee weapon hit", making the row depend on its sibling damage row for trigger context.
- The spell already splits the initial Fire damage rider and the Ignited recurring-burn rider, so the status row should explicitly name the triggering melee weapon hit while preserving the 1-minute duration, recurring 1d6 Fire damage, and Constitution save ending.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Searing Smite's Ignited row to use "triggering melee weapon hit" wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Searing Smite still used "same melee weapon hit" on the Ignited row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/searing-smite.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for smite arming, first-hit consumption, melee weapon attack filtering, Fire damage application, Ignited condition application, recurring damage scheduling, Constitution-save execution, spell ending, higher-slot scaling, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Tasha's Hideous Laughter Prone save description

### SSO-HIGH-IMPACT-STATUS-DESCRIPTION-022 - prone row no longer depends on same-save shorthand

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/tashas-hideous-laughter.json had a STATUS_CONDITION row for Prone that said "same failed save" instead of naming the Wisdom save directly.
- The spell splits Incapacitated and Prone into separate rows, so the Prone row needs to remain readable when shown independently in a runtime or UI effect list.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Tasha's Hideous Laughter's effect descriptions to include a direct failed-Wisdom-save Prone sentence.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Tasha's Hideous Laughter still used same-save shorthand for the Prone row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/tashas-hideous-laughter.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for target eligibility, Intelligence threshold filtering, Wisdom-save execution, Incapacitated application, Prone application, damage-triggered repeat saves with Advantage, end-turn repeat saves, self-ending prevention enforcement, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Investiture of Ice freezing-wind speed description

### SSO-HIGH-IMPACT-MOVEMENT-DESCRIPTION-021 - freezing-wind row no longer exposes schema marker wording

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/investiture-of-ice.json had a MOVEMENT row that described the failed-save Speed-halving rider and then exposed `speedChange.value` plus the `-0.5` schema workaround in player-facing text.
- The movement payload already stores the temporary fractional marker, so the visible row should only state the rules-facing result: failed save, freezing wind, Speed halved, and expiry at the start of the caster's next turn.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Investiture of Ice's effect descriptions to include the player-facing Speed-halving sentence without schema wording.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Investiture of Ice still exposed schema-marker wording instead of the focused player-facing Speed text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-6/investiture-of-ice.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for freezing-wind area targeting, Constitution-save execution, Cold damage application, Speed-halving enforcement, expiration timing, concentration upkeep, icy terrain rendering, Cold immunity, Fire resistance, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Otto's Irresistible Dance wrapper description

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-020 - dance-wrapper row no longer uses importer routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/ottos-irresistible-dance.json had a UTILITY row that still began with "Records Otto's Irresistible Dance wrapper facts" and used "sibling rows carry" routing language.
- The spell already has structured Charmed, movement-lock, and defensive disadvantage/advantage rows, so the utility row should carry visible target selection, Charmed immunity, dance flavor, successful-save movement duration, failed-save concentration duration, and action repeat-save routing in player-facing text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Otto's Irresistible Dance's utility row to describe those wrapper facts without importer language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Otto's Irresistible Dance still used the old importer-facing utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-6/ottos-irresistible-dance.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Otto's Irresistible Dance target visibility checks, Charmed immunity enforcement, initial Wisdom-save execution, successful-save movement-lock duration, Charmed application, movement-lock enforcement, attack Disadvantage routing, attacker Advantage routing, repeat-save action spending, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Hold Monster control wrapper description

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-019 - monster-hold row no longer uses importer routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/hold-monster.json had a UTILITY row that still began with "Records the Hold Monster control wrapper" and described sibling-row routing instead of the player-facing control facts.
- The spell already has a structured Paralyzed row, so the utility row should carry target visibility, range, Undead exclusion, concentration duration, and repeat-save ending facts in readable text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Hold Monster's utility row to describe those wrapper facts without importer language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Hold Monster still used the old importer-facing utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/hold-monster.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Hold Monster target visibility checks, Undead exclusion enforcement, Wisdom-save execution, Paralyzed application, concentration upkeep, end-turn repeat-save scheduling, success cleanup, duration cleanup, or slot-scaling execution beyond current structured data and row text.

## 2026-06-14 - Tenser's Transformation martial wrapper description

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-018 - martial-wrapper row no longer uses importer routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/tensers-transformation.json had a UTILITY row that still began with "Records Tenser's Transformation wrapper facts" and used "sibling rows carry" routing language.
- The spell already has separate rows for temporary Hit Points, weapon-hit Force damage, and end-save Exhaustion, so the utility row should carry the remaining caster restriction and martial benefits in player-facing text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Tenser's Transformation's utility row to describe spellcasting lockout, weapon-attack Advantage, proficiencies, save proficiencies, and the two-attack Attack action without importer language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Tenser's Transformation still used the old importer-facing utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-6/tensers-transformation.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Tenser's Transformation spellcasting lockout enforcement, weapon-attack Advantage routing, armor/shield/weapon proficiency application, Strength and Constitution save proficiency application, Extra Attack conflict handling, temporary Hit Point lifecycle, weapon-hit Force damage execution, end-of-spell Constitution save execution, Exhaustion application, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Hallow area ward and extra-effect routing description

### SSO-HIGH-IMPACT-UTILITY-DESCRIPTION-017 - hallowed-area row no longer copies the full extra-effect menu

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/hallow.json had one UTILITY row that copied nearly the entire spell card, including the full extra-effect menu, into a single effect description.
- The old row mixed the persistent area ward, existing-Hallow failure case, blocked creature types, possession/Charmed/Frightened suppression, optional type exclusions, extra-effect selection, target filtering, and Charisma-save routing with every menu option's prose.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Hallow's utility row to summarize the ward shell and extra-effect routing without copying the full menu.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Hallow still used the copied full-card utility prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/hallow.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Hallow casting-time orchestration, area overlap failure execution, creature-type selection, ward entry blocking, possession/Charmed/Frightened suppression, exclusion handling, extra-effect menu selection, deity/leader/creature-kind filtering, Charisma-save execution, individual extra-effect payload execution, permanence, or dispel cleanup beyond current structured data and row text.

## 2026-06-14 - Move Earth terrain reshaping and procedural-limit descriptions

### SSO-HIGH-IMPACT-TERRAIN-DESCRIPTION-016 - earthwork rows now split terrain operations from concentration limits

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/move-earth.json had one TERRAIN row that compressed reshaping into a short caster summary and one UTILITY row that copied the full procedural spell-card paragraph.
- The old utility row mixed terrain-operation choices, 10-minute transformation timing, reassignment cadence, natural-stone exclusion, structure instability, and plant movement into one long paragraph that is hard for runtime/UI interpretation.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Move Earth's two effect rows to separate the terrain operations from the long-running concentration, reassignment, material-limit, structure-risk, and plant-carrying wrapper facts.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Move Earth still used the older compressed terrain row and copied procedural utility paragraph.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/move-earth.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Move Earth area selection, terrain-material validation, elevation/trench/wall/pillar geometry execution, 10-minute transformation scheduling, creature trapping or injury prevention, repeated area reassignment, natural-stone exclusion, structure instability adjudication, plant movement, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-14 - Wall of Thorns damage timing, line-of-sight, and movement descriptions

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-015 - thorn-wall rows now separate Piercing, Slashing, terrain, movement, and shape facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/wall-of-thorns.json had a Slashing end-turn DAMAGE row that referred to "the once-per-turn Dexterity save" without spelling out the failed-save and half-on-success result.
- public/data/spells/level-6/wall-of-thorns.json had a MOVEMENT row that leaked schema-marker wording (`speedChange.value`) instead of presenting the 4-feet-per-1-foot movement cost as player-facing text.
- public/data/spells/level-6/wall-of-thorns.json also had TERRAIN and UTILITY rows that compressed line-of-sight blocking, straight-wall geometry, circular-wall geometry, concentration duration, and wall dimensions.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Wall of Thorns' six effect rows to keep initial Piercing damage, entry Slashing damage, end-turn Slashing damage, line-of-sight blocking, movement cost, and wall-shape responsibilities separate.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wall of Thorns still used the older implicit end-turn damage row, schema-marker movement wording, and compressed terrain/wrapper text.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/wall-of-thorns.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Wall of Thorns wall placement, straight or circular geometry validation, solid-surface validation, line-of-sight blocking, movement-cost enforcement, Dexterity-save execution, once-per-turn Slashing throttling, Piercing or Slashing damage application, concentration upkeep, duration cleanup, or slot-scaling execution beyond current structured data and row text.

## 2026-06-14 - Blade Barrier damage timing, terrain, and cover descriptions

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-014 - blade-wall rows now expose Force save outcomes and wall shape facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/blade-barrier.json had entry and end-turn DAMAGE rows that said creatures make "the same Dexterity save" and used vague "canonical spell limits this save to once per turn" wording instead of carrying the 6d10 Force failed-save and half-on-success result directly.
- public/data/spells/level-6/blade-barrier.json also had a TERRAIN row and UTILITY row that omitted or compressed visible wall facts, including the straight-wall and ringed-wall geometry.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Blade Barrier's five effect rows to keep immediate, entry, end-turn, Difficult Terrain, and Three-Quarters Cover responsibilities separate and player-readable.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Blade Barrier still used the older vague entry/end-turn damage rows, apostrophe terrain wording, and compressed cover wrapper.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/blade-barrier.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Blade Barrier wall placement, straight or ring geometry validation, cover enforcement, Difficult Terrain enforcement, Dexterity-save execution, once-per-turn damage throttling, Force damage application, concentration upkeep, duration cleanup, or slot-scaling execution beyond current structured data and row text.

## 2026-06-14 - Wall of Stone construction and permanence utility description

### SSO-HIGH-IMPACT-BARRIER-DESCRIPTION-013 - stone-wall row now exposes panel, escape, durability, and permanence facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/wall-of-stone.json had one UTILITY row whose prior description covered a wall, bridge, ramp, Dexterity save, and permanence, but omitted the 10-minute concentration duration, panel geometry options, enclosure Reaction movement, supported-shape constraints, panel AC and Hit Points, Poison and Psychic immunity, and connected-panel collapse risk.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Wall of Stone's single utility row to carry those construction and permanence facts without copying the full spell card.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wall of Stone still used the older under-specified utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/wall-of-stone.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Wall of Stone placement, panel contiguity validation, support validation, bridge or ramp construction, occupied-space push choice, enclosure escape movement, object damage tracking, collapse adjudication, concentration upkeep, duration cleanup, permanence tracking, or Dispel Magic blocking beyond current structured data and row text.

## 2026-06-14 - Insect Plague damage timing and swarm wrapper descriptions

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-012 - locust swarm rows now carry explicit Piercing outcomes

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/insect-plague.json had three DAMAGE rows for swarm appearance, first entry, and end-turn timing, but those rows omitted the 4d10 Piercing failed-save branch and used vague "canonical spell limits" notes.
- public/data/spells/level-5/insect-plague.json also had a UTILITY row that duplicated the Lightly Obscured terrain row instead of carrying the swarm wrapper facts.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Insect Plague's three damage rows to carry explicit 4d10 Piercing save outcomes, its terrain rows to carry Difficult Terrain and Lightly Obscured separately, and its utility row to carry only the swarm wrapper.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Insect Plague still used incomplete damage descriptions and duplicate obscuration wrapper wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/insect-plague.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Insect Plague swarm placement, Lightly Obscured rendering, Difficult Terrain enforcement, Constitution-save execution, once-per-turn damage throttling, Piercing damage application, concentration upkeep, duration cleanup, or slot-scaling execution beyond current structured data and row text.

## 2026-06-13 - Wall of Force barrier utility description

### SSO-HIGH-IMPACT-BARRIER-DESCRIPTION-011 - force-wall row now exposes shape, push, and blocking facts

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/wall-of-force.json has one UTILITY effect row whose prior description summarized a magical-force barrier but omitted key player-facing wrapper facts: 10-minute concentration duration, dome/globe/panel limits, caster side-choice when cutting through a creature space, Dispel Magic immunity, Disintegrate destruction, and Ethereal blocking.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Wall of Force's single utility row to carry the barrier shape and blocking facts without copying the full card.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wall of Force still used the older under-specified utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-5/wall-of-force.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Wall of Force placement, orientation, panel contiguity validation, dome or globe shaping, creature-side push choice, physical passage blocking, damage immunity enforcement, Dispel Magic immunity, Disintegrate destruction, Ethereal blocking, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-13 - Animal Messenger communication utility description

### SSO-HIGH-IMPACT-COMMUNICATION-DESCRIPTION-010 - messenger row now exposes save, delivery, and lost-message outcome

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/animal-messenger.json had a UTILITY description that summarized delivery speed and slot scaling but omitted the visible Tiny Beast range, 25-word message limit, Charisma save, non-CR-0 auto-success override, visited-location requirement, and lost-message failure case.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Animal Messenger's utility row to carry the communication setup, current save behavior, travel pace, failure outcome, and duration scaling without copying the full card.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Animal Messenger still used the older incomplete communication utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-2/animal-messenger.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Animal Messenger target selection, Beast visibility checks, Charisma-save execution, non-CR-0 auto-success adjudication, message-entry UI, visited-location validation, described-recipient matching, travel simulation, flying-speed branch, arrival delivery, lost-message cleanup, return-to-cast-location behavior, or slot-duration scaling execution beyond current structured data and row text.

## 2026-06-13 - Aura of Purity aura and defensive row descriptions

### SSO-HIGH-IMPACT-DEFENSIVE-DESCRIPTION-009 - aura wrapper no longer duplicates defensive payload rows

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/aura-of-purity.json had a UTILITY row that repeated disease prevention, Poison resistance, and saving-throw Advantage even though the latter two already have sibling DEFENSIVE rows.
- public/data/spells/level-4/aura-of-purity.json had a Poison resistance row that used lower-case "resistance" while nearby structured defensive rows use the game-term casing "Resistance."
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Aura of Purity's utility row to focus on aura radius, movement, duration, concentration, and disease prevention, while sibling defensive rows carry Poison Resistance and condition-save Advantage.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Aura of Purity still used the older duplicated utility wording and lower-case resistance wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/aura-of-purity.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Aura of Purity aura rendering, nonhostile-creature filtering, disease prevention enforcement, Poison Resistance application, condition-causing-effect classification, saving-throw Advantage routing, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-13 - Control Water mode-selection utility description

### SSO-HIGH-IMPACT-MODE-DESCRIPTION-008 - water-control wrapper now exposes duration and mode switching

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/control-water.json has one UTILITY effect row and separate modeChoice summaries for Flood, Part Water, Redirect Flow, and Whirlpool.
- The UTILITY row already avoided full card prose, but omitted the 10-minute concentration duration and could be clearer that later Magic actions repeat the current mode or switch to a different mode.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Control Water's visible effect row to carry only the shared mode-selection wrapper while preserving modeChoice as the detailed per-mode surface.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Control Water still used the older mode-selection utility wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-4/control-water.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Control Water Flood, Part Water, Redirect Flow, or Whirlpool execution; standing-water elevation; wave travel; vehicle carry or capsizing; trench creation; redirected flow pathing; whirlpool placement; creature pull; Strength-save execution; Bludgeoning damage; swim-away Athletics checks; later Magic-action mode switching; concentration upkeep; or duration cleanup beyond current structured data, modeChoice summaries, and row text.

## 2026-06-13 - Dawn damage timing and sunlight movement descriptions

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-007 - dawn cylinder rows now carry explicit Radiant outcomes and movement wrapper

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/dawn.json had two DAMAGE rows for cylinder appearance and end-turn timing, but both only said the target took half damage on a success and omitted the 4d10 Radiant failed-save branch.
- public/data/spells/level-5/dawn.json had a UTILITY row that identified bright sunlight but omitted the one-minute concentration duration and later-turn Bonus Action movement wrapper.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Dawn's two damage rows to carry explicit 4d10 Radiant save outcomes and its utility row to carry the sunlight cylinder plus movement wrapper.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Dawn still used incomplete damage descriptions and a minimal sunlight utility row.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/dawn.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Dawn cylinder placement, bright-light or sunlight rendering, Constitution-save execution, Radiant damage application, end-turn scheduling, Bonus Action movement, 60-foot caster-distance gating, concentration upkeep, or duration cleanup beyond current structured data and row text.

## 2026-06-13 - Feather Fall falling-control utility description

### SSO-UTILITY-DESCRIPTION-006 - falling-control row no longer duplicates card ending prose

Status: verified.

Evidence added this pass:
- public/data/spells/level-1/feather-fall.json had a UTILITY description that nearly duplicated the top-level card text and repeated the per-target landing-ending fact already present in conditional ending data.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Feather Fall's utility row to focus on target count, 60-foot range, 60-feet-per-round descent, 1-minute duration, and no falling damage on landing.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Feather Fall still used the older card-like utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-1/feather-fall.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Feather Fall reaction timing, falling-creature detection, five-target selection, descent-speed enforcement, landing detection, fall-damage prevention, per-target ending cleanup, or duration expiry beyond current structured data and row text.

## 2026-06-13 - Otiluke's Freezing Sphere water and held-globe descriptions

### SSO-HIGH-IMPACT-MECHANICS-DESCRIPTION-005 - water-freeze, restraint, and held-globe rows now stay focused

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/otilukes-freezing-sphere.json had a focused Cold DAMAGE row, but its water-freeze TERRAIN row, Restrained STATUS_CONDITION row, and held-globe UTILITY row still carried longer card-prose phrasing.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Otiluke's Freezing Sphere to keep the Cold blast, water-freeze terrain, frozen-surface restraint, and held-globe delivery rows distinct and short.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Otiluke's Freezing Sphere still used the older water-freeze, restraint, and held-globe descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-6/otilukes-freezing-sphere.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Otiluke's Freezing Sphere globe targeting, blast placement, Constitution-save execution, Cold damage application, water-surface detection, ice terrain creation, swimming-creature matching, Restrained application, Athletics escape execution, held-globe handoff, thrown or sling delivery, safe set-down handling, delayed explosion timing, shatter-on-impact routing, or slot-scaling execution beyond current structured data and row text.

## 2026-06-13 - Cloudkill damage timing and fog wrapper descriptions

### SSO-HIGH-IMPACT-DAMAGE-DESCRIPTION-004 - poison fog timing rows now carry explicit save outcomes

Status: verified.

Evidence added this pass:
- public/data/spells/level-5/cloudkill.json had three DAMAGE rows for fog appearance, entry or fog movement, and end-turn timing, but those rows either omitted the 5d8 Poison failed-save branch or used vague "this save" wording.
- public/data/spells/level-5/cloudkill.json had a UTILITY row that only said the fog was Heavily Obscured, leaving wind dispersal and start-turn drift visible only in top-level prose.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Cloudkill's three damage rows to carry explicit 5d8 Poison save outcomes and its utility row to carry only the fog wrapper facts.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Cloudkill still used incomplete damage descriptions and a minimal fog utility description.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-5/cloudkill.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Cloudkill fog placement, Heavily Obscured rendering, strong-wind dispersal, start-turn drift, once-per-turn damage throttling, Constitution-save execution, Poison damage application, concentration upkeep, or slot-scaling execution beyond current structured data and row text.

## 2026-06-13 - Symbol and Psychic Scream wrapper descriptions

### SSO-HIGH-IMPACT-WRAPPER-DESCRIPTION-003 - glyph routing and head-explosion wrappers no longer overpack sibling mechanics

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/symbol.json had a UTILITY description that correctly avoided copied full-card prose but still packed glyph placement, trigger exclusions, light, activation timing, and once-per-turn routing into a dense sentence.
- public/data/spells/level-9/psychic-scream.json had a UTILITY description that repeated the Stunned row's end-turn Intelligence repeat-save mechanics even though the separate status row already carries that payload.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects Symbol's wrapper row to stay focused on placement, trigger, light sphere, and once-per-turn activation routing, and Psychic Scream's wrapper row to omit Stunned repeat-save prose.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Symbol and Psychic Scream still used the older overpacked utility descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/symbol.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/psychic-scream.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Symbol glyph placement, trigger authoring UI, Perception discovery, exclusion matching, Dim Light rendering, activation scheduling, once-per-turn throttling, payload selection, save execution, or any Death, Discord, Fear, Pain, Sleep, and Stunning payload execution beyond current structured data and row text. It also does not claim full runtime parity for Psychic Scream target selection, Intelligence-floor filtering, damage execution, head-explosion rendering, Stunned application, repeat-save scheduling, or cleanup beyond current structured data and row text.

## 2026-06-13 - Otiluke, Scatter, and Wind Walk copied utility descriptions

### SSO-COPIED-UTILITY-DESCRIPTION-002 - barrier, teleport, and cloud-form wrappers no longer copy full card prose

Status: verified.

Evidence added this pass:
- public/data/spells/level-4/otilukes-resilient-sphere.json had a UTILITY description that copied the top-level spell prose even though a sibling defensive row carries the sphere's own damage immunity.
- public/data/spells/level-6/scatter.json had a UTILITY description that copied the top-level spell prose even though a sibling movement row carries the teleport relocation payload.
- public/data/spells/level-6/wind-walk.json had a UTILITY description that copied the top-level spell prose even though sibling movement, status, and defensive rows carry fly speed, Stunned reversion, Prone immunity, and weapon-damage resistance.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has focused real-data expectations for all three rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Otiluke's Resilient Sphere, Scatter, and Wind Walk still used copied full-card utility descriptions.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-4/otilukes-resilient-sphere.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/scatter.json passed.
- npm run validate:spells -- --spell public/data/spells/level-6/wind-walk.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Resilient Sphere containment placement, Dexterity-save execution, barrier pass-through enforcement, rolling or pickup movement, Disintegrate destruction, Scatter multi-target selection, Wisdom-save execution, destination validation, teleport movement execution, Wind Walk cloud-form state, fly speed and hover execution, action restrictions, reversion timing, Stunned application, resistance and immunity execution, safe descent, or falling cleanup beyond current structured data and row text.

## 2026-06-13 - Magnificent Mansion and Mighty Fortress utility descriptions

### SSO-LEVEL7-8-MANSION-FORTRESS-UTILITY-DESCRIPTION-002 - construction and extradimensional dwelling wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/mordenkainens-magnificent-mansion.json still had a UTILITY description beginning "Records Mordenkainen's Magnificent Mansion wrapper facts" and routing servant summoning and end-of-spell expulsion through sibling rows.
- public/data/spells/level-8/mighty-fortress.json still had a UTILITY description beginning "Records Mighty Fortress wrapper facts" and routing one hundred invisible servants through the sibling summoning row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Mordenkainen's Magnificent Mansion and Mighty Fortress still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/mordenkainens-magnificent-mansion.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/mighty-fortress.json passed.
- npm run test:types passed.
- Bounded public/data level 7-8 importer-text scan returned no remaining "Records ... wrapper facts", "sibling rows carry", "points to sibling rows", or "while sibling" hits.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Mansion door placement, designated-entry UI, door open/close state, imperceptible-door rendering, floor-plan validation, servant behavior, end-of-spell expulsion placement, Mighty Fortress structure-free placement, creature lifting, fortress layout generation, object crumbling, stone-section damage modeling, collapse adjudication, 7-day teardown, same-spot permanence tracking, or invisible servant behavior beyond current structured data and row text.

## 2026-06-13 - Animal Shapes, Demiplane, and Regenerate utility descriptions

### SSO-LEVEL7-8-TRANSFORM-SPACE-REGEN-UTILITY-DESCRIPTION-002 - transformation, demiplane, and regrowth wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/animal-shapes.json still had a UTILITY description beginning "Records Animal Shapes wrapper facts" and routing first-form Temporary Hit Points through the sibling healing row.
- public/data/spells/level-8/demiplane.json still had a UTILITY description beginning "Records Demiplane wrapper facts" and routing optional shunt Prone payload through a sibling row.
- public/data/spells/level-7/regenerate.json still had a UTILITY description beginning "Records Regenerate wrapper facts" and routing immediate and recurring healing through sibling healing rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects all three utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Animal Shapes, Demiplane, and Regenerate still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-8/animal-shapes.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/demiplane.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/regenerate.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Animal Shapes Beast lookup, Challenge Rating validation, multi-target form assignment, Magic-action re-transform UI, retained-stat handling, equipment merging, Bonus Action ending, Temporary Hit Point lifecycle, Demiplane door placement, room creation, previous or known demiplane matching, optional shunt choice, Prone placement, Regenerate healing execution, start-turn recovery scheduling, body-part regrowth timing, or duration cleanup beyond current structured data and row text.

## 2026-06-13 - Illusory Dragon, Incendiary Cloud, and Plane Shift utility descriptions

### SSO-LEVEL7-8-DRAGON-CLOUD-PLANE-UTILITY-DESCRIPTION-002 - illusion, hazard, and planar wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/illusory-dragon.json still had a UTILITY description beginning "Records Illusory Dragon wrapper facts" and routing Frightened, 7d6 cone damage, save advantage for discerners, and 60-foot movement through sibling rows.
- public/data/spells/level-8/incendiary-cloud.json still had a UTILITY description beginning "Records Incendiary Cloud wrapper facts" and routing 10d8 Fire damage triggers and 10-foot cloud movement through sibling rows.
- public/data/spells/level-7/plane-shift.json still had a UTILITY description beginning "Records Plane Shift wrapper facts" and routing planar teleport movement through the sibling movement row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects all three utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Illusory Dragon, Incendiary Cloud, and Plane Shift still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-8/illusory-dragon.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/incendiary-cloud.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/plane-shift.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Illusory Dragon placement, Frightened application, repeat-save cleanup, breath damage type selection, cone targeting, bonus-action movement execution, illusion discernment, save advantage for discerners, illusion immunity enforcement, Incendiary Cloud area rendering, Heavily Obscured visibility, strong-wind dispersal, once-per-turn save throttling, Fire damage execution, cloud movement, Plane Shift component attunement, linked-hand targeting, general destination adjudication, known-circle validation, spillover placement, or planar teleport execution beyond current structured data and row text.

## 2026-06-13 - Arcane Sword, Mind Blank, and Power Word Stun utility descriptions

### SSO-LEVEL7-8-SWORD-MIND-STUN-UTILITY-DESCRIPTION-002 - combat and mental-shield wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/arcane-sword.json still had a UTILITY description beginning "Records Arcane Sword wrapper facts" and routing Force damage and 20-foot sword movement through sibling rows.
- public/data/spells/level-8/mind-blank.json still had a UTILITY description beginning "Records Mind Blank wrapper facts" and routing Psychic damage and Charmed immunity through the sibling defensive row.
- public/data/spells/level-8/power-word-stun.json still had a UTILITY description beginning "Records Power Word Stun wrapper facts" and routing the Stunned and Speed-0 branches through sibling rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects all three utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Arcane Sword, Mind Blank, and Power Word Stun still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/arcane-sword.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/mind-blank.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/power-word-stun.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Arcane Sword creation placement, melee spell attack execution, Force damage execution, Bonus Action movement, retargeting UI, Mind Blank emotion and alignment sensing blocks, thought-reading blocks, magical location detection, information gathering, remote observation, mind-control prevention, Wish interaction, Psychic immunity execution, Charmed immunity execution, Power Word Stun Hit Point threshold evaluation, Stunned application, repeat-save scheduling, or over-threshold Speed-0 cleanup beyond current structured data and row text.

## 2026-06-13 - Power Word Pain, Holy Aura, and Maddening Darkness utility descriptions

### SSO-LEVEL7-8-PAIN-AURA-DARKNESS-UTILITY-DESCRIPTION-002 - threshold, aura, and darkness wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/power-word-pain.json still had a UTILITY description beginning "Records Power Word Pain wrapper facts" and routing the pain state, speed cap, and disadvantage payloads through sibling rows.
- public/data/spells/level-8/holy-aura.json still had a UTILITY description beginning "Records Holy Aura wrapper facts" and routing saving throw advantage, incoming attack-roll disadvantage, and Blinded retaliation through sibling rows.
- public/data/spells/level-8/maddening-darkness.json still had a UTILITY description beginning "Records Maddening Darkness wrapper facts" and routing start-turn Wisdom saves and Psychic damage through the sibling damage row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects all three utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Power Word Pain, Holy Aura, and Maddening Darkness still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/power-word-pain.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/holy-aura.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/maddening-darkness.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Power Word Pain Hit Point threshold evaluation, Charmed-immunity checks, crippling pain state execution, speed-cap enforcement, disadvantage routing, spellcasting interruption, Constitution-save execution, repeat-save scheduling, Holy Aura chosen-creature UI, saving-throw advantage execution, incoming attack disadvantage execution, Fiend or Undead melee-hit trigger detection, Blinded retaliation, Maddening Darkness area rendering, corner spread, darkvision blocking, light suppression, audible madness cues, start-turn Wisdom saves, or Psychic damage execution beyond current structured data and row text.

## 2026-06-13 - Sequester and Antipathy/Sympathy utility descriptions

### SSO-SEQUESTER-ANTIPATHY-UTILITY-DESCRIPTION-002 - concealment and mode-choice wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/sequester.json still had a UTILITY description beginning "Records Sequester wrapper facts" and routing Invisible and Unconscious suspended-animation states through sibling status rows.
- public/data/spells/level-8/antipathy-sympathy.json still had a UTILITY description beginning "Records Antipathy/Sympathy wrapper facts" and routing Frightened, Charmed, and safest-route forced movement through sibling rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Sequester and Antipathy/Sympathy still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-7/sequester.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/antipathy-sympathy.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Sequester component consumption, object-or-willing-creature targeting, Divination targeting blocks, magic detection suppression, remote-viewing suppression, creature aging and needs suspension, custom end-condition monitoring, damage-ending cleanup, Invisible or Unconscious application, Antipathy/Sympathy mode selection UI, chosen-kind matching, Wisdom-save execution, repeat-save scheduling, immunity-window tracking, Sympathy movement lockout, target-damage ending saves, or safest-route forced movement beyond current structured data and row text.

## 2026-06-13 - Level 8 control and sunlight utility descriptions

### SSO-LEVEL8-CONTROL-SUNLIGHT-UTILITY-DESCRIPTION-002 - Dominate Monster, Feeblemind, and Sunburst wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/dominate-monster.json still had a UTILITY description beginning "Records Dominate Monster wrapper facts" and routing the Wisdom save, repeat save, and Charmed payload through a sibling row.
- public/data/spells/level-8/feeblemind.json still had a UTILITY description beginning "Records Feeblemind wrapper facts" and routing Psychic damage and Feebleminded status through sibling rows.
- public/data/spells/level-8/sunburst.json still had a UTILITY description beginning "Records Sunburst wrapper facts" and routing Constitution save, Radiant damage, repeat save, and Blinded duration through sibling rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects all three utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Dominate Monster, Feeblemind, and Sunburst still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-8/dominate-monster.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/feeblemind.json passed.
- npm run validate:spells -- --spell public/data/spells/level-8/sunburst.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Dominate Monster save advantage, Wisdom-save execution, Charmed application, repeat-save scheduling, telepathic command UI, commanded Reaction spending, Feeblemind Psychic damage execution, Intelligence-save execution, ability-score mutation, long-term 30-day save scheduling, Greater Restoration or Heal ending hooks, Sunburst sphere rendering, Constitution-save execution, Radiant damage execution, Blinded application, repeat-save cleanup, or Darkness dispel execution beyond current structured data and row text.

## 2026-06-13 - Level 9 foresight and heal utility descriptions

### SSO-LEVEL9-FORESIGHT-HEAL-UTILITY-DESCRIPTION-002 - Foresight, Mass Heal, and Power Word Heal wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/foresight.json still had a UTILITY description beginning "Records Foresight wrapper facts" and routing saving-throw advantage, outgoing attack-roll advantage, and incoming attack-roll disadvantage through sibling rows.
- public/data/spells/level-9/mass-heal.json still had a UTILITY description beginning "Records Mass Heal wrapper facts" and routing the 700-Hit-Point pool through a sibling healing row.
- public/data/spells/level-9/power-word-heal.json still had a UTILITY description beginning "Records Power Word Heal wrapper facts" and routing all-Hit-Point restoration and Prone movement-state ending through sibling rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects all three utility rows to describe player-facing gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Foresight, Mass Heal, and Power Word Heal still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/foresight.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/mass-heal.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/power-word-heal.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Foresight willing-touch targeting, D20-test advantage routing, outgoing attack-roll advantage execution, incoming attack-roll disadvantage execution, recast-ending cleanup, Mass Heal allocation UI, healing distribution execution, condition-removal execution, Power Word Heal all-Hit-Point restoration, condition-ending execution, Prone reaction prompts, Reaction spending, or stand-up movement beyond current structured data and row text.

## 2026-06-13 - Level 9 blade and transformation utility descriptions

### SSO-LEVEL9-BLADE-SHAPECHANGE-UTILITY-DESCRIPTION-002 - Blade of Disaster and Shapechange wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/blade-of-disaster.json still had a UTILITY description beginning "Records Blade of Disaster wrapper facts" and routing force damage and blade movement through sibling rows.
- public/data/spells/level-9/shapechange.json still had a UTILITY description beginning "Records Shapechange wrapper facts" and routing first-form temporary Hit Points through a sibling defensive row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both utility rows to describe their wrapper-only gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Blade of Disaster and Shapechange still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/blade-of-disaster.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/shapechange.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Blade of Disaster blade placement, melee spell attack execution, bonus-action movement execution, critical-hit threshold handling, barrier pass-through adjudication, Shapechange form lookup, Challenge Rating validation, retained-stat handling, equipment handling, Spellcasting checks, temporary Hit Point lifecycle, Magic-action re-forming, concentration upkeep, or transformation rendering beyond current structured data and row text.

## 2026-06-13 - Level 9 illusion and death-word utility descriptions

### SSO-LEVEL9-ILLUSION-DEATH-UTILITY-DESCRIPTION-002 - Weird and Power Word Kill wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/weird.json still had a UTILITY description beginning "Records Weird wrapper facts" and routing damage, Frightened, repeat-save damage, and per-target ending through sibling rows.
- public/data/spells/level-9/power-word-kill.json still had a UTILITY description beginning "Records Power Word Kill wrapper facts" and routing the over-threshold fallback through the sibling damage row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both utility rows to describe their wrapper-only gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Weird and Power Word Kill still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/weird.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/power-word-kill.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Weird area rendering, chosen-creature filtering, Wisdom-save execution, Frightened application, repeat-save scheduling, repeat Psychic damage, per-target ending, Power Word Kill Hit Point threshold evaluation, instant-death execution, fallback Psychic damage execution, or death-word UI beyond current structured data and row text.

## 2026-06-13 - Level 9 damage/control utility descriptions

### SSO-LEVEL9-DAMAGE-CONTROL-UTILITY-DESCRIPTION-002 - Meteor Swarm and Psychic Scream wrappers now avoid importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/meteor-swarm.json still had a UTILITY description beginning "Records Meteor Swarm wrapper facts" and ending with sibling-row routing language for Fire and Bludgeoning damage rows.
- public/data/spells/level-9/psychic-scream.json still had a UTILITY description beginning "Records Psychic Scream wrapper facts" and routing repeat-save handling through the Stunned row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both utility rows to describe their wrapper-only gameplay facts without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Meteor Swarm and Psychic Scream still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/meteor-swarm.json passed.
- npm run validate:spells -- --spell public/data/spells/level-9/psychic-scream.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Meteor Swarm impact-point placement, overlap suppression, object eligibility, object ignition, Fire or Bludgeoning save execution, Psychic Scream Intelligence-floor filtering, head-explosion rendering, Psychic damage execution, Stunned application, repeat-save scheduling, or stun cleanup beyond current structured data and row text.

## 2026-06-13 - Revive-family resurrection utility descriptions

### SSO-REVIVE-UTILITY-DESCRIPTION-002 - resurrection wrappers now avoid sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/true-resurrection.json still had a UTILITY description beginning "Records True Resurrection wrapper facts" and ending with sibling-row routing language for all-Hit-Point revival and new-body placement rows.
- public/data/spells/level-7/resurrection.json still had a UTILITY description beginning "Records Resurrection wrapper facts" and ending with sibling-row routing language for full-Hit-Point return and ordeal penalty rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects both revive utility rows to describe eligibility and restoration gates without importer-oriented routing language.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because True Resurrection and Resurrection still used "Records ..." wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description changes.
- npm run validate:spells -- --spell public/data/spells/level-9/true-resurrection.json passed.
- npm run validate:spells -- --spell public/data/spells/level-7/resurrection.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for death-age validation, old-age exclusion, Undead eligibility or restoration, component consumption, poison/contagion/curse/body restoration execution, new-body creation, spoken-name matching, 10-foot placement selection, all-Hit-Point restoration, ordeal penalty lifecycle, 365-day caster tax, spellcasting lockout, or caster D20 Disadvantage beyond current structured data and row text.

## 2026-06-13 - Project Image illusion-projection utility description

### SSO-PROJECT-IMAGE-UTILITY-DESCRIPTION-002 - illusion wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/project-image.json still had a UTILITY description beginning "Records Project Image wrapper facts" and ending with sibling-row routing language for Magic-action 60-foot image movement and behavior control.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Project Image utility row to describe the 5+ GP self-statuette component, 1-day concentration duration, previously seen location within 500 miles, obstacle bypass, intangible image, damage-ending, remote sight/hearing, mannerism mimicry, physical and Study-action discovery, and hollow/transparent discernment without importer-oriented routing language.
- The Project Image utility description now keeps illusion-projection facts readable for runtime/UI text while leaving Magic-action image movement and behavior control with the existing MOVEMENT row.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Project Image still used "Records Project Image wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/project-image.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for seen-location validation, 500-mile placement, obstacle-bypass placement, component validation, concentration upkeep, illusion rendering, damage-to-end execution, remote sight/hearing UI, mannerism mimicry, physical-interaction discovery, Study-action check execution, hollow-noise rendering, transparency rendering, or Magic-action movement/control beyond current structured data and row text.

## 2026-06-13 - Reverse Gravity gravity-zone utility description

### SSO-REVERSE-GRAVITY-UTILITY-DESCRIPTION-002 - gravity wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/reverse-gravity.json still had a UTILITY description beginning "Records Reverse Gravity wrapper facts" and ending with sibling-row routing language for upward movement, collision falling damage, and end-of-spell downward fall.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Reverse Gravity utility row to describe the 50-foot-radius, 100-foot-high Cylinder, 1-minute concentration duration, unanchored upward pull, reachable fixed-object Dexterity save, and hover-at-top shell without importer-oriented routing language.
- The Reverse Gravity utility description now keeps the gravity-zone shell readable for runtime/UI text while leaving upward forced movement, upward collision falling damage, and end-of-spell downward fall with the existing MOVEMENT and DAMAGE rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Reverse Gravity still used "Records Reverse Gravity wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/reverse-gravity.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cylinder placement/rendering, unanchored-object detection, fixed-object reach checks, Dexterity-save execution, upward forced movement, upward collision detection, falling damage calculation, hover state tracking, concentration upkeep, end-of-spell downward fall, or environmental anchor interaction beyond current structured data and row text.

## 2026-06-13 - Prismatic Wall wall-shell utility description

### SSO-PRISMATIC-WALL-UTILITY-DESCRIPTION-002 - wall wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/prismatic-wall.json still had a UTILITY description beginning "Records Prismatic Wall wrapper facts" and ending with sibling-row routing language for near-wall Blinded saves and blocking terrain.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Prismatic Wall utility row to describe the wall or globe choice, 10-minute duration, occupied-space failure, multicolored light, designated-safe passage, seven colored layers, ordered layer destruction, Antimagic Field immunity, and violet-only Dispel Magic interaction without importer-oriented routing language.
- The Prismatic Wall utility description now keeps wall-shell and layer-order facts readable for runtime/UI text while leaving near-wall Blinded saves and opaque blocking terrain with the existing STATUS_CONDITION and TERRAIN rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Prismatic Wall still used "Records Prismatic Wall wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/prismatic-wall.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for wall/globe placement UI, occupied-space failure execution, designated-safe creature storage, Bright/Dim Light rendering, near-wall trigger scheduling, Constitution-save execution, layer-by-layer Dexterity saves, layer damage/status/teleport payloads, ordered destruction enforcement, layer-specific destruction conditions, Antimagic Field immunity, violet-only Dispel Magic targeting, or missing first-class per-layer table rows beyond current structured data and row text.

## 2026-06-13 - Astral Projection astral-travel utility description

### SSO-ASTRAL-PROJECTION-UTILITY-DESCRIPTION-002 - astral wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/astral-projection.json still had a UTILITY description beginning "Records Astral Projection wrapper facts" and ending with sibling-row routing language for suspended Unconscious bodies.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Astral Projection utility row to describe the caster plus up to eight willing creatures, Astral Plane fail case, body suspension shell, silver-cord travel, cord-cut death, body/astral-form damage and effect separation, planar re-entry, 0 Hit Point ending, and Magic-action dismissal without importer-oriented routing language.
- The Astral Projection utility description now keeps astral-travel lifecycle facts readable for runtime/UI text while leaving suspended-body Unconscious with the existing STATUS_CONDITION row.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Astral Projection still used "Records Astral Projection wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/astral-projection.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 1-hour casting orchestration, consumed per-target components, willing-target selection, already-on-Astral fail resolution, astral body creation, body suspension needs/no-aging enforcement, silver-cord rendering, cord-cut death execution, body/astral damage isolation, planar re-entry placement, 0 Hit Point ending, Magic-action dismissal, or suspended-body cleanup beyond current structured data and row text.

## 2026-06-13 - Mass Polymorph transformation utility description

### SSO-MASS-POLYMORPH-UTILITY-DESCRIPTION-002 - transformation wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/mass-polymorph.json still had a UTILITY description beginning "Records Mass Polymorph wrapper facts" and ending with sibling-row routing language for the temporary Hit Points defensive row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Mass Polymorph utility row to describe up to ten visible targets within 120 feet, 1-hour concentration, Wisdom saves for unwilling targets, shapechanger auto-success, seen-Beast CR or half-level eligibility, retained Hit Points/alignment/personality, form-stat replacement, action/speech/spellcasting/hands/gear limits, and reversion timing without importer-oriented routing language.
- The Mass Polymorph utility description now keeps transformation rules readable for runtime/UI text while leaving non-replaceable Beast-form temporary Hit Points with the existing DEFENSIVE row.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Mass Polymorph still used "Records Mass Polymorph wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/mass-polymorph.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Beast lookup, caster-seen form validation, CR or half-level comparison, unwilling-target Wisdom saves, shapechanger auto-success execution, statistics replacement, retained Hit Point handling, non-replaceable temporary Hit Point lifecycle, action/speech/spellcasting/hands restrictions, gear melding, death reversion, concentration cleanup, or target reversion beyond current structured data and row text.

## 2026-06-13 - Prismatic Spray ray-selection utility description

### SSO-PRISMATIC-SPRAY-UTILITY-DESCRIPTION-002 - ray-selection wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/prismatic-spray.json still had a UTILITY description beginning "Records Prismatic Spray wrapper facts" and ending with sibling-row routing language for damage, condition, petrification, and teleport rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Prismatic Spray utility row to describe the 60-foot cone, per-creature Dexterity save, 1d8 Prismatic Rays table color roll, and special two-ray result without importer-oriented routing language.
- The Prismatic Spray utility description now keeps ray-selection facts readable for runtime/UI text while leaving 12d6 ray damage, indigo Restrained tracking, indigo Petrified aftermath, violet Blinded tracking, and violet planar teleport with the existing DAMAGE, STATUS_CONDITION, and MOVEMENT rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Prismatic Spray still used "Records Prismatic Spray wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/prismatic-spray.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cone targeting beyond current area data, per-creature resolution despite current maxTargets value, Dexterity-save execution, 1d8 table rolling, ray color substitution, special two-ray reroll handling, indigo Constitution save tracking, petrification transition, violet start-of-next-turn Wisdom save scheduling, planar teleport adjudication, or payload cleanup beyond current structured data and row text.

## 2026-06-13 - Divine Word table-routing utility description

### SSO-DIVINE-WORD-UTILITY-DESCRIPTION-002 - table wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/divine-word.json still had a UTILITY description beginning "Records Divine Word wrapper facts" and ending with sibling-row routing language for HP-band condition rows and planar-return movement.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Divine Word utility row to describe 30-foot creature choice, Charisma save routing, the 50 Hit Point table threshold, Celestial/Elemental/Fey/Fiend plane return, and 24-hour Wish-only return exception without importer-oriented routing language.
- The Divine Word utility description now keeps table and planar-routing facts readable for runtime/UI text while leaving Dead, Blinded, Deafened, Stunned, and planar forced return payloads with the existing STATUS_CONDITION and MOVEMENT rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Divine Word still used "Records Divine Word wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/divine-word.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for multi-creature choice despite the current maxTargets value, hearing or divine-word audibility checks, Charisma-save execution, Hit Point threshold lookup, simultaneous HP-band status application, planar-origin detection, forced return placement, 24-hour return blocking, Wish override handling, or condition cleanup beyond current structured data and row text.

## 2026-06-13 - Tsunami water-wall utility description

### SSO-TSUNAMI-UTILITY-DESCRIPTION-002 - water-wall wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/tsunami.json still had a UTILITY description beginning "Records Tsunami wrapper facts" and ending with sibling-row routing language for initial damage, ongoing Huge-or-smaller damage, and forced wall movement rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Tsunami utility row to describe the 1-mile placement point, 300-foot by 300-foot by 50-foot water wall, 6-round concentration duration, later caster-turn 50-foot movement, turn-end height and damage decay, 0-foot-height ending, Strength (Athletics) swimming check, and fall-out behavior without importer-oriented routing language.
- The Tsunami utility description now keeps water-wall lifecycle facts readable for runtime/UI text while leaving 6d10 initial Bludgeoning damage, 5d10 ongoing Huge-or-smaller Bludgeoning damage, and forced 50-foot wall movement with the existing DAMAGE and MOVEMENT rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Tsunami still used "Records Tsunami wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-8/tsunami.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for minute-long casting orchestration, wall placement/rendering, concentration upkeep, initial Strength-save execution, recurring caster-turn movement scheduling, once-per-round ongoing damage suppression, height decay, damage decay, Huge-or-smaller gating, swim-check execution, fall handling, forced movement execution, or spell-end cleanup beyond current structured data and row text.

## 2026-06-13 - Earthquake tremor-zone utility description

### SSO-EARTHQUAKE-UTILITY-DESCRIPTION-002 - tremor wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-8/earthquake.json still had a UTILITY description beginning "Records Earthquake wrapper facts" and ending with sibling-row routing language for Prone, Buried, structure damage, and collapse damage rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Earthquake utility row to describe the visible ground point, 100-foot tremor zone, Difficult Terrain, 1-minute concentration duration, grounded-creature Dexterity save cadence, Concentration break, fissure timing and constraints, and repeated structure damage/collapse checks without importer-oriented routing language.
- The Earthquake utility description now keeps the tremor and structure-collapse wrapper readable for runtime/UI text while leaving Prone, Buried, 50 Bludgeoning structure damage, and 12d6 collapse damage with the existing STATUS_CONDITION and DAMAGE rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Earthquake still used "Records Earthquake wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-8/earthquake.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 100-foot zone rendering, Difficult Terrain execution, grounded-creature detection, repeated Dexterity-save scheduling, Concentration break execution, fissure count rolling, fissure placement and no-structure validation, fissure depth/width rendering, creature fall-in handling, structure HP/damage tracking, collapse detection, collapse-radius targeting, Prone and Buried application, DC 20 escape checks, or Bludgeoning damage application beyond current structured data and row text.

## 2026-06-13 - Storm of Vengeance cloud-schedule utility description

### SSO-STORM-OF-VENGEANCE-UTILITY-DESCRIPTION-002 - storm wrapper now points to schedule without importer language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/storm-of-vengeance.json still had a UTILITY description beginning "Records Storm of Vengeance wrapper facts" and ending with sibling-row routing language for damage, Deafened, terrain, and schedule rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Storm of Vengeance utility row to describe the 300-foot-radius cloud, visible 1-mile point, 1-minute concentration duration, initial thunder/Deafened resolution, later caster-turn schedule, ranged-weapon lockout, and strong wind without importer-oriented routing language.
- The Storm utility description now keeps the cloud and schedule wrapper readable for runtime/UI text while leaving Thunder, Deafened, Acid, Lightning, Bludgeoning, Cold, Difficult Terrain, Heavily Obscured, and effectSchedule payloads with their existing rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Storm of Vengeance still used "Records Storm of Vengeance wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/storm-of-vengeance.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cloud placement, 300-foot radius rendering, concentration upkeep, initial Constitution save execution, Deafened duration, later-turn scheduler execution, acid rain, six distinct lightning targets, Dexterity half damage, hailstone damage, freezing-rain damage, Difficult Terrain, Heavily Obscured rendering, ranged weapon attack lockout, strong wind, or staged effect cleanup beyond current structured data and row text.

## 2026-06-13 - Simulacrum copy-lifecycle utility description

### SSO-SIMULACRUM-UTILITY-DESCRIPTION-002 - lifecycle wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/simulacrum.json still had a UTILITY description beginning "Records Simulacrum wrapper facts" and ending with sibling-row routing language for Construct-copy statistics, half Hit Point maximum, and 100 GP per Hit Point repair.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Simulacrum utility row to describe the 12-hour consumed-ruby casting, Beast or Humanoid presence requirement, ice-or-snow body, friendly commanded simulacrum lifecycle, action turn, no-Simulacrum/no-level/no-rest limits, 0 HP snow reversion, and recast destruction without importer-oriented routing language.
- The Simulacrum utility description now keeps copy setup and lifecycle information visible for runtime/UI text while leaving Construct-copy statistics, half Hit Point maximum, and Long Rest repair costs with the existing SUMMONING and HEALING rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Simulacrum still used "Records Simulacrum wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/simulacrum.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 12-hour casting orchestration, 1,500 GP component consumption, original Beast/Humanoid presence tracking, ice-or-snow body validation, Construct-copy stat replacement, half-Hit-Point maximum calculation, command AI, turn sharing, Simulacrum spell lockout, level-gain prevention, Short/Long Rest prevention, repair cost and proximity execution, 0 HP snow reversion, or recast destruction beyond current structured data and row text.

## 2026-06-13 - Magic Jar soul-container utility description

### SSO-MAGIC-JAR-UTILITY-DESCRIPTION-002 - possession wrapper now avoids sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-6/magic-jar.json still had a UTILITY description beginning "Records Magic Jar wrapper facts" and ending with sibling-row routing language for trapped-soul Incapacitated and caster-container movement/reaction suppression.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Magic Jar utility row to describe soul-container entry, projection, possession eligibility, Charisma-save possession, repeat-attempt lockout, host statistic replacement, return-to-container action, host-death return, container destruction, soul return, and container cleanup without importer-oriented routing language.
- The Magic Jar utility description now keeps possession routing visible for runtime/UI text while leaving trapped-soul Incapacitated and caster-container movement/reaction suppression with the existing STATUS_CONDITION and MOVEMENT rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Magic Jar still used "Records Magic Jar wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-6/magic-jar.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for catatonic caster-body state, container perception, 100-foot projection checks, Humanoid targeting, Protection from Evil and Good or Magic Circle ward detection, Charisma-save possession execution, 24-hour repeat-attempt lockout, host-stat replacement, trapped-host-soul Incapacitated state, Magic-action return, host-death save routing, container destruction, soul return or death resolution, spell-end container cleanup, or first-class reaction suppression beyond current structured data and row text.

## 2026-06-13 - Temple of the Gods sanctuary utility description

### SSO-TEMPLE-OF-THE-GODS-UTILITY-DESCRIPTION-002 - sanctuary shell text no longer routes sibling mechanics

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/temple-of-the-gods.json still had a UTILITY description beginning "Records Temple of the Gods wrapper facts" and ending with sibling-row routing language for opposed entry denial, d4 penalties, and healing bonus mechanics.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Temple of the Gods utility row to describe the created sanctuary shell, appearance choices, magical-force protections, Disintegrate destruction, and year-long same-spot permanence without importer-oriented routing language.
- The Temple utility description now leaves opposed-creature entry denial, opposed-creature d4 penalties, and spell-healing bonuses with the existing STATUS_CONDITION, ATTACK_ROLL_MODIFIER, and HEALING rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Temple of the Gods still used "Records Temple of the Gods wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/temple-of-the-gods.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 1-hour casting orchestration, unoccupied 120-foot cube validation, temple appearance UI, designated-door permissions, illumination rendering, incense or temperature presentation, opposed creature-type selection, Charisma save entry denial, d4 penalty application, Divination sensor and targeting blocks, healing bonus application, Ethereal travel blocking, physical collision, Dispel Magic or Antimagic Field immunity, Disintegrate destruction, or daily same-spot permanence tracking beyond current structured data and row text.

## 2026-06-13 - Teleport outcome-table utility description

### SSO-TELEPORT-UTILITY-DESCRIPTION-002 - outcome wrapper now avoids importer routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/teleport.json still had a UTILITY description beginning "Records Teleport wrapper facts" and ending with sibling-row routing language for the same-plane movement and Mishap damage rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Teleport utility row to describe target eligibility, same-plane destination requirement, and the familiarity-driven d100 outcome table without exposing importer-oriented wrapper language.
- The Teleport utility description now keeps the destination/outcome decision visible for runtime/UI text while leaving same-plane transport and Mishap 3d10 Force damage ownership with the existing MOVEMENT and DAMAGE rows.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Teleport still used "Records Teleport wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-7/teleport.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for willing-creature selection, object held-or-carried checks, known-destination validation, same-plane enforcement, d100 outcome-table rolling, Permanent Circle or Linked Object shortcuts, Similar Area placement, Off Target 2d12-mile and d8-direction placement, On Target arrival, Mishap damage application, reroll chaining, or actual teleport movement beyond current structured data and row text.

## 2026-06-13 - Wish mode and stress utility description

### SSO-WISH-UTILITY-DESCRIPTION-002 - choice menu and stress wrapper now avoid sibling-row routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/wish.json still had a UTILITY description beginning "Records Wish wrapper facts" and ending with routing language for sibling healing, defensive, and damage rows.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Wish utility row to describe spell duplication, non-duplication mode choices, and Wish stress without exposing importer-oriented wrapper language.
- The Wish utility description now leaves Instant Health, Resistance, Spell Immunity, and stress-casting Necrotic damage ownership with the existing HEALING, DEFENSIVE, and DAMAGE rows while making the mode/stress choice readable in runtime/UI text.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Wish still used "Records Wish wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/wish.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for duplicated-spell lookup and requirement bypass, costly-component bypass, Object Creation placement/value/size validation, Greater Restoration effect removal, permanent Resistance choice, 8-hour spell immunity, feat replacement eligibility, Roll Redo timing and advantage/disadvantage routing, Reshape Reality adjudication, Wish stress state persistence, Strength reduction duration recovery, future-Wish lockout rolling, or irreducible stress damage scheduling beyond current structured data and row text.

## 2026-06-13 - True Polymorph mode-selection utility description

### SSO-TRUE-POLYMORPH-UTILITY-DESCRIPTION-002 - transformation wrapper row now reads as player-facing mode text

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/true-polymorph.json still had a UTILITY description beginning "Records True Polymorph wrapper facts" and ending with sibling-row routing language for the temporary-Hit-Point defensive row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the True Polymorph utility row to describe the three transformation modes, unwilling Wisdom save, full-hour concentration permanence, CR/level and object-size limits, worn-or-carried eligibility, object-creature control, retained creature identity fields, action/speech/spellcasting/gear limits, and no-memory object form.
- The True Polymorph utility description now keeps mode-selection and eligibility information visible for runtime/UI text while leaving the existing DEFENSIVE temporary-Hit-Point row as the owner of creature-to-creature temporary HP.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because True Polymorph still used "Records True Polymorph wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/true-polymorph.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for form lookup, CR or level validation, object worn/carried enforcement, size comparison, unwilling Wisdom-save execution, concentration-to-until-dispelled conversion, stat-block replacement, retained hit point and Hit Die handling, action/anatomy restrictions, speech and spellcasting locks, gear melding, object-creature initiative and command AI, control loss after one hour, no-memory restoration, or temporary-Hit-Point lifecycle beyond current structured data and row text.

## 2026-06-13 - Imprisonment restraint-option utility description

### SSO-IMPRISONMENT-UTILITY-DESCRIPTION-002 - restraint wrapper row no longer exposes importer routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-9/imprisonment.json still had a UTILITY description beginning "Records Imprisonment wrapper facts" and describing sibling-row routing instead of the player-facing imprisonment choice and ending rules.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now expects the Imprisonment utility row to describe the failed Wisdom save, 24-hour successful-save immunity, imprisoned upkeep, Divination and teleport blocks, option menu, observable ending trigger, and ninth-level Dispel Magic ending route.
- The Imprisonment utility description now preserves the existing sibling Imprisoned, Restrained, Unconscious, and MOVEMENT rows while replacing importer-oriented wrapper language with runtime-facing text.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Imprisonment still used "Records Imprisonment wrapper facts" wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed after the JSON description change.
- npm run validate:spells -- --spell public/data/spells/level-9/imprisonment.json passed.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 24-hour immunity tracking, no-breath/eat/drink/age upkeep, Divination invisibility, teleport blocking, Burial containment, Chaining immovability, Hedged Prison planar warding, Minimus Containment object rules, Slumber wake prevention, observable ending-trigger adjudication, or ninth-level Dispel Magic enforcement beyond current structured data and row text.

## 2026-06-13 - Mirror Image duplicate redirect description

### SSO-MIRROR-IMAGE-UTILITY-DESCRIPTION-001 - defensive utility row now reads as ordered duplicate-redirection text

Status: verified.

Evidence added this pass:
- public/data/spells/level-2/mirror-image.json had a single UTILITY description that copied long duplicate behavior prose and made the attack-hit redirect sequence harder to scan in runtime/UI text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a real-data proof that Mirror Image keeps its one-row defensive utility model focused on the ordered duplicate redirect sequence.
- The Mirror Image utility description now names three duplicates in the caster's space, 1-minute duration, mimic movement/actions, attack-roll hit interception, one d6 per remaining duplicate, 3+ redirect threshold, duplicate destruction, immunity to non-attack damage/effects, all-duplicates-destroyed ending, and Blinded / Blindsight / Truesight exceptions while preserving targeting, duration, conditional ending metadata, and the current one-row utility model.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Mirror Image still used long duplicate behavior prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 107 tests.
- npm run validate:spells -- --spell public/data/spells/level-2/mirror-image.json reported 459 valid / 0 invalid.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for duplicate instance tracking, attack-hit interception, d6 redirect rolling, duplicate destruction, target replacement, sensory exception enforcement, all-duplicates ending execution, or rendered duplicate visualization beyond current structured data and row text.
## 2026-06-13 - Booming Blade melee-hit and movement-trigger descriptions

### SSO-BOOMING-BLADE-DAMAGE-DESCRIPTION-001 - hit and delayed movement rows now expose separate runtime triggers

Status: verified.

Evidence added this pass:
- public/data/spells/level-0/booming-blade.json had two DAMAGE rows whose descriptions repeated casting-action prose and generic  scaling with level wording instead of cleanly separating the melee-hit row from the delayed willing-movement trigger row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a real-data proof that Booming Blade keeps the melee weapon hit row and willing-move Thunder trigger row distinct.
- The Booming Blade descriptions now name the melee weapon attack hit, booming-energy sheath duration, hit-scaling Thunder dice at character levels 5 / 11 / 17, willing movement of 5 feet or more before the caster's next turn, movement-trigger Thunder damage, spell ending, and movement-damage scaling while preserving triggers, targeting, material component, duration, damage dice fields, character-level scaling formulas, legacy flag, and tags.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Booming Blade still used casting-action wrapper prose and generic scaling wording.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 106 tests.
- npm run validate:spells -- --spell public/data/spells/level-0/booming-blade.json reported 459 valid / 0 invalid.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for melee weapon attack construction, spell-failure handling when no attack is made, hit detection, booming-energy state persistence, willing-movement detection, 5-foot movement threshold enforcement, start-of-next-turn expiry, spell-end cleanup, or character-level scaling execution beyond current structured data and row text.
## 2026-06-13 - Summon Lesser Demons utility description

### SSO-SUMMON-LESSER-DEMONS-UTILITY-DESCRIPTION-001 - summon table and hostile demon behavior now read as compact runtime text

Status: verified.

Evidence added this pass:
- public/data/spells/level-3/summon-lesser-demons.json had a single UTILITY description that copied long spell-card prose beginning  You utter foul words and buried the d6 summon table, placement, demon hostility, group initiative, nearest-non-demon behavior, and optional blood-circle protection in one wall of text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a real-data proof that Summon Lesser Demons keeps its one-row utility model focused on summon-table and hostile-demon behavior.
- The Summon Lesser Demons utility description now names the d6 table outcomes, GM demon choice, caster placement in visible unoccupied spaces within 60 feet, disappearance at 0 HP or spell end, hostility to every creature, group initiative, nearest-non-demon pursuit, and the optional blood circle that blocks crossing, harm, and targeting while consuming the material component at spell end.

Verification:
- Red run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Summon Lesser Demons still used long copied spell-card prose.
- Green run: npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 105 tests.
- npm run validate:spells -- --spell public/data/spells/level-3/summon-lesser-demons.json reported 459 valid / 0 invalid.
- npm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for random summon-count rolling, demon stat selection, demon placement UI, demon ownership/AI hostility, grouped initiative insertion, nearest-non-demon pursuit targeting, 0 HP cleanup, concentration cleanup, optional blood-circle placement, blood-circle collision/targeting protection, or material-component consumption beyond current structured data and row text.
## 2026-06-13 - Symbol glyph-trigger utility description

### SSO-SYMBOL-UTILITY-DESCRIPTION-001 - glyph wrapper row now exposes trigger cadence without importer routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/symbol.json had a UTILITY description that began  Records Symbol wrapper facts and routed the six Symbol payloads to sibling rows instead of focusing the wrapper row on glyph placement, trigger setup, and activation cadence.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a real-data proof that Symbol keeps its utility row focused on glyph trigger facts while preserving separate Death, Discord, Fear, Pain, Sleep, and Stunning payload rows.
- The Symbol utility description now names the nearly imperceptible glyph, surface or closable-object placement, 10-foot-diameter coverage, moved-object break condition, trigger refinement and exclusions, 60-foot-radius Dim Light activation sphere, 10-minute active window, activation / first-entry / end-turn cadence, and once-per-turn targeting limit while preserving targeting, spatial metadata, conditional endings, control options, consumed diamond component, duration, and all six payload rows.

Verification:
- Red run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Symbol still used Records Symbol wrapper facts and sibling-row routing wording.
- Green run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 104 tests.
- 
pm run validate:spells -- --spell public/data/spells/level-7/symbol.json reported 459 valid / 0 invalid.
- 
pm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for glyph placement, surface/object eligibility, object-movement break tracking, Perception discovery, trigger-condition UI, creature-type trigger filtering, password exclusions, activation timing, once-per-turn targeting suppression, Dim Light rendering, 10-minute expiry, or execution of Death, Discord, Fear, Pain, Sleep, and Stunning payloads beyond current structured data and row text.
## 2026-06-13 - Whirlwind vortex utility description

### SSO-WHIRLWIND-UTILITY-DESCRIPTION-001 - vortex wrapper row now avoids importer-facing routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/whirlwind.json had a UTILITY description that began  Records Whirlwind wrapper facts and routed major behavior to sibling rows instead of reading as player-facing vortex control text.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a real-data proof that Whirlwind keeps its utility row focused on visible vortex and object-suction facts while movement rows carry action movement, upward pull, spell-end falling, and escape hurling.
- The Whirlwind utility description now names the 10-foot-radius, 30-foot-high whirlwind, visible ground point within 300 feet, up-to-1-minute concentration duration, ground movement, unsecured Medium-or-smaller object suction, and preserved separate rows for creature damage, restraint, upward pull, falling, and escape hurling while preserving targeting, area metadata, damage row, status row, movement rows, control options, concentration duration, and tags.

Verification:
- Red run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Whirlwind still used Records Whirlwind wrapper facts and sibling-row routing wording.
- Green run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 103 tests.
- 
pm run validate:spells -- --spell public/data/spells/level-7/whirlwind.json reported 459 valid / 0 invalid.
- 
pm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cylinder placement, terrain-ground validation, object suction, once-per-turn entry/overlap damage suppression, Dexterity-save execution, Strength-save restraint execution, action-cost vortex movement, restrained-creature carry behavior, upward pull, fall damage, escape-check execution, random hurl distance/direction, concentration upkeep, or rendered vortex visualization beyond current structured data and row text.
## 2026-06-13 - Forcecage prison utility description

### SSO-FORCECAGE-UTILITY-DESCRIPTION-001 - hard-control wrapper row now avoids importer-facing routing language

Status: verified.

Evidence added this pass:
- public/data/spells/level-7/forcecage.json had a UTILITY description that began  Records Forcecage wrapper facts and ended by routing push-out behavior to a sibling movement row.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a real-data proof that Forcecage keeps its prison-control utility row player-facing while the MOVEMENT row carries the partial-or-too-large push-out text.
- The Forcecage utility description now names the invisible immobile magical-force prison, 20-foot barred cage form, 10-foot solid box form, trapped enclosed creatures, push-out for partial or too-large creatures, nonmagical exit block, Charisma-save teleport or interplanar escape gate, Ethereal travel block, and Dispel Magic immunity while preserving targeting, spatial form metadata, control options, movement row, consumed ruby-dust component, concentration duration, and spell tags.

Verification:
- Red run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed because Forcecage still used Records Forcecage wrapper facts and sibling-row routing wording.
- Green run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 102 tests.
- 
pm run validate:spells -- --spell public/data/spells/level-7/forcecage.json reported 459 valid / 0 invalid.
- 
pm run test:types passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cage-vs-box form choice UI, exact prison placement, enclosed-creature detection, partial-overlap push vector selection, too-large fit checks, matter/spell blocking, nonmagical exit enforcement, teleport/interplanar escape gating, Charisma-save execution, Ethereal Plane blocking, Dispel Magic immunity enforcement, concentration upkeep, or consumed-component accounting beyond current structured data and row text.
## 2026-06-13 - Gate portal utility description

### SSO-GATE-UTILITY-DESCRIPTION-001 - portal wrapper row now avoids importer-facing routing language

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/gate.json` had a `UTILITY` description that began "Records Gate wrapper facts" and ended by routing transport behavior to a sibling row.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Gate keeps its portal wrapper row player-facing while the sibling `MOVEMENT` row carries actual front-of-portal planar transport.
- The Gate utility description now names the visible 5-to-20-foot portal, chosen orientation, front/back travel rules, destination visibility, planar-ruler opening blocks, optional true-name creature pull, and lack of special control while preserving targeting, spatial metadata, control options, movement row, material cost, concentration duration, player-input prompt, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Gate still used "Records Gate wrapper facts" and sibling-row routing wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 101 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/gate.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for destination-plane choice UI, portal orientation, portal-front collision, planar-ruler vetoes, true-name matching, creature pull placement, transported-creature agency, concentration upkeep, or cross-plane teleport execution beyond current structured data and row text.

## 2026-06-13 - Invulnerability self-cast utility description

### SSO-INVULNERABILITY-UTILITY-DESCRIPTION-001 - self-cast wrapper row now avoids importer-facing wording

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/invulnerability.json` had a `UTILITY` description that began "Records Invulnerability wrapper facts," exposing importer-facing row-routing language.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Invulnerability keeps the self-only / concentration / consumed-component utility row player-facing while the sibling `DEFENSIVE` row carries all-damage immunity.
- The Invulnerability utility description now names self-only targeting, up-to-10-minute concentration, consumed 500 GP adamantine, and all-damage immunity routing while preserving the defensive immunity row, material cost and consumption metadata, concentration duration, targeting, control option, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Invulnerability still used "Records Invulnerability wrapper facts" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 100 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/invulnerability.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for consumed-component accounting, concentration upkeep, all-damage immunity enforcement, immunity UI rendering, or spell-end cleanup beyond current structured data and row text.

## 2026-06-13 - Evard's Black Tentacles damage and Restrained descriptions

### SSO-EVARDS-BLACK-TENTACLES-DAMAGE-STATUS-DESCRIPTION-001 - Strength-save rows now name damage, restraint, and escape outcomes

Status: verified.

Evidence added this pass:
- `public/data/spells/level-4/evards-black-tentacles.json` had a `DAMAGE` description that said "the data does not model reduced damage" and a `STATUS_CONDITION` description that said "modeled escape check," exposing importer-facing wording in two player/runtime rows.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Evard's Black Tentacles keeps its Strength-save damage row, Restrained row, and Difficult Terrain row distinct.
- The Evard's Black Tentacles descriptions now name the 20-foot square, Strength save, 3d6 Bludgeoning failed-save damage, no-damage success branch, Restrained condition, and action-cost spell-save-DC Strength (Athletics) escape check while preserving targeting, save metadata, damage dice, damage type, status payload, escape-check metadata, terrain row, concentration duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Evard's Black Tentacles still used "the data does not model" and "modeled escape check" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 99 tests.
- `npm run validate:spells -- --spell public/data/spells/level-4/evards-black-tentacles.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for once-per-turn area damage suppression, enters-area versus ends-turn-there scheduling, Strength-save execution, Restrained application, escape-check execution, Difficult Terrain rendering, concentration upkeep, or the top-level typo "ends it turn there" beyond current structured data and row text.

## 2026-06-13 - Otto's Irresistible Dance utility wrapper focus

### SSO-OTTOS-IRRESISTIBLE-DANCE-UTILITY-DESCRIPTION-001 - utility row no longer copies the full spell card

Status: verified.

Evidence added this pass:
- `public/data/spells/level-6/ottos-irresistible-dance.json` had a `UTILITY` description that copied the full spell-card behavior even though sibling rows already carry Charmed, movement lock, attack Disadvantage / attacker Advantage, and repeat-save behavior.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Otto's Irresistible Dance keeps its utility row focused on wrapper facts.
- The utility description now keeps visible target selection, comic-dance flavor, Charmed immunity, and sibling-row routing while preserving the Charmed status row, movement row, defensive row including its explicit runtime-gap note, utility control options, concentration duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Otto's Irresistible Dance still copied full spell-card prose in the utility row.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 98 tests.
- `npm run validate:spells -- --spell public/data/spells/level-6/ottos-irresistible-dance.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Charmed immunity checks, Wisdom-save execution, action-cost repeat saves, all-movement dance enforcement, Dexterity-save Disadvantage, attack Disadvantage, attacker Advantage, concentration upkeep, or the already-noted missing first-class attacker-advantage-against-target field.

## 2026-06-13 - Conjure Elemental Dexterity-save damage description

### SSO-CONJURE-ELEMENTAL-DAMAGE-DESCRIPTION-001 - elemental spirit damage row now names save outcomes

Status: verified.

Evidence added this pass:
- `public/data/spells/level-5/conjure-elemental.json` had a `DAMAGE` description that said "no reduced-success damage is modeled," exposing importer-facing save-branch wording.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Conjure Elemental keeps its elemental-spirit Dexterity-save damage row player-facing.
- The Conjure Elemental damage description now names the elemental spirit save, Dexterity save, 8d8 chosen-element failed-save damage, no-damage success branch, and +1d8 per slot level above 5th while preserving targeting, save metadata, variable damage type, recurring restrained-target damage metadata, slot scaling, concentration duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Conjure Elemental still used "no reduced-success damage is modeled" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 97 tests.
- `npm run validate:spells -- --spell public/data/spells/level-5/conjure-elemental.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for elemental choice UI, damage-type substitution, spirit placement, one-restrained-creature gating, entry/start-turn trigger scheduling, Restrained application, repeated start-turn saves, recurring 4d8 damage, success ending restraint, concentration upkeep, or slot-scaling execution beyond current structured data and row text.

## 2026-06-13 - Bones of the Earth Dexterity-save damage description

### SSO-BONES-OF-THE-EARTH-DAMAGE-DESCRIPTION-001 - blocked-pillar damage row now names failed and successful save branches

Status: verified.

Evidence added this pass:
- `public/data/spells/level-6/bones-of-the-earth.json` had a `DAMAGE` description that said "no reduced-success damage is modeled," exposing importer-facing save-branch wording.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Bones of the Earth keeps its blocked-pillar Dexterity-save damage row player-facing.
- The Bones of the Earth damage description now names the blocked pillar / obstacle context, creature on the pillar, Dexterity save, 6d6 Bludgeoning failed-save damage, and no-damage success branch while preserving targeting, pillar spatial metadata, save metadata, damage dice, damage type, higher-slot pillar-count scaling text, instantaneous duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Bones of the Earth still used "no reduced-success damage is modeled" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 96 tests.
- `npm run validate:spells -- --spell public/data/spells/level-6/bones-of-the-earth.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for pillar placement, up-to-six pillar selection, Medium-or-smaller creature targeting, lift choice, ceiling collision detection, Restrained application, escape-check execution, rubble terrain creation, rubble clearing, pillar hit points, or higher-slot pillar-count execution beyond current structured data and row text.

## 2026-06-13 - Ray of Frost speed-reduction rider description

### SSO-RAY-OF-FROST-MOVEMENT-DESCRIPTION-001 - speed rider row now names the penalty and duration

Status: verified.

Evidence added this pass:
- `public/data/spells/level-0/ray-of-frost.json` had a `MOVEMENT` description that said the target was affected "as modeled by the movement effect," exposing importer-facing wording instead of the slow rider.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Ray of Frost keeps its Cold damage row and same-hit Speed reduction row distinct.
- The Ray of Frost movement description now names the same ranged spell hit, 10-foot Speed reduction, and start-of-caster-next-turn duration while preserving targeting, hit condition, damage row, Cold damage dice, cantrip-tier scaling, movement payload, speed-change metadata, duration metadata, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Ray of Frost still used "as modeled by the movement effect" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 95 tests.
- `npm run validate:spells -- --spell public/data/spells/level-0/ray-of-frost.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack construction, hit detection, Speed mutation, start-of-next-turn expiry, cantrip-tier scaling execution, or movement-control UI rendering beyond current structured data and row text.

## 2026-06-13 - Divine Smite Fiend/Undead rider description

### SSO-DIVINE-SMITE-DAMAGE-DESCRIPTION-001 - extra Radiant rider row now names target family and payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/divine-smite.json` had a second `DAMAGE` description that said "Adds the modeled extra 1d8 Radiant damage rider," exposing importer-facing wording and hiding the Fiend/Undead target-family gate.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Divine Smite keeps its base Radiant damage row and Fiend/Undead extra Radiant rider row distinct.
- The Divine Smite rider description now names the melee hit, Fiend or Undead target gate, and additional 1d8 Radiant damage while preserving targeting, hit conditions, effect-level Fiend/Undead filter, base damage row, damage dice, Radiant damage type, +1d8 slot scaling on the base row, instantaneous duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Divine Smite still used "modeled extra 1d8 Radiant damage rider" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 94 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/divine-smite.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for smite arming, melee hit detection, combining base and Fiend/Undead rider damage, target-family taxonomy matching, slot-scaling caps, or resource/spell-slot consumption beyond current structured data and row text.

## 2026-06-13 - Searing Smite Ignited rider description

### SSO-SEARING-SMITE-STATUS-DESCRIPTION-001 - Ignited rider row now exposes the recurring burn loop

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/searing-smite.json` had a `STATUS_CONDITION` description that called the Ignited row "the modeled burning rider," hiding the start-turn Fire damage and Constitution-save ending loop.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Searing Smite keeps its first-hit Fire damage row and Ignited recurring-burn row distinct.
- The Searing Smite Ignited description now names the same melee weapon hit, Ignited condition, up-to-1-minute duration, start-turn 1d6 Fire damage, and Constitution save that ends the spell on success while preserving targeting, trigger type, first-hit consumption, melee weapon attack filter, damage row, recurring mechanics payload, status payload, duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Searing Smite still used "modeled burning rider" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 93 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/searing-smite.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for bonus-action smite arming, first-hit consumption, melee weapon hit detection, recurring start-turn damage scheduling, Constitution-save execution, spell ending, higher-slot all-damage scaling, or concentration/tag mismatch resolution beyond current structured data and row text.

## 2026-06-13 - Ray of Sickness Poisoned rider description

### SSO-RAY-OF-SICKNESS-STATUS-DESCRIPTION-001 - Poisoned rider row now avoids importer-facing hit wording

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/ray-of-sickness.json` had a `STATUS_CONDITION` description that said "On the same modeled hit," exposing importer-facing wording in a player/runtime row.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Ray of Sickness keeps its Poison damage row and same-hit Poisoned rider row distinct.
- The Ray of Sickness rider description now names the same ranged spell attack hit, Poisoned condition, and end-of-next-turn duration while preserving targeting, hit condition, damage row, damage dice, Poison damage type, +1d8 slot scaling, status payload, instantaneous duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Ray of Sickness still used "On the same modeled hit" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 92 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/ray-of-sickness.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack construction, hit detection, Poison damage application, Poisoned condition application, end-of-next-turn expiry, slot-scaling execution, or Poison immunity/resistance handling beyond current structured data and row text.

## 2026-06-13 - Color Spray Blinded status description

### SSO-COLOR-SPRAY-STATUS-DESCRIPTION-001 - Blinded row now avoids importer-facing repeat-save wording

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/color-spray.json` had a `STATUS_CONDITION` description that said the "modeled turn-end repeat save is the condition's escape path," exposing importer-facing wording in a player/runtime row.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Color Spray keeps its Constitution-save Blinded row player-facing.
- The Color Spray description now names the 15-foot Cone, Constitution save, Blinded condition, and end-of-next-turn duration while preserving targeting, save metadata, status payload, repeat-save metadata, material component, instantaneous duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Color Spray still used "modeled turn-end repeat save" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 91 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/color-spray.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cone targeting from self, per-creature Constitution-save execution, Blinded application, end-of-next-turn expiry, repeat-save scheduling, material presentation, or visibility/rendering behavior beyond current structured data and row text.

## 2026-06-13 - Grasping Vine hit damage and Grappled descriptions

### SSO-GRASPING-VINE-DAMAGE-STATUS-DESCRIPTION-001 - hit damage and Grappled rows now expose player-facing attack results

Status: verified.

Evidence added this pass:
- `public/data/spells/level-4/grasping-vine.json` had `DAMAGE` and `STATUS_CONDITION` descriptions that used importer-facing phrases: "hit-based vine effect" and "modeled escape check."
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Grasping Vine keeps its melee spell attack damage row, Grappled row, and forced-pull row distinct.
- The Grasping Vine descriptions now name the melee spell attack hit, 4d8 Bludgeoning damage, Huge-or-smaller Grappled gate, up-to-1-minute condition duration, action-cost spell-save-DC escape check, and existing 30-foot pull row while preserving targeting, trigger types, hit conditions, damage dice, damage type, status payload, escape-check metadata, forced movement metadata, concentration duration, higher-slot grapple scaling text, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Grasping Vine's damage and Grappled rows still used importer-facing "hit-based vine effect" / "modeled escape check" wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 90 tests.
- `npm run validate:spells -- --spell public/data/spells/level-4/grasping-vine.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for vine placement, surface eligibility, melee spell attack construction, Huge-or-smaller condition gating, one-creature grapple capacity, no-action release, later-turn Bonus Action repeat attacks, escape-check execution, forced pull pathing, concentration upkeep, or higher-slot grapple-count execution beyond current structured data and row text.

## 2026-06-13 - Incendiary Cloud damage-trigger description split

### SSO-INCENDIARY-CLOUD-DAMAGE-DESCRIPTION-001 - appearance, entry, and end-turn fire rows now name save outcomes

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/incendiary-cloud.json` had three `DAMAGE` descriptions for the cloud's appearance, movement / entry trigger, and end-turn trigger, but the rows either said only "for Fire damage" or "makes the save" without naming the 10d8 failed-save damage and half-success branch.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Incendiary Cloud keeps its wrapper row, three Fire damage trigger rows, and 10-foot cloud movement row distinct.
- The Incendiary Cloud damage rows now name the 20-foot cloud context, Dexterity save, 10d8 Fire failed-save damage, half damage on success, cloud-moves-into-space / creature-enters trigger, and end-turn trigger while preserving targeting, trigger types, damage dice, Fire damage type, Heavily Obscured wrapper facts, once-per-turn save note, start-turn movement row, concentration duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Incendiary Cloud's three damage rows omitted full save-outcome wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 89 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/incendiary-cloud.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Heavily Obscured rendering, strong-wind dispersal, once-per-turn damage suppression, cloud movement direction choice, movement collision detection, end-turn scheduling, Dexterity-save execution, or concentration upkeep beyond current structured data and row text.

## 2026-06-13 - Hunter's Mark weapon-rider and mark-transfer descriptions

### SSO-HUNTERS-MARK-DAMAGE-UTILITY-DESCRIPTION-001 - weapon damage rider and tracking utility rows now expose player-facing behavior

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/hunters-mark.json` had a `DAMAGE` description that used importer-facing "modeled tracking damage rider" wording, and its `UTILITY` description omitted the current mark-transfer conditional ending.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Hunter's Mark keeps its weapon-attack Force damage rider row and tracking / mark-transfer utility row distinct.
- The Hunter's Mark descriptions now name the marked target, weapon-attack hit trigger, 1d6 Force damage, Wisdom (Perception or Survival) Advantage, target dropping to 0 Hit Points, and Bonus Action mark transfer to a new visible creature within range while preserving targeting, duration, concentration, weapon attack filter, conditional ending, damage dice, damage type, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Hunter's Mark's damage row used "modeled tracking damage rider" wording and its utility row omitted mark transfer.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 88 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/hunters-mark.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for mark state tracking, weapon-attack source matching, tracking-check Advantage enforcement, mark transfer targeting, Bonus Action availability, visible-creature selection, or higher-slot concentration duration upgrades beyond current structured data and row text.

## 2026-06-13 - Hex damage-rider and curse-transfer descriptions

### SSO-HEX-DAMAGE-UTILITY-DESCRIPTION-001 - damage rider and curse utility rows now expose player-facing behavior

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/hex.json` had a `DAMAGE` description that used importer-facing "modeled curse damage rider" wording, and its `UTILITY` description omitted the current conditional-ending transfer behavior.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Hex keeps its Necrotic attack-hit rider row and chosen-ability disadvantage / curse-transfer utility row distinct.
- The Hex descriptions now name the cursed target, attack-roll hit trigger, 1d6 Necrotic damage, caster-chosen ability-check Disadvantage, target dropping to 0 Hit Points, and later-turn Bonus Action transfer while preserving targeting, duration, concentration, higher-level duration scaling, control options, conditional ending, damage dice, damage type, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Hex's damage row used "modeled curse damage rider" wording and its utility row omitted curse transfer.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 87 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/hex.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for curse state tracking, attack-hit source matching, chosen ability UI, ability-check disadvantage enforcement, curse transfer targeting, later-turn Bonus Action availability, or higher-slot concentration duration upgrades beyond current structured data and row text.

## 2026-06-13 - Witch Bolt initial/sustained damage description split

### SSO-WITCH-BOLT-DAMAGE-DESCRIPTION-001 - initial and sustained lightning rows now separate scaling and ending facts

Status: verified.

Evidence added this pass:
- `public/data/spells/level-1/witch-bolt.json` had an initial `DAMAGE` description that repeated slot-scaling prose already carried by structured scaling metadata, and a sustained `DAMAGE` description that omitted the modeled range and Total Cover ending conditions.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Witch Bolt keeps its initial ranged spell attack Lightning row and sustained later-turn automatic Lightning row distinct.
- The Witch Bolt descriptions now name the initial 2d12 Lightning ranged spell attack hit, sustained later-turn Bonus Action 1d12 automatic Lightning damage, current modeled "even if the first attack missed" behavior, and range / Total Cover endings while preserving targeting, damage dice, Lightning damage type, +1d12 initial-damage slot scaling, concentration duration, conditional endings, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Witch Bolt's initial row repeated scaling prose and its sustained row omitted ending conditions.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 86 tests.
- `npm run validate:spells -- --spell public/data/spells/level-1/witch-bolt.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It preserves the current data's unusual claim that later automatic damage can apply even if the first attack missed; it does not claim full runtime parity for hit-gated arc creation, automatic damage eligibility, range checks, Total Cover checks, concentration upkeep, or slot scaling execution beyond current structured data and row text.

## 2026-06-13 - Gust of Wind movement-utility description split

### SSO-GUST-OF-WIND-MOVEMENT-UTILITY-DESCRIPTION-001 - forced movement and wind utility rows now expose core line effects

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/gust-of-wind.json` had a compressed `MOVEMENT` description and a terse `UTILITY` description even though the current data carries a 60-foot by 10-foot Line, Strength-save 15-foot forced movement, gas / vapor dispersal, unprotected flame extinguishing, protected flame disturbance, and a granted later-turn direction-change Bonus Action.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Gust of Wind keeps its forced movement row and environmental wind / direction-change utility row distinct.
- The Gust of Wind descriptions now name the Line dimensions, Strength save, 15-foot push away from the caster along the Line, gas and vapor dispersal, candle / unprotected flame extinguishing, protected-flame 50 percent extinguish chance, and later-turn Bonus Action direction change while preserving existing targeting, trigger model, forcedMovement metadata, duration, concentration, granted action, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Gust of Wind's movement and utility descriptions compressed or omitted key Line behavior.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 85 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/gust-of-wind.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for initial-entry versus start/end-turn timing, line direction UI, approach-cost movement tax, gas/vapor classification, flame protection checks, 50 percent protected-flame rolls, or actual Bonus Action direction-change execution beyond current structured data and row text.

## 2026-06-13 - Flaming Sphere damage-description split

### SSO-FLAMING-SPHERE-DAMAGE-DESCRIPTION-001 - heat and movement rows now name Dexterity-save Fire damage

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/flaming-sphere.json` had two `DAMAGE` descriptions with unclear save/damage phrasing: the end-turn row said creatures take damage "on a Dexterity save," and the movement row said only "makes the save" without naming the 2d6 Fire damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Flaming Sphere keeps its end-turn heat damage row, bonus-action movement collision damage row, and movement utility wrapper distinct.
- The Flaming Sphere damage descriptions now name the 5-foot heat radius, Dexterity save, 2d6 Fire failed-save damage, half damage on success, 30-foot Bonus Action movement, creature-space collision save, and sphere stopping for the turn while preserving existing targeting, area details, damage dice, Fire damage type, +1d6 slot scaling, granted action, light metadata, concentration duration, and utility movement row.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Flaming Sphere's two damage rows had unclear save/damage branch wording.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 84 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/flaming-sphere.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for unoccupied ground placement, 30-foot rolling pathing, stopping on creature-space collision, barrier and pit movement, flammable-object ignition, light emission, Dexterity-save resolution, or +1d6 slot scaling beyond current structured data and row text.

## 2026-06-13 - Storm Sphere Strength-save description split

### SSO-STORM-SPHERE-DAMAGE-DESCRIPTION-001 - Strength-save rows now name failed-save Bludgeoning damage

Status: verified.

Evidence added this pass:
- `public/data/spells/level-4/storm-sphere.json` had two `DAMAGE` descriptions that named the Strength save and no-damage success branch but omitted the 2d6 Bludgeoning failed-save damage from the immediate sphere-appearance row and the end-turn-in-area row.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Storm Sphere keeps its immediate Strength-save row, end-turn Strength-save row, lightning attack row, difficult terrain row, and listening-disadvantage row distinct.
- The Storm Sphere Strength-save descriptions now name 2d6 Bludgeoning failed-save damage and no damage on success while preserving targeting, 20-foot-radius sphere, Strength save metadata, Bludgeoning damage type, +1d6 slot scaling, lightning attack row, terrain row, utility row, concentration duration, and tags.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Storm Sphere's first two Strength-save rows omitted the failed-save 2d6 Bludgeoning damage.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 83 tests.
- `npm run validate:spells -- --spell public/data/spells/level-4/storm-sphere.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for sphere placement, per-creature Strength-save resolution, difficult-terrain movement costs, lightning attack targeting from the sphere center, advantage checks for targets inside the sphere, listening-disadvantage enforcement, concentration upkeep, or +1d6 scaling across all effects beyond current structured data and row text.

## 2026-06-13 - Phantasmal Killer initial-save description focus

### SSO-PHANTASMAL-KILLER-DAMAGE-DESCRIPTION-001 - initial Wisdom-save row now describes failed and successful branches

Status: verified.

Evidence added this pass:
- `public/data/spells/level-4/phantasmal-killer.json` had a note-like initial `DAMAGE` description even though the row is structured as a Wisdom save with 4d10 Psychic damage, half damage on success, spell ending on success, and a failed-save disadvantage rider.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Phantasmal Killer keeps its initial Wisdom-save row and repeated end-turn Wisdom-save row distinct.
- The Phantasmal Killer initial row now names the initial Wisdom save, 4d10 Psychic failed-save damage, disadvantage rider, half damage on success, and spell ending on success while preserving the repeat-save row, damage dice, Psychic damage type, +1d10 slot scaling, concentration duration, and conditional ending metadata.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the initial Phantasmal Killer row still used "Initial Wisdom save" note wording and omitted the 4d10 value.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 82 tests.
- `npm run validate:spells -- --spell public/data/spells/level-4/phantasmal-killer.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for nightmare illusion rendering, disadvantage-rider execution, concentration upkeep, repeated end-turn Wisdom-save scheduling, spell ending on successful saves, or applying +1d10 scaling to both damage rows beyond current structured data and row text.

## 2026-06-13 - Vitriolic Sphere damage-description split

### SSO-VITRIOLIC-SPHERE-DAMAGE-DESCRIPTION-001 - acid burst rows now separate save and delayed failed-save damage

Status: verified.

Evidence added this pass:
- `public/data/spells/level-4/vitriolic-sphere.json` had a scaffold-like immediate `DAMAGE` description that bundled the Dexterity save, initial Acid damage, and slot scaling into one row, while the delayed damage row used a slightly redundant "another 5d4" phrasing.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Vitriolic Sphere keeps its immediate Dexterity-save Acid burst row and failed-save delayed Acid row distinct.
- The Vitriolic Sphere descriptions now name the 20-foot-radius acid explosion, Dexterity save, 10d4 Acid failed-save damage, half damage on success, and 5d4 Acid delayed damage at the end of the failed target's next turn while preserving targeting, spatial details, damage dice, Acid damage type, save metadata, instantaneous duration, and +2d4 initial-damage slot scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Vitriolic Sphere still used the old scaffold-like immediate explosion text and redundant delayed damage text.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 81 tests.
- `npm run validate:spells -- --spell public/data/spells/level-4/vitriolic-sphere.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for acid projectile travel, area placement, per-creature Dexterity save resolution, half-damage application, failed-save-only delayed scheduling, end-of-next-turn timing, or applying +2d4 slot scaling only to the initial damage beyond current structured data and row text.

## 2026-06-13 - Melf's Acid Arrow damage-description split

### SSO-MELFS-ACID-ARROW-DAMAGE-DESCRIPTION-001 - acid rows now describe hit, miss, and delayed damage branches

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/melfs-acid-arrow.json` had two scaffold-like `DAMAGE` descriptions even though the first row is the immediate ranged spell attack damage with hit / miss branching, and the second row is the hit-only delayed end-of-next-turn Acid damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Melf's Acid Arrow keeps its initial hit/miss damage row and delayed damage row distinct.
- The Melf's Acid Arrow descriptions now name the ranged spell attack, 4d4 Acid hit damage, half initial Acid damage on a miss, no delayed damage on a miss, and 2d4 Acid damage at the end of the target's next turn on a hit while preserving existing targeting, damage dice, Acid damage type, +1d4 slot scaling for both rows, and instantaneous duration.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the two Melf's Acid Arrow damage descriptions still read like scaffold notes.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 80 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/melfs-acid-arrow.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ranged spell attack roll construction, miss half-damage application, suppressing delayed damage on a miss, end-of-next-turn scheduling, or applying the +1d4 slot scaling to both initial and later damage beyond the current structured data and row text.

## 2026-06-13 - Spiritual Weapon damage-description split

### SSO-SPIRITUAL-WEAPON-DAMAGE-DESCRIPTION-001 - weapon attack rows now describe initial and later-turn attacks

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/spiritual-weapon.json` had two terse `DAMAGE` descriptions even though the first row is the immediate melee spell attack when the spectral weapon appears, and the second row is the later-turn repeated melee spell attack after moving the weapon.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Spiritual Weapon keeps its initial attack, later-turn attack, and movement utility wrapper rows distinct.
- The Spiritual Weapon damage descriptions now name the spectral weapon, immediate melee spell attack, 5-foot reach from the weapon, 1d8 plus spellcasting modifier Force damage on a hit, later-turn granted Bonus Action, 20-foot movement, and repeated melee spell attack while preserving existing targeting, damage dice, Force damage type, custom slot scaling, utility row, and granted-action metadata.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Spiritual Weapon's two damage rows still used terse scaffold text for the initial and later-turn attacks.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 79 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/spiritual-weapon.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for spectral-weapon placement, weapon-shape choice, non-creature space targeting, melee spell attack roll construction, concentration/duration tracking, later-turn Bonus Action availability, 20-foot movement pathing, 5-foot adjacency after movement, or every-slot 1d8 scaling step beyond current structured data and row text.

## 2026-06-13 - Heat Metal damage-description split

### SSO-HEAT-METAL-DAMAGE-DESCRIPTION-001 - damage rows now describe initial and repeat heating triggers

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/heat-metal.json` had two note-like `DAMAGE` descriptions even though the first row is immediate 2d8 Fire damage from contact with the heated metal object, and the second row is the granted later-turn Bonus Action repeat damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Heat Metal keeps its initial damage, repeated damage, and drop/disadvantage rider rows distinct.
- The Heat Metal damage descriptions now name physical contact with the red-hot metal object, 2d8 Fire damage, cast-time timing, later-turn Bonus Action repeat timing, and within-range prerequisite while preserving existing dice, Fire damage type, +1d8 slot scaling, targeting, concentration, utility control row, granted action metadata, and save/disadvantage text.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Heat Metal's two damage rows still used importer-like "Initial heating" and "Bonus Action on later turns" notes.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 78 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/heat-metal.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for manufactured-metal object eligibility, metal armor / weapon examples, physical-contact detection, object range tracking after casting, recurring Bonus Action availability, Constitution save resolution, forced drop inventory mutation, or attack-roll / ability-check Disadvantage application beyond the current structured data and row text.

## 2026-06-13 - Warding Bond defensive-description split

### SSO-WARDING-BOND-DEFENSIVE-DESCRIPTION-001 - generic defensive bond rows now name AC and resistance payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/warding-bond.json` had two generic `DEFENSIVE` descriptions even though the first row is structured as `defenseType: "ac_bonus"` with `value: 1`, and the second row is structured as `defenseType: "resistance"` with `damageType: ["All"]`.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Warding Bond keeps the +1 AC row, all-damage Resistance row, and shared-damage utility row distinct.
- The Warding Bond defensive descriptions now name the willing touched target, +1 AC, all-damage Resistance, 1-hour duration, 60-foot link requirement, and existing shared-damage row while preserving the current targeting, material component, duration, defensive payloads, linked-damage metadata, and conditional endings.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because Warding Bond's first two defensive rows still said only "defensive bond effect" and did not name AC or Resistance.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 77 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/warding-bond.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for enforcing worn platinum rings, saving throw bonus application, caster-target distance updates, post-mitigation linked damage routing, spell recast cleanup on either connected creature, or ending on either creature dropping to 0 Hit Points beyond the existing structured data.

## 2026-06-13 - Cloud of Daggers damage-description split

### SSO-CLOUD-OF-DAGGERS-DAMAGE-DESCRIPTION-001 - duplicate area-damage rows now describe distinct triggers

Status: verified.

Evidence added this pass:
- `public/data/spells/level-2/cloud-of-daggers.json` had two later `DAMAGE` rows with identical descriptions even though their structured triggers are different: one is `on_enter_area` with first-per-turn frequency, and the other is `on_end_turn_in_area`.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Cloud of Daggers keeps cast-time, enter / moved-into-space, and end-turn damage descriptions distinct.
- The Cloud of Daggers damage descriptions now preserve the existing 4d4 Slashing damage, +2d4 slot scaling, 5-foot Cube, concentration duration, and trigger split while making each runtime/UI row readable without changing dice, targeting, saves, duration, or scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the second and third Cloud of Daggers damage rows still shared the same combined trigger sentence.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 76 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/cloud-of-daggers.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for teleporting the Cube up to 30 feet with a later Magic action, enforcing the once-per-turn damage cap across all Cloud of Daggers trigger rows, or resolving how the movement of the Cube should be represented beyond the current `on_enter_area` row text and existing structured trigger.

## 2026-06-13 - Simulacrum utility-description focus

### SSO-SIMULACRUM-UTILITY-DESCRIPTION-001 - copy-lifecycle utility wrapper now points to sibling summoning and repair rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/simulacrum.json` had a copied `UTILITY` row even though separate `SUMMONING` and `HEALING` rows already carry Construct-copy statistics / half Hit Point maximum and the 100 GP per Hit Point Long Rest repair mechanic.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Simulacrum keeps the utility row focused on casting setup, copy limits, lifecycle, and recast-destruction wrapper facts instead of repeating full spell card prose.
- The Simulacrum utility description now names the 12-hour casting, consumed 1,500+ GP powdered ruby, Beast or Humanoid remaining within 10 feet, same-size ice or snow pile, friendly commanded simulacrum acting on the caster turn, cannot-cast-Simulacrum limit, no level gain, no Short or Long Rests, 0-Hit-Point snow reversion / melting, and instant destruction of any existing simulacrum from recasting while preserving existing summoning row, repair healing row, target filters, control options, material cost / consumption, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Simulacrum utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 75 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/simulacrum.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 12-hour casting proximity checks, same-size ice or snow validation, stat-block copying, Construct conversion, half-Hit-Point maximum calculation, command routing, shared-turn scheduling, spellcasting prohibition, level-gain prevention, rest prevention, repair during caster Long Rest, repair component accounting, 5-foot repair proximity, 0-Hit-Point snow reversion, melt cleanup, or prior-simulacrum destruction beyond current structured data and control options.

## 2026-06-13 - Sequester utility-description focus

### SSO-SEQUESTER-UTILITY-DESCRIPTION-001 - hidden-suspension utility wrapper now points to sibling status rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/sequester.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION` rows already carry the target's Invisible state and creature Unconscious suspended-animation state.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Sequester keeps the utility row focused on divination / magic detection shielding, no-aging / no-needs, early-ending, damage-ending, and consumed-component wrapper facts instead of repeating full spell card prose.
- The Sequester utility description now names touch, consumed 5,000+ GP gem dust, one object or willing creature, until-dispelled duration, Divination targeting block, magic detection block, remote magical viewing block, creature no-aging / no food / no water / no air facts, caster-chosen early end condition within 1 mile, and target-damage ending while preserving existing status rows, control options, targeting, material cost / consumption, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Sequester utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 74 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/sequester.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for willing-creature confirmation, object eligibility, consumed gem-dust accounting, Invisible enforcement, Divination targeting block, magic detection block, remote magical viewing block, suspended-animation lifecycle, no-aging clock, no food / water / air needs, arbitrary early-end condition authoring, 1-mile condition visibility checks, target-damage ending, or wake/restore ordering beyond current structured data and control options.

## 2026-06-13 - Regenerate utility-description focus

### SSO-REGENERATE-UTILITY-DESCRIPTION-001 - body-regrowth utility wrapper now points to sibling healing rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/regenerate.json` had a copied `UTILITY` row even though separate `HEALING` rows already carry the immediate 4d8 + 15 Hit Point restoration and the recurring 1 Hit Point start-turn recovery.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Regenerate keeps the utility row focused on severed-body-part regrowth wrapper facts instead of repeating healing payloads.
- The Regenerate utility description now names the touched creature, 1-hour prayer-wheel transmutation, and severed body parts regrowing after 2 minutes while preserving existing healing rows, control options, targeting, material component, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Regenerate utility row still repeated the healing rows.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 73 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/regenerate.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for severed-body-part state tracking, 2-minute regrowth scheduling, body-part attachment versus regrowth choices, prayer-wheel material presentation, immediate healing application, recurring start-turn healing scheduling, duration expiration, or healing-over-time interaction ordering beyond current structured data and control options.

## 2026-06-13 - Project Image utility-description focus

### SSO-PROJECT-IMAGE-UTILITY-DESCRIPTION-001 - illusion-projection utility wrapper now points to sibling image-movement row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/project-image.json` had a copied `UTILITY` row even though a separate `MOVEMENT` row already carries Magic-action 60-foot image movement and behavior control.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Project Image keeps the utility row focused on illusion placement, sensing, intangibility, reveal, Study check, and discerned-image facts instead of repeating full spell card prose.
- The Project Image utility description now names the 5+ GP self-statuette, 1-day concentration, previously seen location within 500 miles, obstacle-ignoring placement, caster-like appearance and sound, intangibility, damage-ending behavior, remote sight and hearing, perfect mannerism mimicry, physical-interaction reveal, Study / Intelligence (Investigation) identification against spell save DC, and see-through / hollow-sound discerned state while preserving existing movement row, control options, targeting, material cost, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Project Image utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 72 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/project-image.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for prior-location memory validation, 500-mile placement lookup, obstacle-ignoring projection, duplicate appearance/audio rendering, image damage hooks, concentration ending, remote senses, Magic-action behavior orchestration, mannerism mimicry, physical-interaction reveal, Study action resolution, per-creature discerned state, see-through rendering, or hollow-sound audio treatment beyond current structured data and control options.

## 2026-06-13 - Plane Shift utility-description focus

### SSO-PLANE-SHIFT-UTILITY-DESCRIPTION-001 - planar-destination utility wrapper now points to sibling movement row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/plane-shift.json` had a copied `UTILITY` row even though a separate `MOVEMENT` row already carries actual different-plane teleport movement for the current willing-travel data.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Plane Shift keeps the utility row focused on attuned-rod, linked-circle, destination, known-circle, and spillover wrapper facts instead of repeating the transport row.
- The Plane Shift utility description now names the 250+ GP forked metal rod attuned to a plane, caster plus up to eight willing creatures linking hands in a circle, general different-plane destination with DM-determined near arrival, known sigil sequence to a teleportation circle on another plane, and too-small-circle spillover to closest unoccupied spaces while preserving existing movement row, control options, targeting, material cost, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Plane Shift utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 71 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/plane-shift.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup over the current willing-travel data. It does not claim full runtime parity for planar rod attunement validation, linked-hand formation checks, willing-creature confirmation, general-destination adjudication, known-circle sigil matching, too-small-circle spillover placement, cross-plane destination lookup, arrival collision handling, or any hostile Plane Shift branch not present in the current spell JSON / top-level description.

## 2026-06-13 - Mordenkainen's Magnificent Mansion utility-description focus

### SSO-MORDENKAINENS-MAGNIFICENT-MANSION-UTILITY-DESCRIPTION-001 - extradimensional dwelling utility wrapper now points to sibling servant and expulsion rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/mordenkainens-magnificent-mansion.json` had a copied `UTILITY` row even though separate `MOVEMENT` and `SUMMONING` rows already carry end-of-spell expulsion and the 100 near-transparent servants.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Mordenkainen's Magnificent Mansion keeps the utility row focused on door, access, dwelling, food, and object-export wrapper facts instead of repeating full spell card prose.
- The Mansion utility description now names the 5-foot-wide / 10-foot-tall shimmering door, 300-foot range, 24-hour duration, clean / fresh / warm extradimensional dwelling, designated entrant access, no-action open/close within 30 feet, imperceptible closed door, up to 50 contiguous 10-foot cubes, caster-chosen furnishing and decoration, nine-course banquet for up to 100 people, and created-object smoke dissipation while preserving existing movement row, summoning row, control options, targeting, spatial details, material cost, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Mansion utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 70 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/mordenkainens-magnificent-mansion.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for extradimensional-space creation, door visibility / open / close state, designated entrant access, 30-foot caster proximity checks, floor-plan layout, contiguous cube validation, furnishing or decoration UI, banquet inventory, created-object smoke dissipation, servant command routing, servant invulnerability, servant harm restrictions, servant dwelling lock-in, end-of-spell expulsion placement, or object / creature handling inside the mansion beyond current structured data and control options.

## 2026-06-13 - Mighty Fortress utility-description focus

### SSO-MIGHTY-FORTRESS-UTILITY-DESCRIPTION-001 - fortress utility wrapper now points to sibling servant-summoning row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/mighty-fortress.json` had a copied `UTILITY` row even though a separate `SUMMONING` row already carries the one hundred invisible servants.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Mighty Fortress keeps the utility row focused on fortress footprint, layout, durability, food/object, teardown, and permanence rules instead of repeating full spell card prose.
- The Mighty Fortress utility description now names the consumed 500 GP diamond, visible 120-foot-square structure-free ground within 1 mile, harmless creature lift, four 20-foot-square 30-foot-tall turrets, 80-foot wall runs, 10-foot by 20-foot panels, up to four outer stone doors, 50-foot-square three-floor keep, 10-foot ceilings, 6-inch keep walls, 5-foot minimum rooms, stairs, doors or archways, furnishings, decoration, daily nine-course food for up to 100 people, removed-object crumbling, stone-section AC / Hit Points / Poison and Psychic immunity, collapse risk, safe crumble after 7 days or recasting elsewhere, and once-every-7-days same-spot year-long permanence while preserving existing summoning row, spatial details, measured details, control options, targeting, material cost / consumption, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Mighty Fortress utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 69 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/mighty-fortress.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ground structure-exclusion validation, creature lift placement, full fortress geometry construction, turret/wall/panel adjacency, door placement UI, keep room layout, stair/archway choices, furnishing and food lifecycle, removed-object crumbling, invisible-servant command routing, stone section hit point tracking, immunity enforcement, connected-section collapse adjudication, safe seven-day teardown, recast-elsewhere teardown, or same-spot yearly permanence tracking beyond current structured data and control options.

## 2026-06-13 - Magic Jar utility-description focus

### SSO-MAGIC-JAR-UTILITY-DESCRIPTION-001 - soul-container utility wrapper now points to sibling incapacitation and movement-lock rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-6/magic-jar.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION` and `MOVEMENT` rows already carry the trapped soul's Incapacitated state and caster-container movement / reaction suppression.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Magic Jar keeps the utility row focused on soul-container, possession, host-stat, death-return, and cleanup routing instead of repeating full spell card prose.
- The Magic Jar utility description now names the 500+ GP container, caster-body catatonia, container perception, 100-foot projection, return-to-body or visible-Humanoid possession attempt, Protection from Evil and Good / Magic Circle ward exclusions, target Charisma save, failed-save host possession and host-soul trapping, 24-hour repeat-attempt lockout on success, host-stat replacement fields, Magic-action return to nearby container, host-death caster save, container-destruction and spell-ending soul return / death conditions, and spell-end container destruction while preserving existing status row, movement row, control options, material cost, duration, end cleanup, targeting, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Magic Jar utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 68 tests.
- `npm run validate:spells -- --spell public/data/spells/level-6/magic-jar.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for container object tracking, caster-body catatonia state, soul-location state, perception origin switching, reaction suppression beyond the existing movement-row note, Humanoid eligibility, ward detection, possession Charisma save branching, repeat-attempt lockout persistence, host-stat replacement, host-control action routing, host-soul container perspective, Magic-action return, host-death save handling, caster-body distance/death checks, container destruction routing, stranded-soul death handling, spell-ending cleanup, or material-container destruction beyond current structured data and control options.

## 2026-06-13 - Temple of the Gods utility-description focus

### SSO-TEMPLE-OF-THE-GODS-UTILITY-DESCRIPTION-001 - sanctuary utility wrapper now points to sibling entry, penalty, and healing rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/temple-of-the-gods.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION`, `ATTACK_ROLL_MODIFIER`, and `HEALING` rows already carry opposed-creature entry denial, opposed-creature d4 penalties, and spell-healing bonus mechanics.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Temple of the Gods keeps the utility row focused on sanctuary-shell wrapper facts instead of repeating full spell card prose.
- The Temple of the Gods utility description now names the 1-hour casting, visible ground within 120 feet, unoccupied 120-foot cube footprint, dedication and appearance choices, floor / walls / roof / door / windows / idol-or-altar interior, illumination / incense / mild temperature, opaque magical-force shell, Ethereal travel and physical passage blocking, divination sensor and targeting blocks, Dispel Magic and Antimagic Field immunity, Disintegrate destruction, and year-long same-spot permanence while preserving existing entry-denial row, d4 penalty row, healing row, control options, targeting, spatial form, material cost, duration, duration progression, and conditional ending data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Temple of the Gods utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 67 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/temple-of-the-gods.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for temple placement validation, unoccupied 120-foot cube fitting, deity / pantheon / philosophy dedication UI, appearance configuration, door permission state, window/light/interior rendering, opposed-creature type selection, entry-denial persistence, d4 penalty application to all affected d20 rolls, divination sensor blocking, divination target blocking, healing-bonus source filtering, opaque magical-force collision, Ethereal travel blocking, physical passage blocking, Dispel Magic immunity, Antimagic Field immunity, Disintegrate teardown, or daily same-spot permanence tracking beyond current structured data and control options.

## 2026-06-13 - Teleport utility-description focus

### SSO-TELEPORT-UTILITY-DESCRIPTION-001 - outcome-table utility wrapper now points to sibling movement and mishap rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/teleport.json` had a copied `UTILITY` row even though separate `MOVEMENT` and `DAMAGE` rows already carry actual same-plane teleport movement and Mishap 3d10 Force damage with reroll.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Teleport keeps the utility row focused on target eligibility and outcome-table wrapper facts instead of repeating full spell card prose.
- The Teleport utility description now names caster plus up to eight willing visible creatures within 10 feet, one visible Large-or-smaller object not held or carried by an unwilling creature, known same-plane destination, d100 familiarity table routing, Permanent Circle and Linked Object on-target shortcuts, Very Familiar / Seen Casually / Viewed Once or Described / False Destination rows, and Similar Area / Off Target / On Target routing while preserving existing movement row, Mishap damage row, control options, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Teleport utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 66 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/teleport.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for willingness enforcement, object carried-by-unwilling checks, known-destination validation, same-plane validation, familiarity classification, d100 table lookup, Permanent Circle or Linked Object automatic success, Similar Area selection, Off Target 2d12-mile and d8-direction placement, On Target placement, Mishap reroll loops, or multi-target arrival collision handling beyond current structured data and control options.

## 2026-06-13 - Whirlwind utility-description focus

### SSO-WHIRLWIND-UTILITY-DESCRIPTION-001 - vortex utility wrapper now points to sibling damage, restraint, movement, fall, and escape rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/whirlwind.json` had a copied `UTILITY` row even though separate `DAMAGE`, `STATUS_CONDITION`, and `MOVEMENT` rows already carry entry/overlap damage, Large-or-smaller restraint, caster-directed ground movement, start-turn upward pull, spell-end falling, and escape-hurl behavior.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Whirlwind keeps the utility row focused on visible ground-point vortex and loose-object wrapper facts instead of repeating every mechanical row.
- The Whirlwind utility description now names the 10-foot-radius, 30-foot-high cylinder, visible ground point within 300 feet, 1-minute concentration duration, and Medium-or-smaller unsecured object pickup while preserving existing damage row, status row, movement rows, control options, targeting, material component, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Whirlwind utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 65 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/whirlwind.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for persistent vortex collision, once-per-turn entry/overlap gating, Dexterity-save damage scheduling, Large-or-smaller size filtering, Strength-save restraint branching, carried-creature movement, caster-directed ground movement, 5-foot vertical lift, top-of-cylinder ceiling behavior, spell-end fall handling, escape action checks, random hurl distance/direction, loose-object pickup, or falling-damage integration beyond current structured data and control options.

## 2026-06-13 - Forcecage utility-description focus

### SSO-FORCECAGE-UTILITY-DESCRIPTION-001 - containment utility wrapper now points to sibling push-out row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/forcecage.json` had a copied `UTILITY` row even though a separate `MOVEMENT` row already carries partial-or-too-large creature push-out.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Forcecage keeps the utility row focused on containment wrapper facts instead of repeating full spell card prose.
- The Forcecage utility description now names invisible immobile cube-shaped magical-force prison creation within 100 feet, cage and solid-box forms, half-inch cage bars and spacing, matter/spell blocking for the solid box, trapped completely enclosed creatures, blocked nonmagical exit, Charisma save for teleportation or interplanar escape, wasted escape effect on failure, Ethereal Plane extension, and Dispel Magic immunity while preserving existing movement row, spatial forms, measured bar details, control options, targeting, material cost / consumption, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Forcecage utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 64 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/forcecage.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for cage/box geometry, invisible barrier rendering, partial-containment collision, too-large fit checks, nonmagical exit blocking, teleport/interplanar Charisma save gating, wasted escape effects, Ethereal Plane travel blocking, spell-line blocking, Dispel Magic immunity, or material-consumption enforcement beyond current structured data and control options.

## 2026-06-13 - Mind Blank utility-description focus

### SSO-MIND-BLANK-UTILITY-DESCRIPTION-001 - mental-shield utility wrapper now points to sibling immunity row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/mind-blank.json` had a copied `UTILITY` row even though a separate `DEFENSIVE` row already carries Psychic damage and Charmed condition immunity.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Mind Blank keeps the utility row focused on mental-shield wrapper facts instead of repeating full spell card prose.
- The Mind Blank utility description now names the willing touched creature, 24-hour shield, emotion and alignment sensing block, thought-reading block, magical location detection block, information-gathering block, remote observation block, and mind-control block including Wish while preserving existing defensive row, control options, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Mind Blank utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 63 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/mind-blank.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for psychic immunity enforcement, Charmed immunity enforcement, emotion/alignment sensing blockers, thought-reading blockers, location detection blockers, remote observation blockers, information-gathering blockers, Wish-specific override handling, or mind-control prevention beyond current structured data and control options.

## 2026-06-13 - Animal Shapes utility-description focus

### SSO-ANIMAL-SHAPES-UTILITY-DESCRIPTION-001 - transformation utility wrapper now points to sibling temporary-HP row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/animal-shapes.json` had a copied `UTILITY` row even though a separate `HEALING` row already carries first-form Temporary Hit Points.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Animal Shapes keeps the utility row focused on transformation wrapper facts instead of repeating full spell card prose.
- The Animal Shapes utility description now names any-number willing visible targets within 30 feet, Large-or-smaller Beast forms with Challenge Rating 4 or lower, different forms per target, later Magic-action re-transforms, retained identity/stat facts, no spellcasting, Beast anatomy limits, equipment merging, and Bonus Action ending while preserving existing healing row, granted Magic action, control options, unlimited target sentinel, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Animal Shapes utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 62 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/animal-shapes.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Beast-form lookup, CR filtering, per-target form choice, repeated Magic-action re-transform orchestration, retained-stat merging, anatomy action limits, spellcasting suppression, equipment merging, Bonus Action self-ending, or temporary-HP lifecycle beyond current structured data and control options.

## 2026-06-13 - Maddening Darkness utility-description focus

### SSO-MADDENING-DARKNESS-UTILITY-DESCRIPTION-001 - darkness-zone utility wrapper now points to sibling Psychic damage row

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/maddening-darkness.json` had a copied `UTILITY` row even though a separate `DAMAGE` row already carries start-turn Wisdom saves and 8d8 Psychic damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Maddening Darkness keeps the utility row focused on darkness-zone wrapper facts instead of repeating full spell card prose.
- The Maddening Darkness utility description now names the visible point within 150 feet, 60-foot-radius sphere, 10-minute concentration, darkness spreading around corners, darkvision blocking, nonmagical and 8th-level-or-lower spell light suppression, and audible shrieks / gibbering / mad laughter while preserving existing damage row, control options, targeting, material component, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Maddening Darkness utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 61 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/maddening-darkness.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for magical darkness rendering, around-corner fill, darkvision blocking, light-source suppression by spell level, audible zone presentation, start-turn scheduling, or Psychic damage application beyond current structured data and control options.

## 2026-06-13 - Holy Aura utility-description focus

### SSO-HOLY-AURA-UTILITY-DESCRIPTION-001 - aura-selection utility wrapper now points to sibling defensive, attack, and status rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/holy-aura.json` had a copied `UTILITY` row even though separate `DEFENSIVE`, `ATTACK_ROLL_MODIFIER`, and `STATUS_CONDITION` rows already carry saving throw advantage, incoming attack-roll disadvantage, and Fiend / Undead Blinded retaliation.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Holy Aura keeps the utility row focused on aura-selection wrapper facts instead of repeating full spell card prose.
- The Holy Aura utility description now names the 30-foot self-centered Emanation, 1-minute concentration, caster-chosen affected creatures, and Fiend / Undead melee-hit retaliation routing while preserving existing defensive row, attack modifier row, status row, creature filter, control options, targeting, material cost, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Holy Aura utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 60 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/holy-aura.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for aura membership selection, moving Emanation updates, chosen-creature persistence, saving throw advantage coverage, incoming attack disadvantage targeting, Fiend / Undead melee-hit detection, Blinded duration timing, or retaliation save scheduling beyond current structured data and control options.

## 2026-06-13 - Tsunami utility-description focus

### SSO-TSUNAMI-UTILITY-DESCRIPTION-001 - water-wall utility wrapper now points to sibling damage and movement rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/tsunami.json` had a copied `UTILITY` row even though separate `DAMAGE` and `MOVEMENT` rows already carry initial 6d10 damage, ongoing Huge-or-smaller 5d10 damage, and forced wall movement.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Tsunami keeps the utility row focused on water-wall wrapper facts instead of repeating full spell card prose.
- The Tsunami utility description now names the 1-mile point, concentration water wall, 300-foot length / height and 50-foot thickness, 6-round duration, 50-foot start-turn movement, 50-foot end-turn height decay, 1d10 later-damage decay, 0-foot-height ending, Strength (Athletics) swimming restriction, and falling when leaving the wall while preserving existing damage rows, movement row, control options, size filter, targeting, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Tsunami utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 59 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/tsunami.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for persistent wall geometry, start-turn wall movement, moving caught creatures, once-per-round ongoing damage suppression, per-round damage decay, wall-height decay, swimming checks, fall-out handling, 0-foot-height ending, or full water-wall collision beyond current structured data and control options.

## 2026-06-13 - Antipathy/Sympathy utility-description focus

### SSO-ANTIPATHY-SYMPATHY-UTILITY-DESCRIPTION-001 - mode and trigger utility wrapper now points to sibling status and movement rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/antipathy-sympathy.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION` and `MOVEMENT` rows already carry Frightened, Charmed, and safest-route forced movement.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Antipathy/Sympathy keeps the utility row focused on mode and trigger wrapper facts instead of repeating full spell card prose.
- The Antipathy/Sympathy utility description now names Antipathy/Sympathy mode choice, Huge-or-smaller creature/object target, named affected creature kind, 120-foot Wisdom-save trigger, turn-end repeat save when more than 120 feet away, 1-minute immunity after a successful save, Sympathy's 5-foot no-willing-away rule, and target-damage ending save while preserving existing status rows, movement row, control options, target filter, AI prompt, component, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Antipathy/Sympathy utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 58 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/antipathy-sympathy.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for creature-kind matching, 120-foot aura trigger detection, mode-specific condition branching, safest-route movement pathing, 5-foot Sympathy lock behavior, target-damage ending saves, turn-end distance checks, or 1-minute immunity persistence beyond current structured data and control options.

## 2026-06-13 - Illusory Dragon utility-description focus

### SSO-ILLUSORY-DRAGON-UTILITY-DESCRIPTION-001 - illusion-control utility wrapper now points to sibling fear, breath, and movement rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/illusory-dragon.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION`, `DAMAGE`, and `MOVEMENT` rows already carry Frightened, 7d6 breath damage, save advantage for discerners, and 60-foot bonus-action movement.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Illusory Dragon keeps the utility row focused on illusion-control wrapper facts instead of repeating full spell card prose.
- The Illusory Dragon utility description now names the Huge tangible shadow-dragon illusion, unoccupied visible space within 120 feet, 1-minute concentration, chosen breath damage type, bonus-action move-and-breath option, automatic attack misses, saving throw success, damage / condition immunity, and Intelligence (Investigation) discernment action while preserving existing status, damage, movement, granted action, control option, save-modifier, targeting, AI prompt, component, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Illusory Dragon utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 57 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/illusory-dragon.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for illusion occupying space, enemy visibility detection, repeat Frightened saves gated by line of sight, bonus-action movement orchestration, breath cone placement during movement, selected damage-type enforcement, automatic attack misses, illusion immunity, Investigation discernment state, or save-advantage application beyond current structured data and control options.

## 2026-06-13 - Earthquake utility-description focus

### SSO-EARTHQUAKE-UTILITY-DESCRIPTION-001 - tremor-zone utility wrapper now points to sibling status and damage rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/earthquake.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION` and `DAMAGE` rows already carry Prone, Buried, structure damage, and collapse damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Earthquake keeps the utility row focused on tremor-zone wrapper facts instead of repeating full spell card prose.
- The Earthquake utility description now names the visible ground point, 500-foot range, 100-foot-radius concentration tremor zone, Difficult Terrain, cast/end-turn Dexterity save timing, failed-save Concentration break, 1d6 caster-placed fissures, fissure dimensions, and repeated structure damage / collapse checks while preserving existing status rows, damage rows, control options, targeting, material component, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Earthquake utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 56 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/earthquake.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for persistent tremor zones, Difficult Terrain rendering, repeated end-turn save scheduling, Concentration break enforcement, fissure placement/geometry, fall-into-fissure movement, structure hit point tracking, collapse radius calculation, rubble escape actions, or turn-by-turn structure damage orchestration beyond current structured data and control options.

## 2026-06-13 - Symbol utility-description focus

### SSO-SYMBOL-UTILITY-DESCRIPTION-001 - glyph trigger utility wrapper now points to sibling payload rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/symbol.json` had a copied `UTILITY` row even though separate `DAMAGE`, `STATUS_CONDITION`, and `ATTACK_ROLL_MODIFIER` rows already carry Death damage, Fear / Pain / Sleep / Stunning conditions, and Discord disadvantage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Symbol keeps the utility row focused on glyph placement, trigger, light, and once-per-turn targeting wrapper facts instead of repeating full spell card prose.
- The Symbol utility description now names surface or closable-object glyph placement, 10-foot glyph diameter, object movement break distance, imperceptibility, trigger refinement with creature-type or password exclusions, 60-foot dim-light sphere, 10-minute triggered duration, and once-per-turn targeting while preserving existing damage, status, attack modifier, control option, targeting, spatial, material cost / consumption, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Symbol utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 55 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/symbol.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for glyph placement persistence, hidden-glyph perception checks, trigger condition authoring, creature-type/password trigger exclusions, triggered light rendering, once-per-turn zone targeting, or per-symbol payload selection beyond current structured data and control options.

## 2026-06-13 - Wish utility-description focus

### SSO-WISH-UTILITY-DESCRIPTION-001 - mode and stress utility wrapper now points to sibling payload rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/wish.json` had a copied `UTILITY` row even though separate `HEALING`, `DEFENSIVE`, and `DAMAGE` rows already carry Instant Health, permanent Resistance, 8-hour Spell Immunity, and irreducible post-stress Necrotic damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Wish keeps the utility row focused on mode and stress routing facts instead of repeating full spell card prose.
- The Wish utility description now names level-8-or-lower spell duplication, the non-duplication mode menu, Wish stress, Strength reduction, rest-based recovery reduction, and the 33 percent future-Wish lockout chance while preserving existing healing, defensive, damage, control option, AI prompt, targeting, duration, component, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Wish utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 54 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/wish.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for duplicated spell selection/application, object creation, Greater Restoration effect removal, permanent resistance persistence, spell-immunity matching, feat replacement eligibility, reroll rewinding, DM-adjudicated reality reshaping, Wish-stress long-rest hooks, Strength recovery scheduling, or future-Wish lockout persistence beyond current structured data and control options.

## 2026-06-13 - True Polymorph utility-description focus

### SSO-TRUE-POLYMORPH-UTILITY-DESCRIPTION-001 - mode-selection utility wrapper now points to creature-form temporary-HP payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/true-polymorph.json` had a copied `UTILITY` row even though a separate `DEFENSIVE` row already carries creature-to-creature temporary Hit Points.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that True Polymorph keeps the utility row focused on mode-selection wrapper facts instead of repeating full spell card prose.
- The True Polymorph utility description now names single visible creature or nonmagical object targeting, creature-to-creature / creature-to-object / object-to-creature modes, unwilling Wisdom saves, full-hour concentration permanence, CR or level limits, object-size and worn/carried eligibility, control and friendliness, retained identity facts, action / speech / spellcasting / gear limits, and no-memory object form while preserving existing defensive row, control options, AI prompt, targeting, duration, concentration, component, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the True Polymorph utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 53 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/true-polymorph.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for mode-specific transformation application, stat-block replacement, object eligibility enforcement, sustained-concentration permanence, friendly/controlled object-creature behavior, post-hour control release, equipment melding, temporary-HP lifecycle, or no-memory restoration beyond current structured data and control options.

## 2026-06-13 - Mass Polymorph utility-description focus

### SSO-MASS-POLYMORPH-UTILITY-DESCRIPTION-001 - transformation utility wrapper now points to beast-form temporary-HP payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/mass-polymorph.json` had a copied `UTILITY` row even though a separate `DEFENSIVE` row already carries non-replaceable temporary Hit Points from the new beast form.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Mass Polymorph keeps the utility row focused on transformation wrapper facts instead of repeating full spell card prose.
- The Mass Polymorph utility description now names up to ten visible targets, Wisdom saves and shapechanger auto-success for unwilling targets, seen-Beast CR or half-level form limits, retained hit points / alignment / personality, stat and action limitations, gear access loss, and reversion timing while preserving existing defensive row, control options, AI prompt, targeting, duration, concentration, component, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Mass Polymorph utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 52 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/mass-polymorph.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for multi-target beast-form selection, shapechanger auto-success enforcement, creature-form stat replacement, action/speech/hand restrictions, gear melding, temporary-HP lifecycle, or reversion timing beyond current structured data and control options.

## 2026-06-13 - Invulnerability utility-description focus

### SSO-INVULNERABILITY-UTILITY-DESCRIPTION-001 - self-only utility wrapper now points to damage-immunity payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/invulnerability.json` had a copied `UTILITY` row even though a separate `DEFENSIVE` row already carries immunity to all damage until the spell ends.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Invulnerability keeps the utility row focused on self-only defensive wrapper facts instead of repeating the defensive payload.
- The Invulnerability utility description now names self targeting, 10-minute concentration, and consumed adamantine component while preserving existing defensive row, control option, targeting, material cost and consumption, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Invulnerability utility row still repeated the all-damage-immunity payload.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 51 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/invulnerability.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for all-damage immunity enforcement, concentration break behavior, or immunity interaction ordering beyond current structured data and control options.

## 2026-06-13 - Astral Projection utility-description focus

### SSO-ASTRAL-PROJECTION-UTILITY-DESCRIPTION-001 - astral-travel utility wrapper now points to suspended-body status payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/astral-projection.json` had a copied `UTILITY` row even though a separate `STATUS_CONDITION` row already carries suspended-body Unconscious.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Astral Projection keeps the utility row focused on astral-travel wrapper facts instead of repeating full spell card prose.
- The Astral Projection utility description now names projection for the caster and up to eight willing creatures, the already-on-Astral-Plane failure, suspended bodies, body/astral-form damage and effect separation, silver-cord death, planar re-entry, and Magic-action dismissal while preserving existing status row, granted action, control options, targeting, consumed material cost, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Astral Projection utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 50 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/astral-projection.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for Astral Plane travel, duplicate-plane casting failure, silver-cord visibility/cutting, body/astral-form damage separation, planar re-entry, per-target 0-HP ending, dismissal routing, or suspended-body upkeep beyond current structured data and control options.

## 2026-06-13 - Shapechange utility-description focus

### SSO-SHAPECHANGE-UTILITY-DESCRIPTION-001 - transformation utility wrapper now points to first-form temporary-HP payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/shapechange.json` had a copied `UTILITY` row even though a separate `DEFENSIVE` row already carries first-form temporary Hit Points.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Shapechange keeps the utility row focused on transformation wrapper facts instead of repeating full spell card prose.
- The Shapechange utility description now names seen non-Construct / non-Undead form eligibility, Challenge Rating eligibility, Magic-action reshaping, retained identity/stat/proficiency/communication/Spellcasting facts, and equipment handling while preserving existing defensive row, granted action, control options, targeting filters, AI prompt, material cost, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Shapechange utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 49 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/shapechange.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for creature form lookup, stat-block replacement, retained-stat merging, Spellcasting preservation, repeat Magic-action transformation, equipment conversion/drop handling, or temporary-HP lifecycle beyond current structured data and control options.

## 2026-06-13 - Mass Heal utility-description focus

### SSO-MASS-HEAL-UTILITY-DESCRIPTION-001 - allocation utility wrapper now points to 700-HP healing payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/mass-heal.json` had a copied `UTILITY` row even though a separate `HEALING` row already carries the 700-Hit-Point restoration pool.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Mass Heal keeps the utility row focused on allocation and condition wrapper facts instead of repeating full spell card prose.
- The Mass Heal utility description now names dividing healing among any number of visible creatures within 60 feet and Blinded / Deafened / Poisoned removal on healed creatures while preserving existing healing row, allocation prompt, control options, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Mass Heal utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 48 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/mass-heal.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for allocation UI, per-target healing distribution, overheal prevention, or removing Blinded, Deafened, and Poisoned as separate status-condition effect rows beyond current structured data and control options.

## 2026-06-13 - Power Word Heal utility-description focus

### SSO-POWER-WORD-HEAL-UTILITY-DESCRIPTION-001 - healing utility wrapper now points to full-HP and prone-standing payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/power-word-heal.json` had a copied `UTILITY` row even though a separate `HEALING` row already carries all-Hit-Point restoration and a separate `MOVEMENT` row already carries ending the Prone movement state by standing.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Power Word Heal keeps the utility row focused on condition and reaction wrapper facts instead of repeating full spell card prose.
- The Power Word Heal utility description now names the visible target, Charmed / Frightened / Paralyzed / Poisoned / Stunned condition removal, and Prone reaction-to-stand permission while preserving existing healing row, movement row, granted reaction, control options, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Power Word Heal utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 47 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/power-word-heal.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for removing Charmed, Frightened, Paralyzed, Poisoned, or Stunned as separate status-condition effect rows, Prone reaction timing, reaction availability checks, or full status lifecycle integration beyond current structured data and control options.

## 2026-06-13 - True Resurrection utility-description focus

### SSO-TRUE-RESURRECTION-UTILITY-DESCRIPTION-001 - resurrection utility wrapper now points to healing and placement payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/true-resurrection.json` had a copied `UTILITY` row even though a separate `HEALING` row already carries all-Hit-Point revival and a separate `MOVEMENT` row already carries new-body placement within 10 feet.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that True Resurrection keeps the utility row focused on resurrection wrapper facts instead of repeating full spell card prose.
- The True Resurrection utility description now names the 200-year and no-old-age eligibility gates, wound / poison / magical-contagion / curse restoration, organ and limb replacement, Undead form restoration, and spoken-name new-body creation while preserving existing healing row, movement row, control options, targeting, material cost and consumption, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the True Resurrection utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 46 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/true-resurrection.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 200-year death eligibility, old-age death exclusion, poison / magical contagion / curse restoration, organ and limb restoration, Undead form restoration, spoken-name identity matching, or new-body placement adjudication beyond current structured data and control options.

## 2026-06-13 - Foresight utility-description focus

### SSO-FORESIGHT-UTILITY-DESCRIPTION-001 - future-sight utility wrapper now points to defensive and attack-roll payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/foresight.json` had a copied `UTILITY` row even though a separate `DEFENSIVE` row already carries saving-throw advantage and separate `ATTACK_ROLL_MODIFIER` rows already carry outgoing attack-roll advantage and incoming attack-roll disadvantage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Foresight keeps the utility row focused on future-sight wrapper facts instead of repeating full spell card prose.
- The Foresight utility description now names the willing touch target, 8-hour future-sight shell, recast ending, and current ability-check-advantage limitation while preserving existing defensive row, attack-roll modifier rows, control options, targeting, duration, material component, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Foresight utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 45 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/foresight.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for ability-check advantage, complete D20 Test coverage, recast ending enforcement, or all future-sight narrative consequences beyond current structured data and control options.

## 2026-06-13 - Gate utility-description focus

### SSO-GATE-UTILITY-DESCRIPTION-001 - portal-routing utility wrapper now points to planar movement payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/gate.json` had a copied `UTILITY` row even though a separate `MOVEMENT` row already carries front-of-portal planar transport to the nearest unoccupied space.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Gate keeps the utility row focused on portal-routing wrapper facts instead of repeating full spell card prose.
- The Gate utility description now names the visible 5-to-20-foot portal, chosen orientation, front/back travel rule, planar-ruler block, optional true-name creature pull, and no-control boundary while preserving existing movement row, destination prompt, portal sizing metadata, material cost, targeting, duration, concentration, control options, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Gate utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 44 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/gate.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for planar destination lookup, portal facing/collision, planar-ruler veto enforcement, named-creature true-name matching, creature pull placement, or post-arrival creature behavior beyond current structured data and control options.

## 2026-06-13 - Imprisonment utility-description focus

### SSO-IMPRISONMENT-UTILITY-DESCRIPTION-001 - restraint-option utility wrapper now points to status and teleport-block payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/imprisonment.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION` rows already carry the Imprisoned, Restrained, and Unconscious payloads, and a separate `MOVEMENT` row already carries the teleport and planar-travel block.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Imprisonment keeps the utility row focused on restraint-option wrapper facts instead of repeating full spell card prose.
- The Imprisonment utility description now names the Wisdom save, 24-hour successful-save immunity, imprisoned upkeep and divination invisibility, Burial / Chaining / Hedged Prison / Minimus Containment / Slumber routing, observable ending trigger, and ninth-level Dispel Magic route while preserving existing status rows, movement row, control options, targeting, material cost, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Imprisonment utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 43 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/imprisonment.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for 24-hour immunity tracking, divination invisibility, Burial / Hedged Prison spatial containment, Minimus Containment size/object rules, trigger adjudication, or ninth-level Dispel Magic enforcement beyond current structured data and control options.

## 2026-06-13 - Prismatic Wall utility-description focus

### SSO-PRISMATIC-WALL-UTILITY-DESCRIPTION-001 - wall-shell utility wrapper now points to blinded and terrain payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/prismatic-wall.json` had a copied `UTILITY` row even though a separate `STATUS_CONDITION` row already carries the near-wall Constitution save / Blinded payload and a separate `TERRAIN` row already carries the blocking wall terrain payload.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Prismatic Wall keeps the utility row focused on wall-shell wrapper facts instead of repeating full spell card prose.
- The Prismatic Wall utility description now names the wall/globe choice, occupied-space failure, multicolored light, designated safe creatures, and seven-layer destruction/magic-interaction routing while preserving existing Blinded status, terrain, light, control options, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Prismatic Wall utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 42 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/prismatic-wall.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for full Prismatic Layers table effects, layer-by-layer destruction prerequisites, Antimagic Field / Dispel Magic enforcement, occupied-space placement cancellation, safe-creature passage, or near-wall vision checks beyond current structured data and control options.

## 2026-06-13 - Reverse Gravity utility-description focus

### SSO-REVERSE-GRAVITY-UTILITY-DESCRIPTION-001 - gravity-zone utility wrapper now points to movement and collision payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/reverse-gravity.json` had a copied `UTILITY` row even though separate `MOVEMENT` rows already carry the upward forced movement and end-of-spell downward fall, and a separate `DAMAGE` row already carries upward collision falling damage.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Reverse Gravity keeps the utility row focused on gravity-zone wrapper facts instead of repeating full spell card prose.
- The Reverse Gravity utility description now names the 50-foot-radius, 100-foot-high Cylinder, reachable-object Dexterity save, hover-at-top duration shell, and sibling movement/damage payload routing while preserving existing movement rows, damage row, control options, targeting, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Reverse Gravity utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 41 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/reverse-gravity.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for gravity inversion physics, anchored object reach checks, hover state, upward/downward falling damage calculation, or end-of-spell fall orchestration beyond current structured data and control options.

## 2026-06-13 - Power Word Pain utility-description focus

### SSO-POWER-WORD-PAIN-UTILITY-DESCRIPTION-001 - threshold and spellcasting utility wrapper now points to condition, movement, and modifier payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/power-word-pain.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION`, `MOVEMENT`, and `ATTACK_ROLL_MODIFIER` rows already carry the Crippling Pain state, speed cap, disadvantage package, repeat Constitution save, and spellcasting interruption metadata.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Power Word Pain keeps the utility row focused on threshold, immunity, spellcasting, and ending wrapper facts instead of repeating full spell card prose.
- The Power Word Pain utility description now names the 100 Hit Point threshold, Charmed immunity exclusion, spellcasting Constitution save/wasted-spell branch, and end-turn Constitution save ending while preserving existing status, movement, attack-modifier, recurring spellcasting-save metadata, control options, targeting, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Power Word Pain utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 40 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/power-word-pain.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for current-HP threshold gating, Charmed-immunity exclusion, spellcasting interruption/wasted-spell behavior, non-Constitution save disadvantage, or speed-cap lifecycle beyond current structured data and control options.

## 2026-06-13 - Incendiary Cloud utility-description focus

### SSO-INCENDIARY-CLOUD-UTILITY-DESCRIPTION-001 - cloud wrapper now points to damage and movement payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/incendiary-cloud.json` had a copied `UTILITY` row even though separate `DAMAGE` rows already carry immediate, enter-area, and end-turn 10d8 Fire damage saves, and a separate `MOVEMENT` row already carries the 10-foot start-turn cloud movement.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Incendiary Cloud keeps the utility row focused on cloud wrapper facts instead of repeating full spell card prose.
- The Incendiary Cloud utility description now names the 20-foot Heavily Obscured ember-smoke sphere, concentration/strong-wind duration boundary, and once-per-turn save limit while preserving existing damage rows, movement row, control options, targeting, duration, concentration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Incendiary Cloud utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 39 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/incendiary-cloud.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for persistent cloud zones, heavy-obscurement rendering, strong-wind dispersal, once-per-turn damage suppression, or start-turn cloud movement beyond current structured data and control options.

## 2026-06-13 - Divine Word utility-description focus

### SSO-DIVINE-WORD-UTILITY-DESCRIPTION-001 - HP-band table utility wrapper now points to status and planar payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/divine-word.json` had a copied `UTILITY` row even though separate `STATUS_CONDITION` rows already carry the HP-band Dead/Blinded/Deafened/Stunned payloads and a separate `MOVEMENT` row already carries planar return for Celestial, Elemental, Fey, and Fiend targets.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Divine Word keeps the utility row focused on table routing and return-block wrapper facts instead of repeating full spell card prose.
- The Divine Word utility description now names chosen creatures, Charisma save, 50-HP-or-lower table routing, and 24-hour return block except by Wish while preserving existing HP-band status rows, planar movement row, creature-type filter, control options, targeting, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Divine Word utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 38 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/divine-word.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for current-HP band branching, multi-target chosen-creature selection, planar-origin detection, 24-hour return-block enforcement, or Wish bypass behavior beyond current structured data and control options.

## 2026-06-13 - Arcane Sword utility-description focus

### SSO-ARCANE-SWORD-UTILITY-DESCRIPTION-001 - sword-control utility wrapper now points to damage and movement payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/arcane-sword.json` had a copied `UTILITY` row even though separate `DAMAGE` rows already carry initial and bonus-action 3d10 Force melee spell attacks, and a separate `MOVEMENT` row already carries the 20-foot bonus-action sword movement.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Arcane Sword keeps the utility row focused on sword-control wrapper facts instead of repeating full spell card prose.
- The Arcane Sword utility description now names the hovering sword-shaped plane of force, initial target-within-5-feet attack, and bonus-action retargeting while preserving existing damage rows, movement row, material cost, targeting, control options, duration, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Arcane Sword utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 37 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/arcane-sword.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for controlled sword state, bonus-action retargeting orchestration, repeated melee spell attacks, or visible-spot movement beyond current structured data and control options.

## 2026-06-13 - Power Word Stun utility-description focus

### SSO-POWER-WORD-STUN-UTILITY-DESCRIPTION-001 - threshold utility wrapper now points to status and movement payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/power-word-stun.json` had a copied `UTILITY` row even though a separate `STATUS_CONDITION` row already carries the Stunned condition and repeat Constitution save, and a separate `MOVEMENT` row already carries the over-150-HP Speed-0 branch.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Power Word Stun keeps the utility row focused on threshold routing instead of repeating full spell card prose.
- The Power Word Stun utility description now names the 150 Hit Point threshold and routes to sibling status/movement payloads while preserving existing Stunned repeat-save metadata, Speed-0 movement, threshold control options, targeting, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Power Word Stun utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 36 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/power-word-stun.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for current-HP threshold branching or Speed-0 condition lifecycle beyond the current structured data and control options.

## 2026-06-13 - Demiplane utility-description focus

### SSO-DEMIPLANE-UTILITY-DESCRIPTION-001 - door and room utility wrapper now points to shunt payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/demiplane.json` had a copied `UTILITY` row even though a separate `STATUS_CONDITION` row already carries the optional Prone shunt payload when a creature exits through the vanishing door.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Demiplane keeps the utility row focused on door, room, persistence, and connection wrapper facts instead of repeating full spell card prose.
- The Demiplane utility description now names the openable shadowy Medium door, 30-foot wood-or-stone room, object/unshunted-creature persistence, and new/previous/known demiplane connection choices while preserving existing Prone status payload, spatial details, AI prompt, control options, duration, targeting, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Demiplane utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 35 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/demiplane.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim runtime parity for persistent demiplane storage, object inventory, creature containment, cross-casting demiplane lookup, known-other-demiplane routing, or nearest-space shunt placement beyond current structured data and control options.

## 2026-06-13 - Resurrection utility-description focus

### SSO-RESURRECTION-UTILITY-DESCRIPTION-001 - resurrection eligibility utility wrapper now points to healing and ordeal payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/resurrection.json` had a copied `UTILITY` row even though a separate `HEALING` row already carries the full-Hit-Point return and a separate `STATUS_CONDITION` row already carries the Resurrection Ordeal D20 Test penalty.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Resurrection keeps the utility row focused on eligibility/restoration wrapper facts instead of repeating full spell card prose.
- The Resurrection utility description now names touch revival eligibility, no-old-age/no-Undead gates, death-time poison neutralization, wound closure, missing body part restoration, and the 365-day caster tax while preserving existing healing, status, material cost, control options, targeting, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Resurrection utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 34 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/resurrection.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for corpse age validation, old-age death checks, Undead-at-death checks, poison neutralization, missing-body restoration, or the 365-day caster spellcasting/disadvantage tax beyond current structured data and control options.

## 2026-06-13 - Dominate Monster utility-description focus

### SSO-DOMINATE-MONSTER-UTILITY-DESCRIPTION-001 - command-control utility wrapper now points to Charmed payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/dominate-monster.json` had a copied `UTILITY` row even though a separate `STATUS_CONDITION` row already carries the Wisdom save, combat-advantage save modifier, Charmed duration, and on-damage repeat save.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Dominate Monster keeps the utility row focused on command-control wrapper facts instead of repeating full spell card prose.
- The Dominate Monster utility description now names the same-plane telepathic link, no-action commands, caster Reaction cost for commanded Reactions, and self-directed behavior after completed orders while preserving existing status payload, granted reaction action, control options, higher-level text, targeting, and scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Dominate Monster utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 33 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/dominate-monster.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime or AI parity for dominated-target command obedience, commanded Reactions, caster command UI, or self-directed fallback behavior beyond the current structured data and control options.

## 2026-06-13 - Prismatic Spray utility-description focus

### SSO-PRISMATIC-SPRAY-UTILITY-DESCRIPTION-001 - ray-selection utility wrapper now points to structured payload rows

Status: verified.

Evidence added this pass:
- `public/data/spells/level-7/prismatic-spray.json` had a copied `UTILITY` row even though sibling rows already carry the shared ray damage payload, indigo/violet status tracks, petrification, and teleport movement.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Prismatic Spray keeps the utility row focused on ray-selection wrapper facts instead of repeating spell-card prose.
- The Prismatic Spray utility description now names the 60-foot cone, per-target Dexterity save, 1d8 ray-color selection, Prismatic Rays table lookup, and special two-ray result while preserving existing damage, status, petrification, teleport, targeting, control options, and scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Prismatic Spray utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 32 tests.
- `npm run validate:spells -- --spell public/data/spells/level-7/prismatic-spray.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for per-target random ray selection, two-ray rerolls, color-specific damage typing, indigo progression, violet planar destination choice, or table UI beyond the current structured data and control options.

## 2026-06-13 - Blade of Disaster utility-description focus

### SSO-BLADE-OF-DISASTER-UTILITY-DESCRIPTION-001 - blade-control utility wrapper now points to damage and movement payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/blade-of-disaster.json` had a copied `UTILITY` row even though separate `DAMAGE` rows already carry normal and critical Force damage and a separate `MOVEMENT` row carries the 30-foot bonus-action blade move.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Blade of Disaster keeps the utility row focused on blade-control wrapper facts instead of repeating full spell card prose.
- The Blade of Disaster utility description now names the 3-foot planar blade, cast-time and post-move attack cadence, 18+ critical threshold, and barrier passage while preserving existing attack type, damage dice, spatial details, granted action, movement row, targeting, control options, and scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Blade of Disaster utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 31 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/blade-of-disaster.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a row-interpretability cleanup. It does not claim full runtime parity for controlled summoned blade state, repeated melee spell attacks, object/structure attack targeting, or barrier traversal beyond the current structured data and control options.

## 2026-06-13 - Power Word Kill utility-description focus

### SSO-POWER-WORD-KILL-UTILITY-DESCRIPTION-001 - death-threshold utility wrapper now points to damage branch payload

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/power-word-kill.json` had a copied `UTILITY` row even though a separate `DAMAGE` row already carries the over-100-HP 12d12 Psychic damage fallback.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Power Word Kill keeps the utility row focused on death-threshold routing instead of repeating full spell card prose.
- The Power Word Kill utility description now names the 100 Hit Point instant-death threshold and the over-threshold route to the sibling damage row without changing modeled damage dice, targeting, control options, or scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Power Word Kill utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 30 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/power-word-kill.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a focused row-text cleanup. It does not claim a broader runtime implementation audit for instant death, current HP threshold branching, or death-state side effects beyond the existing structured spell data.

## 2026-06-13 - Feeblemind and Sunburst utility-description focus

### SSO-L8-COMPACT-UTILITY-WRAPPER-DESCRIPTION-001 - compact damage/status utility wrappers now point to structured payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-8/feeblemind.json` had a copied `UTILITY` row even though separate `DAMAGE` and `STATUS_CONDITION` rows already carry the 4d6 Psychic damage, Intelligence save, and Feebleminded status payload.
- `public/data/spells/level-8/sunburst.json` had a copied `UTILITY` row even though separate `DAMAGE` and `STATUS_CONDITION` rows already carry the Constitution save, 12d6 Radiant damage, Blinded condition, repeat-save metadata, and condition duration.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has real-data proofs that Feeblemind and Sunburst keep utility rows focused on wrapper-only facts instead of repeating full spell card prose.
- Feeblemind's utility description now names spellcasting, magic-item, language, and communication lockouts, friend recognition, 30-day repeat save, and Greater Restoration/Heal/Wish endings without changing modeled damage, save, status, targeting, or scaling.
- Sunburst's utility description now names the 60-foot sunlight burst and Darkness dispel while preserving modeled damage, save, Blinded status, repeat-save metadata, targeting, and scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because both Feeblemind and Sunburst utility rows still repeated top-level spell descriptions.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 29 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/feeblemind.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-8/sunburst.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This handles two compact level-8 damage/status wrappers. Larger copied utility rows from the bounded audit, including Earthquake, Illusory Dragon, Symbol, Wish, Prismatic Wall, and other high-complexity spells, still need separate proof-first classification because some may expose missing schedule, choice, object, movement, terrain, or special-ending models rather than safe wording-only cleanup.

## 2026-06-13 - Tenser's Transformation utility-description focus

### SSO-TENSERS-TRANSFORMATION-UTILITY-DESCRIPTION-001 - copied intro utility prose now points to structured buff payloads

Status: verified.

Evidence added this pass:
- A bounded remaining-corpus audit found 58 copied `UTILITY` rows with structured sibling effects still present after the focused level-9 wrapper batch.
- `public/data/spells/level-6/tensers-transformation.json` was selected as the next small high-impact candidate because it combines `HEALING`, `DAMAGE`, `STATUS_CONDITION`, and `UTILITY` rows without requiring a giant effect-splitting rewrite.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Tenser's Transformation keeps the utility description focused on the martial wrapper benefits instead of copying the spell intro.
- The Tenser's Transformation utility description now points to spellcasting lockout, martial proficiency, weapon advantage, save proficiency, and extra attack while preserving sibling rows for 50 temporary Hit Points, weapon-hit 2d12 Force damage, and post-spell Exhaustion.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Tenser's Transformation utility row still repeated copied intro prose.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 27 tests.
- `npm run validate:spells -- --spell public/data/spells/level-6/tensers-transformation.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- The bounded audit still found many copied utility rows with structured siblings. Large spells such as Earthquake, Illusory Dragon, Symbol, Wish, Prismatic Wall, and other level-7/8/9 rows should be handled in separate proof-first slices because their utility prose may represent missing choice, object, movement, schedule, or terrain modeling rather than a safe one-line wrapper cleanup.

## 2026-06-13 - Meteor Swarm and Storm of Vengeance utility-description focus

### SSO-L9-UTILITY-WRAPPER-DESCRIPTION-001 - remaining audited level-9 copied utility wrappers now point to structured payloads

Status: verified for the four audited level-9 copied utility-wrapper candidates.

Evidence added this pass:
- `public/data/spells/level-9/meteor-swarm.json` had a copied `UTILITY` row even though separate `DAMAGE` rows already carry the 20d6 Fire and 20d6 Bludgeoning Dexterity-save payloads.
- `public/data/spells/level-9/storm-of-vengeance.json` had a copied `UTILITY` row even though separate `DAMAGE`, `STATUS_CONDITION`, `TERRAIN`, and `effectSchedule` structures already carry the staged Thunder, Deafened, Acid, Lightning, Bludgeoning, Cold, Difficult Terrain, and Heavily Obscured payloads.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has real-data proofs that Meteor Swarm and Storm of Vengeance keep utility rows focused on wrapper-only facts instead of repeating full spell card prose.
- Meteor Swarm's utility description now names four visible impact points, once-only overlap handling, object damage, and flammable ignition without changing the modeled damage rows, Dexterity save, targeting, AI prompt, or scaling.
- Storm of Vengeance's utility description now names the cloud wrapper, staged later-turn schedule, ranged weapon attack lockout, and strong wind without changing modeled damage rows, saves, Deafened status, terrain rows, effect schedule, duration, targeting, or scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because both Meteor Swarm and Storm of Vengeance utility rows still repeated their top-level spell descriptions.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 26 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/meteor-swarm.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-9/storm-of-vengeance.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This closes the focused four-spell level-9 utility-wrapper batch found in the bounded audit: Meteor Swarm, Psychic Scream, Storm of Vengeance, and Weird. It still does not promote a broad UTILITY copied-prose validator gate; lower-level or narrative utility rows may need effect splitting, object targeting, schedule modeling, or dedicated semantic classification before a global rule is safe.

## 2026-06-13 - Weird utility-description focus

### SSO-WEIRD-UTILITY-DESCRIPTION-001 - copied utility prose now points to structured damage/status payloads

Status: verified.

Evidence added this pass:
- `public/data/spells/level-9/weird.json` had a copied `UTILITY` row even though separate rows already carry initial 10d10 Psychic damage, Frightened, the end-turn Wisdom repeat save, failed-repeat 5d10 Psychic damage, and per-target ending.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Weird's utility row stays focused on area illusion wrapper facts instead of repeating the full spell card prose.
- The Weird utility description now points reviewers to the structured damage and Frightened rows without changing the modeled Wisdom saves, damage dice, Frightened condition, repeat-save metadata, duration, targeting, or scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Weird utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 24 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/weird.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a focused real-data cleanup, not a broad UTILITY copied-prose gate. Meteor Swarm and Storm of Vengeance were cleaned in the follow-up focused level-9 utility-wrapper batch, but lower-level copied utility prose still needs separate audit before any global rule is safe.

## 2026-06-13 - Psychic Scream utility-description focus

### SSO-PSYCHIC-SCREAM-UTILITY-DESCRIPTION-001 - copied utility prose now points to structured damage/status payloads

Status: verified.

Evidence added this pass:
- A bounded utility-wrapper audit found current copied top-level prose on Meteor Swarm, Psychic Scream, Storm of Vengeance, and Weird.
- `public/data/spells/level-9/psychic-scream.json` was selected first because its copied `UTILITY` row sits beside structured `DAMAGE` and `STATUS_CONDITION` rows for the same spell.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Psychic Scream's utility row stays focused on wrapper-only facts instead of repeating the full spell card prose.
- The Psychic Scream utility description now names target-count visibility, Intelligence 2-or-lower immunity, head-explosion cleanup, and repeat-save handoff while preserving the existing modeled 14d6 Psychic damage, Intelligence save, Stunned condition, repeat-save metadata, targeting, and scaling.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Psychic Scream utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 23 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/psychic-scream.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a focused real-data cleanup, not a broad UTILITY copied-prose gate. Meteor Swarm and Storm of Vengeance were cleaned in the follow-up focused level-9 utility-wrapper batch, but lower-level copied utility prose still needs separate audit before any global rule is safe.

## 2026-06-13 - Hold Monster utility-description focus

### SSO-HOLD-MONSTER-UTILITY-DESCRIPTION-001 - copied utility prose now points to the structured Paralyzed payload

Status: verified.

Evidence added this pass:
- A bounded audit found no current `STATUS_CONDITION`, `HEALING`, `DEFENSIVE`, or `ATTACK_ROLL_MODIFIER` effect rows that duplicate their top-level spell descriptions.
- `public/data/spells/level-5/hold-monster.json` still had a mechanics-rich `UTILITY` row duplicating the top-level spell prose even though the separate `STATUS_CONDITION` row already carries the Wisdom save, repeat save, Paralyzed condition, and duration.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a real-data proof that Hold Monster's utility row remains focused on its wrapper role instead of copying top-level prose.
- The Hold Monster utility description now points reviewers to the structured Paralyzed effect row without changing the modeled save, repeat-save, condition, duration, targeting, or scaling data.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because the Hold Monster utility row still repeated the top-level spell description.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 22 tests.
- `npm run validate:spells -- --spell public/data/spells/level-5/hold-monster.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- This is a focused real-data cleanup, not a broad UTILITY copied-prose gate. Many narrative UTILITY rows still need effect splitting or dedicated modeling decisions before broad validation rules are safe.

## 2026-06-13 - Damage effect copied-prose cleanup

### SSO-DAMAGE-EFFECT-COPIED-SPELL-PROSE-001 - damage rows no longer copy whole top-level spell descriptions

Status: verified for the audited DAMAGE effect family.

Evidence added this pass:
- `src/systems/spells/validation/SpellIntegrityValidator.ts` now rejects DAMAGE effect descriptions that duplicate the top-level spell description.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a failing-first unit proof for copied top-level prose on a DAMAGE row.
- `public/data/spells/level-4/vitriolic-sphere.json` now describes the initial acid explosion row in terms of its own 10d4 damage, Dexterity save, half-on-success result, area, and slot scaling.
- `public/data/spells/level-6/mental-prison.json` now describes the escape-trigger damage row in terms of its own 10d10 Psychic damage and ending trigger.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because copied top-level DAMAGE prose was not rejected.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 21 tests.
- `npm run validate:spells -- --spell public/data/spells/level-4/vitriolic-sphere.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-6/mental-prison.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.
- Required dependency sync completed for `src/systems/spells/validation/SpellIntegrityValidator.ts`.

Remaining boundary:
- This deliberately gates only DAMAGE rows. Many long UTILITY rows still mirror top-level spell prose and should be handled through effect splitting or dedicated utility-family modeling rather than a broad blind rewrite.

## 2026-06-13 - Duplicate long effect-description cleanup

### SSO-EFFECT-DESCRIPTION-DUPLICATE-LONG-PROSE-001 - mode-choice effect rows no longer repeat whole choice menus

Status: verified for the audited duplicate-description family.

Evidence added this pass:
- `src/systems/spells/validation/SpellIntegrityValidator.ts` now rejects duplicated long descriptions across multiple effect rows in the same spell.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a failing-first proof for duplicated long effect prose, and the all-spell description corpus gate covers current data.
- `public/data/spells/level-2/alter-self.json` now gives Aquatic Adaptation, Change Appearance, and Natural Weapons separate effect-specific descriptions.
- `public/data/spells/level-2/enlarge-reduce.json` now gives Enlarge and Reduce separate effect-specific descriptions.
- `public/data/spells/level-3/plant-growth.json` now gives Overgrowth and Enrichment separate effect-specific descriptions.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because duplicated long effect descriptions were not rejected.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 20 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/alter-self.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-2/enlarge-reduce.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-3/plant-growth.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.
- Required dependency sync completed for `src/systems/spells/validation/SpellIntegrityValidator.ts`.

Remaining boundary:
- This slice improves effect-row interpretability for copied mode-choice prose. It does not claim that Alter Self, Enlarge/Reduce, or Plant Growth have complete runtime mechanics for every option; those remain governed by the broader choice execution, object targeting, terrain, and effect-splitting gaps.

## 2026-06-13 - Current-row effect-description wording cleanup

### SSO-EFFECT-DESCRIPTION-INTERNAL-SCAFFOLD-001 - current-row/current-data wording is now gated and cleaned

Status: verified for the audited phrase family.

Evidence added this pass:
- `src/systems/spells/validation/SpellIntegrityValidator.ts` now rejects remaining importer-facing effect-description phrases that say mechanics are `preserved from the current row` or that `current data keeps` deferred behavior.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a failing-first unit proof for `preserved from the current row`, plus the existing all-spell description corpus gate covers the cleaned data.
- `public/data/spells/level-3/conjure-animals.json`, `public/data/spells/level-4/charm-monster.json`, and `public/data/spells/level-4/dominate-beast.json` now use player/runtime-facing effect descriptions while preserving their existing modeled saves, duration, target restrictions, scaling, and deferred mechanics.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because `preserved from the current row` was not rejected.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 19 tests.
- `npm run validate:spells -- --spell public/data/spells/level-3/conjure-animals.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-4/charm-monster.json` reported 459 valid / 0 invalid.
- `npm run validate:spells -- --spell public/data/spells/level-4/dominate-beast.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.
- Required dependency sync completed for `src/systems/spells/validation/SpellIntegrityValidator.ts`.

Remaining boundary:
- This closes only the audited current-row/current-data phrase family. Long single-effect prose and intentionally broad narrative utility effects remain tracked separately under monolithic/effect-splitting work rather than being rewritten in this description cleanup.

## 2026-06-13 - Spell attack hit-event producer parity

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - hit-conditioned spell attacks now publish structured hit events

Status: verified for factory-created hit-conditioned spell attack damage; true spell-attack miss-roll producer remains open.

Evidence added this pass:
- `src/commands/effects/DamageCommand.ts` now emits a structured `unit_attack` event when a damage row is both hit-conditioned and backed by a melee/ranged spell attack marker from `CommandContext.attackType`.
- The emitted event carries `attackType: spell`, the spell attack's melee/ranged `weaponType`, `isHit: true`, and the current critical flag, matching the event facts that Armor-style reactive consumers already use for weapon attacks.
- The bridge deliberately does not invent spell-attack miss rolls. It only records confirmed spell hits at the shared damage-resolution point until a dedicated spell attack roll command exists.
- `src/commands/__tests__/SpellCommandFactory.test.ts` now proves the real `SpellCommandFactory -> DamageCommand.execute(...)` path emits a ranged spell `unit_attack` event for a Chromatic Orb-style hit-conditioned damage row.

Verification:
- Red run: `npm run test -- src/commands/__tests__/SpellCommandFactory.test.ts` failed because `combatEvents.getDispatchLog()` was `[]` after the spell attack damage command resolved.
- Green run: `npm run test -- src/commands/__tests__/SpellCommandFactory.test.ts` passed 12 tests.
- Combined proof: `npm run test -- src/commands/__tests__/SpellCommandFactory.test.ts src/commands/__tests__/DamageCommand.test.ts src/systems/events/__tests__/CombatEvents.test.ts src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts src/hooks/__tests__/useAbilitySystem.test.ts` passed 63 tests with 2 skipped.
- `npm run test:types` passed.
- Required dependency sync completed for `src/commands/effects/DamageCommand.ts`.

Remaining boundary:
- This narrows broader attack producer parity but does not claim true spell-attack miss handling. Current spell attack damage rows only publish confirmed hits after they resolve; a future spell attack roll producer should emit both hits and misses if/when the runtime models spell attack accuracy before damage.

## 2026-06-13 - Order-safe Armor reactive handoff

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - command attack results now replay into reactive executor path

Status: verified for current command-backed weapon attack handoff; broader spell/attack producer parity remains open.

Evidence added this pass:
- `src/types/combat.ts` now has `CombatAction.suppressAbilityEvents` and `CombatAction.reactiveEventsOnly` flags so command-backed attacks can spend/record once, then replay only reactive effects after attack rolls are known.
- `src/hooks/combat/useActionExecutor.ts` now skips premature ability reactive events when `suppressAbilityEvents` is set, and supports `reactiveEventsOnly` actions that do not spend resources or record a second normal action.
- `src/hooks/useAbilitySystem.ts` now suppresses the first ability-reactive pass for command-backed ability execution, snapshots the combat event trace before command execution, projects command-emitted `unit_attack` events into `attackResults`, and sends a reactive-only action carrying those results after commands finish.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now proves the hook sends the first action with `suppressAbilityEvents: true`, then sends a second `reactiveEventsOnly` action with projected hit/miss plus attack filter facts.

Verification:
- Red run: `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` failed because only the pre-command action was sent.
- Green run: `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` passed 19 tests with 2 skipped.
- Combined proof: `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts src/systems/events/__tests__/CombatEvents.test.ts src/commands/factory/__tests__/AbilityCommandFactory.test.ts` passed 49 tests with 2 skipped.
- `npm run test:types` passed.
- Required dependency sync completed for `src/hooks/useAbilitySystem.ts`, `src/hooks/combat/useActionExecutor.ts`, and `src/types/combat.ts`.

Remaining boundary:
- The current command-backed weapon attack handoff is now order-safe for Armor-style hit-only retaliation. Keep the broader row open only for parity checks on other attack producers, especially spell-attack producers or future systems that emit `unit_attack` events outside `WeaponAttackCommand`.

## 2026-06-13 - Reactive consumer prefers explicit attack-result filter facts

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - action executor now honors enriched attackResults before ability fallback

Status: narrowed; final hook-order attachment remains open.

Evidence added this pass:
- `src/hooks/combat/useActionExecutor.ts` now looks up a target's explicit `attackResults` entry before applying `on_target_attack` reactive filters.
- When `attackResults.weaponType` or `attackResults.attackType` is present, those facts win over the legacy ability range/type fallback for melee/ranged and weapon/spell filtering.
- Legacy callers that do not provide enriched `attackResults` keep the existing fallback behavior.
- `src/hooks/combat/__tests__/useActionExecutor.test.ts` now proves a hit result marked `weaponType: ranged` does not trigger melee-only Armor of Agathys-style retaliation, even when the legacy ability shape has melee range.
- The two Sneak Attack proofs in the touched command-factory suite are now deterministic so random misses no longer block unrelated attack-event/reactive proof.

Verification:
- Red run: `npm run test -- src/hooks/combat/__tests__/useActionExecutor.test.ts` failed because melee-only retaliation still fired from fallback ability range despite `attackResults.weaponType: ranged`.
- Green run: `npm run test -- src/hooks/combat/__tests__/useActionExecutor.test.ts` passed 18 tests.
- Combined proof: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts` passed 30 tests.
- `npm run test:types` passed.
- Required dependency sync completed for `src/hooks/combat/useActionExecutor.ts`.

Remaining boundary:
- `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001` remains open for the final order-safe attachment from command-side events/results into the action executor path. The consumer now honors enriched payloads correctly once it receives them.

## 2026-06-13 - Attack-result projection preserves filter facts

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - projected attackResults now carry hit/miss plus attack filter facts

Status: narrowed; final reactive consumer bridge remains open.

Evidence added this pass:
- `src/systems/events/CombatEvents.ts` now preserves `attackType` and `weaponType` when `getAttackResultsSince(...)` projects structured `unit_attack` events into attack-result payloads.
- `src/types/combat.ts` now allows `CombatAction.attackResults` entries to carry those same `attackType` and `weaponType` facts.
- `src/systems/events/__tests__/CombatEvents.test.ts` now proves a missed melee weapon event projects to an attack result with `isHit: false`, `isCritical: false`, `attackType: weapon`, and `weaponType: melee`.

Verification:
- Red run: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts` failed because the projection dropped `attackType` and `weaponType`.
- Green run: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts` passed 1 test.
- Combined proof: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts` passed 29 tests.
- `npm run test:types` passed.
- Required dependency sync completed for `src/systems/events/CombatEvents.ts` and `src/types/combat.ts`.

Remaining boundary:
- This still does not close `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`. The structured attack-result payload now has the facts a consumer needs, but `useAbilitySystem` and/or the reactive executor still need the final order-safe handoff so Armor-style hit-only retaliation consumes those results before applying damage.

## 2026-06-13 - Attack-result event filter facts

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - attack events now carry weapon/spell and melee/ranged facts

Status: narrowed; broader reactive consumer bridge remains open.

Evidence added this pass:
- `src/systems/events/CombatEvents.ts` now allows `unit_attack` events to carry `attackType` (`weapon`, `spell`, or `any`) and `weaponType` (`melee`, `ranged`, or `any`).
- `src/commands/factory/AbilityCommandFactory.ts` now emits those fields from `WeaponAttackCommand` using the same ability classification already used by attack-rider matching.
- `src/commands/factory/__tests__/AbilityCommandFactory.test.ts` now proves a forced missed melee weapon attack emits `isHit: false`, `isCrit: false`, `attackType: weapon`, and `weaponType: melee`.
- The adjacent-ally Sneak Attack proof in the touched test file is now deterministic for the actual adjacent-ally case, preventing random misses from blocking unrelated command/event proof.

Verification:
- Red run: `npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts` failed because the structured attack event lacked `attackType` and `weaponType`.
- Green run: `npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts` passed 11 tests.
- Combined proof: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts` passed 29 tests.
- `npm run test:types` passed.
- Required dependency sync completed for `src/systems/events/CombatEvents.ts` and `src/commands/factory/AbilityCommandFactory.ts`.

Remaining boundary:
- This still does not close `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`. Event-side attack facts now include hit/miss, weapon/spell, and melee/ranged data, but `useAbilitySystem`/reactive consumers still need the final safe handoff that applies those facts before Armor-style hit-only retaliation resolves.

## 2026-06-13 - Attack-result event bridge helper

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - event bus can project attack events into attackResults

Status: narrowed; broader reactive handoff remains open.

Evidence added this pass:
- `src/systems/events/CombatEvents.ts` now exposes `getAttackResultsSince(...)`, which projects structured `unit_attack` events emitted after a captured sequence number into the compact `CombatAction.attackResults` shape.
- The helper supports attacker and target filtering, so command-style attack consumers can isolate only the hit/miss facts produced by the command they just ran.
- `src/systems/events/__tests__/CombatEvents.test.ts` now proves a missed command-style attack event becomes `{ targetId, isHit: false, isCritical: false }` without scraping combat-log prose.

Verification:
- Red run: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts` failed because `getAttackResultsSince` did not exist.
- Green run: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts` passed 1 test.
- Combined proof: `npm run test -- src/systems/events/__tests__/CombatEvents.test.ts src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts` passed 29 tests.
- `npm run test:types` passed.
- Required dependency sync completed with `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/systems/events/CombatEvents.ts`.

Remaining boundary:
- This still does not close `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`. The event bus can now turn command-side hit/miss events into `attackResults`, and weapon attacks now emit those events, but `useAbilitySystem` still needs a safe order/consumer bridge so Armor-style hit-only retaliation reads the results before applying reactive damage.

## 2026-06-13 - Weapon attack-result event producer

### SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 - command-side weapon attacks now publish hit/miss events

Status: narrowed; broader attack-result handoff remains open.

Evidence added this pass:
- `src/commands/factory/AbilityCommandFactory.ts` now emits a structured `unit_attack` combat event from `WeaponAttackCommand` at the point the real weapon attack roll resolves.
- The emitted event carries `attackerId`, `targetId`, `isHit`, and `isCrit`, so attack-result subscribers no longer need to infer hit/miss from prose combat logs for command-side weapon attacks.
- `src/commands/factory/__tests__/AbilityCommandFactory.test.ts` now has a failing-first proof for a forced missed weapon attack publishing `isHit: false` and `isCrit: false`.
- The existing adjacent-ally Sneak Attack proof in the same touched test file is now deterministic by forcing the base attack to hit; this preserves the adjacent-ally gate assertion without depending on random attack accuracy.

Verification:
- Red run: `npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts` failed because no `unit_attack` event was emitted for the command-side missed attack.
- Green run: `npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts` passed 11 tests after the event emission.
- Combined proof: `npm run test -- src/commands/factory/__tests__/AbilityCommandFactory.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts` passed 28 tests.
- `npm run test:types` passed.
- Required dependency sync completed with `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/commands/factory/AbilityCommandFactory.ts`.

Remaining boundary:
- This does not yet close `SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001`. Command-side weapon attacks now publish structured hit/miss facts, but the broader handoff still needs those facts to be bridged consistently into `CombatAction.attackResults` or equivalent reactive consumers before Armor-style hit-only retaliation can be claimed end-to-end for every live attack path.

## 2026-06-13 - Restricted-filter classification reason metadata

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - validator exceptions now carry category and reason details

Status: verified.

Evidence added this pass:
- `src/systems/spells/validation/SpellIntegrityValidator.ts` now exposes `getClassifiedRestrictedFilterMismatchDetails()` with a key, category, and reason for every current classified restricted-filter semantic exception.
- `getClassifiedRestrictedFilterMismatchKeys()` now derives from those detail rows, so the production validator and corpus guard still share one validator-owned source instead of maintaining a second key-only list.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now proves the detail API explains Shapechange's Construct/Undead mismatch as `form-choice eligibility` rather than a direct effect-target omission.

Verification:
- Red run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` failed because `getClassifiedRestrictedFilterMismatchDetails()` did not exist.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 18 tests.
- `npm run validate:spells -- --spell public/data/spells/level-9/shapechange.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.
- Required dependency sync completed with `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/systems/spells/validation/SpellIntegrityValidator.ts`.

Remaining boundary:
- `SSO-SPELL-FILTER-DATA-COMPLETENESS-001` remains open for the actual semantic models: plant/object target eligibility, chosen-kind aura targeting, form-choice eligibility, created-creature repair targeting, and ongoing area size semantics. This pass made the exceptions explainable and executable; it did not copy filters onto rows whose target semantics are still different.

## 2026-06-13 - Tsunami size-filter normalization

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - Huge-or-smaller text now matches concrete size filters

Status: verified.

Evidence added this pass:
- `src/systems/spells/validation/SpellIntegrityValidator.ts` now normalizes size-filter text that starts with `Huge or smaller` to the concrete creature sizes `Huge`, `Large`, `Medium`, `Small`, and `Tiny`.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now has a focused regression proving that spell-level `Huge or smaller ...` text and effect-level concrete sizes are treated as equivalent.
- `tsunami:2:sizes` was removed from `getClassifiedRestrictedFilterMismatchKeys()` because the ongoing wall-movement damage row already carries the concrete size gate and no longer needs to be classified as unresolved debt.

Verification:
- Red run: the new validator test failed because `Huge or smaller` text was not normalized.
- Green run: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 17 tests.
- `npm run validate:spells -- --spell public/data/spells/level-8/tsunami.json` reported 459 valid / 0 invalid.
- `npm run test:types` passed.

Remaining boundary:
- `SSO-SPELL-FILTER-DATA-COMPLETENESS-001` remains open for the other classified semantic rows, but the Tsunami ongoing damage size-normalization case is no longer one of them.

## 2026-06-13 - Restricted-filter classification helper refactor

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - validator-owned classification helper added, verification blocked

Status: verified.

Evidence added this pass:
- `src/systems/spells/validation/SpellIntegrityValidator.ts` now exposes `getClassifiedRestrictedFilterMismatchKeys()` as the validator-owned source of truth for the 15 classified restricted-filter semantic exceptions.
- `SpellIntegrityValidator.validate(...)` now consumes that helper instead of maintaining a private duplicated set.
- `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` now checks the helper is exposed, uses it in the corpus restricted-filter guard, and fails if a classified exception becomes stale after future data/modeling work.

Verification status:
- The local runner recovered, and `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 16 tests.
- `npm run validate:spells -- --spell public/data/spells/level-2/animal-messenger.json` reported 459 valid / 0 invalid through the production validator path.
- `npm run test:types` passed.
- Required dependency sync completed with `npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync src/systems/spells/validation/SpellIntegrityValidator.ts`.

Next action:
- Keep `SSO-SPELL-FILTER-DATA-COMPLETENESS-001` open for the semantic models named in the residual classification, but treat the helper refactor itself as verified.

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| SSO-FAMILIAR-SHARED-SENSES-OBSERVER-001 | waiting | in_scope_now | Worker D | `src/commands/effects/FamiliarSharedSensesCommand.ts`, `src/components/BattleMap`, `src/hooks/combat/useVisibility.ts`, visibility observer policy | `SSO-FAMILIAR-SHARED-SENSES-001` implementation slice | Shared-senses activation now writes a caster `ActiveEffect` naming the familiar as observer, and the shared 2D/3D visibility observer policy consumes that effect. The slice is still unverified and needs rendered proof. | `src/commands/effects/FamiliarSharedSensesCommand.ts`; `src/types/combat.ts`; `src/commands/factory/AbilityCommandFactory.ts`; `src/components/BattleMap/visibilityObserverPolicy.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `docs/tasks/spell-system-overhaul/COMBAT_MAP_PRESENTATION_MATRIX.md`; `docs/tasks/spell-system-overhaul/SUMMONING_RUNTIME_BOUNDARY.md`. | Find Familiar is not complete if the runtime can say "use familiar senses" but the player cannot see that the combat map is using the familiar viewpoint. | Run focused proof for the observer policy, then render-check the 2D and 3D labels/visibility behavior. | Rendered proof in both 2D and 3D that activation changes or clearly labels the observer as the familiar, plus proof that expiry returns the view to normal. |
| SSO-ONMOVEINAREA-001 | done | in_scope_now | Working agent | `src/systems/spells/validation`, `src/systems/spells/effects`, `src/types/spells.ts` | this pass; verified 2026-06-11 | The trigger `on_move_in_area` is runtime-supported, validator/type-accepted, and covered by focused trigger/type proof. | `src/systems/spells/validation/spellValidator.ts`; `src/types/spells.ts`; `src/types/__tests__/spells.test-d.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `src/systems/spells/effects/AreaEffectTracker.ts`; `src/systems/spells/effects/triggerHandler.ts`; `docs/tasks/spell-system-overhaul/TODO.md` (`geometry-zone-aoe-fidelity`). | Validation/type mismatch no longer hides real area-move mechanics behind schema failures, TypeScript cast pressure, or manual fallback behavior. | Completed: reopen only if a new trigger vocabulary drift appears. | `npm run test -- src/systems/spells/validation/__tests__/effectTriggers.test.ts` passed 1 test, `npm run test:types` passed, and `npm run validate:spells -- --spell public/data/spells/level-1/grease.json` reported 459 valid / 0 invalid on 2026-06-11. |
| SSO-OBJECT-TARGET-001 | Object-target spells still needed an explicit path from map/world objects into spell targeting. | Partly implemented. Generated battle maps now publish generated obstacles as explicit fixed `BattleMapData.targetableObjects` entries, and `ObjectTargetRegistry` now converts explicitly positioned loose `Item` inputs into movable object candidates with weight/magic/fixed/worn facts. Remaining work: live loot/drop/inventory/world placement systems must provide positioned loose-item inputs; fixed terrain props intentionally do not satisfy loose-object spell cases. | Gameplay breadth / UX | Open | High | 2026-06-12 |
| SSO-LOOSE-OBJECT-PRODUCER-001 | Loose, dropped, inventory, scripted, or room/world-specific objects do not yet publish explicit object facts for spells that require movable or weight-limited targets. | Partly implemented. The spell-side adapter now accepts explicit `looseItems` entries containing an `Item`, position, optional instance id, size, worn/carried override, and fixed-surface override, then emits movable `TargetableObject` candidates using `Item.weight` and `Item.magicProperties`. Remaining work: connect real loot/drop/inventory/world placement producers so unpositioned item results become explicit positioned inputs only when they are actually on the map. | Targeting architecture / object spell breadth | Open | High | 2026-06-12 |
| SSO-MONOLITHIC-EFFECTS-001 | open | support_needed_now | Worker D | `src/systems/spells/validation`, `docs/tasks/spell-system-overhaul/gaps`, spell JSON migration | this pass + `LEVEL-1-GAPS`/`GAP-UNSPLIT-SPELL-EFFECTS` notes; re-investigated 2026-06-01 | Monolithic-effect debt remains open, but the audit infrastructure is more complete than the preserved gap note says. `SpellIntegrityValidator` already has normalized duplicate-description detection, and `SpellIntegrityValidator.test.ts` already scans all spell levels and emits a soft warning hit list. The historic 113 count was not rerun in this pass and should be treated as last-known, not current proof. | `docs/tasks/spell-system-overhaul/gaps/GAP-UNSPLIT-SPELL-EFFECTS.md`; `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; static monolithic search from 2026-06-01. | Generic or one-block effects reduce deterministic execution, per-effect UI clarity, and combat-map visualization fidelity. | Resolve `SSO-MONOLITHIC-HITLIST-PROOF-001`, then work `SSO-MONOLITHIC-CONVERSION-QUEUE-001` against the captured current hit list. | Focused integrity test output with current monolithic count, then per-spell conversion proof with schema validation for converted files. |
| SSO-EFFECT-DESCRIPTION-INTERNAL-SCAFFOLD-001 | done | support_needed_now | Working agent | `src/systems/spells/validation`, spell JSON effect descriptions | highest-impact local description-quality pass 2026-06-13 | Thirty-four non-blank effect descriptions still leaked importer or migration wording such as `row's current hit-based resolution`, `row's summoning effect`, `always-on ... scaffold`, `current escape-check metadata`, or `Per ray hit`. Those rows now use player/runtime-facing wording while preserving the existing modeled dice, saves, duration, scaling, and known not-modeled-yet boundaries. | `src/systems/spells/validation/SpellIntegrityValidator.ts`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; affected spell JSON rows across levels 0-7. | Blank descriptions were already closed, but internal scaffold prose still made logs, UI rows, and future audits interpret migration history instead of spell behavior. | Completed for the audited phrase family. Future cleanup should extend the validator phrase list only when a new corpus audit finds another concrete importer-facing pattern. | Red proof first showed the validator returned `[]` for `row's current hit-based resolution`; green proof passed after adding the rule and data cleanup. `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 10 tests, `npm run validate:spells -- --spell public/data/spells/level-2/scorching-ray.json` reported 459 valid / 0 invalid, and `npm run test:types` passed on 2026-06-13. |
| SSO-MONOLITHIC-HITLIST-PROOF-001 | waiting | support_needed_now | Worker D | `SpellIntegrityValidator.test.ts`, monolithic-effect audit | `SSO-MONOLITHIC-EFFECTS-001` refresh | The soft all-spell monolithic test exists and prints the hit list, but it was not run in this pass. The preserved `113` count may be stale after later spell migrations. | `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `src/systems/spells/validation/SpellIntegrityValidator.ts`; `GAP-UNSPLIT-SPELL-EFFECTS.md`. | Conversion work needs the current hit list, not an old count, or agents may repair already-fixed spells and miss newly introduced ones. | Run the focused integrity test when verification is allowed and capture the warning output/count in `AUDIT_OR_PROOF.md`. | `npx vitest src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts --run` output showing current monolithic failures. |
| SSO-MONOLITHIC-CONVERSION-QUEUE-001 | open | support_needed_now | Worker D | spell JSON files, effect component migration | `SSO-MONOLITHIC-EFFECTS-001` refresh | Once the current hit list is captured, monolithic spells still need conversion into discrete `SpellEffect` components. The preserved gap note proposes priority ordering but no current queue artifact was found in this pass. | `GAP-UNSPLIT-SPELL-EFFECTS.md`; current monolithic hit list after `SSO-MONOLITHIC-HITLIST-PROOF-001`; `src/types/spells.ts`; `SpellValidator`. | Without a queue, conversions will be ad hoc and may skip high-impact playable combat spells. | Create a prioritized conversion queue from the current hit list, ordered by playable combat relevance, level, and `UTILITY` masking risk. | Queue document plus first converted spell passing spell-only validation. |
| SSO-CHOICE-SPELLS-001 | open | adjacent_follow_up | Worker D | `src/systems/spells`, `src/commands/factory`, `src/hooks` | this pass (`GAP-CHOICE-SPELLS.md`); refreshed 2026-06-01 | Choice support is partially implemented, not absent. `modeChoice` is typed, validated, schema-backed, present in real spell data, and consumed by command creation when `playerInput` is supplied; `perTargetChoice` exists in data/schema for Enhance Ability but has no execution/UI consumer found in the bounded search. | `docs/tasks/spell-system-overhaul/gaps/GAP-CHOICE-SPELLS.md`; `src/types/spells.ts`; `src/systems/spells/validation/modeChoiceSchemas.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`; `public/data/spells/level-2/blindness-deafness.json`; `public/data/spells/level-2/enhance-ability.json`. | Modal choices now have a real command-layer foothold, but structured execution still depends on caller-supplied input and does not yet cover per-target choices. | Ability-bridge parity, hook-level choice collection, and Enhance Ability command/runtime application are now verified; rendered mode-choice UI/status visibility proof remains before claiming end-to-end choice handling. | Mode-choice factory, ability-bridge parity, hook-level mode/per-target choice tests, Enhance Ability factory/runtime proof, and ability-check consumer proof passed on 2026-06-11; remaining proof is rendered mode-choice UI/status visibility. |
| SSO-MODECHOICE-UI-INPUT-001 | waiting | support_needed_now | Worker D | `src/hooks/useAbilitySystem.ts`, `src/components/BattleMap/AISpellInputModal.tsx`, combat ability UI, `src/commands/factory/SpellCommandFactory.ts` | implemented slice 2026-06-01; hook proof verified 2026-06-11; rendered proof pending | `SpellCommandFactory` can filter `modeChoice` by `playerInput`, `spellAbilityFactory` preserves the menu on generated abilities, and `useAbilitySystem` now pauses mode-choice spell execution to request a selected option before command creation. `AISpellInputModal` renders structured mode buttons for `spell.modeChoice` and submits the chosen label. Focused hook coverage now passes and proves mode-choice selection is requested before command creation and passed to `SpellCommandFactory` as `playerInput`. | `src/hooks/useAbilitySystem.ts`; `src/components/BattleMap/AISpellInputModal.tsx`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/utils/character/spellAbilityFactory.ts`. | Mode-choice spells now have a tested hook-level input handoff path, but rendered 2D/3D/modal behavior has not been inspected. | Perform rendered modal/selection inspection when visual verification is allowed; close this row only after selectable mode buttons are proven in the UI. | `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` passed 15 tests with 2 skipped on 2026-06-11 and covers mode-choice `playerInput`; rendered modal proof showing selectable mode buttons remains pending. |
| SSO-PER-TARGET-CHOICE-EXECUTION-001 | waiting | support_needed_now | Worker D | `src/types/spellTargeting.ts`, `src/systems/spells/validation/targetingSchemas.ts`, `src/hooks/useAbilitySystem.ts`, `src/components/BattleMap/AISpellInputModal.tsx`, `src/commands` | implemented assignment slice 2026-06-01; hook proof verified 2026-06-11; runtime application proof pending | `perTargetChoice` is typed/schema-backed and used by `enhance-ability.json`. `useAbilitySystem` now collects single-target choices and sequential multi-target choices through the existing input modal, then passes single-target `playerInput` or a spell-clone `perTargetChoicesByTargetId` payload into command creation. Focused hook coverage now passes for single-target option handoff and multi-target target-indexed assignments. | `public/data/spells/level-2/enhance-ability.json`; `src/types/spellTargeting.ts`; `src/systems/spells/validation/targetingSchemas.ts`; `src/hooks/useAbilitySystem.ts`; `src/components/BattleMap/AISpellInputModal.tsx`; `src/hooks/__tests__/useAbilitySystem.test.ts`. | Target-indexed assignment has tested hook handoff and verified Enhance Ability command/runtime application; rendered status visibility remains separate. | Inspect rendered status visibility under combat-map visualization work; command/runtime application is now covered by `SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001`. | `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` passed 15 tests with 2 skipped on 2026-06-11 and covers single-target `playerInput` plus multi-target `perTargetChoicesByTargetId`; Enhance Ability command/runtime proof and ability-check consumer proof passed on 2026-06-11. |
| SSO-ENHANCE-ABILITY-EFFECT-APPLICATION-001 | done | support_needed_now | Working agent | `src/commands/factory/SpellCommandFactory.ts`, `src/commands/effects/EnhanceAbilityCommand.ts`, ability-check modifiers, combat-map status visibility | implemented slice 2026-06-01; command/runtime verified 2026-06-11 | `EnhanceAbilityCommand` consumes `perTargetChoicesByTargetId`, adds the chosen ability-check advantage text to each target, and leaves a visible `Enhance Ability (<ability>)` buff status for UI/combat-map consumers. `rollAbilityCheck` now treats ability-specific modifier text as targeted rather than global, so Strength-only Enhance Ability advantage does not leak to Dexterity checks. | `public/data/spells/level-2/enhance-ability.json`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/effects/EnhanceAbilityCommand.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`; `src/utils/character/checkUtils.ts`; `src/utils/character/__tests__/checkUtils.test.ts`; `src/types/combat.ts`. | Enhance Ability can target different creatures with different ability-check advantage choices and the ability-check roller consumes those modifiers correctly. Rendered 2D/3D status visibility remains tracked under combat-map visualization rows. | Completed: focused factory/runtime proof and ability-check consumer proof passed; inspect 2D/3D status visibility under `SSO-COMBAT-MAP-VISUALIZATION-001`. | `npm run test -- src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` passed 6 tests on 2026-06-11; `npm run test -- src/utils/character/__tests__/checkUtils.test.ts` passed 1 test on 2026-06-11; dependency sync ran for `src/utils/character/checkUtils.ts`. |
| SSO-EXECUTION-SPLIT-001 | open | support_needed_now | Worker D | `src/commands/factory`, `src/hooks`, `src/utils/character` | this pass (`TODO.md` high-priority); refreshed 2026-06-01 | The old `SpellExecutor` TODO is partly stale: rich combat execution already runs through `useAbilitySystem` -> `SpellCommandFactory.createCommands(...)` -> `CommandExecutor.execute(...)`. The real remaining split is orchestration ownership and parity with the separate `spellAbilityFactory` bridge/preview path. | `docs/tasks/spell-system-overhaul/TODO.md` (`spell-executor-integration`); `src/hooks/useAbilitySystem.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/utils/character/spellAbilityFactory.ts`; bounded source searches from 2026-06-01. | Creating a broad new coordinator without a slice contract could duplicate working command orchestration; ignoring the split can still leave previews, AI callers, tests, and command execution disagreeing. | Concrete follow-ups `SSO-ABILITY-BRIDGE-PARITY-001` and `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001` are verified; remaining work is any accepted coordinator/orchestration decision. | Ability bridge and command game-state context proofs are captured; remaining proof depends on a coordinator/orchestration decision, if one is accepted. |
| SSO-ABILITY-BRIDGE-PARITY-001 | done | support_needed_now | Working agent | `src/utils/character/spellAbilityFactory.ts`, ability preview/selection surfaces | implemented slice 2026-06-01; verified 2026-06-11 | `spellAbilityFactory` preserves the original structured `spell` and `modeChoice` metadata on generated spell abilities, so preview/selection surfaces can expose the same choice menu that `SpellCommandFactory` later consumes through `playerInput`. | `src/utils/character/spellAbilityFactory.ts`; `src/utils/character/__tests__/spellAbilityFactory.test.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`. | Players/AI can receive choice metadata from the ability bridge instead of a flattened generic status preview; normal UI choice collection remains tracked under `SSO-MODECHOICE-UI-INPUT-001`. | Completed: focused ability-bridge and command-factory mode-choice tests passed; continue broader choice work through UI input and per-target execution rows. | `npm run test -- src/utils/character/__tests__/spellAbilityFactory.test.ts` passed 6 tests on 2026-06-11; `npm run test -- src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` passed 6 tests on 2026-06-11. |
| SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001 | done | support_needed_now | Working agent | `src/hooks/useAbilitySystem.ts`, `src/commands/factory/SpellCommandFactory.ts`, `src/commands/factory/AbilityCommandFactory.ts` | implemented slice 2026-06-01; verified 2026-06-12 | `useAbilitySystem` passes command factory creation a command context carrying current combat characters, `mapData`, and `currentPlane`, matching the temporary `CombatState` used for execution. | `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/factory/AbilityCommandFactory.ts`. | Map-aware command creation, arbitration, cover, terrain, area, and visual spell setup can inspect the current combat environment before execution instead of losing context at factory time. | Completed: keep any broader coordinator/orchestration decision under `SSO-EXECUTION-SPLIT-001`. | `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` passed 15 tests with 2 skipped on 2026-06-12 and includes proof that `SpellCommandFactory.createCommands(...)` receives the current `mapData`. |
| SSO-COMBAT-MAP-VISUALIZATION-001 | waiting | in_scope_now | Worker D | `src/components/BattleMap`, `src/hooks/combat`, 2D/3D VFX surfaces | user scope check; refreshed 2026-06-01 | Every structured spell gap must answer the player-facing question: what does this look like on the combat map in both 2D and 3D? Several slices expose zones, movement, teleport assignment, save/resist/immune text, target-bound markers, rider markers, and 3D concentration/status labels, but rendered 2D/3D proof has not been run and the project still lacks a per-spell/effect presentation matrix. | `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/DamageNumberOverlay.tsx`; `SSO-COMBAT-MAP-PRESENTATION-MATRIX-001`; visual progress notes below; `AUDIT_OR_PROOF.md` visual evidence notes. | Structured execution is not complete if it only changes hidden state; players need map-visible targeting, affected areas, selected destinations, persistent effects, saves, resistances, immunity, cleanup, and timing cues in both renderers. | Treat 2D/3D map appearance as a required checklist item for each future spell gap; create the presentation matrix, then run rendered inspection of current visual slices and split unclear or missing visuals into narrower gaps. | Rendered 2D/3D inspection evidence for active zones, teleport assignment, forced movement, target-bound delayed effects, save/resist/immune feedback, rider/concentration/status cleanup, and cleanup after expiration/concentration break. |
| SSO-COMBAT-MAP-PRESENTATION-MATRIX-001 | waiting | in_scope_now | Worker D | spell data, effect taxonomy, 2D/3D combat-map renderers | matrix v0 created 2026-06-01; rendered proof pending | `COMBAT_MAP_PRESENTATION_MATRIX.md` now classifies spell/effect presentation states across no-map, instant feedback, targeting preview, persistent zone, token/object, status marker, and hybrid cases, with 2D/3D expectations and proof probes. It is effect-category-first, not a complete spell-by-spell audit. | `COMBAT_MAP_PRESENTATION_MATRIX.md`; `SSO-COMBAT-MAP-VISUALIZATION-001`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; spell JSON effect taxonomy. | The project now has a reusable visual checklist, but agents still need to fill spell-specific rows and capture rendered proof before claiming visual parity. | Use the matrix during each future spell-gap slice; expand it with concrete spell rows as categories are audited, and split missing visuals into narrower implementation gaps. | Matrix artifact plus rendered 2D/3D proof for representative no-map, instant-feedback, targeting-preview, persistent-zone, summoned-token/object, status-marker, and cleanup cases. |
| SSO-LIGHT-SOURCE-STATE-AND-MAP-VISUALS-001 | waiting | in_scope_now | Worker D | `src/commands/effects/UtilityCommand.ts`, `src/hooks/useAbilitySystem.ts`, combat-map renderers, visibility system | implementation + proof guards added 2026-06-01; verification pending | Structured light sources are now live-map-owned by `useTurnManager`. `useAbilitySystem` seeds command execution with current lights, publishes command-result light arrays after spell/ability execution and manual concentration drops, and the 2D/3D renderers receive active lights. `BattleMapOverlay` now renders bright/dim light radii, and `VFXSystem` now renders 3D light rings, glow, and a `LIGHT` label. Focused hook proof has been added for command-created light publication and concentration-drop light cleanup publication, but it has not been run or rendered. | `src/commands/effects/UtilityCommand.ts`; `src/commands/effects/ConcentrationCommands.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/hooks/combat/useTurnManager.ts`; `src/hooks/combat/useVisibility.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/types/combat.ts`. | Concentration cleanup can now remove live light state and associated 2D/3D artifacts, but tests and rendered inspection are still required before claiming light-spell visual parity. | Run focused hook proof and render-check 2D/3D bright/dim light creation and concentration cleanup. | Focused live-state proof for light creation/removal plus rendered 2D/3D proof showing bright/dim light markers disappear when concentration breaks. |
| SSO-LIGHT-VISIBILITY-CONSUMER-INTEGRATION-001 | waiting | support_needed_now | Worker D | `src/hooks/combat/useVisibility.ts`, `src/components/BattleMap`, `src/components/BattleMap/BattleMap3D.tsx`, visibility/fog-of-war UI | implementation + 2D/3D proof guards added 2026-06-01; verification pending | `BattleMap` and `BattleMap3D` now call `useVisibility` with live `activeLightSources` from `useTurnManager`. The 2D tile renderer receives `isVisible` and `lightLevel` props and masks hidden/dim/dark tiles. The 3D VFX layer receives `visibleTiles` and `lightLevels` and renders tile visibility masks for hidden/dim/dark areas. Focused `BattleMapTile` guards cover hidden and dim 2D masks, a focused `BattleMap` guard covers live-light handoff into `useVisibility`, a focused `BattleMap3D` guard covers live-light handoff into `useVisibility` and VFX prop propagation, and a focused `VFXSystem` helper guard covers 3D hidden/dark/dim mask decisions. These tests have not been run, and no rendered inspection has been performed. | `src/hooks/combat/useVisibility.ts`; `src/hooks/combat/__tests__/useVisibility.test.ts`; `src/systems/visibility/VisibilitySystem.ts`; `src/systems/visibility/__tests__/VisibilitySystem.test.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/BattleMapTile.tsx`; `src/components/BattleMap/__tests__/BattleMap.visibility.test.tsx`; `src/components/BattleMap/__tests__/BattleMap3D.visibility.test.tsx`; `src/components/BattleMap/__tests__/BattleMapTile.test.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/components/BattleMap/vfx/__tests__/VFXSystem.visibility.test.ts`; `src/hooks/combat/useTurnManager.ts`. | Light spells can now feed tactical visibility consumers, but focused tests and rendered inspection are still required before claiming fog-of-war or dark/dim/bright visual parity. | Run focused visibility/map consumer proof; render-check dark, dim, bright, and hidden tile presentation in both 2D and 3D; decide whether dev/spectator mode needs a clearer bypass policy. | Focused proof that live `activeLightSources` changes map consumer output for the active viewer, plus rendered 2D/3D proof that dark, dim, bright, and hidden tiles are visually distinct. |
| SSO-VISIBILITY-OBSERVER-POLICY-001 | waiting | support_needed_now | Worker D | `src/components/BattleMap/visibilityObserverPolicy.ts`, `src/components/BattleMap/BattleMap.tsx`, `src/components/BattleMap/BattleMap3D.tsx`, `src/hooks/combat/useVisibility.ts`, combat preview/dev spectator modes | helper extraction slice 2026-06-01; verification pending | Tactical visibility now has a named shared observer-selection helper, so 2D and 3D no longer duplicate the fallback. The helper intentionally preserves the previous behavior: selected character, current turn character, first player, first available character, then `null`. The broader player/dev policy is still unresolved: no explicit decision exists yet for party-shared visibility, enemy-turn behavior, local-player ownership, or developer/spectator full-map preview. | `src/components/BattleMap/visibilityObserverPolicy.ts`; `src/components/BattleMap/BattleMap.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/hooks/combat/useVisibility.ts`; bounded source search for `visibilityObserverId`, `activeCharacterId`, `viewerId`, `spectator`, and `useVisibility`. | The immediate 2D/3D drift risk is reduced, but tactical visibility still needs a product policy before light/darkness can be called player-facing complete across play, preview, and dev contexts. | Add focused observer-helper proof when test edits/runs are allowed; then decide and implement the real observer contract for active player, selected player, party-union visibility, enemy/AI turns, local-player ownership, and dev/spectator full-map override. | Focused observer-selection proof for helper behavior, 2D and 3D handoff proof, plus rendered player-view and dev/spectator-view dark, dim, bright, and hidden tiles. |
| SSO-LOAD-PARITY-001 | done | uncertain | Worker D | `src/context/SpellContext.tsx`, `src/services/SpellService.ts`, `public/data/spells_bundle.json`, `public/data/spells_manifest.json` | this pass; completed 2026-06-01 | Current bundle-vs-manifest ID parity is proven for the checked data: both files expose 459 spell IDs, key comparison reported no differences, and sample area spells exist in both paths. The bundle is intentionally generated from the manifest plus individual spell files. | `src/context/SpellContext.tsx` loads `data/spells_bundle.json`; `src/services/SpellService.ts` resolves via manifest and individual spell paths; `scripts/bundle-static-data.ts`; `scripts/regenerate-manifest.ts`; parity commands captured in `AUDIT_OR_PROOF.md`. | Confirms there is no current missing-spell ID divergence between the eager bundle path and manifest-backed path. | No implementation needed for current parity; continue to run documented manifest regeneration plus static bundling after spell add/remove work. | Static parity check captured; no tests, typecheck, or browser verification run. |
| SSO-AREA-ENTRY-EXIT-001 | Area trigger support is partially implemented, not absent, but duplicated trigger paths and geometry caveats can still make migrated area spells fire inconsistently. | Partly implemented. `AreaEffectTracker` delegates entry, exit, end-turn, and movement-within effect selection to shared `triggerHandler` helpers; `processAreaMoveWithinTriggers(...)` now supports optional explicit movement paths, counts only complete inside-zone path segments, and preserves per-tile movement results, target filters, frequency gates, source context, and status duration for `on_move_in_area` effects. Player map movement now stores the clicked path on `CombatAction.movementPath`, AI movement planning now preserves route paths from its reachable-tile cache, `useActionExecutor` forwards both into zone movement triggers, and command-side movement now uses a shared area-movement bridge for `MovementCommand` push/pull/walking forced movement plus `UtilityCommand` control-option approach/flee movement. Remaining work: wire any other non-map or scripted movement callers where they can supply stepped paths, keep event emission ownership clear, and finish AoE containment/rendered visual proof. | Area/status runtime mechanics | Open | High | 2026-06-12 |
| SSO-REPEAT-SAVE-001 | done | support_needed_now | Working agent | `src/hooks/combat/engine`, `src/hooks/combat/useTurnManager.ts`, `src/hooks/combat/useActionExecutor.ts`, spell status metadata | status refresh from `TODO.md`; verified 2026-06-11 | Repeat saves are implemented and focused-test verified for metadata propagation, real spell factory flow, turn-start lifecycle, primary and additional timings, `on_damage`, `on_action`, scheduled and immediate `after_forced_movement`, check-style repeat saves, line-of-sight prerequisites, progression success thresholds, and known failure outcomes. | `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`; `src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts`; `src/commands/effects/StatusConditionCommand.ts`; `src/commands/effects/__tests__/StatusConditionCommand.test.ts`; `src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts`; `src/types/combat.ts`; `src/types/spells.ts`. | Repeat-save spells no longer need a broad runtime rebuild; remaining caveats are narrower persistence/manual-state and rendered-status follow-ups tracked outside this broad row. | Completed: keep future repeat-save work split into specific new metadata families or visual/persistence caveat rows. | Focused repeat-save family verification on 2026-06-11: StatusConditionCommand 4 tests, useCombatEngine.repeatSaves 9 tests, SpellCommandFactoryStatus 3 tests, useTurnManager.repeatSaves 1 test, useCombatEngine.scheduledEffects 5 tests, and prior useAbilitySystem hook proof 15 passed / 2 skipped. |
| SSO-REPEAT-SAVE-ADDITIONAL-TIMINGS-001 | done | support_needed_now | Working agent | `src/hooks/combat/engine/useCombatEngine.ts`, repeat-save metadata | implemented slice 2026-06-01; verified 2026-06-11 | `RepeatSave.additionalTimings` is typed, schema-backed, used by `tashas-hideous-laughter.json`, and participates in `processRepeatSaves` timing matching through `repeatSaveMatchesTiming(...)`. | `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `public/data/spells/level-1/tashas-hideous-laughter.json`. | Tasha-style effects can declare both end-of-turn and damage-triggered save opportunities through the existing repeat-save engine. | Completed: reopen only if a new `additionalTimings` value appears without runtime coverage. | `npm run test -- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts` passed 9 tests on 2026-06-11, including additional timing coverage. |
| SSO-REPEAT-SAVE-FORCED-MOVEMENT-001 | done | adjacent_follow_up | Working agent | forced movement execution, repeat-save engine, scheduled movement bridge | implemented scheduled bridge 2026-06-01; verified 2026-06-11 | `after_forced_movement` exists in type/schema validation and is used by `compulsion.json`. Scheduled `MOVEMENT` effects invoke repeat-save processing after a forced movement command changes the target tile. | `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts`; `src/commands/effects/MovementCommand.ts`; `public/data/spells/level-4/compulsion.json`. | Compulsion-style delayed movement now has a verified repeat-save bridge. | Completed: immediate command-factory parity is covered by `SSO-REPEAT-SAVE-IMMEDIATE-FORCED-MOVEMENT-001`. | `npm run test -- src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` passed 5 tests on 2026-06-11, including scheduled forced-movement repeat-save coverage. |
| SSO-REPEAT-SAVE-IMMEDIATE-FORCED-MOVEMENT-001 | done | adjacent_follow_up | Working agent | immediate spell command execution, `useAbilitySystem.ts`, repeat-save metadata | implemented slice 2026-06-01; verified 2026-06-11 | Immediate spell execution post-processes forced movement command results: if a target moved and has an `after_forced_movement` save-ends status, it rolls the repeat save and removes the status on success. | `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/base/CommandExecutor.ts`; `src/commands/effects/MovementCommand.ts`; `src/types/spells.ts`; `public/data/spells/level-4/compulsion.json`. | Immediate forced movement honors the same repeat-save timing as scheduled forced movement for current save-ends metadata. | Completed: add a new row only if future spell data introduces progression/check-style immediate after-movement metadata. | `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` passed 15 tests with 2 skipped on 2026-06-11 and includes immediate forced-movement repeat-save coverage. |
| SSO-REPEAT-SAVE-PROGRESSION-001 | done | adjacent_follow_up | Working agent | repeat-save metadata, combat engine status resolution | implemented success-counter slice 2026-06-01; verified 2026-06-11 | Repeat-save progression fields are typed, validated, used by real spell data, carried on `StatusEffect.repeatSaveProgress`, and processed across turns so configured success thresholds remove the effect only after the threshold is reached. | `src/types/combat.ts`; `src/types/spells.ts`; `src/systems/spells/validation/spellValidator.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `public/data/spells/level-6/flesh-to-stone.json`; `public/data/spells/level-5/contagion.json`. | Flesh to Stone-style success counters now have a verified runtime home. | Completed: known failure-threshold outcomes are covered by `SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001`. | `npm run test -- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts` passed 9 tests on 2026-06-11, including threshold progression coverage. |
| SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001 | done | adjacent_follow_up | Working agent | repeat-save metadata, condition transformation runtime | implemented slice 2026-06-01; verified 2026-06-11 | Failure thresholds are counted and the two inspected real-data outcomes have runtime handling: `apply_petrified_condition` replaces the progressing status/condition with Petrified, and `poisoned_duration_lasts_7_days` locks Poisoned to seven-day duration while removing the repeat-save machine. | `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts`; `src/types/combat.ts`; `src/types/spells.ts`; `public/data/spells/level-6/flesh-to-stone.json`; `public/data/spells/level-5/contagion.json`. | Three failed saves can transform runtime state for the known Flesh to Stone and Contagion outcomes. | Completed: add new outcome rows only if inventory finds other `failureOutcome` values. | `npm run test -- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts` passed 9 tests on 2026-06-11, including failure-outcome coverage. |
| SSO-REPEAT-SAVE-INVENTORY-001 | done | support_needed_now | Working agent | `public/data/spells`, repeat-save runtime proof matrix | refreshed static inventory 2026-06-01; runtime families verified 2026-06-11 | Refreshed static spell-data inventory found 52 repeat-save entries across 45 spell files, and focused tests now cover the known metadata families: simple turn timing, additional timings, damage/action timing, line-of-sight prerequisite, after-forced-movement, check-style repeat saves, progression counters, and failure outcomes. | Static Node scan over `public/data/spells/**/*.json`; representative files listed in `AUDIT_OR_PROOF.md`; focused repeat-save tests listed in split rows. | The inventory now functions as a maintained regression map rather than an unverified backlog. | Completed for current known metadata families; reopen or split if new repeat-save metadata shapes appear in spell data. | Focused repeat-save family tests passed on 2026-06-11: StatusConditionCommand 4, useCombatEngine.repeatSaves 9, SpellCommandFactoryStatus 3, useTurnManager.repeatSaves 1, useCombatEngine.scheduledEffects 5, plus useAbilitySystem hook proof 15 passed / 2 skipped. |
| SSO-LOS-COVER-001 | open | support_needed_now | Worker D | `src/systems/spells/targeting`, `src/utils/lineOfSight.ts`, combat targeting hooks | status refresh from `TODO.md` + source TODO search; re-investigated 2026-06-01 | The old "LoS is still permissive" wording is too broad. LoS is partially wired through `TargetResolver`, `useTargetValidator`, teleport destination preview, combat engine repeat saves, and AI/reaction callers. Remaining work is cover adjudication, map-absent/start-end-tile policy, elevation/obscurement nuance, and visual proof. | `docs/tasks/spell-system-overhaul/TODO.md` (`los-and-cover`); `src/systems/spells/targeting/TargetResolver.ts`; `src/utils/spatial/lineOfSight.ts`; `src/utils/spatial/__tests__/lineOfSight.test.ts`; `src/hooks/combat/useTargeting.ts`; `src/hooks/combat/useTargetValidator.ts`; `src/types/combat.ts`; `src/systems/spells/validation/spellValidator.ts`. | Spell validity can still be wrong when cover should grant AC/save bonuses, total cover should block effects, elevation/obscurement should alter visibility, or 2D/3D target previews disagree with command/runtime checks. | `SSO-LOS-POLICY-PARITY-001` is verified; continue with `SSO-COVER-CLASSIFICATION-001` and `SSO-LOS-COVER-MAP-VISUALS-001`. | TargetResolver and line-of-sight focused tests passed on 2026-06-11; remaining proof is cover classification plus rendered 2D/3D blocked/covered target feedback. |
| SSO-LOS-POLICY-PARITY-001 | done | support_needed_now | Working agent | `src/utils/spatial/lineOfSight.ts`, `src/systems/spells/targeting/TargetResolver.ts`, `src/hooks/combat/useTargetValidator.ts` | implemented slice 2026-06-01; verified 2026-06-11 | Runtime and UI mapless LoS policy are aligned for the confirmed mismatch: `TargetResolver` no longer assumes clear LoS when `mapData` is missing for LoS-required creature or object targets, while non-LoS targeting remains usable in mapless combat. | `TargetResolver.hasLineOfSight`; `TargetResolver.test.ts`; `useTargetValidator.getTargetValidation`; `src/utils/spatial/lineOfSight.ts`; `src/utils/spatial/__tests__/lineOfSight.test.ts`. | The hidden runtime-vs-UI mismatch is reduced and covered by focused tests. Broader cover, start/end blocking, elevation/obscurement nuance, and rendered 2D/3D feedback remain split under LoS/cover follow-up rows. | Completed: continue with `SSO-COVER-CLASSIFICATION-001` and `SSO-LOS-COVER-MAP-VISUALS-001` for remaining cover/visual policy. | `npm run test -- src/systems/spells/targeting/__tests__/TargetResolver.test.ts` passed 13 tests and `npm run test -- src/utils/spatial/__tests__/lineOfSight.test.ts` passed 10 tests on 2026-06-11. |
| SSO-COVER-CLASSIFICATION-001 | waiting | support_needed_now | Worker D | `src/utils/combat/combatUtils.ts`, `src/commands/factory/AbilityCommandFactory.ts`, `src/commands/effects/DamageCommand.ts`, spell cover-bypass metadata | implemented slice 2026-06-01; verification pending | Cover is no longer a missing classifier. `calculateCover(...)` exists, cover tests cover clear/half/pillar/mixed/diagonal cases, weapon/ability attack AC already consumes the cover bonus, and `DamageCommand` now applies map cover to Dexterity saving throws unless `cover_bypass` metadata ignores the current cover grade. Remaining gaps are verification, total-cover policy, and map-visible 2D/3D cover feedback. | `src/utils/combat/combatUtils.ts`; `src/utils/combat/__tests__/combatUtils_cover.test.ts`; `src/commands/factory/AbilityCommandFactory.ts`; `src/commands/effects/DamageCommand.ts`; `src/commands/effects/__tests__/DamageCommand.test.ts`; `src/types/spells.ts`; `public/data/spells/cantrips/sacred-flame.json`; `src/systems/spells/validation/spellValidator.ts`. | Spell saves now have a runtime cover path, but without focused proof this can still regress; Sacred Flame-style cover bypass needs test evidence; total cover and 2D/3D cues remain ambiguous. | Run the focused `DamageCommand` cover tests, then split any failure into runtime, type/schema, total-cover, or visual-feedback follow-ups. | Focused DamageCommand save-cover and cover-bypass test results, plus rendered 2D/3D target feedback showing covered versus blocked targets. |
| SSO-LOS-COVER-MAP-VISUALS-001 | open | in_scope_now | Worker D | `src/components/BattleMap`, `src/hooks/combat/useTargetSelection.ts`, 2D/3D targeting surfaces | `SSO-LOS-COVER-001` refresh + combat-map visual parity axis | The combat map can highlight targetable tiles, AoE previews, and teleport destination candidates, but the inspected renderer surfaces do not expose why a target is blocked by LoS or what cover grade applies in either 2D or 3D. | `src/components/BattleMap/BattleMapTile.tsx`; `src/components/BattleMap/BattleMap3D.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/hooks/combat/useTargetValidator.ts`; `SSO-COMBAT-MAP-VISUALIZATION-001`. | The player-facing map can show legal/illegal targeting without explaining obstacle, total-cover, or partial-cover reasons; this undermines tactical clarity even if runtime rules are correct. | After cover/LoS policy is defined, expose blocked/covered target reasons to 2D and 3D targeting feedback instead of only red/valid highlights. | Rendered 2D/3D proof showing blocked LoS, half/three-quarters/total cover, and cover-bypass spell behavior. |
| SSO-CONCENTRATION-LINK-001 | waiting | support_needed_now | Worker D | `src/commands/effects`, `src/commands/factory` | status refresh from `TODO.md`; re-investigated 2026-06-01 | The old "commands don't track effect IDs" claim is stale. `StartConcentrationCommand` now stores `effectIds` by scanning recent combat-log data, and `BreakConcentrationCommand` removes linked riders, status effects, conditions, light sources, and summons. Focused cleanup coverage now exists for linked status/condition, light source, summon, and rider records, and 2D/3D state-driven labels now exist for rider/status/concentration artifacts, but none of this has been run or rendered. | `docs/tasks/spell-system-overhaul/TODO.md` (`concentration-effect-link`); `docs/tasks/spell-system-overhaul/IMPLEMENT-CONCENTRATION-TRACKING.md`; `src/commands/effects/ConcentrationCommands.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/__tests__/Concentration.test.ts`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/types/combat.ts`. | Concentration is a core spell lifetime rule; if linkage misses one effect family or the log shape changes, stale buffs/debuffs/summons/lights can remain after concentration breaks, and players may not see which artifacts remain. | Run the focused concentration cleanup tests when verification is allowed; then render-check 2D/3D rider/status/concentration cleanup and decide whether to keep log-derived collection or replace it with explicit command-result/effect-id propagation. | Command/factory tests proving concentration start, break, and cleanup for status/buff, rider, light, and summon paths; rendered 2D/3D cleanup proof for any map-visible concentration effect. |
| SSO-SPELL-DATA-VALIDATION-001 | waiting | support_needed_now | Worker D | `public/data/spells`, `scripts/validate-data.ts`, `scripts/validateSpellJsons.ts` | status refresh from `TODO.md`; re-investigated 2026-06-01 | The stale TODO list of broken spell JSONs should not drive manual fixes without proof. Current tooling already has a broad data validator (`npm run validate` -> charset, races, spell manifest validation) and a spell-only validator (`scripts/validateSpellJsons.ts`). The previously named files now contain structured effect blocks, but no validation command was run in this pass. | `docs/tasks/spell-system-overhaul/TODO.md` (`spell-data-validation-fixes`); `scripts/validate-data.ts`; `scripts/validateSpellJsons.ts`; `package.json`; `public/data/spells/level-1/find-familiar.json`; `mage-armor.json`; `shield.json`; `shield-of-faith.json`; `tensers-floating-disk.json`; `unseen-servant.json`. | Stale validation claims can waste effort or hide real blockers; broad validation can also fail for charset/race issues unrelated to spell JSON shape. | When verification is allowed, run the spell-only validator first, then broad `npm run validate`; split any confirmed failures into per-file rows. | Captured output from `npx tsx scripts/validateSpellJsons.ts` and `npm run validate`, with confirmed failures routed into specific gap rows. |
| SSO-VALIDATION-ACCEPTANCE-ALIGNMENT-001 | open | adjacent_follow_up | Worker D | `SpellValidator`, Jules acceptance criteria, migration workflow docs | `SSO-SPELL-DATA-VALIDATION-001` refresh | A preserved validation-vs-acceptance brief exists, but it explicitly says no completed report was found. Zod validation proves shape, not necessarily mechanical correctness against Jules acceptance criteria. | `docs/tasks/spell-system-overhaul/VALIDATION-ALIGNMENT-ANALYSIS.md`; `docs/tasks/spell-system-overhaul/JULES_ACCEPTANCE_CRITERIA.md`; `scripts/validate-data.ts`; `src/systems/spells/validation/spellValidator.ts`; `scripts/validateSpellJsons.ts`. | Spell JSON can be structurally valid while still mechanically wrong, incomplete, or below acceptance quality. | Revive the alignment audit only after current schema proof is captured; produce or route the missing `VALIDATION-VS-CRITERIA-REPORT.md`. | Report comparing Zod coverage to acceptance criteria, with examples of valid-but-wrong or invalid-but-acceptable spell data if any exist. |
| SSO-STATUS-L0-SYNC-001 | done | adjacent_follow_up | Worker D | `docs/spells`, `public/data/spells/level-0` | status refresh from `TODO.md`; completed 2026-06-01 | `STATUS_LEVEL_0.md` has been refreshed from current folder and manifest evidence: the level-0 folder has 43 spell JSON files and the manifest has 43 level-0 entries. | `docs/tasks/spell-system-overhaul/TODO.md` (`status-level-0-sync`); `docs/spells/STATUS_LEVEL_0.md`; `public/data/spells/level-0`; `public/data/spells_manifest.json`; count commands recorded in `AUDIT_OR_PROOF.md`. | Status documents are evidence buckets; current inventory count now matches source data and should not misroute future cantrip work. | No further action for this count-sync row; per-cantrip gameplay verification remains separate. | Static folder/manifest count proof captured; no tests were required or run. |
| SSO-JSON-SCHEMA-DRIFT-001 | done | support_needed_now | Working agent | `src/systems/spells/schema`, `src/systems/spells/validation` | `SSO-ONMOVEINAREA-001` investigation; verified 2026-06-11 | The schema/validator trigger drift is remediated in current source: schema parts and aggregate schema contain shared trigger modeling, and `on_move_in_area` exists in runtime validator/type test coverage. | `src/systems/spells/schema/parts/20-effect-payloads.json`; `src/systems/spells/schema/spell.schema.json`; `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/__tests__/effectTriggers.test.ts`; `scripts/syncSpellJsonSchemaRegistry.ts`; bounded fixed-string searches from 2026-06-01. | Spell data validation now accepts the current area movement trigger vocabulary instead of silently diverging from runtime effect handling. | Completed: future schema vocabulary changes should include focused validator/type proof and spell JSON validation. | `npm run test -- src/systems/spells/validation/__tests__/effectTriggers.test.ts` passed 1 test and `npm run validate:spells -- --spell public/data/spells/level-1/grease.json` reported 459 valid / 0 invalid on 2026-06-11. |
| SSO-TARGET-ENVELOPE-001 | Spell target selection needed a stable envelope that can preserve creature, object, and point selections beyond the legacy creature-only list. | Implemented for the current combat path. `SelectedSpellTarget` carries creature/object/point refs through action creation, command context, clicked-position helper, hook execution, and live generated maps now provide fixed object candidates through `BattleMapData.targetableObjects`. Broader loose-object producer breadth is tracked separately under `SSO-LOOSE-OBJECT-PRODUCER-001`. | Targeting architecture / future optionality | Done | High | 2026-06-12 |
| SSO-SELECTED-TARGET-ENVELOPE-001 | done | support_needed_now | Working agent | `src/hooks/combat/useTargetSelection.ts`, `src/hooks/combat/useTargetValidator.ts`, `src/hooks/useAbilitySystem.ts`, `src/hooks/actionUtils.ts`, `src/types/combat.ts` | `SSO-TARGET-ENVELOPE-001` refresh; action-envelope bridge added 2026-06-12; command-context bridge added 2026-06-12; registry adapter added 2026-06-12; battle-map object slot added 2026-06-12; click-to-ref helper added 2026-06-12; hook integration verified 2026-06-12 | `CombatAction.selectedSpellTargets` provides a selected-target envelope for creature, object, and point refs while preserving `targetCharacterIds` and `targetPosition`; `CommandContext.selectedSpellTargets` carries that envelope into commands; `ObjectTargetRegistry` supplies explicit positioned object candidates; `BattleMapData.targetableObjects` stores those candidates on live map state; `buildSelectedSpellTargetsForPosition(...)` converts clicked positions into creature/object/point refs; and `useAbilitySystem.selectTarget` now passes registered object refs into combat actions and spell command creation. | `src/types/combat.ts`; `src/types/__tests__/combat-object-targets.test-d.ts`; `src/hooks/actionUtils.ts`; `src/hooks/__tests__/actionUtils.test.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/base/SpellCommand.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/__tests__/SpellCommandFactory.test.ts`; `src/systems/spells/targeting/ObjectTargetRegistry.ts`; `src/systems/spells/targeting/selectedSpellTargets.ts`; `src/systems/spells/targeting/__tests__/selectedSpellTargets.test.ts`; `CombatAction.targetPosition`; `CombatAction.targetCharacterIds`. | Object spells and mixed creature/object spells now have action, command, candidate-adapter, map-storage, click-classification, and hook-emission coverage for selected object identity. | Completed for selected-target envelope; live automatic object population remains under `SSO-OBJECT-TARGET-REGISTRY-001`. | `npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts` passed 16 tests with 2 skipped on 2026-06-12, including proof that a registered map object ref reaches both `onExecuteAction(...)` and `SpellCommandFactory.createCommands(...)`; `selectedSpellTargets.test.ts` passed 3 tests for creature priority, map object refs, and point fallback; `actionUtils.test.ts` passed 2 tests for action envelope creation. |
| SSO-COMMAND-TARGET-ENVELOPE-001 | done | support_needed_now | Working agent | `src/commands/base/SpellCommand.ts`, `src/commands/factory/SpellCommandFactory.ts`, command context, effect commands | `SSO-TARGET-ENVELOPE-001` refresh; selected action envelope added 2026-06-12; verified 2026-06-12 | Command creation now has a parallel selected-target envelope: `CommandContext.selectedSpellTargets` carries creature, object, and point refs while preserving the existing `targets: CombatCharacter[]` path for creature commands. `SpellCommandFactory.createCommands(...)` accepts explicit selected refs, defaults legacy creature calls to creature refs, and mirrors creature filtering into the envelope. | `src/commands/base/SpellCommand.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/__tests__/SpellCommandFactory.test.ts`; `src/types/combat.ts`; `CombatAction.selectedSpellTargets`. | Commands no longer need unsafe casts or bespoke side channels just to inspect selected object/point identity, though object-effect behavior still depends on future object-aware command implementations and registry-backed selection. | Completed for command-context envelope; keep object source/selection under `SSO-OBJECT-TARGET-REGISTRY-001` and `SSO-SELECTED-TARGET-ENVELOPE-001`. | `npm run test -- src/commands/__tests__/SpellCommandFactory.test.ts` passed 11 tests on 2026-06-12, including one object/point selected-target context test and one filtered creature-ref regression; `npm run test -- src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts` passed 9 tests, and `npm run test:types` passed. |
| SSO-VALIDTARGETS-SEMANTICS-001 | done | support_needed_now | Working agent | `src/systems/spells/targeting`, `src/types/spellTargeting.ts` | `SSO-OBJECT-TARGET-001` investigation; verified 2026-06-11 | Resolver-level `validTargets` semantics are implemented and tested: creature/object/point are allowed target-kind categories, while enemies/allies/self remain creature constraints. | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/__tests__/TargetResolver.test.ts`; implementation notes in this file; fixed-string search from 2026-06-01. | This prevents mixed creature-or-object spells from becoming impossible AND filters, while preserving relation filters for creatures. | Completed: keep object discovery, selected-target envelopes, and command envelopes tracked separately. | `npm run test -- src/systems/spells/targeting/__tests__/TargetResolver.test.ts` passed 13 tests on 2026-06-11. |
| SSO-MIXED-TARGET-AGGREGATION-001 | done | support_needed_now | Working agent | `src/systems/spells/targeting/TargetResolver.ts` | `SSO-VALIDTARGETS-SEMANTICS-001` implementation; verified 2026-06-11 | `TargetResolver.getValidTargetCandidates` returns valid creature targets plus valid supplied `TargetableObject` candidates through one tested API. UI/selection callers still need adoption where mixed targeting is needed. | `src/systems/spells/targeting/TargetResolver.ts`; `src/systems/spells/targeting/__tests__/TargetResolver.test.ts`; implementation notes in this file. | Mixed creature/object spell callers have a shared resolver aggregation contract instead of reimplementing category logic around resolver methods. | Completed for resolver API; caller adoption remains blocked on object registry and target-envelope work. | `npm run test -- src/systems/spells/targeting/__tests__/TargetResolver.test.ts` passed 13 tests on 2026-06-11. |
| SSO-OBJECT-TARGET-REGISTRY-001 | Object target registry needed a spell-side adapter rather than ad hoc per-spell object inference. | Implemented for current generated-map object publication and explicit positioned loose item inputs. `ObjectTargetRegistry` normalizes map-backed objects, explicit objects, positioned loose items, and positioned room features with explicit target facts; `BattleMapGenerator` publishes generated obstacles as fixed `TargetableMapObject` entries instead of requiring spell systems to infer from decoration tiles. Remaining live loose-object producer breadth is tracked in `SSO-LOOSE-OBJECT-PRODUCER-001`. | Targeting architecture / data bridge | Done | High | 2026-06-12 |
| SSO-CREATURE-TAXONOMY-NORMALIZATION-001 | open | support_needed_now | Worker D | `CombatCharacter`, `CharacterStats`, spell targeting filters, monster/player data adapters | `creature-type-target-filter` refresh 2026-06-01 | Creature typing is present but not normalized: `CombatCharacter` has top-level `creatureTypes`, `CharacterStats` also has legacy `stats.creatureTypes`, and matching currently uses raw string arrays. | `src/types/combat.ts`; `src/types/core.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/utils/combat/combatAI.ts`. | Creature-specific spells can diverge between player targeting, effect filtering, AI planning, and data adapters if they do not read the same canonical taxonomy. | Define the canonical read path and normalization/case policy, then adapt resolver/AI/data creation without deleting legacy fields prematurely. | Focused proof for Humanoid/Beast/Undead matching across player resolver, command effect filtering, and AI target selection. |
| SSO-AI-CREATURE-FILTER-PATH-PARITY-001 | done | support_needed_now | Working agent | `src/utils/combat/combatAI.ts`, ability preview/selection, spell targeting filters | `creature-type-target-filter` refresh 2026-06-01; Humanoid and Beast AI parity completed 2026-06-13 | Combat AI no longer filters `ability.validCreatureTypes` only against legacy `target.stats.creatureTypes`. `TargetValidationUtils.getCreatureTypes(...)` now centralizes the migration-period read path across top-level `CombatCharacter.creatureTypes` and legacy `stats.creatureTypes`, and `combatAI.ts` uses that helper for single-enemy and single-ally restricted ability filters. Focused proofs now cover both Humanoid-style and Beast-style restricted AI targets that only populate top-level `creatureTypes`. Broader taxonomy normalization remains open under `SSO-CREATURE-TAXONOMY-NORMALIZATION-001`. | `src/utils/combat/combatAI.ts`; `src/utils/combat/__tests__/combatAI.test.ts`; `src/systems/spells/targeting/TargetValidationUtils.ts`; `src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts`; `src/types/combat.ts`; `src/types/core.ts`. | AI creature-restricted spell planning now shares the same top-level-plus-legacy taxonomy read path as player-facing resolver/effect filters, reducing the risk that AI skips legal top-level Humanoid or Beast targets. The broader taxonomy row still owns canonical type enums/case policy and data-adapter cleanup. | Completed for current AI path parity. Reopen only if a new AI caller bypasses `combatAI.ts` restricted-target filtering or a new creature taxonomy source appears. | Red proof first showed a Humanoid-restricted AI ability planned movement instead of targeting a legal top-level Humanoid. Beast-family proof then covered a Dominate Beast-style restricted target through the same helper. `npm run test -- src/systems/spells/targeting/__tests__/TargetValidationUtils.test.ts src/utils/combat/__tests__/combatAI.test.ts` passed 28 tests and `npm run test:types` passed on 2026-06-13. |
| SSO-SPELL-FILTER-DATA-COMPLETENESS-001 | open | support_needed_now | Working agent | spell JSON migration, targeting/effect filter data quality | `creature-type-target-filter` refresh 2026-06-01; Hold Person, direct status-condition, and direct utility slices completed 2026-06-13 | The named Hold Person inconsistency is fixed: `hold-person.json` now carries `Humanoid` on both the spell-level `targeting.filter.creatureTypes` and the Paralyzed effect-level `condition.targetFilter.creatureTypes`. A bounded corpus audit then found 26 remaining spell-level-versus-effect-level filter mismatches across 16 spells. The direct status-condition creature-type misses that clearly apply the same target identity gate are fixed: `animal-friendship.json` now carries `Beast` on its Charmed effect, and `fast-friends.json` now carries `Humanoid` on its Charmed effect. The direct restricted utility rows are also fixed: Charm Person, Animal Messenger, Beast Sense, Calm Emotions, Crown of Madness, Dominate Person, and Planar Binding now repeat their direct creature-family or Tiny-size gate on the effect payload. Remaining hits need per-spell classification because several top-level filters describe the initial target object, plant/terrain target, chosen creature kind, form choice, simulacrum repair target, or ongoing area rule rather than every later effect target. | `public/data/spells/level-1/animal-friendship.json`; `public/data/spells/level-1/charm-person.json`; `public/data/spells/level-2/animal-messenger.json`; `public/data/spells/level-2/beast-sense.json`; `public/data/spells/level-2/calm-emotions.json`; `public/data/spells/level-2/crown-of-madness.json`; `public/data/spells/level-2/hold-person.json`; `public/data/spells/level-3/fast-friends.json`; `public/data/spells/level-5/dominate-person.json`; `public/data/spells/level-5/planar-binding.json`; `public/data/spells/level-4/dominate-beast.json`; `src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts`; `SpellCommandFactory.ts`. | Initial target selection may block invalid casts, but effect-level filters matter for multi-target, aura, repeated trigger, delayed, or future retargeting flows where not every effect should apply to every selected creature. Direct condition and utility effects no longer lose their creature-family or Tiny-size gates at the effect row. | Classify the remaining corpus hits before patching: copy spell-level filters only when the same creature/size/alignment rule applies to the effect target, and split separate gaps for rows whose top-level filter is actually about an object, plant/terrain area, chosen creature kind, form choice, simulacrum repair target, or ongoing area trigger. | Hold Person red proof first showed `effect.condition.targetFilter.creatureTypes` was `[]`; direct status-condition red proof showed Animal Friendship was missing `Beast`; direct utility red proof showed Charm Person was missing `Humanoid`; green proof passed after adding the direct status and utility filters. Latest focused checks: `npm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts` passed 12 tests, `npm run validate:spells -- --spell public/data/spells/level-2/animal-messenger.json` reported 459 valid / 0 invalid, and `npm run test:types` passed on 2026-06-13. |
| SSO-TARGET-FILTER-FEEDBACK-001 | open | in_scope_now | Worker D | 2D/3D combat-map targeting UI, target resolver failure reasons | `creature-type-target-filter` refresh 2026-06-01 | `TargetResolver` rejects targets that fail `TargetValidationUtils.matchesFilter`, but the source still has a TODO to connect the failure to UI feedback such as "Target must be Humanoid." | `TargetResolver.ts`; `TargetValidationUtils.ts`; combat-map visualization scope in this tracker. | A player needs to see why a combat-map target is illegal in both 2D and 3D; silent rejection makes creature-restricted spell targeting look broken. | Add structured failure reasons for filter mismatch and surface them in the targeting affordance/log/map UI. | Rendered 2D/3D proof that invalid Humanoid/Beast/etc. targets are visually explained without hiding legal targets. |
| SSO-AREA-SOURCE-OF-TRUTH-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects`, `src/hooks/combat/useActionExecutor.ts`, `src/hooks/combat/engine/useCombatEngine.ts` | implemented slice 2026-06-01; verification pending | Area trigger behavior now has a narrower compatibility path: `AreaEffectTracker` remains the live runtime wrapper used by movement/end-turn hooks, while its entry/exit/end-turn effect selection delegates to exported `triggerHandler` helpers so helper tests and runtime no longer maintain separate effect loops. Movement-within remains tracker-owned because no standalone helper exists for it. | `AreaEffectTracker.ts` delegates `processEntry`, `processExit`, and `processEndTurn`; `triggerHandler.ts` helper results now carry explicit `triggerType`; previous call-site evidence from `useActionExecutor.ts` and `useCombatEngine.ts`. | This reduces drift, but completion is unverified until focused area tests prove events still emit, entry/exit/end-turn effects still fire with trigger types/source context, and movement-within behavior remains intact. | Run focused `AreaEffectTracker` and `triggerHandler` tests when verification is allowed; if clean, mark this row done or split any regression. | Focused area-effect test results captured in `AUDIT_OR_PROOF.md`. |
| SSO-AREA-MOVE-WITHIN-COVERAGE-001 | waiting | in_scope_now | Worker D | `src/systems/spells/effects/AreaEffectTracker.ts` | `SSO-AREA-ENTRY-EXIT-001` investigation | `AreaEffectTracker.processMovementWithin` implements `on_move_in_area`; focused tests for the documented Spike Growth-style TODO cases have now been added, but verification still needs to be run. | `AreaEffectTracker.ts`; `AreaEffectTracker.test.ts` coverage for multi-tile movement, diagonal movement, crossing without ending inside, and `first_per_turn`. | `SSO-ONMOVEINAREA-001` makes the trigger legal, but without verified behavior tests the movement-through-zone contract can regress silently. | Run the focused `AreaEffectTracker` test file; if clean, mark this gap done and continue to source-of-truth or geometry parity work. | Focused `AreaEffectTracker` test result captured in `AUDIT_OR_PROOF.md`. |
| SSO-AOE-CONTAINMENT-PARITY-001 | waiting | support_needed_now | Worker D | `src/systems/spells/effects`, `src/systems/spells/targeting`, `src/utils/spatial/targetingUtils.ts`, `src/hooks/useAbilitySystem.ts` | implemented/proof slice 2026-06-01; verification pending | The old broad claim is stale. `AoECalculator.containsTile(...)` already delegates to the shared AoE utility, `isPositionInArea(...)` delegates to it for non-directional shapes and for cone/line when direction exists, and `useAbilitySystem` registers persistent zones from resolved targeting `AoEParams` so origin/direction should match the preview path. A focused parity test has been added but not run. | `AoECalculator.ts`; `aoeCalculations.ts`; `targetingUtils.resolveAoEParams`; `useAbilitySystem` zone registration via `createSpellZoneFromAoEParams`; `triggerHandler.test.ts` parity coverage. | The remaining risk is proof and edge-case discipline: a future call path could create directional zones without direction, or geometry changes could alter preview math without proving persistent trigger containment still matches it. | Run focused `triggerHandler` tests; if clean, mark this row done or split any remaining directional-zone creation edge case into its own row. | Focused `triggerHandler.test.ts` result proving cube/sphere/cone/line containment parity with `AoECalculator`. |
| SSO-GEOMETRY-CYLINDER-HEIGHT-001 | open | support_needed_now | Worker D + geometry explorer | cylinder AoE, elevation/3D targeting, 2D/3D map parity | geometry TODO refresh 2026-06-01 | Cylinder height remains unmodeled. Current code treats Cylinder as a 2D radius footprint or sphere-like radius and does not apply vertical extent. | `TODO.md`; `gridAlgorithms/cylinder.ts`; `AoECalculator.ts`; `aoeCalculations.ts`; geometry explorer report 2026-06-01. | Cylinder spells cannot be proven accurate in 3D/elevation play until height is defined separately from radius. | Define the elevation-aware cylinder contract before changing existing 2D footprint behavior. | Focused geometry proof for 2D footprint preservation and 3D height inclusion/exclusion once elevation exists. |
| SSO-GEOMETRY-CUBE-CENTERING-001 | open | support_needed_now | Worker D + geometry explorer | cube AoE placement, shared AoE math, map previews | geometry TODO refresh 2026-06-01 | Cube placement is stable but policy-incomplete: current shared AoE code uses origin/top-left placement and tests that convention, while the TODO's 5e corner/center rule decision remains unresolved. | `TODO.md`; `gridAlgorithms/cube.ts`; `AoECalculator.ts`; `aoeCalculations.ts`; `AoECalculator.test.ts`; geometry explorer report 2026-06-01. | Spell previews, persistent zones, and trigger containment can all disagree with tabletop expectations if cube-origin policy is implicit. | Write a decision note for grid-origin versus cube-corner/center semantics, then update shared AoE math and previews only if the policy changes. | Focused cube tests for 10ft and 15ft cubes plus rendered 2D/3D preview proof. |
| SSO-AREA-DATA-MIGRATION-STATUS-001 | done | adjacent_follow_up | Worker D | `docs/tasks/spell-system-overhaul/TODO.md`, `public/data/spells` | `SSO-AREA-ENTRY-EXIT-001` investigation; completed 2026-06-01 | The stale migration-status question for `grease`, `fog-cloud`, and `entangle` has been resolved: `grease` and `entangle` already carry area trigger rows, while `fog-cloud` is an obscuring terrain zone rather than a save/damage trigger migration candidate. | `docs/tasks/spell-system-overhaul/TODO.md`; `public/data/spells/level-1/grease.json`; `public/data/spells/level-1/entangle.json`; `public/data/spells/level-1/fog-cloud.json`; bounded area-trigger search. | Closing this row prevents future agents from redoing completed migration checks or forcing inappropriate trigger rows onto a fog/obscurement spell. | No further action for this row; remaining terrain runtime/map-mutation work should be tracked separately from data-migration status. | Current spell-data audit note added to `AUDIT_OR_PROOF.md`; no tests were required or run for this documentation/status slice. |
| SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001 | done | adjacent_follow_up | Worker D | `src/commands/effects/TerrainCommand.ts`, `docs/tasks/spell-system-overhaul/TODO.md` | `dynamic-terrain-mutations` TODO refresh; completed 2026-06-01 | The old TODO claim that `TerrainCommand` is stubbed is stale for map-present encounters. Current source mutates map tiles, adds environmental effects, and recalculates movement cost; focused command tests cover difficult terrain, manipulation, and normalization. | `src/commands/effects/TerrainCommand.ts`; `src/commands/effects/__tests__/TerrainCommand.test.ts`; `src/hooks/combat/useGridMovement.ts`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `docs/tasks/spell-system-overhaul/TODO.md`. | This prevents future agents from rebuilding an existing terrain mutation layer and keeps effort pointed at narrower remaining terrain gaps. | No further action for this status row; use the newly split terrain mapless-persistence and 2D environmental-rendering gaps for follow-up work. | Static source/test audit captured in `AUDIT_OR_PROOF.md`; tests were not run. |
| SSO-ARMOR-OF-AGATHYS-RETALIATION-GATE-001 | open | support_needed_now | Working agent | Armor of Agathys reactive runtime, `on_target_attack`, temp-HP spell ending | Armor of Agathys conditional-trigger audit 2026-06-01; attacker-target, attack-filter, temp-HP-source, and explicit-miss slices completed 2026-06-12 | The old TODO is partially stale: current spell data already has temp-HP defensive setup, `temporary_hit_points_depleted` conditional endings, and retaliation `attackFilter.weaponType: melee`. Five runtime slices are now proven locally: `useActionExecutor` applies `on_target_attack` reactive `DAMAGE` to the attacking creature rather than the protected target, rejects obvious melee/ranged `attackFilter.weaponType` mismatches before rolling retaliation damage, rejects weapon-vs-spell `attackFilter.attackType` mismatches, suppresses temp-HP-bound retaliation when the protected target's current temporary HP belongs to another spell, and suppresses reactive damage when an explicit per-target `CombatAction.attackResults` entry says the protected target was missed. `DefensiveCommand` now records accepted temp-HP source identity, `ReactiveEffectCommand` records the source spell on reactive triggers, and shared damage depletion clears the source marker when that temporary HP pool reaches zero. The remaining runtime gap is live attack-result population: the action envelope can carry hit/miss facts, but `useAbilitySystem` currently calls `onExecuteAction(action)` before the later `AbilityCommandFactory` command path rolls weapon attacks, so the reactive pass runs before the live hit/miss fact exists. | `public/data/spells/level-1/armor-of-agathys.json`; `src/commands/effects/ReactiveEffectCommand.ts`; `src/commands/effects/DefensiveCommand.ts`; `src/commands/effects/DamageCommand.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/hooks/combat/__tests__/useActionExecutor.test.ts`; `src/hooks/useAbilitySystem.ts`; `src/commands/__tests__/DefensiveCommand.test.ts`; `src/utils/combat/deathSaveUtils.ts`; `src/utils/combat/__tests__/deathSaveUtils.test.ts`; `src/commands/factory/AbilityCommandFactory.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/types/spells.ts`; `src/types/combat.ts`; `docs/tasks/spell-system-overhaul/TODO.md`. | Armor of Agathys can validate as structured data while still resolving too broadly if a live caller omits hit/miss results. The previous protected-target self-damage risk, simple ranged-attack false positive, spell-vs-weapon filter gap, unrelated-temp-HP false positive, and explicit-miss false positive are narrowed by 2026-06-12 proofs. | Choose and implement a live attack-result handoff: either pre-roll attack results before `onExecuteAction(action)`, move target-attack reactive resolution after command attack resolution, or teach the command execution path to emit reactive hit events with target/caster/source context. Then Armor of Agathys can be closed for the local reactive path while preserving the completed attacker, filter, source-temp-HP, and explicit-miss gates. | Proof completed for attacker-not-target damage application, ranged no-retaliation, spell-vs-weapon no-retaliation, unrelated-temp-HP no-retaliation, and explicit miss no-retaliation. Red tests first showed `handleDamage` received `protected_caster`, then that a `shortbow` still caused cold retaliation, then that a spell attack still triggered a weapon-only rider, then that unrelated Heroism-style temp HP kept Armor retaliation alive, then that `attackResults: [{ isHit: false }]` still allowed cold retaliation. Green proof passed with focused tests including `npm run test -- src/hooks/combat/__tests__/useActionExecutor.test.ts` (17 passed), `npm run test -- src/commands/__tests__/DefensiveCommand.test.ts src/hooks/combat/__tests__/useActionExecutor.test.ts src/utils/combat/__tests__/deathSaveUtils.test.ts` (22 passed earlier for the temp-HP slice), and `npm run test:types` passed on 2026-06-12. Remaining proof needed for live attack-result producer population across the battle-map ability flow. |
| SSO-CONTROL-OPTION-SELECTION-001 | done | support_needed_now | Working agent | `UtilityCommand`, `CommandContext.playerInput`, `useAbilitySystem`, `AISpellInputModal`, Command spell control options | ai-control-overrides audit 2026-06-01; execution, hook/modal, and rendered component proof completed 2026-06-12 | The real `command.json` payload has five control options (`Approach`, `Drop`, `Flee`, `Grovel`, `Halt`), and the current local path can prompt, forward, and execute a selected word. The command runtime honors `playerInput` labels/effect keys before falling back to data order, the normal hook path requests a command option for multi-option control utility effects before command creation, and `AISpellInputModal` renders those `controlOptions` as structured choice buttons. | `public/data/spells/level-1/command.json`; `src/commands/base/SpellCommand.ts`; `src/commands/factory/SpellCommandFactory.ts`; `src/commands/effects/UtilityCommand.ts`; `src/hooks/useAbilitySystem.ts`; `src/components/BattleMap/AISpellInputModal.tsx`; `src/components/BattleMap/AISpellInputModal.test.tsx`; `src/hooks/__tests__/useAbilitySystem.test.ts`; `src/commands/__tests__/UtilityCommand.test.ts`; `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts`. | Command can validate, prompt structurally, render the selectable command words, forward the chosen label, and execute the selected control option instead of silently defaulting to first-listed `Approach`. AI turn obedience is separately completed under `SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001`. | Completed for current local component/hook/command path. Future full-combat smoke testing can still inspect the broader encounter flow, but this row's prompt/render/forward/execute gap is closed. | Proof: selected `Flee` red test first failed as `Approach` movement; hook red test first failed with `onRequestInput` called 0 times; component render proof showed Approach/Drop/Flee/Grovel/Halt buttons and `Flee` submission; `npm run test -- src/components/BattleMap/AISpellInputModal.test.tsx src/hooks/__tests__/useAbilitySystem.test.ts src/commands/__tests__/UtilityCommand.test.ts` passed 31 tests with 2 skipped and `npm run test:types` passed on 2026-06-12. |
| SSO-AI-CONTROL-DIRECTIVE-ENFORCEMENT-001 | done | support_needed_now | Working agent | `UtilityCommand`, `combatAI.ts`, control statuses/directives | ai-control-overrides audit 2026-06-01; Command directive slices completed 2026-06-12 | Command-control AI enforcement is implemented for the current five Command options. `UtilityCommand` records selected `Halt`, `Grovel`, and `Drop` as one-round skip-turn command statuses, with Grovel preserving immediate `Prone` and Drop preserving the existing drop log. Selected `Flee` and `Approach` preserve their immediate movement fallbacks and now record caster-relative movement directives with `sourceCasterId`. `combatAI.ts` obeys Halt/Grovel/Drop before normal scoring, moves away from the command caster for Flee, and moves toward the command caster for Approach. | `src/commands/effects/UtilityCommand.ts`; `src/commands/__tests__/UtilityCommand.test.ts`; `src/utils/combat/combatAI.ts`; `src/utils/combat/__tests__/combatAI.test.ts`; `src/hooks/combat/useCombatAI.ts`; `public/data/spells/level-1/command.json`. | Control spells that should constrain a creature on its next turn now have proven directive paths for Approach, Drop, Flee, Grovel, and Halt, reducing the risk that a commanded creature simply plans a normal attack or arbitrary movement after those commands. This row does not claim full held-item inventory mutation for Drop; it preserves the existing log-only item behavior. | Completed for current AI directive enforcement; future held-item/equipment mutation for Drop should be tracked separately if the inventory model grows a combat-held-item surface. | Halt/Grovel/Flee/Approach/Drop red tests first showed missing markers or normal AI attacks, then `npm run test -- src/commands/__tests__/UtilityCommand.test.ts src/utils/combat/__tests__/combatAI.test.ts` passed 30 tests and `npm run test:types` passed on 2026-06-12. |
| SSO-AC-DEFENSIVE-PERSISTENCE-001 | waiting | support_needed_now | Worker D + AC explorer | defensive AC effects, active-effect persistence, AC recalculation | implementation slices 2026-06-01; verification pending | `DefensiveCommand` now reads structured `acBonus` and `acMinimum`, handles `ac_minimum`, and stores `mechanics.acBonus`, `mechanics.baseAC`, `mechanics.baseACFormula`, and `mechanics.acMinimum` on combat `ActiveEffect`. `statUtils.calculateFinalAC(...)` now normalizes direct active-effect fields and combat `mechanics.*` AC fields, including armor suppression for Mage Armor-style base AC. Dependency sync was run for `src/types/combat.ts` and `src/utils/character/statUtils.ts`. | `DefensiveCommand.ts`; `combat.ts`; `statUtils.ts`; `spellValidator.ts`; `spells.ts`; `mage-armor.json`; `shield-of-faith.json`; `barkskin.json`; AC explorer report 2026-06-01. | Barkskin/base-override/minimum AC effects now have a command-state and recalculation foothold, but focused behavior proof and active-effect expiry cleanup remain unverified. | Run focused defensive command/stat utility proof, then implement or prove cleanup/recalculation after active effects expire. | Focused proof for Shield of Faith using `acBonus`, Mage Armor base AC mechanics, Barkskin AC floor, armor suppression of Mage Armor, and cleanup/recalculation after expiry. |
| SSO-AC-REACTION-WIREUP-001 | open | support_needed_now | Worker D + reaction explorer | Shield spell reaction timing, reaction prompt flow, attack-hit event context | Shield reaction audit 2026-06-01 | Shield is authored as a reaction spell and the generic `pendingReaction`/`ReactionPrompt` UI exists, but weapon/attack hit flow does not robustly request Shield before damage. Current reaction handling is split between spell `reactionTrigger`, `target.modifiers.reactions`, `DamageCommand`, and stubby `ReactiveEffectCommand` behavior. | `shield.json`; `useAbilitySystem.ts`; `CombatView.tsx`; `ReactionPrompt.tsx`; `AbilityCommandFactory.ts`; `DamageCommand.ts`; `ReactiveEffectCommand.ts`; `SpellCommandFactory.ts`; skipped reaction tests noted by reaction explorer. | Shield must be offered after a qualifying hit and before damage resolution; parallel reaction models make this easy to miss or double-handle. | Define canonical attack-hit reaction event, register Shield as runtime reaction metadata, wire weapon attacks to `requestReaction`, and implement real defensive reaction execution rather than log-only reactive behavior. | Focused proof that Shield is offered on qualifying hit, spends reaction/slot, changes AC outcome before damage, and is not offered for non-qualifying events. |
| SSO-STATUS-STACKING-CONSISTENCY-001 | open | support_needed_now | Worker D + status explorer | status/condition application entry points | status-stacking audit 2026-06-01 | Command-driven status application replaces/refreshes by name, but scheduled spell effects, action/zone effects, and tile/environment effects still append or dedupe inconsistently. | `StatusConditionCommand.ts`; `SpellCommandFactory.ts`; `AbilityCommandFactory.ts`; `useCombatEngine.ts`; `useActionExecutor.ts`; status explorer report 2026-06-01. | The same spell status can duplicate or refresh differently depending on which runtime path applied it. | Route non-command status application through the same replacement/refresh helper or shared policy. | Focused proof across command, scheduled, zone/action, and tile/environment status entry points. |
| SSO-STATUS-CONDITION-EXPIRY-MIRROR-001 | open | support_needed_now | Worker D + status explorer | `conditions` lifecycle, status effect expiry, turn manager cleanup | status-stacking audit 2026-06-01 | `statusEffects` duration ticking exists, but `conditions` lifecycle is not decremented/expired in the same pipeline, and non-command paths do not consistently mirror deduped condition state. | `useTurnManager.ts`; `useCombatEngine.ts`; `useActionExecutor.ts`; `StatusConditionCommand.ts`; status explorer report 2026-06-01. | Condition mirrors can outlive their visible/status counterpart or miss expiry cleanup, which affects saves, targeting, AI, and map labels. | Unify condition duration/expiry with status effect lifecycle and log cleanup consistently. | Focused proof that mirrored status/condition records expire together and remove map-visible labels. |
| SSO-SUMMONING-RUNTIME-PARITY-001 | open | support_needed_now | Worker D + useSummons boundary explorer | `SummoningCommand`, `useSummons`, command execution, summon templates | `summoning-system` refresh 2026-06-01; 0-HP cleanup + identity metadata parity + boundary note 2026-06-01 | Summoning implementation exists in two shapes: command execution creates combat characters directly, while `useSummons` separately maintains `summonedEntities` and callbacks. Both paths now preserve summon identity metadata (`entityType`, `formName`, `sourceName`) plus caster/spell/duration/dismissability, command-created summons are removed at 0 HP with identity-aware log data, and `SUMMONING_RUNTIME_BOUNDARY.md` documents `useSummons` as a parallel UI/helper path rather than the authoritative spell-casting runtime. Runtime ownership/parity is still not proved or resolved. | `SUMMONING_RUNTIME_BOUNDARY.md`; `SummoningCommand.ts`; `DamageCommand.ts`; `combat.ts`; `useSummons.ts`; `CombatView.tsx`; `SummoningCommand.test.ts`; `SummoningSystem.test.ts`; `SpellCommandFactory.ts`. | Parallel summon runtimes can still diverge on authoritative ownership, duration ticking, form choice input, callbacks, concentration cleanup, command economy, and map visibility even though their metadata shape and boundary documentation are clearer. | Choose and implement one closure path from the boundary note: retire/helper-only `useSummons`, make it the production manager, or delegate both paths to a shared summon service. | Focused proof that a real summon spell produces one authoritative summon state with cleanup metadata, preserved identity, identity-aware 0-HP cleanup, and proof that the hook path is intentionally retired, helper-only, or covered by parity tests. |
| SSO-SUMMONING-FORM-SELECTION-001 | open | support_needed_now | Worker D + summon-choice explorer | summon form/CR/count selection UI and AI input | `summoning-system` refresh 2026-06-01; sub-agent status check + metadata parity + hook boundary 2026-06-01 | Schema/data can express summon options, and both summon paths now record the selected/defaulted `formName`, but command execution still defaults to `formOptions[0]`, `useSummons.addSummon(..., formIndex = 0)` is documented as a helper path rather than production-fed by combat casting, the ability input path has no summon-specific choice contract, and `countByCR` is not operationalized. | `SummoningCommand.ts`; `useSummons.ts`; `useAbilitySystem.ts`; `SpellCommandFactory.ts`; `AISpellInputModal.tsx`; `summon-beast.json`; `conjure-animals.json`; `find-familiar.json`; `find-steed.json`; summon-choice explorer report 2026-06-01. | Summon spells with meaningful choices currently collapse to default forms, default counts, or generic placeholders instead of player/AI-selected forms and CR/count packages. | Add a first-class `playerInput.summonChoice` or equivalent bridge, render summon form/CR/count choices in player and AI input flows, define count-vs-countByCR precedence, and wire the selected choice into command execution. | Focused proof for one multi-form summon, one familiar/steed-style form choice, and one variable-count/CR summon; rendered 2D/3D proof that the chosen form is recognizable on the map. |
| SSO-SUMMONING-COMMAND-ECONOMY-001 | open | support_needed_now | Worker D + summon-economy explorer | summon initiative, control, command cost, AI behavior | `summoning-system` refresh 2026-06-01; sub-agent status check 2026-06-01 | Schema/data already model command-economy fields such as `commandCost`, `commandsPerTurn`, `initiative`, `sharedSenses`, and control options, but command-created summons still use caster team, caster initiative, generic action economy, and generic AI. `useSummons` also uses a different initiative default, so runtime ownership/parity remains unresolved. | `spells.ts`; `spellValidator.ts`; `SummoningCommand.ts`; `useSummons.ts`; `useTurnManager.ts`; `combatAI.ts`; `useCombatAI.ts`; `find-steed.json`; `summon-beast.json`; `summon-lesser-demons.json`; `summon-greater-demon.json`; `giant-insect.json`; summon-economy explorer report 2026-06-01. | Summoned creatures often have special initiative, obedience, hostility, command-cost, shared-senses, or control-loss rules; without runtime enforcement they behave like generic allies or enemies. | Split implementation into initiative/turn-order policy, command-cost/command-count consumption, hostile/uncontrolled behavior, and summon-aware AI policy; keep `useSummons` parity tied to the broader summon runtime row. | Focused AI/turn-order proof for find steed, summon beast, summon lesser demons, summon greater demon, and giant insect categories. |
| SSO-SUMMONING-MAP-VISUALS-001 | open | in_scope_now | Worker D | 2D/3D map representation for summoned creatures/objects/servants/disks | `summoning-system` refresh 2026-06-01; identity metadata parity + hook boundary slices 2026-06-01 | Summoned creatures become combat characters, and both command-created summons and `useSummons` records now preserve `entityType`, `formName`, and `sourceName` in `summonMetadata`. `useSummons` is documented as a parallel helper, not the authoritative runtime. Non-creature summons such as servants, disks, objects, and guardian-style constructs still need explicit map/readability rules in 2D and 3D. | `SummoningCommand.ts`; `combat.ts`; `useSummons.ts`; `CombatView.tsx`; `unseen-servant.json`; `tensers-floating-disk.json`; `phantom-steed.json`; combat-map presentation matrix. | Players need to understand where a summon is, whether it blocks/moves/acts, what kind/form it is, who owns it, and when it disappears on both map modes. | Use preserved summon identity and the documented runtime boundary to define visual categories for creature summons, object summons, invisible servants, mounts, and disks. | Rendered 2D/3D proof for at least one creature summon and one object/servant/disk summon, including readable type/form/source labels. |
| SSO-LEVEL1-MATERIAL-COSTS-001 | open | support_needed_now | Worker D + material-cost explorer | level-1 material component costs, consumption, casting gates | material-cost audit 2026-06-01 | Level-1 material support is partially solved: schema, level-1 data fields, validator consistency checks, material component tests, and glossary gate reporting exist. Runtime remains open because no cast-time gp/resource deduction, inventory lookup/removal, or blocker was found for missing/insufficient consumed materials. | `public/data/spells/level-1`; `spell.schema.json`; `spellValidator.ts`; `materialComponents.test.ts`; `useSpellGateChecks.ts`; spell gate checker files; material-cost explorer report 2026-06-01. | Material-cost spells can validate and display metadata while still being cast without paying, consuming, or proving required materials. | Split implementation into runtime cast gate and inventory/consumption resolution while preserving the completed schema/data/validation foothold. | Focused proof for one costly consumed level-1 spell such as Find Familiar and one non-consumed material-cost case. |
| SSO-LEVEL1-MATERIAL-RUNTIME-GATE-001 | open | support_needed_now | Worker D + material-cost explorer | combat/casting gate enforcement for material cost availability | material-cost audit 2026-06-01 | No concrete cast-blocking logic was found that checks `materialCost` or `isConsumed` against player resources during combat/ability execution. | `useAbilitySystem.ts`; `useSpellGateChecks.ts`; `spellValidator.ts`; material-cost explorer report 2026-06-01. | Data quality does not stop illegal casts unless the runtime gate consumes the data. | Add or locate the casting gate that blocks insufficient costly/consumed components before action/slot spending. | Focused proof that insufficient materials block a level-1 spell before resources are spent. |
| SSO-LEVEL1-MATERIAL-CONSUMPTION-001 | open | support_needed_now | Worker D + material-cost explorer | inventory/resource deduction for consumed spell materials | material-cost audit 2026-06-01 | No inventory lookup/removal path was found for `isConsumed: true` at cast time. | `public/data/spells/level-1`; inventory/casting surfaces from future implementation; material-cost explorer report 2026-06-01. | Consumed materials need to leave inventory or deduct equivalent resources, otherwise casting rules are only descriptive. | Define whether material costs are item-specific, gp-value based, or both, then consume/deduct during successful casting. | Focused proof that a consumed material is removed/deducted on successful cast and not removed on blocked/cancelled cast. |
| SSO-LEVEL1-RITUAL-CASTING-FLOW-001 | open | support_needed_now | Worker D + ritual explorer | level-1 ritual casting UI/runtime/AI flow | ritual casting audit 2026-06-01 | Ritual metadata exists in spell types/schema/data and glossary review tooling, but no implemented ritual-specific runtime casting flow was found. Runtime paths remain generic, and `useActionExecutor.ts` still treats ritual as TODO-level behavior. | `spells.ts`; `spell.schema.json`; `spellValidator.ts`; `spellCoverageAnnotations.ts`; `spellGateBucketDetails.ts`; `useAbilitySystem.ts`; `useActionExecutor.ts`; level-1 ritual spell reference docs; ritual explorer report 2026-06-01. | Ritual spells need different time/resource handling than normal action casting; display metadata alone does not prove the player can select and resolve a ritual correctly. | Split or implement ritual spell selection/access, ritual casting runtime, and glossary/display parity without conflating this with the broader ritual subsystem. | Proof that one level-1 ritual spell can be selected, cast, and resolved without spending an inappropriate combat action or spell slot. |
| SSO-LEVEL1-RITUAL-RUNTIME-001 | open | support_needed_now | Worker D + ritual explorer | ritual-specific runtime casting and resource handling | ritual casting audit 2026-06-01 | No proven path was found from spell selection to ritual-aware resolution, action/slot suppression, or non-combat time handling. | `useAbilitySystem.ts`; `useActionExecutor.ts`; `SpellContext.tsx`; `SpellService.ts`; ritual explorer report 2026-06-01. | Ritual metadata must affect casting behavior, not only validation/display. | Define the runtime ritual cast path and prove one level-1 ritual resolves through it. | Focused proof for ritual cast flow with correct action/slot/time behavior. |
| SSO-LEVEL1-RITUAL-ACCESS-001 | open | support_needed_now | Worker D + ritual explorer | ritual spell access, prepared/known/feat rules | ritual casting audit 2026-06-01 | Ritual Caster data exists, but the feat gap docs still indicate class and ritual spell selection work remains. | `featsData.ts`; `docs/tasks/feat-system-gaps.md`; ritual explorer report 2026-06-01. | A runtime ritual button is not enough if the character is not correctly allowed to cast that ritual. | Decide and implement access rules for class ritual casting versus Ritual Caster feat support. | Proof that an allowed ritual caster can select a ritual and a non-allowed caster cannot. |
| SSO-LEVEL1-RITUAL-DISPLAY-PARITY-001 | open | adjacent_follow_up | Worker D + ritual explorer | glossary/display parity for ritual metadata | ritual casting audit 2026-06-01 | Glossary tooling derives ritual display/review information, but it is separate from gameplay runtime and should remain aligned after runtime implementation. | `spellGateBucketDetails.ts`; `spellGateDataTypes.ts`; `useSpellGateChecks.test.ts`; ritual explorer report 2026-06-01. | Display can say a spell is ritual-capable while runtime cannot cast it as a ritual, or vice versa. | Keep glossary/review display in sync with the chosen runtime ritual contract. | UI/review proof that ritual-capable level-1 spells show the correct ritual affordance/status. |
| SSO-LEVEL1-FAMILIAR-RUNTIME-001 | waiting | support_needed_now | Worker D + familiar explorer | Find Familiar/familiar lifecycle, AI/map behavior | replacement + 0-HP cleanup + identity metadata + pocket/action/UI/shared-senses footholds 2026-06-01; verification pending | Find Familiar has structured `SUMMONING` data and generic summon routing. Replacement, 0-HP cleanup, identity metadata, pocket-state commands, caster-side dismiss/recall abilities, existing ability UI reachability, shared-senses metadata, and a caster-side `Use Familiar Senses` ability now have footholds. Remaining open behavior: proof/UI polish for dismissal/reappearance, placement validation, turn-order policy, shared-senses execution/observer switching, touch spell delivery, familiar-specific AI/map behavior, and rendered 2D/3D proof. | `find-familiar.json`; `SummoningCommand.ts`; `DamageCommand.ts`; `FamiliarPocketCommands.ts`; `combat.ts`; `useSummons.ts`; `AbilityCommandFactory.ts`; `CombatView.tsx`; `AISpellArbitrator.ts`; `spells.ts`; `summonTemplates.ts`; familiar explorer reports 2026-06-01. | The one-familiar/recast rule, 0-HP disappearance, identity metadata, pocket-state commands, caster action/UI-path footholds, and shared-senses action foothold now exist, but full Find Familiar behavior remains unverified and incomplete. | Run focused proof for familiar replacement, preserved identity metadata, summon 0-HP removal, pocket dismiss/recall abilities, and shared-senses ability creation; then finish placement, turn order, shared-senses execution, touch delivery, and familiar-specific AI/map behavior. | Proof that recasting Find Familiar removes/replaces the existing bound familiar; proof that damage to 0 HP removes the familiar/summon from combat and logs type/form/source; proof that dismiss/recall moves the familiar through `pocketedSummons`; proof that shared-senses metadata/action is created; later proof for observer switching, touch delivery, and map visibility. |
| SSO-FAMILIAR-SHARED-SENSES-001 | waiting | support_needed_now | Worker D + familiar-shared-senses explorer | Find Familiar shared senses and telepathy runtime | metadata/action foothold 2026-06-01; observer/proof pending | Find Familiar data/types/validation include shared-senses fields. `SummoningCommand` now preserves `telepathyRange`, `sharedSenses`, and `sharedSensesCost` in `summonMetadata`, and adds `Use Familiar Senses` to the caster when the familiar data supports shared senses. `AbilityEffect` can now represent `familiar_shared_senses`, but ability execution does not yet route it into visibility observer policy, action-duration state, or rendered UI feedback. | `find-familiar.json`; `spells.ts`; `spellValidator.ts`; `combat.ts`; `SummoningCommand.ts`; `AbilityCommandFactory.ts`; `useAbilitySystem.ts`; familiar-shared-senses explorer report 2026-06-01. | The spell promise includes telepathy/shared senses; the data is now preserved and surfaced as an ability, but perception sharing is not yet executed. | Wire `familiar_shared_senses` through command/ability execution, define observer/visibility interaction and duration until next turn, then render-check 2D/3D feedback. | Focused proof that a caster can activate/use familiar senses according to the spell contract and that map visibility/UI reflects the changed observer if supported. |
| SSO-FAMILIAR-TOUCH-DELIVERY-001 | waiting | support_needed_now | Worker D + familiar-action explorer | Find Familiar touch spell delivery through familiar | familiar-action status check 2026-06-01; targeting/reaction/visual slices 2026-06-01 | Find Familiar data includes special action metadata for touch delivery. `useTargetValidator` now lets eligible touch spells use an on-map familiar as the range/LoS origin when the familiar is within telepathy range, adjacent to the target, and has a reaction available. The spell-cast path now spends that familiar reaction and publishes a short-lived 2D/3D delivery-origin cue when delivery is used. This remains unverified. | `find-familiar.json`; `useSummons.ts`; `SummoningCommand.ts`; `AbilityCommandFactory.ts`; `SpellCommandFactory.ts`; `src/hooks/combat/useTargetValidator.ts`; `src/hooks/useAbilitySystem.ts`; `src/hooks/combat/useCombatVisuals.ts`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; familiar-action explorer report 2026-06-01. | Touch spell delivery is a core familiar rule; without active targeting/runtime/map feedback, touch spells cannot be routed through the familiar in a player-legible way even if the data mentions the capability. | Run focused targeting/execution proof and rendered 2D/3D inspection. | Focused proof that an eligible touch spell can be delivered through the familiar, spends the familiar reaction, rejects invalid range/position/LoS/reaction cases, and shows a legible 2D/3D delivery cue. |
| SSO-ABILITY-SYSTEM-HELPER-PATH-001 | waiting | support_needed_now | Worker D + helper-path explorer | `useAbilitySystem` helper imports | familiar delivery visual slice 2026-06-01 | `useAbilitySystem.ts` was importing helper modules from a non-existent `src/hooks/combat/abilitySystem` directory. The equivalent helper files existed at `src/hooks/*`, and the import paths plus stale helper relative imports have been corrected. This needs focused type/build proof. | `src/hooks/useAbilitySystem.ts`; `src/hooks/movementUtils.ts`; `src/hooks/spellEffectUtils.ts`; `src/hooks/teleportUtils.ts`; `src/hooks/perTargetChoiceUtils.ts`; `src/hooks/actionUtils.ts`; helper-path explorer report 2026-06-01. | A broken helper import surface blocks reliable work on every spell execution gap that touches `useAbilitySystem`, including familiar delivery visuals. | Run the focused TypeScript/build proof when validation is allowed. | Type/build proof that `useAbilitySystem` resolves the helper imports and the helper imports resolve their own dependencies. |
| SSO-FAMILIAR-TOUCH-REACTION-001 | waiting | support_needed_now | Worker D | Familiar touch spell command economy | touch-delivery implementation slice 2026-06-01 | Delivered touch spells now spend the familiar's reaction at the spell-cost boundary, and familiar delivery is not considered target-valid when the familiar reaction is unavailable. This still needs focused proof. | `find-familiar.json`; `src/hooks/combat/useTargetValidator.ts`; `src/commands/effects/SummoningCommand.ts`; `src/hooks/useAbilitySystem.ts`; `src/utils/combat/actionEconomyUtils.ts`. | Without reaction handling, the targeting path can make delivery possible while still over-permitting familiar action economy. | Run focused proof that delivered touch spells mark the familiar reaction unavailable and reject delivery when already spent. | Focused proof that a delivered touch spell marks the familiar reaction unavailable and rejects delivery when the familiar reaction is already spent. |
| SSO-FAMILIAR-DISMISS-POCKET-001 | waiting | support_needed_now | Worker D + familiar lifecycle explorer | Find Familiar dismissal, pocket dimension, reappearance state | runtime/action/UI-path footholds 2026-06-01; verification pending | Find Familiar prose and schema-level capability fields mention dismissal/pocket-dimension behavior. `CombatState` has `pocketedSummons`, `FamiliarPocketCommands.ts` adds bounded dismiss/recall commands, `AbilityCommandFactory` can create those commands from `familiar_pocket` ability effects, `useAbilitySystem`/`CombatView` can carry the pocket list plus roster replacement, `SummoningCommand` adds `Dismiss Familiar`/`Recall Familiar` abilities to the caster, and existing ability UI should render them. Placement, turn-order, UI polish, and rendered proof remain deferred. | `FamiliarPocketCommands.ts`; `combat.ts`; `AbilityCommandFactory.ts`; `SummoningCommand.ts`; `useAbilitySystem.ts`; `CombatView.tsx`; `AbilityPalette.tsx`; `AbilityButton.tsx`; `find-familiar.json`; `DamageCommand.ts`; `SUMMONING_RUNTIME_BOUNDARY.md`; familiar lifecycle/action explorer reports 2026-06-01. | Replacement and 0-HP disappearance are not enough for Find Familiar: players need to dismiss the familiar temporarily, know it is off-map but still bound, and restore it according to the spell contract. Runtime/factory/action/UI-path footholds exist, but no proof has been run. | Prove concrete dismiss/recall familiar actions in combat, add placement validation for recall, resolve turn-order lifecycle, decide player-facing UI/log/map feedback, and render-check 2D/3D disappearance/reappearance. | Focused proof that a familiar can be dismissed into pocket state, disappears from the map without being destroyed, can reappear through the allowed action, and remains tied to the original caster/spell identity. |
| SSO-FAMILIAR-POCKET-ACTION-WIRING-001 | waiting | support_needed_now | Worker D + familiar-action explorer | familiar dismiss/recall command factory and action dispatch | caster ability injection + UI-path status check 2026-06-01; verification pending | `FamiliarPocketCommands.ts` provides runtime dismiss/recall commands, `AbilityCommandFactory` can create those commands from `familiar_pocket` effects, `SummoningCommand` adds `Dismiss Familiar` and `Recall Familiar` utility abilities to the caster when a familiar is created, and the existing ability palette/button path should render current-character abilities without special filtering. UI disable states, recall placement choice, turn-order lifecycle, and rendered/behavior proof remain pending. | `FamiliarPocketCommands.ts`; `combat.ts`; `AbilityCommandFactory.ts`; `SummoningCommand.ts`; `AbilityPalette.tsx`; `AbilityButton.tsx`; `CombatView.tsx`; `useAbilitySystem.ts`; familiar-action explorer report 2026-06-01. | Familiar pocket actions are generated and should be reachable through the existing combat ability UI, but the flow has not been run or visually proven. | Prove the ability path produces `DismissFamiliarToPocketCommand` and `RecallFamiliarFromPocketCommand`; add UI disable/availability rules if needed; ensure roster/pocket changes propagate and turn-order behavior is defined. | Focused proof that a player/AI familiar dismiss action produces `DismissFamiliarToPocketCommand`, a recall action produces `RecallFamiliarFromPocketCommand`, and roster/pocket changes propagate. |
| SSO-FAMILIAR-POCKET-STATE-PROPAGATION-001 | waiting | support_needed_now | Worker D + action-wiring explorer | command result propagation for pocketed summons | command-state propagation slice 2026-06-01; verification pending | Familiar pocket commands can remove/add non-target summon actors and update `pocketedSummons`, and the ability factory can create those commands. `useAbilitySystem` now accepts current `pocketedSummons`, publishes changed `pocketedSummons`, and can request full character-roster replacement when command results add/remove actor IDs. `CombatView` now owns a `pocketedSummons` list and passes it through the ability system. Proof is still pending, and turn-order lifecycle remains separate. | `FamiliarPocketCommands.ts`; `AbilityCommandFactory.ts`; `combat.ts`; `useAbilitySystem.ts`; `CombatView.tsx`; `useCombatEngine.ts`; action-wiring explorer report 2026-06-01. | Dismiss/recall can now propagate roster and pocket-list changes through the ability system handoff, but this still needs focused proof and does not settle turn-order rejoin/leave behavior. | Add focused proof that command-created pocket changes update the combat roster and pocketed list after execution; then resolve turn-order lifecycle and rendered 2D/3D proof. | Focused proof that a familiar dismiss action removes the actor from `characters`, adds it to `pocketedSummons`, recall reverses that state, and both updates reach CombatView state. |
| SSO-FAMILIAR-POCKET-TURNORDER-001 | open | support_needed_now | Worker D + insertion-point explorer | turn order and initiative lifecycle for dismissed/recalled familiars | insertion-point status check 2026-06-01 | Familiar pocketing removes/re-adds combat actors, but turn-order lifecycle APIs do not yet have an explicit leave/rejoin contract for dismissed or recalled summons. | `FamiliarPocketCommands.ts`; `useTurnOrder.ts`; `useTurnManager.ts`; `CombatView.tsx`; insertion-point explorer report 2026-06-01. | A dismissed familiar should not keep taking visible turns, and a recalled familiar needs a clear initiative/turn-order policy. | Define whether pocketed familiars leave turn order, remain skipped, or rejoin on caster initiative; then implement the lifecycle consistently. | Focused turn-order proof for dismissing and recalling a familiar before/after its turn. |
| SSO-L2-BACKLOG-MAP-001 | open | adjacent_follow_up | Worker D + level-2 explorer | level-2 coverage map, tracker routing | level-2 backlog refresh 2026-06-01 | `level-2-gap-backlog` is a placeholder, `gaps/LEVEL-2-GAPS.md` is absent, and no current level-2-scoped gap map ties 65 level-2 spell files to active SSO rows. | `TODO.md`; `LEVEL-2-BATCHES.md`; `STATUS_LEVEL_2.md`; `public/data/spells/level-2`; level-2 explorer report 2026-06-01. | Future agents need a bounded map from level-2 spell concerns to current mechanic rows instead of re-reading stale historical docs. | Create a level-2 coverage map that links current level-2 spells/categories to active SSO rows. | Coverage-map artifact plus tracker cross-links. |
| SSO-L2-GAP-HYGIENE-001 | open | adjacent_follow_up | Worker D + level-2 explorer | stale level-2 docs, current source-of-truth status | level-2 backlog refresh 2026-06-01 | Historical level-2 docs indicate drift or archival status, and `LEVEL-2-GAPS.md` is missing despite the TODO pointing to a former summary. | `LEVEL-2-BATCHES.md`; `STATUS_LEVEL_2.md`; `TODO.md`; level-2 explorer report 2026-06-01. | Stale level-2 docs can route agents toward outdated completion claims or nonexistent files. | Mark historical docs clearly and point to the current tracker/source-of-truth. | Documentation update proving the current level-2 truth chain. |
| SSO-L2-MONOLITHIC-QUEUE-L2-001 | open | support_needed_now | Worker D + level-2 explorer | level-2 spell conversion queue, monolithic effect migration | level-2 backlog refresh 2026-06-01 | Level-2 has 65 spell files and no current prioritized level-2 monolithic conversion queue; broader `SSO-MONOLITHIC-CONVERSION-QUEUE-001` remains open. | `public/data/spells/level-2`; `SSO-MONOLITHIC-CONVERSION-QUEUE-001`; level-2 explorer report 2026-06-01. | Level-2 migration work needs a current queue or it will remain ad hoc. | Either create a level-2 queue or explicitly route level-2 into the cross-level monolithic queue. | Queue artifact or explicit decision note. |
| SSO-L2-SYNC-TRACKER-001 | open | adjacent_follow_up | Worker D + level-2 explorer | level-2 backlog to active SSO row mapping | level-2 backlog refresh 2026-06-01 | Several active rows reference level-2 spells such as Enhance Ability, Blindness/Deafness, Hold Person, and Barkskin, but no parent mapping row ties them to the level-2 backlog. | `TRACKER.md`; `GAPS.md`; `public/data/spells/level-2`; level-2 explorer report 2026-06-01. | Without a mapping row, level-scoped work and mechanic-scoped work drift apart. | Add a compact mapping from level-2 categories/spells to existing SSO rows. | Tracker mapping note that future agents can resume from. |
| SSO-SPELL-CONTEXT-LOAD-001 | open | support_needed_now | integration explorer | `SpellContext` bundle loading proof | loader proof audit 2026-06-01 | Static validation and consumer tests exist, but only mocked `SpellContext.Provider` consumer tests were found; no proof mounts `SpellProvider` and proves `spells_bundle.json` loads through the runtime provider path. | `SpellContext.tsx`; `spells_bundle.json`; `SpellbookTab.test.tsx`; `CharacterCreator.test.tsx`; `NORTH_STAR.md`; loader explorer report 2026-06-01. | Spell data can validate on disk yet fail through the runtime provider surface. | Add focused `SpellProvider` mount/load proof. | Focused test or script proving `SpellProvider` loads bundle data and exposes expected spells. |
| SSO-SPELL-SERVICE-RESOLVE-001 | open | support_needed_now | integration explorer | `SpellService` manifest/file resolution proof | loader proof audit 2026-06-01 | Existing scripts prove manifest/file/schema integrity, but no test was found calling `spellService.getSpellDetails()` or `spellService.getAllSpellInfo()` through the runtime service path. | `SpellService.ts`; `spells_manifest.json`; `check-spell-integrity.ts`; `validate-data.ts`; `validateSpellJsons.ts`; `NORTH_STAR.md`; loader explorer report 2026-06-01. | Runtime service resolution can drift from static validation scripts. | Add focused proof for manifest-based `SpellService` resolution. | Focused test or script proving `getAllSpellInfo()` and `getSpellDetails()` resolve expected spells. |
| SSO-SPELL-INTEGRATION-RUNNER-001 | open | support_needed_now | integration explorer | end-to-end spell integration automation | integration automation refresh 2026-06-01 | Partial validation and ability-conversion checks exist, but no single automated runner chains JSON loading, validation, runtime loading, ability conversion, and status/report output. | `TODO.md`; `SPELL_INTEGRATION_CHECKLIST.md`; `package.json`; `validate-data.ts`; `validateSpellJsons.ts`; `check-spell-integrity.ts`; integration explorer report 2026-06-01. | A spell can pass one isolated check while failing another integration surface; a runner/report would make the durable status surface less manual. | Decide whether to compose existing scripts/tests into one runner or generate a report from focused checks. | One command/report that covers validation, loader, service, ability conversion, and status/report output. |
| SSO-SPELL-STATUS-SYNC-001 | open | adjacent_follow_up | integration explorer | automated Integration Status doc updates | integration automation refresh 2026-06-01 | No script was found that writes or refreshes `SPELL_INTEGRATION_STATUS.md` or `STATUS_LEVEL_*.md`; status docs are manually audited. | `SPELL_INTEGRATION_STATUS.md`; `STATUS_LEVEL_*.md`; `scripts`; integration explorer report 2026-06-01. | Manual status columns can become stale even when validation and conversion checks exist. | Decide whether status-doc sync should be automated or replaced by generated reports. | Generated status update proof or explicit decision not to auto-write status docs. |
| SSO-TERRAIN-MAPLESS-PERSISTENCE-001 | waiting | support_needed_now | Worker D | `src/hooks/useAbilitySystem.ts`, `src/systems/spells/effects/triggerHandler.ts`, `src/commands/effects/TerrainCommand.ts`, `ActiveSpellZone` | mapless terrain zone bridge 2026-06-01; verification pending | Mapless terrain now has a durable state bridge through existing `ActiveSpellZone` ownership. `TerrainCommand` still mutates map tiles when `mapData` exists. When no map data exists, the ability/spell execution path registers a terrain spell zone using `createTerrainSpellZoneFromAoEParams(...)`, preserving `TERRAIN` effects instead of relying only on the combat log. | `src/hooks/useAbilitySystem.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/commands/effects/TerrainCommand.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/components/BattleMap/BattleMapOverlay.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`. | This gives battle-map-less encounters a durable terrain record future movement, hazard, summary UI, or later map rendering can inspect. It also avoids inventing a second terrain-state subsystem while the combat engine already owns spell zones. | Add focused proof that a mapless terrain spell registers an `ActiveSpellZone` and persists beyond log output; then decide whether mapless terrain zones need a non-map summary UI. | Focused hook/engine proof for mapless terrain zone registration plus later UI proof if a mapless combat summary surface is chosen. |
| SSO-MAPLESS-TERRAIN-SUMMARY-UI-001 | open | adjacent_follow_up | Worker D | mapless combat UI, `ActiveSpellZone`, terrain-zone summaries | mapless terrain persistence follow-up 2026-06-01 | Mapless terrain now persists as `ActiveSpellZone` state, but bounded UI search found no player-facing mapless terrain summary surface. `CombatView` is map-first and passes zones to 2D/3D map renderers, while `CombatLog` only shows log lines. If combat ever runs without a battle map, terrain zones can now exist durably but may still be invisible to the player outside logs. | `src/hooks/useAbilitySystem.ts`; `src/systems/spells/effects/triggerHandler.ts`; `src/components/Combat/CombatView.tsx`; `src/components/BattleMap/CombatLog.tsx`; bounded search for `mapless`, `spellZones`, `terrain summary`, and `ActiveSpellZone`. | Persistence alone is not enough if battle-map-less encounters need the player to understand hazardous, difficult, foggy, or altered terrain after the original cast message scrolls away. | Decide whether mapless combat is a supported player-facing mode. If yes, add a terrain/effect summary surface that reads active terrain zones; if no, document that mapless terrain persistence is for future consumers only. | Decision note plus UI proof if supported, or explicit design note if mapless combat remains non-player-facing. |
| SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001 | waiting | adjacent_follow_up | Worker D | `src/components/BattleMap/BattleMapTile.tsx`, `BattleMapTile.environmentalEffects` | 2D tile marker slice 2026-06-01; verification pending | Tile-level `environmentalEffects` are now consumed directly by the 2D tile renderer. `BattleMapTile` maps existing effect types (`fire`, `ice`, `poison`, `difficult_terrain`, `web`, `fog`) to compact badges, tint overlays, and title text so map-mutated hazards can be visible even when no active spell-zone overlay is present. | `src/components/BattleMap/BattleMapTile.tsx`; `src/components/BattleMap/vfx/VFXSystem.tsx`; `src/types/combat.ts`; `src/commands/effects/TerrainCommand.ts`; bounded search for `environmentalEffects`. | Terrain mutation now has a 2D visual foothold, but the marker has not been rendered or tested and may need richer stack/tooltip handling for multiple simultaneous tile effects. | Run focused component proof or rendered inspection when verification is allowed; compare 2D badges/tints against 3D environmental visuals; decide whether stacked effects need a richer tile tooltip or multi-badge treatment. | Rendered 2D/3D comparison or focused component proof showing tile-level environmental effects are legible and do not fight visibility, targeting, or teleport overlays. |
| SSO-VALIDATOR-DTS-DRIFT-001 | done | support_needed_now | Working agent | `src/systems/spells/validation`, `src/types` | `SSO-AREA-ENTRY-EXIT-001` investigation; verified 2026-06-11 | The original `on_move_in_area` declaration drift is remediated in the checked declaration/type surface and guarded by `test:types`. The type test fixture was refreshed to match the current `Spell` contract and a missing `RacialRestChoiceData` export was restored. | `src/systems/spells/validation/spellValidator.ts`; `src/systems/spells/validation/spellValidator.d.ts`; `src/types/spells.d.ts`; `src/types/__tests__/spells.test-d.ts`; `src/types/character.ts`; 2026-06-01 fixed-string searches for `on_move_in_area`. | Declaration consumers can see the trigger vocabulary, and the type gate now catches future drift instead of failing on stale test fixtures. | Completed: keep declaration ownership concerns under future validator/type modularization work rather than this drift row. | `npm run test:types` passed on 2026-06-11 after refreshing the tsd fixture and adding `RacialRestChoiceData`; dependency sync ran for `src/types/character.ts`. |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, environment, or another person. |
| `uncertain` | Evidence exists, but outcome requires explicit proof/repro before priority-lock. |

## Import Rules

- Route cross-project or unrelated findings to `docs/projects/GLOBAL_GAPS.md`.
- If a gap is reclassified as out-of-scope or externally blocked, add a routing note in `TRACKER.md` before the next context handoff.
- Keep uncertainty rows in this project if they materially affect spell execution decisions.

## Repeat-save gap routing - 2026-05-31

Status: SSO-REPEAT-SAVE-001 remains open, but the gap is now classified as partial runtime coverage rather than missing-system work.

Evidence summary:
- src/hooks/combat/engine/useCombatEngine.ts has processRepeatSaves support for 	urn_end, 	urn_start, on_damage, and on_action timing.
- handleDamage marks damagedThisTurn and invokes on_damage repeat saves.
- processEndOfTurnEffects invokes 	urn_end repeat saves and then resets damagedThisTurn.
- src/hooks/combat/useActionExecutor.ts invokes on_action repeat saves for reak_free actions by 	argetEffectId.
- src/hooks/combat/useTurnManager.ts routes end-turn processing through the combat engine.

Confirmed remaining gaps:
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001: Spell status application must prove or add propagation of 
epeatSave, escapeCheck, and related break metadata from spell effects into the runtime status object consumed by the engine. Earlier evidence from StatusConditionCommand showed applied legacy status effects being rebuilt without that metadata.
- SSO-REPEAT-SAVE-TYPED-STATE-001: StatusEffect does not expose typed 
epeatSave metadata, while the engine currently reads (effect as any).repeatSave. The canonical runtime state shape needs to be made explicit without losing existing legacy status behavior.
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001: Existing tests cover the turn-end path, but on_damage, on_action, 	urn_start, dvantageOnDamage, size advantage/disadvantage, and save-penalty consumption need focused proof.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001: Manual StatusEffect tests do not prove that real spell data reaches combat runtime intact. At least one real spell with repeat-save data should be traced from validated spell data through application and repeat-save resolution.

Global gap routing: none from this slice. These findings belong to Structured Spell Execution rather than a cross-project tracker.

## Repeat-save metadata propagation implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-COMMAND-PROPAGATION-001 moved to waiting verification.
- SSO-REPEAT-SAVE-TYPED-STATE-001 is partially addressed for the runtime mirrors by adding typed metadata fields to StatusEffect and ActiveCondition.
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001 remains open.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 remains open.

Implementation evidence:
- src/types/combat.ts now exposes repeat-save, escape-check, and break-trigger metadata on both runtime condition mirrors.
- src/commands/effects/StatusConditionCommand.ts now copies that metadata from spell status conditions when applying or refreshing runtime status state.
- src/commands/effects/__tests__/StatusConditionCommand.test.ts now includes focused coverage for metadata preservation.

Verification status:
- Required dependency-header sync was run for src/types/combat.ts.
- The new test was added but not executed in this slice.

## Repeat-save timing coverage implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-TIMING-COVERAGE-001 moved to waiting verification.
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 remains open because the new coverage uses engine-level constructed runtime status effects, not real spell data flowing through factory/application/runtime.

Implementation evidence:
- Added src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts.
- The new coverage targets on_damage repeat-save processing through handleDamage.
- The new coverage targets on_action repeat-save processing through processRepeatSaves with a specific effect id.
- The damage-triggered case documents that dvantageOnDamage causes a second save roll and can end the effect when either roll succeeds.
- The action-triggered case documents that only the requested effect id is processed during break-free-style repeat saves.

Verification status:
- Tests were added but not executed.
- The status remains waiting until targeted test execution confirms the file compiles and behaves as intended.

## Real spell repeat-save proof implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-REAL-SPELL-PROOF-001 moved to waiting verification.
- The proof now starts from generated real spell data instead of a hand-built spell object.

Implementation evidence:
- Updated src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts.
- The new test finds the generated hold-person spell payload inside INGESTED_MONSTERS.
- It creates commands through SpellCommandFactory.createCommands.
- It executes the produced status-condition command against combat state with a failed save.
- It asserts the runtime statusEffects and conditions mirrors preserve the generated 
epeatSave metadata.

Remaining repeat-save gaps after this slice:
- Verification remains pending because tests were not executed.
- Broader typed-state cleanup remains open because the engine still reads repeat saves from status effects and some repeat-save logic still uses loose casts.
- 	urn_start, save progression thresholds, repeat-save prerequisites, and escape-check action execution are still not proven by focused runtime tests.

## Repeat-save typed-state cleanup implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-TYPED-STATE-001 moved forward: the combat engine now reads effect.repeatSave from the typed StatusEffect field instead of (effect as any).repeatSave.
- New project gap added: SSO-REPEAT-SAVE-CHECK-RESOLUTION-001.

New gap details:
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001: Repeat-save metadata allows check-style entries such as strength_check and wisdom_check, but the combat engine repeat-save processor currently resolves only saving throws. The engine now logs unsupported check-style repeat saves instead of forcing them through the saving-throw roller.

Implementation evidence:
- src/hooks/combat/engine/useCombatEngine.ts added an explicit repeat-save ability guard for Strength, Dexterity, Constitution, Intelligence, Wisdom, and Charisma saving throws.
- The engine now avoids loose ny casts for effect.repeatSave and repeat-save saving-throw calls.
- Unsupported repeat check types are preserved as a visible runtime limitation rather than being silently coerced.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Repeat-save check resolution implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-CHECK-RESOLUTION-001 moved to waiting verification.

Evidence from investigation:
- No suitable combat-focused ability-check resolver was found for repeat-save check entries.
- Existing bilityCheck / skillCheck usage is mostly data, dialogue, travel, crafting, and non-combat service logic.
- The shared 
ollD20 helper and ability modifier helper were sufficient for a bounded repeat-save check bridge.

Implementation evidence:
- src/hooks/combat/engine/useCombatEngine.ts now resolves supported check-style repeat saves for strength_check and wisdom_check.
- The check bridge rolls d20, adds the relevant ability modifier, compares against repeat-save DC, logs success/failure, and honors successEnds.
- Unsupported repeat-save types still produce a visible status log instead of silent coercion.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now includes focused coverage proving strength_check repeat saves do not route through saving throws.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Turn-start repeat-save lifecycle implementation - 2026-05-31

Status update:
- Repeat-save 	urn_start lifecycle support moved to waiting verification.
- This was a discovered sub-gap of SSO-REPEAT-SAVE-TIMING-COVERAGE-001: the engine processor supported 	urn_start, but the turn coordinator did not invoke it when a creature turn began.

Implementation evidence:
- src/hooks/combat/useTurnManager.ts now calls processRepeatSaves(updatedChar, 'turn_start') inside startTurnFor after economy/status refresh and before publishing the updated character.
- src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts now covers a successful 	urn_start repeat save during initializeCombat turn start.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/useTurnManager.ts.
- Tests were not executed.

## Repeat-save prerequisite guard implementation - 2026-05-31

Status update:
- Repeat-save prerequisite handling moved to partial implementation, waiting verification.
- New tracked gap: SSO-REPEAT-SAVE-LOS-RESOLUTION-001.
- New tracked dormant gap: SSO-REPEAT-SAVE-PROGRESSION-STATE-001.

Evidence from investigation:
- 
o_line_of_sight_to_caster appears in real generated spell data, including a Fear-style payload.
- Repeat-save progression threshold fields currently appear in types, validator, and schema, but no source/data usage was found for successThreshold, ailureThreshold, or consecutiveRequired outside schema/type definitions.

Implementation evidence:
- src/hooks/combat/engine/useCombatEngine.ts now detects the 
o_line_of_sight_to_caster prerequisite and does not grant the repeat save while that prerequisite cannot be evaluated.
- The engine logs the unresolved line-of-sight prerequisite instead of silently letting the save happen every turn.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now includes focused coverage that prerequisite-gated repeat saves are skipped and do not call 
ollSavingThrow.

Remaining gaps:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001: connect caster identity, map state, and existing line-of-sight utilities so 
o_line_of_sight_to_caster can be evaluated correctly instead of only guarded.
- SSO-REPEAT-SAVE-PROGRESSION-STATE-001: if spell data begins using progression thresholds, add per-effect repeat-save counters and outcomes. This is currently schema-supported but not active real-data work.

Verification status:
- Required dependency-header sync was run for src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Repeat-save line-of-sight prerequisite implementation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-LOS-RESOLUTION-001 moved to waiting verification.
- New caveat gap: SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001.

Implementation evidence:
- src/types/combat.ts now preserves sourceCasterId on both StatusEffect and ActiveCondition.
- src/commands/effects/StatusConditionCommand.ts now copies the applying caster id into both runtime condition mirrors.
- src/hooks/combat/engine/useCombatEngine.ts now evaluates 
o_line_of_sight_to_caster by finding the source caster, reading caster/target map tiles, and calling the existing hasLineOfSight utility.
- If the target can still see the caster, the repeat save is not granted.
- If line of sight is blocked, the normal repeat-save path proceeds.
- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts now covers both unavailable context and blocked-line-of-sight behavior.

Remaining caveat:
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001: statuses constructed outside StatusConditionCommand or loaded from older persisted combat state may lack sourceCasterId; those still skip prerequisite resolution with a visible log until their construction paths are audited.

Verification status:
- Required dependency-header sync was run for src/types/combat.ts and src/hooks/combat/engine/useCombatEngine.ts.
- Tests were not executed.

## Repeat-save source-caster backfill investigation - 2026-05-31

Status update:
- SSO-REPEAT-SAVE-SOURCE-CASTER-BACKFILL-001 is now classified as low-risk/manual-or-persistence audit, not an active production application-path bug.

Evidence from current-state search:
- Production 
epeatSave propagation appears to go through StatusConditionCommand, which now sets sourceCasterId on both StatusEffect and ActiveCondition.
- Other production status construction sites found in commands/hooks do not currently attach 
epeatSave metadata.
- Non-command repeat-save objects found were test fixtures/manual runtime objects, not live spell application paths.
- Generated monster/spell payloads contain 
epeatSave, but those are spell data payloads, not already-applied runtime StatusEffect objects.

Remaining caveat:
- Older persisted combat state, external/manual test fixtures, or future code paths can still construct repeat-save status effects without sourceCasterId. The engine already fails safely by skipping caster-relative prerequisite resolution when context is missing.

Verification status:
- Static search/classification only.
- No tests were executed.

## Object-target runtime resolver implementation - 2026-05-31

Status update:
- SSO-TARGET-ENVELOPE-001 moved to waiting verification for a minimal runtime object-target envelope.
- SSO-OBJECT-TARGET-001 moved forward but remains partially open because object selection/registry integration is not done.
- SSO-VALIDTARGETS-SEMANTICS-001 remains open for broader creature-or-object filter semantics across all callers.
- New gap: SSO-OBJECT-TARGET-REGISTRY-001.

Evidence from investigation:
- TargetResolver.isValidTarget still validates only CombatCharacter targets.
- Existing object support was schema/data-facing: objectEligibility exists in types/validator, and real spell data exposes object eligibility, but runtime target resolution had no object candidate path.
- The resolver explicitly treated objects as invalid for CombatCharacter targets.

Implementation evidence:
- src/systems/spells/targeting/TargetResolver.ts now exports a minimal TargetableObject envelope.
- TargetResolver.isValidObjectTarget validates object candidates separately from creature targets.
- The object path checks targeting type, object valid-target filters, range, optional line of sight, and object eligibility fields: worn/carried exclusion, magical-status exclusion, fixed-to-surface exclusion, max weight, and max size.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts now covers object target validation and confirms character targets are still rejected for object-only spells.

Remaining gaps:
- SSO-OBJECT-TARGET-REGISTRY-001: combat/UI needs a source of object candidates to pass into isValidObjectTarget; the resolver now supports candidates but does not discover them.
- SSO-VALIDTARGETS-SEMANTICS-001: callers still need a unified way to ask for creature targets, object targets, or both without each feature reinterpreting alidTargets.

Verification status:
- Required dependency-header sync was run for src/systems/spells/targeting/TargetResolver.ts.
- Tests were not executed.

## Object-target candidate registry investigation - 2026-05-31

Status update:
- SSO-OBJECT-TARGET-REGISTRY-001 remains open after investigation.
- The gap is now classified as cross-system: Structured Spell Execution needs object candidates, but the source of targetable physical objects belongs partly to combat map, item/loot, and interaction systems.
- Added a matching global gap entry so future non-spell object-system work can route back into spell targeting.

Evidence from investigation:
- src/services/battleMapGenerator.ts creates tile decorations such as tree, boulder, bush, stump, and fallen_log, but these are terrain/visual/obstacle properties, not item-like spell target candidates with weight, magical status, worn/carried state, or fixed/surface semantics.
- src/components/BattleMap/BattleMapTile.tsx renders decorations as visual glyphs and tile interaction affordances; it does not expose them as object entities.
- src/services/lootService.ts returns dropped item results after monsters are defeated, but those items are not positioned on the combat map and are not surfaced as targetable battle-map objects.

Decision:
- Do not fabricate TargetableObject candidates from visual decorations or unpositioned loot.
- Keep the existing TargetResolver.isValidObjectTarget bridge as the validation layer.
- Track object candidate discovery/registry separately.

Remaining implementation need:
- Define a combat/world object registry or adapter that can emit positioned TargetableObject candidates with enough metadata for spells like Catapult.

## ValidTargets mixed category semantics implementation - 2026-05-31

Status update:
- SSO-VALIDTARGETS-SEMANTICS-001 moved to waiting verification for resolver-level mixed category semantics.
- The broader target aggregation/UI gap remains open because resolver validation is not the same as producing a combined selectable target list.

Implementation evidence:
- src/systems/spells/targeting/TargetResolver.ts now treats creatures, objects, and point as allowed target categories instead of requiring one runtime target to satisfy all categories at once.
- Creature targets are no longer rejected just because a spell also allows objects.
- Object targets continue to use isValidObjectTarget rather than the creature resolver.
- llies, enemies, and self remain creature constraints.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts now covers mixed ['creatures', 'objects', 'enemies'] behavior for an enemy creature, ally creature, and loose object candidate.

Remaining gaps:
- SSO-MIXED-TARGET-AGGREGATION-001: callers still need a unified API that can return creature candidates and object candidates together once an object registry exists.
- SSO-OBJECT-TARGET-REGISTRY-001: still open; there is no source of positioned targetable object candidates yet.

Verification status:
- Required dependency-header sync was run for src/systems/spells/targeting/TargetResolver.ts.
- Tests were not executed.

## Mixed target aggregation API implementation - 2026-05-31

Status update:
- SSO-MIXED-TARGET-AGGREGATION-001 moved to waiting verification.
- SSO-OBJECT-TARGET-REGISTRY-001 remains open because the aggregation API accepts supplied object candidates but still does not discover them.

Implementation evidence:
- src/systems/spells/targeting/TargetResolver.ts now exports TargetCandidateSet.
- TargetResolver.getValidTargetCandidates returns valid creature targets plus valid supplied TargetableObject candidates through one caller-facing API.
- Object candidate discovery is dependency-injected as an optional array so the resolver does not fabricate objects from map decorations or loot.
- src/systems/spells/targeting/__tests__/TargetResolver.test.ts now covers mixed aggregation for enemy creatures and supplied loose/heavy object candidates.

Remaining gaps:
- SSO-OBJECT-TARGET-REGISTRY-001: no real source of positioned targetable object candidates exists yet.
- UI/selection callers still need to adopt getValidTargetCandidates where mixed targeting is needed.

Verification status:
- Required dependency-header sync was run for src/systems/spells/targeting/TargetResolver.ts.
- Tests were not executed.

## JSON schema movement timing alignment - 2026-05-31

Status update:
- SSO-JSON-SCHEMA-DRIFT-001 moved forward for the narrow on_move_in_area timing vocabulary drift.
- Broader JSON-schema trigger modeling remains open.

Evidence from investigation:
- on_move_in_area existed in src/types/spells.ts and src/systems/spells/validation/spellValidator.ts.
- on_move_in_area was absent from src/systems/spells/schema before this slice.
- The JSON schema files expose recurring timing enums but do not appear to model the same full shared EffectTrigger object as the Zod validator.

Implementation evidence:
- src/systems/spells/schema/parts/10-schedules-modes-and-relationships.json now includes on_move_in_area in RecurringMechanic.timing.
- src/systems/spells/schema/spell.schema.json now includes on_move_in_area in the corresponding bundled RecurringMechanic.timing definition.

Remaining gap:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: align/generated JSON schema should model the same shared EffectTrigger vocabulary as TypeScript/Zod, or document that JSON schema is intentionally narrower and generated from another source.

Verification status:
- Schema files were edited directly.
- No schema validator or tests were run.

## JSON schema source-of-truth and recurring timing parity - 2026-05-31

Status update:
- SSO-JSON-SCHEMA-DRIFT-001 moved forward again: RecurringMechanic.timing is now aligned across TypeScript, Zod, schema part, and aggregate schema for on_move_in_area.
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001 remains open for full EffectTrigger parity.

Evidence from investigation:
- scripts/syncSpellJsonSchemaRegistry.ts states that future edits should usually happen in src/systems/spells/schema/parts/, with src/systems/spells/schema/spell.schema.json remaining the stable aggregate path.
- The script can split, check, and write the aggregate from parts.
- The Zod EffectTrigger is a richer shared trigger object than the JSON schema recurring timing model.
- RecurringMechanic.timing existed separately in TypeScript, Zod, schema part, and aggregate schema.

Implementation evidence:
- src/types/spells.ts now includes on_move_in_area in RecurringMechanic.timing.
- src/systems/spells/validation/spellValidator.ts now includes on_move_in_area in the Zod RecurringMechanic.timing enum.
- Prior slice added on_move_in_area to src/systems/spells/schema/parts/10-schedules-modes-and-relationships.json and src/systems/spells/schema/spell.schema.json.

Remaining gap:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001: decide whether to add a full JSON-schema EffectTrigger definition, generate JSON schema from Zod/TypeScript, or explicitly document JSON schema as a narrower contributor schema.

Verification status:
- Required dependency-header sync was run for src/types/spells.ts.
- No schema sync check, test, or validation command was run.

## JSON schema EffectTrigger parity implementation - 2026-05-31

Status update:
- SSO-JSON-SCHEMA-TRIGGER-MODEL-001 moved to waiting verification.

Evidence from investigation:
- The aggregate JSON schema had no reusable EffectTrigger definition.
- The aggregate effect definitions did not expose a 	rigger property for DamageEffect, HealingEffect, StatusConditionEffect, MovementEffect, SummoningEffect, TerrainEffect, UtilityEffect, or DefensiveEffect.
- Zod already models EffectTrigger with trigger type, frequency, consumption, attack filter, movement type, and sustain cost.

Implementation evidence:
- src/systems/spells/schema/parts/20-effect-payloads.json now contains an EffectTrigger definition matching the Zod trigger vocabulary, including on_move_in_area.
- Each effect payload definition in that part now references #/definitions/EffectTrigger through a 	rigger property.
- scripts/syncSpellJsonSchemaRegistry.ts now assigns EffectTrigger to the 20-effect-payloads part so future split/check/write flows understand the new definition.
- src/systems/spells/schema/spell.schema.json was regenerated from schema parts with 
px tsx scripts/syncSpellJsonSchemaRegistry.ts --write-aggregate.

Verification status:
- Aggregate schema was regenerated from parts.
- No schema check, tests, or data validation were run.

## 2026-05-31 - SSO-VALIDATOR-DTS-DRIFT-001 declaration parity pass

Status: Partially remediated; waiting verification.

Evidence:
- src/systems/spells/validation/spellValidator.ts and src/types/spells.ts already include on_move_in_area in the source trigger vocabulary.
- Current declaration search showed src/types/spells.d.ts and src/systems/spells/validation/spellValidator.d.ts did not expose on_move_in_area before this pass.

Action taken:
- Added on_move_in_area to the exported EffectTrigger declaration union in src/types/spells.d.ts.
- Added on_move_in_area to the repeated validator declaration enum projections in src/systems/spells/validation/spellValidator.d.ts.

Remaining gap:
- The dependency-header sync tool reported that both .d.ts files are not present in its dependency map, so the generation/ownership path for these declaration artifacts is still unclear. Treat this as implemented for trigger vocabulary parity, but not yet verified as a durable declaration-generation fix.

### Follow-up evidence - declaration drift ownership

Additional evidence:
- package.json exposes 	est:types through 	sd --typings src/types/index.d.ts --files src/types/__tests__/spells.test-d.ts.
- Root and domain TypeScript configs mostly use 
oEmit; only 	sconfig.node.json showed emitDeclarationOnly, so the spell declarations are not obviously produced by the app typecheck path.
- The dependency visualizer docs/search evidence show .d.ts files are intentionally ignored by the graph, explaining why dependency sync could not update those headers.

Additional action:
- Added a 	sd type-level guard in src/types/__tests__/spells.test-d.ts proving declaration consumers can construct an EffectTrigger with 	ype: 'on_move_in_area'.

Revised classification:
- SSO-VALIDATOR-DTS-DRIFT-001 is now remediated at the declaration vocabulary and type-test guard level, but still waiting explicit 	est:types verification and a later ownership decision for whether these .d.ts files should remain manually maintained.

### 2026-06-01 follow-up - declaration drift status refresh

Current evidence:
- `src/systems/spells/validation/spellValidator.ts` includes `on_move_in_area` in the source trigger vocabulary.
- `src/systems/spells/validation/spellValidator.d.ts` includes `on_move_in_area` in the validator declaration projections.
- `src/types/spells.d.ts` includes `on_move_in_area` in the exported `EffectTrigger` declaration union.
- `src/types/__tests__/spells.test-d.ts` includes a type-level guard constructing an `EffectTrigger` with `type: 'on_move_in_area'`.

Status update:
- The original declaration-vocabulary drift is no longer an open implementation gap.
- The row remains `waiting` because `test:types` has not been run and declaration generation/ownership remains unclear.

## 2026-05-31 - SSO-AREA-SOURCE-OF-TRUTH-001 containment parity pass

Status: Partially implemented; waiting verification.

Evidence:
- AreaEffectTracker already delegates zone containment checks to isPositionInArea from 	riggerHandler.ts.
- AoECalculator owns targeting AoE tile generation through getAffectedTiles, but did not expose a reusable containment helper.
- 	riggerHandler.isPositionInArea still had its own distance math for persistent area zones, creating drift risk against targeting previews/resolution.

Action taken:
- Added AoECalculator.containsTile(...) so code can ask whether a position is inside the same affected-tile geometry used by targeting.
- Updated 	riggerHandler.isPositionInArea to delegate non-directional shapes (Sphere, Circle, Cube, Square, Cylinder) to AoECalculator.containsTile(...).
- Preserved the existing simplified fallback for Line, Cone, and unknown shapes because active zones do not yet carry direction data.
- Added an AoECalculator type/runtime test case that documents containment through affected-tile geometry.

Remaining gap:
- Directional persistent zones still cannot be fully unified with AoECalculator until active spell zones carry direction/orientation for Line and Cone effects.
- Verification is still pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-DIRECTIONAL-ZONE-ORIENTATION-001

Status: Newly confirmed gap; partially implemented; waiting verification.

Evidence:
- AoECalculator already requires a direction vector for Cone and Line geometry.
- ActiveSpellZone previously stored position and reaOfEffect, but no direction/orientation field.
- createSpellZone(...) had no direction parameter, so persistent directional zones could not preserve the casting orientation needed to share AoECalculator geometry.

Action taken:
- Added optional direction?: Position to ActiveSpellZone.
- Added optional direction storage to createSpellZone(...).
- Updated AreaEffectTracker containment calls to pass zone.direction through to isPositionInArea(...).
- Updated isPositionInArea(...) so Cone and Line can delegate to AoECalculator.containsTile(...) when direction is available.
- Added a focused trigger-handler test showing an east-facing cone includes an east-side tile and rejects a west-side tile.

Remaining gap:
- The casting/targeting path still needs to provide direction when creating persistent Cone or Line spell zones. Until then, existing directionless zones intentionally preserve the old simplified fallback behavior.
- Verification is still pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-ZONE-CASTING-INTEGRATION-001

Status: Newly confirmed gap; open.

Evidence:
- createSpellZone(...) is exported from 	riggerHandler.ts, but current source search found no production call sites.
- ddSpellZone(...) is exposed by useCombatEngine and returned through useTurnManager, but current source evidence only showed state management/tests, not spell-cast-to-zone construction.
- AreaEffectTracker processes spellZones, so runtime zone processing exists, but the casting/targeting bridge that should create persistent zones from structured spell effects is not yet proven.

Action taken:
- Added a focused factory guard showing createSpellZone(...) preserves a supplied direction vector for future Cone/Line zone creation.

Remaining gap:
- Identify and implement the combat spell-casting path that should call createSpellZone(...) or equivalent zone construction for persistent area effects.
- That path must pass target/origin and direction for directional shapes, then call ddSpellZone(...) so movement and end-turn processing can observe the zone.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-DIRECTIONAL-ZONE-STANDALONE-PARITY-001

Status: Implemented; waiting verification.

Evidence:
- AreaEffectTracker had been updated to pass zone.direction into isPositionInArea(...).
- The standalone processAreaEntryTriggers(...), processAreaExitTriggers(...), and processAreaEndTurnTriggers(...) paths still called isPositionInArea(...) without direction, leaving the two area-processing paths behaviorally inconsistent for directional zones.

Action taken:
- Updated standalone area trigger processors to pass zone.direction into containment checks.
- Added a focused processAreaEntryTriggers(...) guard showing an east-facing cone does not trigger on west-side movement but does trigger when the mover enters the east-facing cone.

Remaining gap:
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-AOE-GEOMETRY-UTILITY-SPLIT-001

Status: Newly confirmed gap; open.

Evidence:
- Persistent zone containment now delegates through systems/spells/targeting/AoECalculator.
- TerrainCommand still calculates terrain affected tiles through utils/aoeCalculations and utils/targetingUtils.
- useTargeting/useAbilitySystem also use the utils AoE path for previews and target collection.

Risk:
- The spell project still has at least two AoE geometry engines. Even after persistent zone containment was partially consolidated, terrain commands and targeting previews may disagree with AoECalculator about size conversion, cone/line direction, line width, and tile inclusion.

Needed next:
- Decide whether AoECalculator or utils/aoeCalculations is the canonical geometry engine, then migrate the other callers or add explicit adapter tests that prove parity.

## 2026-05-31 - SSO-AOE-GEOMETRY-UTILITY-SPLIT-001 adapter consolidation pass

Status: Partially implemented; waiting verification.

Evidence:
- utils/combat/aoeCalculations.ts is the geometry path already used by targeting previews, ability target collection, and TerrainCommand through the deprecated bridge imports.
- The previous AoECalculator implementation used separate grid algorithms with different behavior: Euclidean sphere math, centered cube convention, and a wider vector cone.
- Persistent zone containment had recently started using AoECalculator, which meant zones could disagree with targeting and terrain commands.

Action taken:
- Updated AoECalculator to delegate affected-tile generation to calculateAffectedTiles(...) from utils/combat/aoeCalculations.ts.
- Kept the AoECalculator public API stable by adapting vector directions into the shared utility's compass-degree direction format.
- Mapped Square to the shared utility's Cube shape, preserving the existing 2D planar-square behavior.
- Updated AoECalculator tests to the shared origin-based cube convention and added a parity guard comparing AoECalculator.getAffectedTiles(...) to calculateAffectedTiles(...) for a sphere.

Remaining gap:
- Existing callers still import through multiple surfaces (AoECalculator, deprecated utils/aoeCalculations, and direct utils/combat/aoeCalculations). A later cleanup should standardize import ownership once behavior is verified.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-AOE-GEOMETRY-IMPORT-OWNERSHIP-001

Status: Partially implemented; waiting verification.

Evidence:
- The previous adapter consolidation made AoECalculator delegate to utils/combat/aoeCalculations.ts.
- Active callers still imported through deprecated bridge modules: src/utils/aoeCalculations.ts and src/utils/targetingUtils.ts.
- Those bridge files explicitly describe themselves as deprecated middlemen and point callers toward utils/combat and utils/spatial.

Action taken:
- Updated TerrainCommand to import AoE calculations from utils/combat/aoeCalculations and targeting shape mapping from utils/spatial/targetingUtils.
- Updated useTargeting to import directly from utils/combat/aoeCalculations and utils/spatial/targetingUtils.
- Updated useAbilitySystem to import directly from utils/combat/aoeCalculations and utils/spatial/targetingUtils.

Remaining gap:
- This removes the active spell/targeting/terrain callers from deprecated bridge imports, but it does not prove no other non-spell callers still use the bridges.
- Verification is pending; tests/typecheck/import audits were not run in this pass.

## 2026-05-31 - SSO-AOE-GEOMETRY-IMPORT-OWNERSHIP-001 import audit pass

Status: Active source imports remediated; waiting verification.

Evidence:
- Fixed-string source searches found no remaining imports of ../utils/aoeCalculations, ../../utils/aoeCalculations, @/utils/aoeCalculations, ../utils/targetingUtils, ../../utils/targetingUtils, or @/utils/targetingUtils.
- Remaining search hits were comments/headers, not active imports.

Action taken:
- Updated the stale 	riggerHandler.ts directional-AoE comment to point future work at the canonical src/utils/combat/aoeCalculations.ts geometry path instead of the deprecated bridge path.

Remaining gap:
- This proves the checked active source import patterns are remediated, but tests/typecheck were not run and generated/declaration/docs references were not audited broadly.

## 2026-05-31 - SSO-ZONE-CASTING-INTEGRATION-001 AoE-param bridge helper pass

Status: Partially implemented; waiting production integration and verification.

Evidence:
- Targeting previews and ability target collection already produce shared AoEParams through the canonical AoE utility path.
- ActiveSpellZone now supports direction, but the casting bridge still needed a reusable way to convert shared AoE targeting params into persistent zone origin/orientation.

Action taken:
- Added createSpellZoneFromAoEParams(...) in 	riggerHandler.ts.
- The helper creates an ActiveSpellZone using oeParams.origin as the zone position and converts either 	argetPoint or compass-degree direction into the vector direction format consumed by persistent zone containment.
- Added a focused test guard proving a 90-degree shared AoE direction becomes an east-facing zone vector.

Remaining gap:
- No production spell-casting path calls this helper yet. The next implementation slice should wire persistent area spell effects from the ability/spell execution flow into this helper and then into ddSpellZone(...).
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-ZONE-CASTING-INTEGRATION-001 production callback pass

Status: Partially implemented; waiting verification.

Evidence:
- useAbilitySystem is the spell command execution orchestrator for combat UI ability usage.
- CombatView and BattleMapDemo both instantiate useAbilitySystem and already have access to 	urnManager.addSpellZone.
- The previous bridge helper could create an ActiveSpellZone from shared AoE params, but no production caller registered the zone.

Action taken:
- Added optional onAddSpellZone support to useAbilitySystem.
- After successful spell command execution, useAbilitySystem now registers a persistent zone when the spell has an AoE and at least one persistent area trigger (on_enter_area, on_exit_area, on_end_turn_in_area, on_move_in_area, 	urn_start, or 	urn_end).
- The registered zone reuses 
esolveAoEParams(...) output from the targeting path and createSpellZoneFromAoEParams(...) from the area trigger system.
- Threaded 	urnManager.addSpellZone into useAbilitySystem from CombatView and BattleMapDemo.

Remaining gap:
- Verification is pending; tests/typecheck were not run in this pass.
- Area-trigger effects may still also produce immediate commands through SpellCommandFactory; a follow-up should confirm whether persistent area-trigger effects need to be excluded from immediate command execution to prevent duplicate/immediate resolution.

## 2026-05-31 - SSO-AREA-TRIGGER-IMMEDIATE-COMMAND-DUPLICATION-001

Status: Implemented; waiting verification.

Evidence:
- SpellCommandFactory still had an explicit TODO warning that area triggers should not fall through to immediate commands.
- The factory switch would create ordinary commands such as DamageCommand for effects whose trigger was on_enter_area, on_exit_area, on_end_turn_in_area, or on_move_in_area.
- The production path now registers persistent zones through useAbilitySystem and createSpellZoneFromAoEParams(...), so those delayed effects need to be owned by the zone tracker instead of immediate command execution.

Action taken:
- Added persistent area-trigger detection to SpellCommandFactory.
- SpellCommandFactory now returns no immediate command for on_enter_area, on_exit_area, on_end_turn_in_area, and on_move_in_area effects.
- Added a focused factory regression guard proving an on_enter_area damage effect produces zero immediate commands.

Remaining gap:
- Verification is pending; tests/typecheck were not run in this pass.
- A later pass should confirm whether non-area 	urn_start/	urn_end effects need similar delayed ownership or a separate runtime path.

## 2026-05-31 - SSO-SCHEDULED-EFFECT-RUNTIME-001

Status: Newly confirmed gap; open.

Evidence:
- Generated spell data contains DAMAGE effects with bare 	rigger.type: 'turn_start' and 	rigger.type: 'turn_end'.
- AreaEffectTracker and standalone area processors support on_end_turn_in_area and legacy zone-local 	urn_end, but no current evidence showed a zone 	urn_start processor.
- Repeat-save timing also uses 	urn_start/	urn_end, but that is a separate status-effect metadata path and should not be confused with SpellEffect trigger execution.

Action taken:
- Tightened useAbilitySystem persistent-zone registration to explicit area-zone triggers only: on_enter_area, on_exit_area, on_end_turn_in_area, and on_move_in_area.
- This avoids registering persistent zones solely because a spell has a bare scheduled 	urn_start or 	urn_end effect, which may be target-delayed rather than area-owned.

Remaining gap:
- Bare 	urn_start/	urn_end SpellEffect triggers still need a dedicated runtime owner. They should not be treated as immediate effects, but suppressing their commands globally would strand existing generated spell data until a scheduled-effect tracker exists.
- A later slice should design or connect a per-target scheduled-effect runtime for examples like delayed acid damage and start-of-turn cylinder damage.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-SCHEDULED-EFFECT-RUNTIME-001 registration surface pass

Status: Partially implemented; waiting processing and verification.

Evidence:
- Bare 	urn_start/	urn_end SpellEffect triggers exist in generated spell data and are distinct from repeat-save timing metadata.
- Combat already had state surfaces for active spell zones, movement debuffs, and reactive triggers, but no state surface for target-bound scheduled spell effects.

Action taken:
- Added ScheduledSpellEffect and createScheduledSpellEffect(...) to the spell effects runtime surface.
- Added scheduled-effect state, add/remove callbacks, and expiry filtering to useCombatEngine.
- Exposed scheduled-effect state and callbacks through useTurnManager.
- Threaded 	urnManager.addScheduledSpellEffect into useAbilitySystem from both CombatView and BattleMapDemo.
- useAbilitySystem now registers target-bound scheduled spell effects after successful spell command execution when a spell has bare 	urn_start or 	urn_end effects.

Remaining gap:
- Scheduled effects are registered but not yet processed at turn start/end. Until processing exists, SpellCommandFactory should not globally suppress bare 	urn_start/	urn_end commands or those effects could be stranded.
- A follow-up slice should process scheduledSpellEffects inside turn start/end flow, then suppress immediate commands for bare scheduled triggers once delayed execution is proven.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-SCHEDULED-EFFECT-RUNTIME-001 processing pass

Status: Implemented for damage/healing scheduled payloads; waiting verification.

Evidence:
- Scheduled spell effects now have a combat-engine state surface and are registered by useAbilitySystem for bare 	urn_start and 	urn_end SpellEffect triggers.
- useTurnManager already owns turn-start and turn-end sequencing, while useCombatEngine owns damage/healing mechanics and combat logs.

Action taken:
- Added processScheduledSpellEffects(...) to useCombatEngine.
- Turn-start scheduled effects are processed from startTurnFor(...) after repeat saves and before the turn-start log/update completes.
- Turn-end scheduled effects are processed inside processEndOfTurnEffects(...), alongside existing tile, zone, status, and repeat-save end-turn mechanics.
- One-time scheduled effects are removed after firing; recurring/default scheduled effects remain until expiry.
- SpellCommandFactory now suppresses immediate command creation for bare 	urn_start and 	urn_end effects, because those effects now have a delayed runtime owner.
- Added a focused factory guard proving a 	urn_end damage effect produces no immediate command.

Remaining gap:
- Current scheduled-effect processing handles converted damage and healing payloads. Status-condition or utility scheduled payloads still need explicit behavior if generated data relies on them.
- Verification is pending; tests/typecheck were not run in this pass.

## 2026-05-31 - SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001

Status: Newly confirmed gap; open.

Evidence:
- Generated scheduled trigger audit found these SpellEffect payload counts: 	urn_start:DAMAGE = 2, 	urn_start:MOVEMENT = 2, 	urn_start:STATUS_CONDITION = 1, 	urn_end:DAMAGE = 8, and 	urn_end:STATUS_CONDITION = 6.
- Current scheduled-effect runtime processes converted damage and healing payloads only.
- convertSpellEffectToProcessed(...) can emit status_condition, but the scheduled runtime does not yet apply save checks, condition immunity, status mirrors, or condition entries for scheduled status payloads.
- convertSpellEffectToProcessed(...) does not currently emit movement payloads, so scheduled movement effects have no runtime representation.

Classification:
- Scheduled damage is partially covered by the new scheduled-effect runtime.
- Scheduled status-condition payloads are confirmed open runtime work.
- Scheduled movement payloads are confirmed open converter and runtime work.

Needed next:
- Add scheduled status-condition handling by reusing or extracting the zone/status application rules currently present in useActionExecutor.
- Add movement conversion/runtime support only after identifying the generated movement scheduled effects and their intended movement semantics.
- Keep this separate from repeat-save timing; repeat-save 	urn_start/	urn_end is already a status metadata path, not a SpellEffect scheduled payload path.

## 2026-05-31 - Scheduled effect payload gap update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - partial implementation

Status: partially implemented.

Evidence added this pass:
- `src/hooks/combat/engine/useCombatEngine.ts` now processes converted `status_condition` payloads from scheduled `turn_start` / `turn_end` spell effects.
- The scheduled status path uses the stored caster id for save DC when the caster is still present, with a target fallback only when caster context is unavailable.
- The runtime now respects `conditionImmunities`, spends one-time scheduled triggers even when the target saves or is immune, and mirrors applied conditions into both `statusEffects` and `conditions`.
- Repeat-save, escape-check, and break-trigger metadata are preserved through an explicit processed-effect bridge so scheduled conditions do not become lossy compared with immediate status-condition effects.

Still open:
- Scheduled movement / forced-movement payloads are not executed yet.
- The processed scheduled status payload still needs a first-class typed metadata shape instead of the temporary bridge.
- Dedicated tests for scheduled status effects were not added or run in this pass.

## 2026-05-31 - Scheduled movement payload gap update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - movement implementation added, verification still open

Status: implemented in code, not verified.

Evidence added this pass:
- `src/commands/effects/MovementCommand.ts` already provides the reusable execution surface for spell movement payloads, including push, pull, teleport, speed-change, stop, forced movement, collision checks, and map-bound checks.
- `src/hooks/combat/engine/useCombatEngine.ts` now routes scheduled `MOVEMENT` effects through `MovementCommand` instead of inventing separate movement rules inside the scheduled-effect processor.
- Scheduled movement command logs are forwarded through the hook's normal `onLogEntry` path so delayed movement remains visible in combat history.
- The hook updates the scheduled target from the command result and consumes the scheduled trigger once the command has attempted execution.

Still open:
- No focused scheduled-movement tests were added in this pass.
- No typecheck or runtime verification was run in this pass.
- Teleport quality still depends on the existing command's available `destination`, `targetPosition`, or `validMoves` inputs; scheduled effects currently provide an empty valid-move list unless the effect itself carries a destination.
- The processed-effect type bridge remains incomplete for rich status metadata, although raw scheduled `MOVEMENT` effects now bypass that converter.

## 2026-05-31 - Scheduled status metadata bridge update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - typed status metadata bridge implemented

Status: implementation improved, verification still open.

Evidence added this pass:
- `src/systems/spells/effects/triggerHandler.ts` now exposes repeat-save, escape-check, and break-trigger metadata directly on `ProcessedEffect`.
- `convertSpellEffectToProcessed(...)` now preserves condition metadata from known top-level, `statusCondition`, and `condition` declaration shapes while the spell-data migration remains mixed.
- `src/hooks/combat/engine/useCombatEngine.ts` no longer uses a temporary `any` bridge for scheduled status metadata; it reads the typed processed-effect fields directly.

Still open:
- No focused tests were added or run for metadata preservation through scheduled status effects.
- No typecheck was run in this pass.
- The converter still relies on transitional loose spell-effect narrowing because the broader `SpellEffect` union is not yet precise enough for all migrated declaration shapes.

## 2026-05-31 - Scheduled effect focused coverage update

### SSO-SCHEDULED-STATUS-MOVEMENT-PAYLOAD-001 - focused tests added, execution still unverified

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` now covers scheduled status-condition metadata preservation into both `statusEffects` and `conditions`.
- The same test file covers scheduled `MOVEMENT` payload execution through the movement-command bridge by asserting a delayed push changes target position and forwards command log output.

Still open:
- The new tests were not run in this pass.
- Typecheck was not run in this pass.
- Scheduled teleport effects still need a follow-up decision about live `validMoves` / destination resolution quality.
- Broader converter casts remain until the source `SpellEffect` union is normalized.

## 2026-05-31 - Scheduled teleport destination quality update

### SSO-SCHEDULED-TELEPORT-DESTINATION-001 - implementation improved, verification still open

Status: partially implemented.

Evidence added this pass:
- `src/hooks/combat/engine/useCombatEngine.ts` now supplies scheduled teleport movement commands with map-derived valid destination candidates instead of an empty `validMoves` list.
- Candidate destinations are constrained by the delayed teleport effect's distance, occupied combatant tiles, and known blocked battle-map tiles.
- `src/commands/effects/MovementCommand.ts` now rejects known `blocksMovement` battle-map tiles during shared movement validation, so immediate and scheduled movement effects use the same terrain guard.
- `MovementCommand` now sorts fallback teleport candidates by closeness to the requested destination instead of using insertion order.

Still open:
- No focused scheduled teleport tests were added or run in this pass.
- No typecheck was run in this pass.
- Forced push/pull/stop movement still uses straight-line stepping and does not pathfind around obstacles; that is a broader movement-command quality gap rather than a scheduled-effect-only gap.

## 2026-05-31 - Scheduled teleport focused coverage update

### SSO-SCHEDULED-TELEPORT-DESTINATION-001 - focused test added, execution still unverified

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` now includes a scheduled teleport test for a blocked remembered destination.
- The test covers the intended fallback behavior: scheduled teleport supplies map-derived candidates, `MovementCommand` rejects the blocked destination, and the target lands on the nearest valid tile.

Still open:
- The new scheduled teleport test was not run in this pass.
- Typecheck was not run in this pass.
- Broader forced movement still uses straight-line stepping instead of obstacle-aware pathfinding.

## 2026-05-31 - Forced movement routing update

### SSO-FORCED-MOVEMENT-PATHFINDING-001 - implementation added, verification still open

Status: implemented in shared command layer; test execution still open.

Evidence added this pass:
- Existing obstacle-aware A* pathfinding was found in `src/utils/spatial/pathfinding.ts`, exported through `src/utils/pathfinding.ts`.
- `src/commands/effects/MovementCommand.ts` now reuses that pathfinder for walking-style `forcedMovement` under the `movementType: "stop"` branch when battle-map data is available.
- Physical `push` / `pull` effects keep their straight-line behavior; the routing improvement is limited to fear-like away/toward movement where walking around obstacles is appropriate.
- `src/commands/effects/__tests__/MovementCommand.test.ts` now includes focused coverage proving away-from-caster forced movement can route around a blocked tile instead of stopping at the first wall.

Still open:
- The new MovementCommand test was not run in this pass.
- Typecheck was not run in this pass.
- The routing scorer chooses the best reachable tile by caster distance and path cost, but it does not yet model tactical avoidance, hazards, or player-choice prompts for ambiguous forced routes.

## 2026-05-31 - Area trigger source-context update

### SSO-AREA-TRIGGER-SOURCE-CONTEXT-001 - implementation added, verification still open

Status: implemented in code; test execution still open.

Evidence added this pass:
- `src/systems/spells/effects/triggerHandler.ts` now defines `ProcessedEffectSourceContext` and carries optional `sourceContext` on `ProcessedEffect`.
- Standalone trigger handlers now pass zone or movement-debuff `spellId` / `casterId` into `convertSpellEffectToProcessed(...)`.
- `src/systems/spells/effects/AreaEffectTracker.ts` now passes active zone `spellId` / `casterId` when converting movement, entry, exit, and end-turn area effects.
- `src/hooks/combat/useActionExecutor.ts` now uses `effect.sourceContext.casterId` when calculating area-trigger damage/status save DCs, falling back to the target only when source context is unavailable.

Still open:
- No focused source-context tests were added or run in this pass.
- Typecheck was not run in this pass.
- `sourceContext.saveDC` is supported by the type but not yet populated at cast time, so the current implementation re-resolves caster DC from live caster data when possible.

## 2026-05-31 - Save DC snapshot update

### SSO-AREA-TRIGGER-SOURCE-CONTEXT-001 - saveDC snapshot implemented for cast bridge, verification still open

Status: implementation improved; verification still open.

Evidence added this pass:
- `src/systems/spells/effects/triggerHandler.ts` now stores optional `saveDC` on `ActiveSpellZone`, `ScheduledSpellEffect`, and `MovementTriggerDebuff`.
- `createSpellZone(...)`, `createSpellZoneFromAoEParams(...)`, `createScheduledSpellEffect(...)`, and `createMovementDebuff(...)` now accept optional save DC input.
- Processed effects converted from zones/debuffs now include `sourceContext.saveDC` when the owning zone/debuff has a saved DC.
- `src/hooks/useAbilitySystem.ts` now snapshots `calculateSpellDC(caster)` at cast time and passes it into persistent zones and scheduled turn effects.
- `src/hooks/combat/engine/useCombatEngine.ts` now uses scheduled-effect `saveDC` before falling back to live caster/target DC calculation.

Still open:
- No focused tests were added or run for saveDC snapshot behavior in this pass.
- Typecheck was not run in this pass.
- `createMovementDebuff(...)` supports saveDC but no live caller was found in this pass, so movement-debuff saveDC population remains future-facing until a caller exists or is wired.

## 2026-05-31 - Save DC snapshot focused coverage update

### SSO-AREA-TRIGGER-SOURCE-CONTEXT-001 - focused saveDC tests added, execution still open

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/systems/spells/effects/__tests__/AreaEffectTracker.test.ts` now includes coverage proving an active zone's snapshotted `saveDC` is carried into processed area-trigger `sourceContext`.
- `src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts` now includes coverage proving scheduled status saves use the stored `saveDC` in combat-log data.

Still open:
- The new tests were not run in this pass.
- Typecheck was not run in this pass.
- Movement-triggered debuff saveDC population remains future-facing until a live caller is introduced or found.

## 2026-05-31 - Target-move debuff registration update

### SSO-TARGET-MOVE-DEBUFF-REGISTRATION-001 - implementation added, verification still open

Status: implemented in cast bridge; test execution still open.

Evidence added this pass:
- Search found `createMovementDebuff(...)` and engine storage existed, but no live ability-cast registration path for `on_target_move` effects.
- `src/hooks/useAbilitySystem.ts` now exposes `onAddMovementDebuff`, detects spell effects with `trigger.type === "on_target_move"`, and registers per-target movement debuffs after successful spell execution.
- Registered movement debuffs now receive the same cast-time `saveDC` snapshot used by persistent zones and scheduled effects.
- `src/components/Combat/CombatView.tsx` and `src/components/BattleMap/BattleMapDemo.tsx` now pass `turnManager.addMovementDebuff` into `useAbilitySystem`.

Still open:
- No focused tests were added or run for target-move debuff registration in this pass.
- Typecheck was not run in this pass.
- Movement-debuff payload execution still depends on existing `processMovementTriggers(...)` handling in `useActionExecutor`, which needs focused coverage with source-context/saveDC assertions.

## 2026-06-01 - Target-move debuff registration coverage update

### SSO-TARGET-MOVE-DEBUFF-REGISTRATION-001 - focused registration test added, execution still open

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes coverage proving a spell effect with `trigger.type === "on_target_move"` registers a movement debuff after successful spell execution.
- The test asserts the created debuff carries the spell id, caster id, target id, original `on_target_move` effect, and cast-time `saveDC`.

Still open:
- The new test was not run in this pass.
- Typecheck was not run in this pass.
- Movement-triggered payload execution still needs focused coverage proving `processMovementTriggers(...)` and `useActionExecutor` consume the saved `sourceContext.saveDC` when the target later moves.

## 2026-06-01 - Combat-map visualization gap

### SSO-COMBAT-MAP-VISUALIZATION-001 - 2D/3D spell execution visibility not yet covered

Status: newly identified open gap.

Finding:
- The current Structured Spell Execution work has focused on declaration validation, trigger registration, runtime execution, save DC preservation, and unit-level coverage.
- It has not yet answered what structured spell execution looks like to the player on the combat map.

Scope:
- 2D combat map: show active spell zones, delayed scheduled effects, target-move debuffs, forced movement, teleports, area entry/exit/end-turn triggers, and save/resist outcomes in a readable way.
- 3D combat map: preserve equivalent visibility for zones, trigger timing, movement paths, teleport destinations, forced movement, and delayed payload resolution without relying only on the 2D HUD/log.
- Cross-view consistency: the same spell state should be visible and understandable in both views, even if the rendering treatment differs.

Evidence needed:
- Identify existing 2D and 3D combat-map rendering surfaces for zones, paths, movement, animations, damage numbers, status indicators, and combat-log affordances.
- Determine which existing surfaces already cover spell zones or delayed triggers.
- Add missing visual representation only after reusing existing map/animation/HUD patterns where possible.
- Verify visual behavior with rendered inspection before marking this gap closed.

Open questions:
- Should delayed effects have distinct telegraphing before they resolve, or only a resolution animation/log entry?
- Should forced movement display the chosen path before or during execution?
- Should 2D and 3D share one spell-visual state model with separate renderers?

## 2026-06-01 - Combat-map active-zone visualization update

### SSO-COMBAT-MAP-VISUALIZATION-001 - active spell zones now surfaced in 2D and 3D, verification still open

Status: partially implemented.

Evidence found:
- `src/components/BattleMap/BattleMapOverlay.tsx` already rendered 2D damage numbers, status badges, spell ripples, and targeting AoE previews, but not persistent structured spell zones.
- `src/components/BattleMap/vfx/VFXSystem.tsx` already rendered 3D tile environmental effects and AoE previews, but it read tile `environmentalEffects`, not active `spellZones`.
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMap3D.tsx` both have access to `turnManager.spellZones` through their combat state paths.

Implementation added:
- 2D map: `BattleMapOverlay` now accepts `spellZones`, derives covered tiles with the same `isPositionInArea(...)` helper used by trigger processing, and draws persistent cyan zone overlays after targeting preview ends.
- 3D map: `VFXSystem` now accepts `spellZones`, converts covered zone tiles into the existing per-tile ground-effect visual payload, and renders them through the existing `SpellZoneEffect` path.
- Host wiring: `BattleMap.tsx` and `BattleMap3D.tsx` now pass `turnManager.spellZones` into the visual layers.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Zone visuals currently use a generic cyan/fog treatment rather than spell-school or damage-type-specific styling.
- Scheduled effects, target-move debuffs, forced-movement paths, teleport destinations, save/resist outcomes, and trigger timing telegraphs still need explicit map visibility work.

## 2026-06-01 - Combat-map target-bound spell-state visualization update

### SSO-COMBAT-MAP-VISUALIZATION-001 - scheduled and movement-trigger markers added, verification still open

Status: partially implemented.

Evidence added this pass:
- `src/components/BattleMap/BattleMapOverlay.tsx` now accepts `scheduledSpellEffects` and `movementDebuffs` in addition to active `spellZones`.
- The 2D overlay now marks affected target tiles with `DELAY` for scheduled turn effects and `MOVE` for target-move debuffs.
- `src/components/BattleMap/vfx/VFXSystem.tsx` now accepts the same target-bound spell state and renders compact 3D `Html` markers over affected combatants.
- `src/components/BattleMap/BattleMap.tsx` and `src/components/BattleMap/BattleMap3D.tsx` now pass `turnManager.scheduledSpellEffects` and `turnManager.movementDebuffs` into their visual layers.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Markers are generic text labels rather than spell-specific iconography, timing rings, or condition-aware visual language.
- Forced-movement paths, teleport destinations, save/resist outcomes, and trigger-resolution animations still need visual treatment.

## 2026-06-01 - Combat-map floating combat feedback parity update

### SSO-COMBAT-MAP-VISUALIZATION-001 - 3D damage/heal/miss feedback connected, verification still open

Status: partially implemented.

Evidence added this pass:
- src/components/BattleMap/BattleMap.tsx already passed 	urnManager.damageNumbers into the 2D BattleMapOverlay.
- src/components/BattleMap/vfx/VFXSystem.tsx already had a 3D DamageNumber Html component, but VFXSystemProps did not accept the shared 	urnManager.damageNumbers state.
- src/components/BattleMap/BattleMap3D.tsx already passed zones, scheduled effects, and movement debuffs into VFXSystem, but not floating combat feedback.

Implementation added:
- 3D map: VFXSystem now accepts shared damageNumbers and renders floating damage/heal/miss feedback above the relevant combat-map tile.
- 3D map: the existing 3D damage-number component now renders MISS for miss-style outcomes instead of displaying a numeric placeholder.
- Host wiring: BattleMap3D now passes 	urnManager.damageNumbers into the 3D VFX layer.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Save/resist outcomes are only covered if runtime emits them as shared miss feedback; scheduled saves and condition immunities still need explicit runtime-to-visual outcome review.
- Forced-movement paths and teleport destination previews still need visual treatment.

## 2026-06-01 - Combat-map save/resist/immune feedback update

### SSO-COMBAT-MAP-VISUALIZATION-001 - resisted status outcomes now emit shared map feedback, richer labels still open

Status: partially implemented.

Evidence added this pass:
- src/hooks/combat/useActionExecutor.ts already logged area-trigger status save success, resistance, and condition immunity, but those status-prevention outcomes did not add shared damage-number feedback.
- src/hooks/combat/engine/useCombatEngine.ts already logged scheduled status save success, scheduled condition immunity, and repeat-save success, but those status-prevention outcomes did not add shared damage-number feedback.
- src/components/BattleMap/DamageNumberOverlay.tsx and src/components/BattleMap/vfx/VFXSystem.tsx now both render shared miss feedback, making it the available cross-view visual vocabulary for non-damaging avoided outcomes.

Implementation added:
- Area-triggered status save success now emits shared miss feedback at the target position.
- Area-triggered condition immunity now emits shared miss feedback at the target position.
- Scheduled status save success now emits shared miss feedback at the target position.
- Scheduled condition immunity now emits shared miss feedback at the target position.
- Repeat-save and repeat-check success now emit shared miss feedback at the target position.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- The visual label is still generic MISS; dedicated SAVE, RESIST, and IMMUNE map labels require expanding the shared feedback type and both renderers.
- Forced-movement paths and teleport destination previews still need visual treatment.

## 2026-06-01 - Combat-map explicit save/resist/immune label update

### SSO-COMBAT-MAP-VISUALIZATION-001 - shared feedback vocabulary expanded, rendered verification still open

Status: partially implemented.

Evidence added this pass:
- src/types/combat.ts previously limited DamageNumber.type to damage | heal | miss, forcing non-damaging spell outcomes to masquerade as generic misses.
- src/hooks/combat/useCombatVisuals.ts owned the shared feedback stream used by both map renderers through 	urnManager.damageNumbers.
- src/components/BattleMap/DamageNumberOverlay.tsx rendered 2D labels from the shared feedback stream.
- src/components/BattleMap/vfx/VFXSystem.tsx rendered 3D labels from the same shared feedback stream after the prior parity pass.

Implementation added:
- Expanded DamageNumber.type with save, 
esist, and immune outcomes.
- Updated useCombatVisuals and combat hook prop types to accept the expanded shared feedback type.
- Updated 2D feedback rendering to show SAVE, RESIST, and IMMUNE labels with distinct colors.
- Updated 3D feedback rendering to show the same SAVE, RESIST, and IMMUNE labels with matching color intent.
- Switched repeat-save and scheduled-save success from generic miss feedback to save feedback.
- Switched area-triggered status resistance from generic miss feedback to 
esist feedback.
- Switched condition immunity from generic miss feedback to immune feedback.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- The labels are readable shared feedback, but they are not yet spell-specific animations, icons, or timing rings.
- Forced-movement paths and teleport destination previews still need visual treatment.

## 2026-06-01 - Combat-map scheduled movement visual update

### SSO-COMBAT-MAP-VISUALIZATION-001 - scheduled forced movement and teleport outcomes now create shared 2D/3D cues

Status: partially implemented.

Evidence added this pass:
- src/commands/effects/MovementCommand.ts already resolves push, pull, teleport, and forced movement destinations, including blocked teleport fallback and routed forced movement, but it does not expose a reusable rendered path payload.
- src/hooks/combat/engine/useCombatEngine.ts executes scheduled MOVEMENT payloads through MovementCommand and can compare the target's position before and after command execution.
- src/components/BattleMap/BattleMapOverlay.tsx already owns 2D overlay affordances for persistent spell state but did not show resolved spell movement paths or teleport destinations.
- src/components/BattleMap/vfx/VFXSystem.tsx already owns 3D spell VFX affordances but did not show resolved spell movement paths or teleport destinations.

Implementation added:
- Added shared SpellMovementVisual state for resolved structured spell movement outcomes.
- Scheduled movement payloads now record a short-lived visual after MovementCommand resolves the actual destination.
- 2D map: draws a start-to-end line and destination marker for scheduled forced movement and teleport outcomes.
- 3D map: draws an equivalent world-space line and destination label for scheduled forced movement and teleport outcomes.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- This visual uses start-to-end movement cues; it does not yet expose the exact routed path selected inside MovementCommand.
- Immediate command-factory movement spells still need investigation for the same visual cue path.
- Pre-resolution teleport destination previews remain open.

## 2026-06-01 - Combat-map immediate movement visual update

### SSO-COMBAT-MAP-VISUALIZATION-001 - immediate movement spells now reuse shared 2D/3D movement cues

Status: partially implemented.

Evidence added this pass:
- src/hooks/useAbilitySystem.ts executes immediate spells through SpellCommandFactory and CommandExecutor, then receives the final command-resolved character positions.
- The prior scheduled movement slice already added shared SpellMovementVisual state and 2D/3D renderers for resolved movement cues.
- src/components/Combat/CombatView.tsx and src/components/BattleMap/BattleMapDemo.tsx already pass turn-manager callbacks into useAbilitySystem for spell zones, scheduled effects, and movement debuffs.

Implementation added:
- Exposed ddSpellMovementVisual from the combat engine through useTurnManager.
- Added an onAddSpellMovementVisual bridge to useAbilitySystem.
- Immediate spells with MOVEMENT effects now compare each target's original position against the command result and emit a shared movement visual when the target actually moved.
- CombatView and BattleMapDemo now pass the shared visual callback into useAbilitySystem.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Immediate movement cues still use resolved start/end positions, not the exact internal routed path selected by MovementCommand.
- Pre-resolution teleport destination previews remain open.

## 2026-06-01 - Combat-map routed movement visual update

### SSO-COMBAT-MAP-VISUALIZATION-001 - resolved forced movement cues can now show routed paths

Status: partially implemented.

Evidence added this pass:
- src/utils/spatial/pathfinding.ts exposes indPath(...) over BattleMapTile coordinates and BattleMapData.
- The previous movement visual implementation stored path: [from, to], so 2D and 3D cues drew a straight line even when the runtime destination represented routed forced movement around blocked terrain.
- src/hooks/combat/engine/useCombatEngine.ts and src/hooks/useAbilitySystem.ts both know the resolved start/end positions and have access to map data at the point they register SpellMovementVisual.

Implementation added:
- Scheduled movement visuals now reconstruct a forced-movement route with indPath(...) when map data and endpoint tiles are available.
- Immediate movement spell visuals now reconstruct a forced-movement route with indPath(...) when map data and endpoint tiles are available.
- Teleport visuals intentionally remain start/end jump cues.
- 2D map: movement cues now draw one segment per route step instead of one line for the whole path.
- 3D map: movement cues now pass the full routed point list to the existing 3D Line renderer.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- The route is reconstructed after resolution rather than returned directly by MovementCommand; if MovementCommand later exposes exact selected path data, this should switch to that authoritative payload.
- Pre-resolution teleport destination previews remain open.

## 2026-06-01 - Combat-map spell-aware zone styling update

### SSO-COMBAT-MAP-VISUALIZATION-001 - active zones now infer visual family from source effects

Status: partially implemented.

Evidence added this pass:
- ActiveSpellZone stores the original SpellEffect[] payload for the persistent area.
- src/components/BattleMap/BattleMapOverlay.tsx previously rendered every active structured spell zone with the same cyan overlay, regardless of fire, poison, terrain, fog, or restraining status semantics.
- src/components/BattleMap/vfx/VFXSystem.tsx already had a ZONE_COLORS table for 3D environmental effects, but active spell zones were always adapted as generic og.

Implementation added:
- 2D map: active zones now derive a visual family from source effects and style fire, ice, poison, difficult terrain, restraining/web, and fog/obscuring zones differently.
- 3D map: active spell zones now adapt into existing SpellZoneEffect types based on source damage, terrain, or status-condition effects instead of always using og.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- No tests or typecheck were run in this pass.
- Visual families are still broad categories, not spell-specific icons, animation variants, or school-specific effects.
- Some damage/status types still fall back to fog until a richer spell visual vocabulary exists.

## 2026-06-01 - Teleport destination selection gap

### SSO-TELEPORT-DESTINATION-SELECTION-001 - pre-resolution teleport previews need destination-selection state

Status: newly identified open gap.

Finding:
- Existing 2D and 3D map renderers can now show resolved teleport cues after command execution.
- `useTargeting` and `useTargetSelection` only model normal cast targets and AoE hover previews.
- `Misty Step` targets self, but its destination is encoded in the `MOVEMENT` effect as `movementType: teleport` with `forcedMovement.direction: caster_choice` and placement eligibility requiring an unoccupied caster-choice destination.
- `Scatter` targets creatures, but each teleport destination is a separate caster choice within the movement effect, not the same thing as the selected creature targets.
- `MovementCommand` can consume an explicit teleport destination from `effect.destination` or `effect.targetPosition`, but the ability targeting UI does not currently collect or attach that destination before execution.

Why this matters:
- A pre-resolution teleport destination preview would be misleading if it only reuses `validTargetSet`, because those tiles answer where the spell can be cast or which creature can be targeted rather than where this target can legally teleport.
- Self-teleports, multi-target teleports, and target-swapping teleports need destination-choice state that is separate from cast-target selection.

Next action:
- Add a destination-selection contract for teleport movement effects: selected moved target, candidate destination tiles, destination validity reasons, and final chosen destination per moved target.
- Reuse existing 2D/3D overlay surfaces only after the destination candidates come from the same rules that execution will consume.

Next proof/check:
- Focused UI/hook coverage proving a self-teleport can enter destination-pick mode, preview legal destination tiles, attach the chosen destination to the movement effect, and produce the same resolved 2D/3D teleport cue after execution.

## 2026-06-01 - Teleport destination selection implementation update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - self-teleport preview implemented, broader assignment still open

Status: partially implemented.

Evidence added this pass:
- `useTargeting` now tracks a separate teleport destination preview state instead of reusing normal cast-target highlights.
- Destination candidates are derived from the moved creature's origin, movement-effect range, map blocking, occupancy, and caster line-of-sight where required.
- `useAbilitySystem` no longer auto-casts self-target teleport spells immediately; self-teleports with rich spell data now enter destination-pick mode first.
- When a self-teleport destination is clicked, `useAbilitySystem` keeps the caster as the affected target and clones the spell payload with the chosen destination for `MovementCommand`.
- 2D map tiles now show teleport destinations with a blue preview and allow those tiles to be clicked even though the spell target is the caster.
- 3D VFX now renders blue destination rings from the same destination-preview state.

Still open:
- Multi-target teleports such as `Scatter` still need per-target destination assignment.
- Lightweight non-rich `AbilityEffect` teleports are preview-detected but still depend on richer spell data for command execution.
- Focused hook coverage has now been added for self-teleport destination payload wiring, but it has not been run.
- No typecheck or rendered 2D/3D verification was run.

Next action:
- Run the focused `useAbilitySystem` coverage for `Misty Step`-style self teleport destination selection.
- Then design the per-target destination assignment flow for `Scatter` and similar spells without collapsing it into single-click targeting.

## 2026-06-01 - Teleport destination selection coverage update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - self-teleport hook test added, execution still open

Status: implementation plus focused test coverage added; test execution still open.

Evidence added this pass:
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes a self-teleport destination-selection test.
- The test protects that selecting `Misty Step`-style self teleport does not immediately spend/execute the action.
- The test protects that clicking a destination keeps the caster as the moved target and attaches the clicked tile to the rich `MOVEMENT` effect as `destination` before command creation.

Still open:
- The focused test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target destination assignment remains open.

Next action:
- Run the focused hook test when verification is allowed, then implement or document the next `Scatter`-style per-target assignment slice.

## 2026-06-01 - Teleport destination candidate coverage update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - destination candidate rules covered, execution still open

Status: focused candidate coverage added; verification still open.

Evidence added this pass:
- `src/hooks/combat/__tests__/useTargeting.test.ts` now covers the teleport destination-preview candidate rules directly.
- The test protects that legal self-teleport destinations are visible, unoccupied, unblocked, and within the movement-effect range.
- The test explicitly rejects blocked terrain, occupied tiles, line-of-sight-blocked destinations, and out-of-range destinations.
- The test also protects that non-teleport abilities do not create destination candidates.

Still open:
- The new test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target destination assignment remains open.

Next action:
- Run the focused targeting and ability-system hook tests when verification is allowed.
- Continue into `Scatter`-style per-target destination assignment after the self-teleport branch is verified or after the next implementation slice is explicitly accepted as unverified.

## 2026-06-01 - Teleport invalid destination feedback update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - self-teleport invalid destination feedback added

Status: partially implemented; verification still open.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` now treats invalid self-teleport destination clicks as destination errors, not generic self-target validation failures.
- Invalid destination attempts now produce a message saying the spell needs a visible, unoccupied destination within range.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage proving an invalid self-teleport destination does not execute and logs the destination-specific failure.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`.

Still open:
- The new test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- Multi-target destination assignment remains open.

Next action:
- Run the focused targeting and ability-system hook tests when verification is allowed.
- Continue into per-target teleport assignment once the self-teleport path is stable enough or explicitly accepted as pending verification.

## 2026-06-01 - Multi-target teleport guard update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - Scatter-style teleports now fail visibly instead of silently using fallback destinations

Status: guard implemented; per-target assignment still open.

Evidence added this pass:
- `src/types/spells.ts` evidence shows `MovementEffect` only supports a single `destination` or `targetPosition`; it does not model a per-target destination assignment map.
- `src/hooks/useAbilitySystem.ts` now detects non-self `caster_choice` teleport movement effects without assigned destinations before action spending or command creation.
- When such a spell is selected, the hook emits a visible notification/log entry saying destination choices are required before the teleport can resolve.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage for a `Scatter`-style spell proving the guard blocks action execution and command creation.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`.

Still open:
- The guard test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- A real per-target destination-assignment UI/state contract still needs to be designed and implemented for `Scatter`.

Next action:
- Design the per-target destination assignment contract: selected moved target list, destination candidate set per target, chosen destination per target, and command payload shape.
- Run focused hook tests when verification is allowed.

## 2026-06-01 - Per-target teleport command payload update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - command-level per-target destination payload added

Status: partially implemented; UI assignment still open.

Evidence added this pass:
- `src/types/spells.ts` now includes `MovementEffect.destinationsByTargetId` as a runtime assignment map for spells that move multiple targets to separately chosen destinations.
- `src/commands/effects/MovementCommand.ts` now prefers a destination assigned to the current target before falling back to the legacy single `destination` or `targetPosition` fields.
- `src/commands/effects/__tests__/MovementCommand.test.ts` now includes focused coverage proving two targets can be teleported to two separately assigned destinations from one movement effect.
- Required dependency-map sync was run for `src/types/spells.ts` and `src/commands/effects/MovementCommand.ts`.

Still open:
- The new command test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- The combat-map UI still does not collect one destination per moved target.
- `useAbilitySystem` still guards `Scatter`-style spells before execution until assignment state exists.

Next action:
- Add assignment-state support above the command layer: selected moved target list, active destination-pick target, candidate tiles per target, and `destinationsByTargetId` injection before command creation.

## 2026-06-01 - Multi-target teleport assignment flow update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - map-click assignment state now feeds per-target command payloads

Status: partially implemented; verification still open.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` now tracks pending teleport destination assignment after target selection for non-self caster-choice teleport spells.
- The hook previews destination candidates for the active moved target, records the clicked destination, advances to the next moved target, and waits until every target has a destination before spending the action.
- Once all destinations are collected, the hook injects `destinationsByTargetId` into the rich spell movement payload before command creation.
- Direct `executeAbility` calls remain guarded if destination assignments are missing.
- `src/hooks/__tests__/useAbilitySystem.test.ts` now includes focused coverage for a `Scatter`-style target-selection-then-two-destinations flow.
- Required dependency-map sync was run for `src/hooks/useAbilitySystem.ts`.

Still open:
- The new hook test was not run.
- Typecheck was not run.
- Rendered 2D/3D verification was not run.
- The UI affordance is still map-click driven with notifications, not a richer assignment panel or target/destination list.

Next action:
- Run focused hook and command tests when verification is allowed.
- Render-check 2D and 3D destination previews for active moved-target assignment.
- Add richer UI language if map-click plus notification proves too opaque.

## 2026-06-01 - Teleport assignment active-target label update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - active destination target now labeled in 2D and 3D

Status: partially implemented; rendered verification still open.

Evidence added this pass:
- `src/components/BattleMap/BattleMapOverlay.tsx` now labels the creature currently waiting for a teleport destination with `DEST: <name>`.
- `src/components/BattleMap/BattleMap.tsx` passes the active teleport destination preview state into the 2D overlay.
- `src/components/BattleMap/BattleMap3D.tsx` resolves the active destination target and passes it into the 3D VFX layer.
- `src/components/BattleMap/vfx/VFXSystem.tsx` now renders a matching 3D `DEST: <name>` label above the active moved target while blue destination rings are visible.
- Required dependency-map sync was run for the touched 2D/3D renderer files.

Still open:
- Rendered 2D/3D verification was not run.
- Tests and typecheck were not run.
- The assignment UI is still minimal and map-click driven; a richer assignment panel may still be needed if rendered review shows ambiguity.

Next action:
- Run rendered inspection of 2D and 3D destination assignment.
- Run focused hook/command tests and typecheck when verification is allowed.

## 2026-06-01 - Teleport assignment chosen-destination marker update

### SSO-TELEPORT-DESTINATION-SELECTION-001 - already assigned destinations now remain visible in 2D and 3D

Status: partially implemented; rendered verification still open.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` now exposes the pending teleport assignment state so map renderers can see already chosen destinations while the remaining targets are still being assigned.
- `src/components/BattleMap/BattleMap.tsx` derives a renderer-safe list of assigned teleport destinations from `pendingTeleportAssignment.destinationsByTargetId`.
- `src/components/BattleMap/BattleMapOverlay.tsx` renders 2D `SET: <target>` markers on destination tiles that have already been chosen.
- `src/components/BattleMap/BattleMap3D.tsx` derives the same assignment list for the 3D map.
- `src/components/BattleMap/vfx/VFXSystem.tsx` renders 3D `SET: <target>` labels at chosen destination tiles.

Still open:
- No rendered 2D or 3D visual verification was performed in this pass.
- Tests and typecheck were not run in this pass.
- The assignment UI is still map-click driven; a dedicated target/destination panel may still be needed if rendered review shows ambiguity.

Next action:
- Render-check the 2D and 3D assignment flow for active `DEST:` labels, candidate destination rings, and persistent `SET:` markers.
- Run focused hook/command tests and typecheck when verification is allowed.

## 2026-06-01 - Area data migration status audit

### SSO-AREA-DATA-MIGRATION-STATUS-001 - grease/entangle/fog-cloud re-audit completed

Status: done.

Evidence added this pass:
- `public/data/spells/level-1/grease.json` has difficult terrain plus immediate, `on_enter_area`, and `on_end_turn_in_area` prone-save condition rows.
- `public/data/spells/level-1/entangle.json` has difficult terrain plus immediate, `on_enter_area`, and `on_end_turn_in_area` restrained-save condition rows.
- `public/data/spells/level-1/fog-cloud.json` has one immediate obscuring terrain row with `dispersedByStrongWind: true`; no save, damage, entry, or end-turn trigger migration is indicated by its current mechanics.
- `docs/tasks/spell-system-overhaul/TODO.md` now records the audit result instead of asking future agents to repeat the same classification.

Remaining nearby work:
- This does not prove area-trigger runtime behavior; those checks remain under the area source-of-truth, containment parity, and movement-within coverage gaps.
- This does not solve terrain tile mutation for spells such as grease/web/spike-growth; that is a separate runtime implementation concern.

## 2026-06-01 - Dynamic terrain mutation status audit

### SSO-DYNAMIC-TERRAIN-MUTATION-STATUS-001 - map-present terrain mutation is implemented; narrower gaps split out

Status: done for the stale TODO claim.

Evidence added this pass:
- `src/commands/effects/TerrainCommand.ts` mutates affected `mapData.tiles` when map data exists.
- Difficult terrain adds a `difficult_terrain` environmental effect and recalculates tile `movementCost`.
- Blocking, wall, obscuring, damaging, excavation, fill, difficult, normal, and cosmetic manipulation paths are present.
- `src/commands/effects/__tests__/TerrainCommand.test.ts` has focused coverage for difficult terrain movement cost, Mold Earth-style excavation, and difficult-terrain normalization.
- `src/hooks/combat/useGridMovement.ts` consumes `tile.movementCost` when calculating reachable tiles and paths.
- `src/components/BattleMap/vfx/VFXSystem.tsx` consumes tile `environmentalEffects` for 3D environmental visuals.

Newly split gaps:
- `SSO-TERRAIN-MAPLESS-PERSISTENCE-001`: mapless terrain effects are still log-only.
- `SSO-TERRAIN-2D-ENVIRONMENTAL-RENDERING-001`: no direct 2D renderer for tile-level `environmentalEffects` was found in this bounded search.

Verification status:
- Static source and test audit only.
- Tests were not run.
- Rendered 2D/3D verification was not run.

## 2026-06-01 - Spell load parity audit

### SSO-LOAD-PARITY-001 - bundle and manifest currently expose the same spell IDs

Status: done for current data parity.

Evidence added this pass:
- `src/context/SpellContext.tsx` loads the eager full spell map from `data/spells_bundle.json`.
- `src/services/SpellService.ts` loads `data/spells_manifest.json` and then fetches individual spell files through each manifest entry path.
- Bounded source search found no direct `spellService` source callers, while many screens consume `SpellContext`.
- `public/data/spells_bundle.json` and `public/data/spells_manifest.json` each expose 459 top-level spell IDs.
- `Compare-Object` over bundle keys versus manifest keys produced no differences.
- Spot checks showed `grease`, `fog-cloud`, and `entangle` are present in both files.
- `scripts/bundle-static-data.ts` builds `spells_bundle.json` from `spells_manifest.json` plus the individual spell JSON files.
- `scripts/regenerate-manifest.ts` regenerates the manifest from `public/data/spells`.

Remaining caution:
- This proves current ID parity, not every field value across all 459 spell payloads.
- The operational pipeline still depends on running manifest regeneration before static bundling after add/remove work; existing project docs already call out the manifest regeneration command.

Verification status:
- Static source/data audit only.
- Tests were not run.
- Typecheck was not run.

## 2026-06-01 - Level-0 status sync audit

### SSO-STATUS-L0-SYNC-001 - cantrip inventory count refreshed

Status: done.

Evidence added this pass:
- `public/data/spells/level-0` currently contains 43 spell JSON files.
- `public/data/spells_manifest.json` currently contains 43 entries with `level: 0`.
- `docs/spells/STATUS_LEVEL_0.md` previously said 44 cantrips; it now records 43.
- The older `TODO.md` text that referenced a `~38` versus `44` table mismatch has been retired.

Remaining nearby work:
- This does not verify gameplay execution for each cantrip.
- Future per-cantrip behavior proof should use spell-specific audit rows instead of reopening this inventory-count gap.

## 2026-06-01 - JSON schema trigger parity status refresh

### SSO-JSON-SCHEMA-DRIFT-001 - shared EffectTrigger model now exists in schema files

Status: waiting verification.

Evidence added this pass:
- `src/systems/spells/schema/parts/20-effect-payloads.json` now contains a reusable `EffectTrigger` definition.
- `src/systems/spells/schema/spell.schema.json` now contains the same aggregate `EffectTrigger` definition.
- Effect payload definitions in both files reference `#/definitions/EffectTrigger`.
- `on_move_in_area` appears in the schema trigger enum and in `src/systems/spells/validation/spellValidator.ts`.
- The checked schema trigger model includes trigger type, frequency, consumption, attack filter, movement type, and sustain cost, matching the current Zod trigger object fields inspected in this pass.
- `scripts/syncSpellJsonSchemaRegistry.ts` includes `EffectTrigger`, so the schema part/aggregate ownership path is visible.

Remaining work:
- Run the schema registry/check flow and targeted spell-data validation when verification is allowed.
- Do not reopen the broad “schema lacks trigger model” claim unless a future check shows a concrete drift.

## 2026-06-01 - Valid target semantics status refresh

### SSO-VALIDTARGETS-SEMANTICS-001 - resolver semantics implemented, waiting verification

Status: waiting verification.

Evidence added this pass:
- `src/systems/spells/targeting/TargetResolver.ts` treats `creatures`, `objects`, and `point` as target-kind categories rather than traits one runtime target must all satisfy.
- Creature targets are accepted for mixed creature/object spells when they satisfy creature relation constraints.
- `objects` no longer rejects creature targets in the creature resolver path; object candidates are handled by `isValidObjectTarget`.
- `allies`, `enemies`, and `self` remain creature constraints.
- `src/systems/spells/targeting/__tests__/TargetResolver.test.ts` includes coverage for mixed `['creatures', 'objects', 'enemies']` behavior.
- `TargetResolver.getValidTargetCandidates` now exists and aggregates valid creature candidates with supplied valid object candidates.

Remaining gaps:
- `SSO-MIXED-TARGET-AGGREGATION-001` is waiting verification and later caller adoption.
- `SSO-OBJECT-TARGET-REGISTRY-001` remains open because no real source of positioned targetable object candidates exists.

Verification status:
- Static source/test audit only.
- Tests were not run.

## 2026-06-01 - Modal choice spell status refresh

### SSO-CHOICE-SPELLS-001 - modeChoice exists; end-to-end choice handling still open

Status: partially implemented; gap remains open.

Evidence added this pass:
- `src/types/spells.ts` defines optional `modeChoice` on `Spell`.
- `src/systems/spells/validation/modeChoiceSchemas.ts` validates `modeChoice` menus.
- `src/systems/spells/schema/spell.schema.json` and schema parts include `modeChoice`.
- `src/commands/factory/SpellCommandFactory.ts` filters active effects by selected `modeChoice` label when `playerInput` is supplied.
- `src/commands/factory/__tests__/SpellCommandFactoryMode.test.ts` covers mode-choice command filtering and real-data mode-choice effect-index sanity.
- `public/data/spells/level-2/blindness-deafness.json` has a `modeChoice` menu for Blindness versus Deafness.
- `public/data/spells/level-2/enhance-ability.json` has `targeting.perTargetChoice`.

Remaining gaps:
- `SSO-MODECHOICE-UI-INPUT-001`: no normal combat UI/hook prompt path was found for collecting `modeChoice` before command creation.
- `SSO-PER-TARGET-CHOICE-EXECUTION-001`: `perTargetChoice` has data/schema support but no runtime execution consumer found in this bounded search.

Verification status:
- Static source/data/test audit only.
- Tests were not run.

## 2026-06-01 - Execution split status refresh

### SSO-EXECUTION-SPLIT-001 - command execution exists; orchestration parity still open

Status: open, narrowed.

Evidence added this pass:
- `src/hooks/useAbilitySystem.ts` builds a temporary `CombatState`, calls `SpellCommandFactory.createCommands(...)`, and executes the returned commands through `CommandExecutor.execute(...)`.
- `src/commands/factory/SpellCommandFactory.ts` owns rich structured spell-effect command creation, including arbitration, mode-choice filtering, delayed trigger suppression, scaling, concentration commands, and concrete effect command routing.
- `src/utils/character/spellAbilityFactory.ts` still converts spell data into lightweight `Ability` preview/selection data using simplified targeting, average damage, and fallback text inference.
- Bounded search still found no dedicated `src/systems/spells/integration/SpellExecutor.ts`.
- The old TODO wording that `useAbilitySystem` still relies on legacy factory inference was too broad for current combat execution.

Newly split gaps:
- `SSO-ABILITY-BRIDGE-PARITY-001`: prove or define parity between lightweight ability previews and rich command execution.
- `SSO-SPELL-COMMAND-GAMESTATE-CONTEXT-001`: replace or justify the placeholder `{} as GameState` passed into command creation.

Remaining decision:
- A future `SpellExecutor` may still be useful, but it should be introduced only after a concrete coordinator contract is chosen rather than as a broad replacement for existing working orchestration.
## 2026-06-01 - Creature-type target filter status refresh

### creature-type-target-filter - stale broad TODO split into narrower gaps

Status: open, narrowed.

Evidence added this pass:
- src/systems/spells/validation/spellValidator.ts defines EffectCondition.targetFilter, so the schema side of the old TODO is not missing.
- src/types/spells.ts defines TargetConditionFilter with creature type, excluded creature type, size, alignment, condition, and special identity fields.
- src/systems/spells/targeting/TargetResolver.ts calls TargetValidationUtils.matchesFilter(...) for 	argeting.filter.
- src/commands/factory/SpellCommandFactory.ts filters context.targets through effect.condition.targetFilter before command creation.
- src/systems/spells/targeting/TargetValidationUtils.ts is the shared resolver/command helper for creature type, size, alignment, condition, and corpse/remains checks.
- public/data/spells/level-1/charm-person.json and public/data/spells/level-4/dominate-beast.json carry creature filters at both targeting and effect level.

Remaining gaps:
- SSO-CREATURE-TAXONOMY-NORMALIZATION-001: creature type data exists at both CombatCharacter.creatureTypes and legacy stats.creatureTypes, with raw string matching.
- SSO-AI-CREATURE-FILTER-PATH-PARITY-001: AI filtering checks 	arget.stats.creatureTypes, while resolver/effect filtering checks top-level 	arget.creatureTypes.
- SSO-SPELL-FILTER-DATA-COMPLETENESS-001: real spell data is inconsistent; hold-person has a Humanoid targeting filter but an empty main effect 	argetFilter.creatureTypes.
- SSO-TARGET-FILTER-FEEDBACK-001: resolver rejection does not yet expose a structured reason or rendered 2D/3D feedback such as  Target must be Humanoid.

Verification status:
- Static source/data/doc audit only.
- No code changes, tests, typecheck, broad validation, or rendered verification were run in this slice.


### 2026-06-01 - Parallel status-check refresh: geometry, AC, status stacking, summoning

- Delegation: read-only sub-agents checked geometry, AC mechanics, and status stacking; the main thread checked summoning locally.
- Geometry finding: cylinder height is still open; cube centering is stable as current origin/top-left behavior but lacks an explicit tabletop-policy decision.
- AC finding: schema/data/calculation support exists; remaining gaps are active-effect persistence for base/minimum AC mechanics and Shield reaction wire-up.
- Status finding: command-path replacement/refresh exists; scheduled, zone/action, tile/environment, and condition expiry paths remain inconsistent.
- Summoning finding: schema, command routing, command implementation, hook scaffolding, data, templates, cleanup, and tests exist; remaining gaps are runtime ownership/parity, form/count choice, command economy/control behavior, and 2D/3D map readability.
- New rows added: `SSO-GEOMETRY-CYLINDER-HEIGHT-001`, `SSO-GEOMETRY-CUBE-CENTERING-001`, `SSO-AC-DEFENSIVE-PERSISTENCE-001`, `SSO-AC-REACTION-WIREUP-001`, `SSO-STATUS-STACKING-CONSISTENCY-001`, `SSO-STATUS-CONDITION-EXPIRY-MIRROR-001`, `SSO-SUMMONING-RUNTIME-PARITY-001`, `SSO-SUMMONING-FORM-SELECTION-001`, `SSO-SUMMONING-COMMAND-ECONOMY-001`, and `SSO-SUMMONING-MAP-VISUALS-001`.

## Repeat-save verification refresh - 2026-06-11

Status update:
- SSO-REPEAT-SAVE-001 and split rows SSO-REPEAT-SAVE-ADDITIONAL-TIMINGS-001, SSO-REPEAT-SAVE-FORCED-MOVEMENT-001, SSO-REPEAT-SAVE-IMMEDIATE-FORCED-MOVEMENT-001, SSO-REPEAT-SAVE-PROGRESSION-001, SSO-REPEAT-SAVE-PROGRESSION-FAILURE-OUTCOME-001, and SSO-REPEAT-SAVE-INVENTORY-001 are verified for current known metadata families.
- Older 2026-05-31 notes that say repeat-save tests were not executed are superseded by this verification refresh; caveat rows for persistence/manual state and rendered visibility remain separate follow-ups.

Verification evidence:
- npm run test -- src/commands/effects/__tests__/StatusConditionCommand.test.ts passed 4 tests.
- npm run test -- src/hooks/combat/engine/__tests__/useCombatEngine.repeatSaves.test.ts passed 9 tests.
- npm run test -- src/commands/factory/__tests__/SpellCommandFactoryStatus.test.ts passed 3 tests.
- npm run test -- src/hooks/combat/__tests__/useTurnManager.repeatSaves.test.ts passed 1 test.
- npm run test -- src/hooks/combat/engine/__tests__/useCombatEngine.scheduledEffects.test.ts passed 5 tests.
- Prior 2026-06-11 hook proof, npm run test -- src/hooks/__tests__/useAbilitySystem.test.ts, passed 15 tests with 2 skipped and covers immediate forced-movement repeat-save handoff.

## 2026-06-13 - Simulacrum restricted-filter classification slice

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - original-creature creation effects now carry Beast/Humanoid gates

Status: narrowed; broader restricted-filter classification remains open.

Evidence added this pass:
- public/data/spells/level-7/simulacrum.json now repeats the spell-level Beast/Humanoid gate on the summoning creation effect and the creation-detail utility effect.
- The Simulacrum repair/healing effect was intentionally left unchanged because it acts on the created simulacrum later, not on the original Beast or Humanoid target.
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now has a focused real-data regression for Simulacrum creation filters.

Verification:
- 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 13 tests.
- 
pm run validate:spells -- --spell public/data/spells/level-7/simulacrum.json reported 459 valid / 0 invalid.
- 
pm run test:types passed.

Remaining boundary:
- Do not auto-copy the remaining restricted-filter audit hits. Plant/terrain, chosen-kind, form-choice, repair-target, and ongoing-area rows still need per-spell classification before any effect-level filter changes.

## 2026-06-13 - Restricted-filter residual classification

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - remaining mismatch list classified after direct-target fixes

Status: open, narrowed.

Current residual audit count:
- 15 mismatches across 7 spells after the Hold Person, direct status-condition, direct utility, and Simulacrum creation slices.

Classification:
- Plant/terrain target rows: plant-growth effects 0-1 and speak-with-plants effect 0 still show top-level Plant filters with empty effect filters. Do not auto-copy yet; these rows mix plant objects, plant creatures, terrain conversion, and area terrain behavior. Next step is a plant-target semantics split that distinguishes plant creature targets from normal vegetation and terrain surfaces.
- Mixed creature/object transformation row: waken effect 1 still shows top-level Beast/Plant filters with an empty utility effect filter. Do not auto-copy yet; Awaken can affect Beast or Plant creatures and natural plants that are not creatures, so a creature-only 	argetFilter.creatureTypes may hide the non-creature plant path unless object/plant eligibility is modeled alongside it.
- Created-creature repair row: simulacrum effect 1 remains empty by design. The original Beast/Humanoid creation effects were fixed, but the repair/healing row acts on the created simulacrum later, not the original creature. Leave this unpatched unless a dedicated simulacrum-repair target model is added.
- Chosen-kind aura rows: ntipathy-sympathy effects 0-3 still show top-level Huge or smaller target-size text with empty effect filters. Do not auto-copy yet; the top-level size gate describes the targeted creature/object that becomes the source of the aura, while the later status/movement effects apply to creatures of a chosen kind approaching that target.
- Ongoing wave-size rows: 	sunami effects 0-3 still compare against top-level size text Huge or smaller for ongoing wall-movement damage. Do not auto-copy globally; initial wall appearance damage affects each creature in the area, while the Huge-or-smaller gate applies specifically to ongoing wall movement damage. Effect 2 already carries expanded concrete size entries (Huge, Large, Medium, Small, Tiny), so the mismatch is partly an audit-normalization issue rather than a missing effect gate.
- Form-choice rows: shapechange effects 0-1 still show top-level excludeCreatureTypes for Construct/Undead with empty effect filters. Do not auto-copy yet; the exclusion constrains the chosen form, not the caster target. It needs a form-choice eligibility model rather than an effect target filter copied onto the caster.

Next safe implementation targets:
- Add a classification-aware audit helper or test fixture that treats copied direct-target filters differently from plant/object, chosen-kind, form-choice, repair-target, and ongoing-area filters.
- Split dedicated gaps if implementing any of the semantic models above: plant/object target eligibility, chosen-kind aura targeting, form-choice eligibility, and ongoing-area size filter normalization.

Verification:
- Bounded Node audit over public/data/spells reported 15 current mismatches across plant-growth, speak-with-plants, waken, simulacrum, ntipathy-sympathy, 	sunami, and shapechange.
- No spell data was changed in this classification pass.

## 2026-06-13 - Restricted-filter classification regression gate

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - residual mismatch classification now executable

Status: open, guarded.

Evidence added this pass:
- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts now includes a corpus regression that scans spell-level creatureTypes, excludeCreatureTypes, sizes, and lignments against effect-level condition.targetFilter values.
- The test failed red with 15 unclassified residual mismatches, proving the audit still saw the known residual list.
- The green version keeps the 15 residual rows in an explicit classified allowlist with comments for plant/terrain, mixed creature/object transformation, simulacrum repair-target, chosen-kind aura, ongoing wave-size, and form-choice semantics.

Why this matters:
- Future direct-target filter omissions now fail locally instead of disappearing into the known-residual set.
- The remaining rows are not treated as done; they are classified exceptions pending dedicated semantic models.

Verification:
- Red run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts failed with 15 restricted-filter mismatches before the allowlist was added.
- Green run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 14 tests.
- 
pm run test:types passed.

## 2026-06-13 - Restricted-filter validator rule promotion

### SSO-SPELL-FILTER-DATA-COMPLETENESS-001 - direct-target filter drift now fails production validation

Status: open, guarded by validator and corpus test.

Evidence added this pass:
- src/systems/spells/validation/SpellIntegrityValidator.ts now checks spell-level creatureTypes, excludeCreatureTypes, sizes, and lignments against each effect's condition.targetFilter.
- The rule reports Effect Target Filter Gap for unclassified direct-target mismatches, so spell JSON validation can catch future omissions instead of relying only on the Vitest corpus guard.
- The same 15 residual semantic exceptions remain classified in the validator: plant/terrain rows, Awaken's mixed creature/object transformation, Simulacrum repair targeting, Antipathy/Sympathy chosen-kind aura rows, Tsunami ongoing wave-size rows, and Shapechange form-choice rows.
- The rule treats missing 	argeting.filter as unrestricted, preserving minimal validator unit fixtures and non-filtered spells.

Verification:
- Red run: focused validator test failed because the production validator did not yet report a direct missing Humanoid effect filter.
- Green run: 
pm run test -- src/systems/spells/validation/__tests__/SpellIntegrityValidator.test.ts passed 15 tests.
- 
pm run validate:spells -- --spell public/data/spells/level-2/animal-messenger.json reported 459 valid / 0 invalid after the production rule was added.
- 
pm run test:types passed.






