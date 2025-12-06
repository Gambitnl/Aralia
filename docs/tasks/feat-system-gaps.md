# Feat System Implementation Gaps

This document tracks feats and feat features that require additional implementation beyond basic ability score increases and proficiencies. These gaps need to be addressed to fully support all 2024 PHB feats.

## Feats Requiring Spell Selection

These feats grant spells that the player must choose from a list. Currently, these feats are added with placeholder mechanics, but spell selection UI/logic is not implemented.

### Magic Initiate
- **Gap**: Player must choose a spellcasting class, then select 2 cantrips and 1 first-level spell from that class's spell list
- **Current State**: Feat exists with empty ASI (selectable mental stat)
- **Required Implementation**:
  - UI for class selection (Wizard, Cleric, Druid, etc.)
  - UI for cantrip selection (2 choices)
  - UI for 1st-level spell selection (1 choice)
  - Logic to add selected spells to character's spellbook
  - Logic to track "cast once per long rest" for the 1st-level spell

### Fey-Touched
- **Gap**: Player must choose one 1st-level divination or enchantment spell
- **Current State**: Feat exists with empty ASI (selectable mental stat)
- **Required Implementation**:
  - UI for spell selection from divination/enchantment spell lists
  - Logic to add Misty Step (always granted) and selected spell to spellbook
  - Logic to track "cast once per long rest" for both spells

### Shadow-Touched
- **Gap**: Player must choose one 1st-level illusion or necromancy spell
- **Current State**: Feat exists with empty ASI (selectable mental stat)
- **Required Implementation**:
  - UI for spell selection from illusion/necromancy spell lists
  - Logic to add Invisibility (always granted) and selected spell to spellbook
  - Logic to track "cast once per long rest" for both spells

### Spell Sniper
- **Gap**: Player must choose one attack cantrip
- **Current State**: Feat exists with empty ASI (selectable mental stat)
- **Required Implementation**:
  - UI for cantrip selection (attack cantrips only)
  - Logic to add selected cantrip to spellbook
  - Implementation of expanded critical hit range (19-20) for spell attacks

### Ritual Caster
- **Gap**: Player must choose a spellcasting class, then learn ritual spells from that class
- **Current State**: Feat exists with ASI
- **Required Implementation**:
  - UI for class selection
  - UI for initial ritual spell selection
  - Logic to allow copying ritual spells from scrolls/spellbooks
  - Logic to cast spells as rituals (no spell slot required, 10 minutes longer casting time)

### Telekinetic
- **Gap**: Grants Mage Hand with extended range (60 feet instead of 30)
- **Current State**: Feat exists with empty ASI (selectable mental stat)
- **Required Implementation**:
  - Logic to grant Mage Hand cantrip
  - Logic to extend Mage Hand range to 60 feet
  - Implementation of bonus action shove (5 feet, Strength save)

### Telepathic
- **Gap**: Grants Detect Thoughts spell (cast once per long rest)
- **Current State**: Feat exists with empty ASI (selectable mental stat)
- **Required Implementation**:
  - Logic to add Detect Thoughts to spellbook
  - Logic to track "cast once per long rest" usage
  - Implementation of telepathic communication feature

## Feats Requiring Tool/Weapon Selection

### Crafter
- **Gap**: Player must choose one type of artisan's tools to gain proficiency with
- **Current State**: Feat exists with Intelligence +1
- **Required Implementation**:
  - UI for artisan tool selection
  - Logic to grant tool proficiency
  - Implementation of crafting speed bonus
  - Implementation of equipment/tool purchase discount

### Musician
- **Gap**: Player must choose three musical instruments
- **Current State**: Feat exists with Charisma +1
- **Required Implementation**:
  - UI for musical instrument selection (3 choices)
  - Logic to grant instrument proficiencies
  - Implementation of inspiration-granting performance after long rest

### Weapon Master
- **Gap**: Player must choose four weapons to gain proficiency with
- **Current State**: Feat exists with Strength or Dexterity +1
- **Required Implementation**:
  - UI for weapon selection (4 choices)
  - Logic to grant weapon proficiencies

### Skill Expert
- **Gap**: Player must choose one ability score, one skill for proficiency, and one skill for expertise
- **Current State**: Feat exists with empty ASI and 'any' skill placeholder
- **Required Implementation**:
  - UI for ability score selection (one of six)
  - UI for skill proficiency selection
  - UI for expertise selection (must be a skill character is already proficient in)
  - Logic to grant expertise (double proficiency bonus)

## Feats Requiring Element/Damage Type Selection

### Elemental Adept
- **Gap**: Player must choose one damage type (acid, cold, fire, lightning, or thunder)
- **Current State**: Feat exists with empty ASI
- **Required Implementation**:
  - UI for damage type selection
  - Logic to ignore resistance to chosen damage type
  - Logic to treat 1s on damage dice as 2s for chosen damage type

