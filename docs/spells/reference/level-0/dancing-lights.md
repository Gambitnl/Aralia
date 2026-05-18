# Dancing Lights

- **Level**: 0
- **School**: Illusion
- **Ritual**: false
- **Classes**: Artificer, Bard, Sorcerer, Wizard
- **Sub-Classes**: No Subclass Entries

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 120
- **Range Distance Unit**: feet
- **Targeting Type**: point
- **Targeting Range**: 120
- **Targeting Range Unit**: feet
- **Targeting Max**: 1
- **Target Instance Type**: light
- **Target Instance Base Count**: 4
- **Target Instance Scaling Rule**: not_applicable
- **Target Instance Assignment**: independent_positions
- **Target Instance Resolution**: persistent
- **Target Instance Notes**: The caster creates up to four torch-size lights as separate hovering instances, or combines the four instances into one glowing Medium humanoid-like form.
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

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a bit of phosphorus

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: true

- **Effect Type**: UTILITY
- **Save Cover Ignored**: not_applicable
- **Save Auto Outcome**: not_applicable
- **Save Auto Outcome Condition**: not_applicable
- **Sound Audible Radius**: not_applicable
- **Sound Audible Radius Unit**: not_applicable
- **Sound Source**: not_applicable
- **Sound Trigger**: not_applicable
- **Conditional Ending Triggers**: not_applicable
- **Conditional Ending Scope**: not_applicable
- **Mode Choice Type**: choose_one
- **Mode Choice Timing**: on_cast
- **Mode Choice Option Count**: 2
- **Mode Choice Options Source**: modeChoice.options
- **Mode Choice Max Active Noninstantaneous**: not_applicable
- **Mode Choice Can Dismiss Active**: not_applicable
- **Mode Choice Option 1 Label**: Separate Lights
- **Mode Choice Option 1 Summary**: Create up to four torch-size hovering lights that appear as torches, lanterns, or glowing orbs.
- **Mode Choice Option 1 Effect Indices**: 0
- **Mode Choice Option 1 Control Option Indices**: not_applicable
- **Mode Choice Option 1 Effect Types**: light, visual_form
- **Mode Choice Option 1 Duration**: 1 minute
- **Mode Choice Option 1 Notes**: Uses the four independent light instances already tracked by Target Instance fields.
- **Mode Choice Option 2 Label**: Humanoid Form
- **Mode Choice Option 2 Summary**: Combine the four lights into one glowing Medium form that is vaguely humanlike.
- **Mode Choice Option 2 Effect Indices**: 0
- **Mode Choice Option 2 Control Option Indices**: not_applicable
- **Mode Choice Option 2 Effect Types**: light, visual_form
- **Mode Choice Option 2 Duration**: 1 minute
- **Mode Choice Option 2 Notes**: Uses the same four-light payload but presents the instances as one combined Medium form.
- **Light Color Choice**: not_applicable
- **Light Opaque Cover Blocks**: not_applicable
- **Light Emits Heat**: not_applicable
- **Light Ignites Objects**: not_applicable
- **Light Consumes Fuel**: not_applicable
- **Light Can Be Covered Or Hidden**: not_applicable
- **Light Can Be Smothered Or Quenched**: not_applicable
- **Utility Type**: light

- **Description**: You create up to four torch-size lights within range, making them appear as torches, lanterns, or glowing orbs that hover for the duration. Alternatively, you combine the four lights into one glowing Medium form that is vaguely humanlike. Whichever form you choose, each light sheds Dim Light in a 10-foot radius. As a Bonus Action, you can move the lights up to 60 feet to a space within range. A light must be within 20 feet of another light created by this spell, and a light vanishes if it exceeds the spell's range.
- **Higher Levels**: not_applicable
## Canonical D&D Beyond Snapshot

This section stores the raw canonical spell content in an HTML comment so the structured Aralia field block, when present, remains the only validator-facing markdown surface.

<!--
Name: Dancing Lights
Level: Cantrip
Casting Time: 1 Action
Range/Area: 120 ft.
Components: V, S, M *
Duration: Concentration 1 Minute
School: Illusion
Attack/Save: None
Damage/Effect: Utility

Rules Text:
You create up to four torch-size lights within range, making them appear as torches, lanterns, or glowing orbs that hover for the duration. Alternatively, you combine the four lights into one glowing Medium form that is vaguely humanlike. Whichever form you choose, each light sheds Dim Light in a 10-foot radius.
As a Bonus Action, you can move the lights up to 60 feet to a space within range. A light must be within 20 feet of another light created by this spell, and a light vanishes if it exceeds the spell's range.

Material Component:
* - (a bit of phosphorus)

Spell Tags:
Utility

Available For:
Bard
Sorcerer
Wizard
Artificer
-->
