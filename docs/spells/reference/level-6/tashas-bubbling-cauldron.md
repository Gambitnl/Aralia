# Tasha's Bubbling Cauldron
- **Level**: 6
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: point
- **Targeting Range**: 0
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Valid Targets**: ground, point
- **Target Willingness**: not_applicable
- **Target Object Worn Or Carried**: not_applicable
- **Target Object Magical Status**: not_applicable
- **Target Object Fixed To Surface**: not_applicable
- **Target Object Max Size**: not_applicable
- **Target Object Max Weight Pounds**: not_applicable
- **Target Object Max Weight Scaling**: not_applicable
- **Target Can Hear Caster**: not_applicable
- **Target Can Understand Caster**: not_applicable
- **Target Can See Caster**: not_applicable
- **Target Ability Threshold Ability**: not_applicable
- **Target Ability Threshold Operator**: not_applicable
- **Target Ability Threshold Value**: not_applicable
- **Target Self Relation**: not_applicable
- **Line of Sight**: true

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a gold-inlaid ladle worth 200+ GP
- **Material Cost GP**: 200
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 10
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Type**: UTILITY
- **Save Stat**: not_applicable
- **Save Outcome**: not_applicable
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Utility Type**: creation
- **Created Objects**: Potion of Healing
- **Created Object 1 Type**: other
- **Created Object 1 Name**: Potion of Healing
- **Created Object 1 Count**: 1
- **Created Object 1 Count Unit**: item
- **Created Object 1 Appears In**: spell_area
- **Created Object 1 Perishable**: true
- **Created Object 1 Expires With Spell**: true
- **Created Object 1 Notes**: The cauldron holds a number of Potions of Healing equal to the caster's spellcasting ability modifier, minimum 1, and any unused potions disappear when the spell ends.
- **Granted Actions**: Bonus Action retrieve potion
- **Granted Action 1 Type**: bonus_action
- **Granted Action 1 Action**: Retrieve a Potion of Healing from the cauldron
- **Granted Action 1 Frequency**: while_active
- **Granted Action 1 Actor**: affected_creature
- **Granted Action 1 Action Kind**: bonus_action
- **Granted Action 1 Range Limit**: 5
- **Granted Action 1 Notes**: A creature within 5 feet of the cauldron can use a Bonus Action to draw out one of the potions the cauldron contains.
- **Control Options**: Healing potion supply; Higher-level brews
- **Control Option 1 Name**: Healing potion supply
- **Control Option 1 Effect**: The cauldron contains Potions of Healing equal to the caster's spellcasting ability modifier, minimum 1.
- **Control Option 2 Name**: Higher-level brews
- **Control Option 2 Effect**: When cast with a higher-level slot, the cauldron instead produces Potions of Greater Healing at level 7, Superior Healing at level 8, and Supreme Healing at level 9.
- **Description**: You conjure a bubbling cauldron on the ground within 5 feet of you. The cauldron lasts for 10 minutes and contains Potions of Healing equal to your spellcasting ability modifier, minimum 1. A creature within 5 feet can use a Bonus Action to retrieve one potion, and any unused potions vanish when the spell ends.
- **Higher Levels**: Using a Higher-Level Spell Slot. The potions become Potions of Greater Healing with a level 7 slot, Potions of Superior Healing with a level 8 slot, and Potions of Supreme Healing with a level 9 slot.
- **Scaling Rule 1 Type**: slot_level
- **Scaling Rule 1 Applies To**: creation | potion tier
- **Scaling Rule 1 Notes**: The cauldron's potions improve with the slot level: Potion of Healing at level 6, Potion of Greater Healing at level 7, Potion of Superior Healing at level 8, and Potion of Supreme Healing at level 9.

## Canonical D&D Beyond Snapshot

This section stores the local source-summary snapshot so the structured Aralia field block remains the validator-facing markdown surface.

<!--
Name: Tasha's Bubbling Cauldron
Level: 6th
Casting Time: 1 Action
Range/Area: Self
Components: V, S, M *
Duration: 10 Minutes
School: Conjuration
Attack/Save: None
Damage/Effect: Creation

Rules Text:
You conjure a sturdy iron cauldron, which appears in an unoccupied space on the ground within 5 feet of you and remains for the duration. The cauldron's contents are tied to the level of the spell slot expended. The cauldron contains a number of Potions of Healing equal to your spellcasting ability modifier (minimum of one potion). A creature can take a Bonus Action to retrieve a potion from the cauldron if the creature is within 5 feet of it. When the spell ends, the cauldron and any undrunk potions in it disappear.
Using a Higher-Level Spell Slot. The healing potions in the cauldron become more potent: they are Potions of Greater Healing with a level 7 slot, Potions of Superior Healing with a level 8 slot, and Potions of Supreme Healing with a level 9 slot.

Material Component:
* - (a gold-inlaid ladle worth 200+ GP)

Spell Tags:
Creation
Healing

Available For:
Warlock
Wizard

Capture Method: local-json-summary
Legacy Page: false
-->
