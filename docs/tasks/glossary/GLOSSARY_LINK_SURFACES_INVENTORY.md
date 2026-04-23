# Glossary Link Surfaces Inventory

_Generated 2026-04-22T20:01:21.509Z by `scripts/audits/inventory-glossary-link-surfaces.ts`._

This report is generated. To regenerate:

```
npx tsx scripts/audits/inventory-glossary-link-surfaces.ts
```

See [GLOSSARY_LINK_SURFACES_PLAN.md](./GLOSSARY_LINK_SURFACES_PLAN.md) for the surface taxonomy this report classifies against.

## Totals

| Surface | Occurrences in entry data |
| --- | ---: |
| Pill redirect | 0 |
| Clickable pill (glossaryTermId set) | 0 |
| Hover-backed pill (GlossaryTooltip wrapper) | 0 |
| Inline redirect text | 1369 |
| Footer See Also redirect | 1257 |

- Entry files scanned: 366 (only entries with at least one redirect surface are listed below)
- Index files scanned: 12 (covering 374 index rows; 201 rows carry a seeAlso array)
- Component files with redirect signals: 13

## Components

| File | Surfaces | Signals |
| --- | --- | --- |
| `src/components/Glossary/__tests__/Glossary.test.tsx` | Footer See Also redirect | seeAlso+onNavigate |
| `src/components/Glossary/FullEntryDisplay.tsx` | Clickable pill (glossaryTermId set) | glossaryTermId |
| `src/components/Glossary/Glossary.tsx` | Clickable pill (glossaryTermId set), Inline redirect text | glossaryTermId, data-term-id |
| `src/components/Glossary/GlossaryContentRenderer.tsx` | Inline redirect text | GlossaryContentRenderer, data-term-id |
| `src/components/Glossary/GlossaryEntryPanel.tsx` | Clickable pill (glossaryTermId set) | glossaryTermId |
| `src/components/Glossary/GlossaryEntryTemplate.tsx` | Inline redirect text, Footer See Also redirect | GlossaryContentRenderer, seeAlso+onNavigate |
| `src/components/Glossary/GlossaryPill.tsx` | Pill redirect, Clickable pill (glossaryTermId set), Hover-backed pill (GlossaryTooltip wrapper) | GlossaryPill, glossaryTermId, GlossaryTooltip |
| `src/components/Glossary/GlossarySpellsOfTheMarkTable.tsx` | Inline redirect text | GlossaryContentRenderer |
| `src/components/Glossary/GlossarySummaryTable.tsx` | Inline redirect text | GlossaryContentRenderer |
| `src/components/Glossary/GlossaryTooltip.tsx` | Hover-backed pill (GlossaryTooltip wrapper) | GlossaryTooltip |
| `src/components/Glossary/GlossaryTraitTable.tsx` | Inline redirect text | GlossaryContentRenderer |
| `src/components/Glossary/index.ts` | Hover-backed pill (GlossaryTooltip wrapper), Inline redirect text | GlossaryTooltip, GlossaryContentRenderer |
| `src/components/Glossary/SpellCardTemplate.tsx` | Pill redirect, Clickable pill (glossaryTermId set) | GlossaryPill, glossaryTermId |

## Index Files

| Index | Entries | `seeAlso` entries |
| --- | ---: | ---: |
| `public/data/glossary/index/character_classes.json` | 13 | 13 |
| `public/data/glossary/index/character_races.json` | 19 | 0 |
| `public/data/glossary/index/crafting_glossary.json` | 9 | 3 |
| `public/data/glossary/index/crafting.json` | 1 | 0 |
| `public/data/glossary/index/developer.json` | 1 | 1 |
| `public/data/glossary/index/lore.json` | 2 | 0 |
| `public/data/glossary/index/magic_items.json` | 2 | 2 |
| `public/data/glossary/index/main.json` | 0 | 0 |
| `public/data/glossary/index/rules_glossary.json` | 298 | 164 |
| `public/data/glossary/index/spellcasting_mechanics.json` | 18 | 18 |
| `public/data/glossary/index/spells.json` | 10 | 0 |
| `public/data/glossary/index/technology.json` | 1 | 0 |

## Entries (redirect surfaces by entry)

Only entries with at least one redirect surface are listed. Counts are occurrences within the entry JSON.

