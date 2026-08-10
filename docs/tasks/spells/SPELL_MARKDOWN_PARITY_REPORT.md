# Spell Markdown Parity Report

Generated: 2026-08-01T00:52:45.628Z
Markdown files scanned: 516
Total mismatches: 891
Grouped mismatch buckets: 21

This report is grouped so arbitration can start with repeated mismatch families instead of isolated spell noise.

## Grouped Mismatches

### markdown-vs-json / effects structure

- Family: `markdown-vs-json`
- Kind: `legacy-effect-collapse`
- Occurrences: 239
- Distinct spells: 239
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
- Occurrences: 187
- Distinct spells: 187
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
- Occurrences: 125
- Distinct spells: 125
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
- Occurrences: 70
- Distinct spells: 70
- Sample spells: aid, bane, barkskin, bless, darkvision, enhance-ability, enthrall, find-steed, hold-person, lesser-restoration
- Sample findings:
  - Bane records Effect Type as "STATUS_CONDITION" in markdown but "ATTACK_ROLL_MODIFIER" in JSON.
  - Bless records Effect Type as "STATUS_CONDITION" in markdown but "ATTACK_ROLL_MODIFIER" in JSON.
  - Aid records Effect Type as "BUFF" in markdown but "DEFENSIVE" in JSON.
  - Barkskin records Effect Type as "BUFF" in markdown but "DEFENSIVE" in JSON.
  - Darkvision records Effect Type as "BUFF" in markdown but "UTILITY" in JSON.

### markdown-vs-json / Utility Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 60
- Distinct spells: 60
- Sample spells: arcane-vigor, catnap, create-food-and-water, enemies-abound, galders-tower, knock, leomunds-tiny-hut, ray-of-enfeeblement, rope-trick, summon-beast
- Sample findings:
  - Arcane Vigor records Utility Type as "other" in markdown but "" in JSON.
  - Knock records Utility Type as "other" in markdown but "control" in JSON.
  - Ray of Enfeeblement records Utility Type as "control" in markdown but "" in JSON.
  - Rope Trick records Utility Type as "other" in markdown but "creation" in JSON.
  - Summon Beast records Utility Type as "other" in markdown but "" in JSON.

### markdown-vs-json / Valid Targets

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 60
- Distinct spells: 60
- Sample spells: animal-messenger, arcane-lock, barkskin, beast-sense, continual-flame, darkness, darkvision, enhance-ability, gentle-repose, hold-person
- Sample findings:
  - Animal Messenger records Valid Targets as "beast_tiny" in markdown but "creatures" in JSON.
  - Arcane Lock records Valid Targets as "object" in markdown but "objects" in JSON.
  - Barkskin records Valid Targets as "willing_creature" in markdown but "allies" in JSON.
  - Beast Sense records Valid Targets as "willing_beast" in markdown but "creatures" in JSON.
  - Continual Flame records Valid Targets as "object" in markdown but "objects" in JSON.

### markdown-vs-json / missing json file

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 43
- Distinct spells: 43
- Sample spells: acid-splash.scenarios, blade-ward.scenarios, booming-blade.scenarios, chill-touch.scenarios, create-bonfire.scenarios, dancing-lights.scenarios, druidcraft.scenarios, eldritch-blast.scenarios, elementalism.scenarios, fire-bolt.scenarios
- Sample findings:
  - acid-splash.scenarios has a markdown reference file but no matching spell JSON file was found at the expected level path.
  - blade-ward.scenarios has a markdown reference file but no matching spell JSON file was found at the expected level path.
  - booming-blade.scenarios has a markdown reference file but no matching spell JSON file was found at the expected level path.
  - chill-touch.scenarios has a markdown reference file but no matching spell JSON file was found at the expected level path.
  - create-bonfire.scenarios has a markdown reference file but no matching spell JSON file was found at the expected level path.

### markdown-vs-json / Save Outcome

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 27
- Distinct spells: 27
- Sample spells: acid-splash, animal-messenger, enthrall, levitate, ray-of-enfeeblement, sacred-flame, sword-burst, thunderclap, toll-the-dead, word-of-radiance
- Sample findings:
  - Acid Splash records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Sacred Flame records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Sword Burst records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Thunderclap records Save Outcome as "not_applicable" in markdown but "none" in JSON.
  - Toll the Dead records Save Outcome as "not_applicable" in markdown but "none" in JSON.

### markdown-vs-json / Targeting Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 26
- Distinct spells: 26
- Sample spells: conjure-animals, control-winds, danse-macabre, dominate-person, dream, enervation, enhance-ability, greater-restoration, incite-greed, passwall
- Sample findings:
  - Enhance Ability records Targeting Type as "single" in markdown but "multi" in JSON.
  - Conjure Animals records Targeting Type as "area" in markdown but "point" in JSON.
  - Incite Greed records Targeting Type as "single" in markdown but "multi" in JSON.
  - Control Winds records Targeting Type as "area" in markdown but "single" in JSON.
  - Danse Macabre records Targeting Type as "creature" in markdown but "single" in JSON.

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

### markdown-vs-json / Healing Dice

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 6
- Distinct spells: 6
- Sample spells: arcane-vigor, cure-wounds, mass-cure-wounds, mass-healing-word, power-word-fortify, prayer-of-healing
- Sample findings:
  - Cure Wounds is missing the structured markdown field Healing Dice even though the JSON provides 2d8.
  - Arcane Vigor is missing the structured markdown field Healing Dice even though the JSON provides 1_or_2_hit_dice+spellcasting_ability_modifier.
  - Prayer of Healing is missing the structured markdown field Healing Dice even though the JSON provides 2d8.
  - Mass Healing Word is missing the structured markdown field Healing Dice even though the JSON provides 2d4.
  - Mass Cure Wounds is missing the structured markdown field Healing Dice even though the JSON provides 3d8 + spellcasting ability modifier.

### markdown-vs-json / Target Filter Creature Types

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 6
- Distinct spells: 6
- Sample spells: animal-messenger, beast-sense, dominate-person, fast-friends, hold-person, speak-with-plants
- Sample findings:
  - Animal Messenger is missing the structured markdown field Target Filter Creature Types even though the JSON provides Beast.
  - Beast Sense is missing the structured markdown field Target Filter Creature Types even though the JSON provides Beast.
  - Hold Person is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.
  - Fast Friends is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.
  - Speak with Plants is missing the structured markdown field Target Filter Creature Types even though the JSON provides Plant.

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

### markdown-vs-json / Temporary HP

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: arcane-vigor, cure-wounds, healing-word, power-word-fortify, prayer-of-healing
- Sample findings:
  - Cure Wounds is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Healing Word is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Arcane Vigor is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Prayer of Healing is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Power Word Fortify is missing the structured markdown field Temporary HP even though the JSON provides true.

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

### markdown-vs-json / Damage Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: forbiddance
- Sample findings:
  - Forbiddance records Damage Type as "Radiant/Necrotic" in markdown but "Radiant or Necrotic" in JSON.

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
  - Counterspell records Reaction Trigger as "when you see a creature within 60 feet of you casting a spell" in markdown but "which you take when you see a creature within 60 feet of you casting a spell" in JSON.

### markdown-vs-json / Save Stat

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: elemental-bane
- Sample findings:
  - Elemental Bane is missing the structured markdown field Save Stat even though the JSON provides Constitution.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/spells/SPELL_MARKDOWN_PARITY_REPORT.md","sha256WithoutMarker":"121fb2fa5752f1eb33612423f733a443fddff2e4098ed427523dd7a04a76c431","markedAtUtc":"2026-08-09T20:14:15.682Z"} -->
