# Spell Markdown Parity Report

Generated: 2026-05-07T09:42:18.976Z
Markdown files scanned: 459
Total mismatches: 611
Grouped mismatch buckets: 23

This report is grouped so arbitration can start with repeated mismatch families instead of isolated spell noise.

## Grouped Mismatches

### markdown-vs-json / Effect Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 132
- Distinct spells: 132
- Sample spells: aid, alter-self, arcane-vigor, barkskin, blade-ward, blindness-deafness, calm-emotions, crown-of-madness, darkvision, enhance-ability
- Sample findings:
  - Blade Ward records Effect Type as "ATTACK_ROLL_MODIFIER" in markdown but "DEFENSIVE" in JSON.
  - Aid records Effect Type as "BUFF" in markdown but "DEFENSIVE" in JSON.
  - Alter Self records Effect Type as "BUFF" in markdown but "UTILITY" in JSON.
  - Arcane Vigor records Effect Type as "HEALING" in markdown but "UTILITY" in JSON.
  - Barkskin records Effect Type as "BUFF" in markdown but "DEFENSIVE" in JSON.

### markdown-vs-json / Valid Targets

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 98
- Distinct spells: 98
- Sample spells: animal-messenger, arcane-lock, barkskin, beast-sense, blindness-deafness, calm-emotions, continual-flame, crown-of-madness, darkvision, enhance-ability
- Sample findings:
  - Animal Messenger records Valid Targets as "beast_tiny" in markdown but "creatures" in JSON.
  - Arcane Lock records Valid Targets as "object" in markdown but "objects" in JSON.
  - Barkskin records Valid Targets as "willing_creature" in markdown but "allies" in JSON.
  - Beast Sense records Valid Targets as "willing_beast" in markdown but "creatures" in JSON.
  - Blindness/Deafness records Valid Targets as "creature" in markdown but "creatures" in JSON.

### markdown-vs-json / effects structure

- Family: `markdown-vs-json`
- Kind: `legacy-effect-collapse`
- Occurrences: 68
- Distinct spells: 68
- Sample spells: booming-blade, chill-touch, create-bonfire, frostbite, green-flame-blade, lightning-lure, magic-stone, mind-sliver, mold-earth, produce-flame
- Sample findings:
  - Booming Blade still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Chill Touch still uses legacy single-effect markdown labels while the JSON contains 3 separate effect objects.
  - Create Bonfire still uses legacy single-effect markdown labels while the JSON contains 3 separate effect objects.
  - Frostbite still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Green-Flame Blade still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.

### markdown-vs-json / Targeting Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 62
- Distinct spells: 62
- Sample spells: awaken, conjure-volley, control-winds, danse-macabre, dominate-person, dream, enervation, geas, greater-restoration, sickening-radiance
- Sample findings:
  - Sickening Radiance records Targeting Type as "area" in markdown but "single" in JSON.
  - Awaken records Targeting Type as "creature_or_object" in markdown but "single" in JSON.
  - Conjure Volley records Targeting Type as "area" in markdown but "single" in JSON.
  - Control Winds records Targeting Type as "area" in markdown but "single" in JSON.
  - Danse Macabre records Targeting Type as "creature" in markdown but "single" in JSON.

### markdown-vs-json / Duration Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 52
- Distinct spells: 52
- Sample spells: danse-macabre, dawn, dispel-evil-and-good, dominate-person, enervation, far-step, find-the-path, passwall, planar-binding, rarys-telepathic-bond
- Sample findings:
  - Danse Macabre records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Dawn records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Dispel Evil and Good records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Dominate Person records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Enervation records Duration Type as "concentration" in markdown but "timed" in JSON.

### markdown-vs-json / Combat Cost

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 50
- Distinct spells: 50
- Sample spells: awaken, commune, commune-with-nature, contact-other-plane, creation, dream, fabricate, geas, hallucinatory-terrain, mordenkainens-private-sanctum
- Sample findings:
  - Fabricate records Combat Cost as "none" in markdown but "action" in JSON.
  - Hallucinatory Terrain records Combat Cost as "none" in markdown but "action" in JSON.
  - Mordenkainen's Private Sanctum records Combat Cost as "none" in markdown but "action" in JSON.
  - Awaken records Combat Cost as "long" in markdown but "action" in JSON.
  - Commune with Nature records Combat Cost as "long" in markdown but "action" in JSON.

