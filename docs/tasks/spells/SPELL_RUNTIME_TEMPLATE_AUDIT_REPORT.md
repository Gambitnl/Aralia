# Spell Runtime Template Audit Report

This report checks the strict spell conversion template across structured markdown and runtime JSON.

Generated: 2026-04-30T08:25:26.038Z
Spells scanned: 459
Total issues: 1237
Errors: 1213
Warnings: 24
Grouped issue families: 45

The normal spell validator can be green while this report is not. That means the game can load the JSON, but the spell corpus still has drift that can make conversion, targeting, conditions, or future runtime behavior unreliable.

## Grouped Issues

### runtime-condition-placeholder

- Severity: error
- Source: runtime-json
- Field: effects[0].condition
- Occurrences: 336
- Sample spells: blade-ward, booming-blade, chill-touch, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, green-flame-blade, guidance, light, mage-hand
- Sample messages:
  - Blade Ward has a always effect condition that still carries save-only fields.
  - Booming Blade has a hit effect condition that still carries save-only fields.
  - Chill Touch has a hit effect condition that still carries save-only fields.
  - Dancing Lights has a always effect condition that still carries save-only fields.
  - Druidcraft has a always effect condition that still carries save-only fields.

### runtime-area-placeholder

- Severity: error
- Source: runtime-json
- Field: targeting.areaOfEffect.size
- Occurrences: 318
- Sample spells: blade-ward, booming-blade, chill-touch, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, friends, frostbite, green-flame-blade, guidance
- Sample messages:
  - Blade Ward still carries a zero-size area placeholder instead of omitting or modeling the area fact deliberately.
  - Booming Blade still carries a zero-size area placeholder instead of omitting or modeling the area fact deliberately.
  - Chill Touch still carries a zero-size area placeholder instead of omitting or modeling the area fact deliberately.
  - Dancing Lights still carries a zero-size area placeholder instead of omitting or modeling the area fact deliberately.
  - Druidcraft still carries a zero-size area placeholder instead of omitting or modeling the area fact deliberately.

### structured-list-value-drift

- Severity: error
- Source: structured-markdown
- Field: Effect Type
- Occurrences: 112
- Sample spells: aid, alter-self, barkskin, blindness-deafness, calm-emotions, crown-of-madness, darkvision, dragons-breath, enhance-ability, enthrall, find-steed, gust-of-wind
- Sample messages:
  - Aid uses "BUFF" inside Effect Type, but the strict template only accepts registered values.
  - Alter Self uses "BUFF" inside Effect Type, but the strict template only accepts registered values.
  - Barkskin uses "BUFF" inside Effect Type, but the strict template only accepts registered values.
  - Blindness/Deafness uses "DEBUFF" inside Effect Type, but the strict template only accepts registered values.
  - Calm Emotions uses "STATUS" inside Effect Type, but the strict template only accepts registered values.

### structured-list-value-drift

- Severity: error
- Source: structured-markdown
- Field: Valid Targets
- Occurrences: 95
- Sample spells: animal-messenger, arcane-lock, barkskin, beast-sense, blindness-deafness, calm-emotions, continual-flame, crown-of-madness, darkvision, dragons-breath, enhance-ability, enlarge-reduce
- Sample messages:
  - Animal Messenger uses "beast_tiny" inside Valid Targets, but the strict template only accepts registered values.
  - Arcane Lock uses "object" inside Valid Targets, but the strict template only accepts registered values.
  - Barkskin uses "willing_creature" inside Valid Targets, but the strict template only accepts registered values.
  - Beast Sense uses "willing_beast" inside Valid Targets, but the strict template only accepts registered values.
  - Blindness/Deafness uses "creature" inside Valid Targets, but the strict template only accepts registered values.

### structured-enum-drift

- Severity: error
- Source: structured-markdown
- Field: Area Shape
- Occurrences: 80
- Sample spells: alarm, arms-of-hadar, burning-hands, color-spray, detect-magic, hail-of-thorns, ice-knife, purify-food-and-drink, silent-image, sleep, thunderwave, calm-emotions
- Sample messages:
  - Alarm uses a non-template value for Area Shape.
  - Arms of Hadar uses a non-template value for Area Shape.
  - Burning Hands uses a non-template value for Area Shape.
  - Color Spray uses a non-template value for Area Shape.
  - Detect Magic uses a non-template value for Area Shape.

### structured-list-value-drift

