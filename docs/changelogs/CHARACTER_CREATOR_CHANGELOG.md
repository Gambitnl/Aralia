# Character Creator - Changelog

This file documents all notable changes specifically related to the Character Creator feature.

## v1.0.0 (12:26:26 PM - Thursday, July 17, 2025)
### Added & Changed (Major Character Creator Overhaul)
This release marks a comprehensive architectural and feature-based overhaul of the entire character creation system.

*   **Architectural Refactor**:
    *   The core logic of `CharacterCreator.tsx` was refactored to use a `useReducer` hook, with all state logic centralized in `src/components/CharacterCreator/state/characterCreatorState.ts`.
    *   A new custom hook, `useCharacterAssembly` (in `src/components/CharacterCreator/hooks/useCharacterAssembly.ts`), was created to encapsulate all complex logic for character validation, calculation of derived stats (HP, AC, speed, etc.), and final `PlayerCharacter` object assembly. This makes the main component a leaner orchestrator.

*   **Streamlined Ability Score System**:
    *   The "Flexible ASI" step was **removed** to simplify the creation flow.
    *   All ability score determination is now handled by the `AbilityScoreAllocation.tsx` component, which uses a comprehensive Point Buy system. The flexible ASI choices previously handled in a separate step are now implicitly part of the player's Point Buy decisions.

*   **New Races & Sub-Options**:
    *   Added data and integrated selection logic for a wide range of new races, including: Aarakocra, Air Genasi, Bugbear, Centaur, Changeling, Deep Gnome, Duergar, Goliath, Halfling, and Orc.
    *   Updated existing races (Human, Elf, Dwarf, Dragonborn, Tiefling, Aasimar) to align with modern design principles, primarily using the Point Buy system for ability scores.

*   **New Class & Feature Selection Screens**:
    *   Added UI components for class-specific choices, such as `ArtificerFeatureSelection.tsx`, `BardFeatureSelection.tsx`, `DruidFeatureSelection.tsx`, `PaladinFeatureSelection.tsx`, `RangerFeatureSelection.tsx`, and `WarlockFeatureSelection.tsx`.
    *   Introduced `WeaponMasterySelection.tsx` as a new step for martial classes, allowing players to choose weapon masteries based on their class proficiencies.

*   **UI/UX Enhancements**:
    *   Redesigned the `RaceDetailModal` with a responsive two-column layout to better separate artwork/traits from narrative descriptions, mirroring modern RPG sourcebook design.
    *   Enhanced the `SkillSelection.tsx` component to correctly account for skills automatically granted by various racial traits (Human, Elf, Bugbear, Centaur, Changeling) and provide tooltips indicating the source of the proficiency.

*   **Documentation**:
    *   Created comprehensive README files for the `CharacterCreator` component itself, its state management module, the `useCharacterAssembly` hook, and for each new race-specific selection component to ensure the new architecture is well-documented.
