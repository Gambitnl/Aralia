# Magic Jar
- **Level**: 6
- **School**: Necromancy
- **Ritual**: false
- **Classes**: Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: minute
- **Combat Cost**: not_applicable
- **Range Type**: self
- **Range Distance**: 0
- **Targeting Type**: self
- **Area Shape**: not_applicable
- **Area Size**: not_applicable
- **Valid Targets**: self
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
- **Line of Sight**: false

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a gem, crystal, or reliquary worth 500+ GP
- **Material Cost GP**: 500
- **Consumed**: false

- **Duration Type**: until_dispelled
- **Concentration**: false

- **Effect Type**: STATUS_CONDITION, MOVEMENT, UTILITY
- **Utility Type**: other
- **Save Stat**: Charisma
- **Save Outcome**: negates
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **End Cleanup Trigger**: spell_ends
- **End Cleanup Removes**: spell_material_container
- **End Cleanup Source**: this_spell
- **End Cleanup Scope**: spell_component
- **End Cleanup Amount**: all_remaining
- **End Cleanup Consequence**: destroy
- **End Cleanup Prevented By**: not_applicable
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Conditions Applied**: Incapacitated
- **Utility Options**: Soul Container; Project Soul; Possess Humanoid; Return To Container; Host Death Check; Container Destruction
- **Utility Option 1 Name**: Soul Container
- **Utility Option 1 Effect**: The caster's soul enters the material container while the caster's body becomes catatonic.
- **Utility Option 2 Name**: Project Soul
- **Utility Option 2 Effect**: The caster can project their soul up to 100 feet from the container.
- **Utility Option 3 Name**: Possess Humanoid
- **Utility Option 3 Effect**: The caster can attempt to possess a visible Humanoid within 100 feet unless warded by Protection from Evil and Good or Magic Circle.
- **Utility Option 4 Name**: Return To Container
- **Utility Option 4 Effect**: While possessing a body, the caster can take a Magic action to return to the container if it is within 100 feet.
- **Utility Option 5 Name**: Host Death Check
- **Utility Option 5 Effect**: If the host body dies while possessed, the host dies and the caster makes a Charisma save against their own spell save DC to return to the container if it is within 100 feet.
- **Utility Option 6 Name**: Container Destruction
- **Utility Option 6 Effect**: If the container is destroyed or the spell ends, souls return to their bodies if alive and within 100 feet; otherwise the creature dies, and the container is destroyed when the spell ends.

- **Description**: Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell's Material component. While your soul inhabits the container, you are aware of your surroundings as if you were in the container's space. You can't move or take Reactions. The only action you can take is to project your soul up to 100 feet out of the container, either returning to your living body (and ending the spell) or attempting to possess a Humanoid's body. You can attempt to possess any Humanoid within 100 feet of you that you can see (creatures warded by a Protection from Evil and Good or Magic Circle spell can't be possessed). The target makes a Charisma saving throw. On a failed save, your soul enters the target's body, and the target's soul becomes trapped in the container. On a successful save, the target resists your efforts to possess it, and you can't attempt to possess it again for 24 hours. Once you possess a creature's body, you control it. Your Hit Points, Hit Point Dice, Strength, Dexterity, Constitution, Speed, and senses are replaced by the creature's. You otherwise keep your game statistics. Meanwhile, the possessed creature's soul can perceive from the container using its own senses, but it can't move and it is Incapacitated . While possessing a body, you can take a Magic action to return from the host body to the container if it is within 100 feet of you, returning the host creature's soul to its body. If the host body dies while you're in it, the creature dies, and you make a Charisma saving throw against your own spellcasting DC. On a success, you return to the container if it is within 100 feet of you. Otherwise, you die. If the container is destroyed or the spell ends, your soul returns to your body. If your body is more than 100 feet away from you or if your body is dead, you die. If another creature's soul is in the container when it is destroyed, the creature's soul returns to its body if the body is alive and within 100 feet. Otherwise, that creature dies. When the spell ends, the container is destroyed.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Magic Jar
Level: 6th
Casting Time: 1 Minute
Range/Area: Self
Components: V, S, M *
Duration: Until Dispelled
School: Necromancy
Attack/Save: CHA Save
Damage/Effect: Control

Rules Text:
Your body falls into a catatonic state as your soul leaves it and enters the container you used for the spell's Material component. While your soul inhabits the container, you are aware of your surroundings as if you were in the container's space. You can't move or take Reactions. The only action you can take is to project your soul up to 100 feet out of the container, either returning to your living body (and ending the spell) or attempting to possess a Humanoid's body.
You can attempt to possess any Humanoid within 100 feet of you that you can see (creatures warded by a Protection from Evil and Good or Magic Circle spell can't be possessed). The target makes a Charisma saving throw. On a failed save, your soul enters the target's body, and the target's soul becomes trapped in the container. On a successful save, the target resists your efforts to possess it, and you can't attempt to possess it again for 24 hours.
Once you possess a creature's body, you control it. Your Hit Points, Hit Point Dice, Strength, Dexterity, Constitution, Speed, and senses are replaced by the creature's. You otherwise keep your game statistics.
Meanwhile, the possessed creature's soul can perceive from the container using its own senses, but it can't move and it is Incapacitated .
While possessing a body, you can take a Magic action to return from the host body to the container if it is within 100 feet of you, returning the host creature's soul to its body. If the host body dies while you're in it, the creature dies, and you make a Charisma saving throw against your own spellcasting DC. On a success, you return to the container if it is within 100 feet of you. Otherwise, you die.
If the container is destroyed or the spell ends, your soul returns to your body. If your body is more than 100 feet away from you or if your body is dead, you die. If another creature's soul is in the container when it is destroyed, the creature's soul returns to its body if the body is alive and within 100 feet. Otherwise, that creature dies.
When the spell ends, the container is destroyed.

Material Component:
* - (a gem, crystal, or reliquary worth 500+ GP)

Spell Tags:
Control

Available For:
Wizard

Referenced Rules:
possessed -> /rules-glossary/92-tooltip

Capture Method: http
Legacy Page: false
-->
