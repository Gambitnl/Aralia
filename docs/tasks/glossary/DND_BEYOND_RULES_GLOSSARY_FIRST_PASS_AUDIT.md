# D&D Beyond Rules Glossary First-Pass Audit

Source surface audited:

- [D&D Beyond Basic Rules 2024 Rules Glossary](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary)

This audit is intentionally narrower than the raw local `Rules Glossary` count.
It focuses on rules that are meaningful for Aralia's gameplay, spell
interpretation, and glossary cross-linking, not on every rule-adjacent catalog
entry that happens to live in local glossary storage.

## Audit Standard

For each D&D Beyond glossary term:

1. Does an Aralia glossary rule entry exist?
2. If yes, is the phrasing aligned with Aralia's simulation/world-state framing?
3. If yes, is the rule stored in the right glossary section?
4. If no, should it be added at all?

## Status Vocabulary

- `Exists / Good`: present, useful, and phrased acceptably
- `Exists / Needs Rephrase`: present, but still framed too much like tabletop player procedure or DM mediation
- `Exists / Wrong Section`: present, but filed in a glossary section that does not match its real rule role
- `Missing / Add`: not present and should be added
- `Missing / Skip`: not present and not worth adding to Aralia's primary glossary rule surface

## First Official Slice

These entries come from the early visible section of the official D&D Beyond
Rules Glossary page:

- `Ability Check`
- `Ability Score and Modifier`
- `Action`
- `Advantage`
- `Adventure`
- `Alignment`
- `Ally`
- `Area of Effect`
- `Armor Class`
- `Armor Training`
- `Attack [Action]`

## Current First-Pass Judgments

### Ability Check

- Official term: `Ability Check`
- Aralia status: `Exists / Good`
- Local file:
  - [ability_check.json](F:\Repos\Aralia\public\data\glossary\entries\rules\ability_check.json)
- Notes:
  - Present as a proper top-level glossary rule entry in the expected section.

### Ability Score and Modifier

- Official term: `Ability Score and Modifier`
- Aralia status: `Exists / Good`
- Local file:
  - [ability_score_and_modifier.json](F:\Repos\Aralia\public\data\glossary\entries\rules\ability_score_and_modifier.json)
- Notes:
  - Aralia now has a dedicated bridge entry for the parent concept while still preserving the individual ability entries.

### Action

- Official term: `Action`
- Aralia status: `Exists / Good`
- Local file:
  - [action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\action.json)
- Notes:
  - Present in the expected section and already useful.

### Advantage

- Official term: `Advantage`
- Aralia status: `Exists / Good`
- Local file:
  - [advantage.json](F:\Repos\Aralia\public\data\glossary\entries\rules\advantage.json)
- Notes:
  - The current entry now frames advantage as a system-resolution modifier on a `d20_test` rather than as player-instruction prose.

### Adventure

- Official term: `Adventure`
- Aralia status: `Missing / Skip`
- Notes:
  - This does not appear necessary for Aralia's core rule and spell glossary surface.
  - It is too meta / tabletop-structural to justify adding as a primary glossary rule term right now.

### Alignment

- Official term: `Alignment`
- Aralia status: `Exists / Good`
- Local file:
  - [alignment.json](F:\Repos\Aralia\public\data\glossary\entries\rules\alignment.json)
- Notes:
  - Present as a top-level world-state and creature-identity rule.

### Ally

- Official term: `Ally`
- Aralia status: `Exists / Good`
- Local file:
  - [ally.json](F:\Repos\Aralia\public\data\glossary\entries\rules\ally.json)
- Notes:
  - Present as a top-level relationship-state rule with targeting-facing wording.

### Area of Effect

- Official term: `Area of Effect`
- Aralia status: `Exists / Good`
- Local file:
  - [area_of_effect.json](F:\Repos\Aralia\public\data\glossary\entries\rules\area_of_effect.json)
- Notes:
  - Present as a top-level parent rule that links the common area shapes together.

### Armor Class

- Official term: `Armor Class`
- Aralia status: `Exists / Good`
- Local file:
  - [armor_class.json](F:\Repos\Aralia\public\data\glossary\entries\rules\armor_class.json)

### Armor Training

- Official term: `Armor Training`
- Aralia status: `Exists / Good`
- Local file:
  - [armor_training.json](F:\Repos\Aralia\public\data\glossary\entries\rules\equipment\armor\armor_training.json)
- Notes:
  - Present, but likely worth a later section-placement review because the official glossary treats it as a rule term while Aralia files it under the equipment/armor subtree.

### Attack [Action]

