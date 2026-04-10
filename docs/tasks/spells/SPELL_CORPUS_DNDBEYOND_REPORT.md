# Spell Corpus D&D Beyond Report

## Status Note

This file is now a historical canonical-review artifact, not the live supported-corpus
truth surface.

Why:
- it was generated on `2026-03-23`
- it still reflects the older `469`-spell corpus
- the supported corpus now stands at `459` spells
- the live spell-truth lane has since moved on to:
  - `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - `SPELL_CANONICAL_SYNC_FLAGS.md`

So this report should still be kept as evidence of the earlier corpus-wide D&D Beyond
review pass, but it should not be mistaken for the current active spell completion surface.

Generated: 2026-03-23T13:54:02.602Z
Local spells reviewed: 469
D&D Beyond listing entries scraped: 935
Matched local spells: 458
Unmatched local spells: 11
Total mismatches: 861

This report compares local spell JSON against public D&D Beyond top-level spell facts.
It does not claim to verify deeper local effect-object modeling.

## Grouped Mismatches

### json-vs-dndbeyond / subClassesVerification

- Field: `subClassesVerification`
- Occurrences: 359
- Distinct spells: 359
- Sample spells: acid-splash, chill-touch, create-bonfire, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, frostbite, guidance
- Sample findings:
  - Acid Splash still marks subclass/domain access as "unverified" locally even though this D&D Beyond pass verified the visible class-access surface.
  - Chill Touch still marks subclass/domain access as "unverified" locally even though this D&D Beyond pass verified the visible class-access surface.
  - Create Bonfire still marks subclass/domain access as "unverified" locally even though this D&D Beyond pass verified the visible class-access surface.
  - Dancing Lights still marks subclass/domain access as "unverified" locally even though this D&D Beyond pass verified the visible class-access surface.
  - Druidcraft still marks subclass/domain access as "unverified" locally even though this D&D Beyond pass verified the visible class-access surface.

### json-vs-dndbeyond / subClasses

- Field: `subClasses`
- Occurrences: 201
- Distinct spells: 201
- Sample spells: chill-touch, dancing-lights, fire-bolt, mage-hand, message, minor-illusion, ray-of-frost, sacred-flame, shocking-grasp, thaumaturgy
- Sample findings:
  - Chill Touch stores subclass/domain access as "None" locally but D&D Beyond exposes "Illrigger - Architect of Ruin".
  - Dancing Lights stores subclass/domain access as "None" locally but D&D Beyond exposes "Illrigger - Architect of Ruin".
  - Fire Bolt stores subclass/domain access as "None" locally but D&D Beyond exposes "Illrigger - Architect of Ruin".
  - Mage Hand stores subclass/domain access as "None" locally but D&D Beyond exposes "Rogue - Arcane Trickster".
  - Message stores subclass/domain access as "None" locally but D&D Beyond exposes "Illrigger - Architect of Ruin".

### json-vs-dndbeyond / detail fetch incomplete

- Field: `detail fetch incomplete`
- Occurrences: 95
- Distinct spells: 95
- Sample spells: blade-ward, booming-blade, friends, green-flame-blade, lightning-lure, mind-sliver, primal-savagery, sword-burst, thorn-whip, thunderclap
- Sample findings:
  - Blade Ward matched a D&D Beyond listing row, but the fetched public detail page did not expose usable top-level spell fields for comparison.
  - Booming Blade matched a D&D Beyond listing row, but the fetched public detail page did not expose usable top-level spell fields for comparison.
  - Friends matched a D&D Beyond listing row, but the fetched public detail page did not expose usable top-level spell fields for comparison.
  - Green-Flame Blade matched a D&D Beyond listing row, but the fetched public detail page did not expose usable top-level spell fields for comparison.
  - Lightning Lure matched a D&D Beyond listing row, but the fetched public detail page did not expose usable top-level spell fields for comparison.

### json-vs-dndbeyond / range/area

- Field: `range/area`
- Occurrences: 80
- Distinct spells: 80
- Sample spells: elementalism, mage-hand, minor-illusion, catapult, detect-evil-and-good, detect-magic, detect-poison-and-disease, goodberry, ice-knife, silent-image
- Sample findings:
  - Elementalism stores range/area as "30 ft." locally but D&D Beyond lists "30 ft. (5 ft. *)".
  - Mage Hand stores range/area as "30 ft. (5 ft.)" locally but D&D Beyond lists "30 ft.".
  - Minor Illusion stores range/area as "30 ft. (5 ft.)" locally but D&D Beyond lists "30 ft. (5 ft. *)".
  - Catapult stores range/area as "60 ft. (90 ft.)" locally but D&D Beyond lists "60 ft.".
  - Detect Evil and Good stores range/area as "Self" locally but D&D Beyond lists "Self (30 ft.)".

### json-vs-dndbeyond / classes

- Field: `classes`
- Occurrences: 49
- Distinct spells: 49
- Sample spells: elementalism, true-strike, detect-evil-and-good, disguise-self, aid, alter-self, arcane-lock, blur, continual-flame, darkvision
- Sample findings:
  - Elementalism stores base class access as "Druid, Sorcerer, Wizard" locally but D&D Beyond exposes "Artificer, Druid, Sorcerer, Wizard".
  - True Strike stores base class access as "Bard, Sorcerer, Warlock, Wizard" locally but D&D Beyond exposes "Artificer, Bard, Sorcerer, Warlock, Wizard".
  - Detect Evil and Good stores base class access as "Cleric, Paladin, Warlock, Wizard" locally but D&D Beyond exposes "Cleric, Paladin".
  - Disguise Self stores base class access as "Artificer, Barbarian, Bard, Cleric, Druid, Fighter, Monk, Paladin, Ranger, Rogue, Sorcerer, Warlock, Wizard" locally but D&D Beyond exposes "Artificer, Bard, Sorcerer, Wizard".
  - Aid stores base class access as "Bard, Cleric, Druid, Paladin, Ranger" locally but D&D Beyond exposes "Artificer, Bard, Cleric, Druid, Paladin, Ranger".

### json-vs-dndbeyond / casting time

- Field: `casting time`
- Occurrences: 33
- Distinct spells: 33
- Sample spells: produce-flame, alarm, comprehend-languages, detect-magic, detect-poison-and-disease, find-familiar, identify, illusory-script, purify-food-and-drink, speak-with-animals
- Sample findings:
  - Produce Flame stores casting time as "1 Action" locally but D&D Beyond lists "1 Bonus Action".
  - Alarm stores casting time as "1 Minute" locally but D&D Beyond lists "1 Minute Ritual".
  - Comprehend Languages stores casting time as "1 Action" locally but D&D Beyond lists "1 Action Ritual".
  - Detect Magic stores casting time as "1 Action" locally but D&D Beyond lists "1 Action Ritual".
  - Detect Poison and Disease stores casting time as "1 Action" locally but D&D Beyond lists "1 Action Ritual".

### json-vs-dndbeyond / duration

- Field: `duration`
- Occurrences: 21
- Distinct spells: 21
- Sample spells: chill-touch, light, searing-smite, sleep, pyrotechnics, spiritual-weapon, glyph-of-warding, leomunds-secret-chest, dream, hallow
- Sample findings:
  - Chill Touch stores duration as "1 Round" locally but D&D Beyond lists "Instantaneous".
  - Light stores duration as "60 Minutes" locally but D&D Beyond lists "1 Hour".
  - Searing Smite stores duration as "Concentration 1 Minute" locally but D&D Beyond lists "1 Minute".
  - Sleep stores duration as "1 Minute" locally but D&D Beyond lists "Concentration 1 Minute".
  - Pyrotechnics stores duration as "1 Minute" locally but D&D Beyond lists "Instantaneous".

### json-vs-dndbeyond / listing match

- Field: `listing match`
- Occurrences: 11
- Distinct spells: 11
- Sample spells: sapping-sting, pulse-wave, gravity-sinkhole, temporal-shunt, gravity-fissure, arcane-sword, tether-essence, dark-star, reality-break, ravenous-void
- Sample findings:
  - Sapping Sting could not be mapped to a public D&D Beyond listing row with the current corpus matcher.
  - Pulse Wave could not be mapped to a public D&D Beyond listing row with the current corpus matcher.
  - Gravity Sinkhole could not be mapped to a public D&D Beyond listing row with the current corpus matcher.
  - Temporal Shunt could not be mapped to a public D&D Beyond listing row with the current corpus matcher.
  - Gravity Fissure could not be mapped to a public D&D Beyond listing row with the current corpus matcher.

### json-vs-dndbeyond / school

- Field: `school`
- Occurrences: 8
- Distinct spells: 8
- Sample spells: dancing-lights, mass-healing-word, sending, reincarnate, contingency, heal, earthquake, glibness
- Sample findings:
  - Dancing Lights stores school as "Evocation" locally but D&D Beyond lists "Illusion".
  - Mass Healing Word stores school as "Evocation" locally but D&D Beyond lists "Abjuration".
  - Sending stores school as "Evocation" locally but D&D Beyond lists "Divination".
  - Reincarnate stores school as "Necromancy" locally but D&D Beyond lists "Transmutation".
  - Contingency stores school as "Evocation" locally but D&D Beyond lists "Abjuration".

### json-vs-dndbeyond / components

- Field: `components`
- Occurrences: 4
- Distinct spells: 4
- Sample spells: message, resistance, feather-fall, mass-suggestion
- Sample findings:
  - Message stores components as "V, S, M *" locally but D&D Beyond lists "S, M *".
  - Resistance stores components as "V, S, M *" locally but D&D Beyond lists "V, S".
  - Feather Fall stores components as "V, M *" locally but D&D Beyond lists "V, M **".
  - Mass Suggestion stores components as "V, S, M *" locally but D&D Beyond lists "V, M *".

## Unmatched Local Spells

- `0` Sapping Sting (`sapping-sting`)
- `3` Pulse Wave (`pulse-wave`)
- `4` Gravity Sinkhole (`gravity-sinkhole`)
- `5` Temporal Shunt (`temporal-shunt`)
- `6` Gravity Fissure (`gravity-fissure`)
- `7` Arcane Sword (`arcane-sword`)
- `7` Tether Essence (`tether-essence`)
- `8` Dark Star (`dark-star`)
- `8` Reality Break (`reality-break`)
- `9` Ravenous Void (`ravenous-void`)
- `9` Time Ravage (`time-ravage`)
