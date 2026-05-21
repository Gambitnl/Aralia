# Spell Phase 1 Baseline Report

Generated: 2026-05-21

This report is the Package 1 intake baseline for the early-game spell execution
project. Scope is cantrips and spell levels 1-3. It is a planning/evidence
artifact, not a completion claim.

## Verification Commands

| Command | Result |
|---|---|
| `npm run validate:spells` | Passed. `459 / 459` spell JSON files valid. Scoped levels 0-3 contain `243` spells. |
| `npm run validate:spell-markdown` | Completed with `801` mismatches across `19` buckets. This is still a noisy parity lane, mainly effects structure, Sub-Classes, Higher Levels, Effect Type, and Valid Targets. |
| `npm run audit:spell-template` | Completed with `28` warnings and `0` errors. |
| `npx tsx scripts/auditSpellStructuredAgainstJson.ts` | Passed with `0` mismatches across `459` compared spell files. |
| `npx tsx scripts/auditSpellStructuredAgainstCanonical.ts` | Completed with `3` mismatches across `2` buckets and `476` policy boundaries. |
| `npm run generate:spell-gates` | Regenerated `public/data/spell_gate_report.json`; schema-invalid spells `0`, structured-vs-canonical mismatch spells `3`, structured-vs-JSON mismatch spells `0`. |

Structured-vs-canonical residual mismatches:

- Range/Area: `leomunds-tiny-hut`, `sleet-storm`
- Duration: `power-word-pain`

## Spell Band Inventory

| Level | Count |
|---:|---:|
| 0 | 43 |
| 1 | 68 |
| 2 | 65 |
| 3 | 67 |
| Total | 243 |

Class access counts within levels 0-3:

| Class | Spell count |
|---|---:|
| Artificer | 80 |
| Bard | 86 |
| Cleric | 66 |
| Druid | 83 |
| Paladin | 37 |
| Ranger | 50 |
| Sorcerer | 114 |
| Warlock | 63 |
| Wizard | 150 |

Arbitration routing in the current spell JSON:

| Arbitration type | Count |
|---|---:|
| `mechanical` | 240 |
| `ai_dm` | 2 |
| `ai_assisted` | 1 |

Top effect types in levels 0-3:

| Effect type | Count |
|---|---:|
| `UTILITY` | 138 |
| `DAMAGE` | 99 |
| `STATUS_CONDITION` | 51 |
| `DEFENSIVE` | 23 |
| `TERRAIN` | 11 |
| `HEALING` | 9 |
| `MOVEMENT` | 8 |
| `SUMMONING` | 5 |
| `ATTACK_ROLL_MODIFIER` | 3 |

## Mechanics Discovery Scope

The mechanics discovery source is
`.agent/roadmap-local/spell-validation/spell-mechanics-discovery.json`, generated
on 2026-05-14. It records `1,235` actionable-open findings overall. Filtering
to levels 0-3 gives `652` actionable-open findings:

| Level | Actionable-open findings |
|---:|---:|
| 0 | 48 |
| 1 | 112 |
| 2 | 180 |
| 3 | 312 |

Top scoped buckets by actionable-open findings:

| Bucket | Findings |
|---|---:|
| `choice_or_mode` | 70 |
| `attack_or_save_modifier` | 65 |
| `environmental_change` | 53 |
| `vision_light_sound` | 48 |
| `status_or_state_change` | 43 |
| `terrain_or_surface` | 41 |
| `social_or_knowledge_effect` | 36 |
| `target_filter_or_eligibility` | 36 |
| `message_or_communication` | 25 |
| `object_stats_or_damageability` | 23 |

Highest-risk scoped spells by actionable-open findings:

| Spell | Level | Findings |
|---|---:|---:|
| Summon Lesser Demons | 3 | 14 |
| Speak with Dead | 3 | 13 |
| Glyph of Warding | 3 | 11 |
| Meld into Stone | 3 | 11 |
| Sleet Storm | 3 | 11 |
| Find Familiar | 1 | 10 |
| Unseen Servant | 1 | 10 |
| Find Steed | 2 | 10 |
| Phantom Steed | 3 | 10 |
| Summon Beast | 2 | 9 |

## Character Creator Baseline

Existing spell-selection components cover cantrips and level-1 spell choice for
Artificer, Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, and Wizard:

- class-specific surfaces live under `src/components/CharacterCreator/Class/`
- state stores `selectedCantrips` and `selectedSpellsL1`
- assembly happens in both `src/hooks/useCharacterAssembly.ts` and
  `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`