- Severity: error
- Source: structured-markdown
- Field: Save Outcome
- Occurrences: 62
- Sample spells: color-spray, dissonant-whispers, animal-messenger, blindness-deafness, calm-emotions, crown-of-madness, detect-thoughts, enlarge-reduce, enthrall, gust-of-wind, heat-metal, hold-person
- Sample messages:
  - Color Spray uses "negates" inside Save Outcome, but the strict template only accepts registered values.
  - Dissonant Whispers uses "half damage; negates movement" inside Save Outcome, but the strict template only accepts registered values.
  - Animal Messenger uses "negates" inside Save Outcome, but the strict template only accepts registered values.
  - Blindness/Deafness uses "negates" inside Save Outcome, but the strict template only accepts registered values.
  - Calm Emotions uses "negates" inside Save Outcome, but the strict template only accepts registered values.

### structured-enum-drift

- Severity: error
- Source: structured-markdown
- Field: Duration Type
- Occurrences: 53
- Sample spells: danse-macabre, dawn, dispel-evil-and-good, dominate-person, enervation, far-step, passwall, planar-binding, rarys-telepathic-bond, find-the-path, flesh-to-stone, globe-of-invulnerability
- Sample messages:
  - Danse Macabre uses a non-template value for Duration Type.
  - Dawn uses a non-template value for Duration Type.
  - Dispel Evil and Good uses a non-template value for Duration Type.
  - Dominate Person uses a non-template value for Duration Type.
  - Enervation uses a non-template value for Duration Type.

### structured-enum-drift

- Severity: error
- Source: structured-markdown
- Field: Targeting Type
- Occurrences: 46
- Sample spells: awaken, danse-macabre, dominate-person, dream, enervation, geas, greater-restoration, hold-monster, holy-weapon, immolation, modify-memory, negative-energy-flood
- Sample messages:
  - Awaken uses a non-template value for Targeting Type.
  - Danse Macabre uses a non-template value for Targeting Type.
  - Dominate Person uses a non-template value for Targeting Type.
  - Dream uses a non-template value for Targeting Type.
  - Enervation uses a non-template value for Targeting Type.

### runtime-condition-placeholder

- Severity: error
- Source: runtime-json
- Field: effects[1].condition
- Occurrences: 34
- Sample spells: booming-blade, chill-touch, green-flame-blade, magic-stone, mold-earth, produce-flame, ray-of-frost, shocking-grasp, starry-wisp, thorn-whip, absorb-elements, armor-of-agathys
- Sample messages:
  - Booming Blade has a always effect condition that still carries save-only fields.
  - Chill Touch has a hit effect condition that still carries save-only fields.
  - Green-Flame Blade has a always effect condition that still carries save-only fields.
  - Magic Stone has a hit effect condition that still carries save-only fields.
  - Mold Earth has a always effect condition that still carries save-only fields.

### runtime-non-area-has-area

- Severity: error
- Source: runtime-json
- Field: targeting.areaOfEffect
- Occurrences: 20
- Sample spells: ice-knife, aura-of-life, aura-of-purity, wall-of-fire, circle-of-power, passwall, bones-of-the-earth, druid-grove, globe-of-invulnerability, heroes-feast, investiture-of-ice, investiture-of-wind
- Sample messages:
  - Ice Knife is not marked as an area spell but still has positive area geometry.
  - Aura of Life is not marked as an area spell but still has positive area geometry.
  - Aura of Purity is not marked as an area spell but still has positive area geometry.
  - Wall of Fire is not marked as an area spell but still has positive area geometry.
  - Circle of Power is not marked as an area spell but still has positive area geometry.

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Effect Types
- Occurrences: 11
- Sample spells: armor-of-agathys, arms-of-hadar, charm-person, color-spray, dissonant-whispers, ensnaring-strike, entangle, grease, guiding-bolt, hex, hunters-mark
- Sample messages:
  - Armor of Agathys uses "Effect Types", which should be folded into the strict template field "Effect Type".
  - Arms of Hadar uses "Effect Types", which should be folded into the strict template field "Effect Type".
  - Charm Person uses "Effect Types", which should be folded into the strict template field "Effect Type".
  - Color Spray uses "Effect Types", which should be folded into the strict template field "Effect Type".
  - Dissonant Whispers uses "Effect Types", which should be folded into the strict template field "Effect Type".

### structured-enum-drift

