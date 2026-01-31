# Components Documentation (Ralph)

## Overview
This folder contains the React UI layer. It follows a modular structure where major features (BattleMap, ActionPane, CharacterSheet) have their own subdirectories. The components are mostly functional, using Hooks for state management and Framer Motion for animations.

## Key Subdirectories & Files
- **ActionPane/**:
    - **ActionButton.tsx**: The primary interaction primitive. Includes color-coding logic based on action "Impact" and coordinate normalization for AI payloads.
    - **SystemMenu.tsx**: A grouping component for global utilities (Save, Load, Journal). Includes "Dev-Only" guards.
- **WorldPane.tsx**: The Narrative Heart. Displays the scrolling text log. Features "Knowledge Injection" (Tooltip regex) to explain lore/mechanics without cluttering the view.
- **MapPane.tsx**: The Overworld Explorer. A grid-based viewport supporting Keyboard Navigation, Panning, and Zooming. Pre-computes POI markers for performance.
- **Submap/**: (Directory) Logic for the detailed ASCII/Emoji tactical maps.
- **BattleMap/**: (Directory) The turn-based combat engine UI.

## Issues & Opportunities
- **Tooltip Fragility**: `WorldPane.tsx` hardcodes the `tooltipKeywords` dictionary. This should be moved to a centralized lore database or the `GlossaryContext` to avoid duplication.
- **Roving Focus Complexity**: `MapPane.tsx` and `SystemMenu.tsx` both implement custom keyboard navigation logic. This could be abstracted into a shared `useKeyboardGridNav` hook.
- **Prop Drilling**: Deeply nested components (like `MapTile` inside `MapPane`) receive many props. Moving to a Tile-specific context might improve performance and readability.
