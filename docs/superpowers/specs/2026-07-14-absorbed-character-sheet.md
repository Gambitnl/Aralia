# Absorbed: Character Sheet

Absorbed 2026-07-14 from `docs/projects/character-sheet/` — living project tracking now lives in planmap `character-sheet` topic with 5 active gaps and 1 completed feature.

## Quick Start

Character Sheet is a modal UI with 7 tabbed surfaces (Overview, Skills, Details, Family, Spellbook, Crafting, Journal) showing player character data, inventory, and progression. The component tree lives under `src/components/CharacterSheet/`.

## File Anchors

- Modal & routing: `src/components/CharacterSheet/CharacterSheetModal.tsx`
- Overview tab (stats, inventory, equipped items): `src/components/CharacterSheet/Overview/`
- Skills, Details, Family, Spellbook, Crafting, Journal tabs: respective subdirectories
- State wiring: `src/state/reducers/characterReducer.ts`, `src/state/reducers/uiReducer.ts`
- Initial state: `src/state/initialState.ts`

## Key Integrations

- Opens via `handleOpenCharacterSheet` in `src/App.tsx`
- Modal state in `gameState.characterSheetModal`
- Inventory/equipment dispatch to shared `onAction` handler
- Lazy-loads from `src/components/layout/GameModals.tsx`

## Known Schema

See `docs/projects/character-sheet/GAPS.md` appendix "Field-by-Field Schema Map" for complete `PlayerCharacter`, `Item`, `Spell`, `JournalState`, and `Quest` payload schemas. Key mismatch: `savingThrowProficiencies` read from `class.*` instead of character root.

## Recent Work

G7 (food freshness, 2026-06-19): Added `acquiredAt` acquisition timestamp to item model; `InventoryList.tsx` now computes expiration from `shelfLife + acquiredAt` instead of hardcoded placeholder.

## Open Work

See planmap topic `character-sheet` for 5 active gaps: G5 (race/derivation contract), G10 (container persistence), G12–G14 (level-up UI and state).
