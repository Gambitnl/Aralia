# Level 1 Spell Reference (PHB 2024)

Created: 2025-12-04 16:36 UTC  
Last Updated: 2025-12-06 20:46 UTC  
Scope: Batches 1-3 (spells 1-30 of 64, level 1 only) — process in batches ≤10, no cross-level mixing.

## Field Requirements (aligned to `docs/tasks/spell-system-overhaul/archive/SPELL_TEMPLATE.json`)
- Name; Level; School; Ritual (true/false)
- Casting Time: value + unit; activation type; reaction condition (if any)
- Range: type + distance
- Components: verbal/somatic/material flags; material description; cost; consumed flag
- Duration: type + value/unit; concentration flag
- Classes
- Targeting/Area: shape, size, range, valid targets, line of sight
- Save/Attack: type and outcome (half/negates/on hit)
- Damage/Healing: dice, types; slot-level or other scaling
- Conditions Applied: name and duration
- Secondary Effects: movement, terrain, summon, utility (as applicable)
- Description (narrative); At Higher Levels; Source/Citation

### Per-Spell Structured Checklist
- Ritual: `true/false`
- Casting Time: `value`, `unit`, `activation type`, `reaction condition` (if reaction)
- Range: `type`, `distance`
- Components: `V/S/M` flags, `materialDescription`, `materialCost`, `isConsumed`
- Duration: `type`, `value`, `unit`, `concentration`
- Classes: list
- Targeting/Area: `shape`, `size`, `range`, `valid targets`, `line of sight`
- Save/Attack: `save type` or `attack roll`; `outcome` (half/negates/on hit)
- Damage/Healing: `dice`, `damage/heal type`, `scaling` (slot level or other)
- Conditions Applied: `name`, `duration`
- Secondary Effects: `movement/terrain/summon/utility` (as applicable)
- Description + At Higher Levels + Source/Citation

---

## Batch 1 — Spells 01-10 (in PHB order)

### Alarm
- Level: 1
- School: Abjuration
- Casting Time: 1 minute or Ritual
- Range: 30 feet
- Components: V, S, M (a bell and silver wire)
- Duration: 8 hours
- Classes: Artificer, Ranger, Wizard
- Description: You set an alarm against intrusion. Choose a door, a window, or an area within range that is no larger than a 20-foot Cube. Until the spell ends, an alarm alerts you whenever a creature touches or enters the warded area. When you cast the spell, you can designate creatures that won't set off the alarm. You also choose whether the alarm is audible or mental: Audible Alarm. The alarm produces the sound of a handbell for 10 seconds within 60 feet of the warded area. Mental Alarm. You are alerted by a mental ping if you are within 1 mile of the warded area. This ping awakens you if you're asleep.
- At Higher Levels: None
- Source: http://dnd2024.wikidot.com/spell:alarm (PHB 2024 p.239)
- Status: Complete

### Animal Friendship
- Level: 1
- School: Enchantment
- Casting Time: Action
- Range: 30 feet
- Components: V, S, M (a morsel of food)
- Duration: 24 hours
- Classes: Bard, Druid, Ranger
- Description: Target a Beast that you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. If you or one of your allies deals damage to the target, the spells ends.
- At Higher Levels: You can target one additional Beast for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:animal-friendship (PHB 2024 p.239)
- Status: Complete

### Armor of Agathys
- Level: 1
- School: Abjuration
- Casting Time: Bonus Action
- Range: Self
- Components: V, S, M (a shard of blue glass)
- Duration: 1 hour
- Classes: Warlock
- Description: Protective magical frost surrounds you. You gain 5 Temporary Hit Points. If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage. The spell ends early if you have no Temporary Hit Points.
- At Higher Levels: The Temporary Hit Points and the Cold damage both increase by 5 for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:armor-of-agathys (PHB 2024 p.243)
- Status: Complete

### Arms of Hadar
- Level: 1
- School: Conjuration
- Casting Time: Action
- Range: Self
- Components: V, S
- Duration: Instantaneous
- Classes: Warlock
- Description: Invoking Hadar, you cause tendrils to erupt from yourself. Each creature in a 10-foot Emanation originating from you makes a Strength saving throw. On a failed save, a target takes 2d6 Necrotic damage and can't take Reactions until the start of its next turn. On a successful save, a target takes half as much damage only.
- At Higher Levels: The damage increases by 1d6 for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:arms-of-hadar (PHB 2024 p.243)
- Status: Complete

