# Spell Markdown Parity Report

Generated: 2026-05-21T00:40:48.004Z
Markdown files scanned: 459
Total mismatches: 801
Grouped mismatch buckets: 19

This report is grouped so arbitration can start with repeated mismatch families instead of isolated spell noise.

## Grouped Mismatches

### markdown-vs-json / effects structure

- Family: `markdown-vs-json`
- Kind: `legacy-effect-collapse`
- Occurrences: 218
- Distinct spells: 218
- Sample spells: booming-blade, chill-touch, create-bonfire, green-flame-blade, lightning-lure, magic-stone, mind-sliver, mold-earth, produce-flame, ray-of-frost
- Sample findings:
  - Booming Blade still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Chill Touch still uses legacy single-effect markdown labels while the JSON contains 3 separate effect objects.
  - Create Bonfire still uses legacy single-effect markdown labels while the JSON contains 3 separate effect objects.
  - Green-Flame Blade still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Lightning Lure still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.

### markdown-vs-json / Sub-Classes

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 192
- Distinct spells: 192
- Sample spells: acid-splash, blade-ward, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, friends, frostbite, guidance
- Sample findings:
  - Acid Splash records Sub-Classes as "No Subclass Entries" in markdown but "None" in JSON.
  - Blade Ward records Sub-Classes as "No Subclass Entries" in markdown but "None" in JSON.
  - Dancing Lights records Sub-Classes as "No Subclass Entries" in markdown but "None" in JSON.
  - Druidcraft records Sub-Classes as "No Subclass Entries" in markdown but "None" in JSON.
  - Eldritch Blast records Sub-Classes as "No Subclass Entries" in markdown but "None" in JSON.

### markdown-vs-json / Higher Levels

- Family: `markdown-vs-json`
- Kind: `presence-mismatch`
- Occurrences: 136
- Distinct spells: 136
- Sample spells: blade-ward, dancing-lights, druidcraft, elementalism, friends, guidance, light, mage-hand, mending, message
- Sample findings:
  - Blade Ward has Higher Levels marked present in markdown but missing in JSON.
  - Dancing Lights has Higher Levels marked present in markdown but missing in JSON.
  - Druidcraft has Higher Levels marked present in markdown but missing in JSON.
  - Elementalism has Higher Levels marked present in markdown but missing in JSON.
  - Friends has Higher Levels marked present in markdown but missing in JSON.

### markdown-vs-json / Effect Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 68
- Distinct spells: 68
- Sample spells: aid, alter-self, barkskin, darkvision, enhance-ability, enthrall, find-steed, hold-person, lesser-restoration, levitate
- Sample findings:
  - Aid records Effect Type as "BUFF" in markdown but "DEFENSIVE" in JSON.
  - Alter Self records Effect Type as "BUFF" in markdown but "UTILITY" in JSON.
  - Barkskin records Effect Type as "BUFF" in markdown but "DEFENSIVE" in JSON.
  - Darkvision records Effect Type as "BUFF" in markdown but "UTILITY" in JSON.
  - Enhance Ability records Effect Type as "BUFF" in markdown but "UTILITY" in JSON.

### markdown-vs-json / Valid Targets

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 62
- Distinct spells: 62
- Sample spells: animal-messenger, arcane-lock, barkskin, beast-sense, continual-flame, darkvision, enhance-ability, enlarge-reduce, gentle-repose, hold-person
- Sample findings:
  - Animal Messenger records Valid Targets as "beast_tiny" in markdown but "creatures" in JSON.
  - Arcane Lock records Valid Targets as "object" in markdown but "objects" in JSON.
  - Barkskin records Valid Targets as "willing_creature" in markdown but "allies" in JSON.
  - Beast Sense records Valid Targets as "willing_beast" in markdown but "creatures" in JSON.
  - Continual Flame records Valid Targets as "object" in markdown but "objects" in JSON.

### markdown-vs-json / Save Outcome

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 28
- Distinct spells: 28
- Sample spells: acid-splash, animal-messenger, enlarge-reduce, enthrall, levitate, sacred-flame, sword-burst, thunderclap, toll-the-dead, word-of-radiance
- Sample findings:
  - Acid Splash records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Sacred Flame records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Sword Burst records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Thunderclap records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Toll the Dead records Save Outcome as "not_applicable" in markdown but "none" in JSON.

### markdown-vs-json / Targeting Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 24
- Distinct spells: 24
- Sample spells: control-winds, danse-macabre, dominate-person, dream, enervation, enhance-ability, greater-restoration, passwall, raise-dead, rarys-telepathic-bond
- Sample findings:
  - Enhance Ability records Targeting Type as "single" in markdown but "multi" in JSON.
  - Control Winds records Targeting Type as "area" in markdown but "single" in JSON.
  - Danse Macabre records Targeting Type as "creature" in markdown but "single" in JSON.
  - Dominate Person records Targeting Type as "creature" in markdown but "single" in JSON.
  - Dream records Targeting Type as "creature" in markdown but "single" in JSON.

