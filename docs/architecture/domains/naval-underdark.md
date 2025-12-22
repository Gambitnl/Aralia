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
| `src/utils/naval*.ts` | Utils | Naval utilities |
| `src/utils/underdark*.ts` | Utils | Underdark helpers |

## Dependencies

### Depends On

- **[Combat](./combat.md)**: Naval combat overrides base combat logic

### Used By

- **[Submap](./submap.md)**: Underdark regions and sea travel

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/underdark/__tests__/FaerzressSystem.test.ts` | Unit test |
| `src/systems/underdark/__tests__/UnderdarkBiomeMechanics.test.ts` | Unit test |
| `src/systems/underdark/__tests__/UnderdarkFactionSystem.test.ts` | Unit test |
| `src/systems/underdark/__tests__/UnderdarkMechanics.test.ts` | Unit test |
