# Character Sheet

## Purpose

The Character Sheet Modal displays comprehensive character information including stats, abilities, equipment, spells, and party management. It serves as the primary interface for viewing and managing the player's character during gameplay.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/CharacterSheetModal.tsx` | Main modal component (20KB) |
| `src/utils/characterUtils.ts` | Character utility functions (28KB) |
| `src/hooks/useAbilitySystem.ts` | Ability management hook (28KB) |
| `src/types/character.ts` | Character type definitions |

## Subcomponents

- **Equipment Display**: `EquipmentMannequin.tsx` - Visual equipment slots
- **Inventory**: Integration with `InventoryList.tsx`
- **Party Management**: `CharacterSheet/` directory - Party views
- **Spellbook**: `SpellbookOverlay.tsx` - Spell management
- **Ability System**: `useAbilitySystem.ts` - Ability usage and cooldowns

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/CharacterSheetModal.tsx` | Component | Main modal |
| `src/components/CharacterSheet/*.tsx` | Directory | Sheet sub-components |
| `src/components/Party*.tsx` | Component | Party management UI |
| `src/components/SpellbookOverlay.tsx` | Component | Spell management |
| `src/utils/characterUtils.ts` | Utils | Character calculations |
| `src/utils/characterValidation.ts` | Utils | Character validation |
| `src/utils/statUtils.ts` | Utils | Stat calculations |
| `src/hooks/useAbilitySystem.ts` | Hook | Ability management |
| `src/types/character.ts` | Types | Character types |
| `src/state/reducers/characterReducer.ts` | Reducer | Character state |

## Dependencies

### Depends On

- **[Spells](./spells.md)**: Spell display and casting
- **[Items / Trade / Inventory](./items-trade-inventory.md)**: Equipment management
- **[Combat](./combat.md)**: Ability usage during combat

### Used By

- **[Character Creator](./character-creator.md)**: Validates created characters
- **[Combat](./combat.md)**: Character stats for combat calculations
- **App.tsx**: Modal rendering

## Boundaries / Constraints

- Character Sheet displays state - modifications go through proper actions
- Equipment changes should trigger stat recalculation
- Validation should match creator validation rules
- Modal should be dismissible at any time

## Open Questions / TODOs

- [ ] Document party switching UI implementation
- [ ] Clarify stat calculation pipeline
- [ ] Map equipment slot system