### Bane
- Level: 1
- School: Enchantment
- Casting Time: Action
- Range: 30 feet
- Components: V, S, M (a drop of blood)
- Duration: Concentration, up to 1 minute
- Classes: Bard, Cleric, Warlock
- Description: Up to three creatures of your choice that you can see within range must each make a Charisma saving throw. Whenever a target that fails this save makes an attack roll or a saving throw before the spell ends, the target must subtract 1d4 from the attack roll or save.
- At Higher Levels: You can target one additional creature for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:bane (PHB 2024 p.245)
- Status: Complete

### Bless
- Level: 1
- School: Enchantment
- Casting Time: Action
- Range: 30 feet
- Components: V, S, M (a Holy Symbol worth 5+ GP)
- Duration: Concentration, up to 1 minute
- Classes: Cleric, Paladin
- Description: You bless up to three creatures within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target adds 1d4 to the attack roll or save.
- At Higher Levels: You can target one additional creature for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:bless (PHB 2024 p.247)
- Status: Complete

### Burning Hands
- Level: 1
- School: Evocation
- Casting Time: Action
- Range: Self
- Components: V, S
- Duration: Instantaneous
- Classes: Sorcerer, Wizard
- Description: A thin sheet of flames shoots forth from you. Each creature in a 15-foot Cone makes a Dexterity saving throw, taking 3d6 Fire damage on a failed save or half as much damage on a successful one. Flammable objects in the Cone that aren't being worn or carried start burning.
- At Higher Levels: The damage increases by 1d6 for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:burning-hands (PHB 2024 p.248)
- Status: Complete

### Charm Person
- Level: 1
- School: Enchantment
- Casting Time: Action
- Range: 30 feet
- Components: V, S
- Duration: 1 hour
- Classes: Bard, Druid, Sorcerer, Warlock, Wizard
- Description: One Humanoid you can see within range makes a Wisdom saving throw. It does so with Advantage if you or your allies are fighting it. On a failed save, the target has the Charmed condition until the spell ends or until you or your allies damage it. The Charmed creature is Friendly to you. When the spell ends, the target knows it was Charmed by you.
- At Higher Levels: You can target one additional creature for each spell slot level above 1.
- Source: http://dnd2024.wikidot.com/spell:charm-person (PHB 2024 p.249)
- Status: Complete

### Chromatic Orb
- Level: 1
- School: Evocation
- Casting Time: Action
- Range: 90 feet
- Components: V, S, M (a diamond worth 50+ GP)
- Duration: Instantaneous
- Classes: Sorcerer, Wizard
- Description: You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb you create, and then make a ranged spell attack against the target. On a hit, the target takes 3d8 damage of the chosen type. If you roll the same number on two or more of the d8s, the orb leaps to a different target of your choice within 30 feet of the target. Make an attack roll against the new target, and make a new damage roll. The orb can't leap again unless you cast the spell with a level 2+ spell slot.
- At Higher Levels: The damage increases by 1d8 for each spell slot level above 1. The orb can leap a maximum number of times equal to the level of the slot expended, and a creature can be targeted only once by each casting of this spell.
- Source: http://dnd2024.wikidot.com/spell:chromatic-orb (PHB 2024 p.249)
- Status: Complete

### Color Spray
- Level: 1
- School: Illusion
- Casting Time: Action
- Range: Self
- Components: V, S, M (a pinch of colorful sand)
- Duration: Instantaneous
- Classes: Bard, Sorcerer, Wizard
- Description: You launch a dazzling array of flashing, colorful light. Each creature in a 15-foot Cone originating from you must succeed on a Constitution saving throw or have the Blinded condition until the end of your next turn.
- At Higher Levels: None
- Source: http://dnd2024.wikidot.com/spell:color-spray (PHB 2024 p.251)
- Status: Complete

---

## Batch 2 — Spells 11-20 (in PHB order)

