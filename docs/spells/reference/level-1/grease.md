# Grease
- **Level**: 1
- **School**: Conjuration
- **Ritual**: false
- **Classes**: Artificer, Sorcerer, Wizard

- **Casting Time Value**: 1
- **Casting Time Unit**: action
- **Combat Cost**: action

- **Range Type**: ranged
- **Range Distance**: 60
- **Targeting Type**: area
- **Area Shape**: Square
- **Area Size**: 10
- **Valid Targets**: point
- **Line of Sight**: true

- **Verbal**: true
- **Somatic**: true
- **Material**: true
- **Material Description**: a bit of pork rind or butter
- **Material Cost GP**: 0
- **Consumed**: false

- **Duration Type**: timed
- **Duration Value**: 1
- **Duration Unit**: minute
- **Concentration**: false

- **Effect Types**: TERRAIN, STATUS_CONDITION
- **Terrain Type**: difficult
- **Save Stat**: Dexterity
- **Save Outcome**: negates_condition
- **Conditions Applied**: Prone
- **Triggered Applications**: immediate, on_enter_area first_per_turn, on_end_turn_in_area

- **Description**: Slick grease covers the ground in a 10-foot square freely centered on a point within range and turns it into Difficult Terrain for the duration. When the grease appears, each creature standing in its area must succeed on a Dexterity saving throw or fall Prone. A creature that enters the area or ends its turn there must also succeed on a Dexterity saving throw or fall Prone.
- **Higher Levels**: None
