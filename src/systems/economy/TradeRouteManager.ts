/**
 * @file src/systems/economy/TradeRouteManager.ts
 * Manages trade routes, simulates goods movement, and updates local market conditions (Scarcity/Surplus).
 */
import {
  EconomySystemState,
  TradeRoute,
  MarketNode,
  EconomyState,
  GameState,
  GameMessage
} from '../../types';
import { generateId } from '../../utils/idGenerator';
import { getGameEpoch } from '../../utils/timeUtils';

// Constants
const TRADE_TICK_HOURS = 4; // Trade updates every 4 game hours
const MAX_ROUTES_PER_NODE = 3;
const BASE_TRAVEL_SPEED_KMH = 5; // Caravan speed
const DISTANCE_SCALE = 10; // Arbitrary distance unit scale for now

// Placeholder for major settlements if they aren't in dynamicLocations yet
// In a real scenario, we'd scan GameState.dynamicLocations or static world data
const MAJOR_MARKETS = [
  { id: 'market_village_start', name: 'Oakheart Village', production: ['food_drink', 'crafting_material'], consumption: ['weapon', 'tool'] },
  { id: 'market_city_capital', name: 'Aralia City', production: ['weapon', 'armor', 'luxury'], consumption: ['food_drink', 'crafting_material'] },
  { id: 'market_outpost_north', name: 'Northern Outpost', production: ['ore', 'monster_part'], consumption: ['food_drink', 'medicine'] }
];

export class TradeRouteManager {

  /**
   * Initializes the economy system if it doesn't exist.
   */
  static initializeState(): EconomySystemState {
    const nodes: Record<string, MarketNode> = {};

    // Initialize nodes for known markets
    MAJOR_MARKETS.forEach(m => {
      nodes[m.id] = {
        locationId: m.id,
        production: m.production,
        consumption: m.consumption,
        inventoryLevel: {}
      };

      // Initial inventory
      m.production.forEach(tag => nodes[m.id].inventoryLevel[tag] = 80); // High supply of local goods
      m.consumption.forEach(tag => nodes[m.id].inventoryLevel[tag] = 20); // Low supply of imports
    });

    return {
      routes: [],
      nodes,
      globalVolatility: 0.1,
      lastUpdateTimestamp: 0
    };
  }

  /**
   * Main simulation tick.
   * Call this when time advances.
   */
  static processEconomyTick(gameState: GameState): Partial<GameState> {
    const now = gameState.gameTime.getTime();
    let ecoSystem = gameState.economy.system;

    // Initialize if missing
    if (!ecoSystem) {
      ecoSystem = this.initializeState();
    }

    // Check if enough time has passed
    const hoursSinceLastUpdate = (now - ecoSystem.lastUpdateTimestamp) / (1000 * 60 * 60);
    if (ecoSystem.lastUpdateTimestamp > 0 && hoursSinceLastUpdate < TRADE_TICK_HOURS) {
        return {}; // No update needed yet
    }

    // Deep copy to avoid mutation
    const nextSystem = JSON.parse(JSON.stringify(ecoSystem)) as EconomySystemState;
    nextSystem.lastUpdateTimestamp = now;

    // Determine how many "ticks" we missed if time jumped significantly
    // Limit catch-up to avoid freezing (e.g., max 7 days worth of ticks)
    const ticksToProcess = Math.min(42, Math.floor(hoursSinceLastUpdate / TRADE_TICK_HOURS)) || 1;
    const totalTimeDelta = ticksToProcess * TRADE_TICK_HOURS;

    // 1. Update active routes
    const completedRoutes: TradeRoute[] = [];
    nextSystem.routes = nextSystem.routes.map(route => {
      if (route.status !== 'active') return route;

      const newProgress = route.progress + (totalTimeDelta / route.durationHours);
      if (newProgress >= 1) {
        route.progress = 1;
        route.status = 'completed';
        completedRoutes.push(route);
      } else {
        route.progress = newProgress;
      }
      return route;
    });

    // 2. Process completions (Offload goods)
    completedRoutes.forEach(route => {
      const node = nextSystem.nodes[route.destinationLocationId];
      if (node) {
        route.goods.forEach(good => {
          const current = node.inventoryLevel[good.itemType] || 0;
          node.inventoryLevel[good.itemType] = Math.min(100, current + good.volume);
        });
      }
    });

    // Remove completed routes from list to keep it clean (or archive them)
    nextSystem.routes = nextSystem.routes.filter(r => r.status !== 'completed');

    // 3. Generate new routes
    this.generateNewRoutes(nextSystem, now);

    // 4. Update Market Factors (Surplus/Scarcity) based on Inventory Levels
    // This connects the simulation back to the visible EconomyState
    const nextMarketFactors = {
        scarcity: [] as string[],
        surplus: [] as string[]
    };

    // Update global economy state based on the Player's current location (or closest node)
    // For now, we aggregate global trends or find the node matching current location
    // Simplification: Player is always near 'market_village_start' or we check actual ID
    // If player is in a known market node, use that node's stats.
    // Otherwise, use a default mix or the nearest one.

    // For MVP, let's just use 'market_village_start' as the "local" market for the player
    // TODO: Map actual player location ID to market nodes
    const localNode = nextSystem.nodes['market_village_start'];
    if (localNode) {
        Object.entries(localNode.inventoryLevel).forEach(([tag, level]) => {
            if (level > 75) nextMarketFactors.surplus.push(tag);
            if (level < 30) nextMarketFactors.scarcity.push(tag);
        });
    }

    // Return the partial gamestate update
    return {
        economy: {
            ...gameState.economy,
            marketFactors: nextMarketFactors,
            system: nextSystem
        }
    };
  }

  private static generateNewRoutes(system: EconomySystemState, now: number) {
     // For each node, if it has high inventory of produced goods, try to send to a consumer
     Object.values(system.nodes).forEach(sourceNode => {
         // Limit concurrent routes per source
         const activeRoutesFromSource = system.routes.filter(r => r.originLocationId === sourceNode.locationId).length;
         if (activeRoutesFromSource >= MAX_ROUTES_PER_NODE) return;

         sourceNode.production.forEach(prodTag => {
             const level = sourceNode.inventoryLevel[prodTag] || 0;
             if (level > 60) {
                 // Find a buyer
                 const targetNode = Object.values(system.nodes).find(n =>
                     n.locationId !== sourceNode.locationId &&
                     n.consumption.includes(prodTag) &&
                     (n.inventoryLevel[prodTag] || 0) < 50
                 );

                 if (targetNode) {
                     // Create Route
                     const volume = 20;
                     sourceNode.inventoryLevel[prodTag] -= volume; // Remove from source immediately

                     const newRoute: TradeRoute = {
                         id: generateId(), // Removed argument as generateId() takes no arguments
                         originLocationId: sourceNode.locationId,
                         destinationLocationId: targetNode.locationId,
                         goods: [{ itemType: prodTag, volume }],
                         startTime: now,
                         durationHours: 24, // simplified fixed duration
                         progress: 0,
                         status: 'active',
                         risk: 0.1
                     };
                     system.routes.push(newRoute);
                 }
             }
         });
     });
  }
}
