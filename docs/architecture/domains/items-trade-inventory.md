# Items / Trade / Inventory

## Purpose

This domain manages the item system including inventory management, equipment, merchants, trading, and the economy. It handles item definitions, stacking, equipping, and commercial transactions.

## Key Entry Points

| File | Role |
|------|------|
| `src/components/MerchantModal.tsx` | Trading interface |
| `src/components/Organization/OrganizationDashboard.tsx` | Organization management |
| `src/types/items.ts` | Item type definitions |
| `src/data/items/` | Item data definitions |

## Subcomponents

- **Inventory Display**: `InventoryList.tsx` - Item list and management
- **Merchant Interface**: `MerchantModal.tsx` - Buy/sell transactions
- **Organization UI**: `src/components/Organization/` - Guild/Order management
- **Item Data**: `src/data/items/`, `item_templates/` - Item definitions
- **Economy**: `src/systems/economy/` - Economic mechanics
- **Loot Service**: `lootService.ts` - Loot generation

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/components/MerchantModal.tsx` | Component | Merchant interface |
| `src/components/Organization/*.tsx` | Component | Organization management UI |
| `src/data/items/**/*.ts` | Directory | Item definitions |
| `src/data/item_templates/**/*.ts` | Directory | Item templates |
| `src/data/tradeRoutes.ts` | Data | Trade route definitions |
| `src/systems/economy/*.ts` | Directory | Economy systems |
| `src/services/lootService.ts` | Service | Loot generation |
| `src/services/organizationService.ts` | Service | Faction and trade organizations |
| `src/utils/economy/*.ts` | Utils | Economy calculations |
| `src/types/items.ts` | Types | Item types |
| `src/types/magicItems.ts` | Types | Magic item types |
| `src/types/economy.ts` | Types | Economy types |
| `src/types/crafting.ts` | Types | Crafting types |


## Dependencies

### Depends On

- **[Character Sheet](./character-sheet.md)**: Equipment display
- **[Combat](./combat.md)**: Weapon/armor stats in combat

### Used By

- **[Character Sheet](./character-sheet.md)**: Equipment management
- **[Town Map](./town-map.md)**: Merchant access
- **[Combat](./combat.md)**: Item usage in combat

## Boundaries / Constraints

- Item data should be centralized in `src/data/items/`
- Inventory changes should go through proper state management
- Magic item identification rules should be enforced
- Economy calculations should use `economyUtils.ts`

## Open Questions / TODOs

- [ ] Document item stacking rules
- [ ] Clarify magic item attunement system
- [ ] Map crafting integration (if any)

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/components/Organization/__tests__/OrganizationDashboard.test.tsx` | Organization dashboard tests |
| `src/systems/economy/__tests__/TradeRouteManager.test.ts` | Trade route manager tests |
| `src/systems/economy/__tests__/TradeRouteSystem.test.ts` | Trade route system tests |
| `src/utils/__tests__/coinPurseUtils.test.ts` | Coin purse utility tests |
| `src/utils/__tests__/economyUtils.test.ts` | Economy utility tests |
| `src/utils/__tests__/entityIntegrationUtils.test.ts` | Entity integration utility tests |
