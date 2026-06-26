# Glossary Link Surfaces Inventory

_Generated 2026-06-25T11:20:19.561Z by `scripts/audits/inventory-glossary-link-surfaces.ts`._

This report is generated. To regenerate:

```
npx tsx scripts/audits/inventory-glossary-link-surfaces.ts
```

See [NORTH_STAR.md](./NORTH_STAR.md) for the surface taxonomy this report classifies against.

## Totals

| Surface | Occurrences in entry data |
| --- | ---: |
| Pill redirect | 0 |
| Clickable pill (glossaryTermId set) | 0 |
| Hover-backed pill (GlossaryTooltip wrapper) | 0 |
| Inline redirect text | 3842 |
| Footer See Also redirect | 2855 |

- Entry files scanned: 942 (only entries with at least one redirect surface are listed below)
- Index files scanned: 15 (covering 671 index rows; 262 rows carry a seeAlso array)
- Component files with redirect signals: 13

## Components

| File | Surfaces | Signals |
| --- | --- | --- |
| `src/components/Glossary/__tests__/Glossary.test.tsx` | Footer See Also redirect | seeAlso+onNavigate |
| `src/components/Glossary/FullEntryDisplay.tsx` | Clickable pill (glossaryTermId set) | glossaryTermId |
| `src/components/Glossary/Glossary.tsx` | Clickable pill (glossaryTermId set) | glossaryTermId |
| `src/components/Glossary/GlossaryContentRenderer.tsx` | Inline redirect text | GlossaryContentRenderer, data-term-id |
| `src/components/Glossary/GlossaryEntryPanel.tsx` | Clickable pill (glossaryTermId set) | glossaryTermId |
| `src/components/Glossary/GlossaryEntryTemplate.tsx` | Inline redirect text, Footer See Also redirect | GlossaryContentRenderer, seeAlso+onNavigate |
| `src/components/Glossary/GlossaryPill.tsx` | Pill redirect, Clickable pill (glossaryTermId set), Hover-backed pill (GlossaryTooltip wrapper) | GlossaryPill, glossaryTermId, GlossaryTooltip |
| `src/components/Glossary/GlossarySpellsOfTheMarkTable.tsx` | Inline redirect text | GlossaryContentRenderer |
| `src/components/Glossary/GlossarySummaryTable.tsx` | Inline redirect text | GlossaryContentRenderer |
| `src/components/Glossary/GlossaryTooltip.tsx` | Hover-backed pill (GlossaryTooltip wrapper) | GlossaryTooltip |
| `src/components/Glossary/GlossaryTraitTable.tsx` | Inline redirect text | GlossaryContentRenderer |
| `src/components/Glossary/index.ts` | Hover-backed pill (GlossaryTooltip wrapper), Inline redirect text | GlossaryTooltip, GlossaryContentRenderer |
| `src/components/Glossary/SpellCardTemplate.tsx` | Clickable pill (glossaryTermId set), Hover-backed pill (GlossaryTooltip wrapper) | glossaryTermId, GlossaryTooltip |

## Index Files

| Index | Entries | `seeAlso` entries |
| --- | ---: | ---: |
| `public/data/glossary/index/character_backgrounds.json` | 16 | 16 |
| `public/data/glossary/index/character_classes.json` | 13 | 13 |
| `public/data/glossary/index/character_races.json` | 19 | 0 |
| `public/data/glossary/index/crafting_glossary.json` | 9 | 3 |
| `public/data/glossary/index/crafting.json` | 1 | 0 |
| `public/data/glossary/index/developer.json` | 1 | 1 |
| `public/data/glossary/index/equipment.json` | 30 | 0 |
| `public/data/glossary/index/feats.json` | 77 | 61 |
| `public/data/glossary/index/lore.json` | 2 | 0 |
| `public/data/glossary/index/magic_items.json` | 1 | 1 |
| `public/data/glossary/index/main.json` | 0 | 0 |
| `public/data/glossary/index/rules_glossary.json` | 481 | 157 |
| `public/data/glossary/index/spellcasting_mechanics.json` | 10 | 10 |
| `public/data/glossary/index/spells.json` | 10 | 0 |
| `public/data/glossary/index/technology.json` | 1 | 0 |

## Entries (redirect surfaces by entry)

Only entries with at least one redirect surface are listed. Counts are occurrences within the entry JSON.

