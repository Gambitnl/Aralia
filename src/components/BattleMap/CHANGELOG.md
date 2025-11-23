# Battle Map - Changelog

This file documents all notable changes to the Battle Map feature.

## v.0.0.5 (2025-06-29)
### Added & Changed (Combat System Refactor)
*   **Refactored Combat System**: Overhauled the combat system from a generic Action Point (AP) model to a D&D 5e-style action economy, including distinct **Action**, **Bonus Action**, **Reaction**, and **Movement** resources. This provides a more authentic and tactical tabletop experience.
*   **Updated Combat Types**: Modified `src/types.ts` to replace AP-related fields with `hasUsedAction`, `hasUsedBonusAction`, `hasUsedReaction`, and `movementRemaining`. Added foundational support for `SpellSlot` tracking to prepare for future spellcasting implementation.
*   **Updated Combat Hooks**:
    *   `useTurnManager`: The core logic was updated to manage the new action economy, including resetting resources at the start of a turn and validating action costs based on type (Action, Bonus, etc.) and movement points.
    *   `useBattleMap`: Movement calculations and path visualizations now correctly use the character's `movementRemaining` stat.
*   **Updated Battle Map UI**:
    *   `AbilityPalette`: Now displays ability costs as "Action" or "Bonus" instead of numeric AP values. Buttons are disabled based on the new action economy.
    *   `CharacterToken` & `InitiativeTracker`: Removed AP display from tooltips to align with the new system.
*   **New Documentation**: Added a comprehensive guide for the Battle Map feature at `src/components/BattleMap/BattleMap.README.md`.