### markdown-vs-json / Sub-Classes

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 30
- Distinct spells: 30
- Sample spells: aid, bless, enlarge-reduce, enthrall, locate-animals-or-plants, longstrider, mirror-image, misty-step, see-invisibility, spike-growth
- Sample findings:
  - Bless records Sub-Classes as "Cleric - Life Domain, Cleric - Community Domain (HCS), Paladin - Oath of the River (OTTG)" in markdown but "Cleric - Community Domain (HCS), Cleric - Life Domain, Paladin - Oath of the River (OTTG)" in JSON.
  - Longstrider records Sub-Classes as "" in markdown but "None" in JSON.
  - Aid records Sub-Classes as "Cleric - Life Domain, Cleric - Peace Domain (TCoE), Paladin - Oath of Devotion, Sorcerer - Clockwork Sorcery, Sorcerer - Crimson Sorcery, Warlock - Celestial Patron, Cleric - Community Domain (HCS)" in markdown but "Cleric - Community Domain (HCS), Cleric - Life Domain, Cleric - Peace Domain (TCoE), Paladin - Oath of Devotion, Sorcerer - Clockwork Sorcery, Sorcerer - Crimson Sorcery, Warlock - Celestial Patron" in JSON.
  - Enlarge/Reduce records Sub-Classes as "" in markdown but "None" in JSON.
  - Enthrall records Sub-Classes as "" in markdown but "None" in JSON.

### markdown-vs-json / Save Outcome

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 23
- Distinct spells: 23
- Sample spells: blindness-deafness, calm-emotions, crown-of-madness, enlarge-reduce, enthrall, fast-friends, hold-person, levitate, suggestion, zone-of-truth
- Sample findings:
  - Blindness/Deafness records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Calm Emotions records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Crown of Madness records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Enlarge/Reduce records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Enthrall records Save Outcome as "negates" in markdown but "negates_condition" in JSON.

### markdown-vs-json / Higher Levels

- Family: `markdown-vs-json`
- Kind: `presence-mismatch`
- Occurrences: 21
- Distinct spells: 21
- Sample spells: astral-projection, blade-of-disaster, divine-favor, foresight, gate, imprisonment, invulnerability, mass-heal, mass-polymorph, skywrite
- Sample findings:
  - Divine Favor has Higher Levels marked missing in markdown but present in JSON.
  - Skywrite has Higher Levels marked missing in markdown but present in JSON.
  - Astral Projection has Higher Levels marked present in markdown but missing in JSON.
  - Blade of Disaster has Higher Levels marked present in markdown but missing in JSON.
  - Foresight has Higher Levels marked present in markdown but missing in JSON.

### markdown-vs-json / Utility Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 20
- Distinct spells: 20
- Sample spells: arcane-eye, control-water, death-ward, dimension-door, freedom-of-movement, giant-insect, hallucinatory-terrain, leomunds-secret-chest, mordenkainens-private-sanctum, otilukes-resilient-sphere
- Sample findings:
  - Arcane Eye records Utility Type as "scouting" in markdown but "sensory" in JSON.
  - Control Water records Utility Type as "environmental_control" in markdown but "control" in JSON.
  - Death Ward records Utility Type as "defensive" in markdown but "other" in JSON.
  - Dimension Door records Utility Type as "movement" in markdown but "other" in JSON.
  - Freedom of Movement records Utility Type as "movement" in markdown but "other" in JSON.

### markdown-vs-json / Target Filter Creature Types

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 10
- Distinct spells: 10
- Sample spells: animal-messenger, awaken, beast-sense, calm-emotions, crown-of-madness, dominate-person, fast-friends, hold-person, plant-growth, speak-with-plants
- Sample findings:
  - Animal Messenger is missing the structured markdown field Target Filter Creature Types even though the JSON provides Beast.
  - Beast Sense is missing the structured markdown field Target Filter Creature Types even though the JSON provides Beast.
  - Calm Emotions is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.
  - Crown of Madness is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.
  - Hold Person is missing the structured markdown field Target Filter Creature Types even though the JSON provides Humanoid.

### markdown-vs-json / Casting Time Unit

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 8
- Distinct spells: 8
- Sample spells: blade-of-disaster, divine-word, draconic-transformation, dream-of-the-blue-veil, far-step, holy-weapon, legend-lore, mirage-arcane
- Sample findings:
  - Far Step records Casting Time Unit as "bonus action" in markdown but "bonus_action" in JSON.
  - Holy Weapon records Casting Time Unit as "bonus action" in markdown but "bonus_action" in JSON.
  - Legend Lore records Casting Time Unit as "minutes" in markdown but "minute" in JSON.
  - Divine Word records Casting Time Unit as "bonus action" in markdown but "bonus_action" in JSON.
  - Draconic Transformation records Casting Time Unit as "bonus action" in markdown but "bonus_action" in JSON.