| Entry id | File | Pill | Clickable Pill | Hover Pill | Inline Text | See Also |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `1_rod_of_the_pact_keeper` | `public/data/glossary/entries/equipment/1_rod_of_the_pact_keeper.json` |  |  |  | 2 | 2 |
| `1_wand_of_the_war_mage` | `public/data/glossary/entries/equipment/1_wand_of_the_war_mage.json` |  |  |  | 1 | 1 |
| `2_rod_of_the_pact_keeper` | `public/data/glossary/entries/equipment/2_rod_of_the_pact_keeper.json` |  |  |  | 2 | 2 |
| `2_wand_of_the_war_mage` | `public/data/glossary/entries/equipment/2_wand_of_the_war_mage.json` |  |  |  | 1 | 1 |
| `3_rod_of_the_pact_keeper` | `public/data/glossary/entries/equipment/3_rod_of_the_pact_keeper.json` |  |  |  | 2 | 2 |
| `3_wand_of_the_war_mage` | `public/data/glossary/entries/equipment/3_wand_of_the_war_mage.json` |  |  |  | 1 | 1 |
| `aarakocra` | `public/data/glossary/entries/races/aarakocra.json` |  |  |  | 4 | 3 |
| `aberrant_mind_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/aberrant_sorcery.json` |  |  |  |  | 3 |
| `ability_check` | `public/data/glossary/entries/rules/ability_check.json` |  |  |  | 2 |  |
| `ability_score_and_modifier` | `public/data/glossary/entries/rules/ability_score_and_modifier.json` |  |  |  | 1 |  |
| `abjurer_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/abjurer.json` |  |  |  |  | 3 |
| `acid` | `public/data/glossary/entries/equipment/acid.json` |  |  |  | 2 | 2 |
| `acolyte` | `public/data/glossary/entries/backgrounds/acolyte.json` |  |  |  | 9 | 8 |
| `action` | `public/data/glossary/entries/rules/action.json` |  |  |  | 12 |  |
| `actions` | `public/data/glossary/entries/rules/actions.json` |  |  |  |  | 4 |
| `actor` | `public/data/glossary/entries/feats/actor.json` |  |  |  | 5 | 5 |
| `advantage` | `public/data/glossary/entries/rules/advantage.json` |  |  |  | 3 |  |
| `advantage_disadvantage` | `public/data/glossary/entries/rules/advantage_disadvantage.json` |  |  |  |  | 4 |
| `adventure` | `public/data/glossary/entries/rules/adventure.json` |  |  |  | 2 |  |
| `air_genasi` | `public/data/glossary/entries/races/air_genasi.json` |  |  |  | 5 | 3 |
| `alchemist_s_fire` | `public/data/glossary/entries/equipment/alchemist_s_fire.json` |  |  |  | 2 | 2 |
| `alchemist_s_supplies` | `public/data/glossary/entries/equipment/alchemist_s_supplies.json` |  |  |  | 6 | 6 |
| `alchemist_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/alchemist.json` |  |  |  |  | 3 |
| `alchemy_crafting` | `public/data/glossary/entries/rules/crafting/alchemy_crafting.json` |  |  |  |  | 2 |
| `alchemy_jug` | `public/data/glossary/entries/equipment/alchemy_jug.json` |  |  |  | 2 | 2 |
| `alert` | `public/data/glossary/entries/feats/alert.json` |  |  |  | 6 | 3 |
| `ambush` | `public/data/glossary/entries/rules/ambush.json` |  |  |  | 3 | 3 |
| `amulet_of_the_planes` | `public/data/glossary/entries/equipment/amulet_of_the_planes.json` |  |  |  | 3 | 3 |
| `animated_shield` | `public/data/glossary/entries/equipment/animated_shield.json` |  |  |  | 3 | 2 |
| `antitoxin` | `public/data/glossary/entries/equipment/antitoxin.json` |  |  |  | 3 | 3 |
| `apparatus_of_kwalish` | `public/data/glossary/entries/equipment/apparatus_of_kwalish.json` |  |  |  | 7 | 7 |
| `arcane_trickster_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/arcane_trickster.json` |  |  |  |  | 3 |
| `archfey_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/archfey.json` |  |  |  |  | 2 |
| `area_of_effect` | `public/data/glossary/entries/rules/area_of_effect.json` |  |  |  | 7 |  |
| `armor_of_invulnerability` | `public/data/glossary/entries/equipment/armor_of_invulnerability.json` |  |  |  | 3 | 3 |
| `armor_of_shadows` | `public/data/glossary/entries/rules/armor_of_shadows.json` |  |  |  | 1 | 1 |
| `armor_training` | `public/data/glossary/entries/rules/armor_training.json` |  |  |  | 2 |  |
| `armorer_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/armorer.json` |  |  |  |  | 2 |
| `arrow` | `public/data/glossary/entries/equipment/arrow.json` |  |  |  | 1 | 1 |
| `arrow_catching_shield` | `public/data/glossary/entries/equipment/arrow_catching_shield.json` |  |  |  | 2 | 2 |
| `arrows_20` | `public/data/glossary/entries/equipment/arrows_20.json` |  |  |  | 1 | 1 |
| `artificer` | `public/data/glossary/entries/classes/artificer.json` |  |  |  |  | 9 |
| `artificer_infusions` | `public/data/glossary/entries/classes/artificer_infusions.json` |  |  |  |  | 2 |
| `artificer_spell_list` | `public/data/glossary/entries/classes/artificer_spell_list.json` |  |  |  |  | 2 |
| `artillerist_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/artillerist.json` |  |  |  |  | 2 |
| `artisan` | `public/data/glossary/entries/backgrounds/artisan.json` |  |  |  | 7 | 6 |
| `ascendant_step` | `public/data/glossary/entries/rules/ascendant_step.json` |  |  |  | 1 | 1 |
| `assassin_s_blood` | `public/data/glossary/entries/equipment/assassin_s_blood.json` |  |  |  | 1 | 1 |
| `assassin_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/assassin.json` |  |  |  |  | 2 |
| `astral_elf` | `public/data/glossary/entries/races/elf_lineages/astral_elf.json` |  |  |  | 18 | 3 |
| `athlete` | `public/data/glossary/entries/feats/athlete.json` |  |  |  | 5 | 5 |
| `attack` | `public/data/glossary/entries/rules/attack.json` |  |  |  | 2 |  |
| `attack_action` | `public/data/glossary/entries/rules/attack_action.json` |  |  |  | 3 | 3 |
| `attack_roll` | `public/data/glossary/entries/rules/attack_roll.json` |  |  |  | 4 |  |
| `attitude` | `public/data/glossary/entries/rules/attitude.json` |  |  |  | 9 |  |
| `autognome` | `public/data/glossary/entries/races/autognome.json` |  |  |  | 16 | 3 |
| `autumn_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/autumn.json` |  |  |  | 16 | 4 |
| `axe_of_the_dwarvish_lords` | `public/data/glossary/entries/equipment/axe_of_the_dwarvish_lords.json` |  |  |  | 12 | 10 |
| `baba_yaga_s_dancing_broom` | `public/data/glossary/entries/equipment/baba_yaga_s_dancing_broom.json` |  |  |  | 6 | 5 |
| `bag_of_beans` | `public/data/glossary/entries/equipment/bag_of_beans.json` |  |  |  | 4 | 3 |
| `bag_of_devouring` | `public/data/glossary/entries/equipment/bag_of_devouring.json` |  |  |  | 3 | 2 |
| `bag_of_holding` | `public/data/glossary/entries/equipment/bag_of_holding.json` |  |  |  | 3 | 3 |
| `bag_of_tricks_gray` | `public/data/glossary/entries/equipment/bag_of_tricks_gray.json` |  |  |  | 5 | 5 |
| `bag_of_tricks_rust` | `public/data/glossary/entries/equipment/bag_of_tricks_rust.json` |  |  |  | 5 | 5 |
| `bag_of_tricks_tan` | `public/data/glossary/entries/equipment/bag_of_tricks_tan.json` |  |  |  | 5 | 5 |
| `bait_and_switch` | `public/data/glossary/entries/rules/bait_and_switch.json` |  |  |  | 2 | 2 |
| `ball_bearings` | `public/data/glossary/entries/equipment/ball_bearings.json` |  |  |  | 2 | 2 |
| `barbarian` | `public/data/glossary/entries/classes/barbarian.json` |  |  |  |  | 4 |
| `bard` | `public/data/glossary/entries/classes/bard.json` |  |  |  |  | 8 |
| `bard_spell_list` | `public/data/glossary/entries/classes/bard_spell_list.json` |  |  |  |  | 2 |
| `basic_poison` | `public/data/glossary/entries/equipment/basic_poison.json` |  |  |  | 1 | 1 |
| `battle_master_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/battle_master.json` |  |  |  |  | 2 |
| `battle_smith_subclass` | `public/data/glossary/entries/classes/artificer_subclasses/battle_smith.json` |  |  |  |  | 3 |
| `bead_of_force` | `public/data/glossary/entries/equipment/bead_of_force.json` |  |  |  | 5 | 4 |
| `beast_master_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/beast_master.json` |  |  |  |  | 2 |
| `beastborn_human` | `public/data/glossary/entries/races/dragonmark_variants/beastborn_human.json` |  |  |  | 18 | 3 |
| `beasthide_shifter` | `public/data/glossary/entries/races/shifter_variants/beasthide.json` |  |  |  | 10 | 2 |
| `bell` | `public/data/glossary/entries/equipment/bell.json` |  |  |  | 1 | 1 |
| `belt_of_dwarvenkind` | `public/data/glossary/entries/equipment/belt_of_dwarvenkind.json` |  |  |  | 6 | 5 |
| `bf` | `public/data/glossary/entries/rules/bf.json` |  |  |  | 1 | 1 |
| `black_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/black.json` |  |  |  | 14 | 3 |
| `blackrazor` | `public/data/glossary/entries/equipment/blackrazor.json` |  |  |  | 12 | 10 |
| `blanket` | `public/data/glossary/entries/equipment/blanket.json` |  |  |  | 1 | 1 |
| `blessed_warrior` | `public/data/glossary/entries/feats/blessed_warrior.json` |  |  |  | 2 | 2 |
| `blind_fighting` | `public/data/glossary/entries/feats/blind_fighting.json` |  |  |  | 1 | 1 |
| `blinded` | `public/data/glossary/entries/rules/blinded.json` |  |  |  | 3 |  |
| `blinded_condition` | `public/data/glossary/entries/rules/conditions/blinded_condition.json` |  |  |  |  | 1 |
| `blindsight` | `public/data/glossary/entries/rules/blindsight.json` |  |  |  | 4 | 4 |
| `block_and_tackle` | `public/data/glossary/entries/equipment/block_and_tackle.json` |  |  |  | 1 | 1 |
| `bloodied` | `public/data/glossary/entries/rules/bloodied.json` |  |  |  |  | 4 |
| `blue_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/blue.json` |  |  |  | 13 | 3 |
| `bolt` | `public/data/glossary/entries/equipment/bolt.json` |  |  |  | 1 | 1 |
| `bolts_20` | `public/data/glossary/entries/equipment/bolts_20.json` |  |  |  | 1 | 1 |
| `bomb` | `public/data/glossary/entries/equipment/bomb.json` |  |  |  | 1 | 1 |
| `bonus_actions` | `public/data/glossary/entries/rules/bonus_actions.json` |  |  |  |  | 2 |
| `book` | `public/data/glossary/entries/equipment/book.json` |  |  |  | 4 | 4 |
| `book_of_exalted_deeds` | `public/data/glossary/entries/equipment/book_of_exalted_deeds.json` |  |  |  | 15 | 12 |
| `book_of_vile_darkness` | `public/data/glossary/entries/equipment/book_of_vile_darkness.json` |  |  |  | 11 | 11 |
| `boon_of_dimensional_travel` | `public/data/glossary/entries/feats/boon_of_dimensional_travel.json` |  |  |  | 2 | 2 |
| `boon_of_energy_resistance` | `public/data/glossary/entries/feats/boon_of_energy_resistance.json` |  |  |  | 5 | 5 |
| `boon_of_fate` | `public/data/glossary/entries/feats/boon_of_fate.json` |  |  |  | 4 | 4 |
| `boon_of_fortitude` | `public/data/glossary/entries/feats/boon_of_fortitude.json` |  |  |  | 4 | 2 |
| `boon_of_irresistible_offense` | `public/data/glossary/entries/feats/boon_of_irresistible_offense.json` |  |  |  | 1 | 1 |
| `boon_of_recovery` | `public/data/glossary/entries/feats/boon_of_recovery.json` |  |  |  | 8 | 4 |
| `boon_of_skill` | `public/data/glossary/entries/feats/boon_of_skill.json` |  |  |  | 2 | 1 |
| `boon_of_speed` | `public/data/glossary/entries/feats/boon_of_speed.json` |  |  |  | 4 | 4 |
| `boon_of_the_night_spirit` | `public/data/glossary/entries/feats/boon_of_the_night_spirit.json` |  |  |  | 9 | 6 |
| `boon_of_truesight` | `public/data/glossary/entries/feats/boon_of_truesight.json` |  |  |  | 1 | 1 |
| `boots_of_elvenkind` | `public/data/glossary/entries/equipment/boots_of_elvenkind.json` |  |  |  | 2 | 2 |
| `boots_of_levitation` | `public/data/glossary/entries/equipment/boots_of_levitation.json` |  |  |  | 1 | 1 |
| `boots_of_speed` | `public/data/glossary/entries/equipment/boots_of_speed.json` |  |  |  | 5 | 5 |
| `boots_of_striding_and_springing` | `public/data/glossary/entries/equipment/boots_of_striding_and_springing.json` |  |  |  | 3 | 1 |
| `boots_of_the_winterlands` | `public/data/glossary/entries/equipment/boots_of_the_winterlands.json` |  |  |  | 2 | 2 |
| `bowl_of_commanding_water_elementals` | `public/data/glossary/entries/equipment/bowl_of_commanding_water_elementals.json` |  |  |  | 3 | 3 |
| `bracers_of_archery` | `public/data/glossary/entries/equipment/bracers_of_archery.json` |  |  |  | 2 | 2 |
| `bracers_of_defense` | `public/data/glossary/entries/equipment/bracers_of_defense.json` |  |  |  | 2 | 2 |
| `brass_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/brass.json` |  |  |  | 13 | 3 |
| `brazier_of_commanding_fire_elementals` | `public/data/glossary/entries/equipment/brazier_of_commanding_fire_elementals.json` |  |  |  | 3 | 3 |
| `breaking_objects` | `public/data/glossary/entries/rules/breaking_objects.json` |  |  |  | 8 |  |
| `brewer_s_supplies` | `public/data/glossary/entries/equipment/brewer_s_supplies.json` |  |  |  | 1 | 1 |
| `bronze_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/bronze.json` |  |  |  | 13 | 3 |
| `brooch_of_shielding` | `public/data/glossary/entries/equipment/brooch_of_shielding.json` |  |  |  | 3 | 3 |
| `broom_of_flying` | `public/data/glossary/entries/equipment/broom_of_flying.json` |  |  |  | 5 | 2 |
| `brown_mold` | `public/data/glossary/entries/rules/brown_mold.json` |  |  |  | 1 | 1 |
| `bugbear` | `public/data/glossary/entries/races/bugbear.json` |  |  |  | 7 | 5 |
| `bullseye_lantern` | `public/data/glossary/entries/equipment/bullseye_lantern.json` |  |  |  | 2 | 2 |
| `burglar_s_pack` | `public/data/glossary/entries/equipment/burglar_s_pack.json` |  |  |  | 11 | 11 |
| `burning` | `public/data/glossary/entries/rules/burning.json` |  |  |  | 1 | 1 |
| `calligrapher_s_supplies` | `public/data/glossary/entries/equipment/calligrapher_s_supplies.json` |  |  |  | 2 | 2 |
| `caltrops` | `public/data/glossary/entries/equipment/caltrops.json` |  |  |  | 2 | 2 |
| `campaign` | `public/data/glossary/entries/rules/campaign.json` |  |  |  | 2 |  |
| `candle` | `public/data/glossary/entries/equipment/candle.json` |  |  |  | 2 | 2 |
| `candle_of_invocation` | `public/data/glossary/entries/equipment/candle_of_invocation.json` |  |  |  | 5 | 5 |
| `cap_of_water_breathing` | `public/data/glossary/entries/equipment/cap_of_water_breathing.json` |  |  |  | 1 | 1 |
| `cape_of_the_mountebank` | `public/data/glossary/entries/equipment/cape_of_the_mountebank.json` |  |  |  | 3 | 3 |
| `carpenter_s_tools` | `public/data/glossary/entries/equipment/carpenter_s_tools.json` |  |  |  | 9 | 9 |
| `carpet_of_flying_3_ft_5_ft` | `public/data/glossary/entries/equipment/carpet_of_flying_3_ft_5_ft.json` |  |  |  | 2 | 2 |
| `carpet_of_flying_4_ft_6_ft` | `public/data/glossary/entries/equipment/carpet_of_flying_4_ft_6_ft.json` |  |  |  | 2 | 2 |
| `carpet_of_flying_5_ft_7_ft` | `public/data/glossary/entries/equipment/carpet_of_flying_5_ft_7_ft.json` |  |  |  | 2 | 2 |
| `carpet_of_flying_6_ft_9_ft` | `public/data/glossary/entries/equipment/carpet_of_flying_6_ft_9_ft.json` |  |  |  | 2 | 2 |
| `carrion_crawler_mucus` | `public/data/glossary/entries/equipment/carrion_crawler_mucus.json` |  |  |  | 3 | 2 |
| `cartographer_s_tools` | `public/data/glossary/entries/equipment/cartographer_s_tools.json` |  |  |  | 1 | 1 |
| `casting_time_rules` | `public/data/glossary/entries/rules/spells/casting_time_rules.json` |  |  |  |  | 6 |
| `cauldron_of_rebirth` | `public/data/glossary/entries/equipment/cauldron_of_rebirth.json` |  |  |  | 7 | 6 |
| `censer_of_controlling_air_elementals` | `public/data/glossary/entries/equipment/censer_of_controlling_air_elementals.json` |  |  |  | 3 | 3 |
| `centaur` | `public/data/glossary/entries/races/centaur.json` |  |  |  | 7 | 4 |
| `chain` | `public/data/glossary/entries/equipment/chain.json` |  |  |  | 8 | 6 |
| `challenge_rating` | `public/data/glossary/entries/rules/challenge_rating.json` |  |  |  | 11 |  |
| `champion_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/champion.json` |  |  |  |  | 2 |
| `changeling` | `public/data/glossary/entries/races/changeling.json` |  |  |  | 8 | 3 |
| `changes_to_your_speeds` | `public/data/glossary/entries/rules/changes_to_your_speeds.json` |  |  |  |  | 2 |
| `charger` | `public/data/glossary/entries/feats/charger.json` |  |  |  | 3 | 3 |
| `charisma` | `public/data/glossary/entries/rules/charisma.json` |  |  |  |  | 3 |
| `charlatan` | `public/data/glossary/entries/backgrounds/charlatan.json` |  |  |  | 7 | 6 |
| `charmed` | `public/data/glossary/entries/rules/charmed.json` |  |  |  | 2 |  |
| `charmed_condition` | `public/data/glossary/entries/rules/conditions/charmed_condition.json` |  |  |  |  | 1 |
| `chef` | `public/data/glossary/entries/feats/chef.json` |  |  |  | 13 | 7 |
| `chime_of_opening` | `public/data/glossary/entries/equipment/chime_of_opening.json` |  |  |  | 2 | 2 |
| `chthonic_tiefling` | `public/data/glossary/entries/races/tiefling_legacies/chthonic.json` |  |  |  | 6 | 5 |
| `circle_of_the_land_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_land.json` |  |  |  |  | 3 |
| `circle_of_the_moon_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_moon.json` |  |  |  |  | 3 |
| `circle_of_the_sea_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_sea.json` |  |  |  |  | 3 |
| `circle_of_the_stars_subclass` | `public/data/glossary/entries/classes/druid_subclasses/circle_of_the_stars.json` |  |  |  |  | 4 |
| `circlet_of_blasting` | `public/data/glossary/entries/equipment/circlet_of_blasting.json` |  |  |  | 1 | 1 |
| `cleric` | `public/data/glossary/entries/classes/cleric.json` |  |  |  |  | 7 |
| `cleric_spell_list` | `public/data/glossary/entries/classes/cleric_spell_list.json` |  |  |  |  | 2 |
| `climb_speed` | `public/data/glossary/entries/rules/climb_speed.json` |  |  |  | 2 |  |
| `climber_s_kit` | `public/data/glossary/entries/equipment/climber_s_kit.json` |  |  |  | 2 | 2 |
| `climbing` | `public/data/glossary/entries/rules/climbing.json` |  |  |  | 4 |  |
| `cloak_of_arachnida` | `public/data/glossary/entries/equipment/cloak_of_arachnida.json` |  |  |  | 5 | 5 |
| `cloak_of_billowing` | `public/data/glossary/entries/equipment/cloak_of_billowing.json` |  |  |  | 1 | 1 |
| `cloak_of_displacement` | `public/data/glossary/entries/equipment/cloak_of_displacement.json` |  |  |  | 2 | 2 |
| `cloak_of_elvenkind` | `public/data/glossary/entries/equipment/cloak_of_elvenkind.json` |  |  |  | 4 | 4 |
| `cloak_of_invisibility` | `public/data/glossary/entries/equipment/cloak_of_invisibility.json` |  |  |  | 2 | 2 |
| `cloak_of_many_fashions` | `public/data/glossary/entries/equipment/cloak_of_many_fashions.json` |  |  |  | 1 | 1 |
| `cloak_of_protection` | `public/data/glossary/entries/equipment/cloak_of_protection.json` |  |  |  | 1 | 1 |
| `cloak_of_the_bat` | `public/data/glossary/entries/equipment/cloak_of_the_bat.json` |  |  |  | 11 | 6 |
| `cloak_of_the_manta_ray` | `public/data/glossary/entries/equipment/cloak_of_the_manta_ray.json` |  |  |  | 1 | 1 |
| `clockwork_soul_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/clockwork_sorcery.json` |  |  |  |  | 2 |
| `cloud_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/cloud_giant_goliath.json` |  |  |  | 12 | 3 |
| `cobbler_s_tools` | `public/data/glossary/entries/equipment/cobbler_s_tools.json` |  |  |  | 3 | 3 |
| `college_of_dance` | `public/data/glossary/entries/classes/bard_subclasses/college_of_dance.json` |  |  |  |  | 3 |
| `college_of_glamour` | `public/data/glossary/entries/classes/bard_subclasses/college_of_glamour.json` |  |  |  |  | 3 |
| `college_of_lore` | `public/data/glossary/entries/classes/bard_subclasses/college_of_lore.json` |  |  |  |  | 3 |
| `college_of_valor` | `public/data/glossary/entries/classes/bard_subclasses/college_of_valor.json` |  |  |  |  | 3 |
| `commander_s_strike` | `public/data/glossary/entries/rules/commander_s_strike.json` |  |  |  | 3 | 3 |
| `commanding_presence` | `public/data/glossary/entries/rules/commanding_presence.json` |  |  |  | 3 | 3 |
| `concentration` | `public/data/glossary/entries/rules/concentration.json` |  |  |  | 1 | 2 |
| `condition` | `public/data/glossary/entries/rules/condition.json` |  |  |  | 16 |  |
| `conditions` | `public/data/glossary/entries/rules/conditions.json` |  |  |  |  | 4 |
| `conditions_dont_stack` | `public/data/glossary/entries/rules/conditions_dont_stack.json` |  |  |  |  | 2 |
| `cone_area` | `public/data/glossary/entries/rules/cone_area.json` |  |  |  |  | 6 |
| `constitution` | `public/data/glossary/entries/rules/constitution.json` |  |  |  | 2 | 5 |
| `cook_s_utensils` | `public/data/glossary/entries/equipment/cook_s_utensils.json` |  |  |  | 1 | 1 |
| `costume` | `public/data/glossary/entries/equipment/costume.json` |  |  |  | 1 | 1 |
| `cover` | `public/data/glossary/entries/rules/cover.json` |  |  |  | 1 |  |
| `crafter` | `public/data/glossary/entries/feats/crafter.json` |  |  |  | 35 | 33 |
| `crawling` | `public/data/glossary/entries/rules/crawling.json` |  |  |  | 2 |  |
| `creature` | `public/data/glossary/entries/rules/creature.json` |  |  |  | 2 |  |
| `creature_type` | `public/data/glossary/entries/rules/creature_type.json` |  |  |  | 3 |  |
| `criminal` | `public/data/glossary/entries/backgrounds/criminal.json` |  |  |  | 9 | 8 |
| `crossbow_bolt_case` | `public/data/glossary/entries/equipment/crossbow_bolt_case.json` |  |  |  | 1 | 1 |
| `crossbow_expert` | `public/data/glossary/entries/feats/crossbow_expert.json` |  |  |  | 4 | 4 |
| `crowbar` | `public/data/glossary/entries/equipment/crowbar.json` |  |  |  | 1 | 1 |
| `crusher` | `public/data/glossary/entries/feats/crusher.json` |  |  |  | 2 | 2 |
| `crystal_ball` | `public/data/glossary/entries/equipment/crystal_ball.json` |  |  |  | 1 | 1 |
| `crystal_ball_of_mind_reading` | `public/data/glossary/entries/equipment/crystal_ball_of_mind_reading.json` |  |  |  | 4 | 2 |
| `crystal_ball_of_telepathy` | `public/data/glossary/entries/equipment/crystal_ball_of_telepathy.json` |  |  |  | 5 | 2 |
| `crystal_ball_of_true_seeing` | `public/data/glossary/entries/equipment/crystal_ball_of_true_seeing.json` |  |  |  | 2 | 2 |
| `cube_area` | `public/data/glossary/entries/rules/cube_area.json` |  |  |  |  | 6 |
| `cube_of_force` | `public/data/glossary/entries/equipment/cube_of_force.json` |  |  |  | 6 | 6 |
| `cube_of_summoning` | `public/data/glossary/entries/equipment/cube_of_summoning.json` |  |  |  | 8 | 8 |
| `cubic_gate` | `public/data/glossary/entries/equipment/cubic_gate.json` |  |  |  | 3 | 3 |
| `curse` | `public/data/glossary/entries/rules/curse.json` |  |  |  |  | 3 |
| `cylinder_area` | `public/data/glossary/entries/rules/cylinder_area.json` |  |  |  |  | 6 |
| `d20_test` | `public/data/glossary/entries/rules/d20_test.json` |  |  |  | 6 |  |
| `daern_s_instant_fortress` | `public/data/glossary/entries/equipment/daern_s_instant_fortress.json` |  |  |  | 8 | 7 |
| `dagger_of_venom` | `public/data/glossary/entries/equipment/dagger_of_venom.json` |  |  |  | 2 | 2 |
| `damage` | `public/data/glossary/entries/rules/damage.json` |  |  |  | 2 |  |
| `damage_threshold` | `public/data/glossary/entries/rules/damage_threshold.json` |  |  |  | 3 |  |
| `dark_shard_amulet` | `public/data/glossary/entries/equipment/dark_shard_amulet.json` |  |  |  | 4 | 4 |
| `darkness` | `public/data/glossary/entries/rules/darkness.json` |  |  |  | 2 |  |
| `darkvision` | `public/data/glossary/entries/rules/darkvision.json` |  |  |  | 5 | 3 |
| `dash` | `public/data/glossary/entries/rules/dash.json` |  |  |  | 7 |  |
| `dash_action` | `public/data/glossary/entries/rules/dash_action.json` |  |  |  | 5 | 5 |
| `dead` | `public/data/glossary/entries/rules/dead.json` |  |  |  | 6 |  |
| `dead_magic_zone` | `public/data/glossary/entries/rules/dead_magic_zone.json` |  |  |  | 1 | 1 |
| `death_saving_throw` | `public/data/glossary/entries/rules/death_saving_throw.json` |  |  |  | 4 |  |
| `decanter_of_endless_water` | `public/data/glossary/entries/equipment/decanter_of_endless_water.json` |  |  |  | 5 | 3 |
| `deck_of_illusions` | `public/data/glossary/entries/equipment/deck_of_illusions.json` |  |  |  | 5 | 4 |
| `deck_of_many_things` | `public/data/glossary/entries/equipment/deck_of_many_things.json` |  |  |  | 22 | 14 |
| `deep_gnome` | `public/data/glossary/entries/races/deep_gnome.json` |  |  |  | 7 | 5 |
| `deep_water` | `public/data/glossary/entries/rules/deep_water.json` |  |  |  | 1 | 1 |
| `defense` | `public/data/glossary/entries/feats/defense.json` |  |  |  | 1 | 1 |
| `defensive_duelist` | `public/data/glossary/entries/feats/defensive_duelist.json` |  |  |  | 3 | 3 |
| `dehydration` | `public/data/glossary/entries/rules/dehydration.json` |  |  |  | 2 | 1 |
| `demonomicon_of_iggwilv` | `public/data/glossary/entries/equipment/demonomicon_of_iggwilv.json` |  |  |  | 18 | 12 |
| `devil_s_sight` | `public/data/glossary/entries/rules/devil_s_sight.json` |  |  |  | 2 | 2 |
| `dexterity` | `public/data/glossary/entries/rules/dexterity.json` |  |  |  |  | 3 |
| `difficulty_class` | `public/data/glossary/entries/rules/difficulty_class.json` |  |  |  | 2 |  |
| `dim_light` | `public/data/glossary/entries/rules/dim_light.json` |  |  |  | 2 |  |
| `dimensional_shackles` | `public/data/glossary/entries/equipment/dimensional_shackles.json` |  |  |  | 4 | 3 |
| `diplomat_s_pack` | `public/data/glossary/entries/equipment/diplomat_s_pack.json` |  |  |  | 11 | 11 |
| `disadvantage` | `public/data/glossary/entries/rules/disadvantage.json` |  |  |  | 3 |  |
| `disengage` | `public/data/glossary/entries/rules/disengage.json` |  |  |  | 2 |  |
| `disengage_action` | `public/data/glossary/entries/rules/disengage_action.json` |  |  |  | 4 | 4 |
| `disguise_kit` | `public/data/glossary/entries/equipment/disguise_kit.json` |  |  |  | 1 | 1 |
| `distracting_strike` | `public/data/glossary/entries/rules/distracting_strike.json` |  |  |  | 1 | 1 |
| `diviner_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/diviner.json` |  |  |  |  | 3 |
| `dodge` | `public/data/glossary/entries/rules/dodge.json` |  |  |  | 5 |  |
| `dodge_action` | `public/data/glossary/entries/rules/dodge_action.json` |  |  |  | 5 | 5 |
| `draconblood_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/draconblood.json` |  |  |  | 13 | 5 |
| `draconic_sorcery_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/draconic_sorcery.json` |  |  |  |  | 2 |
| `driftglobe` | `public/data/glossary/entries/equipment/driftglobe.json` |  |  |  | 3 | 3 |
| `drow` | `public/data/glossary/entries/races/elf_lineages/drow.json` |  |  |  | 10 | 5 |
| `druid` | `public/data/glossary/entries/classes/druid.json` |  |  |  |  | 9 |
| `druid_spell_list` | `public/data/glossary/entries/classes/druid_spell_list.json` |  |  |  |  | 2 |
| `druidic_warrior` | `public/data/glossary/entries/feats/druidic_warrior.json` |  |  |  | 2 | 2 |
| `dual_wielder` | `public/data/glossary/entries/feats/dual_wielder.json` |  |  |  | 2 | 2 |
| `duergar` | `public/data/glossary/entries/races/duergar.json` |  |  |  | 7 | 4 |
| `dungeoneer_s_pack` | `public/data/glossary/entries/equipment/dungeoneer_s_pack.json` |  |  |  | 9 | 9 |
| `durable` | `public/data/glossary/entries/feats/durable.json` |  |  |  | 5 | 5 |
| `duration_condition` | `public/data/glossary/entries/rules/duration_condition.json` |  |  |  |  | 1 |
| `dust_of_disappearance` | `public/data/glossary/entries/equipment/dust_of_disappearance.json` |  |  |  | 4 | 3 |
| `dust_of_dryness` | `public/data/glossary/entries/equipment/dust_of_dryness.json` |  |  |  | 4 | 2 |
| `dust_of_sneezing_and_choking` | `public/data/glossary/entries/equipment/dust_of_sneezing_and_choking.json` |  |  |  | 6 | 6 |
| `dynamite_stick` | `public/data/glossary/entries/equipment/dynamite_stick.json` |  |  |  | 1 | 1 |
| `ear_horn_of_hearing` | `public/data/glossary/entries/equipment/ear_horn_of_hearing.json` |  |  |  | 1 | 1 |
| `earth_genasi` | `public/data/glossary/entries/races/earth_genasi.json` |  |  |  | 6 | 4 |
| `efreeti_bottle` | `public/data/glossary/entries/equipment/efreeti_bottle.json` |  |  |  | 2 | 2 |
| `eldritch_knight_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/eldritch_knight.json` |  |  |  |  | 3 |
| `eldritch_mind` | `public/data/glossary/entries/rules/eldritch_mind.json` |  |  |  | 1 | 1 |
| `eldritch_smite` | `public/data/glossary/entries/rules/eldritch_smite.json` |  |  |  | 1 | 1 |
| `elemental_adept` | `public/data/glossary/entries/feats/elemental_adept.json` |  |  |  | 1 | 1 |
| `elemental_gem_blue_sapphire` | `public/data/glossary/entries/equipment/elemental_gem_blue_sapphire.json` |  |  |  | 3 | 3 |
| `elemental_gem_emerald` | `public/data/glossary/entries/equipment/elemental_gem_emerald.json` |  |  |  | 3 | 3 |
| `elemental_gem_red_corundum` | `public/data/glossary/entries/equipment/elemental_gem_red_corundum.json` |  |  |  | 3 | 3 |
| `elemental_gem_yellow_diamond` | `public/data/glossary/entries/equipment/elemental_gem_yellow_diamond.json` |  |  |  | 3 | 3 |
| `elixir_of_health` | `public/data/glossary/entries/equipment/elixir_of_health.json` |  |  |  | 4 | 4 |
| `emanation_area` | `public/data/glossary/entries/rules/emanation_area.json` |  |  |  |  | 6 |
| `emblem` | `public/data/glossary/entries/equipment/emblem.json` |  |  |  | 1 | 1 |
| `enspelled_staff_cantrip` | `public/data/glossary/entries/equipment/enspelled_staff_cantrip.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_1` | `public/data/glossary/entries/equipment/enspelled_staff_level_1.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_2` | `public/data/glossary/entries/equipment/enspelled_staff_level_2.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_3` | `public/data/glossary/entries/equipment/enspelled_staff_level_3.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_4` | `public/data/glossary/entries/equipment/enspelled_staff_level_4.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_5` | `public/data/glossary/entries/equipment/enspelled_staff_level_5.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_6` | `public/data/glossary/entries/equipment/enspelled_staff_level_6.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_7` | `public/data/glossary/entries/equipment/enspelled_staff_level_7.json` |  |  |  | 1 | 1 |
| `enspelled_staff_level_8` | `public/data/glossary/entries/equipment/enspelled_staff_level_8.json` |  |  |  | 1 | 1 |
| `entertainer` | `public/data/glossary/entries/backgrounds/entertainer.json` |  |  |  | 9 | 8 |
| `entertainer_s_pack` | `public/data/glossary/entries/equipment/entertainer_s_pack.json` |  |  |  | 10 | 10 |
| `equipment_proficiencies` | `public/data/glossary/entries/rules/equipment_proficiencies.json` |  |  |  |  | 4 |
| `ersatz_eye` | `public/data/glossary/entries/equipment/ersatz_eye.json` |  |  |  | 1 | 1 |
| `escape_a_grapple` | `public/data/glossary/entries/rules/escape_a_grapple.json` |  |  |  | 7 |  |
| `essence_of_ether` | `public/data/glossary/entries/equipment/essence_of_ether.json` |  |  |  | 3 | 2 |
| `evasive_footwork` | `public/data/glossary/entries/rules/evasive_footwork.json` |  |  |  | 2 | 2 |
| `eversmoking_bottle` | `public/data/glossary/entries/equipment/eversmoking_bottle.json` |  |  |  | 5 | 4 |
| `evoker_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/evoker.json` |  |  |  |  | 4 |
| `exhaustion` | `public/data/glossary/entries/rules/exhaustion.json` |  |  |  | 2 |  |
| `exhaustion_condition` | `public/data/glossary/entries/rules/conditions/exhaustion_condition.json` |  |  |  |  | 1 |
| `expertise` | `public/data/glossary/entries/rules/expertise.json` |  |  |  | 2 |  |
| `explorer_s_pack` | `public/data/glossary/entries/equipment/explorer_s_pack.json` |  |  |  | 8 | 8 |
| `extended_spell` | `public/data/glossary/entries/rules/extended_spell.json` |  |  |  | 1 | 1 |
| `extreme_cold` | `public/data/glossary/entries/rules/extreme_cold.json` |  |  |  | 3 | 3 |
| `extreme_heat` | `public/data/glossary/entries/rules/extreme_heat.json` |  |  |  | 4 | 4 |
| `eye_of_vecna` | `public/data/glossary/entries/equipment/eye_of_vecna.json` |  |  |  | 10 | 9 |
| `eyes_of_charming` | `public/data/glossary/entries/equipment/eyes_of_charming.json` |  |  |  | 1 | 1 |
| `eyes_of_minute_seeing` | `public/data/glossary/entries/equipment/eyes_of_minute_seeing.json` |  |  |  | 3 | 3 |
| `eyes_of_the_eagle` | `public/data/glossary/entries/equipment/eyes_of_the_eagle.json` |  |  |  | 2 | 2 |
| `fairy` | `public/data/glossary/entries/races/fairy.json` |  |  |  | 5 | 3 |
| `fallen_aasimar` | `public/data/glossary/entries/races/aasimar_variants/fallen.json` |  |  |  | 17 | 5 |
| `falling` | `public/data/glossary/entries/rules/falling.json` |  |  |  | 4 | 4 |
| `farmer` | `public/data/glossary/entries/backgrounds/farmer.json` |  |  |  | 9 | 8 |
| `feinting_attack` | `public/data/glossary/entries/rules/feinting_attack.json` |  |  |  | 2 | 2 |
| `fey_touched` | `public/data/glossary/entries/feats/fey_touched.json` |  |  |  | 2 | 2 |
| `fey_wanderer_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/fey_wanderer.json` |  |  |  |  | 3 |
| `fiend_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/fiend.json` |  |  |  |  | 2 |
| `fiendish_vigor` | `public/data/glossary/entries/rules/fiendish_vigor.json` |  |  |  | 2 | 2 |
| `fighter` | `public/data/glossary/entries/classes/fighter.json` |  |  |  |  | 9 |
| `figurine_of_wondrous_power_bronze_griffon` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_bronze_griffon.json` |  |  |  | 6 | 5 |
| `figurine_of_wondrous_power_ebony_fly` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_ebony_fly.json` |  |  |  | 6 | 5 |
| `figurine_of_wondrous_power_golden_lions` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_golden_lions.json` |  |  |  | 6 | 5 |
| `figurine_of_wondrous_power_ivory_goats` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_ivory_goats.json` |  |  |  | 13 | 10 |
| `figurine_of_wondrous_power_marble_elephant` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_marble_elephant.json` |  |  |  | 6 | 5 |
| `figurine_of_wondrous_power_obsidian_steed` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_obsidian_steed.json` |  |  |  | 6 | 5 |
| `figurine_of_wondrous_power_onyx_dog` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_onyx_dog.json` |  |  |  | 7 | 6 |
| `figurine_of_wondrous_power_serpentine_owl` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_serpentine_owl.json` |  |  |  | 6 | 5 |
| `figurine_of_wondrous_power_silver_raven` | `public/data/glossary/entries/equipment/figurine_of_wondrous_power_silver_raven.json` |  |  |  | 7 | 6 |
| `firbolg` | `public/data/glossary/entries/races/firbolg.json` |  |  |  | 8 | 4 |
| `fire_genasi` | `public/data/glossary/entries/races/fire_genasi.json` |  |  |  | 5 | 4 |
| `fire_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/fire_giant_goliath.json` |  |  |  | 11 | 2 |
| `fireball_fungus` | `public/data/glossary/entries/rules/fireball_fungus.json` |  |  |  | 4 | 4 |
| `flying` | `public/data/glossary/entries/rules/flying.json` |  |  |  | 5 |  |
| `folding_boat` | `public/data/glossary/entries/equipment/folding_boat.json` |  |  |  | 4 | 4 |
| `forest_gnome` | `public/data/glossary/entries/races/gnome_subraces/forest_gnome.json` |  |  |  | 8 | 3 |
| `forgeborn_human` | `public/data/glossary/entries/races/dragonmark_variants/forgeborn_human.json` |  |  |  | 14 | 3 |
| `fragmentation_grenade` | `public/data/glossary/entries/equipment/fragmentation_grenade.json` |  |  |  | 1 | 1 |
| `friendly_attitude` | `public/data/glossary/entries/rules/friendly_attitude.json` |  |  |  | 2 |  |
| `frightened` | `public/data/glossary/entries/rules/frightened.json` |  |  |  | 1 |  |
| `frightened_condition` | `public/data/glossary/entries/rules/conditions/frightened_condition.json` |  |  |  |  | 1 |
| `frigid_water` | `public/data/glossary/entries/rules/frigid_water.json` |  |  |  | 3 | 3 |
| `frost_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/frost_giant_goliath.json` |  |  |  | 12 | 3 |
| `gaining_spells` | `public/data/glossary/entries/rules/spells/gaining_spells.json` |  |  |  |  | 3 |
| `gaze_of_two_minds` | `public/data/glossary/entries/rules/gaze_of_two_minds.json` |  |  |  | 2 | 1 |
| `gem_of_brightness` | `public/data/glossary/entries/equipment/gem_of_brightness.json` |  |  |  | 7 | 6 |
| `gem_of_seeing` | `public/data/glossary/entries/equipment/gem_of_seeing.json` |  |  |  | 2 | 2 |
| `giff` | `public/data/glossary/entries/races/giff.json` |  |  |  | 5 | 2 |
| `gift_of_the_depths` | `public/data/glossary/entries/rules/gift_of_the_depths.json` |  |  |  | 4 | 4 |
| `gift_of_the_protectors` | `public/data/glossary/entries/rules/gift_of_the_protectors.json` |  |  |  | 4 | 4 |
| `githyanki` | `public/data/glossary/entries/races/githyanki.json` |  |  |  | 9 | 3 |
| `githzerai` | `public/data/glossary/entries/races/githzerai.json` |  |  |  | 11 | 3 |
| `glamoured_studded_leather` | `public/data/glossary/entries/equipment/glamoured_studded_leather.json` |  |  |  | 2 | 2 |
| `glassblower_s_tools` | `public/data/glossary/entries/equipment/glassblower_s_tools.json` |  |  |  | 4 | 4 |
| `gloom_stalker_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/gloom_stalker.json` |  |  |  |  | 3 |
| `glossary_conventions` | `public/data/glossary/entries/rules/glossary_conventions.json` |  |  |  |  | 3 |
| `gloves_of_missile_snaring` | `public/data/glossary/entries/equipment/gloves_of_missile_snaring.json` |  |  |  | 1 | 1 |
| `gloves_of_swimming_and_climbing` | `public/data/glossary/entries/equipment/gloves_of_swimming_and_climbing.json` |  |  |  | 1 | 1 |
| `gloves_of_thievery` | `public/data/glossary/entries/equipment/gloves_of_thievery.json` |  |  |  | 1 | 1 |
| `goading_attack` | `public/data/glossary/entries/rules/goading_attack.json` |  |  |  | 1 | 1 |
| `goggles_of_night` | `public/data/glossary/entries/equipment/goggles_of_night.json` |  |  |  | 2 | 1 |
| `grappled` | `public/data/glossary/entries/rules/grappled.json` |  |  |  | 2 |  |
| `grappled_condition` | `public/data/glossary/entries/rules/conditions/grappled_condition.json` |  |  |  |  | 1 |
| `grappler` | `public/data/glossary/entries/feats/grappler.json` |  |  |  | 5 | 4 |
| `grappling` | `public/data/glossary/entries/rules/grappling.json` |  |  |  | 10 |  |
| `grappling_hook` | `public/data/glossary/entries/equipment/grappling_hook.json` |  |  |  | 2 | 2 |
| `great_old_one_patron_subclass` | `public/data/glossary/entries/classes/warlock_subclasses/great_old_one.json` |  |  |  |  | 2 |
| `great_weapon_master` | `public/data/glossary/entries/feats/great_weapon_master.json` |  |  |  | 5 | 5 |
| `green_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/green.json` |  |  |  | 13 | 3 |
| `green_slime` | `public/data/glossary/entries/rules/green_slime.json` |  |  |  | 1 | 1 |
| `guard` | `public/data/glossary/entries/backgrounds/guard.json` |  |  |  | 12 | 11 |
| `guardian_human` | `public/data/glossary/entries/races/dragonmark_variants/guardian_human.json` |  |  |  | 15 | 3 |
| `guide` | `public/data/glossary/entries/backgrounds/guide.json` |  |  |  | 11 | 10 |
| `gunpowder_keg` | `public/data/glossary/entries/equipment/gunpowder_keg.json` |  |  |  | 1 | 1 |
| `gunpowder_powder_horn` | `public/data/glossary/entries/equipment/gunpowder_powder_horn.json` |  |  |  | 1 | 1 |
| `h` | `public/data/glossary/entries/rules/h.json` |  |  |  | 1 | 1 |
| `hadozee` | `public/data/glossary/entries/races/hadozee.json` |  |  |  | 6 | 1 |
| `hag_eye` | `public/data/glossary/entries/equipment/hag_eye.json` |  |  |  | 4 | 4 |
| `half_cover` | `public/data/glossary/entries/rules/half_cover.json` |  |  |  | 3 | 5 |
| `half_elf` | `public/data/glossary/entries/races/half_elf.json` |  |  |  | 3 | 3 |
| `half_elf_aquatic` | `public/data/glossary/entries/races/half_elf_variants/aquatic.json` |  |  |  | 9 | 4 |
| `half_elf_drow` | `public/data/glossary/entries/races/half_elf_variants/drow.json` |  |  |  | 13 | 4 |
| `half_elf_high` | `public/data/glossary/entries/races/half_elf_variants/high.json` |  |  |  | 9 | 4 |
| `half_elf_wood` | `public/data/glossary/entries/races/half_elf_variants/wood.json` |  |  |  | 9 | 4 |
| `half_orc` | `public/data/glossary/entries/races/half_orc.json` |  |  |  | 3 | 3 |
| `hand_of_vecna` | `public/data/glossary/entries/equipment/hand_of_vecna.json` |  |  |  | 9 | 8 |
| `harengon` | `public/data/glossary/entries/races/harengon.json` |  |  |  | 10 | 3 |
| `hat_of_disguise` | `public/data/glossary/entries/equipment/hat_of_disguise.json` |  |  |  | 1 | 1 |
| `hat_of_many_spells` | `public/data/glossary/entries/equipment/hat_of_many_spells.json` |  |  |  | 24 | 23 |
| `hat_of_vermin` | `public/data/glossary/entries/equipment/hat_of_vermin.json` |  |  |  | 3 | 3 |
| `hat_of_wizardry` | `public/data/glossary/entries/equipment/hat_of_wizardry.json` |  |  |  | 4 | 4 |
| `healer` | `public/data/glossary/entries/feats/healer.json` |  |  |  | 6 | 5 |
| `healer_s_kit` | `public/data/glossary/entries/equipment/healer_s_kit.json` |  |  |  | 4 | 4 |
| `healing` | `public/data/glossary/entries/rules/healing.json` |  |  |  | 2 |  |
| `hearthkeeper_halfling` | `public/data/glossary/entries/races/dragonmark_variants/hearthkeeper_halfling.json` |  |  |  | 17 | 3 |
| `heavily_obscured` | `public/data/glossary/entries/rules/heavily_obscured.json` |  |  |  | 2 |  |
| `heavy_armor_master` | `public/data/glossary/entries/feats/heavy_armor_master.json` |  |  |  | 1 | 1 |
| `heavy_precipitation` | `public/data/glossary/entries/rules/heavy_precipitation.json` |  |  |  | 3 | 3 |
| `heightened_spell` | `public/data/glossary/entries/rules/heightened_spell.json` |  |  |  | 1 | 1 |
| `helm_of_brilliance` | `public/data/glossary/entries/equipment/helm_of_brilliance.json` |  |  |  | 13 | 10 |
| `helm_of_comprehending_languages` | `public/data/glossary/entries/equipment/helm_of_comprehending_languages.json` |  |  |  | 1 | 1 |
| `helm_of_telepathy` | `public/data/glossary/entries/equipment/helm_of_telepathy.json` |  |  |  | 2 | 2 |
| `helm_of_teleportation` | `public/data/glossary/entries/equipment/helm_of_teleportation.json` |  |  |  | 1 | 1 |
| `help` | `public/data/glossary/entries/rules/help.json` |  |  |  | 2 |  |
| `help_action` | `public/data/glossary/entries/rules/help_action.json` |  |  |  | 2 | 4 |
| `herbalism_gathering` | `public/data/glossary/entries/rules/crafting/herbalism_gathering.json` |  |  |  |  | 2 |
| `herbalism_kit` | `public/data/glossary/entries/equipment/herbalism_kit.json` |  |  |  | 4 | 4 |
| `hermit` | `public/data/glossary/entries/backgrounds/hermit.json` |  |  |  | 11 | 10 |
| `heroic_inspiration` | `public/data/glossary/entries/rules/heroic_inspiration.json` |  |  |  | 3 |  |
| `heward_s_handy_haversack` | `public/data/glossary/entries/equipment/heward_s_handy_haversack.json` |  |  |  | 5 | 5 |
| `heward_s_handy_spice_pouch` | `public/data/glossary/entries/equipment/heward_s_handy_spice_pouch.json` |  |  |  | 1 | 1 |
| `hide` | `public/data/glossary/entries/rules/hide.json` |  |  |  | 6 |  |
| `hide_action` | `public/data/glossary/entries/rules/hide_action.json` |  |  |  | 5 | 5 |
| `high_elf` | `public/data/glossary/entries/races/elf_lineages/high_elf.json` |  |  |  | 5 | 5 |
| `hill_dwarf` | `public/data/glossary/entries/races/hill_dwarf.json` |  |  |  | 13 | 3 |
| `hill_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/hill_giant_goliath.json` |  |  |  | 11 | 2 |
| `hit_point_dice` | `public/data/glossary/entries/rules/hit_point_dice.json` |  |  |  | 5 |  |
| `hobgoblin` | `public/data/glossary/entries/races/hobgoblin.json` |  |  |  | 15 | 4 |
| `holy_water` | `public/data/glossary/entries/equipment/holy_water.json` |  |  |  | 2 | 2 |
| `hooded_lantern` | `public/data/glossary/entries/equipment/hooded_lantern.json` |  |  |  | 4 | 3 |
| `horn_of_blasting` | `public/data/glossary/entries/equipment/horn_of_blasting.json` |  |  |  | 5 | 3 |
| `horn_of_silent_alarm` | `public/data/glossary/entries/equipment/horn_of_silent_alarm.json` |  |  |  | 1 | 1 |
| `horn_of_valhalla_brass` | `public/data/glossary/entries/equipment/horn_of_valhalla_brass.json` |  |  |  | 7 | 7 |
| `horn_of_valhalla_bronze` | `public/data/glossary/entries/equipment/horn_of_valhalla_bronze.json` |  |  |  | 6 | 6 |
| `horn_of_valhalla_iron` | `public/data/glossary/entries/equipment/horn_of_valhalla_iron.json` |  |  |  | 7 | 7 |
| `horn_of_valhalla_silver` | `public/data/glossary/entries/equipment/horn_of_valhalla_silver.json` |  |  |  | 6 | 6 |
| `horseshoes_of_a_zephyr` | `public/data/glossary/entries/equipment/horseshoes_of_a_zephyr.json` |  |  |  | 4 | 3 |
| `horseshoes_of_speed` | `public/data/glossary/entries/equipment/horseshoes_of_speed.json` |  |  |  | 3 | 2 |
| `hostile_attitude` | `public/data/glossary/entries/rules/hostile_attitude.json` |  |  |  | 2 |  |
| `hover` | `public/data/glossary/entries/rules/hover.json` |  |  |  | 2 |  |
| `human` | `public/data/glossary/entries/races/human.json` |  |  |  | 4 | 4 |
| `hunter_subclass` | `public/data/glossary/entries/classes/ranger_subclasses/hunter.json` |  |  |  |  | 2 |
| `hunting_trap` | `public/data/glossary/entries/equipment/hunting_trap.json` |  |  |  | 3 | 3 |
| `illusionist_subclass` | `public/data/glossary/entries/classes/wizard_subclasses/illusionist.json` |  |  |  |  | 3 |
| `immovable_rod` | `public/data/glossary/entries/equipment/immovable_rod.json` |  |  |  | 4 | 2 |
| `immunity` | `public/data/glossary/entries/rules/immunity.json` |  |  |  | 4 |  |
| `improvised_damage` | `public/data/glossary/entries/rules/improvised_damage.json` |  |  |  | 1 | 1 |
| `improvised_weapons` | `public/data/glossary/entries/rules/improvised_weapons.json` |  |  |  | 1 |  |
| `improvising_an_action` | `public/data/glossary/entries/rules/improvising_an_action.json` |  |  |  | 1 |  |
| `incapacitated` | `public/data/glossary/entries/rules/incapacitated.json` |  |  |  | 5 |  |
| `incapacitated_condition` | `public/data/glossary/entries/rules/conditions/incapacitated_condition.json` |  |  |  |  | 4 |
| `indifferent_attitude` | `public/data/glossary/entries/rules/indifferent_attitude.json` |  |  |  | 2 |  |
| `inferno` | `public/data/glossary/entries/rules/inferno.json` |  |  |  | 1 | 1 |
| `influence` | `public/data/glossary/entries/rules/influence.json` |  |  |  | 5 |  |
| `influence_action` | `public/data/glossary/entries/rules/influence_action.json` |  |  |  | 1 | 5 |
| `initiative` | `public/data/glossary/entries/rules/initiative.json` |  |  |  | 2 |  |
| `ink_pen` | `public/data/glossary/entries/equipment/ink_pen.json` |  |  |  | 1 | 1 |
| `inspiring_leader` | `public/data/glossary/entries/feats/inspiring_leader.json` |  |  |  | 3 | 3 |
| `instrument_of_illusions` | `public/data/glossary/entries/equipment/instrument_of_illusions.json` |  |  |  | 4 | 3 |
| `instrument_of_scribing` | `public/data/glossary/entries/equipment/instrument_of_scribing.json` |  |  |  | 4 | 4 |
| `instrument_of_the_bards_anstruth_harp` | `public/data/glossary/entries/equipment/instrument_of_the_bards_anstruth_harp.json` |  |  |  | 7 | 7 |
| `instrument_of_the_bards_canaith_mandolin` | `public/data/glossary/entries/equipment/instrument_of_the_bards_canaith_mandolin.json` |  |  |  | 7 | 7 |
| `instrument_of_the_bards_cli_lyre` | `public/data/glossary/entries/equipment/instrument_of_the_bards_cli_lyre.json` |  |  |  | 9 | 8 |
| `instrument_of_the_bards_doss_lute` | `public/data/glossary/entries/equipment/instrument_of_the_bards_doss_lute.json` |  |  |  | 9 | 8 |
| `instrument_of_the_bards_fochlucan_bandore` | `public/data/glossary/entries/equipment/instrument_of_the_bards_fochlucan_bandore.json` |  |  |  | 8 | 8 |
| `instrument_of_the_bards_mac_fuirmidh_cittern` | `public/data/glossary/entries/equipment/instrument_of_the_bards_mac_fuirmidh_cittern.json` |  |  |  | 7 | 7 |
| `instrument_of_the_bards_ollamh_harp` | `public/data/glossary/entries/equipment/instrument_of_the_bards_ollamh_harp.json` |  |  |  | 7 | 7 |
| `interception` | `public/data/glossary/entries/feats/interception.json` |  |  |  | 4 | 3 |
| `investment_of_the_chain_master` | `public/data/glossary/entries/rules/investment_of_the_chain_master.json` |  |  |  | 7 | 7 |
| `invisible` | `public/data/glossary/entries/rules/invisible.json` |  |  |  | 5 |  |
| `invisible_condition` | `public/data/glossary/entries/rules/conditions/invisible_condition.json` |  |  |  |  | 1 |
| `ioun_stone_absorption` | `public/data/glossary/entries/equipment/ioun_stone_absorption.json` |  |  |  | 1 | 1 |
| `ioun_stone_awareness` | `public/data/glossary/entries/equipment/ioun_stone_awareness.json` |  |  |  | 3 | 3 |
| `ioun_stone_greater_absorption` | `public/data/glossary/entries/equipment/ioun_stone_greater_absorption.json` |  |  |  | 1 | 1 |
| `ioun_stone_mastery` | `public/data/glossary/entries/equipment/ioun_stone_mastery.json` |  |  |  | 1 | 1 |
| `ioun_stone_protection` | `public/data/glossary/entries/equipment/ioun_stone_protection.json` |  |  |  | 1 | 1 |
| `ioun_stone_regeneration` | `public/data/glossary/entries/equipment/ioun_stone_regeneration.json` |  |  |  | 2 | 2 |
| `iron_bands_of_bilarro` | `public/data/glossary/entries/equipment/iron_bands_of_bilarro.json` |  |  |  | 7 | 5 |
| `iron_flask` | `public/data/glossary/entries/equipment/iron_flask.json` |  |  |  | 4 | 3 |
| `iron_spike` | `public/data/glossary/entries/equipment/iron_spike.json` |  |  |  | 4 | 4 |
| `iron_spikes` | `public/data/glossary/entries/equipment/iron_spikes.json` |  |  |  | 4 | 4 |
| `javelin_of_lightning` | `public/data/glossary/entries/equipment/javelin_of_lightning.json` |  |  |  | 2 | 1 |
| `jeweler_s_tools` | `public/data/glossary/entries/equipment/jeweler_s_tools.json` |  |  |  | 2 | 2 |
| `jumping` | `public/data/glossary/entries/rules/jumping.json` |  |  |  | 4 |  |
| `kalashtar` | `public/data/glossary/entries/races/kalashtar.json` |  |  |  | 5 | 2 |
| `keen_mind` | `public/data/glossary/entries/feats/keen_mind.json` |  |  |  | 8 | 8 |
| `kender` | `public/data/glossary/entries/races/kender.json` |  |  |  | 14 | 2 |
| `kenku` | `public/data/glossary/entries/races/kenku.json` |  |  |  | 9 | 4 |
| `keoghtom_s_ointment` | `public/data/glossary/entries/equipment/keoghtom_s_ointment.json` |  |  |  | 3 | 3 |
| `knocking_out_a_creature` | `public/data/glossary/entries/rules/knocking_out_a_creature.json` |  |  |  | 6 |  |
| `kobold` | `public/data/glossary/entries/races/kobold.json` |  |  |  | 6 | 4 |
| `l` | `public/data/glossary/entries/rules/l.json` |  |  |  | 7 | 4 |
| `lamp` | `public/data/glossary/entries/equipment/lamp.json` |  |  |  | 3 | 3 |
| `lantern_of_revealing` | `public/data/glossary/entries/equipment/lantern_of_revealing.json` |  |  |  | 6 | 4 |
| `ld` | `public/data/glossary/entries/rules/ld.json` |  |  |  | 2 | 2 |
| `leatherworker_s_tools` | `public/data/glossary/entries/equipment/leatherworker_s_tools.json` |  |  |  | 12 | 12 |
| `leonin` | `public/data/glossary/entries/races/leonin.json` |  |  |  | 16 | 2 |
| `life_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/life_domain.json` |  |  |  |  | 4 |
| `lifedrinker` | `public/data/glossary/entries/rules/lifedrinker.json` |  |  |  | 3 | 3 |
| `light_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/light_domain.json` |  |  |  |  | 3 |
| `light_rules` | `public/data/glossary/entries/rules/light.json` |  |  |  |  | 5 |
| `lightfoot_halfling` | `public/data/glossary/entries/races/halfling_subraces/lightfoot.json` |  |  |  | 4 | 3 |
| `lightly_obscured` | `public/data/glossary/entries/rules/lightly_obscured.json` |  |  |  | 4 |  |
| `line_area` | `public/data/glossary/entries/rules/line_area.json` |  |  |  |  | 6 |
| `lizardfolk` | `public/data/glossary/entries/races/lizardfolk.json` |  |  |  | 6 | 4 |
| `lock` | `public/data/glossary/entries/equipment/lock.json` |  |  |  | 2 | 2 |
| `lock_of_trickery` | `public/data/glossary/entries/equipment/lock_of_trickery.json` |  |  |  | 2 | 2 |
| `lockpicking` | `public/data/glossary/entries/rules/lockpicking.json` |  |  |  |  | 3 |
| `lolth_s_sting` | `public/data/glossary/entries/equipment/lolth_s_sting.json` |  |  |  | 3 | 2 |
| `long_jump` | `public/data/glossary/entries/rules/long_jump.json` |  |  |  | 4 |  |
| `long_rest` | `public/data/glossary/entries/rules/long_rest.json` |  |  |  | 7 |  |
| `longtooth_shifter` | `public/data/glossary/entries/races/shifter_variants/longtooth.json` |  |  |  | 11 | 2 |
| `lotusden_halfling` | `public/data/glossary/entries/races/halfling_subraces/lotusden_halfling.json` |  |  |  | 8 | 4 |
| `loxodon` | `public/data/glossary/entries/races/loxodon.json` |  |  |  | 8 | 3 |
| `lucky` | `public/data/glossary/entries/feats/lucky.json` |  |  |  | 5 | 5 |
| `lunging_attack` | `public/data/glossary/entries/rules/lunging_attack.json` |  |  |  | 3 | 3 |
| `lute_of_thunderous_thumping` | `public/data/glossary/entries/equipment/lute_of_thunderous_thumping.json` |  |  |  | 2 | 1 |
| `mace_of_disruption` | `public/data/glossary/entries/equipment/mace_of_disruption.json` |  |  |  | 4 | 4 |
| `mace_of_smiting` | `public/data/glossary/entries/equipment/mace_of_smiting.json` |  |  |  | 1 | 1 |
| `mace_of_terror` | `public/data/glossary/entries/equipment/mace_of_terror.json` |  |  |  | 6 | 5 |
| `mage_slayer` | `public/data/glossary/entries/feats/mage_slayer.json` |  |  |  | 3 | 3 |
| `magic_action` | `public/data/glossary/entries/rules/magic_action.json` |  |  |  | 7 | 4 |
| `magic_initiate` | `public/data/glossary/entries/feats/magic_initiate.json` |  |  |  | 1 | 1 |
| `magnifying_glass` | `public/data/glossary/entries/equipment/magnifying_glass.json` |  |  |  | 1 | 1 |
| `malice` | `public/data/glossary/entries/equipment/malice.json` |  |  |  | 3 | 2 |
| `malnutrition` | `public/data/glossary/entries/rules/malnutrition.json` |  |  |  | 4 | 2 |
| `manacles` | `public/data/glossary/entries/equipment/manacles.json` |  |  |  | 11 | 8 |
| `maneuvering_attack` | `public/data/glossary/entries/rules/maneuvering_attack.json` |  |  |  | 3 | 3 |
| `mantle_of_spell_resistance` | `public/data/glossary/entries/equipment/mantle_of_spell_resistance.json` |  |  |  | 1 | 1 |
| `map` | `public/data/glossary/entries/equipment/map.json` |  |  |  | 1 | 1 |
| `map_or_scroll_case` | `public/data/glossary/entries/equipment/map_or_scroll_case.json` |  |  |  | 1 | 1 |
| `mask_of_many_faces` | `public/data/glossary/entries/rules/mask_of_many_faces.json` |  |  |  | 1 | 1 |
| `mason_s_tools` | `public/data/glossary/entries/equipment/mason_s_tools.json` |  |  |  | 1 | 1 |
| `master_of_myriad_forms` | `public/data/glossary/entries/rules/master_of_myriad_forms.json` |  |  |  | 1 | 1 |
| `medallion_of_thoughts` | `public/data/glossary/entries/equipment/medallion_of_thoughts.json` |  |  |  | 1 | 1 |
| `menacing_attack` | `public/data/glossary/entries/rules/menacing_attack.json` |  |  |  | 1 | 1 |
| `mender_halfling` | `public/data/glossary/entries/races/dragonmark_variants/mender_halfling.json` |  |  |  | 16 | 3 |
| `merchant` | `public/data/glossary/entries/backgrounds/merchant.json` |  |  |  | 7 | 6 |
| `midnight_tears` | `public/data/glossary/entries/equipment/midnight_tears.json` |  |  |  | 1 | 1 |
| `military_saddle` | `public/data/glossary/entries/equipment/military_saddle.json` |  |  |  | 1 | 1 |
| `minotaur` | `public/data/glossary/entries/races/minotaur.json` |  |  |  | 7 | 3 |
| `mirror_of_life_trapping` | `public/data/glossary/entries/equipment/mirror_of_life_trapping.json` |  |  |  | 10 | 7 |
| `misty_visions` | `public/data/glossary/entries/rules/misty_visions.json` |  |  |  | 1 | 1 |
| `monk` | `public/data/glossary/entries/classes/monk.json` |  |  |  |  | 5 |
| `mountain_dwarf` | `public/data/glossary/entries/races/dwarf_subraces/mountain_dwarf.json` |  |  |  | 11 | 4 |
| `mounted_combatant` | `public/data/glossary/entries/feats/mounted_combatant.json` |  |  |  | 3 | 2 |
| `musician` | `public/data/glossary/entries/feats/musician.json` |  |  |  | 5 | 5 |
| `nature_s_mantle` | `public/data/glossary/entries/equipment/nature_s_mantle.json` |  |  |  | 4 | 4 |
| `necklace_of_adaptation` | `public/data/glossary/entries/equipment/necklace_of_adaptation.json` |  |  |  | 2 | 2 |
| `necklace_of_fireballs` | `public/data/glossary/entries/equipment/necklace_of_fireballs.json` |  |  |  | 2 | 2 |
| `necklace_of_prayer_beads` | `public/data/glossary/entries/equipment/necklace_of_prayer_beads.json` |  |  |  | 7 | 7 |
| `needle` | `public/data/glossary/entries/equipment/needle.json` |  |  |  | 1 | 1 |
| `needles_50` | `public/data/glossary/entries/equipment/needles_50.json` |  |  |  | 1 | 1 |
| `net` | `public/data/glossary/entries/equipment/net.json` |  |  |  | 6 | 5 |
| `nick` | `public/data/glossary/entries/rules/nick.json` |  |  |  | 2 | 2 |
| `noble` | `public/data/glossary/entries/backgrounds/noble.json` |  |  |  | 7 | 6 |
| `nolzur_s_marvelous_pigments` | `public/data/glossary/entries/equipment/nolzur_s_marvelous_pigments.json` |  |  |  | 4 | 1 |
| `nonplayer_character` | `public/data/glossary/entries/rules/nonplayer_character.json` |  |  |  | 2 |  |
| `oath_of_devotion_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_devotion.json` |  |  |  |  | 4 |
| `oath_of_glory_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_glory.json` |  |  |  |  | 4 |
| `oath_of_the_ancients_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_the_ancients.json` |  |  |  |  | 4 |
| `oath_of_vengeance_subclass` | `public/data/glossary/entries/classes/paladin_subclasses/oath_of_vengeance.json` |  |  |  |  | 4 |
| `observant` | `public/data/glossary/entries/feats/observant.json` |  |  |  | 6 | 6 |
| `oil` | `public/data/glossary/entries/equipment/oil.json` |  |  |  | 4 | 3 |
| `oil_of_etherealness` | `public/data/glossary/entries/equipment/oil_of_etherealness.json` |  |  |  | 1 | 1 |
| `oil_of_slipperiness` | `public/data/glossary/entries/equipment/oil_of_slipperiness.json` |  |  |  | 3 | 3 |
| `oil_of_taggit` | `public/data/glossary/entries/equipment/oil_of_taggit.json` |  |  |  | 3 | 2 |
| `one_thing_at_a_time` | `public/data/glossary/entries/rules/one_thing_at_a_time.json` |  |  |  |  | 3 |
| `one_with_shadows` | `public/data/glossary/entries/rules/one_with_shadows.json` |  |  |  | 3 | 3 |
| `opportunity_attack` | `public/data/glossary/entries/rules/opportunity_attack.json` |  |  |  | 6 |  |
| `orb_of_direction` | `public/data/glossary/entries/equipment/orb_of_direction.json` |  |  |  | 1 | 1 |
| `orb_of_dragonkind` | `public/data/glossary/entries/equipment/orb_of_dragonkind.json` |  |  |  | 13 | 11 |
| `orb_of_time` | `public/data/glossary/entries/equipment/orb_of_time.json` |  |  |  | 1 | 1 |
| `otherworldly_leap` | `public/data/glossary/entries/rules/otherworldly_leap.json` |  |  |  | 1 | 1 |
| `pact_of_the_blade` | `public/data/glossary/entries/rules/pact_of_the_blade.json` |  |  |  | 3 | 2 |
| `pact_of_the_chain` | `public/data/glossary/entries/rules/pact_of_the_chain.json` |  |  |  | 4 | 4 |
| `pact_of_the_tome` | `public/data/glossary/entries/rules/pact_of_the_tome.json` |  |  |  | 4 | 4 |
| `painter_s_supplies` | `public/data/glossary/entries/equipment/painter_s_supplies.json` |  |  |  | 2 | 2 |
| `paladin` | `public/data/glossary/entries/classes/paladin.json` |  |  |  |  | 6 |
| `paladin_spell_list` | `public/data/glossary/entries/classes/paladin_spell_list.json` |  |  |  |  | 2 |
| `pale_tincture` | `public/data/glossary/entries/equipment/pale_tincture.json` |  |  |  | 4 | 1 |
| `pallid_elf` | `public/data/glossary/entries/races/elf_lineages/pallid_elf.json` |  |  |  | 17 | 5 |
| `paralyzed` | `public/data/glossary/entries/rules/paralyzed.json` |  |  |  | 6 |  |
| `paralyzed_condition` | `public/data/glossary/entries/rules/conditions/paralyzed_condition.json` |  |  |  |  | 2 |
| `parry` | `public/data/glossary/entries/rules/parry.json` |  |  |  | 1 | 1 |
| `passive_perception` | `public/data/glossary/entries/rules/passive_perception.json` |  |  |  | 6 |  |
| `path_of_the_berserker` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_berserker.json` |  |  |  |  | 4 |
| `path_of_the_wild_heart` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_wild_heart.json` |  |  |  |  | 3 |
| `path_of_the_world_tree` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_world_tree.json` |  |  |  |  | 4 |
| `path_of_the_zealot` | `public/data/glossary/entries/classes/barbarian_subclasses/path_of_the_zealot.json` |  |  |  |  | 5 |
| `pathfinder_half_orc` | `public/data/glossary/entries/races/dragonmark_variants/pathfinder_half_orc.json` |  |  |  | 21 | 3 |
| `pearl_of_power` | `public/data/glossary/entries/equipment/pearl_of_power.json` |  |  |  | 1 | 1 |
| `per_day` | `public/data/glossary/entries/rules/per_day.json` |  |  |  | 2 |  |
| `perfume` | `public/data/glossary/entries/equipment/perfume.json` |  |  |  | 2 | 2 |
| `perfume_of_bewitching` | `public/data/glossary/entries/equipment/perfume_of_bewitching.json` |  |  |  | 4 | 4 |
| `periapt_of_health` | `public/data/glossary/entries/equipment/periapt_of_health.json` |  |  |  | 4 | 4 |
| `periapt_of_proof_against_poison` | `public/data/glossary/entries/equipment/periapt_of_proof_against_poison.json` |  |  |  | 2 | 2 |
| `periapt_of_wound_closure` | `public/data/glossary/entries/equipment/periapt_of_wound_closure.json` |  |  |  | 4 | 3 |
| `petrified` | `public/data/glossary/entries/rules/petrified.json` |  |  |  | 8 |  |
| `petrified_condition` | `public/data/glossary/entries/rules/conditions/petrified_condition.json` |  |  |  |  | 2 |
| `philter_of_love` | `public/data/glossary/entries/equipment/philter_of_love.json` |  |  |  | 2 | 1 |
| `piercer` | `public/data/glossary/entries/feats/piercer.json` |  |  |  | 1 | 1 |
| `pipe_of_smoke_monsters` | `public/data/glossary/entries/equipment/pipe_of_smoke_monsters.json` |  |  |  | 1 | 1 |
| `pipes_of_haunting` | `public/data/glossary/entries/equipment/pipes_of_haunting.json` |  |  |  | 2 | 2 |
| `pipes_of_the_sewers` | `public/data/glossary/entries/equipment/pipes_of_the_sewers.json` |  |  |  | 8 | 4 |
| `planar_effects` | `public/data/glossary/entries/rules/planar_effects.json` |  |  |  | 9 | 8 |
| `plasmoid` | `public/data/glossary/entries/races/plasmoid.json` |  |  |  | 13 | 4 |
| `poison_crafting` | `public/data/glossary/entries/rules/crafting/poison_crafting.json` |  |  |  |  | 2 |
| `poisoned` | `public/data/glossary/entries/rules/poisoned.json` |  |  |  | 1 |  |
| `poisoned_condition` | `public/data/glossary/entries/rules/conditions/poisoned_condition.json` |  |  |  |  | 1 |
| `poisoner` | `public/data/glossary/entries/feats/poisoner.json` |  |  |  | 6 | 5 |
| `poisoner_s_kit` | `public/data/glossary/entries/equipment/poisoner_s_kit.json` |  |  |  | 1 | 1 |
| `poisonous_gas` | `public/data/glossary/entries/rules/poisonous_gas.json` |  |  |  | 3 | 3 |
| `pole` | `public/data/glossary/entries/equipment/pole.json` |  |  |  | 3 | 3 |
| `pole_of_angling` | `public/data/glossary/entries/equipment/pole_of_angling.json` |  |  |  | 1 | 1 |
| `pole_of_collapsing` | `public/data/glossary/entries/equipment/pole_of_collapsing.json` |  |  |  | 1 | 1 |
| `polearm_master` | `public/data/glossary/entries/feats/polearm_master.json` |  |  |  | 7 | 5 |
| `portable_hole` | `public/data/glossary/entries/equipment/portable_hole.json` |  |  |  | 6 | 5 |
| `portable_ram` | `public/data/glossary/entries/equipment/portable_ram.json` |  |  |  | 1 | 1 |
| `possessed` | `public/data/glossary/entries/rules/possessed.json` |  |  |  | 1 | 2 |
| `pot_of_awakening` | `public/data/glossary/entries/equipment/pot_of_awakening.json` |  |  |  | 1 | 1 |
| `potion_of_animal_friendship` | `public/data/glossary/entries/equipment/potion_of_animal_friendship.json` |  |  |  | 1 | 1 |
| `potion_of_clairvoyance` | `public/data/glossary/entries/equipment/potion_of_clairvoyance.json` |  |  |  | 1 | 1 |
| `potion_of_climbing` | `public/data/glossary/entries/equipment/potion_of_climbing.json` |  |  |  | 4 | 4 |
| `potion_of_comprehension` | `public/data/glossary/entries/equipment/potion_of_comprehension.json` |  |  |  | 1 | 1 |
| `potion_of_diminution` | `public/data/glossary/entries/equipment/potion_of_diminution.json` |  |  |  | 1 | 1 |
| `potion_of_fire_breath` | `public/data/glossary/entries/equipment/potion_of_fire_breath.json` |  |  |  | 1 | 1 |
| `potion_of_flying` | `public/data/glossary/entries/equipment/potion_of_flying.json` |  |  |  | 2 | 2 |
| `potion_of_gaseous_form` | `public/data/glossary/entries/equipment/potion_of_gaseous_form.json` |  |  |  | 2 | 2 |
| `potion_of_greater_healing` | `public/data/glossary/entries/equipment/potion_of_greater_healing.json` |  |  |  | 1 | 1 |
| `potion_of_greater_invisibility` | `public/data/glossary/entries/equipment/potion_of_greater_invisibility.json` |  |  |  | 1 | 1 |
| `potion_of_growth` | `public/data/glossary/entries/equipment/potion_of_growth.json` |  |  |  | 1 | 1 |
| `potion_of_healing` | `public/data/glossary/entries/equipment/potion_of_healing.json` |  |  |  | 2 | 2 |
| `potion_of_heroism` | `public/data/glossary/entries/equipment/potion_of_heroism.json` |  |  |  | 2 | 2 |
| `potion_of_invisibility` | `public/data/glossary/entries/equipment/potion_of_invisibility.json` |  |  |  | 1 | 1 |
| `potion_of_invulnerability` | `public/data/glossary/entries/equipment/potion_of_invulnerability.json` |  |  |  | 1 | 1 |
| `potion_of_mind_reading` | `public/data/glossary/entries/equipment/potion_of_mind_reading.json` |  |  |  | 1 | 1 |
| `potion_of_poison` | `public/data/glossary/entries/equipment/potion_of_poison.json` |  |  |  | 3 | 3 |
| `potion_of_pugilism` | `public/data/glossary/entries/equipment/potion_of_pugilism.json` |  |  |  | 1 | 1 |
| `potion_of_speed` | `public/data/glossary/entries/equipment/potion_of_speed.json` |  |  |  | 1 | 1 |
| `potion_of_superior_healing` | `public/data/glossary/entries/equipment/potion_of_superior_healing.json` |  |  |  | 1 | 1 |
| `potion_of_supreme_healing` | `public/data/glossary/entries/equipment/potion_of_supreme_healing.json` |  |  |  | 1 | 1 |
| `potion_of_vitality` | `public/data/glossary/entries/equipment/potion_of_vitality.json` |  |  |  | 4 | 4 |
| `potter_s_tools` | `public/data/glossary/entries/equipment/potter_s_tools.json` |  |  |  | 2 | 2 |
| `priest_s_pack` | `public/data/glossary/entries/equipment/priest_s_pack.json` |  |  |  | 7 | 7 |
| `proficiency` | `public/data/glossary/entries/rules/proficiency.json` |  |  |  | 3 |  |
| `proficiency_bonus` | `public/data/glossary/entries/rules/proficiency_bonus.json` |  |  |  |  | 5 |
| `prone` | `public/data/glossary/entries/rules/prone.json` |  |  |  | 6 |  |
| `prone_condition` | `public/data/glossary/entries/rules/conditions/prone_condition.json` |  |  |  |  | 1 |
| `prosthetic_limb` | `public/data/glossary/entries/equipment/prosthetic_limb.json` |  |  |  | 1 | 1 |
| `protection` | `public/data/glossary/entries/feats/protection.json` |  |  |  | 3 | 3 |
| `protector_aasimar` | `public/data/glossary/entries/races/aasimar_variants/protector.json` |  |  |  | 16 | 4 |
| `psi_warrior_subclass` | `public/data/glossary/entries/classes/fighter_subclasses/psi_warrior.json` |  |  |  |  | 2 |
| `pushing_attack` | `public/data/glossary/entries/rules/pushing_attack.json` |  |  |  | 1 | 1 |
| `quaal_s_feather_token_anchor` | `public/data/glossary/entries/equipment/quaal_s_feather_token_anchor.json` |  |  |  | 1 | 1 |
| `quaal_s_feather_token_bird` | `public/data/glossary/entries/equipment/quaal_s_feather_token_bird.json` |  |  |  | 3 | 2 |
| `quaal_s_feather_token_fan` | `public/data/glossary/entries/equipment/quaal_s_feather_token_fan.json` |  |  |  | 2 | 1 |
| `quaal_s_feather_token_swan_boat` | `public/data/glossary/entries/equipment/quaal_s_feather_token_swan_boat.json` |  |  |  | 3 | 1 |
| `quaal_s_feather_token_tree` | `public/data/glossary/entries/equipment/quaal_s_feather_token_tree.json` |  |  |  | 1 | 1 |
| `quaal_s_feather_token_whip` | `public/data/glossary/entries/equipment/quaal_s_feather_token_whip.json` |  |  |  | 5 | 3 |
| `quarterstaff_of_the_acrobat` | `public/data/glossary/entries/equipment/quarterstaff_of_the_acrobat.json` |  |  |  | 11 | 9 |
| `quickened_spell` | `public/data/glossary/entries/rules/quickened_spell.json` |  |  |  | 1 | 1 |
| `quicksand_pit` | `public/data/glossary/entries/rules/quicksand_pit.json` |  |  |  | 4 | 3 |
| `quiver_of_ehlonna` | `public/data/glossary/entries/equipment/quiver_of_ehlonna.json` |  |  |  | 5 | 5 |
| `r` | `public/data/glossary/entries/rules/r.json` |  |  |  | 1 | 1 |
| `rally` | `public/data/glossary/entries/rules/rally.json` |  |  |  | 2 | 2 |
| `ranger` | `public/data/glossary/entries/classes/ranger.json` |  |  |  |  | 7 |
| `ranger_spell_list` | `public/data/glossary/entries/classes/ranger_spell_list.json` |  |  |  |  | 2 |
| `ravenite_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/ravenite.json` |  |  |  | 7 | 3 |
| `razorvine` | `public/data/glossary/entries/rules/razorvine.json` |  |  |  | 1 | 1 |
| `reach` | `public/data/glossary/entries/rules/reach.json` |  |  |  | 3 | 4 |
| `reaction` | `public/data/glossary/entries/rules/reaction.json` |  |  |  | 2 |  |
| `reactions` | `public/data/glossary/entries/rules/reactions.json` |  |  |  |  | 3 |
| `ready` | `public/data/glossary/entries/rules/ready.json` |  |  |  | 5 |  |
| `ready_action` | `public/data/glossary/entries/rules/ready_action.json` |  |  |  | 2 | 4 |
| `red_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/red.json` |  |  |  | 13 | 3 |
| `resistance` | `public/data/glossary/entries/rules/resistance.json` |  |  |  | 2 |  |
| `restrained` | `public/data/glossary/entries/rules/restrained.json` |  |  |  | 6 |  |
| `restrained_condition` | `public/data/glossary/entries/rules/conditions/restrained_condition.json` |  |  |  |  | 1 |
| `ring_of_animal_influence` | `public/data/glossary/entries/equipment/ring_of_animal_influence.json` |  |  |  | 3 | 3 |
| `ring_of_djinni_summoning` | `public/data/glossary/entries/equipment/ring_of_djinni_summoning.json` |  |  |  | 3 | 3 |
| `ring_of_elemental_command_air` | `public/data/glossary/entries/equipment/ring_of_elemental_command_air.json` |  |  |  | 11 | 11 |
| `ring_of_elemental_command_earth` | `public/data/glossary/entries/equipment/ring_of_elemental_command_earth.json` |  |  |  | 11 | 10 |
| `ring_of_elemental_command_fire` | `public/data/glossary/entries/equipment/ring_of_elemental_command_fire.json` |  |  |  | 9 | 9 |
| `ring_of_elemental_command_water` | `public/data/glossary/entries/equipment/ring_of_elemental_command_water.json` |  |  |  | 10 | 10 |
| `ring_of_evasion` | `public/data/glossary/entries/equipment/ring_of_evasion.json` |  |  |  | 1 | 1 |
| `ring_of_free_action` | `public/data/glossary/entries/equipment/ring_of_free_action.json` |  |  |  | 3 | 3 |
| `ring_of_invisibility` | `public/data/glossary/entries/equipment/ring_of_invisibility.json` |  |  |  | 4 | 3 |
| `ring_of_jumping` | `public/data/glossary/entries/equipment/ring_of_jumping.json` |  |  |  | 1 | 1 |
| `ring_of_mind_shielding` | `public/data/glossary/entries/equipment/ring_of_mind_shielding.json` |  |  |  | 2 | 1 |
| `ring_of_protection` | `public/data/glossary/entries/equipment/ring_of_protection.json` |  |  |  | 1 | 1 |
| `ring_of_regeneration` | `public/data/glossary/entries/equipment/ring_of_regeneration.json` |  |  |  | 3 | 2 |
| `ring_of_shooting_stars` | `public/data/glossary/entries/equipment/ring_of_shooting_stars.json` |  |  |  | 9 | 8 |
| `ring_of_spell_turning` | `public/data/glossary/entries/equipment/ring_of_spell_turning.json` |  |  |  | 2 | 2 |
| `ring_of_swimming` | `public/data/glossary/entries/equipment/ring_of_swimming.json` |  |  |  | 1 | 1 |
| `ring_of_telekinesis` | `public/data/glossary/entries/equipment/ring_of_telekinesis.json` |  |  |  | 1 | 1 |
| `ring_of_the_ram` | `public/data/glossary/entries/equipment/ring_of_the_ram.json` |  |  |  | 2 | 1 |
| `ring_of_three_wishes` | `public/data/glossary/entries/equipment/ring_of_three_wishes.json` |  |  |  | 1 | 1 |
| `ring_of_water_walking` | `public/data/glossary/entries/equipment/ring_of_water_walking.json` |  |  |  | 1 | 1 |
| `ring_of_x_ray_vision` | `public/data/glossary/entries/equipment/ring_of_x_ray_vision.json` |  |  |  | 3 | 3 |
| `riposte` | `public/data/glossary/entries/rules/riposte.json` |  |  |  | 2 | 2 |
| `ritual_caster` | `public/data/glossary/entries/feats/ritual_caster.json` |  |  |  | 6 | 3 |
| `rival_coin` | `public/data/glossary/entries/equipment/rival_coin.json` |  |  |  | 2 | 2 |
| `river_styx` | `public/data/glossary/entries/rules/river_styx.json` |  |  |  | 5 | 4 |
| `rld` | `public/data/glossary/entries/rules/rld.json` |  |  |  | 1 | 1 |
| `robe_of_eyes` | `public/data/glossary/entries/equipment/robe_of_eyes.json` |  |  |  | 7 | 7 |
| `robe_of_scintillating_colors` | `public/data/glossary/entries/equipment/robe_of_scintillating_colors.json` |  |  |  | 6 | 5 |
| `robe_of_stars` | `public/data/glossary/entries/equipment/robe_of_stars.json` |  |  |  | 4 | 2 |
| `robe_of_the_archmagi` | `public/data/glossary/entries/equipment/robe_of_the_archmagi.json` |  |  |  | 2 | 2 |
| `robe_of_useful_items` | `public/data/glossary/entries/equipment/robe_of_useful_items.json` |  |  |  | 13 | 13 |
| `rock_gnome` | `public/data/glossary/entries/races/gnome_subraces/rock_gnome.json` |  |  |  | 8 | 4 |
| `rockslide` | `public/data/glossary/entries/rules/rockslide.json` |  |  |  | 6 | 5 |
| `rod_of_absorption` | `public/data/glossary/entries/equipment/rod_of_absorption.json` |  |  |  | 1 | 1 |
| `rod_of_alertness` | `public/data/glossary/entries/equipment/rod_of_alertness.json` |  |  |  | 15 | 12 |
| `rod_of_lordly_might` | `public/data/glossary/entries/equipment/rod_of_lordly_might.json` |  |  |  | 9 | 8 |
| `rod_of_resurrection` | `public/data/glossary/entries/equipment/rod_of_resurrection.json` |  |  |  | 2 | 2 |
| `rod_of_rulership` | `public/data/glossary/entries/equipment/rod_of_rulership.json` |  |  |  | 4 | 2 |
| `rod_of_security` | `public/data/glossary/entries/equipment/rod_of_security.json` |  |  |  | 4 | 3 |
| `rogue` | `public/data/glossary/entries/classes/rogue.json` |  |  |  |  | 6 |
| `rope` | `public/data/glossary/entries/equipment/rope.json` |  |  |  | 8 | 7 |
| `rope_of_climbing` | `public/data/glossary/entries/equipment/rope_of_climbing.json` |  |  |  | 6 | 5 |
| `rope_of_entanglement` | `public/data/glossary/entries/equipment/rope_of_entanglement.json` |  |  |  | 12 | 9 |
| `rope_of_mending` | `public/data/glossary/entries/equipment/rope_of_mending.json` |  |  |  | 1 | 1 |
| `ruby_of_the_war_mage` | `public/data/glossary/entries/equipment/ruby_of_the_war_mage.json` |  |  |  | 3 | 3 |
| `runeward_dwarf` | `public/data/glossary/entries/races/dragonmark_variants/runeward_dwarf.json` |  |  |  | 24 | 3 |
| `sage` | `public/data/glossary/entries/backgrounds/sage.json` |  |  |  | 9 | 8 |
| `sailor` | `public/data/glossary/entries/backgrounds/sailor.json` |  |  |  | 8 | 7 |
| `sap` | `public/data/glossary/entries/rules/sap.json` |  |  |  | 1 | 1 |
| `satyr` | `public/data/glossary/entries/races/satyr.json` |  |  |  | 7 | 3 |
| `save` | `public/data/glossary/entries/rules/save.json` |  |  |  | 2 |  |
| `saving_throw_proficiencies` | `public/data/glossary/entries/rules/saving_throw_proficiencies.json` |  |  |  |  | 2 |
| `scarab_of_protection` | `public/data/glossary/entries/equipment/scarab_of_protection.json` |  |  |  | 3 | 3 |
| `scholar_s_pack` | `public/data/glossary/entries/equipment/scholar_s_pack.json` |  |  |  | 8 | 8 |
| `school_of_magic` | `public/data/glossary/entries/rules/spells/school_of_magic.json` |  |  |  |  | 2 |
| `scimitar_of_speed` | `public/data/glossary/entries/equipment/scimitar_of_speed.json` |  |  |  | 1 | 1 |
| `scourge_aasimar` | `public/data/glossary/entries/races/aasimar_variants/scourge.json` |  |  |  | 16 | 4 |
| `scribe` | `public/data/glossary/entries/backgrounds/scribe.json` |  |  |  | 9 | 8 |
| `scribing_spell_scrolls` | `public/data/glossary/entries/rules/equipment/crafting/scribing_spell_scrolls.json` |  |  |  |  | 3 |
| `scroll_of_titan_summoning_animal_lord` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_animal_lord.json` |  |  |  | 3 | 3 |
| `scroll_of_titan_summoning_blob_of_annihilation` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_blob_of_annihilation.json` |  |  |  | 3 | 3 |
| `scroll_of_titan_summoning_colossus` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_colossus.json` |  |  |  | 3 | 3 |
| `scroll_of_titan_summoning_elemental_cataclysm` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_elemental_cataclysm.json` |  |  |  | 3 | 3 |
| `scroll_of_titan_summoning_empyrean` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_empyrean.json` |  |  |  | 3 | 3 |
| `scroll_of_titan_summoning_kraken` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_kraken.json` |  |  |  | 3 | 3 |
| `scroll_of_titan_summoning_tarrasque` | `public/data/glossary/entries/equipment/scroll_of_titan_summoning_tarrasque.json` |  |  |  | 3 | 3 |
| `sea_elf` | `public/data/glossary/entries/races/elf_lineages/sea_elf.json` |  |  |  | 11 | 3 |
| `search` | `public/data/glossary/entries/rules/search.json` |  |  |  | 4 |  |
| `search_action` | `public/data/glossary/entries/rules/search_action.json` |  |  |  | 4 | 4 |
| `seersight_half_elf` | `public/data/glossary/entries/races/dragonmark_variants/seersight_half_elf.json` |  |  |  | 24 | 3 |
| `sending_stones` | `public/data/glossary/entries/equipment/sending_stones.json` |  |  |  | 1 | 1 |
| `sentinel` | `public/data/glossary/entries/feats/sentinel.json` |  |  |  | 4 | 3 |
| `sentinel_shield` | `public/data/glossary/entries/equipment/sentinel_shield.json` |  |  |  | 3 | 3 |
| `shadar_kai` | `public/data/glossary/entries/races/elf_lineages/shadar_kai.json` |  |  |  | 15 | 4 |
| `shadow_touched` | `public/data/glossary/entries/feats/shadow_touched.json` |  |  |  | 2 | 2 |
| `shadowveil_elf` | `public/data/glossary/entries/races/dragonmark_variants/shadowveil_elf.json` |  |  |  | 24 | 3 |
| `shape_shift` | `public/data/glossary/entries/rules/shape_shift.json` |  |  |  | 3 | 3 |
| `shape_shifting` | `public/data/glossary/entries/rules/shape_shifting.json` |  |  |  | 1 |  |
| `sharpshooter` | `public/data/glossary/entries/feats/sharpshooter.json` |  |  |  | 4 | 3 |
| `shield_master` | `public/data/glossary/entries/feats/shield_master.json` |  |  |  | 6 | 5 |
| `shield_of_expression` | `public/data/glossary/entries/equipment/shield_of_expression.json` |  |  |  | 1 | 1 |
| `shield_of_missile_attraction` | `public/data/glossary/entries/equipment/shield_of_missile_attraction.json` |  |  |  | 2 | 2 |
| `shield_of_the_cavalier` | `public/data/glossary/entries/equipment/shield_of_the_cavalier.json` |  |  |  | 12 | 6 |
| `short_rest` | `public/data/glossary/entries/rules/short_rest.json` |  |  |  | 7 |  |
| `signal_whistle` | `public/data/glossary/entries/equipment/signal_whistle.json` |  |  |  | 1 | 1 |
| `simic_hybrid` | `public/data/glossary/entries/races/simic_hybrid.json` |  |  |  | 8 | 2 |
| `simultaneous_effects` | `public/data/glossary/entries/rules/simultaneous_effects.json` |  |  |  | 1 |  |
| `size` | `public/data/glossary/entries/rules/size.json` |  |  |  | 1 |  |
| `skill` | `public/data/glossary/entries/rules/skill.json` |  |  |  | 2 |  |
| `skill_expert` | `public/data/glossary/entries/feats/skill_expert.json` |  |  |  | 2 | 1 |
| `skill_proficiencies` | `public/data/glossary/entries/rules/skill_proficiencies.json` |  |  |  |  | 2 |
| `skulker` | `public/data/glossary/entries/feats/skulker.json` |  |  |  | 4 | 4 |
| `slasher` | `public/data/glossary/entries/feats/slasher.json` |  |  |  | 3 | 3 |
| `sling_bullet` | `public/data/glossary/entries/equipment/sling_bullet.json` |  |  |  | 1 | 1 |
| `sling_bullets_20` | `public/data/glossary/entries/equipment/sling_bullets_20.json` |  |  |  | 1 | 1 |
| `slippers_of_spider_climbing` | `public/data/glossary/entries/equipment/slippers_of_spider_climbing.json` |  |  |  | 2 | 2 |
| `slippery_ice` | `public/data/glossary/entries/rules/slippery_ice.json` |  |  |  | 2 | 2 |
| `slow` | `public/data/glossary/entries/rules/slow.json` |  |  |  | 2 | 1 |
| `smith_s_tools` | `public/data/glossary/entries/equipment/smith_s_tools.json` |  |  |  | 15 | 15 |
| `smoke_grenade` | `public/data/glossary/entries/equipment/smoke_grenade.json` |  |  |  | 3 | 3 |
| `soldier` | `public/data/glossary/entries/backgrounds/soldier.json` |  |  |  | 11 | 10 |
| `sorcerer` | `public/data/glossary/entries/classes/sorcerer.json` |  |  |  |  | 9 |
| `sorcerer_spell_list` | `public/data/glossary/entries/classes/sorcerer_spell_list.json` |  |  |  |  | 2 |
| `soulknife_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/soulknife.json` |  |  |  |  | 3 |
| `sovereign_glue` | `public/data/glossary/entries/equipment/sovereign_glue.json` |  |  |  | 5 | 5 |
| `special_speeds` | `public/data/glossary/entries/rules/special_speeds.json` |  |  |  |  | 4 |
| `speed` | `public/data/glossary/entries/rules/speed.json` |  |  |  | 9 |  |
| `speedy` | `public/data/glossary/entries/feats/speedy.json` |  |  |  | 5 | 5 |
| `spell` | `public/data/glossary/entries/rules/spell.json` |  |  |  | 2 |  |
| `spell_attack` | `public/data/glossary/entries/rules/spell_attack.json` |  |  |  | 2 |  |
| `spell_components_rules` | `public/data/glossary/entries/rules/spells/spell_components_rules.json` |  |  |  |  | 3 |
| `spell_duration_rules` | `public/data/glossary/entries/rules/spells/spell_duration_rules.json` |  |  |  |  | 2 |
| `spell_effects_rules` | `public/data/glossary/entries/rules/spells/spell_effects_rules.json` |  |  |  |  | 5 |
| `spell_level_slots` | `public/data/glossary/entries/rules/spells/spell_level_slots.json` |  |  |  |  | 3 |
| `spell_range_rules` | `public/data/glossary/entries/rules/spells/spell_range_rules.json` |  |  |  |  | 2 |
| `spell_referenced_rules_enrichment` | `public/data/glossary/entries/rules/spells/spell_referenced_rules_enrichment.json` |  |  |  | 4 | 4 |
| `spell_scroll_level_1` | `public/data/glossary/entries/equipment/spell_scroll_level_1.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_2` | `public/data/glossary/entries/equipment/spell_scroll_level_2.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_3` | `public/data/glossary/entries/equipment/spell_scroll_level_3.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_4` | `public/data/glossary/entries/equipment/spell_scroll_level_4.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_5` | `public/data/glossary/entries/equipment/spell_scroll_level_5.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_6` | `public/data/glossary/entries/equipment/spell_scroll_level_6.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_7` | `public/data/glossary/entries/equipment/spell_scroll_level_7.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_8` | `public/data/glossary/entries/equipment/spell_scroll_level_8.json` |  |  |  | 1 | 1 |
| `spell_scroll_level_9` | `public/data/glossary/entries/equipment/spell_scroll_level_9.json` |  |  |  | 1 | 1 |
| `spell_slot` | `public/data/glossary/entries/rules/spell_slot.json` |  |  |  | 3 | 2 |
| `spell_sniper` | `public/data/glossary/entries/feats/spell_sniper.json` |  |  |  | 3 | 3 |
| `spellguard_shield` | `public/data/glossary/entries/equipment/spellguard_shield.json` |  |  |  | 2 | 2 |
| `spells_chapter` | `public/data/glossary/entries/rules/spells_chapter.json` |  |  |  |  | 10 |
| `sphere_area` | `public/data/glossary/entries/rules/spells/referenced/sphere_area.json` |  |  |  | 28 | 1 |
| `sphere_of_annihilation` | `public/data/glossary/entries/equipment/sphere_of_annihilation.json` |  |  |  | 5 | 5 |
| `spirit_board` | `public/data/glossary/entries/equipment/spirit_board.json` |  |  |  | 2 | 2 |
| `spring_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/spring.json` |  |  |  | 14 | 4 |
| `stable` | `public/data/glossary/entries/rules/stable.json` |  |  |  | 4 |  |
| `staff_of_birdcalls` | `public/data/glossary/entries/equipment/staff_of_birdcalls.json` |  |  |  | 1 | 1 |
| `staff_of_charming` | `public/data/glossary/entries/equipment/staff_of_charming.json` |  |  |  | 4 | 4 |
| `staff_of_fire` | `public/data/glossary/entries/equipment/staff_of_fire.json` |  |  |  | 4 | 4 |
| `staff_of_flowers` | `public/data/glossary/entries/equipment/staff_of_flowers.json` |  |  |  | 1 | 1 |
| `staff_of_frost` | `public/data/glossary/entries/equipment/staff_of_frost.json` |  |  |  | 5 | 5 |
| `staff_of_healing` | `public/data/glossary/entries/equipment/staff_of_healing.json` |  |  |  | 3 | 3 |
| `staff_of_power` | `public/data/glossary/entries/equipment/staff_of_power.json` |  |  |  | 12 | 12 |
| `staff_of_swarming_insects` | `public/data/glossary/entries/equipment/staff_of_swarming_insects.json` |  |  |  | 6 | 6 |
| `staff_of_the_adder` | `public/data/glossary/entries/equipment/staff_of_the_adder.json` |  |  |  | 6 | 5 |
| `staff_of_the_magi` | `public/data/glossary/entries/equipment/staff_of_the_magi.json` |  |  |  | 23 | 23 |
| `staff_of_the_python` | `public/data/glossary/entries/equipment/staff_of_the_python.json` |  |  |  | 6 | 5 |
| `staff_of_the_woodlands` | `public/data/glossary/entries/equipment/staff_of_the_woodlands.json` |  |  |  | 11 | 10 |
| `staff_of_thunder_and_lightning` | `public/data/glossary/entries/equipment/staff_of_thunder_and_lightning.json` |  |  |  | 8 | 6 |
| `staff_of_withering` | `public/data/glossary/entries/equipment/staff_of_withering.json` |  |  |  | 1 | 1 |
| `stat_block` | `public/data/glossary/entries/rules/stat_block.json` |  |  |  | 42 |  |
| `stone_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/stone_giant_goliath.json` |  |  |  | 11 | 3 |
| `stone_of_controlling_earth_elementals` | `public/data/glossary/entries/equipment/stone_of_controlling_earth_elementals.json` |  |  |  | 3 | 3 |
| `storm_giant_goliath` | `public/data/glossary/entries/races/goliath_ancestries/storm_giant_goliath.json` |  |  |  | 12 | 3 |
| `stormborn_half_elf` | `public/data/glossary/entries/races/dragonmark_variants/stormborn_half_elf.json` |  |  |  | 23 | 3 |
| `stout_halfling` | `public/data/glossary/entries/races/halfling_subraces/stout.json` |  |  |  | 4 | 4 |
| `strength` | `public/data/glossary/entries/rules/strength.json` |  |  |  |  | 3 |
| `string` | `public/data/glossary/entries/equipment/string.json` |  |  |  | 1 | 1 |
| `strong_wind` | `public/data/glossary/entries/rules/strong_wind.json` |  |  |  | 2 | 2 |
| `study` | `public/data/glossary/entries/rules/study.json` |  |  |  | 5 |  |
| `study_action` | `public/data/glossary/entries/rules/study_action.json` |  |  |  | 2 | 5 |
| `stunned` | `public/data/glossary/entries/rules/stunned.json` |  |  |  | 4 |  |
| `stunned_condition` | `public/data/glossary/entries/rules/conditions/stunned_condition.json` |  |  |  |  | 1 |
| `suffocation` | `public/data/glossary/entries/rules/suffocation.json` |  |  |  | 2 | 1 |
| `summer_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/summer.json` |  |  |  | 16 | 5 |
| `sun_blade` | `public/data/glossary/entries/equipment/sun_blade.json` |  |  |  | 6 | 4 |
| `surprise` | `public/data/glossary/entries/rules/surprise.json` |  |  |  | 2 | 3 |
| `sweeping_attack` | `public/data/glossary/entries/rules/sweeping_attack.json` |  |  |  | 1 | 1 |
| `swiftstride_shifter` | `public/data/glossary/entries/races/shifter_variants/swiftstride.json` |  |  |  | 12 | 3 |
| `swimming` | `public/data/glossary/entries/rules/swimming.json` |  |  |  | 4 |  |
| `sword_of_answering` | `public/data/glossary/entries/equipment/sword_of_answering.json` |  |  |  | 4 | 4 |
| `sword_of_kas` | `public/data/glossary/entries/equipment/sword_of_kas.json` |  |  |  | 14 | 13 |
| `tabaxi` | `public/data/glossary/entries/races/tabaxi.json` |  |  |  | 5 | 5 |
| `tactical_assessment` | `public/data/glossary/entries/rules/tactical_assessment.json` |  |  |  | 3 | 3 |
| `talisman_of_pure_good` | `public/data/glossary/entries/equipment/talisman_of_pure_good.json` |  |  |  | 2 | 2 |
| `talisman_of_the_sphere` | `public/data/glossary/entries/equipment/talisman_of_the_sphere.json` |  |  |  | 5 | 4 |
| `talisman_of_ultimate_evil` | `public/data/glossary/entries/equipment/talisman_of_ultimate_evil.json` |  |  |  | 2 | 2 |
| `talking_doll` | `public/data/glossary/entries/equipment/talking_doll.json` |  |  |  | 2 | 2 |
| `target` | `public/data/glossary/entries/rules/target.json` |  |  |  | 2 |  |
| `tavern_brawler` | `public/data/glossary/entries/feats/tavern_brawler.json` |  |  |  | 5 | 2 |
| `telekinetic` | `public/data/glossary/entries/feats/telekinetic.json` |  |  |  | 4 | 4 |
| `telepathic` | `public/data/glossary/entries/feats/telepathic.json` |  |  |  | 2 | 2 |
| `telepathy` | `public/data/glossary/entries/rules/telepathy.json` |  |  |  | 1 |  |
| `teleportation` | `public/data/glossary/entries/rules/teleportation.json` |  |  |  | 1 |  |
| `temporary_hit_points` | `public/data/glossary/entries/rules/temporary_hit_points.json` |  |  |  | 2 |  |
| `temporary_hp` | `public/data/glossary/entries/rules/temporary_hp.json` |  |  |  | 2 | 1 |
| `tentacle_rod` | `public/data/glossary/entries/equipment/tentacle_rod.json` |  |  |  | 5 | 4 |
| `thief_subclass` | `public/data/glossary/entries/classes/rogue_subclasses/thief.json` |  |  |  |  | 4 |
| `thirsting_blade` | `public/data/glossary/entries/rules/thirsting_blade.json` |  |  |  | 1 | 1 |
| `three_quarters_cover` | `public/data/glossary/entries/rules/three_quarters_cover.json` |  |  |  | 3 | 5 |
| `thri_kreen` | `public/data/glossary/entries/races/thri_kreen.json` |  |  |  | 10 | 2 |
| `thunderous_greatclub` | `public/data/glossary/entries/equipment/thunderous_greatclub.json` |  |  |  | 7 | 3 |
| `tinderbox` | `public/data/glossary/entries/equipment/tinderbox.json` |  |  |  | 5 | 5 |
| `tinker_s_tools` | `public/data/glossary/entries/equipment/tinker_s_tools.json` |  |  |  | 13 | 13 |
| `tome_of_the_stilled_tongue` | `public/data/glossary/entries/equipment/tome_of_the_stilled_tongue.json` |  |  |  | 1 | 1 |
| `topple` | `public/data/glossary/entries/rules/topple.json` |  |  |  | 2 | 2 |
| `torch` | `public/data/glossary/entries/equipment/torch.json` |  |  |  | 3 | 3 |
| `torpor` | `public/data/glossary/entries/equipment/torpor.json` |  |  |  | 3 | 2 |
| `tortle` | `public/data/glossary/entries/races/tortle.json` |  |  |  | 9 | 3 |
| `total_cover` | `public/data/glossary/entries/rules/total_cover.json` |  |  |  | 4 | 5 |
| `tough` | `public/data/glossary/entries/feats/tough.json` |  |  |  | 3 | 2 |
| `traps` | `public/data/glossary/entries/rules/traps.json` |  |  |  |  | 3 |
| `trickery_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/trickery_domain.json` |  |  |  |  | 3 |
| `trident_of_fish_command` | `public/data/glossary/entries/equipment/trident_of_fish_command.json` |  |  |  | 2 | 2 |
| `trip_attack` | `public/data/glossary/entries/rules/trip_attack.json` |  |  |  | 2 | 2 |
| `triton` | `public/data/glossary/entries/races/triton.json` |  |  |  | 6 | 6 |
| `truesight` | `public/data/glossary/entries/rules/truesight.json` |  |  |  | 3 | 3 |
| `truth_serum` | `public/data/glossary/entries/equipment/truth_serum.json` |  |  |  | 2 | 1 |
| `twinned_spell` | `public/data/glossary/entries/rules/twinned_spell.json` |  |  |  | 1 | 1 |
| `unarmed_fighting` | `public/data/glossary/entries/feats/unarmed_fighting.json` |  |  |  | 4 | 3 |
| `unarmed_strike` | `public/data/glossary/entries/rules/unarmed_strike.json` |  |  |  | 9 |  |
| `unconscious` | `public/data/glossary/entries/rules/unconscious.json` |  |  |  | 8 |  |
| `unconscious_condition` | `public/data/glossary/entries/rules/conditions/unconscious_condition.json` |  |  |  |  | 3 |
| `universal_solvent` | `public/data/glossary/entries/equipment/universal_solvent.json` |  |  |  | 1 | 1 |
| `utilize` | `public/data/glossary/entries/rules/utilize.json` |  |  |  | 2 |  |
| `utilize_action` | `public/data/glossary/entries/rules/utilize_action.json` |  |  |  | 3 | 5 |
| `vedalken` | `public/data/glossary/entries/races/vedalken.json` |  |  |  | 9 | 2 |
| `verdan` | `public/data/glossary/entries/races/verdan.json` |  |  |  | 4 | 3 |
| `veteran_s_cane` | `public/data/glossary/entries/equipment/veteran_s_cane.json` |  |  |  | 1 | 1 |
| `vex` | `public/data/glossary/entries/rules/vex.json` |  |  |  | 1 | 1 |
| `vicious_vine` | `public/data/glossary/entries/rules/vicious_vine.json` |  |  |  | 4 | 4 |
| `vision` | `public/data/glossary/entries/rules/vision.json` |  |  |  | 8 | 6 |
| `vision_and_light` | `public/data/glossary/entries/rules/vision_and_light.json` |  |  |  | 7 |  |
| `visions_of_distant_realms` | `public/data/glossary/entries/rules/visions_of_distant_realms.json` |  |  |  | 1 | 1 |
| `vulnerability` | `public/data/glossary/entries/rules/vulnerability.json` |  |  |  | 2 |  |
| `wand_of_binding` | `public/data/glossary/entries/equipment/wand_of_binding.json` |  |  |  | 2 | 2 |
| `wand_of_conducting` | `public/data/glossary/entries/equipment/wand_of_conducting.json` |  |  |  | 1 | 1 |
| `wand_of_enemy_detection` | `public/data/glossary/entries/equipment/wand_of_enemy_detection.json` |  |  |  | 4 | 3 |
| `wand_of_fear` | `public/data/glossary/entries/equipment/wand_of_fear.json` |  |  |  | 3 | 3 |
| `wand_of_fireballs` | `public/data/glossary/entries/equipment/wand_of_fireballs.json` |  |  |  | 1 | 1 |
| `wand_of_lightning_bolts` | `public/data/glossary/entries/equipment/wand_of_lightning_bolts.json` |  |  |  | 1 | 1 |
| `wand_of_magic_detection` | `public/data/glossary/entries/equipment/wand_of_magic_detection.json` |  |  |  | 1 | 1 |
| `wand_of_magic_missiles` | `public/data/glossary/entries/equipment/wand_of_magic_missiles.json` |  |  |  | 1 | 1 |
| `wand_of_orcus` | `public/data/glossary/entries/equipment/wand_of_orcus.json` |  |  |  | 11 | 11 |
| `wand_of_paralysis` | `public/data/glossary/entries/equipment/wand_of_paralysis.json` |  |  |  | 2 | 2 |
| `wand_of_polymorph` | `public/data/glossary/entries/equipment/wand_of_polymorph.json` |  |  |  | 1 | 1 |
| `wand_of_pyrotechnics` | `public/data/glossary/entries/equipment/wand_of_pyrotechnics.json` |  |  |  | 1 | 1 |
| `wand_of_secrets` | `public/data/glossary/entries/equipment/wand_of_secrets.json` |  |  |  | 1 | 1 |
| `wand_of_web` | `public/data/glossary/entries/equipment/wand_of_web.json` |  |  |  | 1 | 1 |
| `wand_of_wonder` | `public/data/glossary/entries/equipment/wand_of_wonder.json` |  |  |  | 29 | 22 |
| `war_caster` | `public/data/glossary/entries/feats/war_caster.json` |  |  |  | 5 | 4 |
| `war_domain_subclass` | `public/data/glossary/entries/classes/cleric_subclasses/war_domain.json` |  |  |  |  | 3 |
| `warforged` | `public/data/glossary/entries/races/warforged.json` |  |  |  | 6 | 3 |
| `warlock` | `public/data/glossary/entries/classes/warlock.json` |  |  |  |  | 6 |
| `warlock_spell_list` | `public/data/glossary/entries/classes/warlock_spell_list.json` |  |  |  |  | 2 |
| `warrior_of_mercy_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_mercy.json` |  |  |  |  | 3 |
| `warrior_of_shadow_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_shadow.json` |  |  |  |  | 5 |
| `warrior_of_the_elements_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_the_elements.json` |  |  |  |  | 4 |
| `warrior_of_the_open_hand_subclass` | `public/data/glossary/entries/classes/monk_subclasses/warrior_of_the_open_hand.json` |  |  |  |  | 4 |
| `water_genasi` | `public/data/glossary/entries/races/water_genasi.json` |  |  |  | 5 | 4 |
| `wave` | `public/data/glossary/entries/equipment/wave.json` |  |  |  | 6 | 6 |
| `wayfarer` | `public/data/glossary/entries/backgrounds/wayfarer.json` |  |  |  | 10 | 9 |
| `wayfarer_human` | `public/data/glossary/entries/races/dragonmark_variants/wayfarer_human.json` |  |  |  | 13 | 3 |
| `weapon_master` | `public/data/glossary/entries/feats/weapon_master.json` |  |  |  | 1 | 1 |
| `weaver_s_tools` | `public/data/glossary/entries/equipment/weaver_s_tools.json` |  |  |  | 12 | 12 |
| `webs` | `public/data/glossary/entries/rules/webs.json` |  |  |  | 5 | 5 |
| `well_of_many_worlds` | `public/data/glossary/entries/equipment/well_of_many_worlds.json` |  |  |  | 2 | 1 |
| `whelm` | `public/data/glossary/entries/equipment/whelm.json` |  |  |  | 5 | 5 |
| `whispers_of_the_grave` | `public/data/glossary/entries/rules/whispers_of_the_grave.json` |  |  |  | 1 | 1 |
| `white_dragonborn` | `public/data/glossary/entries/races/dragonborn_ancestries/white.json` |  |  |  | 14 | 3 |
| `wild_magic_subclass` | `public/data/glossary/entries/classes/sorcerer_subclasses/wild_magic_sorcery.json` |  |  |  |  | 2 |
| `wildhunt_shifter` | `public/data/glossary/entries/races/shifter_variants/wildhunt.json` |  |  |  | 12 | 3 |
| `wind_fan` | `public/data/glossary/entries/equipment/wind_fan.json` |  |  |  | 1 | 1 |
| `winged_boots` | `public/data/glossary/entries/equipment/winged_boots.json` |  |  |  | 2 | 2 |
| `wings_of_flying` | `public/data/glossary/entries/equipment/wings_of_flying.json` |  |  |  | 3 | 2 |
| `winter_eladrin` | `public/data/glossary/entries/races/eladrin_seasons/winter.json` |  |  |  | 16 | 5 |
| `wisdom` | `public/data/glossary/entries/rules/wisdom.json` |  |  |  |  | 3 |
| `witch_sight` | `public/data/glossary/entries/rules/witch_sight.json` |  |  |  | 1 | 1 |
| `wizard` | `public/data/glossary/entries/classes/wizard.json` |  |  |  |  | 7 |
| `wizard_spell_list` | `public/data/glossary/entries/classes/wizard_spell_list.json` |  |  |  |  | 2 |
| `wood_elf` | `public/data/glossary/entries/races/elf_lineages/wood_elf.json` |  |  |  | 5 | 5 |
| `woodcarver_s_tools` | `public/data/glossary/entries/equipment/woodcarver_s_tools.json` |  |  |  | 12 | 12 |
| `wordweaver_gnome` | `public/data/glossary/entries/races/dragonmark_variants/wordweaver_gnome.json` |  |  |  | 23 | 3 |
| `yellow_mold` | `public/data/glossary/entries/rules/yellow_mold.json` |  |  |  | 2 | 2 |
| `yuan_ti` | `public/data/glossary/entries/races/yuan_ti.json` |  |  |  | 12 | 4 |

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/glossary/GLOSSARY_LINK_SURFACES_INVENTORY.md","sha256WithoutMarker":"ec571508e7b99b63ef741cb09d8b12b77686d679ed0f6d387b39ad735f69bc18","markedAtUtc":"2026-06-25T22:29:38.306Z"} -->