## Feats Requiring Complex Combat Mechanics

These feats have combat effects that need to be implemented in the combat system.

### Crossbow Expert
- **Gap**: Multiple combat mechanics
- **Required Implementation**:
  - Logic to ignore loading property of crossbows
  - Logic to remove disadvantage on ranged attacks within 5 feet
  - Logic for bonus action hand crossbow attack after one-handed weapon attack

### Defensive Duelist
- **Gap**: Reaction-based AC bonus
- **Required Implementation**:
  - Logic to use reaction to add proficiency bonus to AC against melee attacks
  - Check for finesse weapon proficiency requirement

### Dual Wielder
- **Gap**: Two-weapon fighting improvements
- **Required Implementation**:
  - Logic for +1 AC while dual wielding
  - Logic to allow drawing/stowing two weapons
  - Logic to allow two-weapon fighting with non-light one-handed weapons

### Grappler
- **Gap**: Grapple mechanics
- **Required Implementation**:
  - Logic for advantage on attack rolls against grappled creatures
  - Logic for restrain action (grapple check to restrain both grappler and target)

### Great Weapon Master
- **Gap**: Power attack and bonus action mechanics
- **Required Implementation**:
  - Logic for -5 to hit / +10 damage option with heavy melee weapons
  - Logic for bonus action melee attack on crit or dropping creature to 0 HP

### Heavy Armor Master
- **Gap**: Damage reduction
- **Current State**: Feat exists with resistance placeholder
- **Required Implementation**:
  - Logic to reduce nonmagical bludgeoning, piercing, and slashing damage by 3
  - Check for heavy armor requirement

### Inspiring Leader
- **Gap**: Temporary hit points
- **Required Implementation**:
  - Logic to grant temporary HP (level + Charisma modifier) to up to 6 creatures
  - 10-minute time requirement
  - Once per short or long rest limitation

### Keen Mind
- **Gap**: Information tracking
- **Required Implementation**:
  - Logic to track direction (always know north)
  - Logic to track time (hours until sunrise/sunset)
  - Logic to recall information from past month

### Mage Slayer
- **Gap**: Anti-spellcaster mechanics
- **Required Implementation**:
  - Logic to impose disadvantage on concentration saves when damaging spellcasters
  - Logic for advantage on saves against spells from adjacent creatures

### Medium Armor Master
- **Gap**: AC calculation modification
- **Required Implementation**:
  - Logic to allow +3 Dex modifier to AC (instead of +2) with medium armor
  - Logic to remove Stealth disadvantage from medium armor

### Mounted Combatant
- **Gap**: Mounted combat mechanics
- **Required Implementation**:
  - Logic for advantage on melee attacks against smaller unmounted creatures
  - Logic to redirect attacks from mount to rider
  - Logic to grant mount evasion on Dex saves

### Piercer
- **Gap**: Damage reroll mechanics
- **Required Implementation**:
  - Logic to reroll one piercing damage die once per turn
  - Logic to add one additional damage die on piercing weapon crits

### Poisoner
- **Gap**: Poison crafting and application
- **Required Implementation**:
  - Poison crafting system
  - Logic to ignore poison resistance with crafted poisons
  - Logic to apply poison as bonus action

### Polearm Master
- **Gap**: Reach weapon mechanics
- **Required Implementation**:
  - Logic for bonus action butt-end attack with polearms
  - Logic for opportunity attacks when creatures enter reach

### Resilient
- **Gap**: Saving throw selection
- **Current State**: Feat exists with Constitution hardcoded
- **Required Implementation**:
  - UI for saving throw selection (one of six)
  - Logic to grant proficiency in selected saving throw

### Sentinel
- **Gap**: Opportunity attack modifications
- **Required Implementation**:
  - Logic to reduce speed to 0 on opportunity attack hits
  - Logic to make opportunity attacks even when target uses Disengage
  - Logic for disadvantage on attacks against targets other than you

### Sharpshooter
- **Gap**: Ranged attack modifications
- **Required Implementation**:
  - Logic to ignore long range disadvantage
  - Logic to ignore half and three-quarters cover
  - Logic for -5 to hit / +10 damage option with ranged weapons

### Shield Master
- **Gap**: Shield and shove mechanics
- **Required Implementation**:
  - Logic to add shield AC bonus to Dex saves (effects targeting only you)
  - Logic to take no damage on successful Dex save (half-damage effects)
  - Logic for bonus action shove after Attack action

### Skulker
- **Gap**: Stealth mechanics
- **Required Implementation**:
  - Logic to remain hidden when lightly obscured
  - Logic to avoid revealing position on missed ranged attacks
  - Logic to see dim light as bright light for Perception checks

