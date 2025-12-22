# Battle Map

## Purpose

The Battle Map provides a tactical grid for combat encounters, displaying character tokens, terrain, and enabling tactical movement and targeting. It visualizes the combat state managed by the Combat domain.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/BattleMap/BattleMap.tsx` | Main battle map component |
| `src/components/BattleMap/BattleMapDemo.tsx` | Standalone demo/testing |
| `src/hooks/useBattleMap.ts` | Battle map state hook |
| `src/hooks/useBattleMapGeneration.ts` | Map generation hook |

## Subcomponents

- **Map Rendering**: `BattleMap.tsx`, `BattleMapTile.tsx` - Grid and tiles
- **Overlays**: `BattleMapOverlay.tsx` - Targeting, range, effects
- **Tokens**: `CharacterToken.tsx` - Character/creature tokens
- **UI Elements**: `InitiativeTracker.tsx`, `CombatLog.tsx`, `ActionEconomyBar.tsx`
- **Party Display**: `PartyDisplay.tsx` - Party status during combat
- **Damage Numbers**: `DamageNumberOverlay.tsx` - Floating damage
- **Abilities**: `AbilityButton.tsx`, `AbilityPalette.tsx` - Ability selection
- **AI Spells**: `AISpellInputModal.tsx` - AI-assisted spell input

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/BattleMap/*.ts*` | Directory | Battle map components and index |
| `src/components/EncounterGenerator/*.tsx` | Component | Encounter and party management |
| `src/hooks/useBattleMap.ts` | Hook | Map state hook |
| `src/hooks/useBattleMapGeneration.ts` | Hook | Map generation hook |
| `src/services/battleMapGenerator.ts` | Service | Procedural map generation |


## Dependencies

### Depends On

- **[Combat](./combat.md)**: Combat state and mechanics
- **[Spells](./spells.md)**: Spell targeting visualization
- **[Character Sheet](./character-sheet.md)**: Character token data

### Used By

- **App.tsx**: Combat mode rendering

## Boundaries / Constraints

- Battle Map is visualization layer - combat logic is in Combat domain
- Token positions should sync with combat state
- Terrain should be generated before combat starts
- Movement highlighting should respect movement rules

## Open Questions / TODOs

- [ ] Document terrain generation system
- [ ] Clarify token positioning and grid system
- [ ] Map targeting overlay mechanics

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/components/BattleMap/__tests__/AbilityButton.test.tsx` | Ability button component tests |
| `src/components/BattleMap/__tests__/BattleMapTile.test.tsx` | Battle map tile component tests |
| `src/hooks/__tests__/useBattleMapGeneration.test.ts` | Battle map generation hook tests |
| `src/components/__tests__/EncounterModal.test.tsx` | Encounter modal component tests |
