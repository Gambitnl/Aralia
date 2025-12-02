# Types: Architecture & Design History

This document chronicles the architectural decisions and evolution of the core data types used in the Aralia RPG application.

## `PlayerCharacter` Interface Evolution

### Initial State: Cluttered and Unscalable

The `PlayerCharacter` interface was initially designed with numerous optional, race-specific properties. For every racial choice that required storing data (e.g., a Dragonborn's ancestry, an Elf's lineage, or a Gnome's subrace), a new property was added directly to the main `PlayerCharacter` type.

Examples of deprecated properties:
- `selectedDraconicAncestry?: DraconicAncestryInfo;`
- `selectedElvenLineageId?: ElvenLineageType;`
- `aarakocraSpellcastingAbility?: AbilityScoreName;`

This approach had significant drawbacks:
- **Scalability**: Adding new races with unique choices required modifying the core `PlayerCharacter` interface, leading to a bloated and unwieldy type definition.
- **Clarity**: The interface became cluttered with properties that were only relevant to a small subset of characters, making it difficult to understand the core, universal character data.

### Refactor: A Generic and Scalable Solution

To address these issues, the `PlayerCharacter` interface was refactored to use a more generic and scalable structure. The individual race-specific properties were removed and replaced with a single object.

**New Structure:**
```typescript
export interface RacialSelectionData {
  choiceId?: string;
  spellAbility?: AbilityScoreName;
  skillIds?: string[];
}

export interface PlayerCharacter {
  // ... core properties ...
  racialSelections: Record<string, RacialSelectionData>;
}
```

**Reasoning:**
- **Centralization**: All racial choices are now stored in the `racialSelections` object, keyed by a descriptive string (e.g., `'elven_lineage'`).
- **Flexibility**: The `RacialSelectionData` interface can accommodate various types of choices (ID selections, spell abilities, skill proficiencies) without needing to change the top-level `PlayerCharacter` type.
- **Maintainability**: Adding new races with complex choices is now a much cleaner process. It no longer requires modifying the core character definition, only the logic related to that specific race during character creation and assembly. This design isolates race-specific complexity, making the overall system easier to manage and extend.
