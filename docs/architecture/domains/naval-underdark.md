# Naval & Underdark

## Purpose

Specialized environment systems for naval combat/travel and Underdark-specific mechanics (Faerzress, specialized factions).

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/naval/` | Naval systems |
| `src/systems/underdark/` | Underdark systems |

## Subcomponents

- **Naval**: Crew management, voyage mechanics, and ship-to-ship combat.
- **Underdark**: Underdark factions and mechanics.

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/naval/**/*.ts` | Directory | Naval systems |
| `src/systems/underdark/*.ts` | Directory | Underdark systems |
| `src/data/naval/*.ts` | Data | Naval definitions |
| `src/data/ship*.ts` | Data | Ship definitions |
| `src/data/underdark*.ts` | Data | Underdark data |
| `src/data/navalManeuvers.ts` | Data | Naval maneuvers |
| `src/services/underdarkService.ts` | Service | Underdark logic |
| `src/utils/naval*.ts` | Utils | Naval utilities |
| `src/utils/underdark*.ts` | Utils | Underdark helpers |
| `src/types/naval*.ts` | Types | Naval types |
| `src/types/underdark.ts` | Types | Underdark types |
| `src/types/infernal.ts` | Types | Infernal plane types |

## Dependencies

### Depends On

- **[Combat](./combat.md)**: Naval combat overrides base combat logic

### Used By

- **[Submap](./submap.md)**: Underdark regions and sea travel

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/underdark/__tests__/FaerzressSystem.test.ts` | Faerzress system tests |
| `src/systems/underdark/__tests__/UnderdarkBiomeMechanics.test.ts` | Underdark biome mechanics tests |
| `src/systems/underdark/__tests__/UnderdarkFactionSystem.test.ts` | Underdark faction system tests |
| `src/systems/underdark/__tests__/UnderdarkMechanics.test.ts` | Underdark mechanics tests |
| `src/services/__tests__/underdarkService.test.ts` | Underdark service tests |
| `src/utils/__tests__/navalCombatUtils.test.ts` | Naval combat utility tests |
| `src/utils/__tests__/navalUtils.test.ts` | Naval utility tests |
