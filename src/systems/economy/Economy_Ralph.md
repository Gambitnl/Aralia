# Economy Component Documentation (Ralph)

## Overview
This folder contains the Global Trade Simulation logic. It models trade routes between regions, dynamic profitability based on supply/demand (Exports vs Imports), and market disruptions like blockades or booms.

## Files
- **TradeRouteManager.ts**: The simulation runner. It processes "Days Passed" to calculate if routes get blockaded (Risk check) or boom (Profitability check). It uses statistical probability scaling `(1 - (1-p)^days)` to handle time jumps accurately.
- **TradeRouteSystem.ts**: The logic core. It calculates the *Profitability Score* (0-100) of a route by comparing the Origin's exports against the Destination's imports. It also calculates Risk based on global events (War, Festivals).

## Issues & Opportunities
- **Type Safety**: `TradeRouteManager.ts` has defensive coding for `gameTime` (`typeof state.gameTime === 'number' ? ...`) which suggests the Redux state type for `gameTime` is inconsistent across the app (Date vs Number).
- **Legacy Debt**: `processDailyRoutes` manually maintains `marketFactors` (scarcity/surplus sets) alongside `marketEvents`. This duplication risks desynchronization.
- **Hardcoded Values**: `TradeRouteSystem.ts` uses hardcoded scoring (+20, -10, etc.) for profitability. Moving these to a config/constants file would make balancing easier.
