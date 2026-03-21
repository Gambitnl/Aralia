# Items / Trade / Inventory

## Purpose

This domain covers the item, trade, merchant, and economy-adjacent surfaces that support inventory management, pricing, trade routes, loot, and organization-facing economic UI.
The current repo shape is broader than a single inventory modal, but narrower than the older doc's attempt to make every economy-related file one clean ownership block.

## Verified Entry Points

- src/components/Trade/MerchantModal.tsx
- src/components/Organization/OrganizationDashboard.tsx
- src/data/items/
- src/data/item_templates/
- src/systems/economy/
- src/services/lootService.ts
- src/types/items.ts
- src/types/economy.ts
- src/types/crafting.ts

## Current Shape

### Trade UI lane

The live merchant and trade UI now sits under src/components/Trade/ rather than at a root-level MerchantModal path.
This pass verified:

- src/components/Trade/MerchantModal.tsx
- src/components/Trade/TradeRouteDashboard.tsx
- src/components/Trade/MarketEventCard.tsx
- src/components/Trade/RouteCard.tsx
- src/components/Trade/__tests__/MerchantModal.test.tsx

### Organization and economy-adjacent UI

This pass verified the organization dashboard lane under src/components/Organization/, including OrganizationDashboard.tsx and its test coverage.
That surface is related to economy and trade systems, but it should be treated as adjacent integration rather than as proof that all organization features belong to one unified inventory domain.

### Data and systems lane

This pass verified:

- src/data/items/
- src/data/item_templates/
- src/data/tradeRoutes.ts
- src/systems/economy/
- src/utils/economy/economyUtils.ts
- src/hooks/actions/handleMerchantInteraction.ts
- src/services/lootService.ts
- src/services/organizationService.ts

## Important Corrections

- The live merchant UI path is src/components/Trade/MerchantModal.tsx, not src/components/MerchantModal.tsx.
- The repo now has a real Trade component subtree and a real systems/economy subtree, so the older flat ownership summary had drifted.
- Crafting is related, but this file should describe it as an adjacent shared type and integration lane, not as proof that a single finished crafting architecture already exists here.

## Tests Verified In This Pass

- src/components/Trade/__tests__/MerchantModal.test.tsx
- src/components/Organization/__tests__/OrganizationDashboard.test.tsx
- src/systems/economy/__tests__/TradeRouteManager.test.ts
- src/systems/economy/__tests__/TradeRouteSystem.test.ts
- src/utils/economy/__tests__/economyUtils.test.ts
- src/hooks/actions/__tests__/handleMerchantInteraction.test.ts
- src/services/__tests__/lootService.test.ts
- src/services/__tests__/organizationService.test.ts

## Current Interpretation

Re-verified on 2026-03-11.
Treat this domain as the item plus trade plus economy integration lane: data, merchant UI, trade-route systems, pricing helpers, and loot generation that multiple gameplay surfaces consume.
