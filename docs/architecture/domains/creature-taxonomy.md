# Creature Taxonomy System

## Overview
The Creature Taxonomy system (`src/systems/creatures/CreatureTaxonomy.ts`) standardizes how creature types are handled in targeting, logic, and data validation. It bridges the gap between raw string data (common in JSONs and legacy systems) and the `CreatureType` enum.

## Core Components

### 1. CreatureTaxonomy Service
Located at `src/systems/creatures/CreatureTaxonomy.ts`, this static service provides methods for:
- **Validation**: checking if a target matches a filter (`isValidTarget`).
- **Normalization**: converting strings to Enums (`normalize`).
- **Traits**: retrieving standard immunity/resistance data (`getTraits`).

### 2. Targeting Logic
The system supports two modes of filtering, which can be combined:
- **Whitelist (`creatureTypes`)**: Target MUST be one of these types. (e.g., *Hold Person* -> Humanoid).
- **Blacklist (`excludeCreatureTypes`)**: Target MUST NOT be one of these types. (e.g., *Cure Wounds* -> No Undead/Construct).

## Integration Points
- **Spells**: `TargetValidationUtils` should delegate to `CreatureTaxonomy`.
- **Combat**: Effect application logic should use `CreatureTaxonomy` to check immunity (e.g., "Immune to Charmed if Undead").
- **AI**: The `CreatureTaxonomy` can provide context on what a "Humanoid" is to the AI.

## Future Work
- [ ] Migrate `CombatCharacter.creatureTypes` from `string[]` to `CreatureType[]`.
- [ ] Update `TargetValidationUtils` to use `CreatureTaxonomy` instead of custom logic.
