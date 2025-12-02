## Architecture & Design History

### Consolidation of Repetitive Components

This section documents the architectural decision to refactor numerous, nearly identical racial spellcasting ability selection components into a single, reusable, and configurable component.

#### Purpose

The primary goal of this refactoring was to reduce significant code duplication across the character creator's race-specific components. By consolidating the logic into a single component, we enhance maintainability and simplify the process of adding new races that require a similar choice from the player. This adheres to the DRY (Don't Repeat Yourself) principle and promotes a more consistent user experience.

#### Implementation

The refactoring involved three main phases:

1.  **Creation of a Reusable Component**:
    A new generic component, `RacialSpellAbilitySelection.tsx`, was created. This component is designed to be configurable, accepting props for the race name, trait name, and trait description, allowing it to be used for any race that requires a spellcasting ability choice (Intelligence, Wisdom, or Charisma).

2.  **Refactoring of State Management**:
    The character creator's state management (`characterCreatorState.ts`) was updated to support the new generic component. This included:
    *   Consolidating multiple `CreationStep` enum members into a single `RacialSpellAbilityChoice` enum.
    *   Adding a `racialSpellChoiceContext` to the character creation state to provide the necessary context to the generic component.
    *   Updating the main reducer to populate this context when a relevant race is selected.

3.  **Cleanup of Obsolete Files**:
    The old, individual components were deprecated and removed from the codebase. This included components such as `AarakocraSpellcastingAbilitySelection.tsx`, `AirGenasiSpellcastingAbilitySelection.tsx`, and others.