### markdown-vs-json / Duration Unit

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 8
- Distinct spells: 8
- Sample spells: conjure-elemental, contagion, dream-of-the-blue-veil, hold-monster, infernal-calling, maelstrom, mirage-arcane, mordenkainens-magnificent-mansion
- Sample findings:
  - Conjure Elemental records Duration Unit as "minutes" in markdown but "minute" in JSON.
  - Contagion records Duration Unit as "days" in markdown but "day" in JSON.
  - Hold Monster records Duration Unit as "minutes" in markdown but "minute" in JSON.
  - Infernal Calling records Duration Unit as "hours" in markdown but "hour" in JSON.
  - Maelstrom records Duration Unit as "minutes" in markdown but "minute" in JSON.

### markdown-vs-json / Defense Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 6
- Distinct spells: 6
- Sample spells: aid, barkskin, blade-ward, mage-armor, protection-from-evil-and-good, shield-of-faith
- Sample findings:
  - Blade Ward is missing the structured markdown field Defense Type even though the JSON provides resistance.
  - Mage Armor is missing the structured markdown field Defense Type even though the JSON provides set_base_ac.
  - Protection from Evil and Good is missing the structured markdown field Defense Type even though the JSON provides advantage_on_saves.
  - Shield of Faith is missing the structured markdown field Defense Type even though the JSON provides ac_bonus.
  - Aid is missing the structured markdown field Defense Type even though the JSON provides temporary_hp.

### markdown-vs-json / Damage Dice

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: conjure-barrage, cordon-of-arrows, feeblemind, guardian-of-faith, vitriolic-sphere
- Sample findings:
  - Cordon of Arrows records Damage Dice as "1d6" in markdown but "2d4" in JSON.
  - Conjure Barrage records Damage Dice as "3d8" in markdown but "5d8" in JSON.
  - Guardian of Faith is missing the structured markdown field Damage Dice even though the JSON provides 20.
  - Vitriolic Sphere is missing the structured markdown field Damage Dice even though the JSON provides 10d4.
  - Feeblemind records Damage Dice as "4d6" in markdown but "10d12" in JSON.

### markdown-vs-json / Temporary HP

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: cure-wounds, heal, healing-word, prayer-of-healing, regenerate
- Sample findings:
  - Cure Wounds is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Healing Word is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Prayer of Healing is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Heal is missing the structured markdown field Temporary HP even though the JSON provides false.
  - Regenerate is missing the structured markdown field Temporary HP even though the JSON provides false.

### markdown-vs-json / Damage Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 3
- Distinct spells: 3
- Sample spells: blade-barrier, conjure-barrage, vitriolic-sphere
- Sample findings:
  - Conjure Barrage records Damage Type as "weapon_damage_type" in markdown but "Force" in JSON.
  - Vitriolic Sphere is missing the structured markdown field Damage Type even though the JSON provides Acid.
  - Blade Barrier records Damage Type as "Slashing" in markdown but "Force" in JSON.

### markdown-vs-json / Line of Sight

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 3
- Distinct spells: 3
- Sample spells: antimagic-field, glibness, holy-aura
- Sample findings:
  - Antimagic Field records Line of Sight as "" in markdown but "false" in JSON.
  - Glibness is missing the structured markdown field Line of Sight even though the JSON provides false.
  - Holy Aura records Line of Sight as "" in markdown but "false" in JSON.

### markdown-vs-json / Healing Dice

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 2
- Distinct spells: 2
- Sample spells: cure-wounds, prayer-of-healing
- Sample findings:
  - Cure Wounds is missing the structured markdown field Healing Dice even though the JSON provides 2d8.
  - Prayer of Healing is missing the structured markdown field Healing Dice even though the JSON provides 2d8.

### markdown-vs-json / Reaction Trigger

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 2
- Distinct spells: 2
- Sample spells: counterspell, shining-smite
- Sample findings:
  - Shining Smite records Reaction Trigger as "immediately after you hit a creature with a weapon or Unarmed Strike" in markdown but "" in JSON.
  - Counterspell records Reaction Trigger as "when you see a creature within 60 feet of you casting a spell" in markdown but "" in JSON.

### markdown-vs-json / Light Dim Radius

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: dancing-lights
- Sample findings:
  - Dancing Lights is missing the structured markdown field Light Dim Radius even though the JSON provides 10.

### markdown-vs-json / Targeting Max

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: word-of-recall
- Sample findings:
  - Word of Recall is missing the structured markdown field Targeting Max even though the JSON provides 6.

### markdown-vs-json / Terrain Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: spike-growth
- Sample findings:
  - Spike Growth is missing the structured markdown field Terrain Type even though the JSON provides damaging.