### markdown-vs-json / Combat Cost

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 23
- Distinct spells: 23
- Sample spells: commune, commune-with-nature, creation, dream, fabricate, hallow, hallucinatory-terrain, infernal-calling, legend-lore, mordenkainens-private-sanctum
- Sample findings:
  - Fabricate records Combat Cost as "not_applicable" in markdown but "action" in JSON.
  - Hallucinatory Terrain records Combat Cost as "not_applicable" in markdown but "action" in JSON.
  - Mordenkainen's Private Sanctum records Combat Cost as "not_applicable" in markdown but "action" in JSON.
  - Commune with Nature records Combat Cost as "long_cast" in markdown but "action" in JSON.
  - Commune records Combat Cost as "long_cast" in markdown but "action" in JSON.

### markdown-vs-json / Utility Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 20
- Distinct spells: 20
- Sample spells: arcane-vigor, catnap, control-water, death-ward, dimension-door, freedom-of-movement, giant-insect, hallucinatory-terrain, leomunds-secret-chest, mass-healing-word
- Sample findings:
  - Arcane Vigor records Utility Type as "other" in markdown but "" in JSON.
  - Catnap records Utility Type as "other" in markdown but "" in JSON.
  - Mass Healing Word records Utility Type as "other" in markdown but "" in JSON.
  - Control Water records Utility Type as "environmental_control" in markdown but "control" in JSON.
  - Death Ward records Utility Type as "defensive" in markdown but "other" in JSON.

### markdown-vs-json / Target Filter Creature Types

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 7
- Distinct spells: 7
- Sample spells: animal-messenger, beast-sense, dominate-person, fast-friends, hold-person, plant-growth, speak-with-plants
- Sample findings:
  - Animal Messenger is missing the structured markdown field Target Filter Creature Types even though the JSON provides Beast.
  - Beast Sense is missing the structured markdown field Target Filter Creature Types even though the JSON provides Beast.
  - Hold Person is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.
  - Fast Friends is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.
  - Plant Growth is missing the structured markdown field Target Filter Creature Types even though the JSON provides Plant.

### markdown-vs-json / Defense Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: aid, barkskin, haste, mage-armor, shield-of-faith
- Sample findings:
  - Mage Armor is missing the structured markdown field Defense Type even though the JSON provides set_base_ac.
  - Shield of Faith is missing the structured markdown field Defense Type even though the JSON provides ac_bonus.
  - Aid is missing the structured markdown field Defense Type even though the JSON provides temporary_hp.
  - Barkskin is missing the structured markdown field Defense Type even though the JSON provides ac_minimum.
  - Haste is missing the structured markdown field Defense Type even though the JSON provides ac_bonus.

### markdown-vs-json / Healing Dice

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: arcane-vigor, cure-wounds, mass-cure-wounds, mass-healing-word, prayer-of-healing
- Sample findings:
  - Cure Wounds is missing the structured markdown field Healing Dice even though the JSON provides 2d8.
  - Arcane Vigor is missing the structured markdown field Healing Dice even though the JSON provides 1_or_2_hit_dice+spellcasting_ability_modifier.
  - Prayer of Healing is missing the structured markdown field Healing Dice even though the JSON provides 2d8.
  - Mass Healing Word is missing the structured markdown field Healing Dice even though the JSON provides 2d4.
  - Mass Cure Wounds is missing the structured markdown field Healing Dice even though the JSON provides 3d8 + spellcasting ability modifier.

### markdown-vs-json / Temporary HP

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: arcane-vigor, cure-wounds, healing-word, mass-healing-word, prayer-of-healing
- Sample findings:
  - Cure Wounds is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Healing Word is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Arcane Vigor is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Prayer of Healing is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Mass Healing Word is missing the structured markdown field Temporary HP even though the JSON provides false.

### markdown-vs-json / Line of Sight

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 2
- Distinct spells: 2
- Sample spells: antimagic-field, glibness
- Sample findings:
  - Antimagic Field records Line of Sight as "not_applicable" in markdown but "false" in JSON.
  - Glibness is missing the structured markdown field Line of Sight even though the JSON provides false.

### markdown-vs-json / Targeting Max

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 2
- Distinct spells: 2
- Sample spells: mass-cure-wounds, rarys-telepathic-bond
- Sample findings:
  - Mass Cure Wounds is missing the structured markdown field Targeting Max even though the JSON provides 6.
  - Rary's Telepathic Bond is missing the structured markdown field Targeting Max even though the JSON provides 8.

### markdown-vs-json / Description

- Family: `markdown-vs-json`
- Kind: `presence-mismatch`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: galders-speedy-courier
- Sample findings:
  - Galders Speedy Courier has Description marked present in markdown but missing in JSON.

### markdown-vs-json / Light Dim Radius

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: dancing-lights
- Sample findings:
  - Dancing Lights is missing the structured markdown field Light Dim Radius even though the JSON provides 10.

### markdown-vs-json / Reaction Trigger

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: counterspell
- Sample findings:
  - Counterspell records Reaction Trigger as "when you see a creature within 60 feet of you casting a spell" in markdown but "" in JSON.

### markdown-vs-json / Terrain Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: spike-growth
- Sample findings:
  - Spike Growth is missing the structured markdown field Terrain Type even though the JSON provides damaging.
