# Crafting & Economy

## Purpose

Manages crafting systems (alchemy, enchanting, salvaging), trade routes, market events, and the overall game economy.

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/crafting/` | Crafting implementation |
| `src/systems/economy/` | Economic systems |

## Subcomponents

- **Crafting**: Alchemy, Enchanting, and Salvaging systems.
- **Economy**: Trade routes and market dynamics.

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/crafting/**/*.ts` | Directory | Crafting systems |
| `src/data/economy/*.ts` | Data | Economic definitions |
| `src/utils/coinPurseUtils.ts` | Utils | Currency handling |

## Economy Systems (Shared with Items/Trade Domain)

Trade route and market economy systems are managed by the [Items / Trade / Inventory](./items-trade-inventory.md) domain. These files are not owned by crafting-economy.

This crafting-economy domain owns only pure crafting mechanics.

## Dependencies

### Depends On

- **[Items / Trade / Inventory](./items-trade-inventory.md)**: Crafting recipes use items

### Used By

- **[Character Sheet](./character-sheet.md)**: Crafting interfaces
- **[Town Map](./town-map.md)**: Economic state in towns

### Tests

Trade route tests are owned by the [Items / Trade / Inventory](./items-trade-inventory.md) domain.
See items-trade-inventory.md for test ownership details.
