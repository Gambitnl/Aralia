# Minor Illusion

- **Level**: 0
- **School**: Illusion
- **Ritual**: false
- **Classes**: Bard, Sorcerer, Warlock, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 30
- **Range Distance Unit**: feet
- **Targeting Type**: area
- **Targeting Range**: 30
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Valid Targets**: point
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
- **Area Shape**: Cube
- **Area Size**: 5
- **Area Size Unit**: feet

- **Verbal**: false
- **Somatic**: true
- **Material**: true
- **Material Description**: a bit of fleece

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Type**: UTILITY
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: end_on_recast
- **Conditional Ending Scope**: spell
- **Mode Choice Type**: choose_one
- **Mode Choice Timing**: on_cast
- **Mode Choice Option Count**: 2
- **Mode Choice Options Source**: modeChoice.options
- **Mode Choice Max Active Noninstantaneous**: not_applicable
- **Mode Choice Can Dismiss Active**: not_applicable
- **Mode Choice Option 1 Label**: Sound
- **Mode Choice Option 1 Summary**: Create a sound whose volume can range from a whisper to a scream and that can continue unabated or occur discretely at different times.
- **Mode Choice Option 1 Effect Indices**: 0
- **Mode Choice Option 1 Control Option Indices**: not_applicable
- **Mode Choice Option 1 Effect Types**: sensory, illusion, sound
- **Mode Choice Option 1 Duration**: 1 minute
- **Mode Choice Option 1 Notes**: Sound-mode volume, timing, and reveal details are represented by Sensory Manifestation and Illusion fields.
- **Mode Choice Option 2 Label**: Image
- **Mode Choice Option 2 Summary**: Create an image of an object no larger than a 5-foot Cube.
- **Mode Choice Option 2 Effect Indices**: 0
- **Mode Choice Option 2 Control Option Indices**: not_applicable
- **Mode Choice Option 2 Effect Types**: sensory, illusion, image
- **Mode Choice Option 2 Duration**: 1 minute
- **Mode Choice Option 2 Notes**: Image-mode sensory exclusions, physical interaction reveal, and faint-on-discern behavior are represented by Sensory Manifestation and Illusion fields.
- **Sensory Manifestation Mode Source**: modeChoice.options
- **Sensory Manifestation Variant Count**: 2
- **Sensory Manifestation Variant 1 Label**: Sound
- **Sensory Manifestation Variant 1 Allowed Senses**: sound
- **Sensory Manifestation Variant 1 Excluded Senses**: not_applicable
- **Sensory Manifestation Variant 1 Volume Range**: whisper_to_scream
- **Sensory Manifestation Variant 1 Timing**: continuous_or_discrete_before_spell_end
- **Sensory Manifestation Variant 1 Max Shape**: not_applicable
- **Sensory Manifestation Variant 1 Max Size**: not_applicable
- **Sensory Manifestation Variant 1 Max Size Unit**: not_applicable
- **Sensory Manifestation Variant 2 Label**: Image
- **Sensory Manifestation Variant 2 Allowed Senses**: sight
- **Sensory Manifestation Variant 2 Excluded Senses**: sound, light, smell, other_sensory_effect
- **Sensory Manifestation Variant 2 Volume Range**: not_applicable
- **Sensory Manifestation Variant 2 Timing**: not_applicable
- **Sensory Manifestation Variant 2 Max Shape**: Cube
- **Sensory Manifestation Variant 2 Max Size**: 5
- **Sensory Manifestation Variant 2 Max Size Unit**: feet
- **Illusion Reveal Scope**: per_creature
- **Illusion Reveal Methods**: study_action, physical_interaction
- **Illusion Reveal Action Cost**: action
- **Illusion Reveal Ability**: Intelligence
- **Illusion Reveal Skill**: Investigation
- **Illusion Reveal DC**: spell_save_dc
- **Illusion Reveal Applies To**: Sound, Image
- **Illusion Discerned State**: faint_to_discerning_creature
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Utility Type**: sensory

- **Description**: You create a sound or an image of an object within range that lasts for the duration. See the descriptions below for the effects of each. The illusion ends if you cast this spell again. If a creature takes a Study action to examine the sound or image, the creature can determine that it is an illusion with a successful Intelligence (Investigation) check against your spell save DC. If a creature discerns the illusion for what it is, the illusion becomes faint to the creature. Sound. If you create a sound, its volume can range from a whisper to a scream. It can be your voice, someone else's voice, a lion's roar, a beating of drums, or any other sound you choose. The sound continues unabated throughout the duration, or you can make discrete sounds at different times before the spell ends. Image. If you create an image of an object-such as a chair, muddy footprints, or a small chest-it must be no larger than a 5-foot Cube. The image can't create sound, light, smell, or any other sensory effect. Physical interaction with the image reveals it to be an illusion, since things can pass through it.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Minor Illusion
Level: Cantrip
Casting Time: 1 Action
Range/Area: 30 ft. (5 ft. *)
Components: S, M *
Duration: 1 Minute
School: Illusion
Attack/Save: None
Damage/Effect: Control

Rules Text:
You create a sound or an image of an object within range that lasts for the duration. See the descriptions below for the effects of each. The illusion ends if you cast this spell again.
If a creature takes a Study action to examine the sound or image, the creature can determine that it is an illusion with a successful Intelligence (Investigation) check against your spell save DC. If a creature discerns the illusion for what it is, the illusion becomes faint to the creature.
Sound. If you create a sound, its volume can range from a whisper to a scream. It can be your voice, someone else's voice, a lion's roar, a beating of drums, or any other sound you choose. The sound continues unabated throughout the duration, or you can make discrete sounds at different times before the spell ends.
Image. If you create an image of an object-such as a chair, muddy footprints, or a small chest-it must be no larger than a 5-foot Cube . The image can't create sound, light, smell, or any other sensory effect. Physical interaction with the image reveals it to be an illusion, since things can pass through it.

Material Component:
* - (a bit of fleece)

Spell Tags:
Control

Available For:
Bard
Sorcerer
Warlock
Wizard

Referenced Rules:
Cube -> /rules-glossary/38-tooltip

Capture Method: http
Legacy Page: false
-->