Known risk from source inspection:

- character creation currently appears level-1 oriented; it does not yet expose
  a general level-2/level-3 spell choice flow for higher-level test fixtures
- the assembly path sets `preparedSpells` from selected level-1 spells but also
  sets `knownSpells` to the full class spell list plus selected spells, so the
  spellbook surface must distinguish known, prepared, and actually castable
  states carefully

## Spellbook Baseline

Current player-facing spellbook surfaces:

- `src/components/CharacterSheet/CharacterSheetModal.tsx`
- `src/components/CharacterSheet/Spellbook/SpellbookTab.tsx`
- `src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx`
- `src/components/CharacterSheet/Spellbook/SpellDetailPane.tsx`
- `src/components/CharacterSheet/Spellbook/SpellSlotDisplay.tsx`

Known risk from source inspection:

- the tab/overlay merge cantrips, prepared spells, and known spells for display
- the UI has prepared/known markers, but this baseline has not visually verified
  the character sheet modal with the current premades
- no screenshot proof exists yet for spellbook readability inside the inventory
  and equipment mannequin character sheet context

## Premade Party Baseline

There are 13 level-1 premade characters under `public/premade-characters/`.
Every premade currently has `equippedItems: {}`.

Caster spellbooks are present and mostly count-limited, but the default roster
is not combat-ready because gear is empty:

| Class | Premade | Spellbook | Cantrips | Known | Prepared | Equipped slots |
|---|---|---:|---:|---:|---:|---:|
| Artificer | Pip Coppercoil | yes | 2 | 4 | 4 | 0 |
| Bard | Lyris Songweaver | yes | 2 | 4 | 4 | 0 |
| Cleric | Sera Dawnmantle | yes | 3 | 4 | 4 | 0 |
| Druid | Merrit Greenbough | yes | 3 | 4 | 4 | 0 |
| Paladin | Tavian Oathsteel | yes | 0 | 2 | 2 | 0 |
| Ranger | Oren Pathmark | yes | 0 | 2 | 2 | 0 |
| Sorcerer | Ivel Sparkvein | yes | 4 | 2 | 2 | 0 |
| Warlock | Cassian Blackreed | yes | 2 | 2 | 2 | 0 |
| Wizard | Maelis Quill | yes | 3 | 6 | 6 | 0 |

Non-casters exist for Barbarian, Fighter, Monk, and Rogue, also with no equipped
items.

This makes Package 2 a good first Jules implementation candidate because it has
clear ownership, clear player impact, and no need for broad spell schema changes.

## Combat Simulator Baseline

Current execution anchors:

- `src/hooks/useAbilitySystem.ts` routes spell casting through
  `SpellCommandFactory.createCommands`
- `src/commands/factory/SpellCommandFactory.ts` routes `DAMAGE`, `HEALING`,
  `STATUS_CONDITION`, `TERRAIN`, `SUMMONING`, `DEFENSIVE`, `UTILITY`,
  `MOVEMENT`, and `ATTACK_ROLL_MODIFIER`
- `src/components/BattleMap/AISpellInputModal.tsx` exists for player input on
  AI-routed spells
- `src/utils/character/spellAbilityFactory.ts` translates spell JSON to battle
  abilities, but has explicit debt around unhandled `UTILITY` effects

Known risk from source inspection:

- only `3` scoped spells are currently marked non-mechanical even though
  `social_or_knowledge_effect`, `illusion_or_disguise`, and descriptive utility
  buckets are sizeable
- area hazards and recurring terrain behavior remain a runtime risk; the command
  factory comments warn that entry/end-turn area triggers should become
  persistent hazards instead of immediate one-shot commands

## Package 1 Conclusion

The next action should not be a broad mechanics bucket yet. The best first Jules
implementation slice is Package 2: premade party and gear legality.

Reasoning:

- it directly unblocks combat simulator spell testing
- every premade has an obvious gear gap
- caster spellbooks already exist, so Jules can audit legality rather than invent
  all spell selection from scratch
- it avoids schema/runtime churn until the project has one full spell Phase 1
  Symphony/Jules lifecycle proof

Required pre-dispatch boundary:

- capture the Jules Environment `Run and Snapshot` result using the setup script
  recorded in
  `conductor/symphony/docs/decision-reports/SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md`
- then dispatch the prepared Package 2 Jules task in
  `docs/tasks/spells/PACKAGE_2_PREMADE_PARTY_GEAR_JULES_TASK.md`