- Severity: error
- Source: structured-markdown
- Field: Duration Unit
- Occurrences: 9
- Sample spells: conjure-elemental, contagion, hold-monster, infernal-calling, maelstrom, conjure-celestial, dream-of-the-blue-veil, mirage-arcane, mordenkainens-magnificent-mansion
- Sample messages:
  - Conjure Elemental uses a non-template value for Duration Unit.
  - Contagion uses a non-template value for Duration Unit.
  - Hold Monster uses a non-template value for Duration Unit.
  - Infernal Calling uses a non-template value for Duration Unit.
  - Maelstrom uses a non-template value for Duration Unit.

### structured-condition-missing-runtime-effect

- Severity: error
- Source: structured-vs-json
- Field: Conditions Applied -> effects[].statusCondition.name
- Occurrences: 8
- Sample spells: tashas-hideous-laughter, blindness-deafness, crown-of-madness, invisibility, pyrotechnics, silence, suggestion
- Sample messages:
  - Tasha's Hideous Laughter lists "Incapacitated" in structured Conditions Applied, but runtime JSON has no matching STATUS_CONDITION effect.
  - Tasha's Hideous Laughter lists "Prone" in structured Conditions Applied, but runtime JSON has no matching STATUS_CONDITION effect.
  - Blindness/Deafness lists "Deafened" in structured Conditions Applied, but runtime JSON has no matching STATUS_CONDITION effect.
  - Crown of Madness lists "Charmed" in structured Conditions Applied, but runtime JSON has no matching STATUS_CONDITION effect.
  - Invisibility lists "Invisible" in structured Conditions Applied, but runtime JSON has no matching STATUS_CONDITION effect.

### structured-enum-drift

- Severity: error
- Source: structured-markdown
- Field: Casting Time Unit
- Occurrences: 8
- Sample spells: far-step, holy-weapon, legend-lore, divine-word, draconic-transformation, dream-of-the-blue-veil, mirage-arcane, blade-of-disaster
- Sample messages:
  - Far Step uses a non-template value for Casting Time Unit.
  - Holy Weapon uses a non-template value for Casting Time Unit.
  - Legend Lore uses a non-template value for Casting Time Unit.
  - Divine Word uses a non-template value for Casting Time Unit.
  - Draconic Transformation uses a non-template value for Casting Time Unit.

### runtime-condition-placeholder

- Severity: error
- Source: runtime-json
- Field: effects[2].condition
- Occurrences: 7
- Sample spells: chill-touch, mold-earth, compelled-duel, sanctuary, heat-metal, warding-bond, web
- Sample messages:
  - Chill Touch has a hit effect condition that still carries save-only fields.
  - Mold Earth has a always effect condition that still carries save-only fields.
  - Compelled Duel has a always effect condition that still carries save-only fields.
  - Sanctuary has a always effect condition that still carries save-only fields.
  - Heat Metal has a always effect condition that still carries save-only fields.

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Range Unit
- Occurrences: 2
- Sample spells: friends, mighty-fortress
- Sample messages:
  - Friends uses "Range Unit", which should be folded into the strict template field "Range Distance Unit".
  - Mighty Fortress uses "Range Unit", which should be folded into the strict template field "Range Distance Unit".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Condition
- Occurrences: 2
- Sample spells: geas, hold-monster
- Sample messages:
  - Geas uses "Condition", which should be folded into the strict template field "Conditions Applied".
  - Hold Monster uses "Condition", which should be folded into the strict template field "Conditions Applied".

### runtime-area-missing-geometry

- Severity: error
- Source: runtime-json
- Field: targeting.areaOfEffect.size
- Occurrences: 1
- Sample spells: conjure-animals
- Sample messages:
  - Conjure Animals is marked as an area spell but does not have positive area geometry.

### runtime-casting-cost-mismatch

- Severity: error
- Source: runtime-json
- Field: castingTime.combatCost.type
- Occurrences: 1
- Sample spells: counterspell
- Sample messages:
  - Counterspell casts as reaction, but its combat cost is stored as action.

### runtime-condition-placeholder

- Severity: error
- Source: runtime-json
- Field: effects[3].condition
- Occurrences: 1
- Sample spells: mold-earth
- Sample messages:
  - Mold Earth has a always effect condition that still carries save-only fields.

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Additional Damage
- Occurrences: 1
- Sample spells: divine-smite
- Sample messages:
  - Divine Smite uses "Additional Damage", which should be folded into the strict template field "Secondary Damage Dice / Secondary Damage Type".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Primary Damage Dice
- Occurrences: 1
- Sample spells: ice-knife
- Sample messages:
  - Ice Knife uses "Primary Damage Dice", which should be folded into the strict template field "Damage Dice".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Primary Damage Type