| Entry id | File | Pill | Clickable Pill | Hover Pill | Inline Text | See Also |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `aarakocra` | `public/data/glossary/entries/races/aarakocra.json` |  |  |  | 4 | 3 |
| `aberrant_mind_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/aberrant_sorcery.json` |  |  |  |  | 3 |
| `ability_check` | `public/data/glossary/entries/rules/ability_check.json` |  |  |  |  | 4 |
| `ability_score_and_modifier` | `public/data/glossary/entries/rules/ability_score_and_modifier.json` |  |  |  |  | 8 |
| `abjurer_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/abjurer.json` |  |  |  |  | 3 |
| `abyssal_tiefling` | `public/data/glossary/entries/races/tiefling_legacies/abyssal.json` |  |  |  | 5 | 5 |
| `action` | `public/data/glossary/entries/rules/action.json` |  |  |  | 7 | 4 |
| `actions` | `public/data/glossary/entries/rules/actions.json` |  |  |  |  | 4 |
| `advantage` | `public/data/glossary/entries/rules/advantage.json` |  |  |  | 2 | 2 |
| `advantage_disadvantage` | `public/data/glossary/entries/rules/advantage_disadvantage.json` |  |  |  |  | 4 |
| `air_genasi` | `public/data/glossary/entries/races/air_genasi.json` |  |  |  | 5 | 3 |
| `alchemist_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/alchemist.json` |  |  |  |  | 3 |
| `alchemy_crafting` | `public/data/glossary/entries/rules/crafting/alchemy_crafting.json` |  |  |  |  | 2 |
| `alignment` | `public/data/glossary/entries/rules/alignment.json` |  |  |  |  | 5 |
| `ally` | `public/data/glossary/entries/rules/ally.json` |  |  |  |  | 3 |
| `arcane_trickster_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/arcane_trickster.json` |  |  |  |  | 3 |
| `archfey_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/archfey.json` |  |  |  |  | 2 |
| `area_of_effect` | `public/data/glossary/entries/rules/area_of_effect.json` |  |  |  | 6 | 6 |
| `armorer_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/armorer.json` |  |  |  |  | 2 |
| `artificer` | `public/data/glossary/entries/classes/artificer.json` |  |  |  |  | 9 |
| `artificer_infusions` | `public/data/glossary/entries/classes/artificer_infusions.json` |  |  |  |  | 2 |
| `artificer_spell_list` | `public/data/glossary/entries/classes/artificer_spell_list.json` |  |  |  |  | 2 |
| `artillerist_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/artillerist.json` |  |  |  |  | 2 |
| `assassin_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/assassin.json` |  |  |  |  | 2 |
| `astral_elf` | `public/data/glossary/entries/races/elf_lineages/astral_elf.json` |  |  |  | 18 | 3 |
| `attack_action` | `public/data/glossary/entries/rules/attack_action.json` |  |  |  | 3 | 3 |
| `attack_roll` | `public/data/glossary/entries/rules/attack_roll.json` |  |  |  |  | 5 |
| `attitude` | `public/data/glossary/entries/rules/attitude.json` |  |  |  | 3 | 5 |
| `attunement` | `public/data/glossary/entries/rules/attunement.json` |  |  |  |  | 3 |
| `autognome` | `public/data/glossary/entries/races/autognome.json` |  |  |  | 16 | 3 |
| `autumn_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/autumn.json` |  |  |  | 16 | 4 |
| `barbarian` | `public/data/glossary/entries/classes/barbarian.json` |  |  |  |  | 4 |
| `bard` | `public/data/glossary/entries/classes/bard.json` |  |  |  |  | 8 |
| `bard_spell_list` | `public/data/glossary/entries/classes/bard_spell_list.json` |  |  |  |  | 2 |
| `battle_master_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/battle_master.json` |  |  |  |  | 2 |
| `battle_smith_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/battle_smith.json` |  |  |  |  | 3 |
| `beast_master_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/beast_master.json` |  |  |  |  | 2 |
| `beastborn_human` | `public/data/glossary/entries/races/dragonmark_variants/beastborn_human.json` |  |  |  | 18 | 3 |
| `beasthide_shifter` | `public/data/glossary/entries/races/shifter_variants/beasthide.json` |  |  |  | 10 | 2 |
| `black_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/black.json` |  |  |  | 5 | 3 |
| `blinded_condition` | `public/data/glossary/entries/rules/conditions/blinded_condition.json` |  |  |  |  | 1 |
| `blindsight` | `public/data/glossary/entries/rules/blindsight.json` |  |  |  | 2 | 3 |
| `bloodied` | `public/data/glossary/entries/rules/bloodied.json` |  |  |  |  | 4 |
| `blue_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/blue.json` |  |  |  | 5 | 3 |
| `bonus_action` | `public/data/glossary/entries/rules/bonus_action.json` |  |  |  | 3 | 2 |
| `bonus_actions` | `public/data/glossary/entries/rules/bonus_actions.json` |  |  |  |  | 2 |
| `brass_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/brass.json` |  |  |  | 5 | 3 |
| `breaking_objects` | `public/data/glossary/entries/rules/breaking_objects.json` |  |  |  |  | 3 |
| `bright_light` | `public/data/glossary/entries/rules/bright_light.json` |  |  |  |  | 3 |
| `bronze_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/bronze.json` |  |  |  | 5 | 3 |
| `bugbear` | `public/data/glossary/entries/races/bugbear.json` |  |  |  | 7 | 5 |
| `burning` | `public/data/glossary/entries/rules/burning.json` |  |  |  | 4 | 4 |
| `cantrip` | `public/data/glossary/entries/rules/cantrip.json` |  |  |  | 1 | 1 |
| `carrying_capacity` | `public/data/glossary/entries/rules/carrying_capacity.json` |  |  |  |  | 4 |
| `casting_time_rules` | `public/data/glossary/entries/rules/spells/casting_time_rules.json` |  |  |  |  | 6 |
| `celestial_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/celestial.json` |  |  |  |  | 3 |
| `centaur` | `public/data/glossary/entries/races/centaur.json` |  |  |  | 7 | 4 |
| `challenge_rating` | `public/data/glossary/entries/rules/challenge_rating.json` |  |  |  |  | 4 |
| `champion_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/champion.json` |  |  |  |  | 2 |
| `changeling` | `public/data/glossary/entries/races/changeling.json` |  |  |  | 8 | 3 |
| `changes_to_your_speeds` | `public/data/glossary/entries/rules/changes_to_your_speeds.json` |  |  |  |  | 2 |
| `charisma` | `public/data/glossary/entries/rules/charisma.json` |  |  |  |  | 3 |
| `charmed_condition` | `public/data/glossary/entries/rules/conditions/charmed_condition.json` |  |  |  |  | 1 |
| `chthonic_tiefling` | `public/data/glossary/entries/races/tiefling_legacies/chthonic.json` |  |  |  | 5 | 5 |
| `circle_of_the_land_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_land.json` |  |  |  |  | 3 |
| `circle_of_the_moon_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_moon.json` |  |  |  |  | 3 |
| `circle_of_the_sea_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_sea.json` |  |  |  |  | 3 |
| `circle_of_the_stars_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_stars.json` |  |  |  |  | 4 |
| `cleric` | `public/data/glossary/entries/classes/cleric.json` |  |  |  |  | 7 |
| `cleric_spell_list` | `public/data/glossary/entries/classes/cleric_spell_list.json` |  |  |  |  | 2 |
| `climbing` | `public/data/glossary/entries/rules/movement/climbing.json` |  |  |  |  | 3 |
| `clockwork_soul_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/clockwork_sorcery.json` |  |  |  |  | 2 |
| `cloud_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/cloud_giant_goliath.json` |  |  |  | 4 | 3 |
| `college_of_dance` | `public/data/glossary/entries/classes/bard_subclasses/college_of_dance.json` |  |  |  |  | 3 |
| `college_of_glamour` | `public/data/glossary/entries/classes/bard_subclasses/college_of_glamour.json` |  |  |  |  | 3 |
| `college_of_lore` | `public/data/glossary/entries/classes/bard_subclasses/college_of_lore.json` |  |  |  |  | 3 |
| `college_of_valor` | `public/data/glossary/entries/classes/bard_subclasses/college_of_valor.json` |  |  |  |  | 3 |
| `concentration` | `public/data/glossary/entries/rules/concentration.json` |  |  |  | 1 | 2 |
| `conditions` | `public/data/glossary/entries/rules/conditions.json` |  |  |  |  | 4 |
| `conditions_dont_stack` | `public/data/glossary/entries/rules/conditions_dont_stack.json` |  |  |  |  | 2 |
| `cone_area` | `public/data/glossary/entries/rules/spells/referenced/cone_area.json` |  |  |  | 7 | 1 |
| `constitution` | `public/data/glossary/entries/rules/constitution.json` |  |  |  | 2 | 5 |
| `copper_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/copper.json` |  |  |  | 5 | 3 |
| `cover` | `public/data/glossary/entries/rules/cover.json` |  |  |  | 3 | 5 |
| `crawling` | `public/data/glossary/entries/rules/movement/crawling.json` |  |  |  |  | 3 |
| `creature` | `public/data/glossary/entries/rules/creature.json` |  |  |  |  | 5 |
| `creature_type` | `public/data/glossary/entries/rules/creature_type.json` |  |  |  |  | 3 |
| `critical_hit` | `public/data/glossary/entries/rules/critical_hit.json` |  |  |  | 2 | 4 |
| `cube_area` | `public/data/glossary/entries/rules/spells/referenced/cube_area.json` |  |  |  | 22 | 1 |
| `curse` | `public/data/glossary/entries/rules/curse.json` |  |  |  |  | 3 |
| `cylinder_area` | `public/data/glossary/entries/rules/spells/referenced/cylinder_area.json` |  |  |  | 8 | 1 |
| `d20_test` | `public/data/glossary/entries/rules/d20_test.json` |  |  |  | 2 | 4 |
| `damage` | `public/data/glossary/entries/rules/damage.json` |  |  |  | 3 | 5 |
| `damage_roll` | `public/data/glossary/entries/rules/damage_roll.json` |  |  |  | 2 | 4 |
| `damage_threshold` | `public/data/glossary/entries/rules/damage_threshold.json` |  |  |  | 1 | 4 |
| `damage_types` | `public/data/glossary/entries/rules/damage_types.json` |  |  |  | 4 | 4 |
| `darkness` | `public/data/glossary/entries/rules/darkness.json` |  |  |  |  | 4 |
| `darkvision` | `public/data/glossary/entries/rules/darkvision.json` |  |  |  | 6 | 4 |
| `dash_action` | `public/data/glossary/entries/rules/dash_action.json` |  |  |  | 5 | 5 |
| `dead` | `public/data/glossary/entries/rules/dead.json` |  |  |  |  | 3 |
| `death_saving_throw` | `public/data/glossary/entries/rules/death_saving_throw.json` |  |  |  |  | 4 |
| `deep_gnome` | `public/data/glossary/entries/races/deep_gnome.json` |  |  |  | 7 | 5 |
| `dehydration` | `public/data/glossary/entries/rules/dehydration.json` |  |  |  | 4 | 4 |
| `dexterity` | `public/data/glossary/entries/rules/dexterity.json` |  |  |  |  | 3 |
| `difficult_terrain` | `public/data/glossary/entries/rules/difficult_terrain.json` |  |  |  | 5 | 5 |
| `dim_light` | `public/data/glossary/entries/rules/dim_light.json` |  |  |  |  | 4 |
| `disadvantage` | `public/data/glossary/entries/rules/disadvantage.json` |  |  |  | 2 | 2 |
| `disengage_action` | `public/data/glossary/entries/rules/disengage_action.json` |  |  |  | 4 | 4 |
| `diviner_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/diviner.json` |  |  |  |  | 3 |
| `dodge_action` | `public/data/glossary/entries/rules/dodge_action.json` |  |  |  | 5 | 5 |
| `draconblood_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/draconblood.json` |  |  |  | 13 | 5 |
| `draconic_sorcery_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/draconic_sorcery.json` |  |  |  |  | 2 |
| `drow` | `public/data/glossary/entries/races/elf_lineages/drow.json` |  |  |  | 10 | 5 |
| `druid` | `public/data/glossary/entries/classes/druid.json` |  |  |  |  | 9 |
| `druid_spell_list` | `public/data/glossary/entries/classes/druid_spell_list.json` |  |  |  |  | 2 |
| `duergar` | `public/data/glossary/entries/races/duergar.json` |  |  |  | 7 | 4 |
| `duration_condition` | `public/data/glossary/entries/rules/duration_condition.json` |  |  |  |  | 1 |
| `earth_genasi` | `public/data/glossary/entries/races/earth_genasi.json` |  |  |  | 6 | 4 |
| `eldritch_knight_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/eldritch_knight.json` |  |  |  |  | 3 |
| `emanation_area` | `public/data/glossary/entries/rules/spells/referenced/emanation_area.json` |  |  |  | 18 | 1 |
| `enemy` | `public/data/glossary/entries/rules/enemy.json` |  |  |  |  | 4 |
| `equipment_proficiencies` | `public/data/glossary/entries/rules/equipment_proficiencies.json` |  |  |  |  | 4 |
| `evoker_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/evoker.json` |  |  |  |  | 4 |
| `exhaustion_condition` | `public/data/glossary/entries/rules/conditions/exhaustion_condition.json` |  |  |  |  | 1 |
| `expertise` | `public/data/glossary/entries/rules/expertise.json` |  |  |  |  | 2 |
| `fairy` | `public/data/glossary/entries/races/fairy.json` |  |  |  | 5 | 3 |
| `fallen_aasimar` | `public/data/glossary/entries/races/aasimar_variants/fallen.json` |  |  |  | 17 | 5 |
| `falling` | `public/data/glossary/entries/rules/falling.json` |  |  |  | 5 | 5 |
| `fey_wanderer_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/fey_wanderer.json` |  |  |  |  | 3 |
| `fiend_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/fiend.json` |  |  |  |  | 2 |
| `fighter` | `public/data/glossary/entries/classes/fighter.json` |  |  |  |  | 9 |
| `firbolg` | `public/data/glossary/entries/races/firbolg.json` |  |  |  | 8 | 4 |
| `fire_genasi` | `public/data/glossary/entries/races/fire_genasi.json` |  |  |  | 5 | 4 |
| `fire_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/fire_giant_goliath.json` |  |  |  | 3 | 2 |
| `fly_speed` | `public/data/glossary/entries/rules/fly_speed.json` |  |  |  |  | 6 |
| `flying` | `public/data/glossary/entries/rules/movement/flying.json` |  |  |  |  | 5 |
| `forest_gnome` | `public/data/glossary/entries/races/gnome_subraces/forest_gnome.json` |  |  |  | 4 | 3 |
| `forgeborn_human` | `public/data/glossary/entries/races/dragonmark_variants/forgeborn_human.json` |  |  |  | 14 | 3 |
| `friendly_attitude` | `public/data/glossary/entries/rules/friendly_attitude.json` |  |  |  |  | 5 |
| `frightened_condition` | `public/data/glossary/entries/rules/conditions/frightened_condition.json` |  |  |  |  | 1 |
| `frost_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/frost_giant_goliath.json` |  |  |  | 4 | 3 |
| `gaining_spells` | `public/data/glossary/entries/rules/spells/gaining_spells.json` |  |  |  |  | 3 |
| `giff` | `public/data/glossary/entries/races/giff.json` |  |  |  | 5 | 2 |
| `githyanki` | `public/data/glossary/entries/races/githyanki.json` |  |  |  | 9 | 3 |
| `githzerai` | `public/data/glossary/entries/races/githzerai.json` |  |  |  | 11 | 3 |
| `gloom_stalker_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/gloom_stalker.json` |  |  |  |  | 3 |
| `glossary_conventions` | `public/data/glossary/entries/rules/glossary_conventions.json` |  |  |  |  | 3 |
| `goblin` | `public/data/glossary/entries/races/goblin.json` |  |  |  | 11 | 5 |
| `gold_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/gold.json` |  |  |  | 5 | 3 |
| `grappled_condition` | `public/data/glossary/entries/rules/conditions/grappled_condition.json` |  |  |  |  | 1 |
| `grappling` | `public/data/glossary/entries/rules/grappling.json` |  |  |  | 4 | 4 |
| `great_old_one_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/great_old_one.json` |  |  |  |  | 2 |
| `green_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/green.json` |  |  |  | 5 | 3 |
| `guardian_human` | `public/data/glossary/entries/races/dragonmark_variants/guardian_human.json` |  |  |  | 15 | 3 |
| `hadozee` | `public/data/glossary/entries/races/hadozee.json` |  |  |  | 6 | 1 |
| `half_cover` | `public/data/glossary/entries/rules/spells/referenced/half_cover.json` |  |  |  | 1 | 1 |
| `half_elf` | `public/data/glossary/entries/races/half_elf.json` |  |  |  | 3 | 3 |
| `half_elf_aquatic` | `public/data/glossary/entries/races/half_elf_variants/aquatic.json` |  |  |  | 9 | 4 |
| `half_elf_drow` | `public/data/glossary/entries/races/half_elf_variants/drow.json` |  |  |  | 13 | 4 |
| `half_elf_high` | `public/data/glossary/entries/races/half_elf_variants/high.json` |  |  |  | 9 | 4 |
| `half_elf_wood` | `public/data/glossary/entries/races/half_elf_variants/wood.json` |  |  |  | 9 | 4 |
| `half_orc` | `public/data/glossary/entries/races/half_orc.json` |  |  |  | 3 | 3 |
| `halfling` | `public/data/glossary/entries/races/halfling.json` |  |  |  | 5 | 4 |
| `harengon` | `public/data/glossary/entries/races/harengon.json` |  |  |  | 10 | 3 |
| `hazards` | `public/data/glossary/entries/rules/hazards.json` |  |  |  |  | 5 |
| `healing` | `public/data/glossary/entries/rules/healing.json` |  |  |  | 5 | 4 |
| `hearthkeeper_halfling` | `public/data/glossary/entries/races/dragonmark_variants/hearthkeeper_halfling.json` |  |  |  | 17 | 3 |
| `heavily_obscured` | `public/data/glossary/entries/rules/heavily_obscured.json` |  |  |  | 4 | 5 |
| `help_action` | `public/data/glossary/entries/rules/help_action.json` |  |  |  | 2 | 4 |
| `herbalism_gathering` | `public/data/glossary/entries/rules/crafting/herbalism_gathering.json` |  |  |  |  | 2 |
| `hide_action` | `public/data/glossary/entries/rules/hide_action.json` |  |  |  | 5 | 5 |
| `hiding` | `public/data/glossary/entries/rules/hiding.json` |  |  |  | 5 | 4 |
| `high_elf` | `public/data/glossary/entries/races/elf_lineages/high_elf.json` |  |  |  | 5 | 5 |
| `high_jump` | `public/data/glossary/entries/rules/high_jump.json` |  |  |  |  | 4 |
| `hill_dwarf` | `public/data/glossary/entries/races/hill_dwarf.json` |  |  |  | 9 | 3 |
| `hill_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/hill_giant_goliath.json` |  |  |  | 3 | 2 |
| `hit_points` | `public/data/glossary/entries/rules/hit_points.json` |  |  |  | 1 | 3 |
| `hobgoblin` | `public/data/glossary/entries/races/hobgoblin.json` |  |  |  | 15 | 4 |
| `hostile_attitude` | `public/data/glossary/entries/rules/hostile_attitude.json` |  |  |  |  | 5 |
| `hover` | `public/data/glossary/entries/rules/hover.json` |  |  |  | 2 | 3 |
| `human` | `public/data/glossary/entries/races/human.json` |  |  |  | 4 | 4 |
| `hunter_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/hunter.json` |  |  |  |  | 2 |
| `illusionist_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/illusionist.json` |  |  |  |  | 3 |
| `illusions` | `public/data/glossary/entries/rules/illusions.json` |  |  |  | 3 | 4 |
| `immunity` | `public/data/glossary/entries/rules/immunity.json` |  |  |  | 3 | 4 |
| `improvised_weapons` | `public/data/glossary/entries/rules/improvised_weapons.json` |  |  |  | 2 | 4 |
| `incapacitated_condition` | `public/data/glossary/entries/rules/conditions/incapacitated_condition.json` |  |  |  |  | 4 |
| `indifferent_attitude` | `public/data/glossary/entries/rules/indifferent_attitude.json` |  |  |  |  | 4 |
| `infernal_tiefling` | `public/data/glossary/entries/races/tiefling_legacies/infernal.json` |  |  |  | 5 | 5 |
| `influence_action` | `public/data/glossary/entries/rules/influence_action.json` |  |  |  | 1 | 5 |
| `initiative` | `public/data/glossary/entries/rules/initiative.json` |  |  |  | 4 | 2 |
| `invisible_condition` | `public/data/glossary/entries/rules/conditions/invisible_condition.json` |  |  |  |  | 1 |
| `jumping` | `public/data/glossary/entries/rules/movement/jumping.json` |  |  |  |  | 5 |
| `kalashtar` | `public/data/glossary/entries/races/kalashtar.json` |  |  |  | 5 | 2 |
| `kender` | `public/data/glossary/entries/races/kender.json` |  |  |  | 14 | 2 |
| `kenku` | `public/data/glossary/entries/races/kenku.json` |  |  |  | 9 | 4 |
| `knocking_out_a_creature` | `public/data/glossary/entries/rules/knocking_out_a_creature.json` |  |  |  | 3 | 5 |
| `kobold` | `public/data/glossary/entries/races/kobold.json` |  |  |  | 6 | 4 |
| `leonin` | `public/data/glossary/entries/races/leonin.json` |  |  |  | 16 | 2 |
| `life_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/life_domain.json` |  |  |  |  | 4 |
| `light_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/light_domain.json` |  |  |  |  | 3 |
| `light_rules` | `public/data/glossary/entries/rules/light.json` |  |  |  |  | 5 |
| `lightfoot_halfling` | `public/data/glossary/entries/races/halfling_subraces/lightfoot.json` |  |  |  | 4 | 3 |
| `lightly_obscured` | `public/data/glossary/entries/rules/lightly_obscured.json` |  |  |  | 4 | 5 |
| `line_area` | `public/data/glossary/entries/rules/spells/referenced/line_area.json` |  |  |  | 3 | 1 |
| `lizardfolk` | `public/data/glossary/entries/races/lizardfolk.json` |  |  |  | 6 | 4 |
| `lockpicking` | `public/data/glossary/entries/rules/lockpicking.json` |  |  |  |  | 3 |
| `long_jump` | `public/data/glossary/entries/rules/long_jump.json` |  |  |  |  | 5 |
| `long_rest` | `public/data/glossary/entries/rules/long_rest.json` |  |  |  | 3 | 3 |
| `longtooth_shifter` | `public/data/glossary/entries/races/shifter_variants/longtooth.json` |  |  |  | 11 | 2 |
| `lotusden_halfling` | `public/data/glossary/entries/races/halfling_subraces/lotusden_halfling.json` |  |  |  | 8 | 4 |
| `loxodon` | `public/data/glossary/entries/races/loxodon.json` |  |  |  | 8 | 3 |
| `magic_action` | `public/data/glossary/entries/rules/magic_action.json` |  |  |  | 7 | 4 |
| `magic_item_attunement` | `public/data/glossary/entries/rules/equipment/magic_items/attunement.json` |  |  |  | 1 | 3 |
| `magical_effect` | `public/data/glossary/entries/rules/magical_effect.json` |  |  |  | 1 | 4 |
| `malnutrition` | `public/data/glossary/entries/rules/malnutrition.json` |  |  |  | 4 | 4 |
| `mender_halfling` | `public/data/glossary/entries/races/dragonmark_variants/mender_halfling.json` |  |  |  | 16 | 3 |
| `minotaur` | `public/data/glossary/entries/races/minotaur.json` |  |  |  | 7 | 3 |
| `monk` | `public/data/glossary/entries/classes/monk.json` |  |  |  |  | 5 |
| `mountain_dwarf` | `public/data/glossary/entries/races/dwarf_subraces/mountain_dwarf.json` |  |  |  | 12 | 4 |
| `oath_of_devotion_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_devotion.json` |  |  |  |  | 4 |
| `oath_of_glory_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_glory.json` |  |  |  |  | 4 |
| `oath_of_the_ancients_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_the_ancients.json` |  |  |  |  | 4 |
| `oath_of_vengeance_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_vengeance.json` |  |  |  |  | 4 |
| `object` | `public/data/glossary/entries/rules/object.json` |  |  |  | 2 | 2 |
| `occupied_space` | `public/data/glossary/entries/rules/occupied_space.json` |  |  |  | 2 | 3 |
| `one_thing_at_a_time` | `public/data/glossary/entries/rules/one_thing_at_a_time.json` |  |  |  |  | 3 |
| `opportunity_attack` | `public/data/glossary/entries/rules/opportunity_attack.json` |  |  |  | 1 | 2 |
| `orc` | `public/data/glossary/entries/races/orc.json` |  |  |  | 10 | 5 |
| `paladin` | `public/data/glossary/entries/classes/paladin.json` |  |  |  |  | 6 |
| `paladin_spell_list` | `public/data/glossary/entries/classes/paladin_spell_list.json` |  |  |  |  | 2 |
| `pallid_elf` | `public/data/glossary/entries/races/elf_lineages/pallid_elf.json` |  |  |  | 17 | 5 |
| `paralyzed_condition` | `public/data/glossary/entries/rules/conditions/paralyzed_condition.json` |  |  |  |  | 2 |
| `passive_perception` | `public/data/glossary/entries/rules/passive_perception.json` |  |  |  | 1 | 3 |
| `path_of_the_berserker` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_berserker.json` |  |  |  |  | 4 |
| `path_of_the_wild_heart` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_wild_heart.json` |  |  |  |  | 3 |
| `path_of_the_world_tree` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_world_tree.json` |  |  |  |  | 4 |
| `path_of_the_zealot` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_zealot.json` |  |  |  |  | 5 |
| `pathfinder_half_orc` | `public/data/glossary/entries/races/dragonmark_variants/pathfinder_half_orc.json` |  |  |  | 21 | 3 |
| `petrified_condition` | `public/data/glossary/entries/rules/conditions/petrified_condition.json` |  |  |  |  | 2 |
| `plasmoid` | `public/data/glossary/entries/races/plasmoid.json` |  |  |  | 13 | 4 |
| `poison_crafting` | `public/data/glossary/entries/rules/crafting/poison_crafting.json` |  |  |  |  | 2 |
| `poisoned_condition` | `public/data/glossary/entries/rules/conditions/poisoned_condition.json` |  |  |  |  | 1 |
| `possessed` | `public/data/glossary/entries/rules/possessed.json` |  |  |  | 1 | 2 |
| `possession` | `public/data/glossary/entries/rules/possession.json` |  |  |  |  | 4 |
| `proficiency` | `public/data/glossary/entries/rules/proficiency.json` |  |  |  |  | 5 |
| `proficiency_bonus` | `public/data/glossary/entries/rules/proficiency_bonus.json` |  |  |  |  | 5 |
| `prone_condition` | `public/data/glossary/entries/rules/conditions/prone_condition.json` |  |  |  |  | 1 |
| `protector_aasimar` | `public/data/glossary/entries/races/aasimar_variants/protector.json` |  |  |  | 16 | 4 |
| `psi_warrior_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/psi_warrior.json` |  |  |  |  | 2 |
| `ranger` | `public/data/glossary/entries/classes/ranger.json` |  |  |  |  | 7 |
| `ranger_spell_list` | `public/data/glossary/entries/classes/ranger_spell_list.json` |  |  |  |  | 2 |
| `ravenite_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/ravenite.json` |  |  |  | 7 | 3 |
| `reach` | `public/data/glossary/entries/rules/reach.json` |  |  |  | 3 | 4 |
| `reaction` | `public/data/glossary/entries/rules/reaction.json` |  |  |  | 1 | 3 |
| `reactions` | `public/data/glossary/entries/rules/reactions.json` |  |  |  |  | 3 |
| `ready_action` | `public/data/glossary/entries/rules/ready_action.json` |  |  |  | 2 | 4 |
| `red_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/red.json` |  |  |  | 5 | 3 |
| `resistance` | `public/data/glossary/entries/rules/resistance.json` |  |  |  | 2 | 2 |
| `restrained_condition` | `public/data/glossary/entries/rules/conditions/restrained_condition.json` |  |  |  |  | 1 |
| `ritual` | `public/data/glossary/entries/rules/ritual.json` |  |  |  | 1 | 1 |
| `rock_gnome` | `public/data/glossary/entries/races/gnome_subraces/rock_gnome.json` |  |  |  | 4 | 4 |
| `rogue` | `public/data/glossary/entries/classes/rogue.json` |  |  |  |  | 6 |
| `round_down` | `public/data/glossary/entries/rules/round_down.json` |  |  |  |  | 2 |
| `runeward_dwarf` | `public/data/glossary/entries/races/dragonmark_variants/runeward_dwarf.json` |  |  |  | 24 | 3 |
| `satyr` | `public/data/glossary/entries/races/satyr.json` |  |  |  | 7 | 3 |
| `save` | `public/data/glossary/entries/rules/save.json` |  |  |  |  | 5 |
| `saving_throw` | `public/data/glossary/entries/rules/saving_throw.json` |  |  |  | 2 | 4 |
| `saving_throw_proficiencies` | `public/data/glossary/entries/rules/saving_throw_proficiencies.json` |  |  |  |  | 2 |
| `school_of_magic` | `public/data/glossary/entries/rules/spells/school_of_magic.json` |  |  |  |  | 2 |
| `scourge_aasimar` | `public/data/glossary/entries/races/aasimar_variants/scourge.json` |  |  |  | 16 | 4 |
| `scribing_spell_scrolls` | `public/data/glossary/entries/rules/equipment/crafting/scribing_spell_scrolls.json` |  |  |  |  | 3 |
| `sea_elf` | `public/data/glossary/entries/races/elf_lineages/sea_elf.json` |  |  |  | 11 | 3 |
| `search_action` | `public/data/glossary/entries/rules/search_action.json` |  |  |  | 4 | 4 |
| `seersight_half_elf` | `public/data/glossary/entries/races/dragonmark_variants/seersight_half_elf.json` |  |  |  | 24 | 3 |
| `shadar_kai` | `public/data/glossary/entries/races/elf_lineages/shadar_kai.json` |  |  |  | 15 | 4 |
| `shadowveil_elf` | `public/data/glossary/entries/races/dragonmark_variants/shadowveil_elf.json` |  |  |  | 24 | 3 |
| `shape_shift` | `public/data/glossary/entries/rules/shape_shift.json` |  |  |  | 3 | 3 |
| `short_rest` | `public/data/glossary/entries/rules/short_rest.json` |  |  |  | 2 | 2 |
| `silver_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/silver.json` |  |  |  | 5 | 3 |
| `simic_hybrid` | `public/data/glossary/entries/races/simic_hybrid.json` |  |  |  | 8 | 2 |
| `simultaneous_effects` | `public/data/glossary/entries/rules/simultaneous_effects.json` |  |  |  | 1 | 3 |
| `size` | `public/data/glossary/entries/rules/size.json` |  |  |  |  | 2 |
| `skill` | `public/data/glossary/entries/rules/skill.json` |  |  |  | 3 | 3 |
| `skill_proficiencies` | `public/data/glossary/entries/rules/skill_proficiencies.json` |  |  |  |  | 2 |
| `sorcerer` | `public/data/glossary/entries/classes/sorcerer.json` |  |  |  |  | 9 |
| `sorcerer_spell_list` | `public/data/glossary/entries/classes/sorcerer_spell_list.json` |  |  |  |  | 2 |
| `soulknife_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/soulknife.json` |  |  |  |  | 3 |
| `special_speeds` | `public/data/glossary/entries/rules/special_speeds.json` |  |  |  |  | 4 |
| `speed` | `public/data/glossary/entries/rules/speed.json` |  |  |  |  | 7 |
| `spell` | `public/data/glossary/entries/rules/spell.json` |  |  |  | 6 | 6 |
| `spell_attack` | `public/data/glossary/entries/rules/spell_attack.json` |  |  |  | 5 | 5 |
| `spell_components_rules` | `public/data/glossary/entries/rules/spells/spell_components_rules.json` |  |  |  |  | 3 |
| `spell_duration_rules` | `public/data/glossary/entries/rules/spells/spell_duration_rules.json` |  |  |  |  | 2 |
| `spell_effects_rules` | `public/data/glossary/entries/rules/spells/spell_effects_rules.json` |  |  |  |  | 5 |
| `spell_level_slots` | `public/data/glossary/entries/rules/spells/spell_level_slots.json` |  |  |  |  | 3 |
| `spell_range_rules` | `public/data/glossary/entries/rules/spells/spell_range_rules.json` |  |  |  |  | 2 |
| `spell_referenced_rules_enrichment` | `public/data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json` |  |  |  | 15 | 4 |
| `spell_scroll` | `public/data/glossary/entries/magic_items/spell_scroll.json` |  |  |  |  | 5 |
| `spell_slot` | `public/data/glossary/entries/rules/spell_slot.json` |  |  |  | 3 | 2 |
| `spellcasting_focus` | `public/data/glossary/entries/rules/spellcasting_focus.json` |  |  |  | 2 | 4 |
| `spells_chapter` | `public/data/glossary/entries/rules/spells_chapter.json` |  |  |  | 11 | 11 |
| `sphere_area` | `public/data/glossary/entries/rules/spells/referenced/sphere_area.json` |  |  |  | 28 | 1 |
| `spring_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/spring.json` |  |  |  | 14 | 4 |
| `stable` | `public/data/glossary/entries/rules/stable.json` |  |  |  |  | 4 |
| `stat_block` | `public/data/glossary/entries/rules/stat_block.json` |  |  |  | 3 | 4 |
| `stone_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/stone_giant_goliath.json` |  |  |  | 3 | 3 |
| `storm_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/storm_giant_goliath.json` |  |  |  | 4 | 3 |
| `stormborn_half_elf` | `public/data/glossary/entries/races/dragonmark_variants/stormborn_half_elf.json` |  |  |  | 23 | 3 |
| `stout_halfling` | `public/data/glossary/entries/races/halfling_subraces/stout.json` |  |  |  | 7 | 4 |
| `strength` | `public/data/glossary/entries/rules/strength.json` |  |  |  |  | 3 |
| `study_action` | `public/data/glossary/entries/rules/study_action.json` |  |  |  | 2 | 5 |
| `stunned_condition` | `public/data/glossary/entries/rules/conditions/stunned_condition.json` |  |  |  |  | 1 |
| `suffocation` | `public/data/glossary/entries/rules/suffocation.json` |  |  |  |  | 3 |
| `summer_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/summer.json` |  |  |  | 16 | 5 |
| `surprise` | `public/data/glossary/entries/rules/surprise.json` |  |  |  | 2 | 3 |
| `swiftstride_shifter` | `public/data/glossary/entries/races/shifter_variants/swiftstride.json` |  |  |  | 12 | 3 |
| `swim_speed` | `public/data/glossary/entries/rules/swim_speed.json` |  |  |  |  | 5 |
| `swimming` | `public/data/glossary/entries/rules/movement/swimming.json` |  |  |  |  | 4 |
| `tabaxi` | `public/data/glossary/entries/races/tabaxi.json` |  |  |  | 5 | 5 |
| `target` | `public/data/glossary/entries/rules/target.json` |  |  |  | 1 | 4 |
| `telepathy` | `public/data/glossary/entries/rules/telepathy.json` |  |  |  |  | 2 |
| `teleportation` | `public/data/glossary/entries/rules/teleportation.json` |  |  |  | 3 | 3 |
| `temporary_hp` | `public/data/glossary/entries/rules/temporary_hp.json` |  |  |  | 2 | 1 |
| `thief_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/thief.json` |  |  |  |  | 4 |
| `three_quarters_cover` | `public/data/glossary/entries/rules/spells/referenced/three_quarters_cover.json` |  |  |  | 2 | 1 |
| `thri_kreen` | `public/data/glossary/entries/races/thri_kreen.json` |  |  |  | 10 | 2 |
| `tortle` | `public/data/glossary/entries/races/tortle.json` |  |  |  | 9 | 3 |
| `total_cover` | `public/data/glossary/entries/rules/spells/referenced/total_cover.json` |  |  |  | 3 | 1 |
| `traps` | `public/data/glossary/entries/rules/traps.json` |  |  |  |  | 3 |
| `tremorsense` | `public/data/glossary/entries/rules/tremorsense.json` |  |  |  |  | 3 |
| `trickery_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/trickery_domain.json` |  |  |  |  | 3 |
| `triton` | `public/data/glossary/entries/races/triton.json` |  |  |  | 6 | 6 |
| `truesight` | `public/data/glossary/entries/rules/truesight.json` |  |  |  | 3 | 4 |
| `unarmed_strike` | `public/data/glossary/entries/rules/unarmed_strike.json` |  |  |  | 1 | 1 |
| `unconscious_condition` | `public/data/glossary/entries/rules/conditions/unconscious_condition.json` |  |  |  |  | 3 |
| `unoccupied_space` | `public/data/glossary/entries/rules/unoccupied_space.json` |  |  |  | 1 | 2 |
| `utilize_action` | `public/data/glossary/entries/rules/utilize_action.json` |  |  |  | 3 | 5 |
| `vedalken` | `public/data/glossary/entries/races/vedalken.json` |  |  |  | 9 | 2 |
| `vehicle_damage_threshold` | `public/data/glossary/entries/rules/equipment/vehicles/damage_threshold.json` |  |  |  | 1 | 2 |
| `verdan` | `public/data/glossary/entries/races/verdan.json` |  |  |  | 4 | 3 |
| `vision` | `public/data/glossary/entries/rules/vision.json` |  |  |  | 8 | 6 |
| `vision_and_light` | `public/data/glossary/entries/rules/vision_and_light.json` |  |  |  | 7 |  |
| `vulnerability` | `public/data/glossary/entries/rules/vulnerability.json` |  |  |  | 3 | 3 |
| `war_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/war_domain.json` |  |  |  |  | 3 |
| `warforged` | `public/data/glossary/entries/races/warforged.json` |  |  |  | 6 | 3 |
| `warlock` | `public/data/glossary/entries/classes/warlock.json` |  |  |  |  | 6 |
| `warlock_spell_list` | `public/data/glossary/entries/classes/warlock_spell_list.json` |  |  |  |  | 2 |
| `warrior_of_mercy_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_mercy.json` |  |  |  |  | 3 |
| `warrior_of_shadow_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_shadow.json` |  |  |  |  | 5 |
| `warrior_of_the_elements_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_the_elements.json` |  |  |  |  | 4 |
| `warrior_of_the_open_hand_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_the_open_hand.json` |  |  |  |  | 4 |
| `water_genasi` | `public/data/glossary/entries/races/water_genasi.json` |  |  |  | 5 | 4 |
| `wayfarer_human` | `public/data/glossary/entries/races/dragonmark_variants/wayfarer_human.json` |  |  |  | 13 | 3 |
| `weapon` | `public/data/glossary/entries/rules/weapon.json` |  |  |  | 5 | 4 |
| `weapon_attack` | `public/data/glossary/entries/rules/weapon_attack.json` |  |  |  | 3 | 4 |
| `white_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/white.json` |  |  |  | 5 | 3 |
| `wild_magic_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/wild_magic_sorcery.json` |  |  |  |  | 2 |
| `wildhunt_shifter` | `public/data/glossary/entries/races/shifter_variants/wildhunt.json` |  |  |  | 12 | 3 |
| `winter_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/winter.json` |  |  |  | 16 | 5 |
| `wisdom` | `public/data/glossary/entries/rules/wisdom.json` |  |  |  |  | 3 |
| `wizard` | `public/data/glossary/entries/classes/wizard.json` |  |  |  |  | 7 |
| `wizard_spell_list` | `public/data/glossary/entries/classes/wizard_spell_list.json` |  |  |  |  | 2 |
| `wood_elf` | `public/data/glossary/entries/races/elf_lineages/wood_elf.json` |  |  |  | 5 | 5 |
| `wordweaver_gnome` | `public/data/glossary/entries/races/dragonmark_variants/wordweaver_gnome.json` |  |  |  | 23 | 3 |
| `yuan_ti` | `public/data/glossary/entries/races/yuan_ti.json` |  |  |  | 12 | 4 |
