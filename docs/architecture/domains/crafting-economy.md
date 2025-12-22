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
| `src/systems/economy/*.ts` | Directory | Economic systems |
| `src/utils/economy/*.ts` | Utils | Economic helpers |
| `src/utils/coinPurseUtils.ts` | Utils | Currency handling |

## Dependencies

### Depends On

- **[Items / Trade / Inventory](./items-trade-inventory.md)**: Crafting recipes use items

### Used By

- **[Character Sheet](./character-sheet.md)**: Crafting interfaces
- **[Town Map](./town-map.md)**: Economic state in towns

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/economy/__tests__/TradeRouteManager.test.ts` | Unit test |
| `src/systems/economy/__tests__/TradeRouteSystem.test.ts` | Unit test |