### Slasher
- **Gap**: Slashing damage effects
- **Required Implementation**:
  - Logic to reduce speed by 10 feet on slashing damage (once per turn)
  - Logic for disadvantage on attacks after slashing crit

### Speedy
- **Gap**: Movement mechanics
- **Current State**: Feat exists with speed increase
- **Required Implementation**:
  - Logic to ignore difficult terrain from nonmagical ground when Dashing

### Tavern Brawler
- **Gap**: Improvised weapon and unarmed strike mechanics
- **Required Implementation**:
  - Logic for improvised weapon proficiency
  - Logic for improved unarmed strike damage
  - Logic for bonus action grapple after unarmed/improvised weapon hit

### War Caster
- **Gap**: Spellcasting mechanics
- **Required Implementation**:
  - Logic for advantage on concentration saves
  - Logic to perform somatic components with weapons/shields in hand
  - Logic to cast spell as opportunity attack

## Fighting Style Feats

These feats require the character to have the Fighting Style class feature. Currently, they are included in the feat list but prerequisite checking is not implemented.

### Fighting Style Feats (All)
- **Gap**: Prerequisite checking
- **Current State**: All fighting style feats exist but can be selected by anyone
- **Required Implementation**:
  - Logic to check if character's class has `fightingStyles` property
  - Update prerequisite evaluation to include Fighting Style feature check
  - UI indication that these feats require Fighting Style feature

### Specific Fighting Style Mechanics
Some fighting styles have mechanics that need implementation:

- **Archery**: +2 to attack rolls with ranged weapons
- **Defense**: +1 AC while wearing armor
- **Dueling**: +2 damage with one-handed melee weapon
- **Great Weapon Fighting**: Reroll 1s and 2s on damage dice
- **Two-Weapon Fighting**: Add ability modifier to off-hand damage
- **Protection**: Reaction to impose disadvantage on attack against ally
- **Interception**: Reaction to reduce damage to ally (1d10 + proficiency)
- **Unarmed Fighting**: Unarmed strike damage and grapple damage
- **Blind Fighting**: Blindsight 10 feet
- **Thrown Weapon Fighting**: Draw thrown weapons as part of attack, +2 damage

## Feats with Selectable Ability Score Increases

These feats allow the player to choose which ability score to increase. Currently, they have empty `abilityScoreIncrease` objects, but the selection UI/logic is not implemented.

### Feats Requiring ASI Selection:
- Magic Initiate (Intelligence, Wisdom, or Charisma)
- Elemental Adept (Intelligence, Wisdom, or Charisma)
- Fey-Touched (Intelligence, Wisdom, or Charisma)
- Shadow-Touched (Intelligence, Wisdom, or Charisma)
- Spell Sniper (Intelligence, Wisdom, or Charisma)
- Telekinetic (Intelligence, Wisdom, or Charisma)
- Telepathic (Intelligence, Wisdom, or Charisma)
- Skill Expert (any ability score)
- Heavily Armored (Strength or Constitution)
- Moderately Armored (Strength or Dexterity)
- Mounted Combatant (Strength or Dexterity)
- Piercer (Strength or Dexterity)
- Slasher (Strength or Dexterity)
- Tavern Brawler (Strength or Constitution)
- Weapon Master (Strength or Dexterity)

### Required Implementation:
- UI component for ability score selection when feat is chosen
- State management to store selected ability score
- Update `applyFeatToCharacter` to use selected ability score
- Update character creation state to track feat-specific choices

## Epic Boon Feats

Epic Boon feats are mentioned in the 2024 PHB but specific boons are not detailed in the search results. These would be high-level feats (typically level 19+) that grant powerful abilities.

- **Gap**: Complete list of Epic Boon feats and their mechanics
- **Status**: Not yet implemented
- **Required**: Research and implementation of Epic Boon feats

## Summary by Priority

### High Priority (Core Functionality)
1. Selectable ASI UI/logic for all applicable feats
2. Fighting Style prerequisite checking
3. Spell selection for Magic Initiate, Fey-Touched, Shadow-Touched
4. Skill/weapon/tool selection for applicable feats

### Medium Priority (Combat Mechanics)
1. Combat system integration for combat-focused feats (Great Weapon Master, Sharpshooter, etc.)
2. Reaction mechanics (Defensive Duelist, Shield Master, Sentinel)
3. Two-weapon fighting improvements (Dual Wielder)

### Low Priority (Quality of Life)
1. Information tracking (Keen Mind)
2. Crafting system (Crafter, Poisoner)
3. Mounted combat system (Mounted Combatant)
4. Ritual casting system (Ritual Caster)

### Future Work
1. Epic Boon feats research and implementation
2. Integration with spell system for spell-granting feats
3. Integration with combat system for combat mechanics
4. Integration with crafting system for crafting feats