### Command
- **Level/School**: 1; Enchantment; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 60 feet (ranged)
- **Components**: V; Materials: none; Consumed: false
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Bard, Cleric, Paladin
- **Targeting/Area**: Single creature you can see within 60 feet; line of sight required
- **Save/Attack**: Wisdom save (negates)
- **Damage/Healing**: None; Scaling: +1 creature per slot level above 1
- **Conditions Applied**: None
- **Secondary Effects**: On a failed save the target must follow a one-word command on its next turn (Approach, Drop, Flee, Grovel, or Halt). Effects include forced movement toward/away from you, dropping held items, becoming Prone, or ending its turn without movement/action as directed.
- **Description**: You speak a one-word command to a creature you can see within range. The target must succeed on a Wisdom saving throw or follow the command on its next turn according to the option you choose.
- **At Higher Levels**: You can affect one additional creature for each spell slot level above 1.
- **Source**: PHB 2024 p.251 (https://dnd2024.wikidot.com/spell:command)

### Compelled Duel
- **Level/School**: 1; Enchantment; Ritual: false
- **Casting Time**: 1 bonus action (combat cost: bonus_action)
- **Range**: 30 feet (ranged)
- **Components**: V; Materials: none; Consumed: false
- **Duration**: Concentration, up to 1 minute
- **Classes**: Paladin
- **Targeting/Area**: Single creature you can see within 30 feet; line of sight required
- **Save/Attack**: Wisdom save (negates)
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: On a failed save, the target has Disadvantage on attack rolls against creatures other than you and can't willingly move to a space more than 30 feet from you. The spell ends early if you attack or cast a spell at another creature, if an ally damages the target, or if you end your turn more than 30 feet from it.
- **Description**: You try to compel a creature into a duel, imposing disadvantages against others and restricting its movement if it fails the saving throw.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.252 (https://dnd2024.wikidot.com/spell:compelled-duel)

### Comprehend Languages
- **Level/School**: 1; Divination; Ritual: true
- **Casting Time**: 1 action (combat cost: action; ritual casting: 11 minutes exploration)
- **Range**: Self
- **Components**: V, S, M (a pinch of soot and salt); Cost: 0 gp; Consumed: false
- **Duration**: 1 hour; Concentration: false
- **Classes**: Bard, Sorcerer, Warlock, Wizard
- **Targeting/Area**: Self; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Understand the literal meaning of any language you hear or see signed; understand written language you touch (about 1 minute per page). Does not decode symbols or secret messages.
- **Description**: For the duration, you can comprehend spoken, signed, and written languages you encounter, with limits on encoded messages.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.252 (https://dnd2024.wikidot.com/spell:comprehend-languages)

### Create or Destroy Water
- **Level/School**: 1; Transmutation; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 30 feet (ranged)
- **Components**: V, S, M (a mix of water and sand); Cost: 0 gp; Consumed: false
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Cleric, Druid
- **Targeting/Area**: Choose a point within 30 feet; affect up to a 30-foot Cube; line of sight required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: Create/destroy +10 gallons or increase Cube size by 5 feet per slot level above 1 (choose on cast)
- **Conditions Applied**: None
- **Secondary Effects**: Create up to 10 gallons of clean water in containers or as rain in the Cube that extinguishes exposed flames; or destroy up to 10 gallons of water in containers or disperse fog in the Cube.
- **Description**: Shape water or fog within the area, creating rainfall or removing existing water as specified.
- **At Higher Levels**: You create or destroy 10 additional gallons, or increase the Cube's size by 5 feet, for each slot level above 1.
- **Source**: PHB 2024 p.258 (https://dnd2024.wikidot.com/spell:create-or-destroy-water)

### Cure Wounds
- **Level/School**: 1; Abjuration; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: Touch
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Artificer, Bard, Cleric, Druid, Paladin, Ranger
- **Targeting/Area**: One creature you touch (within 5 feet); line of sight required
- **Save/Attack**: None
- **Damage/Healing**: Healing 2d8 + spellcasting ability modifier; Scaling: +2d8 per slot level above 1
- **Conditions Applied**: None
- **Secondary Effects**: None
- **Description**: A creature you touch regains Hit Points equal to 2d8 plus your spellcasting ability modifier.
- **At Higher Levels**: The healing increases by 2d8 for each spell slot level above 1.
- **Source**: PHB 2024 p.259 (https://dnd2024.wikidot.com/spell:cure-wounds)

### Detect Evil and Good
- **Level/School**: 1; Divination; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: Self
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: Concentration, up to 10 minutes
- **Classes**: Cleric, Paladin
- **Targeting/Area**: Self; sense radius 30 feet; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Sense the location of any Aberration, Celestial, Elemental, Fey, Fiend, or Undead within 30 feet and whether Hallow is active there; blocked by 1 foot of stone/wood/dirt, 1 inch of metal, or a thin sheet of lead.
- **Description**: You focus your senses to locate specific creature types and consecrated areas within 30 feet for the duration.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.261 (https://dnd2024.wikidot.com/spell:detect-evil-and-good)

### Detect Magic
- **Level/School**: 1; Divination; Ritual: true
- **Casting Time**: 1 action (combat cost: action; ritual casting: 11 minutes exploration)
- **Range**: Self
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: Concentration, up to 10 minutes
- **Classes**: Artificer, Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard
- **Targeting/Area**: Self; sense radius 30 feet; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Sense the presence of magical effects within 30 feet. You can take the Magic action to see a faint aura around visible creatures or objects bearing magic and learn a spell's school. Blocked by 1 foot of stone/wood/dirt, 1 inch of metal, or a thin sheet of lead.
- **Description**: For the duration, you can detect nearby magic and identify auras with an action.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.262 (https://dnd2024.wikidot.com/spell:detect-magic)

### Detect Poison and Disease
- **Level/School**: 1; Divination; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: Self
- **Components**: V, S, M (a yew leaf); Cost: 0 gp; Consumed: false
- **Duration**: Concentration, up to 10 minutes
- **Classes**: Cleric, Druid, Paladin, Ranger
- **Targeting/Area**: Self; sense radius 30 feet; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Sense the location of poisons, poisonous or venomous creatures, and magical contagions within 30 feet and learn their kind; blocked by 1 foot of stone/wood/dirt, 1 inch of metal, or a thin sheet of lead.
- **Description**: You attune your senses to identify nearby toxins, venomous creatures, and magical diseases.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.262 (https://dnd2024.wikidot.com/spell:detect-poison-and-disease)

### Disguise Self
- **Level/School**: 1; Illusion; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: Self
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: 1 hour; Concentration: false
- **Classes**: Artificer, Bard, Sorcerer, Wizard
- **Targeting/Area**: Self; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: You alter the appearance of yourself and your gear, within 1 foot shorter/taller and similar limb arrangement. Physical inspection passes through the illusion. A creature can use the Study action and succeed on an Intelligence (Investigation) check against your spell save DC to discern the disguise.
- **Description**: You veil yourself in illusion to change your appearance and gear for the duration.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.262 (https://dnd2024.wikidot.com/spell:disguise-self)

### Dissonant Whispers
- **Level/School**: 1; Enchantment; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 60 feet (ranged)
- **Components**: V; Materials: none; Consumed: false
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Bard
- **Targeting/Area**: One creature you can see within 60 feet; line of sight required
- **Save/Attack**: Wisdom save; Outcome: half damage on success
- **Damage/Healing**: 3d6 Psychic; Scaling: +1d6 per slot level above 1
- **Conditions Applied**: None
- **Secondary Effects**: On a failed save, the target must immediately use its Reaction, if available, to move as far away from you as possible using the safest route.
- **Description**: You assault a creature's mind with discordant whispers, dealing psychic damage and potentially driving it to flee using its Reaction.
- **At Higher Levels**: The damage increases by 1d6 for each spell slot level above 1.
- **Source**: PHB 2024 p.264 (https://dnd2024.wikidot.com/spell:dissonant-whispers)

---

## Batch 3 — Spells 21-30 (in PHB order)

### Divine Favor
- **Level/School**: 1; Transmutation; Ritual: false
- **Casting Time**: 1 bonus action (combat cost: bonus_action)
- **Range**: Self
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: 1 minute; Concentration: false
- **Classes**: Paladin
- **Targeting/Area**: Self; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: Adds 1d4 Radiant to weapon attacks; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Weapon attacks deal an extra 1d4 Radiant damage for the duration.
- **Description**: Your prayer empowers your weapon attacks with radiant energy for the duration.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.265 (https://dnd2024.wikidot.com/spell:divine-favor)
- **Status**: Complete

### Divine Smite
- **Level/School**: 1; Evocation; Ritual: false
- **Casting Time**: 1 bonus action (combat cost: bonus_action; condition: after you hit with a melee weapon or unarmed strike)
- **Range**: Self (melee target within 5 feet)
- **Components**: V; Materials: none; Consumed: false
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Paladin
- **Targeting/Area**: Single creature you hit in melee; line of sight required
- **Save/Attack**: On hit
- **Damage/Healing**: 2d8 Radiant; Scaling: +1d8 per slot level above 1; extra +1d8 vs Fiends/Undead
- **Conditions Applied**: None
- **Secondary Effects**: None
- **Description**: Immediately after you hit with a melee weapon or unarmed strike, you channel radiant power to deal extra radiant damage, with an additional die against Fiends or Undead.
- **At Higher Levels**: The damage increases by 1d8 for each spell slot level above 1.
- **Source**: PHB 2024 p.265 (https://dnd2024.wikidot.com/spell:divine-smite)
- **Status**: Complete

### Ensnaring Strike
- **Level/School**: 1; Conjuration; Ritual: false
- **Casting Time**: 1 bonus action (combat cost: bonus_action; condition: immediately after you hit a creature with a weapon)
- **Range**: Self (melee target within 5 feet)
- **Components**: V; Materials: none; Consumed: false
- **Duration**: Concentration, up to 1 minute
- **Classes**: Ranger
- **Targeting/Area**: Single creature you hit; line of sight required
- **Save/Attack**: Strength save (negates); Large or larger has Advantage
- **Damage/Healing**: 1d6 Piercing at start of each of the target’s turns; Scaling: +1d6 per slot level above 1
- **Conditions Applied**: Restrained (duration up to 1 minute, ends on successful Strength (Athletics) check)
- **Secondary Effects**: None
- **Description**: On a failed save after you hit, vines restrain the target. While restrained, it takes ongoing piercing damage each turn. A creature can use an action to attempt a Strength (Athletics) check to end the restraint.
- **At Higher Levels**: The start-of-turn damage increases by 1d6 for each spell slot level above 1.
- **Source**: PHB 2024 p.268 (https://dnd2024.wikidot.com/spell:ensnaring-strike)
- **Status**: Complete

### Entangle
- **Level/School**: 1; Conjuration; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 90 feet (ranged)
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: Concentration, up to 1 minute
- **Classes**: Druid, Ranger
- **Targeting/Area**: 20-foot square (treated as 20-foot Cube) within 90 feet; line of sight required
- **Save/Attack**: Strength save (negates)
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: Restrained (until spell ends; escape via Strength (Athletics) action)
- **Secondary Effects**: Area becomes Difficult Terrain for the duration.
- **Description**: Grasping plants sprout in the area, hindering movement and restraining creatures that fail the initial save; restrained creatures can use an action to free themselves.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.268 (https://dnd2024.wikidot.com/spell:entangle)
- **Status**: Complete

### Expeditious Retreat
- **Level/School**: 1; Transmutation; Ritual: false
- **Casting Time**: 1 bonus action (combat cost: bonus_action)
- **Range**: Self
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: Concentration, up to 10 minutes
- **Classes**: Artificer, Sorcerer, Warlock, Wizard
- **Targeting/Area**: Self; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: You Dash on casting and can Dash as a bonus action each turn for the duration.
- **Description**: You surge with speed, gaining a Dash on cast and bonus-action Dash each turn while concentrating.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.270 (https://dnd2024.wikidot.com/spell:expeditious-retreat)
- **Status**: Complete

### Faerie Fire
- **Level/School**: 1; Evocation; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 60 feet (ranged)
- **Components**: V; Materials: none; Consumed: false
- **Duration**: Concentration, up to 1 minute
- **Classes**: Artificer, Bard, Druid
- **Targeting/Area**: 20-foot Cube within 60 feet; line of sight required
- **Save/Attack**: Dexterity save (negates)
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None (outlined targets shed dim light, attacks have Advantage, cannot benefit from Invisible)
- **Secondary Effects**: Affected creatures and objects shed Dim Light in a 10-foot radius and lose benefits of invisibility.
- **Description**: Outlines creatures and objects in light; failed saves glow, granting attackers advantage if they can see the target.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.271 (https://dnd2024.wikidot.com/spell:faerie-fire)
- **Status**: Complete

### False Life
- **Level/School**: 1; Necromancy; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: Self
- **Components**: V, S, M (a drop of alcohol); Cost: 0 gp; Consumed: false
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Artificer, Sorcerer, Wizard
- **Targeting/Area**: Self; line of sight not required
- **Save/Attack**: None
- **Damage/Healing**: Gain 2d4 + 4 Temporary Hit Points; Scaling: +5 Temp HP per slot level above 1
- **Conditions Applied**: None
- **Secondary Effects**: None
- **Description**: You bolster yourself with temporary vitality, gaining temporary hit points.
- **At Higher Levels**: You gain 5 additional Temporary Hit Points for each slot level above 1.
- **Source**: PHB 2024 p.271 (https://dnd2024.wikidot.com/spell:false-life)
- **Status**: Complete

### Feather Fall
- **Level/School**: 1; Transmutation; Ritual: false
- **Casting Time**: 1 reaction (condition: when you or a creature you can see within 60 feet falls; combat cost: reaction)
- **Range**: 60 feet (ranged)
- **Components**: V, M (a small feather or piece of down); Cost: 0 gp; Consumed: false
- **Duration**: 1 minute; Concentration: false
- **Classes**: Artificer, Bard, Sorcerer, Wizard
- **Targeting/Area**: Up to five creatures within 60 feet; line of sight required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Targeted falling creatures descend at 60 feet per round and take no fall damage if they land before the spell ends.
- **Description**: As a reaction to falling, you slow descent for up to five creatures, preventing fall damage for the duration or until they land.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.271 (https://dnd2024.wikidot.com/spell:feather-fall)
- **Status**: Complete

### Find Familiar
- **Level/School**: 1; Conjuration; Ritual: true
- **Casting Time**: 1 hour (exploration cost: 1 hour)
- **Range**: 10 feet (ranged)
- **Components**: V, S, M (incense worth 10+ gp, consumed); Cost: 10 gp; Consumed: true
- **Duration**: Instantaneous; Concentration: false
- **Classes**: Wizard
- **Targeting/Area**: Point within 10 feet (treated as 5-foot sphere); line of sight required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: None
- **Conditions Applied**: None
- **Secondary Effects**: Summons a familiar spirit in eligible beast form; telepathic link within 100 feet; senses via Bonus Action; familiar can deliver touch spells via Reaction; acts independently, cannot attack; dismissal/resummon options; only one familiar at a time.
- **Description**: You call a familiar spirit to serve in beast form, with telepathic link, shared senses, and touch spell delivery; it acts on its own initiative but obeys you and reappears when you cast the spell again after dismissal or defeat.
- **At Higher Levels**: None
- **Source**: PHB 2024 p.272 (https://dnd2024.wikidot.com/spell:find-familiar)
- **Status**: Complete

### Fog Cloud
- **Level/School**: 1; Conjuration; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 120 feet (ranged)
- **Components**: V, S; Materials: none; Consumed: false
- **Duration**: Concentration, up to 1 hour
- **Classes**: Druid, Ranger, Sorcerer, Wizard
- **Targeting/Area**: 20-foot-radius Sphere within 120 feet; line of sight required
- **Save/Attack**: None
- **Damage/Healing**: None; Scaling: Radius +20 feet per slot level above 1
- **Conditions Applied**: Area is Heavily Obscured
- **Secondary Effects**: Fog persists until duration ends or dispersed by strong wind.
- **Description**: You create a heavily obscuring fog sphere that persists while you concentrate or until dispersed.
- **At Higher Levels**: The fog’s radius increases by 20 feet for each spell slot level above 1.
- **Source**: PHB 2024 p.276 (https://dnd2024.wikidot.com/spell:fog-cloud)
- **Status**: Complete

---

## Notes
- Batch rule: complete online verification → local code review → reference entry for these 10 spells, then proceed to Batch 2.
- Keep sources authoritative (printed PHB 2024 or equivalent official digital reference).
