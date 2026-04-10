# Spell Markdown Parity Report

Generated: 2026-04-01T22:38:22.771Z
Markdown files scanned: 459
Total mismatches: 648
Grouped mismatch buckets: 25

This report is grouped so arbitration can start with repeated mismatch families instead of isolated spell noise.

## Grouped Mismatches

### markdown-vs-json / Effect Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 142
- Distinct spells: 142
- Sample spells: armor-of-agathys, arms-of-hadar, charm-person, color-spray, dissonant-whispers, ensnaring-strike, entangle, grease, guiding-bolt, hex
- Sample findings:
  - Armor of Agathys is missing the structured markdown field Effect Type even though the JSON provides DEFENSIVE.
  - Arms of Hadar is missing the structured markdown field Effect Type even though the JSON provides DAMAGE.
  - Charm Person is missing the structured markdown field Effect Type even though the JSON provides STATUS_CONDITION.
  - Color Spray is missing the structured markdown field Effect Type even though the JSON provides UTILITY.
  - Dissonant Whispers is missing the structured markdown field Effect Type even though the JSON provides DAMAGE.

### markdown-vs-json / Valid Targets

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 101
- Distinct spells: 101
- Sample spells: animal-messenger, arcane-lock, barkskin, beast-sense, blindness-deafness, calm-emotions, continual-flame, crown-of-madness, darkvision, enhance-ability
- Sample findings:
  - Animal Messenger records Valid Targets as "beast_tiny" in markdown but "creatures" in JSON.
  - Arcane Lock records Valid Targets as "object" in markdown but "objects" in JSON.
  - Barkskin records Valid Targets as "willing_creature" in markdown but "allies" in JSON.
  - Beast Sense records Valid Targets as "willing_beast" in markdown but "creatures" in JSON.
  - Blindness/Deafness records Valid Targets as "creature" in markdown but "creatures" in JSON.

### markdown-vs-json / Targeting Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 65
- Distinct spells: 65
- Sample spells: awaken, danse-macabre, dominate-person, dream, enervation, geas, greater-restoration, hold-monster, holy-weapon, wall-of-fire
- Sample findings:
  - Wall of Fire records Targeting Type as "area" in markdown but "multi" in JSON.
  - Awaken records Targeting Type as "creature_or_object" in markdown but "single" in JSON.
  - Danse Macabre records Targeting Type as "creature" in markdown but "single" in JSON.
  - Dominate Person records Targeting Type as "creature" in markdown but "single" in JSON.
  - Dream records Targeting Type as "creature" in markdown but "single" in JSON.

### markdown-vs-json / Duration Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 58
- Distinct spells: 58
- Sample spells: danse-macabre, dawn, dispel-evil-and-good, dominate-person, enervation, far-step, hallow, leomunds-secret-chest, passwall, planar-binding
- Sample findings:
  - Leomund's Secret Chest records Duration Type as "permanent" in markdown but "special" in JSON.
  - Danse Macabre records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Dawn records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Dispel Evil and Good records Duration Type as "concentration" in markdown but "timed" in JSON.
  - Dominate Person records Duration Type as "concentration" in markdown but "timed" in JSON.

### markdown-vs-json / Sub-Classes

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 55
- Distinct spells: 55
- Sample spells: bless, chromatic-orb, color-spray, detect-magic, divine-favor, fog-cloud, longstrider, purify-food-and-drink, shield-of-faith, tashas-hideous-laughter
- Sample findings:
  - Bless records Sub-Classes as "Cleric - Life Domain, Cleric - Community Domain (HCS), Paladin - Oath of the River (OTTG)" in markdown but "None" in JSON.
  - Chromatic Orb records Sub-Classes as "Sorcerer - Draconic Sorcery" in markdown but "None" in JSON.
  - Color Spray records Sub-Classes as "" in markdown but "None" in JSON.
  - Detect Magic records Sub-Classes as "Cleric - Arcana Domain (SCAG), Illrigger - Architect of Ruin, Paladin (Legacy) - Oath of the Spelldrinker, Paladin - Oath of the Spelldrinker, Paladin - Oath of the Watchers (TCoE)" in markdown but "None" in JSON.
  - Divine Favor records Sub-Classes as "" in markdown but "None" in JSON.

### markdown-vs-json / Combat Cost

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 51
- Distinct spells: 51
- Sample spells: awaken, commune, commune-with-nature, contact-other-plane, counterspell, creation, dream, fabricate, hallucinatory-terrain, mordenkainens-private-sanctum
- Sample findings:
  - Counterspell is missing the structured markdown field Combat Cost even though the JSON provides action.
  - Fabricate records Combat Cost as "none" in markdown but "action" in JSON.
  - Hallucinatory Terrain records Combat Cost as "none" in markdown but "action" in JSON.
  - Mordenkainen's Private Sanctum records Combat Cost as "none" in markdown but "action" in JSON.
  - Awaken records Combat Cost as "long" in markdown but "action" in JSON.

### markdown-vs-json / effects structure

- Family: `markdown-vs-json`
- Kind: `legacy-effect-collapse`
- Occurrences: 39
- Distinct spells: 39
- Sample spells: compelled-duel, divine-smite, hail-of-thorns, ice-knife, ray-of-sickness, sanctuary, searing-smite, shield, thunderous-smite, thunderwave
- Sample findings:
  - Compelled Duel still uses legacy single-effect markdown labels while the JSON contains 3 separate effect objects.
  - Divine Smite still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Hail of Thorns still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Ice Knife still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.
  - Ray of Sickness still uses legacy single-effect markdown labels while the JSON contains 2 separate effect objects.

