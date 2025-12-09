# Proposed Spell Reference Schema V2

## Rationale
Current reference files use "clumped" fields (e.g., `Components: V, S, M...`) which are:
1.  Harder for humans to scan quickly.
2.  Harder to parse programmatically for JSON migration.
3.  Prone to inconsistent formatting within the "clump".

**Goal:** Breaks down every piece of data into its own line with a clear `Key: Value` format that maps 1:1 to the target JSON structure.

## Proposed Schema

```markdown
### [Spell Name]
- **Level**: [0-9]
- **School**: [School]
- **Ritual**: [true/false]
- **Classes**: [Class1, Class2...]

#### Casting
- **Casting Time Value**: [Number]
- **Casting Time Unit**: [action/bonus_action/reaction/minute/hour]
- **Combat Cost**: [action/bonus_action/reaction/none]
- **Reaction Trigger**: [Text or None]

#### Range & Area
- **Range Type**: [self/touch/ranged/sight/unlimited]
- **Range Distance**: [Number or None]
- **Targeting Type**: [single/multi/area/self]
- **Area Shape**: [cone/cube/cylinder/line/sphere/none]
- **Area Size**: [Number or None]
- **Valid Targets**: [creatures/objects/self/point...]
- **Line of Sight**: [true/false]

#### Components
- **Verbal**: [true/false]
- **Somatic**: [true/false]
- **Material**: [true/false]
- **Material Description**: [Text or None]
- **Material Cost GP**: [Number]
- **Consumed**: [true/false]

#### Duration
- **Duration Type**: [instantaneous/timed/permanent]
- **Duration Value**: [Number or None]
- **Duration Unit**: [round/minute/hour/day...]
- **Concentration**: [true/false]

#### Effects (Primary)
- **Effect Type**: [DAMAGE/HEALING/STATUS/UTILITY...]
- **Save Stat**: [Strength/Dexterity/.../None]
- **Save Outcome**: [negates/half/none]
- **Attack Roll**: [melee/ranged/none]
- **Damage Dice**: [e.g., 1d6]
- **Damage Type**: [Acid/Fire/...]
- **Conditions Applied**: [Condition1, Condition2...]

#### Description
- **Text**: [Full spell description]
- **Higher Levels**: [Text or None]
- **Source**: [PHB 2024 p.XXX / URL]
- **Status**: [Draft/Complete]
```

## Comparison: Acid Splash

### Old "Clumped" Format
- **Level/School**: 0; Conjuration; Ritual: false
- **Casting Time**: 1 action (combat cost: action)
- **Range**: 60 feet (ranged)
- **Components**: V, S; Cost: 0 gp; Consumed: false
- **Duration**: Instantaneous
- **Targeting/Area**: Multi-target (2); 60 ft range
- **Save/Attack**: Dex save (negates)
- **Damage/Healing**: 1d6 Acid; Scaling: character levels

### New "Granular" Format
#### Acid Splash
- **Level**: 0
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Artificer, Sorcerer, Wizard

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: multi
- **Targeting Max**: 2
- **Valid Targets**: creatures
- **Line of Sight**: true

- **Verbal**: true
- **Somatic**: true
- **Material**: false

- **Duration Type**: instantaneous
- **Concentration**: false

- **Effect Type**: DAMAGE
- **Save Stat**: Dexterity
- **Save Outcome**: none
- **Damage Dice**: 1d6
- **Damage Type**: Acid
- **Scaling**: character_level (2d6 at 5, 3d6 at 11, 4d6 at 17)

- **Description**: You hurl a bubble of acid. Choose one creature you can see within range, or choose two creatures you can see within range that are within 5 feet of each other. A target must succeed on a Dexterity saving throw or take 1d6 acid damage.
- **Source**: PHB 2014
- **Status**: Complete
```
