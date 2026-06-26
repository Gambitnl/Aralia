# Merchant Pricing And Economy Integration

This capability note tracks how shared economy pricing is wired into merchant trading. The core pricing path is already implemented: MerchantModal calls the shared price calculator, and the calculator already applies market events, scarcity and surplus logic, regional modifiers, inflation, and faction trade bonuses.

## Current Status

Merchant pricing is implemented as a shared capability, not as a merchant-only hardcoded rule set.

## Verified Repo Surfaces

- src/components/Trade/MerchantModal.tsx
- src/utils/economy/economyUtils.ts
- src/utils/economy/index.ts
- src/systems/economy/RegionalEconomySystem.ts
- src/systems/world/FactionEconomyManager.ts

## Verified Capabilities

### Merchant Price Calculation

- MerchantModal.tsx calls calculatePrice for both buy and sell actions instead of embedding separate manual pricing logic.
- economyUtils.ts normalizes item value, applies transaction-specific rounding, and preserves a minimum sell price for low-value goods.

### Regional Price Modifiers

- calculatePrice applies market event effects, legacy scarcity and surplus logic, import and export modifiers, and region-level inflation and wealth adjustments.
- The regional modifier path already reaches getRegionalPriceModifier and can respond to live economy state.

### Merchant Modal Price Wiring

- MerchantModal.tsx passes economy, regionId, faction data, and player standings into the shared calculator.
- The modal also surfaces visible demand and scarcity context instead of hiding the economy state entirely.

### Faction Trade Price Modifiers

- economyUtils.ts already applies faction trade bonuses through getFactionTradeBonus when faction context is available.

## Remaining Gaps Or Uncertainty

- This doc no longer frames merchant pricing as an unimplemented integration target, because the shared pricing path already exists.
- Broader economy roadmap items such as businesses, investments, or courier intelligence still live elsewhere and should not be conflated with the already-implemented merchant pricing layer.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/feature-capabilities/merchant-pricing-economy.md","sha256WithoutMarker":"cd8379bf6f4a2b467ec8db19df6f958a0a9147a21a173d9c5dc1a74a13c75959","markedAtUtc":"2026-06-25T22:29:38.609Z"} -->