### markdown-vs-json / Higher Levels

- Family: `markdown-vs-json`
- Kind: `presence-mismatch`
- Occurrences: 26
- Distinct spells: 26
- Sample spells: astral-projection, bigbys-hand, blade-of-disaster, bones-of-the-earth, crown-of-stars, divine-favor, elemental-bane, enervation, foresight, skywrite
- Sample findings:
  - Divine Favor has Higher Levels marked missing in markdown but present in JSON.
  - Skywrite has Higher Levels marked missing in markdown but present in JSON.
  - Elemental Bane has Higher Levels marked missing in markdown but present in JSON.
  - Bigby's Hand has Higher Levels marked missing in markdown but present in JSON.
  - Enervation has Higher Levels marked missing in markdown but present in JSON.

### markdown-vs-json / Save Outcome

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 24
- Distinct spells: 24
- Sample spells: blindness-deafness, calm-emotions, crown-of-madness, dissonant-whispers, enlarge-reduce, enthrall, hold-person, levitate, suggestion, zone-of-truth
- Sample findings:
  - Dissonant Whispers records Save Outcome as "half damage; negates movement" in markdown but "half" in JSON.
  - Blindness/Deafness records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Calm Emotions records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Crown of Madness records Save Outcome as "negates" in markdown but "negates_condition" in JSON.
  - Enlarge/Reduce records Save Outcome as "negates" in markdown but "negates_condition" in JSON.

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

### markdown-vs-json / Duration Unit

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 9
- Distinct spells: 9
- Sample spells: conjure-elemental, contagion, dream-of-the-blue-veil, hold-monster, infernal-calling, maelstrom, mirage-arcane, mordenkainens-magnificent-mansion, transport-via-plants
- Sample findings:
  - Conjure Elemental records Duration Unit as "minutes" in markdown but "minute" in JSON.
  - Contagion records Duration Unit as "days" in markdown but "day" in JSON.
  - Hold Monster records Duration Unit as "minutes" in markdown but "minute" in JSON.
  - Infernal Calling records Duration Unit as "hours" in markdown but "hour" in JSON.
  - Maelstrom records Duration Unit as "minutes" in markdown but "minute" in JSON.

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

### markdown-vs-json / Defense Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 6
- Distinct spells: 6
- Sample spells: aid, barkskin, blur, mage-armor, protection-from-evil-and-good, shield-of-faith
- Sample findings:
  - Mage Armor is missing the structured markdown field Defense Type even though the JSON provides set_base_ac.
  - Protection from Evil and Good is missing the structured markdown field Defense Type even though the JSON provides advantage_on_saves.
  - Shield of Faith is missing the structured markdown field Defense Type even though the JSON provides ac_bonus.
  - Aid is missing the structured markdown field Defense Type even though the JSON provides temporary_hp.
  - Barkskin is missing the structured markdown field Defense Type even though the JSON provides ac_minimum.

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

### markdown-vs-json / Range Distance

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: dawn, mighty-fortress, storm-of-vengeance, storm-sphere, tsunami
- Sample findings:
  - Storm Sphere records Range Distance as "150 ft. (20 ft.)" in markdown but "150" in JSON.
  - Dawn records Range Distance as "60 ft. (30 ft. *)" in markdown but "60" in JSON.
  - Mighty Fortress records Range Distance as "1" in markdown but "5280" in JSON.
  - Tsunami records Range Distance as "1" in markdown but "5280" in JSON.
  - Storm of Vengeance records Range Distance as "1" in markdown but "5280" in JSON.

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

### markdown-vs-json / Line of Sight

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 4
- Distinct spells: 4
- Sample spells: antimagic-field, control-weather, glibness, holy-aura
- Sample findings:
  - Antimagic Field records Line of Sight as "" in markdown but "false" in JSON.
  - Control Weather records Line of Sight as "" in markdown but "false" in JSON.
  - Glibness is missing the structured markdown field Line of Sight even though the JSON provides false.
  - Holy Aura records Line of Sight as "" in markdown but "false" in JSON.

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

### markdown-vs-json / Material Description

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 3
- Distinct spells: 3
- Sample spells: magic-mouth, true-seeing, wall-of-ice
- Sample findings:
  - Magic Mouth records Material Description as "jade dust worth 10+ GP, which the spell consumes" in markdown but "jade dust worth 10+ GP" in JSON.
  - True Seeing records Material Description as "mushroom powder worth 25+ GP, which the spell consumes" in markdown but "an ointment for the eyes that costs 25 gp; is made from mushroom powder, saffron, and fat; and is consumed by the spell" in JSON.
  - Wall of Ice records Material Description as "a piece of quartz" in markdown but "a small piece of quartz" in JSON.

### markdown-vs-json / Range Type

- Family: `markdown-vs-json`
- Kind: `value-mismatch`
- Occurrences: 3
- Distinct spells: 3
- Sample spells: mirage-arcane, sending, telepathy
- Sample findings:
  - Sending records Range Type as "unlimited" in markdown but "special" in JSON.
  - Mirage Arcane records Range Type as "sight" in markdown but "special" in JSON.
  - Telepathy records Range Type as "unlimited" in markdown but "special" in JSON.

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

### markdown-vs-json / Material Cost GP

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: shadow-of-moil
- Sample findings:
  - Shadow of Moil is missing the structured markdown field Material Cost GP even though the JSON provides 150.

### markdown-vs-json / Terrain Type

- Family: `markdown-vs-json`
- Kind: `missing-markdown-field`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: spike-growth
- Sample findings:
  - Spike Growth is missing the structured markdown field Terrain Type even though the JSON provides damaging.
