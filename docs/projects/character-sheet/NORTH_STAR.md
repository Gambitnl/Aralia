# Character Sheet North Star

Status: active  
Last updated: 2026-05-31

## Why This Project Exists

Character Sheet is an implemented UI feature with modal and tabbed character data views. This project keeps the implementation intent and gaps explicit so future workers can start quickly without re-learning structure.

## Current Scope

- Confirm and document existing Character Sheet surfaces under `src/components/CharacterSheet`.
- Track state integration points that keep sheet visibility, character payload, inventory, and actions in sync.
- Capture durable gaps from implementation state and keep adjacency scope explicit.

## Concrete File Map (Owner Surface)

- `src/components/CharacterSheet/CharacterSheetModal.tsx`
  - Main modal shell, tab routing, close behavior, and child tab mounting.
- `src/components/CharacterSheet/Overview/CharacterOverview.tsx`
  - Core stat and trait display.
- `src/components/CharacterSheet/Overview/InventoryList.tsx`
  - Inventory list and item action dispatch.
- `src/components/CharacterSheet/Overview/EquipmentMannequin.tsx`
  - Equipped item rendering and unequip action path.
- `src/components/CharacterSheet/Overview/DynamicMannequinSlotIcon.tsx`
  - Slot visuals for mannequin layout.
- `src/components/CharacterSheet/Skills/SkillsTab.tsx`
  - Skills tab content.
- `src/components/CharacterSheet/Skills/SkillDetailDisplay.tsx`
  - Skills detail pane and per-skill metadata.
- `src/components/CharacterSheet/Details/CharacterDetailsTab.tsx`
  - Extended character display details.
- `src/components/CharacterSheet/Spellbook/SpellbookTab.tsx`
  - Spellbook tab.
- `src/components/CharacterSheet/Spellbook/SpellSlotDisplay.tsx`
  - Spell slot counters.
- `src/components/CharacterSheet/Spellbook/SpellDetailPane.tsx`
  - Spell description/detail area.
- `src/components/CharacterSheet/Spellbook/SpellbookOverlay.tsx`
  - Overlay behavior for spell focus state.
- `src/components/CharacterSheet/Crafting/CraftingTab.tsx`
  - Crafting tab.
- `src/components/CharacterSheet/Journal/JournalTab.tsx`
  - Journal tab surface and spread integration.
- `src/components/CharacterSheet/Journal/JournalSpread.tsx`
  - Journal page layout.
- `src/components/CharacterSheet/Journal/QuestLogSidebar.tsx`
  - Quest support sidebar for journal tab.
- `src/components/CharacterSheet/Family/FamilyTreeTab.tsx`
  - Family tab.
- `src/components/CharacterSheet/LevelUpModal.tsx`
  - Level-up action container and UPDATE_CHARACTER_CHOICE flow entry.
- `src/components/CharacterSheet/README.md` and related tab READMEs
  - Existing component intent notes.
- `src/components/CharacterSheet/__tests__/` and `src/components/CharacterSheet/Spellbook/__tests__/`
  - Modal, overview, mannequin, and spellbook behavior tests.

## State and Wiring

- `src/App.tsx`
  - `handleOpenCharacterSheet` dispatches `OPEN_CHARACTER_SHEET`.
  - `handleCloseCharacterSheet` dispatches `CLOSE_CHARACTER_SHEET`.
- `src/components/layout/GameModals.tsx`
  - Lazy-loads and renders `CharacterSheetModal` from `gameState.characterSheetModal`.
  - Passes `character`, `companion`, `inventory`, `gold`, `onAction`, and `onClose`.
- `src/state/actionTypes.ts`
  - Action unions include `OPEN_CHARACTER_SHEET` and `CLOSE_CHARACTER_SHEET`.
- `src/state/reducers/uiReducer.ts`
  - Reducer handles open/close and resets sheet state when opening other overlays.
- `src/state/reducers/characterReducer.ts`
  - Keeps `characterSheetModal.character` in sync during equip, unequip, drop, auto-equip, prepared spell toggle, and level-up choice updates.
- `src/state/initialState.ts`, `src/state/appState.ts`
  - Initializes and preserves `characterSheetModal` during phase and load transitions.
- `src/types/state.ts`, `src/types/state.d.ts`
  - Defines `gameState.characterSheetModal`.

## Implemented Behavior (Observed)

- Modal renders from state, not from local visibility flags.
- Tab set is implemented for:
  - overview
  - skills
  - details
  - family (optional by data)
  - spellbook
  - crafting
  - journal
  - level-up launch path
- Inventory and equipment both dispatch to shared `onAction`.
- Spell tabs include a read path through `SpellbookOverlay` and detail panes.

## Known Gaps To Preserve

- Schema alignment remains an explicit open item from the tracker: sheet fields do not have one authoritative mapping pass documented in one place.
- Journal input shape and integration points are present but still need schema stability verification.
- Action payload typing and casing consistency for item use/management actions needs a clean-up to avoid future drift.

## Next Checks for Cold Start

1. Verify `character` and `journal` shapes against `src/types` across Overview, Details, Spells, Journal, and Family tabs.
2. Reconcile any action type/payload mismatch before expanding item behavior.
3. Carry unresolved schema alignment into project work tracking and keep this folder as the owning handoff point.

## Anchor Files

- [docs/projects/PROJECT_TRACKER.md](F:\Repos\Aralia\docs/projects/PROJECT_TRACKER.md)
- [docs/projects/GLOBAL_GAPS.md](F:\Repos\Aralia\docs/projects/GLOBAL_GAPS.md)
- [docs/projects/character-sheet/TRACKER.md](F:\Repos\Aralia\docs/projects/character-sheet/TRACKER.md)
- [docs/projects/character-sheet/GAPS.md](F:\Repos\Aralia\docs/projects/character-sheet/GAPS.md)
