# Creature Taxonomy System

## Overview
The Creature Taxonomy system (`src/systems/creatures/CreatureTaxonomy.ts`) provides a unified framework for categorizing and validating entities based on their creature type (e.g., Humanoid, Undead, Beast).

## Purpose
D&D 5e relies heavily on creature types for spell targeting, condition immunities, and feature interactions (e.g., Ranger Favored Enemy, Paladin Divine Smite). Previously, this logic was scattered and relied on raw string comparisons, leading to fragility.

## Core Components

### 1. CreatureTaxonomy Service
Located at `src/systems/creatures/CreatureTaxonomy.ts`.
- **Validation**: `isValidTarget(targetTypes, filter)` checks both whitelist (`creatureTypes`) and blacklist (`excludeCreatureTypes`) criteria.
- **Normalization**: `normalize(type)` converts input strings to the strict `CreatureType` enum.
- **Traits**: `getTraits(type)` returns associated metadata like standard immunities.

### 2. Integration Points
- **Spell Targeting**: Used to validate if a spell can affect a specific target (e.g., *Hold Person* vs Humanoids).
- **Condition Immunities**: Can be used to check if a creature is immune to effects based on type (e.g., Constructs vs *Charm*).

## Usage Example

```typescript
import { CreatureTaxonomy } from '@/systems/creatures/CreatureTaxonomy';

// Check if a target is valid for Hold Person (Humanoids only)
const isHumanoid = CreatureTaxonomy.isValidTarget(
  target.creatureTypes, // e.g. ['Humanoid']
  { creatureTypes: ['Humanoid'] }
);

// Check if a target is valid for Cure Wounds (No Undead/Constructs)
const canHeal = CreatureTaxonomy.isValidTarget(
  target.creatureTypes,
  { excludeCreatureTypes: ['Undead', 'Construct'] }
);
```

## Future Expansion
- Integration with `TargetResolver` to replace legacy logic.
- Support for subtypes (tags) like "Shapechanger" or "Titan".