- Official term: `Attack [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [attack_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\attack_action.json)

## Relevant Referenced-Rule Gaps Already Known

These spell-linked rules are already known to be represented incompletely:

- `Cone`
- `Cube`
- `Cylinder`
- `Difficult Terrain`
- `Emanation`
- `Half Cover`
- `Heavily Obscured`
- `Lightly Obscured`
- `Line`
- `Three-Quarters Cover`
- `Total Cover`

Those are especially high-value because they already appear in spell references
and should eventually resolve to full glossary rules with real text.

## Second Official Slice

These entries continue directly from the same official D&D Beyond glossary page:

- `Attack Roll`
- `Attitude`
- `Attunement`
- `Blinded [Condition]`
- `Blindsight`
- `Bloodied`
- `Bonus Action`
- `Breaking Objects`
- `Bright Light`
- `Burning [Hazard]`
- `Burrow Speed`
- `Campaign`
- `Cantrip`
- `Carrying Capacity`
- `Challenge Rating`
- `Character Sheet`
- `Charmed [Condition]`
- `Climbing`
- `Climb Speed`
- `Concentration`
- `Condition`

## Current Second-Pass Judgments

### Attack Roll

- Official term: `Attack Roll`
- Aralia status: `Exists / Good`
- Local file:
  - [attack_roll.json](F:\Repos\Aralia\public\data\glossary\entries\rules\attack_roll.json)
- Notes:
  - Present as a clean top-level glossary rule.

### Attitude

- Official term: `Attitude`
- Aralia status: `Exists / Good`
- Local file:
  - [attitude.json](F:\Repos\Aralia\public\data\glossary\entries\rules\attitude.json)
- Notes:
  - Aralia now has a dedicated parent `Attitude` rule instead of relying only on the child social states.

### Attunement

- Official term: `Attunement`
- Aralia status: `Exists / Good`
- Local file:
  - [attunement.json](F:\Repos\Aralia\public\data\glossary\entries\rules\attunement.json)
- Notes:
  - Present as a top-level glossary rule entry rather than only under the magic-items subtree.

### Blinded [Condition]

- Official term: `Blinded [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [blinded_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\blinded_condition.json)

### Blindsight

- Official term: `Blindsight`
- Aralia status: `Exists / Good`
- Local file:
  - [blindsight.json](F:\Repos\Aralia\public\data\glossary\entries\rules\blindsight.json)

### Bloodied

- Official term: `Bloodied`
- Aralia status: `Exists / Good`
- Local file:
  - [bloodied.json](F:\Repos\Aralia\public\data\glossary\entries\rules\bloodied.json)
- Notes:
  - Present as a current health-threshold rule written in world-state and combat-state terms.

### Bonus Action

- Official term: `Bonus Action`
- Aralia status: `Exists / Good`
- Local file:
  - [bonus_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\bonus_action.json)
- Notes:
  - Present and useful.
  - Some examples remain tabletop-player flavored, but the core rule is already serviceable.

### Breaking Objects

- Official term: `Breaking Objects`
- Aralia status: `Exists / Good`
- Local file:
  - [breaking_objects.json](F:\Repos\Aralia\public\data\glossary\entries\rules\breaking_objects.json)
- Notes:
  - Present as a real object-state and environment-change rule rather than a short stub.

### Bright Light

- Official term: `Bright Light`
- Aralia status: `Exists / Good`
- Local file:
  - [bright_light.json](F:\Repos\Aralia\public\data\glossary\entries\rules\bright_light.json)
- Notes:
  - Present as a substantive visibility-baseline and illumination-state rule.

### Burning [Hazard]

- Official term: `Burning [Hazard]`
- Aralia status: `Exists / Good`
- Local file:
  - [burning.json](F:\Repos\Aralia\public\data\glossary\entries\rules\burning.json)
- Notes:
  - Present as an ongoing fire-hazard and ignition-state rule.

### Burrow Speed

- Official term: `Burrow Speed`
- Aralia status: `Exists / Good`
- Notes:
  - Aralia already keeps movement/speed rules in the rules corpus, and this term appears to exist as part of that movement surface.
  - It still deserves later phrasing review to ensure it is simulation-facing rather than tabletop-instruction facing.

### Campaign

- Official term: `Campaign`
- Aralia status: `Missing / Skip`
- Notes:
  - This is too tabletop-structural to count as a priority gameplay rule for Aralia's glossary surface.

### Cantrip

- Official term: `Cantrip`
- Aralia status: `Exists / Good`
- Notes:
  - A local `cantrip` glossary rule file exists and is a relevant spell term.

### Carrying Capacity

- Official term: `Carrying Capacity`
- Aralia status: `Exists / Good`
- Local file:
  - [carrying_capacity.json](F:\Repos\Aralia\public\data\glossary\entries\rules\carrying_capacity.json)
- Notes:
  - Present as a top-level load and weight-limit rule.

### Challenge Rating

- Official term: `Challenge Rating`
- Aralia status: `Exists / Good`
- Local file:
  - [challenge_rating.json](F:\Repos\Aralia\public\data\glossary\entries\rules\challenge_rating.json)
- Notes:
  - Present as a creature-stat-block threat and eligibility index, not as DM-facing guidance.

### Character Sheet

- Official term: `Character Sheet`
- Aralia status: `Missing / Skip`
- Notes:
  - This is application/meta-surface terminology, not a high-value gameplay rule term for the glossary lane we are auditing.

### Charmed [Condition]

- Official term: `Charmed [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [charmed_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\charmed_condition.json)

### Climbing

- Official term: `Climbing`
- Aralia status: `Exists / Good`
- Notes:
  - Aralia keeps movement rules in the glossary corpus, and `Climbing` appears to exist in that movement subtree.

### Climb Speed

- Official term: `Climb Speed`
- Aralia status: `Exists / Good`
- Notes:
  - Appears to exist as part of the movement/speed rules surface and belongs in the relevant target set.

### Concentration

- Official term: `Concentration`
- Aralia status: `Exists / Good`
- Local file:
  - [concentration.json](F:\Repos\Aralia\public\data\glossary\entries\rules\concentration.json)
- Notes:
  - Present as a maintained spell-state rule with system-resolution wording.

### Condition

- Official term: `Condition`
- Aralia status: `Exists / Good`
- Notes:
  - Aralia clearly has a dedicated conditions surface and child condition entries.
  - The parent term appears to exist and belongs in the right target set.

## Third Official Slice

Continuing in order from the official D&D Beyond glossary page:

- `Cone [Area of Effect]`
- `Cover`
- `Crawling`
- `Creature`
- `Creature Type`
- `Critical Hit`
- `Cube [Area of Effect]`
- `Curses`
- `Cylinder [Area of Effect]`
- `D20 Test`
- `Damage`
- `Damage Roll`
- `Damage Threshold`
- `Damage Types`
- `Darkness`
- `Darkvision`
- `Dash [Action]`
- `Dead`
- `Deafened [Condition]`
- `Death Saving Throw`
- `Dehydration [Hazard]`
- `Difficult Terrain`
- `Difficulty Class`
- `Dim Light`
- `Disadvantage`
- `Disengage [Action]`
- `Dodge [Action]`
- `Emanation [Area of Effect]`
- `Encounter`
- `Enemy`
- `Exhaustion [Condition]`
- `Experience Points`
- `Expertise`
- `Falling [Hazard]`
- `Flying`
- `Fly Speed`
- `Friendly [Attitude]`
- `Frightened [Condition]`
- `Grappled [Condition]`
- `Grappling`
- `Hazard`
- `Healing`
- `Heavily Obscured`
- `Help [Action]`

## Current Third-Pass Judgments

### Cone [Area of Effect]

- Official term: `Cone [Area of Effect]`
- Aralia status: `Exists / Good`
- Local file:
  - [cone_area.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\cone_area.json)
- Notes:
  - The entry now has real rule text, but it still lives under the spell-referenced subtree rather than as a deliberate top-level rule file.

### Cover

- Official term: `Cover`
- Aralia status: `Exists / Good`
- Local file:
  - [cover.json](F:\Repos\Aralia\public\data\glossary\entries\rules\cover.json)
- Notes:
  - Present as a parent cover rule that links the common cover degrees together.

### Crawling

- Official term: `Crawling`
- Aralia status: `Exists / Good`
- Local file:
  - [crawling.json](F:\Repos\Aralia\public\data\glossary\entries\rules\movement\crawling.json)

### Creature

- Official term: `Creature`
- Aralia status: `Exists / Good`
- Local file:
  - [creature.json](F:\Repos\Aralia\public\data\glossary\entries\rules\creature.json)
- Notes:
  - Present as a top-level active-entity rule for creature-facing resolution.

### Creature Type

- Official term: `Creature Type`
- Aralia status: `Exists / Good`
- Local file:
  - [creature_type.json](F:\Repos\Aralia\public\data\glossary\entries\rules\creature_type.json)
- Notes:
  - Present as a top-level creature-classification rule.

### Critical Hit

- Official term: `Critical Hit`
- Aralia status: `Exists / Good`
- Local file:
  - [critical_hit.json](F:\Repos\Aralia\public\data\glossary\entries\rules\critical_hit.json)
- Notes:
  - Present as a standalone attack-outcome rule.

### Cube [Area of Effect]

- Official term: `Cube [Area of Effect]`
- Aralia status: `Exists / Good`
- Local file:
  - [cube_area.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\cube_area.json)
- Notes:
  - The entry now carries substantive rule text, but it is still stored under the spell-referenced subtree.

### Curses

- Official term: `Curses`
- Aralia status: `Exists / Good`
- Local file:
  - [curse.json](F:\Repos\Aralia\public\data\glossary\entries\rules\curse.json)
- Notes:
  - Present as a top-level harmful attached-state rule.

### Cylinder [Area of Effect]

- Official term: `Cylinder [Area of Effect]`
- Aralia status: `Exists / Good`
- Local file:
  - [cylinder_area.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\cylinder_area.json)
- Notes:
  - The entry now carries substantive rule text, but it is still stored under the spell-referenced subtree.

### D20 Test

- Official term: `D20 Test`
- Aralia status: `Exists / Good`
- Local file:
  - [d20_test.json](F:\Repos\Aralia\public\data\glossary\entries\rules\d20_test.json)
- Notes:
  - The core resolution sequence is now framed as a system rule and no longer depends on DM-facing wording.

### Damage

- Official term: `Damage`
- Aralia status: `Exists / Good`
- Local file:
  - [damage.json](F:\Repos\Aralia\public\data\glossary\entries\rules\damage.json)
- Notes:
  - Present as a standalone damage-resolution rule.

### Damage Roll

- Official term: `Damage Roll`
- Aralia status: `Exists / Good`
- Local file:
  - [damage_roll.json](F:\Repos\Aralia\public\data\glossary\entries\rules\damage_roll.json)
- Notes:
  - Present as a standalone roll-resolution rule for damage amounts.

### Damage Threshold

- Official term: `Damage Threshold`
- Aralia status: `Exists / Good`
- Local file:
  - [damage_threshold.json](F:\Repos\Aralia\public\data\glossary\entries\rules\damage_threshold.json)
- Notes:
  - Present as a top-level glossary rule, with vehicle-specific use treated as a related application rather than the only home.

### Damage Types

- Official term: `Damage Types`
- Aralia status: `Exists / Good`
- Local file:
  - [damage_types.json](F:\Repos\Aralia\public\data\glossary\entries\rules\damage_types.json)
- Notes:
  - Present as a top-level type-family rule for typed damage handling.

### Darkness

- Official term: `Darkness`
- Aralia status: `Exists / Good`
- Local file:
  - [darkness.json](F:\Repos\Aralia\public\data\glossary\entries\rules\darkness.json)
- Notes:
  - Present and useful.
  - One local linking choice still looks off:
    - it links to `obscured_areas` rather than a cleaner explicit `Heavily Obscured` rule term

### Darkvision

- Official term: `Darkvision`
- Aralia status: `Exists / Good`
- Local file:
  - [darkvision.json](F:\Repos\Aralia\public\data\glossary\entries\rules\darkvision.json)
- Notes:
  - Present and useful.
  - Some phrasing still addresses a creature as `you`, but it is much closer to acceptable than several other entries.

### Dash [Action]

- Official term: `Dash [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [dash_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\dash_action.json)
- Notes:
  - Present as a standalone glossary action entry.

### Dead

- Official term: `Dead`
- Aralia status: `Exists / Good`
- Local file:
  - [dead.json](F:\Repos\Aralia\public\data\glossary\entries\rules\dead.json)
- Notes:
  - Present as a top-level death-state rule.

### Deafened [Condition]

- Official term: `Deafened [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [deafened_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\deafened_condition.json)

### Death Saving Throw

- Official term: `Death Saving Throw`
- Aralia status: `Exists / Good`
- Local file:
  - [death_saving_throw.json](F:\Repos\Aralia\public\data\glossary\entries\rules\death_saving_throw.json)
- Notes:
  - Present as a standalone near-death resolution rule.

### Dehydration [Hazard]

- Official term: `Dehydration [Hazard]`
- Aralia status: `Exists / Good`
- Local file:
  - [dehydration.json](F:\Repos\Aralia\public\data\glossary\entries\rules\dehydration.json)
- Notes:
  - Aralia now has a standalone dehydration hazard entry in the main rules glossary surface.

### Difficult Terrain

- Official term: `Difficult Terrain`
- Aralia status: `Exists / Good`
- Local file:
  - [difficult_terrain.json](F:\Repos\Aralia\public\data\glossary\entries\rules\difficult_terrain.json)
- Notes:
  - Present as a proper top-level movement rule entry.

### Difficulty Class

- Official term: `Difficulty Class`
- Aralia status: `Exists / Good`
- Notes:
  - Aralia already has DC-adjacent entries, though naming may differ between `Difficulty Class` and specific subcases like ability-check DC or saving-throw DC.

### Dim Light

- Official term: `Dim Light`
- Aralia status: `Exists / Good`
- Notes:
  - Present in the rules corpus and already used by related vision/light entries.

### Disadvantage

- Official term: `Disadvantage`
- Aralia status: `Exists / Good`
- Local file:
  - [disadvantage.json](F:\Repos\Aralia\public\data\glossary\entries\rules\disadvantage.json)
- Notes:
  - The current entry now frames disadvantage as a system-resolution modifier on a `d20_test`.

### Disengage [Action]

- Official term: `Disengage [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [disengage_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\disengage_action.json)
- Notes:
  - Present as a standalone glossary action entry.

### Dodge [Action]

- Official term: `Dodge [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [dodge_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\dodge_action.json)
- Notes:
  - Present as a standalone glossary action entry.

### Emanation [Area of Effect]

- Official term: `Emanation [Area of Effect]`
- Aralia status: `Exists / Good`
- Local file:
  - [emanation_area.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\emanation_area.json)
- Notes:
  - The entry now has substantive rule text, but it is still stored under the spell-referenced subtree.

### Encounter

- Official term: `Encounter`
- Aralia status: `Missing / Skip`
- Notes:
  - Too tabletop-structural to count as a priority glossary rule term for Aralia right now.

### Enemy

- Official term: `Enemy`
- Aralia status: `Exists / Good`
- Local file:
  - [enemy.json](F:\Repos\Aralia\public\data\glossary\entries\rules\enemy.json)
- Notes:
  - Present as a top-level relationship-state rule for hostile/opposed targeting logic.

### Exhaustion [Condition]

- Official term: `Exhaustion [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [exhaustion_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\exhaustion_condition.json)

### Experience Points

- Official term: `Experience Points`
- Aralia status: `Missing / Skip`
- Notes:
  - This is likely too tabletop-campaign-structure centric for the current priority glossary surface.

### Expertise

- Official term: `Expertise`
- Aralia status: `Exists / Good`
- Local file:
  - [expertise.json](F:\Repos\Aralia\public\data\glossary\entries\rules\expertise.json)

### Falling [Hazard]

- Official term: `Falling [Hazard]`
- Aralia status: `Exists / Good`
- Local file:
  - [falling.json](F:\Repos\Aralia\public\data\glossary\entries\rules\falling.json)
- Notes:
  - Present as a dedicated hazard/movement rule entry.

### Flying

- Official term: `Flying`
- Aralia status: `Exists / Good`
- Local file:
  - [flying.json](F:\Repos\Aralia\public\data\glossary\entries\rules\movement\flying.json)

### Fly Speed

- Official term: `Fly Speed`
- Aralia status: `Exists / Good`
- Local file:
  - [fly_speed.json](F:\Repos\Aralia\public\data\glossary\entries\rules\fly_speed.json)
- Notes:
  - Aralia now has a dedicated `Fly Speed` bridge entry rather than only covering the concept inside `Flying`.

### Friendly [Attitude]

- Official term: `Friendly [Attitude]`
- Aralia status: `Exists / Good`
- Local file:
  - [friendly_attitude.json](F:\Repos\Aralia\public\data\glossary\entries\rules\friendly_attitude.json)
- Notes:
  - Present as a top-level social-state child of the broader `Attitude` rule.

### Frightened [Condition]

- Official term: `Frightened [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [frightened_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\frightened_condition.json)

### Grappled [Condition]

- Official term: `Grappled [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [grappled_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\grappled_condition.json)

### Grappling

- Official term: `Grappling`
- Aralia status: `Exists / Good`
- Local file:
  - [grappling.json](F:\Repos\Aralia\public\data\glossary\entries\rules\grappling.json)
- Notes:
  - Present as a standalone grapple-state and control rule entry.

### Hazard

- Official term: `Hazard`
- Aralia status: `Exists / Good`
- Local file:
  - [hazards.json](F:\Repos\Aralia\public\data\glossary\entries\rules\hazards.json)
- Notes:
  - Present as a parent environmental-danger rule with links to the major survival and damage hazards.

### Healing

- Official term: `Healing`
- Aralia status: `Exists / Good`
- Local file:
  - [healing.json](F:\Repos\Aralia\public\data\glossary\entries\rules\healing.json)
- Notes:
  - Present as a top-level restoration and recovery rule distinct from temporary hit points.

### Heavily Obscured

- Official term: `Heavily Obscured`
- Aralia status: `Exists / Good`
- Local file:
  - [heavily_obscured.json](F:\Repos\Aralia\public\data\glossary\entries\rules\heavily_obscured.json)

### Help [Action]

- Official term: `Help [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [help_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\help_action.json)
- Notes:
  - Present as a standalone glossary action entry.

## Fourth Official Slice

These entries continue directly from the same official D&D Beyond glossary page:

- `Heroic Inspiration`
- `Hide [Action]`
- `High Jump`
- `Hit Point Dice`
- `Hit Points`
- `Hostile [Attitude]`
- `Hover`
- `Illusions`
- `Immunity`
- `Improvised Weapons`
- `Incapacitated [Condition]`
- `Indifferent [Attitude]`
- `Influence [Action]`
- `Initiative`
- `Invisible [Condition]`
- `Jumping`
- `Knocking Out a Creature`
- `Lightly Obscured`
- `Line [Area of Effect]`
- `Long Jump`

## Current Fourth-Pass Judgments

### Heroic Inspiration

- Official term: `Heroic Inspiration`
- Aralia status: `Missing / Skip for now`
- Notes:
  - This is a current-table reward mechanic rather than a core world-state rule Aralia obviously needs right now.
  - It may become relevant later, but it should not outrank higher-value spell, movement, cover, visibility, and relationship rules.

### Hide [Action]

- Official term: `Hide [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [hide_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\hide_action.json)
- Notes:
  - Aralia now has a dedicated Hide action entry with substantive detection, concealment, and hidden-state text.

### High Jump

- Official term: `High Jump`
- Aralia status: `Exists / Good`
- Local file:
  - [high_jump.json](F:\Repos\Aralia\public\data\glossary\entries\rules\high_jump.json)
- Notes:
  - Aralia now has a dedicated bridge entry for the vertical branch of the broader `Jumping` rule.

### Hit Point Dice

- Official term: `Hit Point Dice`
- Aralia status: `Missing / Skip for now`
- Notes:
  - This is mostly character-sheet and rest-resource bookkeeping.
  - It matters for tabletop player procedure, but it is not currently one of the highest-value glossary additions for Aralia's world-facing rules layer.

### Hit Points

- Official term: `Hit Points`
- Aralia status: `Exists / Good`
- Local file:
  - [hit_points.json](F:\Repos\Aralia\public\data\glossary\entries\rules\hit_points.json)
- Notes:
  - The current entry now frames hit points as a durability-state rule rather than as a character-build tutorial.
  - It still includes some recovery and ceiling detail beyond the tightest possible glossary core.

### Hostile [Attitude]

- Official term: `Hostile [Attitude]`
- Aralia status: `Exists / Good`
- Local file:
  - [hostile_attitude.json](F:\Repos\Aralia\public\data\glossary\entries\rules\hostile_attitude.json)
- Notes:
  - Present as a top-level social-state child of the broader `Attitude` rule.

### Hover

- Official term: `Hover`
- Aralia status: `Exists / Good`
- Local file:
  - [hover.json](F:\Repos\Aralia\public\data\glossary\entries\rules\hover.json)
- Notes:
  - Present as a dedicated movement rule.

### Illusions

- Official term: `Illusions`
- Aralia status: `Exists / Good`
- Local file:
  - [illusions.json](F:\Repos\Aralia\public\data\glossary\entries\rules\illusions.json)
- Notes:
  - Present as a top-level interpretation rule for deceptive magical effects.

### Immunity

- Official term: `Immunity`
- Aralia status: `Exists / Good`
- Local file:
  - [immunity.json](F:\Repos\Aralia\public\data\glossary\entries\rules\immunity.json)
- Notes:
  - Present as a standalone parent defense rule.

### Improvised Weapons

- Official term: `Improvised Weapons`
- Aralia status: `Exists / Good`
- Local file:
  - [improvised_weapons.json](F:\Repos\Aralia\public\data\glossary\entries\rules\improvised_weapons.json)
- Notes:
  - Aralia now has a dedicated combat-rule entry for nonstandard objects used as weapons.

### Incapacitated [Condition]

- Official term: `Incapacitated [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [incapacitated_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\incapacitated_condition.json)

### Indifferent [Attitude]

- Official term: `Indifferent [Attitude]`
- Aralia status: `Exists / Good`
- Local file:
  - [indifferent_attitude.json](F:\Repos\Aralia\public\data\glossary\entries\rules\indifferent_attitude.json)
- Notes:
  - Present as a top-level social-state child of the broader `Attitude` rule.

### Influence [Action]

- Official term: `Influence [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [influence_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\influence_action.json)
- Notes:
  - Aralia now has an Aralia-facing social-action entry rather than only a planned gap.

### Initiative

- Official term: `Initiative`
- Aralia status: `Exists / Good`
- Local file:
  - [initiative.json](F:\Repos\Aralia\public\data\glossary\entries\rules\initiative.json)
- Notes:
  - The current entry centers on encounter ordering and turn resolution instead of player coaching.
  - It still carries a little implementation-detail discussion around tie procedures and modifiers.
  - It should be tightened toward the core turn-order rule.

### Invisible [Condition]

- Official term: `Invisible [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [invisible_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\invisible_condition.json)

### Jumping

- Official term: `Jumping`
- Aralia status: `Exists / Good`
- Local file:
  - [jumping.json](F:\Repos\Aralia\public\data\glossary\entries\rules\movement\jumping.json)
- Notes:
  - Present and useful.
  - The entry is broader than the official top-level rule because it folds `High Jump` and `Long Jump` together, which is acceptable for now but still worth noting.

### Knocking Out a Creature

- Official term: `Knocking Out a Creature`
- Aralia status: `Exists / Good`
- Local file:
  - [knocking_out_a_creature.json](F:\Repos\Aralia\public\data\glossary\entries\rules\knocking_out_a_creature.json)
- Notes:
  - Aralia now has a dedicated nonlethal combat-resolution entry.

### Lightly Obscured

- Official term: `Lightly Obscured`
- Aralia status: `Exists / Good`
- Local file:
  - [lightly_obscured.json](F:\Repos\Aralia\public\data\glossary\entries\rules\lightly_obscured.json)
- Notes:
  - Present as a proper top-level vision rule entry.

### Line [Area of Effect]

- Official term: `Line [Area of Effect]`
- Aralia status: `Exists / Good`
- Local file:
  - [line_area.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\line_area.json)
- Notes:
  - The entry now has substantive rule text, but it is still stored under the spell-referenced subtree.

### Long Jump

- Official term: `Long Jump`
- Aralia status: `Exists / Good`
- Local file:
  - [long_jump.json](F:\Repos\Aralia\public\data\glossary\entries\rules\long_jump.json)
- Notes:
  - Aralia now has a dedicated bridge entry for the horizontal branch of the broader `Jumping` rule.

## Fifth Official Slice

These entries continue directly from the same official D&D Beyond glossary page:

- `Long Rest`
- `Magic [Action]`
- `Magical Effect`
- `Malnutrition [Hazard]`
- `Monster`
- `Nonplayer Character`
- `Object`
- `Occupied Space`
- `Opportunity Attacks`
- `Paralyzed [Condition]`
- `Passive Perception`
- `Per Day`
- `Petrified [Condition]`
- `Player Character`
- `Poisoned [Condition]`
- `Possession`

## Current Fifth-Pass Judgments

### Long Rest

- Official term: `Long Rest`
- Aralia status: `Exists / Good`
- Local file:
  - [long_rest.json](F:\Repos\Aralia\public\data\glossary\entries\rules\long_rest.json)
- Notes:
  - The current entry is a clean rule-facing recovery interval entry with interruption and limit handling.

### Magic [Action]

- Official term: `Magic [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [magic_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\magic_action.json)
- Notes:
  - The current entry now presents a cleaner action-economy rule surface, though it still carries broader spellcasting support detail than the official glossary term.

### Magical Effect

- Official term: `Magical Effect`
- Aralia status: `Exists / Good`
- Local file:
  - [magical_effect.json](F:\Repos\Aralia\public\data\glossary\entries\rules\magical_effect.json)
- Notes:
  - Present as a standalone interpretation rule for magic-sourced outcomes and states.

### Malnutrition [Hazard]

- Official term: `Malnutrition [Hazard]`
- Aralia status: `Exists / Good`
- Local file:
  - [malnutrition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\malnutrition.json)
- Notes:
  - Aralia now has a standalone malnutrition hazard entry in the main rules glossary surface.

### Monster

- Official term: `Monster`
- Aralia status: `Missing / Skip for now`
- Notes:
  - This is more compendium and presentation-facing than glossary-rule-critical for the current Aralia target set.

### Nonplayer Character

- Official term: `Nonplayer Character`
- Aralia status: `Missing / Skip for now`
- Notes:
  - Important conceptually, but not a priority glossary-rule term for the current spell/rules coverage lane.

### Object

- Official term: `Object`
- Aralia status: `Exists / Good`
- Local file:
  - [object.json](F:\Repos\Aralia\public\data\glossary\entries\rules\object.json)
- Notes:
  - Present as a top-level world-object and targeting rule.

### Occupied Space

- Official term: `Occupied Space`
- Aralia status: `Exists / Good`
- Local file:
  - [occupied_space.json](F:\Repos\Aralia\public\data\glossary\entries\rules\occupied_space.json)
- Notes:
  - Present as a top-level space-state rule.

### Opportunity Attacks

- Official term: `Opportunity Attacks`
- Aralia status: `Exists / Good`
- Local file:
  - [opportunity_attack.json](F:\Repos\Aralia\public\data\glossary\entries\rules\opportunity_attack.json)
- Notes:
  - The core trigger-and-reaction rule is now in place, though the entry still carries some modifier examples beyond the tight glossary core.

### Paralyzed [Condition]

- Official term: `Paralyzed [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [paralyzed_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\paralyzed_condition.json)

### Passive Perception

- Official term: `Passive Perception`
- Aralia status: `Exists / Good`
- Local file:
  - [passive_perception.json](F:\Repos\Aralia\public\data\glossary\entries\rules\passive_perception.json)
- Notes:
  - Present as a top-level background-awareness and detection rule.

### Per Day

- Official term: `Per Day`
- Aralia status: `Missing / Skip for now`
- Notes:
  - This is not currently a high-value standalone glossary rule for Aralia's main rules surface.

### Petrified [Condition]

- Official term: `Petrified [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [petrified_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\petrified_condition.json)

### Player Character

- Official term: `Player Character`
- Aralia status: `Missing / Skip for now`
- Notes:
  - This is too tabletop-role-specific for the current glossary-rule target set.

### Poisoned [Condition]

- Official term: `Poisoned [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [poisoned_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\poisoned_condition.json)

### Possession

- Official term: `Possession`
- Aralia status: `Exists / Good`
- Local file:
  - [possession.json](F:\Repos\Aralia\public\data\glossary\entries\rules\possession.json)
- Notes:
  - Aralia now has a dedicated parent possession rule entry; the spell-referenced `possessed` entry is secondary bridge support rather than the only local coverage.

## Sixth Official Slice

These entries continue directly from the same official D&D Beyond glossary page:

- `Proficiency`
- `Prone [Condition]`
- `Reach`
- `Reaction`
- `Ready [Action]`
- `Resistance`
- `Restrained [Condition]`
- `Ritual`
- `Round Down`
- `Save`
- `Saving Throw`
- `Search [Action]`
- `Shape-Shifting`
- `Short Rest`
- `Simultaneous Effects`
- `Size`
- `Skill`
- `Speed`

## Current Sixth-Pass Judgments

### Proficiency

- Official term: `Proficiency`
- Aralia status: `Exists / Good`
- Local file:
  - [proficiency.json](F:\Repos\Aralia\public\data\glossary\entries\rules\proficiency.json)
- Notes:
  - Present as a real top-level rule entry and already close to the official glossary role.

### Prone [Condition]

- Official term: `Prone [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [prone_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\prone_condition.json)

### Reach

- Official term: `Reach`
- Aralia status: `Exists / Good`
- Local file:
  - [reach.json](F:\Repos\Aralia\public\data\glossary\entries\rules\reach.json)
- Notes:
  - Present as a top-level combat and targeting rule rather than only a weapon-property footnote.

### Reaction

- Official term: `Reaction`
- Aralia status: `Exists / Good`
- Local file:
  - [reaction.json](F:\Repos\Aralia\public\data\glossary\entries\rules\reaction.json)
- Notes:
  - The current entry is now focused on trigger, timing, and refresh behavior rather than tutorial-style elaboration.

### Ready [Action]

- Official term: `Ready [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [ready_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\ready_action.json)
- Notes:
  - Present as a standalone timing and reaction rule entry.

### Resistance

- Official term: `Resistance`
- Aralia status: `Exists / Good`
- Local file:
  - [resistance.json](F:\Repos\Aralia\public\data\glossary\entries\rules\resistance.json)
- Notes:
  - Present as a standalone parent damage-resolution rule.

### Restrained [Condition]

- Official term: `Restrained [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [restrained_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\restrained_condition.json)

### Ritual

- Official term: `Ritual`
- Aralia status: `Exists / Good`
- Local file:
  - [ritual.json](F:\Repos\Aralia\public\data\glossary\entries\rules\ritual.json)
- Notes:
  - The core ritual-casting rule is now present and usable, though the entry still includes access-source detail beyond the tight glossary core.

### Round Down

- Official term: `Round Down`
- Aralia status: `Exists / Good`
- Local file:
  - [round_down.json](F:\Repos\Aralia\public\data\glossary\entries\rules\round_down.json)
- Notes:
  - Present as a standalone numeric interpretation rule.

### Save

- Official term: `Save`
- Aralia status: `Exists / Good`
- Local file:
  - [save.json](F:\Repos\Aralia\public\data\glossary\entries\rules\save.json)
- Notes:
  - Aralia now has a dedicated shorthand bridge entry for `Save` instead of only folding the concept into `Saving Throw`.

### Saving Throw

- Official term: `Saving Throw`
- Aralia status: `Exists / Good`
- Local file:
  - [saving_throw.json](F:\Repos\Aralia\public\data\glossary\entries\rules\saving_throw.json)
- Notes:
  - Present as a concise rule-facing d20-test entry with linked sub-entries for modifier, proficiency, and DC handling.

### Search [Action]

- Official term: `Search [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [search_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\search_action.json)
- Notes:
  - Present as a standalone information-gathering action rule.

### Shape-Shifting

- Official term: `Shape-Shifting`
- Aralia status: `Exists / Good`
- Local file:
  - [shape_shift.json](F:\Repos\Aralia\public\data\glossary\entries\rules\shape_shift.json)
- Notes:
  - Present as a top-level transformation and world-state rule.

### Short Rest

- Official term: `Short Rest`
- Aralia status: `Exists / Good`
- Local file:
  - [short_rest.json](F:\Repos\Aralia\public\data\glossary\entries\rules\short_rest.json)
- Notes:
  - The current entry is a clean rule-facing recovery interval entry with hit-die and interruption handling.

### Simultaneous Effects

- Official term: `Simultaneous Effects`
- Aralia status: `Exists / Good`
- Local file:
  - [simultaneous_effects.json](F:\Repos\Aralia\public\data\glossary\entries\rules\simultaneous_effects.json)
- Notes:
  - Present as a standalone timing and ordering rule.

### Size

- Official term: `Size`
- Aralia status: `Exists / Good`
- Local file:
  - [size.json](F:\Repos\Aralia\public\data\glossary\entries\rules\size.json)
- Notes:
  - Present and useful.
  - The local title is `Size Categories`, which is slightly narrower than the official term but still serviceable.

### Skill

- Official term: `Skill`
- Aralia status: `Exists / Good`
- Local file:
  - [skill.json](F:\Repos\Aralia\public\data\glossary\entries\rules\skill.json)
- Notes:
  - Present as a standalone parent rule for skill-based checks and training.

### Speed

- Official term: `Speed`
- Aralia status: `Exists / Good`
- Local file:
  - [speed.json](F:\Repos\Aralia\public\data\glossary\entries\rules\speed.json)
- Notes:
  - Present and useful.
  - The current entry is thin, but it already works as a legitimate top-level rule anchor.

## Seventh Official Slice

These entries continue directly from the same official D&D Beyond glossary page:

- `Spell`
- `Spell Attack`
- `Spellcasting Focus`
- `Sphere [Area of Effect]`
- `Stable`
- `Stat Block`
- `Study [Action]`
- `Stunned [Condition]`
- `Suffocation [Hazard]`
- `Surprise`
- `Swimming`
- `Swim Speed`

## Current Seventh-Pass Judgments

### Spell

- Official term: `Spell`
- Aralia status: `Exists / Good`
- Local file:
  - [spell.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spell.json)
- Notes:
  - Aralia now has a dedicated singular `Spell` rule entry rather than only the broader chapter-overview bridge.

### Spell Attack

- Official term: `Spell Attack`
- Aralia status: `Exists / Good`
- Local file:
  - [spell_attack.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spell_attack.json)
- Notes:
  - Aralia now has a dedicated spell-attack bridge entry instead of only covering the concept inside broader spell-effects text.

### Spellcasting Focus

- Official term: `Spellcasting Focus`
- Aralia status: `Exists / Good`
- Local file:
  - [spellcasting_focus.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spellcasting_focus.json)
- Notes:
  - Aralia now has a dedicated focus bridge entry rather than only mentioning the concept inside spell-components text.

### Sphere [Area of Effect]

- Official term: `Sphere [Area of Effect]`
- Aralia status: `Exists / Good`
- Local file:
  - [sphere_area.json](F:\Repos\Aralia\public\data\glossary\entries\rules\spells\referenced\sphere_area.json)
- Notes:
  - The local entry now uses `Rules Glossary` framing and real rule text.
  - The file still lives under the spell-referenced path, so the implementation is stronger than before even if storage-path cleanup is not fully complete.

### Stable

- Official term: `Stable`
- Aralia status: `Exists / Good`
- Local file:
  - [stable.json](F:\Repos\Aralia\public\data\glossary\entries\rules\stable.json)
- Notes:
  - Present as a top-level death-state and recovery rule.

### Stat Block

- Official term: `Stat Block`
- Aralia status: `Exists / Good`
- Local file:
  - [stat_block.json](F:\Repos\Aralia\public\data\glossary\entries\rules\stat_block.json)
- Notes:
  - Present as a standalone rule surface for entity mechanics.

### Study [Action]

- Official term: `Study [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [study_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\study_action.json)
- Notes:
  - Present as a standalone interpretation and analysis action rule.

### Stunned [Condition]

- Official term: `Stunned [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [stunned_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\stunned_condition.json)

### Suffocation [Hazard]

- Official term: `Suffocation [Hazard]`
- Aralia status: `Exists / Good`
- Local file:
  - [suffocation.json](F:\Repos\Aralia\public\data\glossary\entries\rules\suffocation.json)
- Notes:
  - Aralia now has a standalone suffocation hazard entry in the main rules glossary surface.

### Surprise

- Official term: `Surprise`
- Aralia status: `Exists / Good`
- Local file:
  - [surprise.json](F:\Repos\Aralia\public\data\glossary\entries\rules\surprise.json)
- Notes:
  - Present as a standalone combat-start readiness rule.

### Swimming

- Official term: `Swimming`
- Aralia status: `Exists / Good`
- Local file:
  - [swimming.json](F:\Repos\Aralia\public\data\glossary\entries\rules\movement\swimming.json)
- Notes:
  - Present and close to the official rule.
  - The wording still carries a small amount of house-style/world-language drift, but the rule content is already in a workable place.

### Swim Speed

- Official term: `Swim Speed`
- Aralia status: `Exists / Good`
- Local file:
  - [swim_speed.json](F:\Repos\Aralia\public\data\glossary\entries\rules\swim_speed.json)
- Notes:
  - Aralia now has a dedicated `Swim Speed` bridge entry rather than only covering the concept inside `Swimming`.

## Eighth Official Slice

These entries continue directly from the same official D&D Beyond glossary page:

- `Target`
- `Telepathy`
- `Teleportation`
- `Temporary Hit Points`
- `Tremorsense`
- `Truesight`
- `Unarmed Strike`
- `Unconscious [Condition]`
- `Unoccupied Space`
- `Utilize [Action]`
- `Vulnerability`
- `Weapon`
- `Weapon Attack`

## Current Eighth-Pass Judgments

### Target

- Official term: `Target`
- Aralia status: `Exists / Good`
- Local file:
  - [target.json](F:\Repos\Aralia\public\data\glossary\entries\rules\target.json)
- Notes:
  - Present as a standalone top-level targeting rule rather than only inside spell effects.

### Telepathy

- Official term: `Telepathy`
- Aralia status: `Exists / Good`
- Local file:
  - [telepathy.json](F:\Repos\Aralia\public\data\glossary\entries\rules\telepathy.json)
- Notes:
  - Present as a standalone communication rule.

### Teleportation

- Official term: `Teleportation`
- Aralia status: `Exists / Good`
- Local file:
  - [teleportation.json](F:\Repos\Aralia\public\data\glossary\entries\rules\teleportation.json)
- Notes:
  - Present as a standalone movement and positioning rule.

### Temporary Hit Points

- Official term: `Temporary Hit Points`
- Aralia status: `Exists / Good`
- Local file:
  - [temporary_hp.json](F:\Repos\Aralia\public\data\glossary\entries\rules\temporary_hp.json)
- Notes:
  - The core rule is now stated cleanly as a separate durability buffer.
  - The entry still includes a little explanatory support material beyond the tight glossary core.

### Tremorsense

- Official term: `Tremorsense`
- Aralia status: `Exists / Good`
- Local file:
  - [tremorsense.json](F:\Repos\Aralia\public\data\glossary\entries\rules\tremorsense.json)
- Notes:
  - The rule text is now focused on the shared-surface vibration sense itself.
  - The remaining looseness is mostly in supporting cross-links rather than in the core rule text.

### Truesight

- Official term: `Truesight`
- Aralia status: `Exists / Good`
- Local file:
  - [truesight.json](F:\Repos\Aralia\public\data\glossary\entries\rules\truesight.json)
- Notes:
  - Present as a concise special-sense rule with the core visual-exception cases and range scope in place.

### Unarmed Strike

- Official term: `Unarmed Strike`
- Aralia status: `Exists / Good`
- Local file:
  - [unarmed_strike.json](F:\Repos\Aralia\public\data\glossary\entries\rules\unarmed_strike.json)
- Notes:
  - The entry now reads as a baseline body-attack rule instead of a class-feature tutorial.
  - It still preserves some implementation-specific attack-detail wording, so it is better classified as mostly good than fully settled.

### Unconscious [Condition]

- Official term: `Unconscious [Condition]`
- Aralia status: `Exists / Good`
- Local file:
  - [unconscious_condition.json](F:\Repos\Aralia\public\data\glossary\entries\rules\conditions\unconscious_condition.json)

### Unoccupied Space

- Official term: `Unoccupied Space`
- Aralia status: `Exists / Good`
- Local file:
  - [unoccupied_space.json](F:\Repos\Aralia\public\data\glossary\entries\rules\unoccupied_space.json)
- Notes:
  - Present as a standalone space-state rule.

### Utilize [Action]

- Official term: `Utilize [Action]`
- Aralia status: `Exists / Good`
- Local file:
  - [utilize_action.json](F:\Repos\Aralia\public\data\glossary\entries\rules\utilize_action.json)
- Notes:
  - Present as a standalone object-and-system interaction action rule.

### Vulnerability

- Official term: `Vulnerability`
- Aralia status: `Exists / Good`
- Local file:
  - [vulnerability.json](F:\Repos\Aralia\public\data\glossary\entries\rules\vulnerability.json)
- Notes:
  - Present as a standalone parent damage-resolution rule.

### Weapon

- Official term: `Weapon`
- Aralia status: `Exists / Good`
- Local file:
  - [weapon.json](F:\Repos\Aralia\public\data\glossary\entries\rules\weapon.json)
- Notes:
  - Present as a standalone top-level rule rather than only through the equipment-table surface.

### Weapon Attack

- Official term: `Weapon Attack`
- Aralia status: `Exists / Good`
- Local file:
  - [weapon_attack.json](F:\Repos\Aralia\public\data\glossary\entries\rules\weapon_attack.json)
- Notes:
  - Present as a standalone combat-resolution rule.
