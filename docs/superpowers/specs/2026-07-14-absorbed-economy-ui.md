# Absorbed project: economy-ui (docs/projects/economy-ui)

Absorbed into planmap topic `economy-player-surface` on 2026-07-15 (wave 10R).
The folder is deleted; git history is the archive. This doc keeps the
still-useful design decisions and cold-start context.

## What this surface is

The universal UI framework for any place gold changes hands: buying, selling,
hiring, investing, paying fees, receiving rewards. Highly abstract and
framework-level today, not graphically designed. Goal: every transaction
surface routes through the economy framework so market factors, faction
standings, and regional context influence pricing consistently. Economy
simulation math itself is out of scope here (see
`docs/superpowers/specs/2026-07-14-absorbed-economy.md`).

## Live design decisions (keep true)

- Reducer ownership contract (T4, intentional split — do NOT migrate):
  `uiReducer` owns the TradeRouteDashboard and InvestmentBoard visibility
  flags; `economyReducer` owns the LedgerBook and CourierPouch visibility
  flags.
- Modal hosting model (T2): `TradeRouteDashboard`, `LedgerBook`,
  `CourierPouch`, and `InvestmentBoard` all mount in
  `src/components/layout/GameModals.tsx`, close via the fallback Escape
  chain, and open via `TOGGLE_*` dispatches. InvestmentBoard buttons dispatch
  `INVEST_IN_CARAVAN` and `TAKE_LOAN`.
- Entry points are dev-menu-only by design until a product pass requests
  player-visible economy surfaces — do not wire in-world triggers
  prematurely (G4).

## File map

- `src/components/Trade/MerchantModal.tsx` — live merchant/shop UI (trade +
  rumor tabs)
- `src/components/Trade/TradeRouteDashboard.tsx`, `RouteCard.tsx`,
  `MarketEventCard.tsx`
- `src/components/Economy/LedgerBook.tsx` — treasury, investments,
  businesses, debts tabs
- `src/components/Economy/InvestmentBoard.tsx` — caravan, loan, speculation
- `src/components/Economy/CourierPouch.tsx` — courier messages, market intel
- `src/components/layout/GameModals.tsx` — overlay host + Escape chain
- Close-path regression coverage:
  `src/components/layout/__tests__/GameModals.test.tsx`

## Known bypass inventory (open gaps G8/G9 context)

Surfaces that handle gold with direct arithmetic instead of the economy
framework: crafting (`AlchemyBenchPanel`), fencing (`FenceInterface`), org
upgrades (`OrgUpgradesList`), quest rewards (`QuestCard`), combat loot
(`CombatView`). Business acquisition and NPC business management have backend
systems (`BusinessAcquisition.ts`, `NpcBusinessManager.ts`) but no UI.
Missing transaction domains: mounts, ships, hirelings, housing, inns,
temples, training, guild fees, enchanting, gambling, tolls, bribery,
bounties, spell components, naval voyage costs.
