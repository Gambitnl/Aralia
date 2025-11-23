# Feature Changelog: Spellbook & Spellcasting System

This file documents all notable changes specifically related to the Spellbook UI and the underlying spellcasting data model refactor in the Aralia RPG project.

## [Unreleased] - (09:06:03 PM - Tuesday, July 15, 2025)
### Changed
*   **Spell Preparation UI**: Refined the spell selection UI for Druids during character creation to clarify that 'Speak with Animals' is an automatically prepared spell from the Druidic feature. This spell no longer counts against their selectable spells.
*   **Spellbook UI**: The Spellbook overlay now correctly identifies always-prepared spells (like the Druid's 'Speak with Animals') and disables the "Unprepare" button for them, providing a clearer user experience.

## [Unreleased] - Spell Slot and Resource Tracking
### Added
*   **Resource Display**: The `SpellbookOverlay` now features a dedicated left-hand page for resource management.
*   **Spell Slot Tracking**: Visually displays available spell slots per level, with used slots appearing as empty circles.
*   **Limited Ability Tracking**: Displays other limited-use abilities (like Second Wind, Rage) and their remaining uses.
*   **Rest Buttons**: Added "Short Rest" and "Long Rest" buttons to the resource page for convenient resource replenishment.

### Changed
*   The right-hand page of the spellbook is now solely dedicated to the spell list, which remains paginated.

## [Initial Implementation] - Foundational Spell System
### Added
*   **`PlayerCharacter` Data Model**: Updated `src/types.ts` to include structured data for `spellSlots`, `spellbook` (with `knownSpells`, `preparedSpells`, `cantrips`), and `limitedUses`.
*   **`SpellbookOverlay.tsx`**: Created the initial version of the full-screen spellbook overlay.
*   **`CharacterSheetModal.tsx` Update**: Removed the old spell list from the character sheet and added a "Spellbook" button to launch the new overlay.
*   **Character Creation Integration**: Updated character creation logic to support the new data structures for spellcasting and limited-use abilities.
*   **New Classes**: Added Bard, Druid, and Warlock classes with full spellcasting integration.