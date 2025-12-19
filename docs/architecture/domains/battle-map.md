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
| `src/components/BattleMap/` | Directory | Battle map components |
| `src/components/BattleMap/BattleMap.tsx` | Component | Main grid |
| `src/components/BattleMap/BattleMapDemo.tsx` | Component | Demo/test mode |
| `src/components/BattleMap/BattleMapTile.tsx` | Component | Grid tiles |
| `src/components/BattleMap/BattleMapOverlay.tsx` | Component | Overlays |
| `src/components/BattleMap/CharacterToken.tsx` | Component | Tokens |
| `src/components/BattleMap/InitiativeTracker.tsx` | Component | Initiative |
| `src/components/BattleMap/CombatLog.tsx` | Component | Log display |
| `src/components/BattleMap/ActionEconomyBar.tsx` | Component | Action economy |
| `src/components/BattleMap/PartyDisplay.tsx` | Component | Party status |
| `src/components/BattleMap/DamageNumberOverlay.tsx` | Component | Damage numbers |
| `src/components/BattleMap/AbilityButton.tsx` | Component | Ability buttons |
| `src/components/BattleMap/AbilityPalette.tsx` | Component | Ability palette |
| `src/components/BattleMap/AISpellInputModal.tsx` | Component | AI spell input |
| `src/components/BattleMap/index.ts` | Index | Public exports |
| `src/hooks/useBattleMap.ts` | Hook | Map state |
| `src/hooks/useBattleMapGeneration.ts` | Hook | Map generation |
| `src/services/battleMapGenerator.ts` | Service | Map generation |

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