- Occurrences: 1
- Sample spells: ice-knife
- Sample messages:
  - Ice Knife uses "Primary Damage Type", which should be folded into the strict template field "Damage Type".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Exploration Time Value
- Occurrences: 1
- Sample spells: snare
- Sample messages:
  - Snare uses "Exploration Time Value", which should be folded into the strict template field "Casting Time Value / Casting Time Unit".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Exploration Time Unit
- Occurrences: 1
- Sample spells: snare
- Sample messages:
  - Snare uses "Exploration Time Unit", which should be folded into the strict template field "Casting Time Value / Casting Time Unit".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Exploration Cost Value
- Occurrences: 1
- Sample spells: plant-growth
- Sample messages:
  - Plant Growth uses "Exploration Cost Value", which should be folded into the strict template field "Casting Time Value / Casting Time Unit".

### structured-deprecated-label

- Severity: error
- Source: structured-markdown
- Field: Exploration Cost Unit
- Occurrences: 1
- Sample spells: plant-growth
- Sample messages:
  - Plant Growth uses "Exploration Cost Unit", which should be folded into the strict template field "Casting Time Value / Casting Time Unit".

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Triggered Applications
- Occurrences: 3
- Sample spells: entangle, grease, snare
- Sample messages:
  - Entangle uses "Triggered Applications", which is not registered in the strict template vocabulary yet.
  - Grease uses "Triggered Applications", which is not registered in the strict template vocabulary yet.
  - Snare uses "Triggered Applications", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Light Bright Radius
- Occurrences: 2
- Sample spells: light, produce-flame
- Sample messages:
  - Light uses "Light Bright Radius", which is not registered in the strict template vocabulary yet.
  - Produce Flame uses "Light Bright Radius", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Light Dim Radius
- Occurrences: 2
- Sample spells: light, produce-flame
- Sample messages:
  - Light uses "Light Dim Radius", which is not registered in the strict template vocabulary yet.
  - Produce Flame uses "Light Dim Radius", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Target Filter Creature Types
- Occurrences: 2
- Sample spells: animal-friendship, charm-person
- Sample messages:
  - Animal Friendship uses "Target Filter Creature Types", which is not registered in the strict template vocabulary yet.
  - Charm Person uses "Target Filter Creature Types", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Damage Trigger
- Occurrences: 2
- Sample spells: armor-of-agathys, ensnaring-strike
- Sample messages:
  - Armor of Agathys uses "Damage Trigger", which is not registered in the strict template vocabulary yet.
  - Ensnaring Strike uses "Damage Trigger", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Control Options
- Occurrences: 1
- Sample spells: command
- Sample messages:
  - Command uses "Control Options", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Movement Type
- Occurrences: 1
- Sample spells: dissonant-whispers
- Sample messages:
  - Dissonant Whispers uses "Movement Type", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Forced Movement
- Occurrences: 1
- Sample spells: dissonant-whispers
- Sample messages:
  - Dissonant Whispers uses "Forced Movement", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Temporary HP
- Occurrences: 1
- Sample spells: false-life
- Sample messages:
  - False Life uses "Temporary HP", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Flood
- Occurrences: 1
- Sample spells: control-water
- Sample messages:
  - Control Water uses "Flood", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Part Water
- Occurrences: 1
- Sample spells: control-water
- Sample messages:
  - Control Water uses "Part Water", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Redirect Flow
- Occurrences: 1
- Sample spells: control-water
- Sample messages:
  - Control Water uses "Redirect Flow", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Whirlpool
- Occurrences: 1
- Sample spells: control-water
- Sample messages:
  - Control Water uses "Whirlpool", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Armor Class
- Occurrences: 1
- Sample spells: giant-insect
- Sample messages:
  - Giant Insect uses "Armor Class", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Hit Points
- Occurrences: 1
- Sample spells: giant-insect
- Sample messages:
  - Giant Insect uses "Hit Points", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Speed
- Occurrences: 1
- Sample spells: giant-insect
- Sample messages:
  - Giant Insect uses "Speed", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Senses
- Occurrences: 1
- Sample spells: giant-insect
- Sample messages:
  - Giant Insect uses "Senses", which is not registered in the strict template vocabulary yet.

### structured-unregistered-label

- Severity: warning
- Source: structured-markdown
- Field: Languages
- Occurrences: 1
- Sample spells: giant-insect
- Sample messages:
  - Giant Insect uses "Languages", which is not registered in the strict template vocabulary yet.

